// Procedural geometry builders.
//
// Deliberately free of any three.js import: the same vertex data feeds the
// browser page, the GLB writer and the offline software renderer, so the
// three outputs cannot drift apart.
//
// A geometry is { positions: Float32Array, normals: Float32Array, indices: Uint32Array }
// with three.js / glTF vertex order (x, y, z) and counter-clockwise front faces.

import { V, M } from './math.mjs';

const EPS = 1e-9;

/* ------------------------------------------------------------------ */
/* core surface handling                                               */
/* ------------------------------------------------------------------ */

function emptySurface() {
  return { positions: [], normals: [], indices: [] };
}

// Build a surface from points and triangles, accumulating area weighted
// vertex normals so that curved panels shade smoothly.
export function surface(points, faces, { flat = false } = {}) {
  if (flat) {
    const p = [];
    const f = [];
    for (const face of faces) {
      const base = p.length;
      for (const idx of face) {
        const q = points[idx];
        p.push([q[0], q[1], q[2]]);
      }
      for (let i = 1; i < face.length - 1; i++) f.push([base, base + i, base + i + 1]);
    }
    return surface(p, f, { flat: false });
  }
  const normals = new Array(points.length).fill(0).map(() => [0, 0, 0]);
  for (const face of faces) {
    for (let i = 1; i < face.length - 1; i++) {
      const ia = face[0], ib = face[i], ic = face[i + 1];
      const a = points[ia], b = points[ib], c = points[ic];
      const n = V.cross(V.sub(b, a), V.sub(c, a));
      for (const idx of [ia, ib, ic]) {
        normals[idx][0] += n[0];
        normals[idx][1] += n[1];
        normals[idx][2] += n[2];
      }
    }
  }
  const out = emptySurface();
  for (let i = 0; i < points.length; i++) {
    out.positions.push(points[i][0], points[i][1], points[i][2]);
    const n = V.norm(normals[i]);
    out.normals.push(n[0], n[1], n[2]);
  }
  for (const [ia, ib, ic] of faces) out.indices.push(ia, ib, ic);
  return out;
}

export function merge(surfaces) {
  const out = emptySurface();
  for (const s of surfaces) {
    const base = out.positions.length / 3;
    for (let i = 0; i < s.positions.length; i++) out.positions.push(s.positions[i]);
    for (let i = 0; i < s.normals.length; i++) out.normals.push(s.normals[i]);
    for (let i = 0; i < s.indices.length; i++) out.indices.push(s.indices[i] + base);
  }
  return out;
}

export function transformGeometry(g, m) {
  const n = M.normalMatrix(m);
  const p = g.positions;
  const out = emptySurface();
  for (let i = 0; i < p.length; i += 3) {
    const v = M.transformPoint(m, [p[i], p[i + 1], p[i + 2]]);
    out.positions.push(v[0], v[1], v[2]);
    const nx = n[0] * g.normals[i] + n[3] * g.normals[i + 1] + n[6] * g.normals[i + 2];
    const ny = n[1] * g.normals[i] + n[4] * g.normals[i + 1] + n[7] * g.normals[i + 2];
    const nz = n[2] * g.normals[i] + n[5] * g.normals[i + 1] + n[8] * g.normals[i + 2];
    const nn = V.norm([nx, ny, nz]);
    out.normals.push(nn[0], nn[1], nn[2]);
  }
  for (let i = 0; i < g.indices.length; i++) out.indices.push(g.indices[i]);
  return out;
}

export function translate(g, t) {
  return transformGeometry(g, M.fromTranslation(t));
}

export function rotate(g, quat) {
  return transformGeometry(g, M.fromRotation(quat));
}

export function scale(g, s) {
  return transformGeometry(g, M.fromScale(s));
}

export function finalize(g) {
  return {
    positions: new Float32Array(g.positions),
    normals: new Float32Array(g.normals),
    indices: new Uint32Array(g.indices),
  };
}

export function bounds(g) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = g.positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

export function box(w, h, d, { center = [0, 0, 0] } = {}) {
  const x = w / 2, y = h / 2, z = d / 2;
  const c = center;
  const p = [
    [c[0] - x, c[1] - y, c[2] - z], [c[0] + x, c[1] - y, c[2] - z],
    [c[0] + x, c[1] + y, c[2] - z], [c[0] - x, c[1] + y, c[2] - z],
    [c[0] - x, c[1] - y, c[2] + z], [c[0] + x, c[1] - y, c[2] + z],
    [c[0] + x, c[1] + y, c[2] + z], [c[0] - x, c[1] + y, c[2] + z],
  ];
  const f = [
    [0, 3, 2], [0, 2, 1],   // -z
    [4, 5, 6], [4, 6, 7],   // +z
    [0, 1, 5], [0, 5, 4],   // -y
    [3, 7, 6], [3, 6, 2],   // +y
    [0, 4, 7], [0, 7, 3],   // -x
    [1, 2, 6], [1, 6, 5],   // +x
  ];
  return surface(p, f, { flat: true });
}

