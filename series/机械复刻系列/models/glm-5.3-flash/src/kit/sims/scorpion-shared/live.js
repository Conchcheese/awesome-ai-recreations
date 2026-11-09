// 机械蝎子 Telson SC-8 互动页：影片里的机器、影棚和控制台实时运行。六个装配体按钮把巡览
// 跳到对应的拍，四个显示开关自由toggle，日志里的播放键暂停、时间线可拖；无人操作时巡览
// 自动播放并带操作员光标，任意点击/拖动/滚轮/按键即接管，静默 25 s 后交还。拖动环绕、
// 滚轮缩放，画质档位随小显卡自动降级。
import {warmComposer} from '../kit/warm.js';
import {createConsole, DISPLAY} from './console.js';
import {G, MODE_NAME, clawOpenDeg, contacts, gaitStats, modeOf, pAt, settleK, tailTipSpeed, archK} from './model.js';
import {BEATS, camAt, DURATION, explodeAt, makeConsoleFrame, makeCursor, openOf} from './film.js';
import {createScorpionStage} from './stage.js';

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
html,body{background:#e8edf3;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:154px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #d8e1ea;border-radius:4px;background:rgba(250,252,254,.95);color:#1a2430;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
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
  const st = createScorpionStage({canvas});
  const ui = createConsole(app);
  ui.setBeats(BEATS.map((b) => b.t), DURATION);
  const tourCursor = makeCursor(ui);
  const frameConsole = makeConsoleFrame(ui, st, st.scorp);

  // ------------------------------------------------------------ 画质档位
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

  // ------------------------------------------------------------ 状态
  let T = 0;
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

  // ------------------------------------------------------------ 控制
  for (const b of BEATS) {
    ui.btn[b.key]?.addEventListener('click', () => {
      takeOver();
      pulse(b.key);
      T = b.t + 0.35; // 落在拍点之后，让该拍状态生效
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
    const asm = {1: 'hero', 2: 'claw', 3: 'tail', 4: 'leg', 5: 'head', 6: 'shell'}[key];
    if (asm) ui.btn[asm].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'e') ui.btn.exploded.click();
    else if (key === 't') ui.btn.turntable.click();
    else if (key === 'g') ui.btn.gait.click();
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
    T += paused ? 0 : dt;
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
    // 脚本拥有机器状态；访客拥有相机与开关
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
    const explode = Math.max(explodeAt(T), eased('exploded', 0.8));
    const opens = {leg: openOf('leg', T), claw: openOf('claw', T), tail: openOf('tail', T), explode};
    const beat = BEATS.filter((b) => b.t <= T).pop();
    const isoKey = beat.key === 'leg' ? 'leg' : beat.key === 'claw' ? 'claw' : beat.key === 'tail' ? 'tail' : 'hero';
    const isoK = beat.key === 'leg' ? opens.leg : beat.key === 'claw' ? opens.claw : opens.tail;
    const demo = opens.claw * (beat.key === 'claw' ? 1 : 0);
    const gaitK = Math.min(1, (display.gait ? eased('gait', 0.5) : 0) + (beat.key === 'gait' ? 1 : 0));
    const isoOn = AP.on ? isoKey : beat.key === 'leg' || beat.key === 'claw' || beat.key === 'tail' ? isoKey : 'hero';
    st.frame(
      {p: pAt(T, BEATS[BEATS.length - 1].t), settleF: explode, explode, isoKey: isoOn, isoK, gaitK, demo},
      {az: cam.az * (Math.PI / 180), el: cam.el * (Math.PI / 180), tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
    );
    const p = pAt(T, BEATS[BEATS.length - 1].t);
    const cs = contacts(p, {settle: explode});
    frameConsole(T, {
      status: beat.status,
      mode: MODE_NAME[modeOf(p)],
      modeSub: beat.modeSub ?? beat.mode,
      phase: beat.phase,
      p,
      demo,
      opts: {settle: explode},
      load: tailTipSpeed(p) / tailTipSpeed(G.WHIP_T0 + G.WHIP_WIN / 2),
      gaitHz: gaitStats().hz * (1 - Math.max(settleK(p), explode)),
      stanceN: cs.filter(Boolean).length,
      pattern: cs.filter(Boolean).length === 8 ? '支撑 · 8 足' : '交替 · 2 组',
      tailState: tailTipSpeed(p) > 0.35 ? '甩击中' : archK(p) > 0.5 ? '拱起' : '锁定',
      clawMode: clawOpenDeg(p, demo) <= 6 ? '咬合' : clawOpenDeg(p, demo) > 34 ? '张开' : '保持',
      isolate: isoOn === 'hero' ? 'hero' : isoOn,
      display,
      subsystems: subsLive(p, cs, opens, explode),
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
  // 所有着色器在首帧前一次性并行编译（kit/warm.js）
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }};

  function subsLive(p, cs, opens, explode) {
    const guard = archK(p) > 0.5;
    return [
      [guard ? '警戒中' : '跟踪中', guard],
      [opens.claw > 0.5 ? '演示中' : clawOpenDeg(p) > 34 ? '张开' : '待命', opens.claw > 0.5],
      [explode > 0.3 ? '分离' : '密封', explode > 0.3],
      [cs.filter(Boolean).length === 8 ? '8 / 8 在线' : '交替支撑', false],
      [tailTipSpeed(p) > 0.35 ? '甩击中' : guard ? '拱起' : '锁定', tailTipSpeed(p) > 0.35],
      [tailTipSpeed(p) > 0.9 ? '击发' : '待命', tailTipSpeed(p) > 0.9],
    ];
  }
}
