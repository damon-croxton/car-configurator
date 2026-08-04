import * as THREE from 'three';
import type { MaterialLibrary } from './materialLibrary';
import { AERO_SLOT_NODE, NODE } from './nodeNames';
import { buildWheel } from './proceduralWheel';
import {
  loftGeometry,
  mergeParts,
  place,
  roundedBox,
  stationHalfWidthAt,
  surfaceGeometry,
  type Station,
} from './geometryUtils';
import type { Generation } from '../data/schema';

/**
 * Parametric ND MX-5 built entirely from code.
 *
 * This is the fail-safe path: when no GLB is present (or one fails to load)
 * the configurator still renders a complete, correctly-named car so every
 * toggle in the UI stays live. The node names match `nodeNames.ts` exactly, so
 * dropping in an authored asset later is a pure data swap.
 *
 * Axes: +Z is forward (nose), +X is right, Y is up with the ground at 0.
 */

const SEG = 64;
const HALF = Math.PI / 2;

/** Reference dimensions the stations below were authored against (ND). */
const REF = { length: 3.915, width: 1.735, height: 1.23 };

interface BodySection {
  z: number;
  top: number;
  bottom: number;
  a: number;
  p: number;
  /** Fraction of the section's circumference removed at the top (cockpit cut). */
  open: number;
  /** Rocker tuck — see `Station.tuck`. Keeps the wheels proud of the sills. */
  tuck: number;
}

const BODY_SECTIONS: BodySection[] = [
  { z: 1.958, top: 0.63, bottom: 0.34, a: 0.5, p: 3.0, open: 0, tuck: 0.1 },
  { z: 1.9, top: 0.7, bottom: 0.26, a: 0.68, p: 3.1, open: 0, tuck: 0.12 },
  { z: 1.8, top: 0.745, bottom: 0.19, a: 0.79, p: 3.3, open: 0, tuck: 0.16 },
  { z: 1.62, top: 0.775, bottom: 0.145, a: 0.845, p: 3.5, open: 0, tuck: 0.2 },
  { z: 1.4, top: 0.792, bottom: 0.128, a: 0.862, p: 3.7, open: 0, tuck: 0.24 },
  { z: 1.155, top: 0.8, bottom: 0.122, a: 0.868, p: 3.8, open: 0, tuck: 0.26 },
  { z: 0.9, top: 0.8, bottom: 0.122, a: 0.848, p: 3.8, open: 0, tuck: 0.28 },
  { z: 0.62, top: 0.815, bottom: 0.125, a: 0.842, p: 3.9, open: 0, tuck: 0.28 },
  { z: 0.42, top: 0.862, bottom: 0.125, a: 0.845, p: 4.0, open: 0.1, tuck: 0.28 },
  { z: 0.2, top: 0.888, bottom: 0.125, a: 0.85, p: 4.05, open: 0.14, tuck: 0.28 },
  { z: -0.1, top: 0.895, bottom: 0.125, a: 0.856, p: 4.1, open: 0.155, tuck: 0.28 },
  { z: -0.45, top: 0.895, bottom: 0.128, a: 0.86, p: 4.1, open: 0.155, tuck: 0.28 },
  { z: -0.72, top: 0.885, bottom: 0.132, a: 0.864, p: 4.0, open: 0.12, tuck: 0.28 },
  { z: -0.9, top: 0.868, bottom: 0.135, a: 0.866, p: 3.9, open: 0, tuck: 0.27 },
  { z: -1.155, top: 0.845, bottom: 0.14, a: 0.868, p: 3.8, open: 0, tuck: 0.26 },
  { z: -1.45, top: 0.815, bottom: 0.15, a: 0.855, p: 3.6, open: 0, tuck: 0.22 },
  { z: -1.72, top: 0.775, bottom: 0.175, a: 0.815, p: 3.4, open: 0, tuck: 0.17 },
  { z: -1.88, top: 0.715, bottom: 0.225, a: 0.72, p: 3.2, open: 0, tuck: 0.12 },
  { z: -1.958, top: 0.65, bottom: 0.32, a: 0.55, p: 3.0, open: 0, tuck: 0.1 },
];

const toStation = (s: BodySection, inflate = 0): Station => ({
  z: s.z,
  cy: (s.top + s.bottom) / 2,
  a: s.a + inflate,
  b: (s.top - s.bottom) / 2 + inflate,
  p: s.p,
  tuck: s.tuck,
  thetaStart: HALF + s.open * Math.PI,
  thetaEnd: HALF + Math.PI * 2 - s.open * Math.PI,
});

