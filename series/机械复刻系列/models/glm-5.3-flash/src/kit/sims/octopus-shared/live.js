// The Pelagos OC-8 as a page you drive: the film's machine, studio and console run in real
// time. The six ASSEMBLIES buttons jump the tour to their beat, the four DISPLAY toggles are
// free, the log's play button pauses and its timeline scrubs. Left alone the tour plays itself
// with the operator's cursor; a click, drag, wheel or key hands control over, and 25 s of
// quiet hands it back. Drag orbits, wheel zooms, and quality tiers step down for small GPUs.
import {warmComposer} from '../kit/warm.js';
import {createConsole, DISPLAY} from './console.js';
import {armCmd, armCurlPct, flap, pressureKPa, thrustN} from './model.js';
import {BEATS, camAt, DURATION, explodeAt, makeConsoleFrame, makeCursor, openOf} from './film.js';
import {createOctopusStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const CSS = (top) => `
html,body{background:#e9edee;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:154px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #d2dcdf;border-radius:4px;background:rgba(250,252,253,.95);color:#22282c;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#2f9fe0}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8794a0;text-transform:uppercase;display:none}
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
  const st = createOctopusStage({canvas});
  const ui = createConsole(app);
  ui.setBeats(BEATS.map((b) => b.t), DURATION);
  const tourCursor = makeCursor(ui);
  const frameConsole = makeConsoleFrame(ui, st, st.octo);

  // ------------------------------------------------------------ quality tiers
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
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
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

  // ------------------------------------------------------------ state
  let T = 0;
  let speed = 1;
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

  // ------------------------------------------------------------ the tour
  const AP = {on: true};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    paused = false;
    speed = 1;
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

  // ------------------------------------------------------------ controls
  for (const b of BEATS) {
    const key = b.key === 'arm' ? 'arm2' : b.key;
    ui.btn[key]?.addEventListener('click', () => {
      takeOver();
      pulse(key);
      T = b.t + 0.35; // land just after the beat so its state is set
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
    const asm = {1: 'hero', 2: 'optics', 3: 'mantle', 4: 'arm2', 5: 'siphon', 6: 'beak'}[key];
    if (asm) ui.btn[asm].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'e') ui.btn.exploded.click();
    else if (key === 'j') ui.btn.wake.click();
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

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += paused ? 0 : dt * speed;
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
    // the script owns the machine state; the visitor owns the camera and the toggles
    const cyc = T;
    const tgt = camAt(cyc);
    const display = Object.fromEntries(DISPLAY.map((k) => [k, disp[k].on]));
    const turnK = display.turntable ? 1 : 0;
    const ttAz = turnK ? 14 * (T - disp.turntable.t) : 0;
    const k = 1 - Math.exp(-dt / (AP.on ? 0.18 : 0.45));
    const az = tgt.az + off.az + ttAz;
    cam.az += wrap(az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    cam.el = clamp(cam.el + off.el * (AP.on ? 0 : 1), -30, 62);
    cam.d *= AP.on ? 1 : off.k;
    const explode = Math.max(explodeAt(cyc), eased('exploded', 0.8));
    const opens = {mantle: openOf('mantle', cyc), siphon: openOf('siphon', cyc), beak: openOf('beak', cyc), arm: openOf('arm', cyc)};
    const p = (cyc * 1.8) % 1;
    const tiltAmt = 0.85 * opens.beak * (1 - explode);
    st.frame(
      {
        p,
        mantle: opens.mantle,
        siphon: opens.siphon,
        beak: opens.beak,
        armApart: {arm: 1, k: opens.arm},
        armYield: Math.max(opens.mantle, opens.siphon * 0.6),
        explode,
        wake: Math.min(1, (display.wake ? 0.85 : 0) + 0.28 * flap(p)),
        wakeT: cyc,
        tilt: -tiltAmt,
        dy: 0.012 * Math.sin(cyc * 0.9) + 0.55 * ss(BEATS[BEATS.length - 1].t, BEATS[BEATS.length - 1].t + 1.6, cyc),
      },
      {az: cam.az * (Math.PI / 180), el: cam.el * (Math.PI / 180), tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
    );
    const beat = BEATS.filter((b) => b.t <= cyc).pop();
    frameConsole(cyc, {
      status: beat.status,
      mode: beat.mode,
      modeSub: beat.modeSub ?? beat.mode,
      phase: beat.phase,
      p,
      load: 0.9 * (pressureKPa(p) / 100) * flap(p),
      pressure: pressureKPa(p),
      thrust: thrustN(p),
      siphonNote: flap(p) > 0.15 ? 'SIPHON FLOWING' : 'SIPHON IDLE',
      curl: Array.from({length: 8}, (_, i) => armCurlPct(armCmd(i, p, {arm: 1, k: opens.arm}, Math.max(opens.mantle, opens.siphon * 0.6)))),
      depth: depthLive(cyc),
      vs: (depthLive(cyc + 0.05) - depthLive(cyc - 0.05)) / 0.1,
      pitch: -1.5 + tiltAmt * 68 + 1.2 * Math.sin(cyc * 0.7),
      roll: -0.9 + 1.1 * Math.sin(cyc * 0.5 + 1),
      isolate: beat.key === 'jet' || beat.key === 'explode' || beat.key === 'reassemble' || beat.key === 'depart' ? 'hero' : beat.key === 'arm' ? 'arm2' : beat.key,
      display,
      subsystems: subsLive(cyc, p),
      paused: AP.on ? false : paused,
      actions,
      labels: eased('labels', 0.5) * ss(BEATS.filter((b) => b.t <= cyc).pop().t + 0.9, BEATS.filter((b) => b.t <= cyc).pop().t + 1.6, cyc),
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
  // every shader compiles at once off the main thread before the first frame (kit/warm.js)
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }};

  function depthLive(t) {
    return 12.42 - 0.09 * ss(0, DURATION, t) - 0.015 * Math.sin(t * 0.8);
  }
  function subsLive(t, p) {
    const m = openOf('mantle', t) > 0.5;
    const s = openOf('siphon', t) > 0.5;
    const bk = openOf('beak', t) > 0.5;
    const ap = openOf('arm', t) > 0.5;
    return [
      ['TRACKING', false],
      [m ? 'OPEN' : 'SEALED', m],
      [m ? 'EXPANDED' : 'RUNNING', m],
      [ap ? 'R2 APART' : '8 / 8 LIVE', ap],
      [s ? 'OPEN' : flap(p) > 0.15 ? 'FLOWING' : 'IDLE', s],
      [bk ? 'OPEN' : 'SEALED', bk],
    ];
  }

}
