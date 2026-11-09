// 六足机器人 HX-18 影片：机器（geometry.js）放在地砖影棚（stage.js）里，控制台（console.js）
// 盖在上面。操作员走完巡览——主机位行走、步态图+触地连线、右中腿三关节逐个隔离、单腿关节
// 分解、俯视步态、整机拆解转台、重组、继续行走离场——每一拍的时间都来自
// ../hexapod-film/timeline.json，绝不写死。render(t) 是 t 的纯函数：步态的停/走调度在装
// 载时预积分成表，render 只查表。
import {runSim} from '../../../../../../shared/mechanical/kit/sims/kit/runtime.js';
import {createConsole, ASSEMBLIES, ASM_LABEL, DISPLAY} from './console.js';
import {createHexapodStage} from './stage.js';
import {
  G, SPEED, LEGS, contactOf, legPose, legTorques, jointDeg, powerW, voltV,
  bodyH, bodyPitch, bodyRoll, gaitRows as modelGaitRows,
} from './model.js';
import TL from '../hexapod-film/timeline.json' with {type: 'json'};

export const DURATION = TL.duration;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: '六足机器人 HX-18', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ 步态停/走调度（预积分）
// 拆解前机器停步、落到维修支架（park=1），重组完成后恢复行走。rate(t) ∈ [0,1] 是步态
// 时钟的推进速率；GTIME(t) = ∫rate，p(t) = GTIME/T_STEP，worldX = SPEED·GTIME。
export const rateAt = (t) => 1 - ss(TL.gait_stop, TL.gait_stop + 0.7, t) * (1 - ss(TL.gait_resume - 0.7, TL.gait_resume, t));
const DT = 1 / 240;
const GT = {T: new Float64Array(Math.ceil((DURATION + 1) * 240) + 2), P: new Float64Array(Math.ceil((DURATION + 1) * 240) + 2), TEMP: new Float64Array(Math.ceil((DURATION + 1) * 240) + 2)};
{
  let g = 0;
  let temp = 24;
  for (let i = 0; i < GT.T.length; i++) {
    const t = i * DT;
    GT.T[i] = g;
    GT.P[i] = g / G.T_STEP;
    const p = g / G.T_STEP;
    const park = 1 - rateAt(t);
    const eq = 24 + 0.62 * powerW(p, {park});
    temp += (eq - temp) * (DT / 30);
    GT.TEMP[i] = temp;
    g += rateAt(t) * DT;
  }
}
const idx = (t) => Math.min(GT.T.length - 1, Math.max(0, Math.round(t / DT)));
export const gtimeAt = (t) => GT.T[idx(t)];
export const pAt = (t) => GT.P[idx(t)];
export const tempAt = (t) => GT.TEMP[idx(t)];
export const parkAt = (t) => 1 - rateAt(t);
export const worldXAt = (t) => SPEED * gtimeAt(t);
/** 步态图历史：把历史时刻映射到步态相位（停走一致） */
const phaseAt = (t) => GT.P[idx(Math.max(0, Math.min(DURATION, t)))];
export const gaitRowsAt = (t, cols = 44) => {
  const rows = [];
  for (let i = 0; i < 6; i++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const tt = Math.max(0, t - 1.45 * (1 - c / (cols - 1)));
      row.push(contactOf(i, phaseAt(tt), parkAt(tt) > 0.5));
    }
    rows.push(row);
  }
  return rows;
};
const tempChartAt = (t) => {
  const out = [];
  for (let c = 0; c <= 40; c++) out.push(tempAt(Math.max(0, t - 40 * (1 - c / 40))));
  return out;
};