// Box with chamfered edges: reads as machined metal instead of a raw cube.
// Built as 6 inset faces + 12 edge bevels + 8 corner triangles.
export function chamferBox(w, h, d, c, { center = [0, 0, 0] } = {}) {
  const x = w / 2, y = h / 2, z = d / 2;
  const cc = Math.max(0, Math.min(c, x * 0.85, y * 0.85, z * 0.85));
  const [ox, oy, oz] = center;
  const pts = [];
  const faces = [];
  const push = (p) => { pts.push(p); return pts.length - 1; };

  // Emit a face, flipping it if it points inward.
  const emit = (idx) => {
    const a = pts[idx[0]], b = pts[idx[1]], cc2 = pts[idx[2]];
    const n = V.cross(V.sub(b, a), V.sub(cc2, a));
    const mid = [
      (a[0] + b[0] + cc2[0]) / 3 - ox,
      (a[1] + b[1] + cc2[1]) / 3 - oy,
      (a[2] + b[2] + cc2[2]) / 3 - oz,
    ];
    if (V.dot(n, mid) < 0) idx = [idx[0], idx[2], idx[1]];
    faces.push(idx);
  };

  // corner key: sign triplet -> { vx, vy, vz }
  const corners = new Map();
  for (const i of [-1, 1]) {
    for (const j of [-1, 1]) {
      for (const k of [-1, 1]) {
        corners.set(`${i},${j},${k}`, {
          vx: push([ox + i * x, oy + j * (y - cc), oz + k * (z - cc)]),
          vy: push([ox + i * (x - cc), oy + j * y, oz + k * (z - cc)]),
          vz: push([ox + i * (x - cc), oy + j * (y - cc), oz + k * z]),
        });
      }
    }
  }
  const at = (i, j, k) => corners.get(`${i},${j},${k}`);
  const pick = (c, axis) => (axis === 0 ? c.vx : axis === 1 ? c.vy : c.vz);

  // Six inset faces.
  for (let axis = 0; axis < 3; axis++) {
    for (const s of [-1, 1]) {
      const others = [0, 1, 2].filter((a) => a !== axis);
      const quad = [];
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const signs = [0, 0, 0];
        signs[axis] = s; signs[others[0]] = u; signs[others[1]] = v;
        quad.push(pick(at(signs[0], signs[1], signs[2]), axis));
      }
      emit(quad);
    }
  }

  // Twelve edge bevels.
  for (let a = 0; a < 3; a++) {
    for (let b = a + 1; b < 3; b++) {
      const cAxis = 3 - a - b;
      for (const sa of [-1, 1]) {
        for (const sb of [-1, 1]) {
          const signs0 = [0, 0, 0];
          signs0[a] = sa; signs0[b] = sb; signs0[cAxis] = -1;
          const signs1 = [...signs0];
          signs1[cAxis] = 1;
          const c0 = at(signs0[0], signs0[1], signs0[2]);
          const c1 = at(signs1[0], signs1[1], signs1[2]);
          emit([pick(c0, a), pick(c0, b), pick(c1, b), pick(c1, a)]);
        }
      }
    }
  }

  // Eight corner triangles.
  for (const i of [-1, 1]) {
    for (const j of [-1, 1]) {
      for (const k of [-1, 1]) {
        const c = at(i, j, k);
        emit([c.vx, c.vy, c.vz]);
      }
    }
  }

  return surface(pts, faces, { flat: true });
}

export function cylinder(rTop, rBot, h, seg, { center = [0, 0, 0], capped = true } = {}) {
  const p = [];
  const f = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const cx = Math.cos(a), sz = Math.sin(a);
    p.push([center[0] + cx * rBot, center[1] - h / 2, center[2] + sz * rBot]);
    p.push([center[0] + cx * rTop, center[1] + h / 2, center[2] + sz * rTop]);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    f.push([a, c, d], [a, d, b]);
  }
  if (capped) {
    const topBase = p.length;
    p.push([center[0], center[1] + h / 2, center[2]]);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      p.push([center[0] + Math.cos(a) * rTop, center[1] + h / 2, center[2] + Math.sin(a) * rTop]);
    }
    for (let i = 0; i < seg; i++) f.push([topBase, topBase + 1 + i, topBase + 2 + i]);
    const botBase = p.length;
    p.push([center[0], center[1] - h / 2, center[2]]);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      p.push([center[0] + Math.cos(a) * rBot, center[1] - h / 2, center[2] + Math.sin(a) * rBot]);
    }
    for (let i = 0; i < seg; i++) f.push([botBase, botBase + 2 + i, botBase + 1 + i]);
  }
  return surface(p, f);
}