/** Linearly interpolated body section at an arbitrary Z. */
function sectionAt(z: number): BodySection {
  const first = BODY_SECTIONS[0];
  const last = BODY_SECTIONS[BODY_SECTIONS.length - 1];
  if (z >= first.z) return first;
  if (z <= last.z) return last;

  for (let i = 0; i < BODY_SECTIONS.length - 1; i++) {
    const a = BODY_SECTIONS[i];
    const b = BODY_SECTIONS[i + 1];
    if (z <= a.z && z >= b.z) {
      const t = a.z === b.z ? 0 : (a.z - z) / (a.z - b.z);
      const lerp = THREE.MathUtils.lerp;
      return {
        z,
        top: lerp(a.top, b.top, t),
        bottom: lerp(a.bottom, b.bottom, t),
        a: lerp(a.a, b.a, t),
        p: lerp(a.p, b.p, t),
        open: lerp(a.open, b.open, t),
        tuck: lerp(a.tuck, b.tuck, t),
      };
    }
  }
  return first;
}

/** Height of the body's top surface on the centreline. */
const bodyTopAt = (z: number): number => sectionAt(z).top;

/** Half-width of the body surface at a point — used to plant side details. */
const bodyXAt = (z: number, y: number): number => stationHalfWidthAt(toStation(sectionAt(z)), y);

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  shadows = true,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = shadows;
  result.receiveShadow = shadows;
  return result;
}

const merge = mergeParts;

function group(name: string, ...children: THREE.Object3D[]): THREE.Group {
  const result = new THREE.Group();
  result.name = name;
  // `Object3D.add()` throws on an empty argument list, and "stock" variants are
  // deliberately empty groups.
  if (children.length > 0) result.add(...children);
  return result;
}

/** Mirror a geometry across the centreline and merge both halves. */
function mirrored(build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const right = build();
  const left = build();
  left.scale(-1, 1, 1);
  const index = left.getIndex();
  if (index) {
    const array = index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < array.length; i += 3) {
      const swap = array[i];
      array[i] = array[i + 2];
      array[i + 2] = swap;
    }
    index.needsUpdate = true;
  }
  left.computeVertexNormals();
  return merge([right, left]);
}

/* ------------------------------------------------------------------ */
/* Body shell                                                          */
/* ------------------------------------------------------------------ */

function buildBodyShell(): THREE.BufferGeometry {
  return loftGeometry(
    BODY_SECTIONS.map((section) => toStation(section)),
    SEG,
    { capStart: true, capEnd: true },
  );
}

/**
 * Cockpit tub. A closed pod with inverted winding: from outside the car it is
 * invisible (back-faces are culled), through the cockpit opening you see its
 * inner surfaces. That gives a hollow-looking cabin without booleans.
 */
function buildCockpitTub(): THREE.BufferGeometry {
  const sweep = { thetaStart: HALF, thetaEnd: HALF + Math.PI * 2 };
  const sections: Station[] = [
    { z: 0.46, cy: (0.855 + 0.44) / 2, a: 0.79, b: (0.855 - 0.44) / 2, p: 4.6, ...sweep },
    { z: 0.2, cy: (0.88 + 0.42) / 2, a: 0.8, b: (0.88 - 0.42) / 2, p: 4.6, ...sweep },
    { z: -0.1, cy: (0.888 + 0.4) / 2, a: 0.805, b: (0.888 - 0.4) / 2, p: 4.6, ...sweep },
    { z: -0.45, cy: (0.888 + 0.4) / 2, a: 0.805, b: (0.888 - 0.4) / 2, p: 4.6, ...sweep },
    { z: -0.72, cy: (0.878 + 0.44) / 2, a: 0.8, b: (0.878 - 0.44) / 2, p: 4.6, ...sweep },
    { z: -0.88, cy: (0.86 + 0.5) / 2, a: 0.78, b: (0.86 - 0.5) / 2, p: 4.6, ...sweep },
  ];
  return loftGeometry(sections, 40, { capStart: true, capEnd: true, invert: true });
}

/**
 * Fender flares. The tucked underbody leaves the wheels proud of the sills;
 * these arches wrap the top of each opening so the transition reads as a
 * pressed arch rather than a hole.
 */
function buildFenderArches(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const z of [1.155, -1.155]) {
    for (const side of [-1, 1]) {
      const arch = new THREE.TorusGeometry(0.375, 0.028, 8, 28, Math.PI);
      arch.scale(1, 1, 0.9);
      arch.rotateY(HALF);
      arch.translate(side * (bodyXAt(z, 0.62) - 0.02), 0.318, z);
      parts.push(arch);
    }
  }
  return merge(parts);
}

/** A panel that sits on the body's top surface between two Z stations. */
function topPanel(zFront: number, zRear: number, halfSweep: number, offset: number, steps = 12) {
  const sections: Station[] = [];
  for (let i = 0; i <= steps; i++) {
    const z = THREE.MathUtils.lerp(zFront, zRear, i / steps);
    const station = toStation(sectionAt(z), offset);
    station.thetaStart = HALF - halfSweep;
    station.thetaEnd = HALF + halfSweep;
    sections.push(station);
  }
  return loftGeometry(sections, 28, {});
}