// ------------------------------------------------------------ 巡览（拍点全来自 timeline.json）
export const BEATS = [
  {key: 'walk', t: TL.walk, view: 'walk', status: '行走中', mode: '行走', phase: '自动 · 三脚架步态'},
  {key: 'gait', t: TL.gait, view: 'gait', status: '步态分析', mode: '步态图', phase: '操作员 · 触地连线'},
  {key: 'leg', t: TL.leg, view: 'leg', status: '腿 R2 隔离', mode: '腿部伺服', phase: '操作员 · 隔离右中腿'},
  {key: 'joint', t: TL.joint, view: 'joint', status: '关节分解', mode: '关节分解', phase: '操作员 · 三关节拆开'},
  {key: 'top', t: TL.top, view: 'top', status: '俯视步态', mode: '俯视步态', phase: '自动 · 相位俯视'},
  {key: 'explode', t: TL.explode, view: 'explode', status: '停机检修', mode: '整机拆解', phase: '操作员 · 停机上架'},
  {key: 'reassemble', t: TL.reassemble, view: 'reassemble', status: '重组中', mode: '重组', phase: '操作员 · 重组'},
  {key: 'depart', t: TL.depart, view: 'depart', status: '恢复行走', mode: '离场', phase: '自动 · 恢复行走'},
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

// ------------------------------------------------------------ 机位（目标点相对机器），u = 拍内秒数
export const VIEW_FN = {
  walk: (u) => ({tx: 0, ty: 0.07, tz: 0, az: 34 + 2 * u, el: 13, d: 1.15, sx: 0, sy: -20}),
  gait: (u) => ({tx: 0, ty: 0.03, tz: 0, az: 58 + 1.5 * u, el: 42, d: 1.45, sx: 0, sy: -28}),
  leg: (u) => ({tx: 0.04, ty: 0.06, tz: 0.18, az: 18 + 2 * u, el: 16, d: 0.8, sx: 0, sy: -12}),
  joint: (u) => ({tx: 0.06, ty: 0.09, tz: 0.22, az: 44 + 2 * u, el: 24, d: 0.9, sx: 0, sy: -8}),
  top: (u) => ({tx: 0, ty: 0.02, tz: 0, az: 26 + 3 * u, el: 74, d: 1.35, sx: 0, sy: 0}),
  explode: (u) => ({tx: 0, ty: 0.14, tz: 0, az: 34, el: 20, d: 1.7, sx: 0, sy: -26}),
  reassemble: (u) => ({tx: 0, ty: 0.1, tz: 0, az: 34, el: 16, d: 1.5, sx: 0, sy: -24}),
  depart: (u) => ({tx: 0, ty: 0.09, tz: 0, az: 30 + 3 * u, el: 18, d: 2.4 + 0.16 * u, sx: 0, sy: -22}),
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
  {name: '六边形机身舱', sub: '对边 300 mm · 铝合金', at: new V3(0.16, 0.02, 0.06), gate: () => 1},
  {name: '顶盖', sub: '冰蓝阳极板', at: new V3(-0.1, 0.045, -0.05), gate: (o) => Math.max(o.explode, 0.55)},
  {name: '电池舱', sub: '3S 锂电 · 顶置', at: new V3(0.02, 0.06, 0), gate: (o) => Math.max(o.explode, 0.45)},
  {name: '传感头', sub: '双超声 · 转台云台', at: new V3(-0.1, 0.18, 0), gate: () => 1},
  {name: '髋偏航舵机', sub: 'AX-12A · ±40°', at: (m) => new V3(m.s4.M[0], m.s4.M[1], m.s4.M[2]), gate: (o) => Math.max(o.leg, 0.4)},
  {name: '股节舵机', sub: '股节 102 mm', at: (m) => new V3(m.s4.K0[0], m.s4.K0[1], m.s4.K0[2]), gate: (o) => Math.max(o.leg, 0.5)},
  {name: '胫节舵机', sub: '胫节 114 mm', at: (m) => new V3(m.s4.K[0], m.s4.K[1], m.s4.K[2]), gate: (o) => Math.max(o.leg, 0.5)},
  {name: '脚垫', sub: '橡胶锥台 · 力敏', at: (m) => new V3(m.s4.F[0], m.s4.F[1], m.s4.F[2]), gate: (o) => Math.max(o.leg, 0.45)},
  {name: '触地连线', sub: '支撑脚 → 质心投影', at: (m) => {
    // 取一条支撑脚的中点附近
    const s = m.s0;
    return new V3(s.F[0] * 0.5, 0.01, s.F[2] * 0.5);
  }, gate: (o) => Math.max(o.gait, 0)},
];
export function makeLabels(st, hex) {
  const v = new V3();
  return (opens, o, p) => {
    if (o < 0.02) return [];
    hex.root.updateWorldMatrix(true, false);
    const m = {s0: legPose(0, p, {park: opens.park}), s4: legPose(4, p, {park: opens.park})};
    const pts = PARTS.map((part) => {
      v.copy(typeof part.at === 'function' ? part.at(m) : part.at);
      v.y += 0.098; // 机身系原点在地面上的高度（机身中心 98 mm）
      v.applyMatrix4(hex.root.matrixWorld);
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

export function makeConsoleFrame(ui, st, hex) {
  const labels = makeLabels(st, hex);
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
      speed: s.speed,
      gaitHz: s.gaitHz,
      stanceN: s.stanceN,
      duty: G.DUTY,
      stride: G.STROKE,
      stride2: 2 * G.STROKE,
      gaitRows: gaitRowsAt(t),
      power: s.power,
      volt: s.volt,
      temp: s.temp,
      tempChart: tempChartAt(t),
      joints: s.joints,
      torques: s.torques,
      hotLeg: s.hotLeg,
      pitch: s.pitch,
      roll: s.roll,
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
    const st = createHexapodStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    ui.setBeats(BEATS.map((b) => b.t), DURATION);
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st, st.hex);
    window.HXS = st;
    const DEV = cfg?.dev || null;
    return {
      resize,
      render(t) {
        const p = pAt(t);
        const park = parkAt(t);
        const beat = beatAt(t);
        const explode = explodeAt(t);
        const opens = {
          leg: openOf('leg', t),
          joint: openOf('joint', t),
          gait: openOf('gait', t),
          top: openOf('top', t),
          explode,
          park,
        };
        const disp = DEV?.display ? Object.fromEntries(DISPLAY.map((k) => [k, 1])) : {};
        const isoK = Math.max(opens.leg, opens.joint) * (1 - explode);
        // 三关节逐个隔离：leg 拍 6..9 s 内每关节 1 s
        const jf = beat.key === 'leg' ? Math.min(2, Math.max(0, Math.floor(t - TL.leg))) : -1;
        const gaitK = Math.max(opens.gait, disp.gait ? 0.9 : 0, opens.top * 0.6) * (1 - explode);
        const legExplode = opens.joint * (1 - explode);
        const cam = DEV?.cam ? {...camAt(t), ...DEV.cam} : camAt(t);
        st.frame(
          {p, park, worldX: worldXAt(t), isoK, jf, legExplode, explode, gaitK},
          {az: cam.az * D2R, el: cam.el * D2R, tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
        );
        const rate = rateAt(t);
        const opts = {park};
        const joints = jointDeg(p, opts);
        const torques = [];
        for (let i = 0; i < 6; i++) torques.push(Math.max(...legTorques(i, p, opts)));
        const stanceNow = park > 0.5 ? 6 : [0, 1, 2, 3, 4, 5].filter((i) => contactOf(i, p, park)).length;
        frame(t, {
          status: beat.status,
          mode: beat.mode,
          modeSub: modeSub(beat, t, p, park, explode, opens, rate, jf, stanceNow),
          phase: beat.phase,
          p,
          opens,
          speed: SPEED * rate,
          gaitHz: (1 / G.T_STEP) * rate,
          stanceN: stanceNow,
          power: powerW(p, opts),
          volt: voltV(p, t, opts),
          temp: tempAt(t),
          joints,
          torques,
          hotLeg: isoK > 0.5 ? 4 : -1,
          pitch: bodyPitch(p) / D2R,
          roll: bodyRoll(p) / D2R,
          isolate: beat.key === 'leg' || beat.key === 'joint' ? 'leg2' : 'hero',
          display: disp,
          subsystems: subsystems(t, p, park, explode, jf, stanceNow),
          labels: DEV ? 1 : ss(viewAt(t)[0] + 0.9, viewAt(t)[0] + 1.6, t),
          cursor: DEV ? {x: -99, y: -99, press: false, ring: 0, ringX: 0, ringY: 0} : cursorAt(t),
        });
        return {};
      },
    };
  };
}
const pct = (x) => Math.round(x * 100);
const JN = ['髋', '股', '胫'];
const modeSub = (beat, t, p, park, explode, opens, rate, jf, stanceNow) => {
  if (beat.key === 'walk') return `三脚架步态 · 相位 ${p.toFixed(2)} · 支撑 ${stanceNow} 足 · ${(SPEED * 100).toFixed(0)} cm/s`;
  if (beat.key === 'gait') return `触地连线 · 支撑 ${stanceNow} 足 · 占空比 ${G.DUTY.toFixed(2)}`;
  if (beat.key === 'leg') return `右中腿 · ${pct(opens.leg)}% 隔离 · ${JN[Math.min(2, Math.max(0, jf))]}关节焦点`;
  if (beat.key === 'joint') return `关节分解 · ${pct(opens.joint)}% · 髋/股/胫三轴拆开`;
  if (beat.key === 'top') return `俯视 · A 组 L1 L3 R2 / B 组 L2 R1 R3`;
  if (beat.key === 'explode') return `拆解 · ${pct(explode)}% · 停机 ${park.toFixed(2)}`;
  if (beat.key === 'reassemble') return `重组 · ${pct(1 - explode)}%`;
  if (beat.key === 'depart') return `恢复行走 · ${pct(rate)}% 步速`;
  return '';
};
const subsystems = (t, p, park, explode, jf, stanceNow) => [
  [park > 0.5 ? '停机' : explode > 0.3 ? '锁定' : '行走中', park > 0.5 || explode > 0.3],
  [jf >= 0 ? `焦点 ${JN[Math.min(2, Math.max(0, jf))]}` : '18 / 18 在线', jf >= 0],
  [park > 0.5 ? '浮充' : '放电中', park > 0.5],
  ['跟踪中', false],
  [explode > 0.3 ? '离地' : `${stanceNow} / 6 触地`, explode > 0.3],
  [explode > 0.3 ? '拆解中' : '紧固', explode > 0.3],
];

export const run = () => runSim(DEFAULTS, makeFilm());
