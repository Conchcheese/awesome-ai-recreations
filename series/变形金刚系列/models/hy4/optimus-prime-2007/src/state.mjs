/* HY4 · 确定性状态机（纯函数，无 Three.js / DOM 依赖）
 * 同一批 ASSEMBLIES 在 8–19s 内按各自 delay 窗口错峰重组；不换模型、不隐藏实体。
 * 端点区间（t<=8 / t>=19）严格静止，便于 t1→t2→t1 回放校验。
 * explode / deploy 是成片展示动作（designed，非原片证据），默认 0，不改变端点契约。
 */
import { ASSEMBLIES, TIMELINE } from './rig.mjs';

const [A, B] = TIMELINE.transform;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const mix = (a, b, u) => a + (b - a) * u;

/* 展甲动作：成片中胸甲/肩甲/前臂外展露出内构；数值为本轮设计，不是影片实测 */
const DEPLOY = {
  hood:       { p: [0, .02, .34],  r: [.26, 0, 0] },
  chest_l:    { p: [-.46, .12, .28], r: [0, -.30, -.10] },
  chest_r:    { p: [ .46, .12, .28], r: [0,  .30,  .10] },
  shoulder_l: { p: [-.40, .10, 0], r: [0, 0,  .20] },
  shoulder_r: { p: [ .40, .10, 0], r: [0, 0, -.20] },
  arm_l:      { p: [-.28, -.08, .10], r: [0, 0,  .15] },
  arm_r:      { p: [ .28, -.08, .10], r: [0, 0, -.15] },
  core:       { p: [0, 0, .22], r: [0, 0, 0] },
  grille:     { p: [0, 0, .30], r: [0, 0, 0] },
  back:       { p: [0, 0, -.30], r: [0, 0, 0] },
  roof:       { p: [0, .18, -.20], r: [0, 0, 0] }
};

/* opts.explode 0..1 分层拆解；opts.deploy 0..1 展甲；opts.grey 只影响渲染材质 */
export function stateAt(t, opts = {}) {
  const time = Number.isFinite(t) ? t : 0;
  const explode = clamp(Number.isFinite(opts.explode) ? opts.explode : 0, 0, 1);
  const deploy = clamp(Number.isFinite(opts.deploy) ? opts.deploy : 0, 0, 1);
  const global = smooth(clamp((time - A) / (B - A), 0, 1));
  const rows = ASSEMBLIES.map((a, idx) => {
    const u = smooth(clamp((global - a.delay[0]) / (a.delay[1] - a.delay[0]), 0, 1));
    const bulge = Math.sin(Math.PI * u);
    const t0 = a.t, t1 = a.r;
    const pos = [0, 1, 2].map((k) => mix(t0.p[k], t1.p[k], u) + a.arc[k] * bulge);
    const rot = [0, 1, 2].map((k) => mix(t0.r[k], t1.r[k], u) + a.arc[k] * .06 * bulge);
    const scale = mix(t0.s, t1.s, u) * (1 + .018 * bulge * Math.sin(idx * 1.7));

    /* 展甲：仅在人形端点之后叠加，保持 stateAt(t) 默认的端点静止 */
    const d = DEPLOY[a.id];
    if (d && deploy > 0) {
      const w = deploy * smooth(clamp((global - .55) / .45, 0, 1));
      for (let k = 0; k < 3; k++) { pos[k] += d.p[k] * w; rot[k] += d.r[k] * w; }
    }
    /* 分层拆解：按黄金角把装配向四周错峰外移，不是整块平移 */
    if (explode > 0) {
      const ang = idx * 2.39996323;
      const dir = [Math.cos(ang) * .95, ((idx % 7) - 3) * .20, Math.sin(ang) * .95];
      const spread = explode * (.85 + (idx % 5) * .18);
      for (let k = 0; k < 3; k++) pos[k] += dir[k] * spread;
      rot[1] += explode * .12 * Math.sin(ang);
      rot[2] += explode * .08 * Math.cos(ang);
    }
    return { id: a.id, assembly: a.id, pos, rot, scale, u,
             finite: pos.concat(rot, scale).every(Number.isFinite) };
  });
  return {
    t: time, phase: global, transform: [A, B], explode, deploy,
    assemblies: rows,
    parts: rows.map((r) => ({ id: r.id, assembly: r.assembly, pos: r.pos, rot: r.rot, scale: r.scale }))
  };
}

export const timeline = TIMELINE;
export const HY4_STATE = { stateAt, timeline, ASSEMBLIES };
if (typeof globalThis !== 'undefined') globalThis.HY4_STATE = HY4_STATE;
