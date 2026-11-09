// 仿生沙虫 MK-X 影片：机器（geometry.js）+ 沙面（geometry-sand.js）+ 舞台（stage.js）+ 控制
// 台（console.js）。操作员走完整巡览：沙面主机位 → 沙下透视 → 头段钻芯 → 环段蠕动波 → 深度
// 剖面与轨迹 → 整机拆解（升出沙面 + 转台）→ 重组 → 钻回沙下离场。每个节拍时刻都来自
// ../sandworm-film/timeline.json，没有一个写死的数字。render(t) 是 t 的纯函数。
import {runSim} from '../../../../../../shared/mechanical/kit/sims/kit/runtime.js';
import {createConsole, ASSEMBLIES, ASM_LABEL, DISPLAY} from './console.js';
import {createSandwormStage} from './stage.js';
import {
  G, WAVE_HZ, SPEED_BASE, BODY_LEN, TOTAL_LEN, PEAK_KPA, ringArc, ringRadius, ringPhase, ringBulgePct, bulge,
  pressureKPa, drillRpm, headTorque, drillPowerW, speed, jawAngle, sprayRate, pathAt, frac, ss, clamp01,
} from './model.js';
import TL from '../sandworm-film/timeline.json' with {type: 'json'};

export const DURATION = TL.duration;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: '仿生沙虫 MK-X', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ssv = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ 巡览节拍（时刻来自 timeline.json）
export const BEATS = [
  {key: 'hero', t: TL.hero, view: 'hero', status: '钻进中', mode: '沙面主机位', phase: '自动 · 蠕动钻进'},
  {key: 'xray', t: TL.xray, view: 'xray', status: '透视中', mode: '沙下透视', phase: '操作员 · 沙板透明化'},
  {key: 'head', t: TL.head, view: 'head', status: '钻头特写', mode: '头段钻芯', phase: '操作员 · 头段特写'},
  {key: 'wave', t: TL.wave, view: 'wave', status: '蠕动波', mode: '环段蠕动波', phase: '操作员 · 沿身波传播'},
  {key: 'map', t: TL.map, view: 'map', status: '剖面跟踪', mode: '剖面与轨迹', phase: '操作员 · 高机位剖面'},
  {key: 'explode', t: TL.explode, view: 'explode', status: '整机拆解', mode: '整机拆解', phase: '操作员 · 升场拆解'},
  {key: 'reassemble', t: TL.reassemble, view: 'reassemble', status: '重组中', mode: '重组', phase: '操作员 · 重组'},
  {key: 'depart', t: TL.depart, view: 'depart', status: '离场中', mode: '钻回沙下', phase: '自动 · 离场下潜'},
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
/** 节拍开度：到点缓入，下一拍开始时缓出 */
export const openOf = (key, t) => {
  const b = BEATS.find((x) => x.key === key).t;
  const nx = nextT(key);
  return ssv(b, b + 0.85, t) * (1 - ssv(nx, nx + 0.6, t));
};
export const explodeAt = (t) => ssv(TL.explode, TL.explode + 1.5, t) * (1 - ssv(TL.reassemble, TL.reassemble + 1.3, t));

// ------------------------------------------------------------ 里程、钻芯转角：装载时按 240Hz 制表
const DT = 1 / 240;
export const TABLE = (() => {
  const n = Math.ceil((DURATION + 1) / DT) + 1;
  const s = new Float64Array(n);
  const ang = new Float64Array(n);
  let accS = 0;
  let accA = 0;
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    const ph = (t * WAVE_HZ) % 1;
    // 拆解期间停进，重组后段恢复，离场加力
    const hold = 1 - ssv(TL.explode - 0.3, TL.explode, t) * (1 - ssv(TL.reassemble + 1.0, TL.reassemble + 2.0, t));
    const boost = 1 + 0.8 * ssv(TL.depart, TL.depart + 2.2, t);
    accS += (speed(ph) * hold * boost * DT);
    accA += (drillRpm(ph) * (2 * Math.PI) / 60) * DT;
    s[i] = accS;
    ang[i] = accA;
  }
  return {dt: DT, n, s, a: ang};
})();
export const sAt = (t) => {
  const u = clamp01(t / TABLE.dt) * (TABLE.n - 1);
  const i = Math.min(TABLE.n - 2, Math.floor(u));
  return TABLE.s[i] + (TABLE.s[i + 1] - TABLE.s[i]) * (u - i);
};
export const drillAngleAt = (t) => {
  const u = clamp01(t / TABLE.dt) * (TABLE.n - 1);
  const i = Math.min(TABLE.n - 2, Math.floor(u));
  return TABLE.a[i] + (TABLE.a[i + 1] - TABLE.a[i]) * (u - i);
};

