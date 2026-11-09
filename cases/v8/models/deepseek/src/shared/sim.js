// ============================================================================
// 01 · V8 发动机 — 组装层
// studio（宝石紫影棚） + engine（3D 装配） + hud（原作版式控制台） + 巡览导演 + 交互。
// frame(t) 是 t 的纯函数：影片页完全由 t 决定；互动页在 t 之上叠加用户状态。
// ============================================================================
import * as THREE from 'three';
import {createStudio} from '../../../../../../shared/mechanical/deepseek-kit/stage3d.js';
import {createHud, h} from '../../../../../../shared/mechanical/deepseek-kit/hud.js';
import {createAnnotations} from '../../../../../../shared/mechanical/deepseek-kit/annotate.js';
import {createDirector} from '../../../../../../shared/mechanical/deepseek-kit/tour.js';
import {clamp, damp} from '../../../../../../shared/mechanical/deepseek-kit/util.js';
import {buildEngine} from './engine.js';
import {createV8Hud, PLAYBACK_STEPS, playText} from './hud.js';
import {
  CYL, BANK, E, RPM, PLAYBACK, TOUR, pistonPose, telemetry, thetaAt, rpmAt,
  trackedCylinderAt, camKeyAt, camBeatAt, firingOrder, pressurePeak, HUDFMT,
} from './model.js';

const D2R = Math.PI / 180;
const CX = 1920 / 1600; // 原作屏幕偏移按 1600 设计，换算到 1920
const AXIS_Y = 0.115; // 曲轴轴线离地高度（m）
const DESIGN = {w: 1920, h: 1080};

/** 五次平滑 */
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

/* ---------------------------------------------------------------- 机位换算 */
const UP = new THREE.Vector3(0, 1, 0);
/** 原作（teardown）引擎坐标 → 本工程世界坐标：world = (−z, y+0.115, x) */
const tdToWorld = (v) => new THREE.Vector3(-v[2], v[1] + AXIS_Y, v[0]);

/**
 * 由原作机位参数生成 kit 机位：{tx,ty,tz,az,el,d,sx,sy,fov}
 * tx/ty/tz：原作目标（m）；az/el（°）；d（m）；sx/sy：屏幕偏移（1600×900 px）。
 */
function camPose({tx = 0, ty = 0.185, tz = -0.01, az = 46, el = 26, d = 1.5, sx = -24, sy = 6, fov = 34} = {}) {
  const A = az * D2R;
  const E = el * D2R;
  const target = tdToWorld([tx, ty, tz]);
  const pos = tdToWorld([tx + d * Math.cos(E) * Math.sin(A), ty + d * Math.sin(E), tz + d * Math.cos(E) * Math.cos(A)]);
  const fwd = target.clone().sub(pos).normalize();
  const right = fwd.clone().cross(UP).normalize();
  const up = right.clone().cross(fwd).normalize();
  const fpx = 540 / Math.tan((fov / 2) * D2R);
  const shift = right.multiplyScalar((-sx * CX * d) / fpx).add(up.multiplyScalar((sy * CX * d) / fpx));
  target.add(shift);
  pos.add(shift);
  return {pos: pos.toArray(), target: target.toArray(), fov};
}