/* ------------------------------------------------------------------ */
/* Glass                                                               */
/* ------------------------------------------------------------------ */

function buildWindshield(): THREE.BufferGeometry {
  return surfaceGeometry(
    (u, v, target) => {
      const s = u * 2 - 1;
      const halfWidth = 0.72 - 0.12 * v;
      const zc = 0.44 - 0.5 * v;
      const yc = 0.855 + 0.345 * v;
      target.set(halfWidth * s, yc - 0.05 * s * s * v, zc + 0.07 * (1 - s * s));
    },
    24,
    10,
  );
}

function buildAPillars(): THREE.BufferGeometry {
  const build = () => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const v = i / 12;
      const halfWidth = 0.72 - 0.12 * v;
      points.push(new THREE.Vector3(halfWidth, 0.855 + 0.345 * v - 0.05 * v, 0.44 - 0.5 * v));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 16, 0.026, 8, false);
  };

  const header = () => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const s = (i / 12) * 2 - 1;
      points.push(new THREE.Vector3(0.6 * s, 1.2 - 0.05 * s * s, -0.06 + 0.07 * (1 - s * s)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.024, 8, false);
  };

  return merge([mirrored(build), header()]);
}

function buildSideWindows(): THREE.BufferGeometry {
  const build = () =>
    surfaceGeometry(
      (u, v, target) => {
        const z = THREE.MathUtils.lerp(0.28, -0.44, u);
        const baseY = 0.885;
        // Follows the soft-top's side line, tapering toward the rear.
        const topY = THREE.MathUtils.lerp(1.14, 1.0, u);
        target.set(0.842 - 0.02 * v, THREE.MathUtils.lerp(baseY, topY, v), z);
      },
      10,
      6,
    );
  return mirrored(build);
}

/* ------------------------------------------------------------------ */
/* Roofs                                                               */
/* ------------------------------------------------------------------ */

const SOFT_TOP_SECTIONS: Station[] = [
  { z: -0.06, cy: 1.16, a: 0.6, b: 0.075, p: 2.4, thetaStart: 0, thetaEnd: Math.PI },
  { z: -0.22, cy: 1.03, a: 0.635, b: 0.2, p: 2.6, thetaStart: 0, thetaEnd: Math.PI },
  { z: -0.45, cy: 0.9, a: 0.675, b: 0.33, p: 2.8, thetaStart: 0, thetaEnd: Math.PI },
  { z: -0.68, cy: 0.888, a: 0.705, b: 0.3, p: 2.9, thetaStart: 0, thetaEnd: Math.PI },
  { z: -0.85, cy: 0.882, a: 0.735, b: 0.175, p: 3.1, thetaStart: 0, thetaEnd: Math.PI },
  { z: -0.96, cy: 0.872, a: 0.75, b: 0.045, p: 3.3, thetaStart: 0, thetaEnd: Math.PI },
];

function buildSoftTopSkin(): THREE.BufferGeometry {
  return loftGeometry(SOFT_TOP_SECTIONS, 40, {});
}

function buildSoftTopRearWindow(): THREE.BufferGeometry {
  return surfaceGeometry(
    (u, v, target) => {
      const s = u * 2 - 1;
      const z = THREE.MathUtils.lerp(-0.7, -0.88, v);
      const y = THREE.MathUtils.lerp(1.17, 0.955, v);
      const halfWidth = THREE.MathUtils.lerp(0.42, 0.4, v);
      // Pushed a few millimetres proud of the canvas to avoid z-fighting.
      target.set(halfWidth * s, y + 0.012 - 0.05 * s * s, z + 0.012);
    },
    16,
    8,
  );
}

/** Folded soft top stowed behind the seats. */
function buildSoftTopStowed(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bundle = new THREE.SphereGeometry(0.56, 24, 12, 0, Math.PI * 2, 0, HALF);
  bundle.scale(1.0, 0.16, 0.42);
  bundle.translate(0, 0.885, -0.72);
  parts.push(bundle);

  for (let i = 0; i < 3; i++) {
    const rib = new THREE.TorusGeometry(0.5 - i * 0.03, 0.014, 6, 24, Math.PI);
    rib.rotateY(HALF);
    rib.scale(1, 0.22, 1);
    rib.translate(0, 0.9 + i * 0.006, -0.63 - i * 0.07);
    parts.push(rib);
  }
  return merge(parts);
}

/** RF fastback buttresses — present whether the targa panel is up or down. */
function buildRfButtresses(): THREE.BufferGeometry {
  const build = () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.1, 1.2);
    shape.quadraticCurveTo(-0.62, 1.15, -1.02, 0.88);
    shape.lineTo(-1.08, 0.83);
    shape.quadraticCurveTo(-0.6, 0.87, -0.1, 0.95);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.115,
      bevelEnabled: true,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      bevelSegments: 2,
      curveSegments: 10,
    });
    // Shape X maps to world Z, extrusion runs along world -X.
    geometry.rotateY(-HALF);
    geometry.translate(0.635, 0, 0);
    return geometry;
  };
  return mirrored(build);
}