/** 埋深：巡航呼吸；拆解时整机升出沙面（y 由 lift 决定）；离场下潜加深 */
export const depthAt = (t) => G.DEPTH_CRUISE - 0.012 * Math.sin(t * 0.8) + 0.55 * ssv(TL.depart, TL.depart + 2.6, t);
export const yAt = (t) => {
  const outK = explodeAt(t);
  return -depthAt(t) * (1 - outK) + 1.12 * outK;
};

// ------------------------------------------------------------ 机位（目标相对虫体头部，u = 该拍已进行秒数）
export const VIEW_FN = {
  hero: (u) => ({tx: -0.7, ty: 0.0, tz: 0, az: 38 + 2 * u, el: 17, d: 5.2, sx: 0, sy: -16}),
  xray: (u) => ({tx: -1.4, ty: -0.1, tz: 0, az: 90, el: 7, d: 5.2, sx: 0, sy: -6}),
  head: (u) => ({tx: 0.16, ty: -0.04, tz: 0, az: 28 + 2 * u, el: -7, d: 1.75, sx: 0, sy: 6}),
  wave: (u) => ({tx: -1.5, ty: -0.05, tz: 0, az: 116 + 3 * u, el: 24, d: 2.95, sx: 0, sy: -8}),
  map: (u) => ({tx: -1.5, ty: 0, tz: 0, az: 60 + 2 * u, el: 58, d: 6.4, sx: 0, sy: -26}),
  explode: (u) => ({tx: -0.9, ty: 0.5, tz: 0, az: 36, el: 20, d: 6.8, sx: 0, sy: -20}),
  reassemble: (u) => ({tx: -0.9, ty: 0.3, tz: 0, az: 36, el: 17, d: 5.8, sx: 0, sy: -22}),
  depart: (u) => ({tx: -1.2, ty: 0, tz: 0, az: 52 + 4 * u, el: 19, d: 7.4, sx: 0, sy: -18}),
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
  const k = ssv(VIEWS[i][0], VIEWS[i][0] + 1.5, t);
  const o = k >= 1 ? {...cur} : blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]), cur, k);
  // 拆解转台的 330° 环绕，读自 timeline（窗外为零）
  o.az += 330 * ssv(TL.explode + 0.4, TL.reassemble + 0.7, t);
  return o;
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ 面板：每个数字都出自模型
const chart = (t) => {
  const out = [];
  for (let i = 0; i <= 40; i++) out.push(pressureKPa(((t - 1.2 + (i / 40) * 1.2) * WAVE_HZ) % 1));
  return out;
};

// ------------------------------------------------------------ 操作员光标
const REST = [[880, 210], [760, 650], [1030, 270], [830, 610]];
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
    const k = ssv(t0, t1, t);
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