/* ---------------------------------------------------------------- 镜头函数（照原作） */
const cylCentre = (c) => {
  const cy = CYL[c - 1];
  const B = BANK[cy.bank];
  return {x: 170 * B.b[0] * 0.001, y: 170 * B.b[1] * 0.001, z: cy.z * 0.001};
};
const VIEWS = {
  // 主机位环绕推进：3/4 俯视，引擎长轴 X，前端在画面左下
  open: (u) => {
    const k = smoother(u / 4.1);
    return camPose({az: 26 + 30 * k, el: 23 + 5 * k, d: 1.52 - 0.04 * k, ty: 0.16, sx: -58, sy: -62});
  },
  // 主机位：整机占画面高约 60%，不裁切
  hero: (u) => camPose({az: 52 + 5 * u, el: 28, d: 1.44, ty: 0.165, sx: -24, sy: -72}),
  // 缸列特写：贴到跟踪缸的缸头 / 气门室
  cyl: (u, c) => {
    const cy = CYL[c - 1];
    const B = BANK[cy.bank];
    const L = B.b[0] > 0;
    return camPose({
      tx: B.b[0] * 0.16, ty: 0.205, tz: cy.z * 0.001 * 0.95,
      az: (L ? 52 : -52) + (L ? 1 : -1) * 2.5 * u, el: 27 + 1.0 * u, d: 1.14, sx: L ? -30 : -104, sy: -62,
    });
  },
  // 气门室俯视：正上方看 V 谷两侧的 16 组弹簧 / 摇臂 / 凸轮
  valley: (u) => camPose({tx: 0, ty: 0.13, tz: 0, az: 2 + 4 * u, el: 78, d: 1.42, sx: -10, sy: -30}),
  side: (u) => camPose({tx: 0, ty: 0.17, tz: -0.03, az: 146 - 4 * u, el: 24 + 1 * u, d: 1.6, sx: -18, sy: -66}),
  front: (u) => camPose({tx: 0, ty: 0.16, tz: 0, az: -4 + 4 * u, el: 14 + 1.5 * u, d: 1.43, sx: -92, sy: -60}),
};

/* ---------------------------------------------------------------- 相机节拍（隔离判定用） */
const CAM_BEATS = [
  {t: 0, cam: 'open'}, {t: 3.5, cam: 'cyl'}, {t: 9.7, cam: 'valley'}, {t: 12.1, cam: 'hero'},
  {t: 14.7, cam: 'side'}, {t: 17.3, cam: 'front'}, {t: 19.9, cam: 'hero'}, {t: 22.5, cam: 'cyl'},
];
function camLocal(t) {
  let i = 0;
  while (i + 1 < CAM_BEATS.length && CAM_BEATS[i + 1].t <= t) i++;
  return {beat: CAM_BEATS[i], local: t - CAM_BEATS[i].t, prev: CAM_BEATS[i - 1]};
}

/* ---------------------------------------------------------------- 巡览拍表（26 s） */
const BEATS = [
  {t: 0, key: 'open', mode: '四冲程', title: 'V8 发动机', sub: '90° 十字曲轴 · 点火顺序 1-8-4-3-6-5-7-2', cam: VIEWS.open(0), spin: 46 * D2R},
  {t: 3.5, key: 'cyl1', mode: '单缸特写', title: '气缸 1', sub: '点火顺序第 1 位 · 90° V 型两列', cam: VIEWS.cyl(0, 1), spin: 4 * D2R},
  {t: 6.9, key: 'cyl6', mode: '跟踪切换', title: '气缸 6', sub: '点火顺序第 5 位 · 十字曲轴', cam: VIEWS.cyl(3.0, 6), spin: -4 * D2R},
  {t: 9.7, key: 'valley', mode: '气门室', title: '双顶置凸轮轴', sub: '半速 · 每缸 2 气门 · 升程 10.5 毫米', cam: VIEWS.valley(0), spin: 7 * D2R},
  {t: 12.1, key: 'rpm', mode: '转速', title: '700 → 2400', sub: '五次缓动 · 1.4 秒 · 回放 1/20', cam: VIEWS.hero(2.6), spin: 10 * D2R},
  {t: 14.7, key: 'side', mode: '侧面', title: '玻璃缸套', sub: '活塞行程 89 毫米 · 白色活塞', cam: VIEWS.side(0), spin: -6 * D2R},
  {t: 17.3, key: 'front', mode: '正面', title: '斜齿正时齿轮', sub: '24 : 72 · 凸轮轴半速', cam: VIEWS.front(0), spin: 5 * D2R},
  {t: 19.9, key: 'hero', mode: '主机位', title: 'V8 发动机', sub: '90° 十字曲轴 · 5.8 L', cam: VIEWS.hero(0), spin: 14 * D2R},
  {t: 22.5, key: 'cyl1b', mode: '跟踪回气缸 1', title: '气缸 1', sub: '点火顺序第 1 位 · 点火做功', cam: VIEWS.cyl(2.4, 1), spin: 5 * D2R},
];
const DURATION = 26;

