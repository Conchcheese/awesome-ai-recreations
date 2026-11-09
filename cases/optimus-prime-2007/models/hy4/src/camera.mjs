/* HY4 · 成片镜头表（纯数据，无 Three.js 依赖）
 * 与 production.json 的 timeline.edit 一一对应；transformation 段为 1:1 连续镜头，
 * 完整覆盖源时间 8–19s，不靠切镜遮掩中段机构。
 */
import { TIMELINE } from './rig.mjs';

export const SHOTS = [
  { id: 'IGNITION', in: 0,    out: 4,    sourceIn: 0,    sourceOut: 8,    purpose: 'establish',
    caption: '01 / IGNITION · 车辆建立',
    cam0: [5.7, 1.95, 8.1], cam1: [4.9, 1.85, 7.3], tgt0: [0, 1.85, 1.15], tgt1: [0, 1.90, 1.05], fov0: 30, fov1: 30, e0: 0, e1: 0, d0: 0, d1: 0 },
  { id: 'TRANSFORMATION', in: 4, out: 15, sourceIn: 8, sourceOut: 19, purpose: 'transformation',
    caption: '02 / TRANSFORMATION · 连续变形',
    cam0: [7.0, 3.0, 13.2], cam1: [6.0, 5.2, 14.6], tgt0: [0, 3.2, 0], tgt1: [0, 4.8, 0], fov0: 41, fov1: 42, e0: 0, e1: 0, d0: 0, d1: 0 },
  { id: 'REVEAL', in: 15, out: 19, sourceIn: 19, sourceOut: 23, purpose: 'reveal',
    caption: '03 / REVEAL · 人形亮相',
    cam0: [4.9, 2.2, 12.6], cam1: [3.8, 2.6, 11.0], tgt0: [0, 4.4, 0], tgt1: [0, 4.5, 0], fov0: 39, fov1: 37, e0: 0, e1: 0, d0: 0, d1: .35 },
  { id: 'HEAD_CHEST', in: 19, out: 22, sourceIn: 23, sourceOut: 26, purpose: 'detail',
    caption: '04 / HEAD & CHEST · 头胸揭示',
    cam0: [1.9, 7.5, 5.8], cam1: [0.9, 6.9, 3.9], tgt0: [0, 6.75, 0.2], tgt1: [0, 6.65, 0.25], fov0: 35, fov1: 33, e0: 0, e1: 0, d0: .35, d1: .85 },
  { id: 'LOWER_BODY', in: 22, out: 24.5, sourceIn: 26, sourceOut: 28.5, purpose: 'detail',
    caption: '05 / LOWER BODY · 下肢承重',
    cam0: [3.3, 1.25, 6.5], cam1: [2.4, 1.5, 5.0], tgt0: [0, 1.9, 0], tgt1: [0, 1.8, 0], fov0: 37, fov1: 35, e0: 0, e1: 0, d0: .85, d1: .85 },
  { id: 'EXPLODED', in: 24.5, out: 26.5, sourceIn: 28.5, sourceOut: 30.5, purpose: 'study',
    caption: '06 / EXPLODED · 分层拆解（本轮设计动作）',
    cam0: [5.5, 4.7, 11.2], cam1: [5.0, 4.4, 10.6], tgt0: [0, 4.6, 0], tgt1: [0, 4.6, 0], fov0: 43, fov1: 42, e0: 0, e1: 1, d0: .85, d1: .85 },
  { id: 'REASSEMBLY', in: 26.5, out: 28, sourceIn: 30.5, sourceOut: 32, purpose: 'closing',
    caption: '07 / REASSEMBLY · 重组落幅',
    cam0: [4.1, 2.7, 11.9], cam1: [3.6, 2.4, 11.2], tgt0: [0, 4.4, 0], tgt1: [0, 4.4, 0], fov0: 39, fov1: 38, e0: 1, e1: 0, d0: .85, d1: 0 }
];

export const EDIT = SHOTS.map((s) => ({
  in: s.in, out: s.out, sourceIn: s.sourceIn, sourceOut: s.sourceOut, purpose: s.purpose
}));

const mix = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const vec = (a, b, u) => a.map((v, i) => mix(v, b[i], u));

export function cameraAt(movieTime) {
  const m = Math.max(0, Math.min(TIMELINE.movieDuration - 1e-6, movieTime));
  const s = SHOTS.find((x) => m >= x.in && m < x.out) || SHOTS[SHOTS.length - 1];
  const raw = (m - s.in) / (s.out - s.in);
  const u = s.purpose === 'transformation' ? raw : smooth(raw);
  return {
    shot: s.id, caption: s.caption, movieTime: m, u: raw,
    sourceT: mix(s.sourceIn, s.sourceOut, raw),
    cam: vec(s.cam0, s.cam1, u), target: vec(s.tgt0, s.tgt1, u),
    fov: mix(s.fov0, s.fov1, u), explode: mix(s.e0, s.e1, u),
    deploy: mix(s.d0, s.d1, u)
  };
}

export const FRAME_COUNT = Math.round(TIMELINE.movieDuration * TIMELINE.fps);
export const FRAME_TIME = (i) => i / TIMELINE.fps;
