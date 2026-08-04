import * as THREE from 'three';
import type { MaterialLibrary } from './materialLibrary';
import { NODE } from './nodeNames';
import { carData, type SpokeType, type WheelStyleDef } from '../data/schema';
import { latheX, mergeParts } from './geometryUtils';

/**
 * Reference geometry is authored for a 17" wheel (0.308 m rolling radius).
 * `CarModel` scales the whole corner for other diameters and scales the rim
 * assembly independently so bigger wheels visibly lose sidewall.
 */
export const WHEEL_REF_RADIUS = 0.308;
export const WHEEL_REF_RIM_FRACTION = 0.73;
export const WHEEL_HALF_WIDTH = 0.108;

/** Rolling radius (m) and rim-to-overall diameter ratio for each fitment. */
const FITMENT: Record<number, { radius: number; rimFraction: number }> = {
  14: { radius: 0.283, rimFraction: 0.63 },
  15: { radius: 0.288, rimFraction: 0.661 },
  16: { radius: 0.295, rimFraction: 0.688 },
  17: { radius: 0.308, rimFraction: 0.7 },
  18: { radius: 0.315, rimFraction: 0.727 },
};

export function fitmentFor(diameter: number) {
  return FITMENT[diameter] ?? FITMENT[17];
}

const R = WHEEL_REF_RADIUS;
const W = WHEEL_HALF_WIDTH;

/** Tire carcass: lathed profile with rounded shoulders and a bead that always
 *  sits inside the smallest supported rim. */
function buildTire(): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(R * 0.62, -W * 0.92),
    new THREE.Vector2(R * 0.76, -W * 0.99),
    new THREE.Vector2(R * 0.88, -W),
    new THREE.Vector2(R * 0.97, -W * 0.9),
    new THREE.Vector2(R * 1.0, -W * 0.62),
    new THREE.Vector2(R * 1.005, 0),
    new THREE.Vector2(R * 1.0, W * 0.62),
    new THREE.Vector2(R * 0.97, W * 0.9),
    new THREE.Vector2(R * 0.88, W),
    new THREE.Vector2(R * 0.76, W * 0.99),
    new THREE.Vector2(R * 0.62, W * 0.92),
  ];
  return latheX(profile, 44);
}

/** Rim barrel + outer step lip, lathed. `lipDepth` deepens the polished lip. */
function buildRimBarrel(lipDepth: number): THREE.BufferGeometry {
  const outer = R * WHEEL_REF_RIM_FRACTION;
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(outer * 0.42, -W * 0.86),
    new THREE.Vector2(outer * 0.86, -W * 0.9),
    new THREE.Vector2(outer * 0.97, -W * 0.8),
    new THREE.Vector2(outer * 0.99, -W * 0.2),
    new THREE.Vector2(outer * 0.965, W * 0.4),
    new THREE.Vector2(outer * 0.985, W * 0.82),
    new THREE.Vector2(outer * 1.0, W * 0.86 + lipDepth * 0.4),
    new THREE.Vector2(outer * 0.88, W * 0.9 + lipDepth * 0.4),
  ];
  return latheX(profile, 44);
}

/**
 * One tapered spoke, extruded across the wheel face. Angle is applied by the
 * caller so a style is just a list of angles plus a profile.
 */
function buildSpoke(options: {
  innerRadius: number;
  outerRadius: number;
  innerHalfWidth: number;
  outerHalfWidth: number;
  thickness: number;
  offsetX: number;
  angle: number;
  lateralShift?: number;
}): THREE.BufferGeometry {
  const { innerRadius, outerRadius, innerHalfWidth, outerHalfWidth, thickness, offsetX, angle } = options;
  const shift = options.lateralShift ?? 0;

  const shape = new THREE.Shape();
  shape.moveTo(-innerHalfWidth + shift, innerRadius);
  shape.lineTo(-outerHalfWidth + shift, outerRadius);
  shape.quadraticCurveTo(shift, outerRadius + outerHalfWidth * 0.5, outerHalfWidth + shift, outerRadius);
  shape.lineTo(innerHalfWidth + shift, innerRadius);
  shape.quadraticCurveTo(shift, innerRadius - innerHalfWidth * 0.4, -innerHalfWidth + shift, innerRadius);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: thickness * 0.18,
    bevelThickness: thickness * 0.18,
    bevelSegments: 1,
    curveSegments: 4,
  });

  // Shape is authored in the wheel plane (x = tangential, y = radial); rotate
  // it so the extrusion runs along the wheel axis.
  geometry.rotateZ(angle);
  geometry.rotateY(Math.PI / 2);
  geometry.translate(offsetX, 0, 0);
  return geometry;
}

function angles(count: number, offsetDeg = 0): number[] {
  return Array.from({ length: count }, (_, i) => ((i / count) * 360 + offsetDeg) * THREE.MathUtils.DEG2RAD);
}

