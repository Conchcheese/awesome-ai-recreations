// MELLIS HB-7, the film: the machine (geometry.js) over the studio (stage.js) under the
// console (console.js). The operator walks the tour — hover, the left wing's stroke+twist,
// the thorax drive, the lift readout, the ballast trim, the teardown on a turntable, the
// rebuild and the departure — and every beat time comes from ../bee-film/timeline.json,
// never a typed number. render(t) is a pure function of t (flap phase = t × SCREEN_HZ).
import {runSim} from '../../../../../../shared/mechanical/kit/sims/kit/runtime.js';
import {createConsole, ASSEMBLIES, DISPLAY} from './console.js';
import {createBeeStage} from './stage.js';
import {G, SCREEN_HZ, strokeAngle, twistAngle, liftN, liftTrace, liftPeak, batteryPct, drawW, cellV, motorC, legLoad, altMm, vsMmS, pitchDeg, rollDeg, airspeed} from './model.js';
import TL from '../bee-film/timeline.json' with {type: 'json'};
import * as THREE from 'three';
const V3 = THREE.Vector3;

export const DURATION = TL.duration;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: '机械蜜蜂 Mellis HB-7', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ the tour, beat times from timeline.json
export const BEATS = [
  {key: 'hover', t: TL.hover, view: 'hero', spot: 'hero', status: '悬停', mode: '悬停巡览', phase: '自动 · 悬停巡览'},
  {key: 'wing', t: TL.wing, view: 'wing', spot: 'wings', status: '翼在拍打', mode: '单翼特写', phase: '操作员 · 隔离左翼'},
  {key: 'drive', t: TL.drive, view: 'drive', spot: 'thorax', status: '传动运转', mode: '传动特写', phase: '操作员 · 隔离胸驱动'},
  {key: 'lift', t: TL.lift, view: 'lift', spot: 'hero', status: '升力读数', mode: '升力分析', phase: '自动 · 升力-相位'},
  {key: 'ballast', t: TL.ballast, view: 'ballast', spot: 'abdomen', status: '配重调姿', mode: '配重俯仰', phase: '操作员 · 腹部配重'},
  {key: 'explode', t: TL.explode, view: 'explode', spot: 'hero', status: '整机拆解', mode: '整机拆解', phase: '操作员 · 整机拆解'},
  {key: 'reassemble', t: TL.reassemble, view: 'reassemble', spot: 'hero', status: '重组中', mode: '重组', phase: '操作员 · 重组'},
  {key: 'depart', t: TL.depart, view: 'depart', spot: 'hero', status: '离站中', mode: '离场', phase: '自动 · 离场'},
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
/** a beat's open amount: eases in at its time, eases out when the next beat starts */
export const openOf = (key, t) => {
  const b = BEATS.find((x) => x.key === key).t;
  const nx = nextT(key);
  return ss(b, b + 0.85, t) * (1 - ss(nx, nx + 0.6, t));
};
export const explodeAt = (t) => ss(TL.explode, TL.explode + 1.5, t) * (1 - ss(TL.reassemble, TL.reassemble + 1.3, t));

// ------------------------------------------------------------ views (target relative to the machine), u = seconds on
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 0, tz: 0, az: 36 + 2 * u, el: 14, d: 0.33, sx: 0, sy: -12}),
  wing: (u) => ({tx: 0.03, ty: 0.012, tz: 0.006, az: 32 + 3 * u, el: 10, d: 0.16, sx: 0, sy: -6}),
  drive: (u) => ({tx: 0.002, ty: -0.003, tz: 0.0, az: 142 + 3 * u, el: 2, d: 0.13, sx: 0, sy: -4}),
  lift: (u) => ({tx: 0, ty: 0, tz: 0, az: 52 + 2 * u, el: 14, d: 0.42, sx: 0, sy: -8}),
  ballast: (u) => ({tx: 0, ty: -0.004, tz: -0.028, az: 208 + 3 * u, el: -6, d: 0.13, sx: 0, sy: 4}),
  explode: (u) => ({tx: 0, ty: 0.004, tz: 0, az: 36, el: 22, d: 0.62, sx: 0, sy: -12}),
  reassemble: (u) => ({tx: 0, ty: 0, tz: 0, az: 36, el: 17, d: 0.5, sx: 0, sy: -14}),
  depart: (u) => ({tx: 0, ty: 0.006, tz: 0, az: 30 + 4 * u, el: 24, d: 0.62, sx: 0, sy: -10}),
};
const VIEWS = BEATS.map((b) => [b.t, b.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  o.d += Math.max(0, Math.max(a.d, b.d) + 0.14 * swing - o.d) * Math.sin(Math.PI * k);
  return o;
};
export const camAt = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0]);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.5, t);
  const o = k >= 1 ? {...cur} : blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]), cur, k);
  // the teardown's 330° turntable ride, read from the timeline (zero outside the window)
  o.az += 330 * ss(TL.explode + 0.4, TL.reassemble + 0.7, t);
  return o;
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ panels: every number from the model
const CHART = liftTrace();
const CHART_MAX = liftPeak().L * 1.18;
const TIP_PATH = (() => {
  const A = G.STROKE_AMP;
  const T = G.TWIST_AMP;
  return Array.from({length: 49}, (_, i) => [strokeAngle(i / 48) / A, twistAngle(i / 48) / T]);
})();
const tipNow = (p) => [strokeAngle(p) / G.STROKE_AMP, twistAngle(p) / G.TWIST_AMP];
const pct = (x) => Math.round(x * 100);
const modeSub = (beat, opens, explode, ballast, p) => {
  if (beat.key === 'wing') return `拍打 ${((Math.abs(strokeAngle(p)) * 180) / Math.PI).toFixed(0)}° · 扭转 ${((twistAngle(p) * 180) / Math.PI).toFixed(0)}°`;
  if (beat.key === 'drive') return `曲柄 1 圈/冲程 · 齿比 ${(G.GEAR_DRIVE / G.GEAR_PINION).toFixed(2)}`;
  if (beat.key === 'lift') return `峰 ${(liftPeak().L * 1e3).toFixed(2)} mN · 下拍中段`;
  if (beat.key === 'ballast') return `配重前滑 ${(G.BALLAST_MM * ballast).toFixed(1)} mm · 俯仰 +${pitchDeg(0, ballast).toFixed(2)}°`;
  if (beat.key === 'explode') return `拆解 · ${pct(explode)}%`;
  if (beat.key === 'reassemble') return `重组 · ${pct(1 - explode)}%`;
  if (beat.key === 'depart') return '爬升离站';
  return `真实 ${G.FLAP_HZ} HZ · 屏上慢放 1/${Math.round(1 / G.DISPLAY_SCALE)}`;
};
const subsystems = (p, opens, explode, ballast) => [
  ['稳像中', false],
  [explode > 0.5 ? '分离' : opens.drive > 0.5 ? '特写中' : '自由', explode > 0.5 || opens.drive > 0.5],
  [explode > 0.5 ? '停转' : '运转中', explode > 0.5],
  [explode > 0.5 ? '分离' : '拍打中', explode <= 0.5],
  [explode > 0.5 ? '分离' : '收拢', explode > 0.5],
  [explode > 0.5 ? '分离' : ballast > 0.5 ? '配重前滑' : '供电中', explode > 0.5 || ballast > 0.5],
];

