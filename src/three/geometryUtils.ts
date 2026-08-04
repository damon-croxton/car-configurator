import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Small lofting / surfacing toolkit used by the procedural fallback model.
 * Everything here returns plain BufferGeometry so the results can be merged
 * and disposed like any authored asset.
 */

/**
 * Merge parts into one geometry and dispose the inputs.
 *
 * `mergeGeometries` refuses to mix indexed and non-indexed geometry, and
 * `ExtrudeGeometry` is the only primitive that comes back non-indexed — so
 * normalise before merging rather than making every caller think about it.
 */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 0) return new THREE.BufferGeometry();

  const hasNonIndexed = parts.some((part) => !part.getIndex());
  const prepared = parts.map((part) =>
    hasNonIndexed && part.getIndex() ? part.toNonIndexed() : part,
  );

  const merged = mergeGeometries(prepared, false) ?? new THREE.BufferGeometry();

  for (const part of prepared) if (!parts.includes(part)) part.dispose();
  for (const part of parts) part.dispose();

  return merged;
}

export interface Station {
  /** Position along the car's length axis. */
  z: number;
  /** Section centre height. */
  cy: number;
  /** Half width (x radius). */
  a: number;
  /** Half height (y radius). */
  b: number;
  /** Superellipse exponent: 2 = ellipse, 4 = rounded rectangle. */
  p: number;
  /**
   * Fraction of the half-width pulled in below the section centre. This is the
   * rocker tuck: it narrows the underbody so the wheels sit proud of the sills
   * while the shoulder above them stays full width and reads as a fender.
   */
  tuck?: number;
  /** Sweep start angle in radians (0 = +x, PI/2 = +y). */
  thetaStart: number;
  /** Sweep end angle in radians. May be less than the start to reverse winding. */
  thetaEnd: number;
  /** Optional lateral offset of the section centre. */
  cx?: number;
}

const sgnPow = (value: number, exponent: number) =>
  Math.sign(value) * Math.pow(Math.abs(value), exponent);

/** How much the tuck narrows the section at a given height (1 = no change). */
function tuckFactor(station: Station, y: number): number {
  const tuck = station.tuck ?? 0;
  if (tuck === 0 || station.b === 0) return 1;
  const below = Math.min(1, Math.max(0, (station.cy - y) / station.b));
  return 1 - tuck * Math.pow(below, 1.5);
}

/** A point on the station's superellipse at the given angle. */
export function stationPoint(station: Station, theta: number): THREE.Vector3 {
  const e = 2 / station.p;
  const y = station.cy + station.b * sgnPow(Math.sin(theta), e);
  const x = (station.cx ?? 0) + station.a * sgnPow(Math.cos(theta), e) * tuckFactor(station, y);
  return new THREE.Vector3(x, y, station.z);
}

/**
 * Inverse of `stationPoint`: the outer half-width of a section at a height.
 * Used to plant sills, handles and mirrors exactly on the body surface.
 */
export function stationHalfWidthAt(station: Station, y: number): number {
  if (station.b === 0) return station.a;
  const normalised = THREE.MathUtils.clamp((y - station.cy) / station.b, -1, 1);
  const sinTheta = Math.pow(Math.abs(normalised), station.p / 2);
  const cosTheta = Math.sqrt(Math.max(0, 1 - sinTheta * sinTheta));
  return station.a * Math.pow(cosTheta, 2 / station.p) * tuckFactor(station, y);
}

/**
 * Build a closed-section body by lofting between stations.
 *
 * `segments` points are generated per station between `thetaStart` and
 * `thetaEnd`; stations with a partial sweep leave an opening (that is how the
 * cockpit is cut out of the tub).
 */
