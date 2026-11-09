// 运行时：场景/相机/交互 API/影片编排（浏览器端）
// 研究模式与影片页共用同一 bundle；页面形态由 body[data-film] 决定。

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel, applyState, stateAt, SYSTEM_TINT, makeOverrideMats, asphaltTexture } from './character.mjs';

const FILM_SECONDS = 50;      // 影片页时长
const XFORM_SECONDS = 9;      // 变形时长（spec §3）

// ---------- 相机构图：由包围盒求取（工作流协议：先端口/包围盒，后人工检查） ----------
function frameBox(cam, box3, azimDeg, elevDeg, distScale = 1.0, targetYOffset = 0) {
  const c = box3.getCenter(new THREE.Vector3());
  const s = box3.getSize(new THREE.Vector3());
  const radius = Math.max(s.x, s.y * 0.9, s.z) * 0.62;
  const az = azimDeg * Math.PI / 180, el = elevDeg * Math.PI / 180;
  const d = radius / Math.sin(Math.min(60, Math.max(18, Math.abs(elevDeg) === 0 ? 32 : 32)) * Math.PI / 180) * distScale;
  const target = new THREE.Vector3(c.x, c.y + targetYOffset, c.z);
  cam.position.set(
    target.x + d * Math.cos(el) * Math.sin(az),
    target.y + d * Math.sin(el),
    target.z + d * Math.cos(el) * Math.cos(az),
  );
  cam.lookAt(target);
  return target;
}
function lerpCam(cam, a, b, k, look) {
  cam.position.set(lerpN(a.position.x, b.position.x, k), lerpN(a.position.y, b.position.y, k), lerpN(a.position.z, b.position.z, k));
  look.set(lerpN(a.look.x, b.look.x, k), lerpN(a.look.y, b.look.y, k), lerpN(a.look.z, b.look.z, k));
  cam.lookAt(look);
}
const lerpN = (a, b, k) => a + (b - a) * k;
const radD = (d) => d * Math.PI / 180;
const easeIO = (x) => { const c = Math.min(1, Math.max(0, x)); return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2; };

