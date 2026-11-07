// Telson SC-8 影片：机器（geometry.js）放在石板影棚（stage.js）里，控制台（console.js）盖在上面。
// 操作员走完巡览 —— 行走主机位、步态图+触地连线、单腿、钳、尾链甩击、拆解转台、重组、警戒收尾
// —— 每一拍的时间都来自 ../scorpion-film/timeline.json，绝不写死。render(t) 是 t 的纯函数。
import {runSim} from '../kit/runtime.js';
import {createConsole, ASSEMBLIES, ASM_LABEL, DISPLAY} from './console.js';
import {createScorpionStage} from './stage.js';
import {
  G, MODE_NAME, pAt, modeOf, settleK, bodyPose,
  gaitStats, legTarget, contacts, loads,
  tailAngles, tailPose, tailTipSpeed, tailTorqueNm, strikeDeg,
  clawOpenDeg, clawFingerSpeed, powerW,
} from './model.js';
import TL from '../scorpion-film/timeline.json' with {type: 'json'};

export const DURATION = TL.duration;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: '机械蝎子 SC-8', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ 巡览（拍点全来自 timeline.json）
export const BEATS = [
  {key: 'walk', t: TL.walk, view: 'walk', status: '+行走中', mode: '行走', phase: '自动 · 行走步态'},
  {key: 'gait', t: TL.gait, view: 'gait', status: '+步态分析', mode: '步态图', phase: '操作员 · 触地连线'},
  {key: 'leg', t: TL.leg, view: 'leg', status: '+腿 R2 隔离', mode: '腿部伺服', phase: '操作员 · 隔离腿 R2'},
  {key: 'claw', t: TL.claw, view: 'claw', status: '+左钳演示', mode: '钳开合', phase: '操作员 · 隔离左钳'},
  {key: 'tail', t: TL.tail, view: 'tail', status: '+尾链甩击', mode: '尾部攻击', phase: '操作员 · 尾节链特写'},
  {key: 'explode', t: TL.explode, view: 'explode', status: '+整机拆解', mode: '整机拆解', phase: '操作员 · 尾链逐节分离'},
  {key: 'reassemble', t: TL.reassemble, view: 'reassemble', status: '+重组中', mode: '重组', phase: '操作员 · 重组'},
  {key: 'alert', t: TL.alert, view: 'alert', status: '+警戒', mode: '警戒', phase: '自动 · 警戒收尾'},
];
export const beatAt = (t) => {
  let b = BEATS[0];
  for (const x of BEATS) if (x.t <= t) b = x;
  return b;
};
const nextT = (key) => {
  const i = BEATS.findIndex((b) => b.key === key);
  return i >= 0 && i < BEATS.length - 1 ? BEATS[i + 1].t : DURATION;
};
/** 一拍的展开量：拍点起 0.85 s 缓入，下一拍开始 0.6 s 缓出 */
export const openOf = (key, t) => {
  const b = BEATS.find((x) => x.key === key).t;
  const nx = nextT(key);
  return ss(b, b + 0.85, t) * (1 - ss(nx, nx + 0.6, t));
};
export const explodeAt = (t) => ss(TL.explode, TL.explode + 1.5, t) * (1 - ss(TL.reassemble, TL.reassemble + 1.3, t));