/** Spoke pattern generator, driven by `carData.wheelStyles[].spokeType`. */
function buildSpokeFace(style: WheelStyleDef): THREE.BufferGeometry {
  const outer = R * WHEEL_REF_RIM_FRACTION * 0.97;
  const hub = R * 0.19;
  const faceX = W * 0.66;
  const parts: THREE.BufferGeometry[] = [];

  const push = (opts: Parameters<typeof buildSpoke>[0]) => parts.push(buildSpoke(opts));

  const type: SpokeType = style.spokeType;

  if (type === 'six_spoke') {
    for (const angle of angles(6)) {
      push({
        innerRadius: hub,
        outerRadius: outer,
        innerHalfWidth: R * 0.075,
        outerHalfWidth: R * 0.115,
        thickness: W * 0.34,
        offsetX: faceX,
        angle,
      });
    }
  } else if (type === 'split_five') {
    for (const angle of angles(5, 18)) {
      for (const shift of [-R * 0.062, R * 0.062]) {
        push({
          innerRadius: hub * 1.1,
          outerRadius: outer,
          innerHalfWidth: R * 0.03,
          outerHalfWidth: R * 0.048,
          thickness: W * 0.3,
          offsetX: faceX,
          angle,
          lateralShift: shift,
        });
      }
    }
  } else if (type === 'twin_five') {
    for (const angle of angles(5)) {
      for (const shift of [-R * 0.085, R * 0.085]) {
        push({
          innerRadius: hub,
          outerRadius: outer,
          innerHalfWidth: R * 0.042,
          outerHalfWidth: R * 0.058,
          thickness: W * 0.32,
          offsetX: faceX,
          angle,
          lateralShift: shift,
        });
      }
    }
  } else if (type === 'mesh_ten') {
    for (const angle of angles(10)) {
      push({
        innerRadius: hub,
        outerRadius: outer,
        innerHalfWidth: R * 0.03,
        outerHalfWidth: R * 0.052,
        thickness: W * 0.26,
        offsetX: faceX,
        angle,
      });
    }
  } else if (type === 'mesh_cross') {
    // BBS-style basket weave: two counter-rotated sets of thin spokes.
    for (const bias of [-0.17, 0.17]) {
      for (const angle of angles(12)) {
        push({
          innerRadius: hub * 1.15,
          outerRadius: outer,
          innerHalfWidth: R * 0.018,
          outerHalfWidth: R * 0.03,
          thickness: W * 0.2,
          offsetX: faceX + bias * W * 0.5,
          angle: angle + bias,
        });
      }
    }
  } else {
    // eight_spoke — classic dished Watanabe.
    for (const angle of angles(8, 22.5)) {
      push({
        innerRadius: hub,
        outerRadius: outer,
        innerHalfWidth: R * 0.07,
        outerHalfWidth: R * 0.1,
        thickness: W * 0.3,
        offsetX: faceX * 0.55,
        angle,
      });
    }
  }

  return mergeParts(parts);
}

/** Hub, centre cap and five lug nuts, shared by every style. */
function buildHub(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const cap = new THREE.CylinderGeometry(R * 0.2, R * 0.185, W * 0.34, 24);
  cap.rotateZ(Math.PI / 2);
  cap.translate(W * 0.76, 0, 0);
  parts.push(cap);

  for (const angle of angles(5, 36)) {
    const lug = new THREE.CylinderGeometry(R * 0.024, R * 0.024, W * 0.12, 6);
    lug.rotateZ(Math.PI / 2);
    lug.translate(W * 0.88, Math.sin(angle) * R * 0.115, Math.cos(angle) * R * 0.115);
    parts.push(lug);
  }

  return mergeParts(parts);
}

function buildBrakeDisc(): THREE.BufferGeometry {
  const disc = new THREE.CylinderGeometry(R * 0.66, R * 0.66, 0.026, 32);
  disc.rotateZ(Math.PI / 2);
  const hat = new THREE.CylinderGeometry(R * 0.26, R * 0.26, 0.05, 20);
  hat.rotateZ(Math.PI / 2);
  hat.translate(-0.02, 0, 0);
  return mergeParts([disc, hat]);
}

function buildCaliper(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(0.055, R * 0.42, 0.11);
  const bridge = new THREE.BoxGeometry(0.075, R * 0.16, 0.085);
  bridge.translate(0, R * 0.1, 0);
  return mergeParts([body, bridge]);
}

/**
 * Build one corner. The returned group is named `Wheel_FL` etc. and contains
 * `Tire`, `Rim` (one child per style, visibility-toggled), `Brake_Disc` and
 * `Brake_Caliper` — exactly the convention documented for authored GLTFs.
 */
export function buildWheel(name: string, isLeft: boolean, materials: MaterialLibrary): THREE.Group {
  const wheel = new THREE.Group();
  wheel.name = name;

  const mirror = isLeft ? -1 : 1;

  const tire = new THREE.Mesh(buildTire(), materials.rubber);
  tire.name = NODE.TIRE;
  tire.castShadow = true;
  tire.scale.x = mirror;
  wheel.add(tire);

  // One `Rim` container holding every catalogue style; CarModel shows one.
  const rim = new THREE.Group();
  rim.name = NODE.RIM;
  rim.scale.x = mirror;
  wheel.add(rim);

  for (const style of carData.wheelStyles) {
    const styleGroup = new THREE.Group();
    styleGroup.name = style.id;
    styleGroup.visible = false;

    const barrel = new THREE.Mesh(buildRimBarrel(style.lipDepth), materials.rim);
    barrel.name = 'Barrel';
    barrel.castShadow = true;

    const face = new THREE.Mesh(buildSpokeFace(style), materials.rim);
    face.name = 'Spokes';
    face.castShadow = true;

    const hub = new THREE.Mesh(buildHub(), materials.rimAccent);
    hub.name = 'Hub';

    styleGroup.add(barrel, face, hub);
    rim.add(styleGroup);
  }

  const disc = new THREE.Mesh(buildBrakeDisc(), materials.brakeDisc);
  disc.name = NODE.BRAKE_DISC;
  disc.position.x = mirror * -0.012;
  wheel.add(disc);

  const caliper = new THREE.Mesh(buildCaliper(), materials.caliper);
  caliper.name = NODE.BRAKE_CALIPER;
  caliper.castShadow = true;
  // Trailing edge of the disc, slightly inboard of the rim face.
  caliper.position.set(mirror * -0.035, R * 0.42, -R * 0.2);
  wheel.add(caliper);

  return wheel;
}
