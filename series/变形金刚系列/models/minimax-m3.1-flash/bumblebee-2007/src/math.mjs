// Minimal vector / quaternion / matrix helpers.
// Column-major 4x4 matrices, matching glTF and three.js element order, so the
// same numbers can be written to GLB, pushed to three.js and dumped to the
// offline renderer without a conversion step.

export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  lerp: (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ],
};

export const Q = {
  identity: () => [0, 0, 0, 1],
  fromAxisAngle(axis, rad) {
    const a = V.norm(axis);
    const s = Math.sin(rad / 2);
    return [a[0] * s, a[1] * s, a[2] * s, Math.cos(rad / 2)];
  },
  // Intrinsic X then Y then Z.
  fromEuler(x, y, z) {
    const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
    return [
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz,
    ];
  },
  multiply(a, b) {
    const [ax, ay, az, aw] = a;
    const [bx, by, bz, bw] = b;
    return [
      ax * bw + aw * bx + ay * bz - az * by,
      ay * bw + aw * by + az * bx - ax * bz,
      az * bw + aw * bz + ax * by - ay * bx,
      aw * bw - ax * bx - ay * by - az * bz,
    ];
  },
  conjugate: (q) => [-q[0], -q[1], -q[2], q[3]],
  rotate(q, v) {
    const [x, y, z, w] = q;
    const tx = 2 * (y * v[2] - z * v[1]);
    const ty = 2 * (z * v[0] - x * v[2]);
    const tz = 2 * (x * v[1] - y * v[0]);
    return [
      v[0] + w * tx + (y * tz - z * ty),
      v[1] + w * ty + (z * tx - x * tz),
      v[2] + w * tz + (x * ty - y * tx),
    ];
  },
  slerp(a, b, t) {
    let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let end = b;
    if (cos < 0) { cos = -cos; end = [-b[0], -b[1], -b[2], -b[3]]; }
    if (cos > 0.9995) {
      const out = [
        a[0] + (end[0] - a[0]) * t,
        a[1] + (end[1] - a[1]) * t,
        a[2] + (end[2] - a[2]) * t,
        a[3] + (end[3] - a[3]) * t,
      ];
      const l = Math.hypot(...out) || 1;
      return [out[0] / l, out[1] / l, out[2] / l, out[3] / l];
    }
    const theta = Math.acos(cos);
    const s = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / s;
    const wb = Math.sin(t * theta) / s;
    return [
      a[0] * wa + end[0] * wb,
      a[1] * wa + end[1] * wb,
      a[2] * wa + end[2] * wb,
      a[3] * wa + end[3] * wb,
    ];
  },
  // Rotation that sends the local +X axis to `xa` and the local +Y axis to
  // `ya`. Authoring robot poses by axes is far easier to reason about than
  // by angle triples.
  fromAxes(xa, ya) {
    const x = V.norm(xa);
    let y = V.norm(ya);
    const d = V.dot(x, y);
    y = V.norm(V.sub(y, V.scale(x, d)));
    const z = V.cross(x, y);
    const m = [
      x[0], x[1], x[2], 0,
      y[0], y[1], y[2], 0,
      z[0], z[1], z[2], 0,
      0, 0, 0, 1,
    ];
    return Q.fromMatrix(m);
  },
  // Extract a quaternion from a column-major rotation matrix.
  fromMatrix(m) {
    const r = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
    const trace = r[0] + r[4] + r[8];
    let q;
    if (trace > 0) {
      const s2 = Math.sqrt(trace + 1) * 2;
      q = [(r[5] - r[7]) / s2, (r[6] - r[2]) / s2, (r[1] - r[3]) / s2, 0.25 * s2];
    } else if (r[0] > r[4] && r[0] > r[8]) {
      const s2 = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2;
      q = [0.25 * s2, (r[3] + r[1]) / s2, (r[6] + r[2]) / s2, (r[5] - r[7]) / s2];
    } else if (r[4] > r[8]) {
      const s2 = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2;
      q = [(r[3] + r[1]) / s2, 0.25 * s2, (r[7] + r[5]) / s2, (r[6] - r[2]) / s2];
    } else {
      const s2 = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2;
      q = [(r[6] + r[2]) / s2, (r[7] + r[5]) / s2, 0.25 * s2, (r[1] - r[3]) / s2];
    }
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    q = [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
    return q[3] < 0 ? [-q[0], -q[1], -q[2], -q[3]] : q;
  },
};

export const M = {
  identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  compose(p, q, s = [1, 1, 1]) {
    const [x, y, z, w] = q;
    const [sx, sy, sz] = s;
    return [
      sx * (1 - 2 * (y * y + z * z)), sx * (2 * (x * y + z * w)), sx * (2 * (x * z - y * w)), 0,
      sy * (2 * (x * y - z * w)), sy * (1 - 2 * (x * x + z * z)), sy * (2 * (y * z + x * w)), 0,
      sz * (2 * (x * z + y * w)), sz * (2 * (y * z - x * w)), sz * (1 - 2 * (x * x + y * y)), 0,
      p[0], p[1], p[2], 1,
    ];
  },
  multiply(a, b) {
    const out = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    }
    return out;
  },
  transformPoint(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
    ];
  },
  transformDir(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
    ];
  },
  // Gauss-Jordan with partial pivoting: fewer places to get a sign wrong
  // than a hand-expanded cofactor matrix.
  invert(m) {
    const a = [];
    for (let r = 0; r < 4; r++) {
      const row = [m[r], m[4 + r], m[8 + r], m[12 + r]];
      for (let c = 0; c < 4; c++) row.push(r === c ? 1 : 0);
      a.push(row);
    }
    for (let c = 0; c < 4; c++) {
      let piv = c;
      for (let r = c + 1; r < 4; r++) {
        if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
      }
      if (Math.abs(a[piv][c]) < 1e-12) return M.identity();
      const swap = a[c]; a[c] = a[piv]; a[piv] = swap;
      const d = a[c][c];
      for (let k = 0; k < 8; k++) a[c][k] /= d;
      for (let r = 0; r < 4; r++) {
        if (r === c) continue;
        const f = a[r][c];
        if (f === 0) continue;
        for (let k = 0; k < 8; k++) a[r][k] -= f * a[c][k];
      }
    }
    const out = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r][c + 4];
    }
    return out;
  },
  // 3x3 inverse-transpose, row-major flat 9, for normal transforms.
  normalMatrix(m) {
    const inv = M.invert(m);
    return [
      inv[0], inv[4], inv[8],
      inv[1], inv[5], inv[9],
      inv[2], inv[6], inv[10],
    ];
  },
  fromTranslation(p) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1];
  },
  fromScale(s) {
    return [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1];
  },
  fromRotation(q) {
    return M.compose([0, 0, 0], q);
  },
  lookAt(eye, target, up) {
    const z = V.norm(V.sub(eye, target));
    let x = V.cross(up, z);
    if (V.len(x) < 1e-6) x = V.cross([0, 0, 1], z);
    x = V.norm(x);
    const y = V.cross(z, x);
    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1,
    ];
  },
};

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
// Ease in-out with a soft start; keeps mechanical moves from snapping.
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
