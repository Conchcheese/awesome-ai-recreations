// Deterministic transformation rig.
//
// Every assembly carries a vehicle pose and a robot pose. The rig interpolates
// between them inside a per-assembly time window and composes the result with
// the parent assembly, so a fist keeps riding its forearm while the forearm
// is still unfolding.
//
// stateAt(t) is a pure function of t: no accumulated state, no clock, no
// randomness. Playing t1 -> t2 -> t1 returns the exact same poses.

import { Q, M, V, clamp, easeInOut, easeOut } from './math.mjs';

const ONE = [1, 1, 1];

function lerpScale(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function poseMatrix(p, q, s = ONE) {
  return M.compose(p, q, s);
}

// Interpolation with an optional arc bump, so parts travel in a curve rather
// than a straight line. The arc is expressed in the parent's frame.
function interpPose(a, b, t, arc) {
  const p = V.lerp(a.p, b.p, t);
  if (arc) {
    const bump = Math.sin(Math.PI * t);
    p[0] += arc[0] * bump;
    p[1] += arc[1] * bump;
    p[2] += arc[2] * bump;
  }
  const q = Q.slerp(a.q, b.q, t);
  const s = lerpScale(a.s || ONE, b.s || ONE, t);
  return { p, q, s };
}

function matrixToPose(m) {
  // Extract position and (normalised) rotation from a column-major matrix.
  const p = [m[12], m[13], m[14]];
  const sx = Math.hypot(m[0], m[1], m[2]) || 1;
  const sy = Math.hypot(m[4], m[5], m[6]) || 1;
  const sz = Math.hypot(m[8], m[9], m[10]) || 1;
  const r = [
    m[0] / sx, m[1] / sx, m[2] / sx,
    m[4] / sy, m[5] / sy, m[6] / sy,
    m[8] / sz, m[9] / sz, m[10] / sz,
  ];
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
  if (q[3] < 0) q = [-q[0], -q[1], -q[2], -q[3]];
  return { p, q, s: [sx, sy, sz] };
}

export function createRig(character) {
  const { assemblies, rootId } = character;
  const byId = new Map();
  for (const a of assemblies) byId.set(a.id, a);

  // Endpoint poses in the parent's frame.
  for (const a of assemblies) {
    const vehM = poseMatrix(a.vehicle.p, a.vehicle.q, ONE);
    const robM = poseMatrix(a.robot.p, a.robot.q, a.scaleRobot || ONE);
    const parent = byId.get(a.parent);
    if (parent) {
      const pv = poseMatrix(parent.vehicle.p, parent.vehicle.q, ONE);
      const pr = poseMatrix(parent.robot.p, parent.robot.q, parent.scaleRobot || ONE);
      a._localV = matrixToPose(M.multiply(M.invert(pv), vehM));
      a._localR = matrixToPose(M.multiply(M.invert(pr), robM));
      a._localP = a.pre
        ? matrixToPose(M.multiply(M.invert(pv), poseMatrix(a.pre.p, a.pre.q, ONE)))
        : null;
    } else {
      a._localV = matrixToPose(vehM);
      a._localR = matrixToPose(robM);
      a._localP = a.pre ? matrixToPose(poseMatrix(a.pre.p, a.pre.q, ONE)) : null;
    }
  }

  const factor = (t, win) => {
    if (!win) return 1;
    const [t0, t1] = win;
    if (t <= t0) return 0;
    if (t >= t1) return 1;
    return easeInOut((t - t0) / (t1 - t0));
  };

  const revealFactor = (t, a) => {
    if (a.reveal === undefined || a.reveal === null) return 1;
    if (t <= a.reveal) return 0;
    return easeOut(clamp((t - a.reveal) / 0.7, 0, 1));
  };

  const order = assemblies.slice();

  function poseAt(t) {
    const world = new Map();
    for (const a of order) {
      const s2 = factor(t, a.window);
      const s1 = a.pre ? factor(t, a.pre.window) : 1;
      let local;
      if (a.pre && s1 < 1) {
        local = interpPose(a._localV, a._localP, s1, null);
      } else if (a.pre) {
        local = interpPose(a._localP, a._localR, s2, a.arc);
      } else {
        local = interpPose(a._localV, a._localR, s2, a.arc);
      }
      const parent = byId.get(a.parent);
      let m = poseMatrix(local.p, local.q, local.s);
      if (parent) {
        const pm = world.get(parent.id);
        if (pm) m = M.multiply(pm, m);
      }
      const reveal = revealFactor(t, a);
      if (reveal < 1) {
        // Shrink about the assembly origin rather than about the world origin.
        const scaleM = M.fromScale([reveal, reveal, reveal]);
        m = M.multiply(M.multiply(M.fromTranslation(local.p), scaleM),
          M.multiply(M.fromTranslation([-local.p[0], -local.p[1], -local.p[2]]), m));
      }
      world.set(a.id, m);
    }
    return world;
  }

  // Pose dictionary with translation / rotation / scale for UI consumers.
  function stateAt(t) {
    const mats = poseAt(t);
    const out = {};
    for (const a of assemblies) {
      const m = mats.get(a.id);
      const pose = matrixToPose(m);
      out[a.id] = { p: pose.p, q: pose.q, s: pose.s };
    }
    return out;
  }

  return { poseAt, stateAt, byId, rootId, assemblies };
}

// Approximate world-space bounds of the whole character at time t.
export function boundsAt(rig, t, meshes) {
  const mats = rig.poseAt(t);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const a of rig.assemblies) {
    const m = mats.get(a.id);
    const g = meshes[a.mesh];
    if (!g) continue;
    const step = Math.max(1, Math.floor(g.positions.length / 3 / 60));
    for (let i = 0; i < g.positions.length; i += 3 * step) {
      const p = M.transformPoint(m, [g.positions[i], g.positions[i + 1], g.positions[i + 2]]);
      for (let k = 0; k < 3; k++) {
        if (p[k] < min[k]) min[k] = p[k];
        if (p[k] > max[k]) max[k] = p[k];
      }
    }
  }
  return { min, max };
}