// ------------------------------------------------------------ 机位（目标点相对机器原点），u = 拍内秒数
export const VIEW_FN = {
  walk: (u) => ({tx: 0, ty: 0.07, tz: 0, az: 34 + 1.6 * u, el: 13, d: 1.12, sx: 0, sy: -20}),
  gait: (u) => ({tx: 0, ty: 0.02, tz: 0, az: 58 + 1.5 * u, el: 40, d: 1.4, sx: 0, sy: -34}),
  leg: (u) => ({tx: -0.1, ty: 0.08, tz: 0.02, az: -50 + 2 * u, el: 16, d: 0.72, sx: 0, sy: -14}),
  claw: (u) => ({tx: 0.07, ty: 0.065, tz: 0.17, az: 30 + 2 * u, el: 20, d: 0.56, sx: 0, sy: -10}),
  tail: (u) => ({tx: 0, ty: 0.16, tz: -0.08, az: 252 + 1.6 * u, el: 12, d: 0.58, sx: 0, sy: -10}),
  explode: (u) => ({tx: 0, ty: 0.1, tz: 0, az: 34, el: 20, d: 1.6, sx: 0, sy: -26}),
  reassemble: (u) => ({tx: 0, ty: 0.07, tz: 0, az: 34, el: 16, d: 1.4, sx: 0, sy: -26}),
  alert: (u) => ({tx: 0, ty: 0.08, tz: 0.01, az: 30 + 1.2 * u, el: 12, d: 1.2, sx: 0, sy: -20}),
};
const VIEWS = BEATS.map((b) => [b.t, b.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  o.d += Math.max(0, Math.max(a.d, b.d) + 0.4 * swing - o.d) * Math.sin(Math.PI * k);
  return o;
};
export const camAt = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0]);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.1, t);
  const o = k >= 1 ? {...cur} : blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]), cur, k);
  o.az += 330 * ss(TL.explode + 0.4, TL.reassemble + 0.7, t); // 拆解转台的 330° 环绕
  return o;
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ 面板：所有数字来自模型
const DT = 1 / 240;
/** 步态图：8 行 × 44 列，过去 1.45 s 的支撑状态 */
const GAIT_WIN = 1.45;
const gaitRows = (t) => {
  const rows = [];
  for (let i = 0; i < 8; i++) {
    const row = [];
    for (let c = 0; c < 44; c++) {
      const tt = Math.max(0, t - GAIT_WIN * (1 - c / 43));
      row.push(legTarget(i, pAt(tt, TL.alert), {}).contact);
    }
    rows.push(row);
  }
  return rows;
};
/** 钳指速度曲线：过去 1.2 s */
const clawChart = (t) => {
  const out = [];
  for (let c = 0; c <= 40; c++) {
    const tt = Math.max(0, t - 1.2 * (1 - c / 40));
    out.push(clawFingerSpeed(pAt(tt, TL.alert)));
  }
  return out;
};
const stateAt = (t) => {
  const p = pAt(t, TL.alert);
  const settleF = explodeAt(t);
  return {p, settleF, opts: {settle: settleF, lift: bodyPose(p).lift + bodyPose(p).bob}};
};