// ------------------------------------------------------------ 深度剖面 svg（04 面板）
const profX = (m) => 115 + m * 34; // 沿身弧长（0 = 头，向尾为正）→ px
const profY = (d) => 12 - d * 100; // 埋深 → px
export function profileSvg(t, depthNow, p) {
  let h = '';
  // 沙层剖面
  const layers = [[0.02, -0.35, '#eef2f8'], [-0.35, -0.62, '#dfe8f2'], [-0.62, -0.98, '#c9d8ea']];
  for (const [a, b, c] of layers) h += `<rect x="4" y="${profY(a).toFixed(1)}" width="222" height="${(profY(b) - profY(a)).toFixed(1)}" fill="${c}"/>`;
  h += `<line x1="4" x2="226" y1="${profY(0)}" y2="${profY(0)}" stroke="#7d8fa3" stroke-width="1"/>`;
  // 深度标尺
  for (const d of [0, -0.5, -0.9]) h += `<line x1="4" x2="10" y1="${profY(d)}" y2="${profY(d)}" stroke="#7d8fa3" stroke-width="1"/><text x="12" y="${(profY(d) + 2.6).toFixed(1)}" font-size="6.4" fill="#7d8fa3" font-family="JetBrains Mono">${d.toFixed(1)} m</text>`;
  // 虫体轮廓：头锥 + 各节圆
  h += `<path d="M${profX(-0.15)} ${profY(-depthNow)} L${profX(0.42)} ${(profY(-depthNow) - 6).toFixed(1)} L${profX(0.42)} ${(profY(-depthNow) + 6).toFixed(1)} Z" fill="#1e5fd6"/>`;
  const crest = frac(p) * G.RING_N;
  for (let i = 0; i < G.RING_N; i++) {
    const x = profX(ringArc(i) - 0.4);
    const y = profY(-depthNow);
    const r = ringRadius(i, p) * 100;
    const crestK = Math.max(0, 1 - Math.abs(i - crest) / 2.2);
    h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${crestK > 0.55 ? '#1e5fd6' : '#3d8fe0'}" opacity="${(0.5 + 0.5 * crestK).toFixed(2)}"/>`;
  }
  h += `<rect x="4" y="${profY(-depthNow) - 26}" width="222" height="0.5" fill="none"/>`;
  // 波峰标记
  const cx = profX(frac(p) * BODY_LEN - 0.4);
  h += `<path d="M${cx.toFixed(1)} ${profY(0.02)} l3.2 5 h-6.4 Z" fill="#12aecb"/>`;
  return h;
}

// ------------------------------------------------------------ 行进轨迹 svg（05 面板）
const mapX = (x) => 6 + x * 46;
const mapY = (z) => 64 - z * 46;
export function trailSvg(s) {
  let path = '';
  const n = 48;
  const sNow = Math.max(0.001, s);
  for (let i = 0; i <= n; i++) {
    const a = pathAt((i / n) * sNow);
    path += `${i ? 'L' : 'M'}${mapX(a.x).toFixed(1)} ${mapY(a.z).toFixed(1)}`;
  }
  const head = pathAt(sNow);
  const tail = pathAt(Math.max(0, sNow - TOTAL_LEN));
  let h = '';
  for (let m = 0; m <= 4; m++) h += `<line x1="${mapX(m)}" x2="${mapX(m)}" y1="6" y2="66" stroke="#dfe7f0" stroke-width="1"/><text x="${mapX(m) - 3}" y="72" font-size="6.2" fill="#7d8fa3" font-family="JetBrains Mono">${m}</text>`;
  h += `<path d="${path}" fill="none" stroke="#3d8fe0" stroke-width="1.6"/>`;
  h += `<circle cx="${mapX(0)}" cy="${mapY(0)}" r="2" fill="none" stroke="#7d8fa3" stroke-width="1"/>`;
  h += `<circle cx="${mapX(head.x).toFixed(1)}" cy="${mapY(head.z).toFixed(1)}" r="3.4" fill="#1e5fd6"/>`;
  h += `<circle cx="${mapX(tail.x).toFixed(1)}" cy="${mapY(tail.z).toFixed(1)}" r="2.2" fill="#12aecb"/>`;
  return h;
}