// ------------------------------------------------------------ the operator's pointer
const REST = [[940, 210], [800, 640], [1020, 250], [840, 600]];
export function makeCursor(ui) {
  const EV = BEATS.filter((b) => b.t > 0).map((b) => ({t: b.t, spot: ui.spots[b.spot] ?? ui.spots.hero}));
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

// ------------------------------------------------------------ the labels: parts of the machine, in the machine's frame
const PARTS = [
  {name: '光学头', sub: '2 × 4 毫米镜头 · 稳像', at: new V3(0, 0.006, 0.032), gate: () => 1},
  {name: '颈轴承', sub: '3 自由度 · 阻尼环', at: new V3(0, 0.002, 0.022), gate: () => 1},
  {name: '翼前缘梁', sub: '拍打 ±70°', at: (bee) => {
    const th = strokeAngle(bee.out.p);
    return new V3(0.017 + Math.cos(th) * 0.024, 0.006 + Math.sin(th) * 0.024, 0.013);
  }, gate: () => 1},
  {name: '翼膜', sub: '双面 · 5 翼脉', at: (bee) => {
    const th = strokeAngle(bee.out.p);
    return new V3(0.017 + Math.cos(th) * 0.038, 0.006 + Math.sin(th) * 0.038, -0.004);
  }, gate: (o) => Math.max(o.wing, 0.5)},
  {name: '胸驱动', sub: '14/34 齿 · 曲柄连杆', at: new V3(0.006, 0.004, 0.005), gate: (o) => Math.max(o.drive, 0.55)},
  {name: '腹部配重舱', sub: '滑轨 ±3 毫米', at: new V3(0, -0.004, -0.032), gate: (o) => Math.max(o.ballast, 0.5)},
  {name: '电池 2 芯', sub: '3.70 V · 供电中', at: new V3(0, 0.004, -0.03), gate: (o) => Math.max(o.ballast, 0.4)},
  {name: '足 · 收拢悬置', sub: '6 路舵机', at: new V3(0.013, -0.016, 0.002), gate: () => 1},
];
export function makeLabels(st, bee) {
  const v = new V3();
  return (opens, o) => {
    if (o < 0.02) return [];
    bee.root.updateWorldMatrix(true, false);
    const pts = PARTS.map((part) => {
      v.copy(typeof part.at === 'function' ? part.at(bee) : part.at).applyMatrix4(bee.root.matrixWorld);
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

export function makeConsoleFrame(ui, st, bee) {
  const labels = makeLabels(st, bee);
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
      freq: G.FLAP_HZ,
      lift: liftN(s.p),
      chart: CHART,
      chartMax: CHART_MAX,
      chartP: s.p,
      slow: Math.round(1 / G.DISPLAY_SCALE),
      freqScreen: SCREEN_HZ,
      battery: batteryPct(t),
      draw: drawW(s.p),
      cell: cellV(t),
      motor: motorC(t),
      wingBars: s.wingBars,
      tipPath: TIP_PATH,
      tipNow: tipNow(s.p),
      legs: s.legs,
      alt: s.alt,
      vs: s.vs,
      pitch: s.pitch,
      roll: s.roll,
      speed: s.speed,
      isolate: s.isolate,
      display: s.display,
      subsystems: s.subsystems,
      paused: s.paused ?? false,
      actions: s.actions ?? 0,
      callouts: labels(s.opens, s.labels),
      cursor: s.cursor,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture, cfg}) => {
    const st = createBeeStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    ui.setBeats(BEATS.map((b) => b.t), DURATION);
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st, st.bee);
    window.BEE = st;
    const DEV = cfg?.dev || null;
    return {
      resize,
      render(t) {
        const p = (t * SCREEN_HZ) % 1; // the screen plays the stroke at 1/50 time
        const beat = beatAt(t);
        const opens = {
          wing: openOf('wing', t),
          drive: openOf('drive', t),
          ballast: openOf('ballast', t),
        };
        const explode = explodeAt(t);
        const disp = DEV?.display ? Object.fromEntries(DISPLAY.map((k) => [k, 1])) : {};
        const ballast = opens.ballast;
        const dy = 0.004 * Math.sin(t * 0.9) + 0.05 * explode + 0.5 * ss(TL.depart, TL.depart + 2.2, t);
        const cam = DEV?.cam ? {...camAt(t), ...DEV.cam} : camAt(t);
        st.frame(
          {p, ballast, explode, tipTrace: disp.tiptrace, t, dy, pitchTilt: -1.4 * D2R * ballast, shadowAz: t * 0.07, wingApart: opens.wing * 0.9},
          {az: cam.az * D2R, el: cam.el * D2R, tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
        );
        const liftNow = liftN(p);
        const strokePct = Math.abs(strokeAngle(p)) / G.STROKE_AMP;
        const twistPct = Math.abs(twistAngle(p)) / G.TWIST_AMP;
        const labelK = DEV ? 1 : ss(viewAt(t)[0] + 0.9, viewAt(t)[0] + 1.6, t);
        frame(t, {
          status: beat.status,
          mode: beat.mode,
          modeSub: modeSub(beat, opens, explode, ballast, p),
          phase: beat.phase,
          p,
          load: Math.min(1, liftNow / (liftPeak().L * 1.05)),
          wingBars: [strokePct, strokePct, 0.08 + 0.92 * twistPct, 0.08 + 0.92 * twistPct],
          legs: legLoad(p, t),
          alt: altMm(t, TL.depart),
          vs: vsMmS(t, TL.depart),
          pitch: pitchDeg(t, ballast),
          roll: rollDeg(t),
          speed: airspeed(t),
          isolate: beat.key === 'wing' ? 'wings' : beat.key === 'drive' ? 'thorax' : beat.key === 'ballast' ? 'abdomen' : beat.key === 'explode' || beat.key === 'reassemble' || beat.key === 'depart' ? 'hero' : 'hero',
          display: disp,
          subsystems: subsystems(p, opens, explode, ballast),
          labels: DEV ? 1 : labelK,
          opens,
          cursor: DEV ? {x: -99, y: -99, press: false, ring: 0, ringX: 0, ringY: 0} : cursorAt(t),
        });
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