// ------------------------------------------------------------ 操作员光标
const REST = [[900, 200], [760, 660], [1040, 260], [820, 620]];
export function makeCursor(ui) {
  const EV = BEATS.filter((b) => b.t > 0).map((b) => ({t: b.t, spot: ui.spots[b.key] ?? ui.spots.hero, label: b.key}));
  const WP = [[0, 980, 520]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot], [e.t + 0.22, ...e.spot]);
    WP.push([e.t + 1.4, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ 标注：机器系部件点
import * as THREE from 'three';
const V3 = THREE.Vector3;
const PARTS = [
  {name: '传感头', sub: '2 × 26 毫米镜头 · IR 圈', at: new V3(0, 0.07, 0.13), gate: () => 1},
  {name: '背甲', sub: '5 板 · 铰接分节', at: new V3(0.05, 0.1, 0.0), gate: () => 0.9},
  {name: '腹部背板', sub: '5 板 · 走线舱', at: new V3(-0.05, 0.026, -0.05), gate: (o) => o.explode},
  {name: '基节偏航', sub: '步幅落入腿平面', at: (m) => {
    const lp = m.legPose5;
    return new V3(lp.P0[0], lp.P0[1], lp.P0[2]);
  }, gate: (o) => Math.max(o.leg, 0.4)},
  {name: '股节 · 胫节', sub: '闭式 2 连杆 · 膝在上', at: (m) => {
    const lp = m.legPose5;
    return new V3(lp.K[0], lp.K[1], lp.K[2]);
  }, gate: () => 1},
  {name: '齿轮减速鼓', sub: '动指铰链驱动', at: (m) => {
    const cp = m.clawPoseL;
    return new V3(cp.E[0], cp.E[1], cp.E[2]);
  }, gate: (o) => o.claw},
  {name: '动指', sub: '开口 0–54°', at: (m) => {
    const cp = m.clawPoseL;
    return new V3(cp.tipM[0], cp.tipM[1], cp.tipM[2]);
  }, gate: (o) => Math.max(o.claw, 0.5)},
  {name: '尾节链', sub: '5 节 · 刚体甩击', at: (m) => {
    const tp = m.tailPose;
    return new V3(tp.J[3][0], tp.J[3][1], tp.J[3][2]);
  }, gate: () => 1},
  {name: '毒针', sub: '锥针 · 毒囊', at: (m) => {
    const tp = m.tailPose;
    return new V3(tp.tip[0], tp.tip[1], tp.tip[2]);
  }, gate: (o) => Math.max(o.tail, 0.5)},
];
export function makeLabels(st, scorp) {
  const v = new V3();
  return (opens, o, p) => {
    if (o < 0.02) return [];
    scorp.root.updateWorldMatrix(true, false);
    const m = {
      legPose5: legTargetCache(scorp, p),
      clawPoseL: clawCache(scorp),
      tailPose: tailPose(p),
    };
    const pts = PARTS.map((part) => {
      v.copy(typeof part.at === 'function' ? part.at(m) : part.at).applyMatrix4(scorp.root.matrixWorld);
      return {part, at: st.project(v.x, v.y, v.z), o: o * part.gate(opens)};
    }).filter((x) => x.at && x.o > 0.03 && x.at[0] > 320 && x.at[0] < 1300 && x.at[1] > 140 && x.at[1] < 720);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 150;
      for (const c of col) {
        y = Math.max(y, Math.min(660, c.at[1] - 10));
        out.push({name: c.part.name, sub: c.part.sub, at: c.at, label: [x, y], w, o: c.o});
        y += 34;
      }
    };
    stack(L, 344, 168);
    stack(R, 1108, 168);
    return out;
  };
}
// 标注里的关节点直接从几何层最近一次姿态取（几何层每帧已重排）
const legTargetCache = (scorp, p) => scorp.legs[5].pose(5, p, {lift: bodyPose(p).lift + bodyPose(p).bob});
const clawCache = (scorp) => scorp.claws[0].set(1, pCache.p, pCache.demo);
const pCache = {p: 0, demo: 0};

export function makeConsoleFrame(ui, st, scorp) {
  const labels = makeLabels(st, scorp);
  return (t, s) => {
    ui.update({
      t,
      dur: DURATION,
      status: s.status,
      mode: s.mode,
      modeSub: s.modeSub,
      phase: s.phase,
      prog: t / DURATION,
      load: s.load,
      gaitHz: s.gaitHz,
      stanceN: s.stanceN,
      gaitRows: gaitRows(t),
      pattern: s.pattern,
      duty: G.DUTY,
      tipSpeed: tailTipSpeed(s.p),
      strikeDeg: strikeDeg(s.p),
      torque: tailTorqueNm(s.p),
      power: powerW(s.p, s.opts),
      tailState: s.tailState,
      tailDeg: tailAngles(s.p).map((a) => (a * 180) / Math.PI),
      loads: loads(s.p, s.opts),
      clawSpeed: clawFingerSpeed(s.p, s.demo),
      clawChart: clawChart(t),
      clawOpen: clawOpenDeg(s.p, s.demo),
      clawMode: s.clawMode,
      isolate: s.isolate,
      display: s.display,
      subsystems: s.subsystems,
      paused: s.paused ?? false,
      actions: 0,
      callouts: labels(s.opens, s.labels, s.p),
      cursor: s.cursor,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture, cfg}) => {
    const st = createScorpionStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    ui.setBeats(BEATS.map((b) => b.t), DURATION);
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st, st.scorp);
    window.SCS = st;
    const DEV = cfg?.dev || null;
    return {
      resize,
      render(t) {
        const p = pAt(t, TL.alert);
        const beat = beatAt(t);
        const explode = explodeAt(t);
        const opens = {
          leg: openOf('leg', t),
          claw: openOf('claw', t),
          tail: openOf('tail', t),
          explode,
        };
        const disp = DEV?.display ? Object.fromEntries(DISPLAY.map((k) => [k, 1])) : {};
        const gaitK = Math.min(1, (disp.gait ? 0.9 : 0) + (beat.key === 'gait' ? 1 : 0));
        const isoKey = beat.key === 'leg' ? 'leg' : beat.key === 'claw' ? 'claw' : beat.key === 'tail' ? 'tail' : 'hero';
        const isoK = beat.key === 'leg' ? opens.leg : beat.key === 'claw' ? opens.claw : opens.tail;
        const demo = opens.claw;
        pCache.p = p;
        pCache.demo = demo;
        const cam = DEV?.cam ? {...camAt(t), ...DEV.cam} : camAt(t);
        st.frame(
          {p, settleF: explode, explode, isoKey, isoK, gaitK, demo},
          {az: cam.az * D2R, el: cam.el * D2R, tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
        );
        const cs = contacts(p, {settle: explode});
        frame(t, {
          status: beat.status,
          mode: MODE_NAME[modeOf(p)],
          modeSub: modeSub(beat, p, cs, explode, opens),
          phase: beat.phase,
          p,
          demo,
          opens,
          opts: {settle: explode},
          load: tailTipSpeed(p) / (whipPeakCache ?? (whipPeakCache = tailTipSpeed(whipPeakP()))),
          gaitHz: gaitStats().hz * (1 - Math.max(settleK(p), explode)),
          stanceN: cs.filter(Boolean).length,
          pattern: cs.filter(Boolean).length === 8 ? '支撑 · 8 足' : '交替 · 2 组',
          tailState: tailTipSpeed(p) > 0.35 ? '甩击中' : archAt(p) ? '拱起' : '锁定',
          clawMode: clawOpenDeg(p, demo) <= 6 ? '咬合' : clawOpenDeg(p, demo) > 34 ? '张开' : '保持',
          isolate: isoKey === 'hero' ? 'hero' : isoKey,
          display: disp,
          subsystems: subsystems(p, cs, opens, explode),
          labels: DEV ? 1 : ss(viewAt(t)[0] + 0.9, viewAt(t)[0] + 1.6, t),
          cursor: DEV ? {x: -99, y: -99, press: false, ring: 0, ringX: 0, ringY: 0} : cursorAt(t),
        });
        return {};
      },
    };
  };
}
let whipPeakCache = null;
const whipPeakP = () => G.WHIP_T0 + G.WHIP_WIN / 2;
const archAt = (p) => p >= G.WALK_END - 1e-6;
const pct = (x) => Math.round(x * 100);
const modeSub = (beat, p, cs, explode, opens) => {
  const n = cs.filter(Boolean).length;
  if (beat.key === 'walk') return `相位 ${p.toFixed(2)} · 支撑 ${n} 足`;
  if (beat.key === 'gait') return `触地连线 · 支撑 ${n} 足 · 占空比 ${G.DUTY.toFixed(2)}`;
  if (beat.key === 'leg') return `腿 R2 · ${pct(opens.leg)}% 隔离`;
  if (beat.key === 'claw') return `左钳 · 开口 ${clawOpenDeg(p, opens.claw).toFixed(0)}°`;
  if (beat.key === 'tail') return `尾链 · 打击角 ${strikeDeg(p).toFixed(0)}° · 针速 ${tailTipSpeed(p).toFixed(2)} m/s`;
  if (beat.key === 'explode') return `拆解 · ${pct(explode)}%`;
  if (beat.key === 'reassemble') return `重组 · ${pct(1 - explode)}%`;
  if (beat.key === 'alert') return `相位驻停 ${p.toFixed(2)} · 8 足支撑 · 待命`;
  return MODE_NAME[modeOf(p)];
};
const subsystems = (p, cs, opens, explode) => [
  [archAt(p) ? '警戒中' : '跟踪中', archAt(p)],
  [opens.claw > 0.5 ? '演示中' : clawOpenDeg(p) > 34 ? '张开' : '待命', opens.claw > 0.5],
  [explode > 0.3 ? '分离' : '密封', explode > 0.3],
  [cs.filter(Boolean).length === 8 ? '8 / 8 在线' : '交替支撑', false],
  [tailTipSpeed(p) > 0.35 ? '甩击中' : archAt(p) ? '拱起' : '锁定', tailTipSpeed(p) > 0.35],
  [tailTipSpeed(p) > 0.9 ? '击发' : '待命', tailTipSpeed(p) > 0.9],
];

export const run = () => runSim(DEFAULTS, makeFilm());