/* ============================================================================ */
export function createSim({mode = 'live'} = {}) {
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.append(canvas);
  const studio = createStudio({canvas, shadowSize: 1.4, exposure: 1.0});
  studio.renderer.localClippingEnabled = true;
  studio.scene.environmentIntensity = 0.95;
  // 镜头侧补一盏柔光：让前端正时齿轮 / 缸头在 3/4 视角有高光
  const frontKey = new THREE.DirectionalLight(0xfff8ff, 1.75);
  frontKey.position.set(-2.2, 3.0, 2.6);
  studio.scene.add(frontKey);
  const fillL = new THREE.DirectionalLight(0xe9e1ff, 0.55);
  fillL.position.set(2.2, 1.4, 3.2);
  studio.scene.add(fillL);
  const rimL = new THREE.DirectionalLight(0xffffff, 1.35);
  rimL.position.set(1.2, 2.6, -3.0);
  studio.scene.add(rimL);
  studio.setSize(window.innerWidth, window.innerHeight);

  const hud = createHud(app);
  const engine = buildEngine({materials: studio.materials});
  studio.scene.add(engine.root);
  window.__ENGINE = engine; // 调试定位用（不影响运行）
  window.__STUDIO = studio;
  studio.setContactShadow(0.62, 0.5);
  studio.contact.material.color.set(0x413356);
  // 自绘柔和椭圆投影（确保机器「落地」）
  {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 8, 128, 128, 124);
    gr.addColorStop(0, 'rgba(52,38,86,0.55)');
    gr.addColorStop(0.42, 'rgba(60,44,98,0.30)');
    gr.addColorStop(1, 'rgba(60,44,98,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.22, 0.94),
      new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, opacity: 1}),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.015, 0.0013, 0.01);
    shadow.renderOrder = 0;
    studio.scene.add(shadow);
  }

  /* ---------------------------------------------------------- 状态 */
  const st = {
    theta: 12,
    rpm: RPM.idle,
    rpmTarget: RPM.idle,
    playIndex: 2,
    cut: 'glass',
    track: 1,
    view: 'hero',
    auto: true,
    tourStart: 0,
    tourT: 0,
    lastT: 0,
    now: 0,
    lastInput: 0,
    overlays: {callouts: 1, charge: 0, arrows: 0, isolate: 0, refract: 0, charts: 1},
  };
  const isFilm = mode === 'film';
  st.auto = true;
  st.tourStart = 0;

  /* ---------------------------------------------------------- HUD */
  const kick = () => {
    const s = window.__sim;
    if (s) s.setTime(s.time);
  };
  const setPlay = (i) => {
    st.playIndex = clamp(i, 0, PLAYBACK_STEPS.length - 1);
    kick();
  };
  const ui = createV8Hud({
    hud,
    on: {
      setView: (k) => {
        takeOver();
        st.view = k;
        if (isFilm) return;
        studio.tweenPose(VIEWS[k](0, st.track), 0.9);
        const sNow = window.__sim;
        if (sNow && sNow.paused) studio.update(2); // 截图/暂停态：立即落位
        kick();
      },
      setCut: (k) => {
        takeOver();
        st.cut = k;
        kick();
      },
      toggleOverlay: (k) => {
        takeOver();
        st.overlays[k] = st.overlays[k] ? 0 : 1;
        kick();
      },
      setCyl: (c) => {
        takeOver();
        st.track = c;
        if (st.view === 'cyl' && !isFilm) {
          studio.tweenPose(VIEWS.cyl(2.0, c), 0.9);
          const sNow = window.__sim;
          if (sNow && sNow.paused) studio.update(2);
        }
        kick();
      },
      setRpm: (v) => {
        takeOver();
        st.rpmTarget = clamp(v, RPM.liveMin, RPM.max);
        kick();
      },
      setPlay,
      togglePause: () => {
        const s = window.__sim;
        if (s) s.paused ? s.play() : s.pause();
        kick();
      },
      stepDeg: (d) => {
        takeOver();
        const s = window.__sim;
        if (s) s.pause();
        st.theta += d;
        kick();
      },
      resumeTour: () => startTour(),
    },
  });
  if (isFilm) {
    ui.refs.chip.style.display = 'none';
    hud.root.classList.add('film');
    studio.controls.enabled = false;
  }

  /* ---------------------------------------------------------- 3D 标注 */
  const ann = createAnnotations({hud, studio});
  const annState = {solo: -1, show: 1};
  const soloBank = () => (annState.solo >= 0 ? CYL[annState.solo].bank : 'L');
  const annCam = ann.add({
    getWorld: () => engine.anchors.camshaft(soloBank()),
    text: '凸轮轴', sub: '半速曲轴转速', side: 'right', dist: 286, dy: -142,
    visible: () => annState.show && (annState.solo >= 0 || ['hero', 'side', 'front'].includes(st.view)),
  });
  const annFly = ann.add({
    getWorld: () => engine.anchors.flywheel,
    text: '飞轮', sub: '储存脉冲', side: 'right', dist: 252, dy: -30,
    visible: () => annState.show && annState.solo < 0 && ['hero', 'side', 'front'].includes(st.view),
  });
  const annGear = ann.add({
    getWorld: () => engine.anchors.timingGears,
    text: '斜齿正时齿轮', sub: '24 : 72', side: 'left', dist: 196, dy: 246,
    visible: () => annState.show && annState.solo < 0 && ['hero', 'front'].includes(st.view),
  });

  /* ---------------------------------------------------------- 导演 */
  const director = createDirector({beats: BEATS, duration: DURATION});
  studio.setPose(director.sample(0).pose);

  /* ---------------------------------------------------------- 交互 */
  const takeOver = () => {
    st.lastInput = st.now;
    if (!st.auto || isFilm) return;
    st.auto = false;
    st.view = camKeyAt(st.tourT) === 'open' ? 'hero' : camKeyAt(st.tourT);
    st.track = trackedCylinderAt(st.tourT);
    st.overlays.isolate = 0;
    hud.showToast('已接管 · 拖动环绕 / 滚轮缩放', 3);
    kick();
  };
  const startTour = () => {
    st.auto = true;
    st.tourStart = st.now;
    st.lastInput = st.now;
    Object.assign(st.overlays, {callouts: 1, charge: 0, arrows: 0, isolate: 0, refract: 0, charts: 1});
    st.cut = 'glass';
    hud.hideToast();
    kick();
  };
  studio.controls.onTakeover = () => takeOver();
  if (!isFilm) {
    studio.controls.onTakeover = () => {
      takeOver();
    };
  }

  /* ---------------------------------------------------------- 光标（影片页） */
  const cursorEl = h('div', 'v8-cursor');
  cursorEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#17141f" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
  cursorEl.style.display = isFilm ? '' : 'none';
  hud.frame.append(cursorEl);
  const ringEl = h('div', 'v8-clickring');
  ringEl.style.display = 'none';
  hud.frame.append(ringEl);
  const spotCache = new Map();
  const spotOf = (el) => {
    if (!el) return [960, 540];
    const r = el.getBoundingClientRect();
    const v = hud.viewport;
    return [(r.left + r.width / 2 - v.ox) / v.scale, (r.top + r.height / 2 - v.oy) / v.scale];
  };
  const refSpot = (key, el) => {
    if (!spotCache.has(key)) spotCache.set(key, spotOf(el));
    return spotCache.get(key);
  };
  const CURSOR_EVENTS = [
    {t: 3.5, key: 'view-cyl', get: () => refSpot('view-cyl', ui.refs.viewBtns[4])},
    {t: 6.9, key: 'fo6', get: () => refSpot('fo6', ui.refs.firingNodes[4])},
    {t: 9.7, key: 'view-valley', get: () => refSpot('view-valley', ui.refs.viewBtns[3])},
    {t: 12.1, key: 'rpm', get: () => refSpot('rpm', ui.refs.rpmRange)},
    {t: 14.7, key: 'view-side', get: () => refSpot('view-side', ui.refs.viewBtns[2])},
    {t: 17.3, key: 'view-front', get: () => refSpot('view-front', ui.refs.viewBtns[1])},
    {t: 19.9, key: 'view-hero', get: () => refSpot('view-hero', ui.refs.viewBtns[0])},
    {t: 22.5, key: 'fo1', get: () => refSpot('fo1', ui.refs.firingNodes[0])},
  ];
  const REST = [930, 720];
  function cursorAt(t) {
    const ev = CURSOR_EVENTS.filter((e) => e.t <= t).pop();
    const next = CURSOR_EVENTS.find((e) => e.t > t);
    let x = REST[0];
    let y = REST[1];
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    let active = false;
    if (ev && t < ev.t + 2.2) {
      const [sx, sy] = ev.get();
      if (ev.key === 'rpm') {
        // 拖动转速滑杆：700 → 2400（1.4 s）
        const rr = ev.get();
        const range = ui.refs.rpmRange.getBoundingClientRect();
        const scale = hud.viewport.scale;
        const x0 = rr[0] - (range.width / scale) / 2 + 7;
        const w = range.width / scale - 14;
        x = x0 + w * clamp(rpmAt(t) / RPM.max, 0, 1);
        y = rr[1] + 4;
        press = t >= ev.t && t <= ev.t + 1.42;
        active = true;
        if (press) {
          ring = 1;
          rx = x;
          ry = y;
        }
        if (t > ev.t + 1.5) {
          const k2 = smoother((t - ev.t - 1.5) / 0.8);
          x = x + (REST[0] - x) * k2;
          y = y + (REST[1] - y) * k2;
        }
      } else {
        const [ax, ay] = ev.get();
        const approach = smoother((t - ev.t + 0.55) / 0.55);
        const leave = t > ev.t + 0.35 ? smoother((t - ev.t - 0.35) / 0.9) : 0;
        const [px, py] = [ax, ay];
        x = REST[0] + (px - REST[0]) * approach;
        y = REST[1] + (py - REST[1]) * approach;
        x = x + (REST[0] - x) * leave;
        y = y + (REST[1] - y) * leave;
        press = t >= ev.t - 0.05 && t <= ev.t + 0.14;
        active = true;
        if (t >= ev.t && t < ev.t + 0.55) {
          ring = 1 - (t - ev.t) / 0.55;
          rx = px;
          ry = py;
        }
      }
    }
    cursorEl.style.display = isFilm ? '' : 'none';
    cursorEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${press ? 0.86 : 1})`;
    ringEl.style.display = ring > 0.01 ? '' : 'none';
    if (ring > 0.01) {
      ringEl.style.left = `${rx}px`;
      ringEl.style.top = `${ry}px`;
      ringEl.style.opacity = String(ring * 0.8);
      ringEl.style.transform = `translate(-50%, -50%) scale(${(0.4 + 0.9 * (1 - ring)).toFixed(2)})`;
    }
    return active;
  }

  /* ---------------------------------------------------------- 每帧 */
  let lastCutKey = '';
  const soloFromCam = (t) => {
    const {beat, local, prev} = camLocal(t);
    return beat.cam === 'cyl' && local > 1.2;
  };

  function frame(t) {
    st.now = t;
    const dtRaw = t - st.lastT;
    const dt = Math.abs(dtRaw) > 0.6 ? 0 : clamp(dtRaw, 0, 0.05);
    st.lastT = t;
    const playerPaused = window.__sim ? window.__sim.paused : false;

    if (isFilm) {
      st.theta = thetaAt(t);
      st.rpm = rpmAt(t);
      st.rpmTarget = st.rpm;
      st.track = trackedCylinderAt(t);
      st.tourT = t;
      studio.setPose(director.sample(t).pose);
      st.view = camKeyAt(t) === 'open' ? 'hero' : camKeyAt(t);
      Object.assign(st.overlays, {callouts: 1, charge: 1, arrows: 0, isolate: 0, refract: 1, charts: 1});
    } else if (st.auto) {
      st.tourT = t - st.tourStart;
      studio.setPose(director.sample(st.tourT).pose);
      st.view = camKeyAt(st.tourT) === 'open' ? 'hero' : camKeyAt(st.tourT);
      st.track = trackedCylinderAt(st.tourT);
      st.overlays.isolate = 0;
      st.rpmTarget = rpmAt(st.tourT);
      st.rpm = st.rpmTarget;
      st.theta = thetaAt(st.tourT);
    } else {
      if (!playerPaused) {
        st.theta += (st.rpm / 60) * 360 * dt * PLAYBACK_STEPS[st.playIndex];
        st.rpm = damp(st.rpm, st.rpmTarget, 7, dt);
      }
      studio.update(dt);
      if (t - st.lastInput > 25) startTour();
    }

    // 隔离 / 剖切 / 姿态
    const solo = st.overlays.isolate ? st.track - 1 : -1;
    const cutKey = `${st.cut}|${st.track}`;
    if (cutKey !== lastCutKey) {
      engine.setCut(st.cut, st.track - 1);
      lastCutKey = cutKey;
    }
    engine.setRefract(!!st.overlays.refract);
    engine.update(st.theta, {
      charge: st.overlays.charge,
      arrows: st.overlays.arrows,
      solo,
      track: st.track - 1,
    });
    annState.solo = solo;
    annState.show = !!st.overlays.callouts;

    // HUD
    const s = telemetry(t, {theta: st.theta, rpm: st.rpm, cyl: st.track});
    ui.update(s, {
      view: st.view,
      cut: st.cut,
      overlays: st.overlays,
      auto: !isFilm && st.auto,
      paused: isFilm ? false : st.auto ? false : playerPaused,
      playIndex: st.playIndex,
      playText: playText(PLAYBACK_STEPS[st.playIndex]),
      showCharts: st.overlays.charts,
    });
    studio.render();
    ann.update();
    if (isFilm) cursorAt(t);
  }

  return {
    duration: DURATION,
    frame,
    onResize() {
      studio.setSize(window.innerWidth, window.innerHeight);
      frame(window.__sim ? window.__sim.time : 0);
    },
    onKey(e) {
      if (isFilm) return;
      const k = e.key;
      if (k >= '1' && k <= '5') {
        const keys = ['hero', 'front', 'side', 'valley', 'cyl'];
        takeOver();
        st.view = keys[Number(k) - 1];
        studio.tweenPose(VIEWS[st.view](0, st.track), 0.9);
        kick();
      } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
        takeOver();
        const s = window.__sim;
        if (s) s.pause();
        st.theta += k === 'ArrowLeft' ? -15 : 15;
        kick();
      } else if (k === 'ArrowUp' || k === 'ArrowDown') {
        takeOver();
        st.rpmTarget = clamp(st.rpmTarget + (k === 'ArrowUp' ? 300 : -300), RPM.liveMin, RPM.max);
        kick();
      }
    },
  };
}
