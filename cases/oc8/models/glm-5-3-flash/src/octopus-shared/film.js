// PELAGOS OC-8, the film: the machine (geometry.js) over the studio (stage.js) under the
// console (console.js). The operator walks the tour — jet cycle, optics, the mantle opening,
// the siphon, one arm uncurling, the beak, the teardown on a turntable, the rebuild and the
// departure — and every beat time comes from ../octopus-film/timeline.json, never a typed
// number. render(t) is a pure function of t.
import {runSim} from '../../../../../../shared/mechanical/kit/sims/kit/runtime.js';
import {createConsole, ASSEMBLIES, ASM_LABEL, DISPLAY} from './console.js';
import {createOctopusStage} from './stage.js';
import {G, THRUST_PEAK, flap, pressureKPa, pulse, thrustN, speed, armCmd, armCurlPct} from './model.js';
import TL from '../octopus-film/timeline.json' with {type: 'json'};

export const DURATION = TL.duration;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: '机械章鱼 OC-8', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ the tour, beat times from timeline.json
export const BEATS = [
  {key: 'jet', t: TL.jet, view: 'hero', status: '喷射中', mode: '喷射循环', phase: '自动 · 喷射循环'},
  {key: 'optics', t: TL.optics, view: 'optics', status: '跟踪中', mode: '光学跟踪', phase: '操作员 · 隔离光学'},
  {key: 'mantle', t: TL.mantle, view: 'mantle', status: '外套膜张开', mode: '外套膜张开', phase: '操作员 · 隔离外套膜'},
  {key: 'siphon', t: TL.siphon, view: 'siphon', status: '虹吸张开', mode: '虹吸张开', phase: '操作员 · 隔离虹吸'},
  {key: 'arm', t: TL.arm, view: 'arm', status: 'R2 臂分离', mode: 'R2 臂分离', phase: '操作员 · 隔离 R2 臂'},
  {key: 'beak', t: TL.beak, view: 'beak', status: '喙张开', mode: '喙张开', phase: '操作员 · 隔离喙'},
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
/** a beat's open amount: eases in at its time, eases out when the next beat starts */
export const openOf = (key, t) => {
  const b = BEATS.find((x) => x.key === key).t;
  const nx = nextT(key);
  return ss(b, b + 0.85, t) * (1 - ss(nx, nx + 0.6, t));
};
export const explodeAt = (t) => ss(TL.explode, TL.explode + 1.5, t) * (1 - ss(TL.reassemble, TL.reassemble + 1.3, t));

// ------------------------------------------------------------ views (target relative to the machine), u = seconds on
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 0.02, tz: 0, az: 36 + 2 * u, el: 15, d: 2.5, sx: 0, sy: -26}),
  optics: (u) => ({tx: 0, ty: 0.1, tz: 0.16, az: 16 + 2 * u, el: 12, d: 1.18, sx: 0, sy: -14}),
  mantle: (u) => ({tx: 0, ty: 0.04, tz: 0, az: 88 + 3 * u, el: 50, d: 1.72, sx: 0, sy: -8}),
  siphon: (u) => ({tx: 0, ty: -0.02, tz: -0.26, az: 225 + 2 * u, el: 4, d: 0.98, sx: 0, sy: -8}),
  arm: (u) => ({tx: 0.34, ty: 0.0, tz: 0.26, az: 64 + 2 * u, el: 15, d: 1.35, sx: 0, sy: -16}),
  beak: (u) => ({tx: 0, ty: -0.12, tz: 0.02, az: 6 + 2 * u, el: -27, d: 1.3, sx: 0, sy: 10}),
  explode: (u) => ({tx: 0, ty: 0.04, tz: 0, az: 36, el: 22, d: 3.15, sx: 0, sy: -22}),
  reassemble: (u) => ({tx: 0, ty: 0.02, tz: 0, az: 36, el: 17, d: 2.6, sx: 0, sy: -24}),
  depart: (u) => ({tx: 0, ty: 0.1, tz: 0, az: 30 + 4 * u, el: 22, d: 3.4, sx: 0, sy: -20}),
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
  // the teardown's 330° turntable ride, read from the timeline (zero outside the window)
  o.az += 330 * ss(TL.explode + 0.4, TL.reassemble + 0.7, t);
  return o;
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ panels: every number from the model
const DT = 1 / 240;
const MOTOR = [0];
{
  let acc = 0;
  for (let i = 1; i * DT <= DURATION + 1; i++) {
    const p = (((i - 0.5) * DT) * G.PULSE_HZ) % 1;
    acc += (pulse(p) - acc) * (DT / 1.6); // trailing average, ~1.6 s
    MOTOR.push(acc);
  }
}
const motorAt = (t) => MOTOR[Math.min(MOTOR.length - 1, Math.round(t / DT))];
const depth = (t) => 12.42 - 0.09 * ss(0, DURATION, t) - 0.015 * Math.sin(t * 0.8);
const vsAt = (t) => (depth(t + 0.05) - depth(t - 0.05)) / 0.1;
const chart = (t) => {
  const out = [];
  for (let i = 0; i <= 40; i++) out.push(pressureKPa(((t - 1.2 + (i / 40) * 1.2) * G.PULSE_HZ) % 1));
  return out;
};