// ------------------------------------------------------------ 标注：机器坐标系里的部件
import * as THREE from 'three';
const V3 = THREE.Vector3;
export function makeLabels(st, stage) {
  const v = new V3();
  const PARTS = [
    {name: '口缘颚环', sub: '8 颚瓣 · 24 针齿', at: (t) => stage.worldOf(sAt(t) + 0.12, 0.28, -0.1, 0), gate: (o) => Math.max(o.head, 0.4)},
    {name: '旋转钻芯', sub: '3 螺旋刃 · 液压马达', at: (t) => stage.worldOf(sAt(t) + 0.4, 0.05, 0.12, 0), gate: (o) => Math.max(o.head, 0.4)},
    {name: '环段体', sub: '14 节 · 蠕动波驱动', at: (t) => stage.worldOf(sAt(t) - 1.2, 0.05, 0.2, 0), gate: () => 1},
    {name: '蠕动波峰', sub: '波速 1.54 m/s', at: (t) => {
      const p = (t * WAVE_HZ) % 1;
      return stage.worldOf(sAt(t) - frac(p) * BODY_LEN, 0.02, 0.28, 0);
    }, gate: (o) => Math.max(o.wave, 0.35)},
    {name: '环带螺栓', sub: '每环 6 颗 · 共 84 颗', at: (t) => stage.worldOf(sAt(t) - 1.9, -0.1, 0.24, 0), gate: () => 1},
    {name: '行进沙脊', sub: '鼓胀顶起的移动沙脊', at: (t) => stage.worldOf(sAt(t) - 0.8, 0.14, 0, 0), gate: () => 1},
    {name: '排沙喷口', sub: '尾部弃沙输送', at: (t) => stage.worldOf(sAt(t) - TOTAL_LEN + 0.1, 0.0, -0.15, 0), gate: (o) => Math.max(o.wave, 0.4)},
    {name: '弃沙堆', sub: '行进沉积', at: (t) => stage.worldOf(sAt(t) + 0.85, 0.1, 0, 0), gate: () => 0.8},
  ];
  return (opens, o, t) => {
    if (o < 0.02) return [];
    const pts = PARTS.map((pp) => {
      v.copy(pp.at(t));
      return {p: pp, at: st.project(v.x, v.y, v.z), o: o * pp.gate(opens)};
    }).filter((x) => x.at && x.o > 0.03 && x.at[0] > 330 && x.at[0] < 1290 && x.at[1] > 140 && x.at[1] < 720);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 150;
      for (const c of col) {
        y = Math.max(y, Math.min(640, c.at[1] - 10));
        out.push({name: c.p.name, sub: c.p.sub, at: c.at, label: [x, y], w, o: c.o});
        y += 34;
      }
    };
    stack(L, 344, 168);
    stack(R, 1108, 168);
    return out;
  };
}

