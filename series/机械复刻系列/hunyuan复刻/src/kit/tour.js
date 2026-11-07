// 巡览导演：沿节拍表插值相机位姿（球坐标插值 + 本拍内漂移），并给出当前节拍。
import {clamp, easeInOutCubic, lerpAngle} from './util.js';

const BASE_FOV = 34;

function toSph(pose, fallbackFov = BASE_FOV) {
  const [tx, ty, tz] = pose.target || [0, 0.45, 0];
  const [px, py, pz] = pose.pos || [0, 1.4, 3];
  const dx = px - tx, dy = py - ty, dz = pz - tz;
  const distance = Math.hypot(dx, dy, dz);
  const polar = Math.acos(clamp(dy / (distance || 1), -1, 1));
  const azimuth = Math.atan2(dx, dz);
  return {
    target: [tx, ty, tz],
    distance,
    polar,
    azimuth,
    fov: Number.isFinite(pose.fov) ? pose.fov : fallbackFov,
  };
}

function fromSph(s) {
  const sp = Math.sin(s.polar), cp = Math.cos(s.polar);
  const pos = [
    s.target[0] + Math.sin(s.azimuth) * sp * s.distance,
    s.target[1] + cp * s.distance,
    s.target[2] + Math.cos(s.azimuth) * sp * s.distance,
  ];
  return {pos, target: [...s.target], fov: s.fov};
}

function mixSph(a, b, t) {
  return {
    target: [a.target[0] + (b.target[0] - a.target[0]) * t,
      a.target[1] + (b.target[1] - a.target[1]) * t,
      a.target[2] + (b.target[2] - a.target[2]) * t],
    distance: a.distance + (b.distance - a.distance) * t,
    polar: a.polar + (b.polar - a.polar) * t,
    azimuth: lerpAngle(a.azimuth, b.azimuth, t),
    fov: a.fov + (b.fov - a.fov) * t,
  };
}

function rotatePoseY(pose, angle) {
  if (!angle) return pose;
  const [tx, ty, tz] = pose.target;
  const dx = pose.pos[0] - tx, dz = pose.pos[2] - tz;
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    pos: [tx + dx * c + dz * s, pose.pos[1], tz - dx * s + dz * c],
    target: [...pose.target],
    fov: pose.fov,
  };
}

/**
 * beats: [{t, key, mode, title, sub, cam:{pos,target,fov}, spin?, trans?, drift?}]
 *   trans 默认 1.8 s（本拍开始前这段时间内完成换机位，到本拍时间点正好就位）
 *   spin：本拍到下一拍之间绕 target 的水平旋转角（弧度，正数=顺时针从上方看）
 *   drift：本拍内缓慢推近/拉远（米，正数=拉远）
 */
export function createDirector({beats, duration}) {
  const list = [...beats].sort((a, b) => a.t - b.t);
  const sph = list.map((b) => toSph(b.cam || {}));
  const lastT = Math.max(duration, list[list.length - 1].t);

  function rawPose(i, t) {
    const b = list[i];
    const base = fromSph(sph[i]);
    // 本拍内漂移：从节拍到下一拍之间累加
    const next = list[i + 1];
    const span = (next ? next.t : lastT) - b.t;
    const local = clamp((t - b.t) / Math.max(span, 1e-6));
    let pose = base;
    if (b.spin) pose = rotatePoseY(pose, b.spin * local);
    if (b.drift) {
      const d = b.drift * local;
      const dx = pose.pos[0] - pose.target[0];
      const dz = pose.pos[2] - pose.target[2];
      const dy = pose.pos[1] - pose.target[1];
      const len = Math.hypot(dx, dy, dz) || 1;
      pose = {
        pos: [pose.pos[0] + (dx / len) * d, pose.pos[1] + (dy / len) * d, pose.pos[2] + (dz / len) * d],
        target: [...pose.target],
        fov: pose.fov,
      };
    }
    return pose;
  }

  function sample(t) {
    const tt = clamp(t, 0, lastT);
    let i = 0;
    while (i + 1 < list.length && list[i + 1].t <= tt) i++;
    const cur = list[i];
    const prev = list[i - 1];
    let pose;
    let alpha = 1;
    if (prev) {
      const trans = cur.trans ?? 1.8;
      const start = Math.max(prev.t, cur.t - trans);
      alpha = clamp((tt - start) / Math.max(cur.t - start, 1e-6));
      const a = fromSph(sph[i - 1]);
      const prevSpin = prev.spin ? rotatePoseY(a, prev.spin * clamp((start - prev.t) / Math.max((list[i].t - prev.t), 1e-6))) : a;
      const b = fromSph(sph[i]);
      const k = easeInOutCubic(alpha);
      // 位置/目标线性混合，但用球坐标避免穿越机器中心
      const mixed = mixSph(toSph(prevSpin), toSph(b), k);
      pose = fromSph(mixed);
      if (alpha >= 1) pose = rawPose(i, tt);
    } else {
      pose = rawPose(i, tt);
    }
    const next = list[i + 1];
    const local = tt - cur.t;
    const span = (next ? next.t : lastT) - cur.t;
    return {
      t: tt,
      beat: cur,
      index: i,
      local,
      progress: clamp(local / Math.max(span, 1e-6)),
      alpha,
      pose,
      next,
    };
  }

  return {
    beats: list,
    duration: lastT,
    sample,
    poseAt: (t) => sample(t).pose,
    beatAt: (t) => sample(t).beat,
  };
}

export {toSph, fromSph, mixSph, rotatePoseY};