// Revolve a (radius, height) profile around the Y axis.
export function revolve(profile, seg, { center = [0, 0, 0] } = {}) {
  const p = [];
  const f = [];
  const rows = profile.length;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < rows; j++) {
      const [r, y] = profile[j];
      p.push([center[0] + ca * r, center[1] + y, center[2] + sa * r]);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j;
      const b = a + 1;
      const c = a + rows;
      const d = c + 1;
      f.push([a, c, d], [a, d, b]);
    }
  }
  return surface(p, f);
}

export function sphere(r, segU = 20, segV = 12, { center = [0, 0, 0] } = {}) {
  const profile = [];
  for (let j = 0; j <= segV; j++) {
    const a = (j / segV) * Math.PI;
    profile.push([Math.sin(a) * r, -Math.cos(a) * r]);
  }
  return revolve(profile, segU, { center });
}

// Tire-like tube: outer radius, inner (rim) radius, width along the axis.
export function tube(rOuter, rInner, width, seg = 28) {
  const hw = width / 2;
  const shoulder = Math.min(0.045, (rOuter - rInner) * 0.45);
  const profile = [
    [rInner, -hw],
    [rOuter - shoulder, -hw],
    [rOuter, -hw + shoulder],
    [rOuter, hw - shoulder],
    [rOuter - shoulder, hw],
    [rInner, hw],
  ];
  const g = revolve(profile, seg);
  // Revolve builds around Y; roll the tube so the axis points along X.
  return transformGeometry(g, M.compose([0, 0, 0], [0, 0, Math.SQRT1_2, Math.SQRT1_2]));
}

/* ------------------------------------------------------------------ */
/* polygon triangulation                                               */
/* ------------------------------------------------------------------ */

// Ear clipping for simple polygons (used for concave car side profiles).
export function triangulate(poly) {
  const n = poly.length;
  if (n < 3) return [];
  const idx = [...Array(n).keys()];
  if (signedArea(poly) < 0) idx.reverse();
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n + 16) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      const a = poly[i0], b = poly[i1], c = poly[i2];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross <= EPS) continue;
      let contains = false;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTriangle(poly[j], a, b, c)) { contains = true; break; }
      }
      if (contains) continue;
      tris.push([i0, i1, i2]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function pointInTriangle(p, a, b, c) {
  const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
  const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
  const neg = d1 < -EPS || d2 < -EPS || d3 < -EPS;
  const pos = d1 > EPS || d2 > EPS || d3 > EPS;
  return !(neg && pos);
}

// Extrude a 2D polygon (XY) along Z, with caps.
export function extrude(poly, depth, { z0 = -depth / 2, capFront = true, capBack = true } = {}) {
  const p = [];
  const f = [];
  const n = poly.length;
  for (const pt of poly) p.push([pt[0], pt[1], z0]);
  for (const pt of poly) p.push([pt[0], pt[1], z0 + depth]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([i, j, j + n], [i, j + n, i + n]);
  }
  if (capFront) {
    const tris = triangulate(poly);
    for (const t of tris) f.push([t[2], t[1], t[0]]);
  }
  if (capBack) {
    const tris = triangulate(poly);
    for (const t of tris) f.push([t[0] + n, t[1] + n, t[2] + n]);
  }
  return surface(p, f);
}

/* ------------------------------------------------------------------ */
/* lofted panels                                                       */
/* ------------------------------------------------------------------ */

// A station is { x, pts: [[y, z], ...] }. Consecutive stations are joined by
// quad strips. closed=true wraps the polyline into a full ring.
export function loftSurface(stations, { closed = false } = {}) {
  const p = [];
  const f = [];
  const rows = stations.length;
  const cols = stations[0].pts.length;
  for (const st of stations) {
    for (const [y, z] of st.pts) p.push([st.x, y, z]);
  }
  const last = closed ? cols : cols - 1;
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < last; j++) {
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = i * cols + j2;
      const c = (i + 1) * cols + j2;
      const d = (i + 1) * cols + j;
      f.push([a, b, c], [a, c, d]);
    }
  }
  return surface(p, f);
}