function buildRfTargaPanel(): THREE.BufferGeometry {
  const sections: Station[] = [
    { z: -0.06, cy: 1.165, a: 0.595, b: 0.07, p: 2.6, thetaStart: 0, thetaEnd: Math.PI },
    { z: -0.2, cy: 1.06, a: 0.615, b: 0.175, p: 2.8, thetaStart: 0, thetaEnd: Math.PI },
    { z: -0.36, cy: 0.98, a: 0.63, b: 0.245, p: 3.0, thetaStart: 0, thetaEnd: Math.PI },
    { z: -0.52, cy: 0.95, a: 0.63, b: 0.26, p: 3.0, thetaStart: 0, thetaEnd: Math.PI },
  ];
  return loftGeometry(sections, 36, {});
}

function buildRfRearWindow(): THREE.BufferGeometry {
  return surfaceGeometry(
    (u, v, target) => {
      const s = u * 2 - 1;
      const z = THREE.MathUtils.lerp(-0.5, -0.93, v);
      const y = THREE.MathUtils.lerp(1.2, 0.885, v);
      const halfWidth = THREE.MathUtils.lerp(0.55, 0.5, v);
      target.set(halfWidth * s, y - 0.045 * s * s, z + 0.01);
    },
    18,
    10,
  );
}

/** Deck lid covering the roof stowage well. */
function buildTonneau(): THREE.BufferGeometry {
  return topPanel(-0.42, -0.95, 0.5, 0.004, 8);
}

/* ------------------------------------------------------------------ */
/* Interior                                                            */
/* ------------------------------------------------------------------ */

function buildDashboard(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const dash = roundedBox(1.4, 0.2, 0.38, 0.06);
  dash.rotateX(0.1);
  dash.translate(0, 0.7, 0.34);
  parts.push(dash);

  const binnacle = new THREE.CylinderGeometry(0.12, 0.12, 0.46, 20, 1, false, 0, Math.PI);
  binnacle.rotateZ(HALF);
  binnacle.rotateY(HALF);
  binnacle.translate(-0.34, 0.72, 0.26);
  parts.push(binnacle);

  const tunnel = roundedBox(0.26, 0.18, 0.86, 0.06);
  tunnel.translate(0, 0.5, -0.1);
  parts.push(tunnel);

  const screen = new THREE.BoxGeometry(0.22, 0.12, 0.015);
  screen.rotateX(-0.14);
  screen.translate(0, 0.83, 0.31);
  parts.push(screen);

  return merge(parts);
}

function buildSeats(): THREE.BufferGeometry {
  const build = (x: number) => {
    const parts: THREE.BufferGeometry[] = [];

    const base = roundedBox(0.46, 0.13, 0.48, 0.06);
    base.rotateX(-0.06);
    base.translate(x, 0.48, -0.22);
    parts.push(base);

    const back = roundedBox(0.42, 0.48, 0.13, 0.05);
    back.rotateX(0.2);
    back.translate(x, 0.7, -0.5);
    parts.push(back);

    for (const side of [-1, 1]) {
      const bolster = roundedBox(0.07, 0.4, 0.12, 0.035);
      bolster.rotateX(0.2);
      bolster.translate(x + side * 0.19, 0.71, -0.47);
      parts.push(bolster);
    }

    const headrest = roundedBox(0.24, 0.16, 0.12, 0.045);
    headrest.rotateX(0.2);
    headrest.translate(x, 0.98, -0.61);
    parts.push(headrest);

    return merge(parts);
  };
  return merge([build(-0.36), build(0.36)]);
}

function buildSteeringWheel(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const rim = new THREE.TorusGeometry(0.165, 0.019, 10, 32);
  parts.push(rim);

  for (const angle of [Math.PI, Math.PI * 1.65, Math.PI * 0.35]) {
    const spoke = new THREE.BoxGeometry(0.16, 0.028, 0.02);
    spoke.translate(0.08, 0, 0);
    spoke.rotateZ(angle);
    parts.push(spoke);
  }

  const boss = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16);
  boss.rotateX(HALF);
  parts.push(boss);

  const merged = merge(parts);
  merged.rotateX(-0.44);
  merged.translate(-0.36, 0.73, 0.2);
  return merged;
}

/* ------------------------------------------------------------------ */
/* Lights & exterior trim                                              */
/* ------------------------------------------------------------------ */

function buildHeadlightHousings(): THREE.BufferGeometry {
  const build = () => {
    const housing = new THREE.SphereGeometry(0.17, 20, 14);
    housing.scale(1.0, 0.42, 0.55);
    housing.translate(0.58, 0.665, 1.6);
    return housing;
  };
  return mirrored(build);
}