export function loftGeometry(
  stations: Station[],
  segments: number,
  options: { capStart?: boolean; capEnd?: boolean; invert?: boolean } = {},
): THREE.BufferGeometry {
  const ringSize = segments + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s < stations.length; s++) {
    const station = stations[s];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = station.thetaStart + (station.thetaEnd - station.thetaStart) * t;
      const point = stationPoint(station, theta);
      positions.push(point.x, point.y, point.z);
      uvs.push(t, s / (stations.length - 1));
    }
  }

  for (let s = 0; s < stations.length - 1; s++) {
    for (let i = 0; i < segments; i++) {
      const a = s * ringSize + i;
      const b = a + 1;
      const c = a + ringSize;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Fan caps. Windings assume stations run nose-to-tail (decreasing z), which
  // is what makes the side-wall normals face outward.
  if (options.capStart) {
    const centre = stations[0];
    const centreIndex = positions.length / 3;
    positions.push(centre.cx ?? 0, centre.cy, centre.z);
    uvs.push(0.5, 0);
    for (let i = 0; i < segments; i++) {
      indices.push(centreIndex, i, i + 1);
    }
  }

  if (options.capEnd) {
    const centre = stations[stations.length - 1];
    const base = (stations.length - 1) * ringSize;
    const centreIndex = positions.length / 3;
    positions.push(centre.cx ?? 0, centre.cy, centre.z);
    uvs.push(0.5, 1);
    for (let i = 0; i < segments; i++) {
      indices.push(centreIndex, base + i + 1, base + i);
    }
  }

  if (options.invert) {
    for (let i = 0; i < indices.length; i += 3) {
      const swap = indices[i];
      indices[i] = indices[i + 2];
      indices[i + 2] = swap;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Generic parametric surface. `fn(u, v)` returns a point for u,v in [0,1];
 * used for windshields, roof skins and buttresses.
 */
export function surfaceGeometry(
  fn: (u: number, v: number, target: THREE.Vector3) => void,
  segmentsU: number,
  segmentsV: number,
  doubleSided = false,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const point = new THREE.Vector3();

  for (let v = 0; v <= segmentsV; v++) {
    for (let u = 0; u <= segmentsU; u++) {
      fn(u / segmentsU, v / segmentsV, point);
      positions.push(point.x, point.y, point.z);
      uvs.push(u / segmentsU, v / segmentsV);
    }
  }

  const rowSize = segmentsU + 1;
  for (let v = 0; v < segmentsV; v++) {
    for (let u = 0; u < segmentsU; u++) {
      const a = v * rowSize + u;
      const b = a + 1;
      const c = a + rowSize;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
      if (doubleSided) indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Rounded box, handy for lips, splitters and endplates. */
export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius = Math.min(width, height, depth) * 0.25,
  segments = 2,
): THREE.BufferGeometry {
  const r = Math.min(radius, Math.min(width, height, depth) / 2 - 1e-4);
  const shape = new THREE.Shape();
  const w = width / 2 - r;
  const h = height / 2 - r;
  shape.moveTo(-w - r, -h);
  shape.lineTo(-w - r, h);
  shape.quadraticCurveTo(-w - r, h + r, -w, h + r);
  shape.lineTo(w, h + r);
  shape.quadraticCurveTo(w + r, h + r, w + r, h);
  shape.lineTo(w + r, -h);
  shape.quadraticCurveTo(w + r, -h - r, w, -h - r);
  shape.lineTo(-w, -h - r);
  shape.quadraticCurveTo(-w - r, -h - r, -w - r, -h);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - r * 2,
    bevelEnabled: true,
    bevelSize: r,
    bevelThickness: r,
    bevelSegments: segments,
    curveSegments: 6,
  });
  geometry.translate(0, 0, -(depth - r * 2) / 2);
  return geometry;
}

/** Lathe a profile around the X axis (wheel/tire/disc parts). */
export function latheX(points: THREE.Vector2[], segments = 40): THREE.BufferGeometry {
  const geometry = new THREE.LatheGeometry(points, segments);
  geometry.rotateZ(Math.PI / 2);
  return geometry;
}

/** Convenience: translate + rotate a geometry in one call. */
export function place(
  geometry: THREE.BufferGeometry,
  position: [number, number, number],
  rotation?: [number, number, number],
): THREE.BufferGeometry {
  if (rotation) {
    geometry.rotateX(rotation[0]);
    geometry.rotateY(rotation[1]);
    geometry.rotateZ(rotation[2]);
  }
  geometry.translate(position[0], position[1], position[2]);
  return geometry;
}