// Offset a station polyline inward (towards `ref`) by `thickness`.
function offsetStations(stations, thickness, ref) {
  return stations.map((st) => {
    const n = st.pts.length;
    const out = [];
    for (let j = 0; j < n; j++) {
      const prev = st.pts[Math.max(0, j - 1)];
      const next = st.pts[Math.min(n - 1, j + 1)];
      let t = [next[0] - prev[0], next[1] - prev[1]];
      const tl = Math.hypot(t[0], t[1]);
      if (tl < EPS) t = [0, 0]; else t = [t[0] / tl, t[1] / tl];
      let nrm = [t[1], -t[0]];
      const r = typeof ref === 'function' ? ref(st) : ref;
      const toRef = [r[0] - st.pts[j][0], r[1] - st.pts[j][1]];
      if (nrm[0] * toRef[0] + nrm[1] * toRef[1] < 0) nrm = [-nrm[0], -nrm[1]];
      out.push([st.pts[j][0] + nrm[0] * thickness, st.pts[j][1] + nrm[1] * thickness]);
    }
    return { x: st.x, pts: out };
  });
}

// A panel with real thickness: outer skin, inner skin and rim strips.
// `ref` points into the volume the panel wraps around.
export function loftShell(stations, thickness, { closed = false, ref } = {}) {
  const inner = offsetStations(stations, thickness, ref);
  const outer = loftSurface(stations, { closed });
  const back = loftSurface(inner, { closed });
  // Flip the inner skin winding.
  const idx = back.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
  }
  const rims = [];
  const cols = stations[0].pts.length;
  const rows = stations.length;
  const at = (r, c) => r * cols + c;
  const rimStrip = (rowA, rowB, colA, colB, flip) => {
    const p = [];
    const f = [];
    for (let r = rowA; r <= rowB; r++) {
      const st = r === rowA ? stations[r] : inner[r];
      p.push([st.x, st.pts[colA][0], st.pts[colA][1]]);
    }
    for (let r = rowB; r >= rowA; r--) {
      const st = r === rowA ? inner[r] : stations[r];
      p.push([st.x, st.pts[colA][0], st.pts[colA][1]]);
    }
    const n = p.length;
    for (let i = 1; i < n - 1; i++) f.push(flip ? [0, i + 1, i] : [0, i, i + 1]);
    rims.push(surface(p, f));
  };
  // Front and back rims close the panel ends.
  rimStrip(0, 0, 0, 0, true);
  const endStrip = (row, flip) => {
    const p = [];
    const f = [];
    const st = stations[row];
    const stIn = inner[row];
    for (let j = 0; j < cols; j++) p.push([st.x, st.pts[j][0], st.pts[j][1]]);
    for (let j = cols - 1; j >= 0; j--) p.push([st.x, stIn.pts[j][0], stIn.pts[j][1]]);
    const n = p.length;
    for (let i = 1; i < n - 1; i++) f.push(flip ? [0, i, i + 1] : [0, i + 1, i]);
    rims.push(surface(p, f));
  };
  endStrip(0, false);
  endStrip(rows - 1, true);
  if (!closed) {
    // Long edges along the panel length.
    for (const col of [0, cols - 1]) {
      const p = [];
      const f = [];
      for (let r = 0; r < rows; r++) {
        const st = stations[r];
        p.push([st.x, st.pts[col][0], st.pts[col][1]]);
      }
      for (let r = rows - 1; r >= 0; r--) {
        const st = inner[r];
        p.push([st.x, st.pts[col][0], st.pts[col][1]]);
      }
      const n = p.length;
      const flip = col === 0;
      for (let i = 1; i < n - 1; i++) f.push(flip ? [0, i, i + 1] : [0, i + 1, i]);
      rims.push(surface(p, f));
    }
  }
  void at;
  return merge([outer, back, ...rims]);
}

// Flip winding so the front faces point away from `ref`.
export function orientOutward(g, ref) {
  const b = bounds(g);
  const centre = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  let dot = 0;
  const count = g.positions.length / 3;
  for (let i = 0; i < count; i++) {
    const p = [g.positions[i * 3], g.positions[i * 3 + 1], g.positions[i * 3 + 2]];
    const n = [g.normals[i * 3], g.normals[i * 3 + 1], g.normals[i * 3 + 2]];
    const d = V.sub(p, ref || centre);
    dot += V.dot(n, d);
  }
  if (dot < 0) {
    for (let i = 0; i < g.indices.length; i += 3) {
      const t = g.indices[i + 1]; g.indices[i + 1] = g.indices[i + 2]; g.indices[i + 2] = t;
    }
    for (let i = 0; i < g.normals.length; i++) g.normals[i] = -g.normals[i];
  }
  return g;
}