function buildHeadlightLenses(): THREE.BufferGeometry {
  const build = () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const offset of [-0.055, 0.055]) {
      const lens = new THREE.SphereGeometry(0.052, 16, 12);
      lens.scale(1, 0.85, 0.7);
      lens.translate(0.58 + offset, 0.668, 1.675);
      parts.push(lens);
    }
    return merge(parts);
  };
  return mirrored(build);
}

function buildDrl(): THREE.BufferGeometry {
  const build = () => {
    const ring = new THREE.TorusGeometry(0.12, 0.011, 8, 28, Math.PI * 1.3);
    ring.scale(1, 0.5, 1);
    ring.rotateZ(-0.35);
    ring.translate(0.58, 0.665, 1.66);
    return ring;
  };
  return mirrored(build);
}

function buildIndicators(): THREE.BufferGeometry {
  const build = () => {
    const strip = roundedBox(0.16, 0.026, 0.045, 0.011);
    strip.rotateY(-0.16);
    strip.rotateX(0.12);
    strip.translate(0.6, 0.578, 1.645);
    return strip;
  };
  return mirrored(build);
}

function buildTaillights(): THREE.BufferGeometry {
  const build = () => {
    const parts: THREE.BufferGeometry[] = [];
    const lamp = new THREE.CylinderGeometry(0.1, 0.1, 0.07, 24);
    lamp.rotateX(HALF);
    lamp.translate(0.58, 0.62, -1.845);
    parts.push(lamp);

    const ring = new THREE.TorusGeometry(0.068, 0.013, 8, 24);
    ring.translate(0.58, 0.62, -1.885);
    parts.push(ring);
    return merge(parts);
  };
  return mirrored(build);
}

function buildBodyTrim(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Kodo pentagon grille.
  const grille = new THREE.CylinderGeometry(0.22, 0.17, 0.08, 5);
  grille.rotateX(HALF);
  grille.rotateZ(Math.PI);
  grille.scale(1.5, 1, 1);
  grille.translate(0, 0.47, 1.885);
  parts.push(grille);

  // Lower intake.
  const intake = roundedBox(0.9, 0.11, 0.09, 0.035);
  intake.translate(0, 0.3, 1.86);
  parts.push(intake);

  // Rocker sills, planted on the tucked underbody.
  for (const side of [-1, 1]) {
    const sill = roundedBox(0.07, 0.07, 2.0, 0.028);
    sill.translate(side * (bodyXAt(0, 0.21) + 0.005), 0.21, -0.05);
    parts.push(sill);
  }

  // Door handles.
  for (const side of [-1, 1]) {
    const handle = roundedBox(0.045, 0.04, 0.15, 0.018);
    handle.translate(side * (bodyXAt(-0.25, 0.7) - 0.005), 0.7, -0.25);
    parts.push(handle);
  }

  // Rear valance.
  const valance = roundedBox(1.06, 0.14, 0.15, 0.045);
  valance.translate(0, 0.34, -1.855);
  parts.push(valance);

  return merge(parts);
}

function buildMirrors(materials: MaterialLibrary): THREE.Group {
  const mirrors = new THREE.Group();
  mirrors.name = 'Mirrors';

  for (const side of [-1, 1]) {
    const stem = new THREE.Mesh(
      place(new THREE.CylinderGeometry(0.016, 0.022, 0.1, 10), [side * 0.81, 0.87, 0.4], [0, 0, side * -0.5]),
      materials.trim,
    );
    stem.name = `Mirror_Stem_${side > 0 ? 'R' : 'L'}`;

    const shell = new THREE.SphereGeometry(0.085, 16, 12);
    shell.scale(1.25, 0.72, 0.95);
    shell.translate(side * 0.88, 0.9, 0.39);
    const housing = new THREE.Mesh(shell, materials.paint);
    housing.name = `Mirror_Shell_${side > 0 ? 'R' : 'L'}`;
    housing.castShadow = true;

    const glass = new THREE.Mesh(
      place(new THREE.BoxGeometry(0.012, 0.075, 0.11), [side * 0.965, 0.9, 0.39]),
      materials.mirrorGlass,
    );
    glass.name = `Mirror_Glass_${side > 0 ? 'R' : 'L'}`;

    mirrors.add(stem, housing, glass);
  }
  return mirrors;
}

/* ------------------------------------------------------------------ */
/* Aero parts                                                          */
/* ------------------------------------------------------------------ */

