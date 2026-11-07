// 机械水母 MJ-9，影片：机器（geometry.js）在水下影棚（stage.js）里，控制台（console.js）盖在上面。
// 操作员走完整段巡览 —— 巡游、泵核特写、钟体收缩波、触须拖曳、深度剖面、拆解转台、重组、离场
// —— 每一拍的时间都来自 ../jellyfish-film/timeline.json，没有一个手打的数。render(t) 是 t 的纯函数。
import {runSim} from '../kit/runtime.js';
import {createConsole, ASSEMBLIES, ASM_LABEL, DISPLAY} from './console.js';
import {createJellyStage} from './stage.js';
import {G, THRUST_PEAK, flap, pressureKPa, pulse, thrustN, speed, tentSway, pistonStroke} from './model.js';
import TL from '../jellyfish-film/timeline.json' with {type: 'json'};

export const DURATION = TL.duration;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: '机械水母 MJ-9', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ 巡览，拍点来自 timeline.json
export const BEATS = [
  {key: 'cruise', t: TL.cruise, view: 'hero', status: '巡游中', mode: '脉动巡游', phase: '自动 · 脉动巡游'},
  {key: 'pump', t: TL.pump, view: 'pump', status: '泵核特写', mode: '泵核吸入-喷出', phase: '操作员 · 隔离泵核'},
  {key: 'bell', t: TL.bell, view: 'bell', status: '收缩波', mode: '钟体收缩波', phase: '操作员 · 隔离钟体'},
  {key: 'tentacle', t: TL.tentacle, view: 'tentacle', status: '触须拖曳', mode: '触须被动拖曳', phase: '操作员 · 隔离触须'},
  {key: 'profile', t: TL.profile, view: 'profile', status: '剖面读数', mode: '深度剖面 + 推力曲线', phase: '自动 · 剖面读数'},
  {key: 'explode', t: TL.explode, view: 'explode', status: '整机拆解', mode: '整机拆解', phase: '操作员 · 整机拆解'},
  {key: 'reassemble', t: TL.reassemble, view: 'reassemble', status: '重组中', mode: '重组', phase: '操作员 · 重组'},
  {key: 'depart', t: TL.depart, view: 'depart', status: '离站中', mode: '离站', phase: '自动 · 离站'},
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
/** 一拍的开度：拍点起 0.85 s 缓入，下一拍起 0.6 s 缓出 */
export const openOf = (key, t) => {
  const b = BEATS.find((x) => x.key === key).t;
  const nx = nextT(key);
  return ss(b, b + 0.85, t) * (1 - ss(nx, nx + 0.6, t));
};
export const explodeAt = (t) => ss(TL.explode, TL.explode + 1.5, t) * (1 - ss(TL.reassemble, TL.reassemble + 1.3, t));

// ------------------------------------------------------------ 视角（目标点相对机器），u = 该拍已进行秒数
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: -0.06, tz: 0, az: 36 + 2 * u, el: 14, d: 2.35, sx: 0, sy: -26}),
  pump: (u) => ({tx: 0.02, ty: 0.1, tz: 0.04, az: 24 + 2 * u, el: 30, d: 0.78, sx: 0, sy: -12}),
  bell: (u) => ({tx: 0, ty: 0.02, tz: 0, az: 74 + 3 * u, el: 40, d: 1.28, sx: 0, sy: -8}),
  tentacle: (u) => ({tx: 0.1, ty: -0.34, tz: 0.05, az: 128 + 2 * u, el: 10, d: 1.5, sx: 0, sy: -8}),
  profile: (u) => ({tx: 0, ty: -0.1, tz: 0, az: 44 + 1.2 * u, el: 8, d: 2.6, sx: 0, sy: -14}),
  explode: (u) => ({tx: 0, ty: -0.05, tz: 0, az: 36, el: 20, d: 3.0, sx: 0, sy: -22}),
  reassemble: (u) => ({tx: 0, ty: -0.06, tz: 0, az: 36, el: 15, d: 2.55, sx: 0, sy: -24}),
  depart: (u) => ({tx: 0, ty: 0.05, tz: 0, az: 30 + 4 * u, el: 20, d: 3.5, sx: 0, sy: -20}),
};
const VIEWS = BEATS.map((b) => [b.t, b.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  o.d += Math.max(0, Math.max(a.d, b.d) + 0.5 * swing - o.d) * Math.sin(Math.PI * k);
  return o;
};
export const camAt = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0]);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.5, t);
  const o = k >= 1 ? {...cur} : blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]), cur, k);
  // 拆解段的 330° 转台，读自 timeline（窗外为零）
  o.az += 330 * ss(TL.explode + 0.4, TL.reassemble + 0.7, t);
  return o;
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ 面板：每个数都从模型来
const DT = 1 / 240;
const TEMP = [0];
{
  let acc = 0;
  for (let i = 1; i * DT <= DURATION + 1; i++) {
    const p = (((i - 0.5) * DT) * G.PULSE_HZ) % 1;
    acc += (pulse(p) - acc) * (DT / 1.9); // 拖尾平均，泵热惯性 ~1.9 s
    TEMP.push(acc);
  }
}
const tempAt = (t) => TEMP[Math.min(TEMP.length - 1, Math.round(t / DT))];
export const depth = (t) => 12.42 - 0.11 * ss(0, DURATION, t) - 0.02 * Math.sin(t * 0.7);
const vsAt = (t) => (depth(t + 0.05) - depth(t - 0.05)) / 0.1;
const chart = (t) => {
  const out = [];
  for (let i = 0; i <= 40; i++) out.push(pressureKPa(((t - 1.2 + (i / 40) * 1.2) * G.PULSE_HZ) % 1));
  return out;
};