export function makeConsoleFrame(ui, stage) {
  const labels = makeLabels(stage, stage);
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
      rpm: s.rpm,
      torque: s.torque,
      chart: chart(t),
      waveHz: WAVE_HZ,
      jawNote: s.jawNote,
      powerKw: s.powerKw,
      battery: 91.2 - 0.08 * t,
      speed: s.speed,
      cell: 3.62 + 0.0012 * (91.2 - 0.08 * t),
      motor: 31 + 9 * (s.torque / 440),
      rings: s.rings,
      waveHot: s.waveHot,
      depth: s.depth,
      vs: s.vs,
      pitch: s.pitch,
      profile: profileSvg(t, s.depth, s.p),
      trail: trailSvg(s.s),
      isolate: s.isolate,
      display: s.display,
      subsystems: s.subsystems,
      paused: s.paused ?? false,
      actions: 0,
      callouts: labels(s.opens, s.labels, t),
      cursor: s.cursor,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture, cfg}) => {
    const stage = createSandwormStage({canvas});
    const resize = () => stage.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    ui.setBeats(BEATS.map((b) => b.t), DURATION);
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, stage);
    window.SWS = stage;
    const DEV = cfg?.dev || null;
    return {
      resize,
      render(t) {
        const p = (t * WAVE_HZ) % 1;
        const beat = beatAt(t);
        const opens = {
          xray: openOf('xray', t),
          head: openOf('head', t),
          wave: openOf('wave', t),
        };
        const explode = explodeAt(t);
        const disp = DEV?.display ? Object.fromEntries(DISPLAY.map((k) => [k, 1])) : {};
        const xray = Math.min(1, opens.xray + (disp.xray ? 1 : 0));
        const spin = 330 * D2R * ssv(TL.explode + 0.4, TL.reassemble + 0.7, t);
        const s = sAt(t);
        const st = {
          p,
          s,
          y: yAt(t),
          spin,
          explode,
          drillA: drillAngleAt(t),
          jaw: jawAngle(p),
          sprayK: sprayRate(p),
          t,
          xray,
          deposit: 0.05 * clamp01(s / 1.5) * (1 - explode),
        };
        const cam = DEV?.cam ? {...camAt(t), ...DEV.cam} : camAt(t);
        stage.frame(st, {az: cam.az * D2R, el: cam.el * D2R, tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy});
        frame(t, {
          status: beat.status,
          mode: beat.mode,
          modeSub: modeSub(beat, opens, explode, p),
          phase: beat.phase,
          p,
          s,
          load: 0.15 + 0.85 * (pressureKPa(p) / PEAK_KPA) * (0.4 + 0.6 * (drillRpm(p) / G.RPM_MAX)),
          rpm: drillRpm(p),
          torque: headTorque(p),
          powerKw: drillPowerW(p) / 1000,
          speed: speed(p) * (1 - explode),
          jawNote: jawAngle(p) > 0.55 * G.JAW_MAX ? '颚环张合中' : '颚环闭合',
          rings: Array.from({length: G.RING_N}, (_, i) => ringBulgePct(i, p)),
          waveHot: bulge(frac(p)) > 0.4,
          depth: depthAt(t) * (1 - explode),
          vs: (yAt(t + 0.05) - yAt(t - 0.05)) / 0.1 * -1,
          pitch: 2.4 * bulge(frac(p + 0.2)) - 1.6 + (explode > 0.3 ? 4 : 0),
          isolate: beat.key === 'hero' || beat.key === 'explode' || beat.key === 'reassemble' || beat.key === 'depart' ? 'hero' : beat.key,
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
  if (beat.key === 'xray') return `沙板透光 ${pct(opens.xray)}%`;
  if (beat.key === 'head') return `钻芯 ${Math.round(drillRpm(p))} rpm · 颚环 ${Math.round((jawAngle(p) * 180) / Math.PI)}°`;
  if (beat.key === 'wave') return `波峰距头端 ${(frac(p) * BODY_LEN).toFixed(2)} m`;
  if (beat.key === 'map') return `里程 ${sAt(beat.t).toFixed(2)} m`;
  if (beat.key === 'explode') return `拆解 ${pct(explode)}%`;
  if (beat.key === 'reassemble') return `重组 ${pct(1 - explode)}%`;
  if (beat.key === 'hero') return `前进 ${speed(p).toFixed(3)} m/s`;
  if (beat.key === 'depart') return '下潜离场';
  return '蠕动钻进中';
};
const subsystems = (p, opens, explode) => [
  [explode > 0.5 ? '拆解悬停' : drillRpm(p) > G.RPM_IDLE + 2 ? '钻进中' : '低速空转', drillRpm(p) > G.RPM_IDLE + 2 && explode < 0.5],
  [jawAngle(p) > 0.55 * G.JAW_MAX ? '张合中' : '闭合', jawAngle(p) > 0.55 * G.JAW_MAX],
  [bulge(frac(p)) > 0.4 ? '波峰加载' : '传播中', bulge(frac(p)) > 0.4],
  [sprayRate(p) > 0.4 ? '喷沙中' : '待机', sprayRate(p) > 0.4],
  ['航向推算中', false],
  [explode > 0.5 ? '升场保持' : '埋深保持', explode < 0.5],
];

export const run = () => runSim(DEFAULTS, makeFilm());
