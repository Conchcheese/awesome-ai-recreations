// 仿生沙虫 MK-X 互动页：影片的机器、舞台与控制台实时运行。装配体按钮跳到对应节拍，显示
// 开关自由切换，日志的播放键暂停、时间线可拖动。无人操作时自动巡览并带光标；点击、拖拽、
// 滚轮或按键即接管，25 秒无人操作后交还。拖拽环绕、滚轮缩放，画质分档适配小显卡。
import {warmComposer} from '../kit/warm.js';
import {createConsole, DISPLAY} from './console.js';
import {
  G, WAVE_HZ, PEAK_KPA, bulge, drillRpm, headTorque, drillPowerW, speed, jawAngle, sprayRate, frac, ringBulgePct,
} from './model.js';
import {BEATS, camAt, DURATION, depthAt, drillAngleAt, explodeAt, makeConsoleFrame, makeCursor, openOf, sAt, yAt} from './film.js';
import {createSandwormStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const CSS = (top) => `
html,body{background:#e9eef5;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:154px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #dfe7f0;border-radius:4px;background:rgba(250,251,253,.95);color:#1a2430;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#1e5fd6}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#7d8fa3;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const top = Number(document.body.dataset.top || 0);
  const style = document.createElement('style');
  style.textContent = CSS(top);
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const stage = createSandwormStage({canvas});
  const ui = createConsole(app);
  ui.setBeats(BEATS.map((b) => b.t), DURATION);
  const tourCursor = makeCursor(ui);
  const frameConsole = makeConsoleFrame(ui, stage);

  // ------------------------------------------------------------ 画质分档
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    stage.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    stage.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = '横屏手机以获得完整控制台';
  document.body.appendChild(note);

  // ------------------------------------------------------------ 状态
  let T = 0;
  let speedK = 1;
  let paused = false;
  const disp = Object.fromEntries(DISPLAY.map((k) => [k, {on: 0, t: -9}]));
  const off = {az: 0, el: 0, k: 1};
  const cam = {...camAt(0)};
  let ring = {t: -9, x: 0, y: 0};
  let actions = 0;
  const eased = (k, dur = 0.7) => {
    const d = disp[k];
    const x = ss(d.t, d.t + dur, T);
    return d.on ? x : 1 - x;
  };
  const pulse = (k) => {
    actions++;
    ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]};
  };

  // ------------------------------------------------------------ 巡览
  const AP = {on: true};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    paused = false;
    speedK = 1;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    AP.on = false;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  // ------------------------------------------------------------ 控件
  for (const b of BEATS) {
    ui.btn[b.key]?.addEventListener('click', () => {
      takeOver();
      pulse(b.key);
      T = b.t + 0.35;
      paused = false;
    });
  }
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      disp[k].on = disp[k].on ? 0 : 1;
      disp[k].t = T;
    });
  ui.btn.play.addEventListener('click', () => {
    takeOver();
    pulse('play');
    paused = !paused;
  });
  const slider = (x0, w, y, apply) => {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${x0 - 8}px`, top: `${y - 11}px`, width: `${w + 16}px`, height: '22px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      apply(clamp((x - x0) / w, 0, 1));
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  };
  slider(ui.TL.x, ui.TL.w, 809, (k) => {
    T = k * DURATION;
    paused = true;
  });
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (ui.btn[key]) ui.btn[key].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'e') ui.btn.exploded.click();
    else if (key === 'x') ui.btn.xray.click();
    else if (key === 't') ui.btn.turntable.click();
    else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az += ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -30, 62);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.4, 2.4);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ 每帧
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += paused ? 0 : dt * speedK;
    if (T >= DURATION) T -= DURATION;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let cursor;
    if (AP.on) {
      cursor = tourCursor(T);
    } else {
      if (T - lastInput > IDLE) startTour();
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }
    const tgt = camAt(T);
    const display = Object.fromEntries(DISPLAY.map((k) => [k, disp[k].on]));
    const turnK = display.turntable ? 1 : 0;
    const ttAz = turnK ? 14 * (T - disp.turntable.t) : 0;
    const k = 1 - Math.exp(-dt / (AP.on ? 0.18 : 0.45));
    const az = tgt.az + off.az + ttAz;
    cam.az += wrap(az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    cam.el = clamp(cam.el + off.el * (AP.on ? 0 : 1), -30, 62);
    cam.d *= AP.on ? 1 : off.k;
    const p = (T * WAVE_HZ) % 1;
    const explode = Math.max(explodeAt(T), eased('exploded', 0.8));
    const xray = Math.min(1, openOf('xray', T) + eased('xray', 0.6));
    const s = sAt(T);
    stage.frame(
      {p, s, y: yAt(T), spin: 330 * D2R * ss(TL_EX + 0.4, TL_RE + 0.7, T) + ttAz * D2R, explode, drillA: drillAngleAt(T), jaw: jawAngle(p), sprayK: sprayRate(p), t: T, xray, deposit: 0.05 * Math.min(1, s / 1.5) * (1 - explode)},
      {az: cam.az * D2R, el: cam.el * D2R, tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
    );
    const beat = BEATS.filter((b) => b.t <= T).pop();
    const opens = {xray: openOf('xray', T), head: openOf('head', T), wave: openOf('wave', T)};
    frameConsole(T, {
      status: beat.status,
      mode: beat.mode,
      modeSub: beat.modeSub ?? beat.mode,
      phase: beat.phase,
      p,
      s,
      load: 0.15 + 0.85 * (0.4 + 0.6 * (drillRpm(p) / G.RPM_MAX)) * (1 - explode * 0.8),
      rpm: drillRpm(p) * (1 - explode),
      torque: headTorque(p) * (1 - explode),
      powerKw: (drillPowerW(p) / 1000) * (1 - explode),
      speed: speed(p) * (1 - explode),
      jawNote: jawAngle(p) > 0.55 * G.JAW_MAX ? '颚环张合中' : '颚环闭合',
      rings: Array.from({length: G.RING_N}, (_, i) => ringBulgePct(i, p)),
      waveHot: bulge(frac(p)) > 0.4,
      depth: depthAt(T) * (1 - explode),
      vs: -(yAt(T + 0.05) - yAt(T - 0.05)) / 0.1,
      pitch: 2.4 * bulge(frac(p + 0.2)) - 1.6 + (explode > 0.3 ? 4 : 0),
      isolate: beat.key === 'hero' || beat.key === 'explode' || beat.key === 'reassemble' || beat.key === 'depart' ? 'hero' : beat.key,
      display,
      subsystems: subsLive(p, explode),
      paused: AP.on ? false : paused,
      actions,
      labels: eased('labels', 0.5) * ss(beat.t + 0.9, beat.t + 1.6, T),
      opens,
      cursor,
    });
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>自动巡览 · 点击接管' : '▶ 恢复巡览';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  warmComposer(stage.renderer, stage.composer, stage.scene, stage.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {stage, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }};

  const TL_EX = BEATS.find((b) => b.key === 'explode').t;
  const TL_RE = BEATS.find((b) => b.key === 'reassemble').t;
  function subsLive(p, explode) {
    return [
      [explode > 0.5 ? '拆解悬停' : drillRpm(p) > G.RPM_IDLE + 2 ? '钻进中' : '低速空转', drillRpm(p) > G.RPM_IDLE + 2 && explode < 0.5],
      [jawAngle(p) > 0.55 * G.JAW_MAX ? '张合中' : '闭合', jawAngle(p) > 0.55 * G.JAW_MAX],
      [bulge(frac(p)) > 0.4 ? '波峰加载' : '传播中', bulge(frac(p)) > 0.4],
      [sprayRate(p) > 0.4 ? '喷沙中' : '待机', sprayRate(p) > 0.4],
      ['航向推算中', false],
      [explode > 0.5 ? '升场保持' : '埋深保持', explode < 0.5],
    ];
  }
}