function buildFrontLip(materials: MaterialLibrary): THREE.Group {
  const container = group(AERO_SLOT_NODE.frontLip);
  container.add(group('FrontLip_Stock'));

  const club = roundedBox(1.44, 0.055, 0.3, 0.02);
  club.rotateX(0.08);
  club.translate(0, 0.235, 1.8);
  container.add(group('FrontLip_Club', mesh(club, materials.trim, 'Lip')));

  const splitterParts: THREE.BufferGeometry[] = [];
  const blade = roundedBox(1.66, 0.026, 0.5, 0.012);
  blade.translate(0, 0.185, 1.83);
  splitterParts.push(blade);
  for (const side of [-1, 1]) {
    const fin = roundedBox(0.02, 0.09, 0.24, 0.008);
    fin.translate(side * 0.64, 0.23, 1.86);
    splitterParts.push(fin);
  }
  const splitter = merge(splitterParts);

  const rods: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const rod = new THREE.CylinderGeometry(0.009, 0.009, 0.24, 8);
    rod.rotateX(0.5);
    rod.translate(side * 0.42, 0.29, 1.94);
    rods.push(rod);
  }
  container.add(
    group(
      'FrontLip_Splitter',
      mesh(splitter, materials.carbon, 'Blade'),
      mesh(merge(rods), materials.metal, 'Rods'),
    ),
  );

  return container;
}

function buildSideSkirts(materials: MaterialLibrary): THREE.Group {
  const container = group(AERO_SLOT_NODE.sideSkirts);
  container.add(group('SideSkirts_Stock'));

  const oem = mirrored(() => {
    const skirt = roundedBox(0.1, 0.07, 2.0, 0.025);
    skirt.rotateZ(-0.06);
    skirt.translate(bodyXAt(0, 0.19) + 0.01, 0.19, -0.05);
    return skirt;
  });
  container.add(group('SideSkirts_OEM', mesh(oem, materials.trim, 'Skirt')));

  const carbon = mirrored(() => {
    const parts: THREE.BufferGeometry[] = [];
    const skirt = roundedBox(0.14, 0.06, 2.06, 0.02);
    skirt.rotateZ(-0.12);
    skirt.translate(bodyXAt(0, 0.18) + 0.03, 0.18, -0.05);
    parts.push(skirt);
    const winglet = roundedBox(0.18, 0.018, 0.34, 0.008);
    winglet.translate(bodyXAt(-0.95, 0.17) + 0.06, 0.17, -0.95);
    parts.push(winglet);
    return merge(parts);
  });
  container.add(group('SideSkirts_Carbon', mesh(carbon, materials.carbon, 'Skirt')));

  return container;
}

function buildRearDiffuser(materials: MaterialLibrary): THREE.Group {
  const container = group(AERO_SLOT_NODE.rearDiffuser);

  const stock = roundedBox(1.02, 0.1, 0.2, 0.03);
  stock.translate(0, 0.26, -1.87);
  container.add(group('RearDiffuser_Stock', mesh(stock, materials.trim, 'Valance')));

  const oemParts: THREE.BufferGeometry[] = [];
  const oemBase = roundedBox(1.12, 0.09, 0.34, 0.025);
  oemBase.rotateX(-0.14);
  oemBase.translate(0, 0.25, -1.85);
  oemParts.push(oemBase);
  for (const x of [-0.42, -0.14, 0.14, 0.42]) {
    const strake = roundedBox(0.022, 0.075, 0.3, 0.008);
    strake.rotateX(-0.14);
    strake.translate(x, 0.28, -1.85);
    oemParts.push(strake);
  }
  container.add(group('RearDiffuser_OEM', mesh(merge(oemParts), materials.trim, 'Diffuser')));

  const trackParts: THREE.BufferGeometry[] = [];
  const trackBase = roundedBox(1.3, 0.07, 0.48, 0.02);
  trackBase.rotateX(-0.26);
  trackBase.translate(0, 0.255, -1.82);
  trackParts.push(trackBase);
  for (const x of [-0.56, -0.34, -0.11, 0.11, 0.34, 0.56]) {
    const strake = roundedBox(0.02, 0.11, 0.46, 0.007);
    strake.rotateX(-0.26);
    strake.translate(x, 0.3, -1.82);
    trackParts.push(strake);
  }
  container.add(group('RearDiffuser_Track', mesh(merge(trackParts), materials.carbon, 'Diffuser')));

  return container;
}

function buildRearWing(materials: MaterialLibrary): THREE.Group {
  const container = group(AERO_SLOT_NODE.rearWing);
  container.add(group('RearWing_None'));

  const duck = topPanel(-1.28, -1.72, 0.42, 0.028, 8);
  container.add(group('RearWing_Ducktail', mesh(duck, materials.paint, 'Ducktail')));

  const lip = roundedBox(1.32, 0.035, 0.16, 0.012);
  lip.rotateX(-0.3);
  lip.translate(0, bodyTopAt(-1.6) + 0.035, -1.63);
  container.add(group('RearWing_Lip', mesh(lip, materials.carbon, 'Lip')));

  const gtParts: THREE.BufferGeometry[] = [];
  const blade = roundedBox(1.68, 0.035, 0.3, 0.014);
  blade.rotateX(-0.1);
  blade.translate(0, 1.06, -1.72);
  gtParts.push(blade);
  for (const side of [-1, 1]) {
    const endplate = roundedBox(0.016, 0.24, 0.42, 0.012);
    endplate.translate(side * 0.845, 1.04, -1.72);
    gtParts.push(endplate);
    const upright = roundedBox(0.026, 0.3, 0.13, 0.01);
    upright.rotateX(0.14);
    upright.translate(side * 0.44, 0.92, -1.68);
    gtParts.push(upright);
  }
  container.add(group('RearWing_GT', mesh(merge(gtParts), materials.carbon, 'Wing')));

  return container;
}

