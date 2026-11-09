// 六足机器人 HX-18 交互页：影片的机器、影棚与控制台实时运行。装配体按钮跳到对应拍，
// 显示开关自由，日志的播放键暂停、时间轴拖动。无人操作时自动巡览带光标；点击、拖拽、
// 滚轮或按键即接管，25 s 无人操作归还。机器状态（相位/位置/停机）直接用 film.js 的预
// 积分表，与影片逐帧一致，拖动时间轴也不漂移。
import {warmComposer} from '../../../../../../shared/mechanical/kit/sims/kit/warm.js';
import {createConsole, DISPLAY} from './console.js';
import {G, SPEED, contactOf, jointDeg, legTorques, powerW, voltV, bodyPitch, bodyRoll} from './model.js';
import {BEATS, beatAt, camAt, DURATION, explodeAt, gaitRowsAt, makeConsoleFrame, makeCursor, openOf, pAt, parkAt, rateAt, tempAt, worldXAt} from './film.js';
import {createHexapodStage} from './stage.js';

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
html,body{background:#eef2f7;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:154px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #dfe7f0;border-radius:4px;background:rgba(250,252,254,.96);color:#1a2430;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#1e5fd6}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#7d8fa3;text-transform:uppercase;display:none}
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
  const st = createHexapodStage({canvas});
  const ui = createConsole(app);
  ui.setBeats(BEATS.map((b) => b.t), DURATION);
  const tourCursor = makeCursor(ui);
  const frameConsole = makeConsoleFrame(ui, st, st.hex);

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

  // ------------------------------------------------------------ 控件
  // 装配体按钮跳到对应拍：整机→行走、传感头/脚垫→步态图、右中腿→腿特写、机身舱/电池舱→拆解
  const JUMP = {hero: 0, mast: TL_gait(), hull: TL_explode(), batt: TL_explode(), leg2: TL_leg(), foot: TL_joint()};
  function TL_gait() {
    return BEATS.find((b) => b.key === 'gait').t;
  }
  function TL_explode() {
    return BEATS.find((b) => b.key === 'explode').t;
  }
  function TL_leg() {
    return BEATS.find((b) => b.key === 'leg').t;
  }
  function TL_joint() {
    return BEATS.find((b) => b.key === 'joint').t;
  }
  for (const k of Object.keys(JUMP))
    ui.btn[k]?.addEventListener('click', () => {
      takeOver();
      pulse(k);
      T = JUMP[k] + 0.35;
      paused = false;
    });
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
    const asm = {1: 'hero', 2: 'hull', 3: 'mast', 4: 'batt', 5: 'leg2', 6: 'foot'}[key];
    if (asm) ui.btn[asm].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'e') ui.btn.exploded.click();
    else if (key === 'g') ui.btn.gait.click();
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
    const cyc = T;
    const tgt = camAt(cyc);
    const display = Object.fromEntries(DISPLAY.map((k) => [k, disp[k].on]));
    const turnK = display.turntable ? 1 : 0;
    const ttAz = turnK ? 14 * (cyc - disp.turntable.t) : 0;
    const k = 1 - Math.exp(-dt / (AP.on ? 0.18 : 0.45));
    const az = tgt.az + off.az + ttAz;
    cam.az += wrap(az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    cam.el = clamp(cam.el + off.el * (AP.on ? 0 : 1), -30, 62);
    cam.d *= AP.on ? 1 : off.k;
    const beat = beatAt(cyc);
    const explode = Math.max(explodeAt(cyc), eased('exploded', 0.8));
    const park = parkAt(cyc);
    const p = pAt(cyc);
    const opens = {leg: openOf('leg', cyc), joint: openOf('joint', cyc), gait: openOf('gait', cyc), top: openOf('top', cyc), explode, park};
    const isoK = Math.max(opens.leg, opens.joint, eased('exploded', 0.8) * 0) * (1 - explode);
    const jf = beat.key === 'leg' ? Math.min(2, Math.max(0, Math.floor(cyc - BEATS.find((b) => b.key === 'leg').t))) : -1;
    const gaitK = Math.max(opens.gait, display.gait ? eased('gait', 0.5) : 0, opens.top * 0.6) * (1 - explode);
    const legExplode = opens.joint * (1 - explode);
    st.frame(
      {p, park, worldX: worldXAt(cyc), isoK, jf, legExplode, explode, gaitK},
      {az: cam.az * (Math.PI / 180), el: cam.el * (Math.PI / 180), tx: cam.tx, ty: cam.ty, tz: cam.tz, d: cam.d, sx: cam.sx, sy: cam.sy},
    );
    const rate = rateAt(cyc);
    const opts = {park};
    const joints = jointDeg(p, opts);
    const torques = [];
    for (let i = 0; i < 6; i++) torques.push(Math.max(...legTorques(i, p, opts)));
    const stanceNow = park > 0.5 ? 6 : [0, 1, 2, 3, 4, 5].filter((i) => contactOf(i, p, park)).length;
    frameConsole(cyc, {
      status: beat.status,
      mode: beat.mode,
      modeSub: beat.modeSub ?? beat.mode,
      phase: beat.phase,
      p,
      speed: SPEED * rate,
      gaitHz: (1 / G.T_STEP) * rate,
      stanceN: stanceNow,
      power: powerW(p, opts),
      volt: voltV(p, cyc, opts),
      temp: tempAt(cyc),
      joints,
      torques,
      hotLeg: isoK > 0.5 ? 4 : -1,
      pitch: bodyPitch(p) * (180 / Math.PI),
      roll: bodyRoll(p) * (180 / Math.PI),
      isolate: isoK > 0.5 ? 'leg2' : 'hero',
      display,
      subsystems: [
        [park > 0.5 ? '停机' : explode > 0.3 ? '锁定' : '行走中', park > 0.5 || explode > 0.3],
        [jf >= 0 ? '焦点关节' : '18 / 18 在线', jf >= 0],
        [park > 0.5 ? '浮充' : '放电中', park > 0.5],
        ['跟踪中', false],
        [explode > 0.3 ? '离地' : `${stanceNow} / 6 触地`, explode > 0.3],
        [explode > 0.3 ? '拆解中' : '紧固', explode > 0.3],
      ],
      paused: AP.on ? false : paused,
      actions,
      labels: eased('labels', 0.5) * ss(beat.t + 0.9, beat.t + 1.6, cyc),
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
  // 着色器一次性并行预热（kit/warm.js），首帧不卡
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }};
}