// ------------------------------------------------------------ 操作员指针
const REST = [[900, 200], [760, 660], [1040, 260], [820, 620]];
export function makeCursor(ui) {
  const EV = BEATS.filter((b) => b.t > 0).map((b) => ({t: b.t, spot: ui.spots[b.key] ?? ui.spots.hero}));
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

// ------------------------------------------------------------ 标注：机器坐标系里的部件点
import * as THREE from 'three';
const V3 = THREE.Vector3;
const PARTS = [
  {name: '钟顶极板', sub: '吸入环 · 灯圈', at: new V3(0, 0.31, 0), gate: () => 1},
  {name: '透明瓣', sub: '8 瓣 · 沿缘收缩波', at: new V3(0.16, 0.1, 0.1), gate: () => 1},
  {name: '钟缘环', sub: '8 缘节 · 触须挂点', at: new V3(0.21, -0.06, 0.05), gate: () => 1},
  {name: '裙边', sub: '8 瓣锯齿 · 随相内收', at: new V3(-0.17, -0.085, 0.09), gate: () => 1},
  {name: '泵核耐压舱', sub: '吸入-喷出 · 电驱动', at: new V3(0.05, 0.05, 0.04), gate: (o) => Math.max(o.pump, 0.45)},
  {name: '喷口 4 瓣', sub: '排气段张开', at: new V3(0, -0.12, 0.02), gate: (o) => Math.max(o.pump, 0.35)},
  {name: '平衡腔', sub: '浮沉活塞 · 调载', at: new V3(0.075, 0.075, 0.01), gate: (o) => Math.max(o.pump, 0.35)},
  {name: '触须 T3', sub: '22 节 · 相位错开', at: (jelly) => {
    const pts = jelly.tents.pts[2];
    return new V3(pts[12 * 3], pts[12 * 3 + 1], pts[12 * 3 + 2]);
  }, gate: () => 1},
  {name: '叶状鳍', sub: '须端被动鳍', at: (jelly) => {
    const pts = jelly.tents.pts[1];
    return new V3(pts[22 * 3], pts[22 * 3 + 1], pts[22 * 3 + 2]);
  }, gate: (o) => Math.max(o.tentacle, 0.4)},
];
export function makeLabels(st, jelly) {
  const v = new V3();
  return (opens, o) => {
    if (o < 0.02) return [];
    jelly.root.updateWorldMatrix(true, false);
    const pts = PARTS.map((pt) => {
      v.copy(typeof pt.at === 'function' ? pt.at(jelly) : pt.at).applyMatrix4(jelly.root.matrixWorld);
      return {p: pt, at: st.project(v.x, v.y, v.z), o: o * pt.gate(opens)};
    }).filter((x) => x.at && x.o > 0.03 && x.at[0] > 320 && x.at[0] < 1300 && x.at[1] > 140 && x.at[1] < 720);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 150;
      for (const c of col) {
        y = Math.max(y, Math.min(660, c.at[1] - 10));
        out.push({name: c.p.name, sub: c.p.sub, at: c.at, label: [x, y], w, o: c.o});
        y += 34;
      }
    };
    stack(L, 344, 168);
    stack(R, 1108, 168);
    return out;
  };
}