function buildHood(materials: MaterialLibrary): THREE.Group {
  const container = group(AERO_SLOT_NODE.hood);
  container.add(group('Hood_Stock'));

  const buildVented = (mat: THREE.Material, name: string) => {
    const skin = topPanel(1.62, 0.6, 0.6, 0.005, 12);
    const skinMesh = mesh(skin, mat, 'Skin');

    const vents: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const vent = roundedBox(0.24, 0.03, 0.3, 0.012);
      vent.rotateX(-0.06);
      vent.translate(side * 0.34, bodyTopAt(1.15) - 0.012, 1.16);
      vents.push(vent);
    }
    const ventMesh = mesh(merge(vents), materials.trim, 'Vents');
    return group(name, skinMesh, ventMesh);
  };

  container.add(buildVented(materials.carbon, 'Hood_Carbon'));
  container.add(buildVented(materials.paint, 'Hood_Vented'));
  return container;
}

function buildExhaust(materials: MaterialLibrary): THREE.Group {
  const container = group(AERO_SLOT_NODE.exhaust);

  const tip = (x: number, radius: number, length: number) => {
    const geometry = new THREE.CylinderGeometry(radius, radius * 0.92, length, 18, 1, true);
    geometry.rotateX(HALF);
    geometry.translate(x, 0.3, -1.94);
    return geometry;
  };

  container.add(group('Exhaust_Single', mesh(tip(0.4, 0.05, 0.24), materials.chrome, 'Tip')));
  container.add(
    group('Exhaust_Dual', mesh(merge([tip(-0.32, 0.048, 0.24), tip(0.32, 0.048, 0.24)]), materials.chrome, 'Tips')),
  );
  container.add(
    group(
      'Exhaust_Quad',
      mesh(
        merge([tip(-0.5, 0.046, 0.26), tip(-0.38, 0.046, 0.26), tip(0.38, 0.046, 0.26), tip(0.5, 0.046, 0.26)]),
        materials.titanium,
        'Tips',
      ),
    ),
  );
  container.add(group('Exhaust_BigBore', mesh(tip(0.42, 0.088, 0.3), materials.titanium, 'Tip')));

  return container;
}

function buildRollBar(materials: MaterialLibrary): THREE.Group {
  const container = group(AERO_SLOT_NODE.rollBar);
  container.add(group('RollBar_None'));

  const styleParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const hoop = new THREE.TorusGeometry(0.16, 0.026, 10, 24, Math.PI);
    hoop.translate(side * 0.36, 0.96, -0.78);
    styleParts.push(hoop);
  }
  const bridge = new THREE.CylinderGeometry(0.022, 0.022, 0.72, 10);
  bridge.rotateZ(HALF);
  bridge.translate(0, 0.96, -0.78);
  styleParts.push(bridge);
  container.add(group('RollBar_Style', mesh(merge(styleParts), materials.metal, 'Bar')));

  const trackParts: THREE.BufferGeometry[] = [];
  const mainHoop = new THREE.TorusGeometry(0.52, 0.03, 10, 32, Math.PI);
  mainHoop.scale(1.0, 0.62, 1);
  mainHoop.translate(0, 0.86, -0.82);
  trackParts.push(mainHoop);
  for (const side of [-1, 1]) {
    const brace = new THREE.CylinderGeometry(0.024, 0.024, 0.5, 10);
    brace.rotateX(0.6);
    brace.translate(side * 0.46, 0.95, -1.02);
    trackParts.push(brace);
  }
  const harness = new THREE.CylinderGeometry(0.022, 0.022, 0.94, 10);
  harness.rotateZ(HALF);
  harness.translate(0, 1.0, -0.84);
  trackParts.push(harness);
  container.add(group('RollBar_Track', mesh(merge(trackParts), materials.metal, 'Cage')));

  return container;
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export interface ProceduralCar {
  root: THREE.Group;
  suspension: THREE.Group;
  headlightSpots: THREE.SpotLight[];
}

/**
 * Build the whole car. Every configurable variant is created up-front and
 * toggled by visibility — swapping options never rebuilds geometry, so there
 * is nothing to leak and no hitch when clicking through the UI.
 */