// ---------- 主程序 ----------
export function boot() {
  const isFilm = document.body.dataset.film === 'true';
  const el = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(el.clientWidth, el.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // 渐变天幕
  const bc = document.createElement('canvas');
  bc.width = 2; bc.height = 512;
  const bctx = bc.getContext('2d');
  const grad = bctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0a0e14'); grad.addColorStop(0.55, '#151d27'); grad.addColorStop(0.8, '#2a3949'); grad.addColorStop(1, '#3d5163');
  bctx.fillStyle = grad; bctx.fillRect(0, 0, 2, 512);
  const bgTex = new THREE.CanvasTexture(bc);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;
  scene.fog = new THREE.Fog(0x141a22, 34, 95);

  const camera = new THREE.PerspectiveCamera(38, el.clientWidth / el.clientHeight, 0.1, 300);

  // 灯光（主/轮廓/环境）
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
  sun.position.set(6.5, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.1);
  rim.position.set(-7, 5.5, -7);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x8fb3d9, 0x1d2126, 0.55));
  // 环境反射
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // 地面
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(), color: 0xbfc4c9, roughness: 0.94, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 模型
  const model = buildModel();
  scene.add(model.root);
  applyState(model, 0, 0);

  // 关节轴（关键转动部位，随装配移动）
  const jointIds = ['pauldron_l', 'pauldron_r', 'elbow_l', 'elbow_r', 'wrist_l', 'wrist_r', 'knee_l', 'knee_r', 'ankle_l', 'ankle_r', 'neck', 'waist', 'head'];
  const jointMap = new Map();
  model.root.traverse((o) => { if (o.isGroup && jointIds.includes(o.name)) jointMap.set(o.name, o); });
  const jointHelpers = [];
  for (const [, g] of jointMap) {
    const ax = new THREE.AxesHelper(0.45);
    ax.material.depthTest = false;
    ax.visible = false;
    g.add(ax);
    jointHelpers.push(ax);
  }

  // 覆盖材质（灰模/分色）
  const ovr = makeOverrideMats();
  const origMat = new Map();
  let mode = 'paint'; // paint | gray | tint
  function applyMaterialMode() {
    model.root.traverse((o) => {
      if (!o.isMesh) return;
      if (!origMat.has(o)) origMat.set(o, o.material);
      const sys = o.userData.system;
      if (mode === 'paint') { o.material = origMat.get(o); return; }
      if (mode === 'gray') {
        o.material = sys === 'glass' ? ovr.glass : (sys === 'rubber' || sys === 'dark' || sys === 'steel' ? ovr.dark : ovr.gray);
        return;
      }
      if (mode === 'tint') {
        const hex = SYSTEM_TINT[sys] ?? 0x888888;
        if (!ovr['tint_' + hex]) ovr['tint_' + hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0.1 });
        o.material = ovr['tint_' + hex];
      }
    });
  }

  // 高亮选择
  let selected = null;
  const selectMat = new THREE.MeshStandardMaterial({ color: 0x2a7fd4, emissive: 0x1a5faf, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.3 });
  function selectAssembly(id) {
    if (selected) selected.meshes.forEach((m) => { m.material = m.userData._prev ?? m.material; m.userData._prev = undefined; });
    selected = null;
    if (!id) { updateInfo(); return; }
    const g = findById(model.root, id);
    if (!g) return;
    const meshes = [];
    g.traverse((o) => { if (o.isMesh) meshes.push(o); });
    meshes.forEach((m) => { m.userData._prev = m.material; m.material = selectMat; });
    selected = { id, meshes };
    updateInfo();
  }
  function findById(root, id) { let f = null; root.traverse((o) => { if (!f && o.name === id) f = o; }); return f; }

  // 轻量轨道控制（自研，避免外部控制器与确定性渲染互相干扰）
  const orbit = { az: radD(35), el: radD(12), d: 13.5, tx: 0, ty: 2.0, tz: 0, drag: false, px: 0, py: 0 };
  function orbitApply() {
    const c = new THREE.Vector3(orbit.tx, orbit.ty, orbit.tz);
    camera.position.set(
      c.x + orbit.d * Math.cos(orbit.el) * Math.sin(orbit.az),
      c.y + orbit.d * Math.sin(orbit.el),
      c.z + orbit.d * Math.cos(orbit.el) * Math.cos(orbit.az),
    );
    camera.lookAt(c);
  }
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', (e) => { orbit.drag = true; orbit.px = e.clientX; orbit.py = e.clientY; dom.setPointerCapture(e.pointerId); });
  dom.addEventListener('pointermove', (e) => {
    if (!orbit.drag) return;
    orbit.az -= (e.clientX - orbit.px) * 0.005;
    orbit.el = Math.min(radD(85), Math.max(radD(-10), orbit.el + (e.clientY - orbit.py) * 0.004));
    orbit.px = e.clientX; orbit.py = e.clientY;
    orbitApply();
    ui.dirty = true;
  });
  dom.addEventListener('pointerup', () => { orbit.drag = false; });
  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.d = Math.min(40, Math.max(3.5, orbit.d * (1 + Math.sign(e.deltaY) * 0.08)));
    orbitApply();
    ui.dirty = true;
  }, { passive: false });
  // 拾取
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  dom.addEventListener('click', (e) => {
    if (!ui.research) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(model.root.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.name) o = o.parent;
      if (o && o.name && o.name !== 'scene') { selectAssembly(o.name); return; }
    }
    selectAssembly(null);
  });

  // ---------- 状态 ----------
  const S = {
    progress: 0,       // 变形进度 0..1
    explode: 0,
    gray: false, tint: false, joints: false,
    camera: 'three',   // 交互相机预设
    film: isFilm,
    filmTime: 0,
    playing: false, dir: 1,
    research: false,
    ready: false,
  };

  // ---------- 影片分镜（50s，配方见工作流协议）----------
  const SHOTS = [
    { t0: 0, t1: 5, x0: 0, x1: 0, ex: 0, label: '01 车辆建立', cap: '彼得比尔特 379 · 深夜到场', cam: (k, b) => { const a = shotPose(b, 34, 7, 1.16, 0.1), c = shotPose(b, 22, 9, 0.92, 0.1); lerpCam(camera, a, c, easeIO(k), look); } },
    { t0: 5, t1: 9, x0: 0, x1: 0, ex: 0, label: '02 细节节拍', cap: '格栅 · 烟囱 · 火焰拉花', cam: (k, b) => { const a = shotPose(b, 8, 13, 0.55, 0.9), c = shotPose(b, -14, 14, 0.5, 1.5); lerpCam(camera, a, c, easeIO(k), look); } },
    { t0: 9, t1: 24, x0: 0, x1: 1, ex: 0, label: '03 连续变形', cap: '解锁 → 腿落 → 立胸 → 展臂 → 头升 → 锁止', cam: (k, b) => { const a = shotPose(b, 30, 6, 1.5, 0.2), c = shotPose(b, 38, 12, 1.42, 0); lerpCam(camera, a, c, easeIO(k), look); } },
    { t0: 24, t1: 28, x0: 1, x1: 1, ex: 0, label: '04 人形亮相', cap: '低机位 · 让剪影先说话', cam: (k, b) => { const a = shotPose(b, 46, 4, 1.75, -0.4), c = shotPose(b, 26, 8, 1.6, -0.4); lerpCam(camera, a, c, easeIO(k), look); } },
    { t0: 28, t1: 33, x0: 1, x1: 1, ex: 0, label: '05 头胸揭示', cap: '冠盔脊鳍 → 开书胸窗', cam: (k, b) => { const a = shotPose(b, 12, 24, 0.5, 1.9), c = shotPose(b, 4, 16, 0.72, 1.2); lerpCam(camera, a, c, easeIO(k), look); } },
    { t0: 33, t1: 37, x0: 1, x1: 1, ex: 0, label: '06 前臂与手', cap: '翼子板甲片 · 指节', cam: (k, b) => { const a = shotPose(b, -28, 12, 0.44, 0.3), c = shotPose(b, -40, 10, 0.38, 0.2); lerpCam(camera, a, c, easeIO(k), look); } },
    { t0: 37, t1: 41, x0: 1, x1: 1, ex: 0, label: '07 下肢承重', cap: '髋膝踝 · 轮毂落位', cam: (k, b) => { const a = shotPose(b, 150, 2, 0.75, -0.7), c = shotPose(b, 168, 4, 0.65, -0.7); lerpCam(camera, a, c, easeIO(k), look); } },
    { t0: 41, t1: 46, x0: 1, x1: 1, ex: 0, label: '08 分层拆解', cap: '结构研究设计 · 非原片变形', cam: (k, b) => { const a = shotPose(b, 60, 18, 1.35, 0.3), c = shotPose(b, 74, 22, 1.45, 0.3); lerpCam(camera, a, c, easeIO(k), look); } },
    { t0: 46, t1: 50, x0: 1, x1: 1, ex: 0, label: '09 重组落幅', cap: '同向收束 · 英雄轮廓', cam: (k, b) => { const a = shotPose(b, 55, 10, 1.9, 0), c = shotPose(b, 33, 9, 1.72, 0); lerpCam(camera, a, c, easeIO(k), look); } },
  ];
  const look = new THREE.Vector3();
  // 镜头局部取景：以人形/车辆包围盒为基准的球坐标
  function shotPose(_b, azim, elev, dist, dy) {
    const b = _b || lastBounds;
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    const radius = Math.max(1.2, Math.max(s.x, s.z) * 0.5, s.y * 0.42);
    const az = azim * Math.PI / 180, el = elev * Math.PI / 180;
    const d = radius * 2.6 * dist;
    return {
      position: new THREE.Vector3(c.x + d * Math.cos(el) * Math.sin(az), c.y + dy * 0.35 + d * Math.sin(el), c.z + d * Math.cos(el) * Math.cos(az)),
      look: new THREE.Vector3(c.x, c.y + dy, c.z),
    };
  }

  let lastBounds = new THREE.Box3();
  // 包围盒只统计真实 Mesh（AxesHelper 等辅助线不参与取景）
  function computeBounds() {
    const b = new THREE.Box3();
    model.root.traverse((o) => { if (o.isMesh) b.expandByObject(o); });
    return b;
  }
  lastBounds.copy(computeBounds());

  // ---------- 渲染 ----------
  function renderInteractive() {
    applyState(model, S.progress, S.explode);
    model.root.updateMatrixWorld(true);
    const b = computeBounds();
    lastBounds.copy(b);
    if (S.camera === 'three') {
      orbitApply();
    } else {
      const preset = {
        front: [16, 8, 1.32, 0.35], side: [90, 7, 1.35, 0.35], back: [178, 8, 1.35, 0.35], top: [35, 62, 1.5, 0.2],
      }[S.camera] || [35, 12, 1.3, 0.2];
      const pose = shotPose(b, preset[0], preset[1], preset[2], preset[3]);
      camera.position.copy(pose.position);
      camera.lookAt(pose.look);
    }
    const tl = $('timeline');
    if (tl && document.activeElement !== tl) tl.value = String(Math.round(S.progress * XFORM_SECONDS * 100) / 100);
    const tt = $('time');
    if (tt) tt.textContent = `${(S.progress * XFORM_SECONDS).toFixed(2).padStart(5, '0')} / ${XFORM_SECONDS.toFixed(2).padStart(5, '0')}`;
    const stage = STAGES.reduce((a, st) => (S.progress >= st.t ? st : a), STAGES[0]);
    if ($('stage')) $('stage').textContent = stage.title;
    if ($('description')) $('description').textContent = stage.desc;
    if ($('chapter')) $('chapter').textContent = stage.chapter;
    renderer.render(scene, camera);
  }

  function renderFilm(ft) {
    let shot = SHOTS[SHOTS.length - 1];
    for (const s of SHOTS) { if (ft < s.t1) { shot = s; break; } }
    const k = (ft - shot.t0) / (shot.t1 - shot.t0);
    const x = lerpN(shot.x0, shot.x1, easeIO(k));
    const ex = shot.label.startsWith('08') ? (k < 0.5 ? easeIO(k * 2) : 1 - easeIO((k - 0.5) * 2)) : 0;
    S.progress = Math.min(1, Math.max(0, x));
    S.explode = ex;
    applyState(model, S.progress, S.explode);
    model.root.updateMatrixWorld(true);
    const b = computeBounds();
    lastBounds.copy(b);
    shot.cam(k, b);
    // 字幕
    const cap = document.getElementById('cap');
    if (cap) { cap.textContent = shot.cap; document.getElementById('capLabel').textContent = shot.label; }
    const tt = document.getElementById('time');
    if (tt) tt.textContent = `${fmt(ft)} / ${fmt(FILM_SECONDS)}`;
    renderer.render(scene, camera);
  }
  const fmt = (s) => (Math.round(s * 100) / 100).toFixed(2).padStart(5, '0');

  function renderNow() {
    if (S.film) renderFilm(S.filmTime);
    else renderInteractive();
    S.ready = true;
  }

  // ---------- 循环 ----------
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
    if (S.film) {
      if (S.playing) {
        S.filmTime += dt;
        if (S.filmTime >= FILM_SECONDS) { S.filmTime = FILM_SECONDS; S.playing = false; ui.playBtn && (ui.playBtn.textContent = '▶ 重播'); }
      }
      renderFilm(S.filmTime);
    } else if (S.playing) {
      S.progress += S.dir * dt / XFORM_SECONDS;
      if (S.progress >= 1) { S.progress = 1; S.playing = false; }
      if (S.progress <= 0) { S.progress = 0; S.playing = false; }
      ui.sync();
      renderInteractive();
    } else if (ui.dirty) {
      ui.dirty = false;
      renderInteractive();
    }
    } catch (e) { console.error('tick', e); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- UI ----------
  const $ = (id) => document.getElementById(id);
  const ui = {
    research: false, dirty: false, playBtn: $('play'),
    sync() {
      const tl = $('timeline');
      if (tl && document.activeElement !== tl) tl.value = String(Math.round(S.progress * XFORM_SECONDS * 100) / 100);
      const stage = STAGES.reduce((a, s) => (S.progress >= s.t ? s : a), STAGES[0]);
      if ($('stage')) $('stage').textContent = stage.title;
      if ($('description')) $('description').textContent = stage.desc;
      if ($('chapter')) $('chapter').textContent = stage.chapter;
    },
  };
  const STAGES = [
    { t: 0, chapter: '01 / 卡车形态', title: '钢铁，尚未苏醒。', desc: '彼得比尔特 379 · 红色驾驶室 · 六轮底盘' },
    { t: 0.08, chapter: '02 / 解锁', title: '甲片松脱，机构唤醒。', desc: '卧铺侧壁解锁 · 腿部开始下落' },
    { t: 0.30, chapter: '03 / 腿部落位', title: '双腿立地，重心下沉。', desc: '六轮迁移 · 足落地承重' },
    { t: 0.48, chapter: '04 / 车体立起', title: '驾驶室抬升，胸腔显现。', desc: '车架折立 · 格栅转向正面' },
    { t: 0.58, chapter: '05 / 胸窗展开', title: '挡风成 V，内构短暂外露。', desc: '双胸窗外旋 · 弹簧执行器可见' },
    { t: 0.74, chapter: '06 / 双臂展开', title: '臂膀张开，肩甲撑起。', desc: '翼子板包合前臂 · 大肩甲就位' },
    { t: 0.88, chapter: '07 / 头雕升起', title: '蓝色冠盔，双眼点亮。', desc: '烟囱归位头侧 · 全甲合缝' },
    { t: 1, chapter: '08 / 人形形态', title: '擎天柱，就位。', desc: '金属巨人 · 静候号令' },
  ];

  function bindInteractive() {
    const tl = $('timeline');
    if (!tl) return;
    tl.max = String(XFORM_SECONDS);
    tl.addEventListener('input', () => {
      S.progress = Number(tl.value) / XFORM_SECONDS;
      S.playing = false;
      if (ui.playBtn) ui.playBtn.textContent = '▶ 播放';
      ui.sync(); ui.dirty = true;
    });
    const play = $('play');
    play.addEventListener('click', () => {
      if (S.playing) { S.playing = false; play.textContent = '▶ 播放'; return; }
      if (S.progress >= 1) S.progress = 0;
      S.dir = 1; S.playing = true; play.textContent = '❚❚ 暂停';
    });
    $('reverse').addEventListener('click', () => {
      if (S.progress <= 0) S.progress = 1;
      S.dir = -1; S.playing = true; play.textContent = '❚❚ 暂停';
    });
    $('truck').addEventListener('click', () => { S.progress = 0; S.playing = false; play.textContent = '▶ 播放'; ui.sync(); ui.dirty = true; });
    $('robot').addEventListener('click', () => { S.progress = 1; S.playing = false; play.textContent = '▶ 播放'; ui.sync(); ui.dirty = true; });
    $('research').addEventListener('click', (e) => {
      S.research = !S.research;
      e.currentTarget.textContent = S.research ? '研究模式 －' : '研究模式 ＋';
      e.currentTarget.setAttribute('aria-expanded', String(S.research));
      $('panel').hidden = !S.research;
      ui.dirty = true;
    });
    $('film').addEventListener('click', () => { location.href = 'film.html'; });
    for (const b of document.querySelectorAll('[data-camera]')) {
      b.addEventListener('click', () => {
        S.camera = b.dataset.camera;
        for (const x of document.querySelectorAll('[data-camera]')) x.classList.toggle('active', x === b);
        ui.dirty = true;
      });
    }
    $('gray').addEventListener('click', (e) => {
      S.gray = !S.gray;
      if (S.gray) S.tint = false;
      e.currentTarget.classList.toggle('active', S.gray);
      $('tint').classList.toggle('active', false);
      mode = S.gray ? 'gray' : (S.tint ? 'tint' : 'paint');
      applyMaterialMode(); ui.dirty = true;
    });
    $('tint').addEventListener('click', (e) => {
      S.tint = !S.tint;
      if (S.tint) S.gray = false;
      e.currentTarget.classList.toggle('active', S.tint);
      $('gray').classList.toggle('active', false);
      mode = S.gray ? 'gray' : (S.tint ? 'tint' : 'paint');
      applyMaterialMode(); ui.dirty = true;
    });
    $('joints').addEventListener('click', (e) => {
      S.joints = !S.joints;
      e.currentTarget.classList.toggle('active', S.joints);
      for (const ax of jointHelpers) ax.visible = S.joints;
      ui.dirty = true;
    });
    const exs = $('explode');
    exs.addEventListener('click', (e) => {
      S.explode = S.explode > 0 ? 0 : 1;
      e.currentTarget.classList.toggle('active', S.explode > 0);
      e.currentTarget.textContent = S.explode > 0 ? '收拢拆解' : '拆分查看';
      ui.dirty = true;
    });
    // 研究步骤索引
    const steps = $('steps');
    const STEPS = [
      ['卡车形态', 0, 0], ['解锁', 0.06, 0], ['腿部落位', 0.25, 0], ['车体立起', 0.40, 0],
      ['胸窗展开', 0.55, 0], ['双臂展开', 0.68, 0], ['头雕升起', 0.82, 0], ['锁止完成', 1, 0],
      ['分层拆解', 1, 1], ['重组还原', 1, 0],
    ];
    STEPS.forEach(([name, t, ex], i) => {
      const b = document.createElement('button');
      b.innerHTML = `<em>${String(i + 1).padStart(2, '0')}</em>${name}`;
      b.addEventListener('click', () => {
        S.progress = t; S.explode = ex;
        if (exs) { exs.classList.toggle('active', ex > 0); exs.textContent = ex > 0 ? '收拢拆解' : '拆分查看'; }
        S.playing = false; if (ui.playBtn) ui.playBtn.textContent = '▶ 播放';
        ui.sync(); ui.dirty = true;
        for (const x of steps.querySelectorAll('button')) x.classList.toggle('active', x === b);
      });
      steps.appendChild(b);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); play.click(); }
    });
    ui.sync();
  }
  function updateInfo() {
    const box = $('info');
    if (!box) return;
    if (!selected) { box.textContent = '点击模型任一部件查看装配名称。'; return; }
    const sys = ASM_INFO[selected.id] || '结构件';
    box.textContent = `装配 ${selected.id} · 系统 ${sys}`;
  }
  const ASM_INFO = Object.fromEntries(model.registry.map((a) => [a.id, a.system]));

  function bindFilm() {
    const play = $('play');
    if (!play) return;
    play.addEventListener('click', () => {
      if (S.playing) { S.playing = false; play.textContent = '▶ 重播'; return; }
      if (S.filmTime >= FILM_SECONDS) S.filmTime = 0;
      S.playing = true; play.textContent = '❚❚ 暂停';
    });
  }

  if (isFilm) bindFilm(); else bindInteractive();
  window.addEventListener('resize', () => {
    camera.aspect = el.clientWidth / el.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(el.clientWidth, el.clientHeight);
    ui.dirty = true;
  });
  renderNow();

  // ---------- 对外研究 API（QA/截图工具使用）----------
  window.study = {
    get ready() { return S.ready; },
    renderAt(tOrSec) {
      if (S.film) { S.filmTime = Math.min(FILM_SECONDS, Math.max(0, tOrSec)); renderFilm(S.filmTime); }
      else { S.progress = Math.min(1, Math.max(0, tOrSec)); renderInteractive(); }
    },
    setProgress(t) { S.progress = Math.min(1, Math.max(0, t)); renderInteractive(); },
    get progress() { return S.progress; },
    setExplode(f) { S.explode = Math.min(1, Math.max(0, f)); renderInteractive(); },
    setGray(b) { S.gray = !!b; if (b) S.tint = false; mode = S.gray ? 'gray' : (S.tint ? 'tint' : 'paint'); applyMaterialMode(); renderInteractive(); },
    setTint(b) { S.tint = !!b; if (b) S.gray = false; mode = S.gray ? 'gray' : (S.tint ? 'tint' : 'paint'); applyMaterialMode(); renderInteractive(); },
    setJoints(b) { S.joints = !!b; for (const ax of jointHelpers) ax.visible = S.joints; renderInteractive(); },
    setCamera(name) { S.camera = name; renderInteractive(); },
    setFilm(b) { S.film = !!b; if (!b) { S.playing = false; } renderNow(); },
    setFilmTime(t) { S.filmTime = Math.min(FILM_SECONDS, Math.max(0, t)); if (S.film) renderFilm(S.filmTime); },
    play(b) { S.playing = !!b; },
    snapshot() {
      model.root.updateMatrixWorld(true);
      const out = [];
      model.root.traverse((o) => {
        if (o.isGroup && o.name && o.name !== 'scene') {
          out.push({ id: o.name, matrix: Array.from(o.matrixWorld.elements).map((x) => Math.round(x * 1e6) / 1e6) });
        }
      });
      return out;
    },
    bounds() {
      model.root.updateMatrixWorld(true);
      const b = computeBounds();
      return { min: b.min.toArray().map(round4), max: b.max.toArray().map(round4), size: b.getSize(new THREE.Vector3()).toArray().map(round4) };
    },
    ports: model.ports,
    registry: model.registry,
    debug: () => ({ progress: S.progress, explode: S.explode, film: S.film, camera: S.camera, playing: S.playing }),
    stateAt: (t, e = 0) => stateAt(t, e),
  };
  const round4 = (x) => Math.round(x * 1e4) / 1e4;
  // 暴露错误钩子
  window.addEventListener('error', (e) => {
    const box = $('error');
    if (box) { box.hidden = false; box.textContent = `页面错误：${e.message}`; }
  });
}