export function makeConsoleFrame(ui, st, jelly) {
  const labels = makeLabels(st, jelly);
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
      pressure: s.pressure,
      thrust: s.thrust,
      chart: chart(t),
      pulseHz: G.PULSE_HZ,
      siphonNote: s.siphonNote,
      battery: 88 - 0.05 * t,
      draw: 9 + 16 * pulse(s.p),
      cell: 3.6 + 0.0015 * (88 - 0.05 * t - 80),
      motor: 22 + 6 * tempAt(t),
      sway: s.sway,
      swayChip: s.swayChip,
      swayHot: s.swayHot,
      depth: s.depth,
      vs: s.vs,
      pitch: s.pitch,
      roll: s.roll,
      speed: speed(s.p),
      isolate: s.isolate,
      display: s.display,
      subsystems: s.subsystems,
      paused: s.paused ?? false,
      actions: 0,
      callouts: labels(s.opens, s.labels),
      cursor: s.cursor,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture, cfg}) => {
    const st = createJellyStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    ui.setBeats(BEATS.map((b) => b.t), DURATION);
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st, st.jelly);
    window.MJS = st;
    const DEV = cfg?.dev || null;
    return {
      resize,
      render(t) {
        const p = (t * G.PULSE_HZ) % 1;
        const beat = beatAt(t);
        const opens = {
          bell: openOf('bell', t),
          pump: openOf('pump', t),
          tentacle: openOf('tentacle', t),
          skirt: 0,
        };
        const explode = explodeAt(t);
        const disp = DEV?.display ? Object.fromEntries(DISPLAY.map((k) => [k, 1])) : {};
        const dy = 0.014 * Math.sin(t * 0.85) + 0.62 * ss(TL.depart, TL.depart + 1.7, t);
        const wake = (disp.bubble ? 0.8 : 0) + (beat.key === 'cruise' || beat.key === 'pump' ? 0.45 + 0.5 * flap(p) : 0.3 * flap(p));
        const cam = DEV?.cam ? {...camAt(t), ...DEV.cam} : camAt(t);
        st.frame(
          {p, bell: opens.bell, pump: opens.pump, tentacle: opens.tentacle, skirt: opens.skirt, explode, wake: Math.min(1, wake), wakeT: t, tilt: 0.06 * opens.bell, dy, bubbleT: t},
          {az: cam.az * D2R, el: cam.el * D2R, tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
        );
        const labelK = DEV ? 1 : 0;
        frame(t, {
          status: beat.status,
          mode: beat.mode,
          modeSub: modeSub(beat, opens, explode, p),
          phase: beat.phase,
          p,
          load: 0.9 * (pressureKPa(p) / 12) * flap(p),
          pressure: pressureKPa(p),
          thrust: thrustN(p),
          siphonNote: flap(p) > 0.15 ? '排气喷流中' : '吸入待机',
          sway: Array.from({length: 5}, (_, i) => tentSway(i, 14, p) / D2R),
          swayChip: flap(p) > 0.15 ? '拖曳中' : '随行',
          swayHot: flap(p) > 0.15,
          depth: depth(t),
          vs: vsAt(t),
          pitch: 1.2 * Math.sin(t * 0.6) + 2.4 * opens.bell,
          roll: -0.8 + 1.0 * Math.sin(t * 0.45 + 1),
          isolate: beat.key === 'pump' ? 'pump' : beat.key === 'bell' ? 'bell' : beat.key === 'tentacle' ? 'tentacle' : beat.key === 'explode' || beat.key === 'reassemble' || beat.key === 'depart' || beat.key === 'profile' ? 'hero' : 'hero',
          display: disp,
          subsystems: subsystems(p, opens, explode),
          labels: DEV ? 1 : ss(viewAt(t)[0] + 0.9, viewAt(t)[0] + 1.6, t),
          opens,
          cursor: DEV ? {x: -99, y: -99, press: false, ring: 0, ringX: 0, ringY: 0} : cursorAt(t),
        });
        return {};
      },
    };
  };
}
const pct = (x) => Math.round(x * 100);
const modeSub = (beat, opens, explode, p) => {
  if (beat.key === 'pump') return `泵核 · ${pct(opens.pump)}% 分离 · 喷口 ${pct(flap(p))}% 开`;
  if (beat.key === 'bell') return `钟体 · ${pct(opens.bell)}% 外翻`;
  if (beat.key === 'tentacle') return `触须 · ${pct(opens.tentacle)}% 散开`;
  if (beat.key === 'explode') return `拆解 · ${pct(explode)}%`;
  if (beat.key === 'reassemble') return `重组 · ${pct(1 - explode)}%`;
  if (beat.key === 'cruise') return `脉动 ${G.PULSE_HZ.toFixed(2)} HZ · 峰值推力 ${THRUST_PEAK.toFixed(0)} N`;
  if (beat.key === 'profile') return '深度剖面 · 推力随脉动';
  if (beat.key === 'depart') return '上浮离站';
  return '';
};
const subsystems = (p, opens, explode) => [
  [pistonStroke(p) > 0 ? '上行程' : '下行程', Math.abs(pistonStroke(p)) > 0.006],
  [opens.bell > 0.5 ? '外翻' : pulse(p) > 0.5 ? '收缩波' : '舒张', opens.bell > 0.5 || pulse(p) > 0.5],
  [opens.pump > 0.5 ? '分离' : flap(p) > 0.15 ? '排气中' : '吸入中', opens.pump > 0.5 || flap(p) > 0.15],
  [opens.tentacle > 0.5 ? '散开' : '拖曳中', opens.tentacle > 0.5],
  [pulse(p) > 0.5 ? '内收' : '舒张', false],
  ['在线', false],
];

export const run = () => runSim(DEFAULTS, makeFilm());