// ------------------------------------------------------------ the operator's pointer
const REST = [[900, 200], [760, 660], [1040, 260], [820, 620]];
export function makeCursor(ui) {
  const EV = BEATS.filter((b) => b.t > 0).map((b) => ({t: b.t, spot: ui.spots[b.key === 'arm' ? 'arm2' : b.key] ?? ui.spots.hero, label: b.key}));
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
import * as THREE from 'three';
const V3 = THREE.Vector3;
const PARTS = [
  {name: '光学阵列', sub: '2 × 82 毫米镜头 · IR 圈', at: new V3(0.1, 0.12, 0.15), gate: () => 1},
  {name: '外套膜壳瓣', sub: '8 瓣 · 铰接环', at: new V3(0.15, 0.2, -0.1), gate: (o) => Math.max(o.mantle, 0.55)},
  {name: '玻璃舷窗', sub: '齿轮机构藏于玻璃后', at: new V3(0, 0.05, 0.2), gate: () => 1},
  {name: '反应环', sub: '7 活塞 · 泵核', at: new V3(0.075, 0.02, 0.03), gate: (o) => o.mantle},
  {name: '脑核心', sub: '缆线束 · 控制', at: new V3(0, 0.09, -0.02), gate: (o) => o.mantle},
  {name: '臂毂', sub: '8 条臂链基座', at: new V3(-0.14, -0.075, 0.07), gate: () => 1},
  {name: 'R2 臂链', sub: '25 节 · 60 轮', at: (octo) => {
    // mid of arm R2's live chain, from the scratch the poser last filled
    const pts = octo.arms[1].pts;
    return new V3(pts[13 * 3], pts[13 * 3 + 1], pts[13 * 3 + 2]);
  }, gate: () => 1},
  {name: '虹吸', sub: '3 套筒 · 6 瓣喷口', at: new V3(0, 0.05, -0.24), gate: () => 1},
  {name: '双颚', sub: '之间是齿舌环', at: new V3(0.035, -0.2, 0.01), gate: (o) => Math.max(o.beak, 0.45)},
];
export function makeLabels(st, octo) {
  const v = new V3();
  return (opens, o) => {
    if (o < 0.02) return [];
    octo.root.updateWorldMatrix(true, false);
    const pts = PARTS.map((p) => {
      v.copy(typeof p.at === 'function' ? p.at(octo) : p.at).applyMatrix4(octo.root.matrixWorld);
      return {p, at: st.project(v.x, v.y, v.z), o: o * p.gate(opens)};
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

export function makeConsoleFrame(ui, st, octo) {
  const labels = makeLabels(st, octo);
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
      battery: 86.5 - 0.06 * t,
      draw: 15.5 + 7 * pulse(s.p),
      cell: 3.6 + 0.0014 * (86.5 - 0.06 * t),
      motor: 24 + 3.2 * motorAt(t),
      curl: s.curl,
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
    const st = createOctopusStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    ui.setBeats(BEATS.map((b) => b.t), DURATION);
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st, st.octo);
    window.OCS = st;
    const DEV = cfg?.dev || null;
    return {
      resize,
      render(t) {
        const p = (t * G.PULSE_HZ) % 1;
        const beat = beatAt(t);
        const opens = {
          mantle: openOf('mantle', t),
          siphon: openOf('siphon', t),
          beak: openOf('beak', t),
          arm: openOf('arm', t),
        };
        const explode = explodeAt(t);
        const disp = DEV?.display ? Object.fromEntries(DISPLAY.map((k) => [k, 1])) : {};
        const tiltAmt = 0.85 * opens.beak * (1 - explode); // the machine bows to show the beak
        const dy = 0.012 * Math.sin(t * 0.9) + 0.55 * ss(TL.depart, TL.depart + 1.6, t);
        const wake = (disp.wake ? 0.85 : 0) + (beat.key === 'jet' ? 0.4 + 0.5 * flap(p) : 0.28 * flap(p));
        const cam = DEV?.cam ? {...camAt(t), ...DEV.cam} : camAt(t);
        const apart = {arm: 1, k: opens.arm};
        const armYield = Math.max(opens.mantle, opens.siphon * 0.6);
        st.frame(
          {p, mantle: opens.mantle, siphon: opens.siphon, beak: opens.beak, armApart: apart, armYield, explode, wake: Math.min(1, wake), wakeT: t, tilt: -tiltAmt, dy},
          {az: cam.az * D2R, el: cam.el * D2R, tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
        );
        const labelK = DEV ? 1 : 0;
        frame(t, {
          status: beat.status,
          mode: beat.mode,
          modeSub: modeSub(beat, opens, explode),
          phase: beat.phase,
          p,
          load: 0.9 * (pressureKPa(p) / 100) * flap(p),
          pressure: pressureKPa(p),
          thrust: thrustN(p),
          siphonNote: flap(p) > 0.15 ? '虹吸喷流中' : '虹吸待机',
          curl: Array.from({length: 8}, (_, i) => armCurlPct(armCmd(i, p, apart, armYield))),
          depth: depth(t),
          vs: vsAt(t),
          pitch: -1.5 + tiltAmt * 68 + 1.2 * Math.sin(t * 0.7),
          roll: -0.9 + 1.1 * Math.sin(t * 0.5 + 1),
          isolate: beat.key === 'jet' || beat.key === 'explode' || beat.key === 'reassemble' || beat.key === 'depart' ? 'hero' : beat.key === 'arm' ? 'arm2' : beat.key,
          display: disp,
          subsystems: subsystems(p, opens, apart),
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
const modeSub = (beat, opens, explode) => {
  if (beat.key === 'mantle') return `外套膜 · ${pct(opens.mantle)}% 分离`;
  if (beat.key === 'siphon') return `虹吸 · ${pct(Math.max(opens.siphon, 0.42 * flap(0.42)))}% 伸出`;
  if (beat.key === 'arm') return `R2 臂 · ${pct(opens.arm)}% 展开`;
  if (beat.key === 'beak') return `喙 · ${pct(opens.beak)}% 分离`;
  if (beat.key === 'explode') return `拆解 · ${pct(explode)}%`;
  if (beat.key === 'reassemble') return `重组 · ${pct(1 - explode)}%`;
  if (beat.key === 'jet') return `脉冲 ${G.PULSE_HZ.toFixed(1)} HZ · 爆发推力 ${THRUST_PEAK.toFixed(0)} N`;
  if (beat.key === 'depart') return '驶离站位';
  return '光学阵列 · 跟踪中';
};
const subsystems = (p, opens, apart) => [
  ['跟踪中', false],
  [opens.mantle > 0.5 ? '张开' : '密封', opens.mantle > 0.5],
  [opens.mantle > 0.5 ? '展开' : '运转中', opens.mantle > 0.5],
  [apart.k > 0.5 ? 'R2 分离' : '8 / 8 在线', apart.k > 0.5],
  [opens.siphon > 0.5 ? '张开' : flap(p) > 0.15 ? '喷流中' : '待机', opens.siphon > 0.5],
  [opens.beak > 0.5 ? '张开' : '密封', opens.beak > 0.5],
];

export const run = () => runSim(DEFAULTS, makeFilm());