export function buildProceduralMx5(generation: Generation, materials: MaterialLibrary): ProceduralCar {
  const root = new THREE.Group();
  root.name = NODE.ROOT;

  const suspension = new THREE.Group();
  suspension.name = NODE.SUSPENSION;
  root.add(suspension);

  // Non-ND generations reuse the ND surfaces, rescaled to their proportions,
  // until dedicated meshes land.
  const dims = generation.dimensions;
  const shell = new THREE.Group();
  shell.name = 'Body_Scale';
  shell.scale.set(dims.width / REF.width, dims.height / REF.height, dims.length / REF.length);
  suspension.add(shell);

  shell.add(mesh(buildBodyShell(), materials.paint, NODE.BODY_MAIN));
  shell.add(mesh(buildFenderArches(), materials.paint, 'Fender_Arches'));
  shell.add(mesh(buildBodyTrim(), materials.trim, NODE.BODY_TRIM));
  shell.add(mesh(buildCockpitTub(), materials.interiorTrim, 'Cockpit_Tub'));
  shell.add(buildMirrors(materials));

  /* Glass */
  const windshield = mesh(buildWindshield(), materials.glass, NODE.GLASS_WINDSHIELD, false);
  const pillars = mesh(buildAPillars(), materials.trim, 'A_Pillars');
  shell.add(group('Windshield_Assembly', windshield, pillars));
  shell.add(mesh(buildSideWindows(), materials.glass, NODE.GLASS_WINDOWS, false));

  /* Roofs — all four states exist, CarModel shows one. */
  shell.add(
    group(
      NODE.ROOF_ST_UP,
      mesh(buildSoftTopSkin(), materials.fabric, 'Canvas'),
      mesh(buildSoftTopRearWindow(), materials.glass, 'RearWindow', false),
    ),
  );
  shell.add(group(NODE.ROOF_ST_DOWN, mesh(buildSoftTopStowed(), materials.fabric, 'FoldedStack')));
  shell.add(
    group(
      NODE.ROOF_RF_UP,
      mesh(buildRfButtresses(), materials.paintRoof, 'Buttresses'),
      mesh(buildRfTargaPanel(), materials.paintRoof, 'TargaPanel'),
      mesh(buildRfRearWindow(), materials.glass, 'RearWindow', false),
    ),
  );
  shell.add(
    group(
      NODE.ROOF_RF_DOWN,
      mesh(buildRfButtresses(), materials.paintRoof, 'Buttresses'),
      mesh(buildTonneau(), materials.paintRoof, 'Tonneau'),
    ),
  );

  /* Interior */
  shell.add(mesh(buildDashboard(), materials.interiorTrim, NODE.INTERIOR_MAIN));
  shell.add(mesh(buildSeats(), materials.seat, NODE.INTERIOR_SEATS));
  shell.add(mesh(buildSteeringWheel(), materials.interiorTrim, NODE.INTERIOR_STEERING));

  /* Lights */
  shell.add(mesh(buildHeadlightHousings(), materials.headlightHousing, NODE.LIGHTS_HEAD_HOUSING, false));
  shell.add(mesh(buildHeadlightLenses(), materials.headlightLens, NODE.LIGHTS_HEAD, false));
  shell.add(mesh(buildDrl(), materials.drl, NODE.LIGHTS_DRL, false));
  shell.add(mesh(buildIndicators(), materials.indicator, NODE.LIGHTS_INDICATOR, false));
  shell.add(mesh(buildTaillights(), materials.taillight, NODE.LIGHTS_TAIL, false));

  const headlightSpots: THREE.SpotLight[] = [];
  for (const side of [-1, 1]) {
    const spot = new THREE.SpotLight('#eaf4ff', 0, 26, Math.PI / 7, 0.5, 1.2);
    spot.name = `Headlight_Spot_${side > 0 ? 'R' : 'L'}`;
    spot.position.set(side * 0.6, 0.74, 1.72);
    spot.target.position.set(side * 0.9, 0.1, 14);
    shell.add(spot, spot.target);
    headlightSpots.push(spot);
  }

  /* Aero */
  shell.add(buildFrontLip(materials));
  shell.add(buildSideSkirts(materials));
  shell.add(buildRearDiffuser(materials));
  shell.add(buildRearWing(materials));
  shell.add(buildHood(materials));
  shell.add(buildExhaust(materials));
  shell.add(buildRollBar(materials));

  /* Wheels sit on the ground, outside the suspension node, so lowering the
     body never moves the contact patch. */
  const halfTrackFront = dims.trackFront / 2;
  const halfTrackRear = dims.trackRear / 2;
  const halfBase = dims.wheelbase / 2;
  const corners: [string, number, number][] = [
    [NODE.WHEEL_FL, -halfTrackFront, halfBase],
    [NODE.WHEEL_FR, halfTrackFront, halfBase],
    [NODE.WHEEL_RL, -halfTrackRear, -halfBase],
    [NODE.WHEEL_RR, halfTrackRear, -halfBase],
  ];
  for (const [name, x, z] of corners) {
    const wheel = buildWheel(name, x < 0, materials);
    wheel.position.set(x, 0.308, z);
    root.add(wheel);
  }

  return { root, suspension, headlightSpots };
}
