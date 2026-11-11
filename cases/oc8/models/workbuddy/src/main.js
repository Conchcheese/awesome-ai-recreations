/* ============================================================
   PELAGOS OC-8 · 机械章鱼复刻版
   参考: 0x_fokki 原作关键帧 (topmindspace/awesome-ai-recreations cases/oc8)
   纯前端 three.js · 无外部模型 · 心跳相位 1.8Hz 驱动全部动画
   ============================================================ */
'use strict';
const T = THREE;

/* ---------- 渲染器 / 场景 ---------- */
const BG = 0xf2efe8;
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = T.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new T.Scene();
scene.background = new T.Color(BG);
scene.fog = new T.Fog(BG, 34, 72);

const camera = new T.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
const TARGET = new T.Vector3(0, -0.8, 0);
const orbit = { az: 0.85, el: 0.18, r: 25, minR: 9, maxR: 46 };
function applyCamera() {
  orbit.el = Math.max(-0.5, Math.min(1.2, orbit.el));
  camera.position.set(
    TARGET.x + orbit.r * Math.cos(orbit.el) * Math.cos(orbit.az),
    TARGET.y + orbit.r * Math.sin(orbit.el),
    TARGET.z + orbit.r * Math.cos(orbit.el) * Math.sin(orbit.az)
  );
  camera.lookAt(TARGET);
}
applyCamera();

/* ---------- 灯光（浅色影棚） ---------- */
const hemi = new T.HemisphereLight(0xfff8ee, 0xd8d2c6, 1.05);
scene.add(hemi);
const key = new T.DirectionalLight(0xffffff, 1.35);
key.position.set(10, 16, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -18; key.shadow.camera.right = 18;
key.shadow.camera.top = 18; key.shadow.camera.bottom = -18;
key.shadow.bias = -0.0004;
scene.add(key);
const fill = new T.DirectionalLight(0xf4efe6, 0.4);
fill.position.set(-8, 5, -10);
scene.add(fill);

/* ---------- 地面与影棚装饰 ---------- */
(function studio() {
  const gTex = document.createElement('canvas');
  gTex.width = gTex.height = 256;
  const g = gTex.getContext('2d');
  const rad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  rad.addColorStop(0, 'rgba(120,112,100,0.32)');
  rad.addColorStop(0.55, 'rgba(120,112,100,0.10)');
  rad.addColorStop(1, 'rgba(120,112,100,0)');
  g.fillStyle = rad; g.fillRect(0, 0, 256, 256);
  const shadow = new T.Mesh(
    new T.PlaneGeometry(26, 26).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ map: new T.CanvasTexture(gTex), transparent: true, depthWrite: false })
  );
  shadow.position.y = -7.9;
  scene.add(shadow);

  // 虚线参考圆
  for (const [r, op] of [[7.5, 0.5], [12, 0.42], [17, 0.34]]) {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = i / 128 * Math.PI * 2;
      pts.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new T.BufferGeometry().setFromPoints(pts);
    const line = new T.Line(geo, new T.LineDashedMaterial({
      color: 0xb8b0a0, dashSize: 0.5, gapSize: 0.42, transparent: true, opacity: op
    }));
    line.computeLineDistances();
    line.position.y = -7.88;
    scene.add(line);
  }
  // 顶部十字点缀
  const plusMat = new T.LineBasicMaterial({ color: 0xbfb7a8, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 10; i++) {
    const px = (Math.sin(i * 12.9) * 0.5 + 0.5) * 36 - 18;
    const pz = (Math.sin(i * 78.3) * 0.5 + 0.5) * 36 - 18;
    const py = 2 + (i % 4) * 3.2;
    const pg = new T.BufferGeometry().setFromPoints([
      new T.Vector3(px - 0.3, py, pz), new T.Vector3(px + 0.3, py, pz),
      new T.Vector3(px, py - 0.3, pz), new T.Vector3(px, py + 0.3, pz)
    ]);
    scene.add(new T.LineSegments(pg, plusMat));
  }
})();

/* ---------- 材质 ---------- */
const M = {
  white:   new T.MeshStandardMaterial({ color: 0xf4f1ea, metalness: 0.12, roughness: 0.38, envMapIntensity: 0.5 }),
  white2:  new T.MeshStandardMaterial({ color: 0xe9e5db, metalness: 0.15, roughness: 0.45, envMapIntensity: 0.45 }),
  black:   new T.MeshStandardMaterial({ color: 0x17181a, metalness: 0.55, roughness: 0.42, envMapIntensity: 0.6 }),
  blackSoft: new T.MeshStandardMaterial({ color: 0x202226, metalness: 0.3, roughness: 0.72, envMapIntensity: 0.3 }),
  orange:  new T.MeshStandardMaterial({ color: 0xe8541e, metalness: 0.35, roughness: 0.42, emissive: 0x521403, emissiveIntensity: 0.35 }),
  orangeGlow: new T.MeshStandardMaterial({ color: 0xff6a2a, emissive: 0xe8541e, emissiveIntensity: 1.6, metalness: 0.1, roughness: 0.4 }),
  steel:   new T.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.32, envMapIntensity: 0.7 }),
  glass:   new T.MeshStandardMaterial({ color: 0x10141c, metalness: 0.2, roughness: 0.08, envMapIntensity: 1.1 }),
  cable:   new T.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.35, roughness: 0.65, envMapIntensity: 0.35 }),
  lens:    new T.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.6, roughness: 0.05, envMapIntensity: 1.4 })
};

/* ---------- 全局状态 ---------- */
let explode = 0, explodeTarget = 0;
let wire = false;
let pulseOn = true;
let turntable = true;
const clock = new T.Clock();
let simT = 0;

/* ============================================================
   1. 外套膜（MANTLE）
   ============================================================ */
const octo = new T.Group();
scene.add(octo);

const DOME_C = new T.Vector3(0, 0.9, 0);   // 穹顶球心
const DOME_R = 2.3;
const PETALS = 8;
const petalPivots = [];
let petalsGroup;

(function buildMantle() {
  petalsGroup = new T.Group();
  petalsGroup.position.copy(DOME_C);
  octo.add(petalsGroup);

  // 顶部暗色帽（花瓣铰点以上）
  const cap = new T.Mesh(
    new T.SphereGeometry(DOME_R * 1.005, 24, 10, 0, Math.PI * 2, 0, 0.20),
    M.black
  );
  cap.castShadow = true;
  petalsGroup.add(cap);

  // 铰接环圈
  const TH0 = 0.18, TH1 = 1.24, DW = (Math.PI * 2 / PETALS) * 1.32;  // 宽于 1/8 扇区，互相搭接成闭合穹顶
  const rimR = DOME_R * Math.sin(TH0);
  const rim = new T.Mesh(new T.TorusGeometry(rimR, 0.055, 10, 40).rotateX(Math.PI / 2), M.steel);
  rim.position.y = DOME_R * Math.cos(TH0);
  petalsGroup.add(rim);

  for (let i = 0; i < PETALS; i++) {
    const az = i / PETALS * Math.PI * 2;
    const pivotY = new T.Group();
    pivotY.rotation.y = az;
    petalsGroup.add(pivotY);

    // 每片半径微错开，避免搭接区域 z-fighting
    const Rp = DOME_R * (1 + (i % 2) * 0.006);

    // 郁金香铰链：铰点位于环圈上，几何平移到铰点局部坐标
    const hinge = new T.Group();
    hinge.position.set(-Math.sin(TH0) * Rp, Math.cos(TH0) * Rp, 0);
    pivotY.add(hinge);

    const geo = new T.SphereGeometry(Rp, 14, 8, -DW / 2, DW, 0, TH1 - TH0);
    geo.translate(Math.sin(TH0) * Rp, -Math.cos(TH0) * Rp, 0);
    const petalMat = (i % 2 ? M.white : M.white2).clone();
    petalMat.side = T.DoubleSide;
    const petal = new T.Mesh(geo, petalMat);
    petal.castShadow = true;
    hinge.add(petal);

    // 内侧加强筋 + 橙色细条（贴花瓣内表面，铰点局部坐标）
    function detail(theta, phi, w, h, mat, rOff) {
      const mesh = new T.Mesh(new T.BoxGeometry(w, (TH1 - TH0) * Rp * h, 0.045), mat);
      const r = Rp * rOff;
      mesh.position.set(
        -Math.sin(theta) * Math.cos(phi) * r + Math.sin(TH0) * Rp,
        Math.cos(theta) * r - Math.cos(TH0) * Rp,
        Math.sin(theta) * Math.sin(phi) * r
      );
      mesh.rotation.z = theta + Math.PI / 2;
      hinge.add(mesh);
    }
    detail((TH0 + TH1) / 2, 0, 0.05, 0.82, M.blackSoft, 0.965);
    detail((TH0 + TH1) / 2, DW * 0.34, 0.045, 0.5, M.orange, 0.985);

    petalPivots.push(hinge);
  }

  // ---- 深色内碗（承托脑核）----
  const bowl = new T.Mesh(
    new T.SphereGeometry(2.08, 28, 18, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.56),
    new T.MeshStandardMaterial({ color: 0x17181c, metalness: 0.5, roughness: 0.35, side: T.DoubleSide, envMapIntensity: 0.7 })
  );
  bowl.position.copy(DOME_C);
  bowl.castShadow = true;
  octo.add(bowl);
  // 碗口环
  const mouthRing = new T.Mesh(new T.TorusGeometry(2.03, 0.07, 10, 48).rotateX(Math.PI / 2), M.black);
  mouthRing.position.y = DOME_C.y + 0.52;
  octo.add(mouthRing);
  // 赤道衔接带（盖住花瓣与碗口之间的缝）
  const band = new T.Mesh(
    new T.CylinderGeometry(2.10, 2.18, 0.55, 36, 1, true),
    new T.MeshStandardMaterial({ color: 0x1a1b1f, metalness: 0.45, roughness: 0.4, side: T.DoubleSide, envMapIntensity: 0.5 })
  );
  band.position.y = DOME_C.y + 0.2;
  band.castShadow = true;
  octo.add(band);

  // 铆钉带 + 面板细节（黑色盆体上）
  const rivetGeo = new T.SphereGeometry(0.045, 6, 5);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + row * 0.12;
      const y = DOME_C.y + 0.42 - row * 0.5;
      const r = 2.1 - row * 0.06;
      const rv = new T.Mesh(rivetGeo, M.steel);
      rv.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      octo.add(rv);
    }
  }
  // 橙色小面板
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 0.3;
    const pnl = new T.Mesh(new T.BoxGeometry(0.22, 0.3, 0.05), M.orange);
    pnl.position.set(Math.cos(a) * 2.12, DOME_C.y + 0.05, Math.sin(a) * 2.12);
    pnl.rotation.y = -a;
    octo.add(pnl);
  }

  // ---- 正面玻璃舷窗 ----
  const port = new T.Group();
  port.position.set(0, 0.05, 1.72);
  port.rotation.x = -0.25;
  octo.add(port);
  const pRing = new T.Mesh(new T.TorusGeometry(0.62, 0.07, 10, 36), M.orange);
  port.add(pRing);
  const pGlass = new T.Mesh(new T.CircleGeometry(0.55, 32), M.glass);
  pGlass.position.z = 0.02;
  port.add(pGlass);
  for (let s = 0; s < 5; s++) {
    const sp = new T.Mesh(new T.BoxGeometry(0.05, 0.5, 0.03), M.blackSoft);
    sp.rotation.z = s / 5 * Math.PI * 2;
    sp.position.z = 0.05;
    port.add(sp);
  }
})();

/* ============================================================
   2. 脑核（缆线球）+ 泵核
   ============================================================ */
const brain = new T.Group();
brain.position.set(0, 1.35, 0);
octo.add(brain);

(function buildBrain() {
  const rng = mulberry(31);
  for (let i = 0; i < 42; i++) {
    const r = 0.24 + rng() * 0.42;
    const tube = 0.035 + rng() * 0.03;
    const seg = new T.Mesh(new T.TorusGeometry(r, tube, 6, 22, Math.PI * (1.1 + rng() * 1.6)), M.cable);
    seg.position.set((rng() - 0.5) * 1.0, (rng() - 0.5) * 0.9, (rng() - 0.5) * 1.0);
    seg.rotation.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
    brain.add(seg);
  }
  // 直缆线段
  for (let i = 0; i < 26; i++) {
    const len = 0.5 + rng() * 0.9;
    const c = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, len, 6), M.cable);
    c.position.set((rng() - 0.5) * 1.3, (rng() - 0.5) * 1.2, (rng() - 0.5) * 1.3);
    c.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    brain.add(c);
  }
  // 橙色夹扣
  for (let i = 0; i < 16; i++) {
    const cl = new T.Mesh(new T.BoxGeometry(0.09, 0.05, 0.06), M.orange);
    const a = rng() * Math.PI * 2, rr = 0.75 + rng() * 0.5;
    cl.position.set(Math.cos(a) * rr * 0.8, (rng() - 0.5) * 1.5, Math.sin(a) * rr * 0.8);
    cl.rotation.set(rng() * Math.PI, rng() * Math.PI, 0);
    brain.add(cl);
  }
})();

// 泵核反应环 + 7 活塞
const pumpRing = new T.Group();
pumpRing.position.set(0, 0.2, 0);
octo.add(pumpRing);
const pistons = [];
(function buildPump() {
  const ring = new T.Mesh(new T.TorusGeometry(0.78, 0.09, 10, 36).rotateX(Math.PI / 2), M.steel);
  pumpRing.add(ring);
  const core = new T.Mesh(new T.SphereGeometry(0.30, 16, 12), M.orangeGlow);
  pumpRing.add(core);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const pv = new T.Group();
    pv.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
    pumpRing.add(pv);
    const body = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.34, 10), M.black);
    body.position.y = -0.12;
    pv.add(body);
    const rod = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.3, 8), M.steel);
    rod.position.y = 0.1;
    pv.add(rod);
    pistons.push({ rod: rod, a: a });
  }
})();

/* ============================================================
   3. 光学单元 ×2 / 虹吸 / 喙
   ============================================================ */
const optics = [];
(function buildOptics() {
  for (const s of [-1, 1]) {
    const unit = new T.Group();
    unit.position.set(s * 1.18, 0.02, 1.28);
    unit.rotation.set(-0.5, s * 0.55, 0);
    octo.add(unit);
    const barrel = new T.Mesh(new T.CylinderGeometry(0.36, 0.40, 0.85, 20).rotateX(Math.PI / 2), M.white);
    unit.add(barrel);
    const inner = new T.Mesh(new T.CylinderGeometry(0.28, 0.30, 0.6, 18).rotateX(Math.PI / 2), M.black);
    inner.position.z = 0.32;
    unit.add(inner);
    const lensM = new T.Mesh(new T.CylinderGeometry(0.22, 0.24, 0.1, 18).rotateX(Math.PI / 2), M.lens);
    lensM.position.z = 0.66;
    unit.add(lensM);
    const oRing = new T.Mesh(new T.TorusGeometry(0.30, 0.045, 8, 28), M.orangeGlow);
    oRing.position.z = 0.62;
    unit.add(oRing);
    // 红外 LED 环点
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      const led = new T.Mesh(new T.SphereGeometry(0.028, 6, 5), M.orangeGlow);
      led.position.set(Math.cos(a) * 0.36, Math.sin(a) * 0.36, -0.32);
      unit.add(led);
    }
    optics.push({ unit: unit, inner: inner, s: s });
  }
})();

// 虹吸（尾部）
const siphon = new T.Group();
siphon.position.set(0, 0.55, -1.72);
siphon.rotation.x = 0.18;
octo.add(siphon);
(function buildSiphon() {
  const main = new T.Mesh(new T.CylinderGeometry(0.30, 0.36, 1.1, 18).rotateX(Math.PI / 2), M.white);
  main.position.z = -0.55;
  siphon.add(main);
  for (let i = 0; i < 3; i++) {
    const sleeve = new T.Mesh(new T.TorusGeometry(0.30 - i * 0.015, 0.05, 8, 24), M.black);
    sleeve.position.z = -0.35 - i * 0.3;
    siphon.add(sleeve);
  }
  const nozzleGrp = new T.Group();
  nozzleGrp.position.z = -1.15;
  siphon.add(nozzleGrp);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const flap = new T.Mesh(new T.ConeGeometry(0.13, 0.34, 6), M.white2);
    flap.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, -0.14);
    flap.rotation.x = Math.PI / 2;
    flap.rotation.z = -a;
    nozzleGrp.add(flap);
  }
  // 涡轮 12 叶片
  const turbine = new T.Group();
  turbine.position.z = -0.72;
  siphon.add(turbine);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const bl = new T.Mesh(new T.BoxGeometry(0.02, 0.2, 0.08), M.steel);
    bl.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0);
    bl.rotation.z = a;
    turbine.add(bl);
  }
  window.__turbine = turbine;
  window.__nozzle = nozzleGrp;
  // 喷射尾流（珠状气泡）
  const wake = new T.Group();
  wake.position.z = -1.5;
  siphon.add(wake);
  const wakeMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
  const wakeBalls = [];
  for (let i = 0; i < 7; i++) {
    const b = new T.Mesh(new T.SphereGeometry(0.16 + i * 0.05, 8, 6), wakeMat.clone());
    b.position.z = -i * 0.55;
    wake.add(b);
    wakeBalls.push(b);
  }
  window.__wake = { balls: wakeBalls };
})();

// 喙（底部）
const beak = new T.Group();
beak.position.set(0, -1.05, 0);
octo.add(beak);
(function buildBeak() {
  const jawL = new T.Mesh(new T.ConeGeometry(0.30, 0.5, 4), M.black);
  jawL.rotation.z = Math.PI; jawL.rotation.y = 0.4;
  jawL.position.set(-0.08, -0.18, 0);
  beak.add(jawL);
  const jawR = new T.Mesh(new T.ConeGeometry(0.30, 0.5, 4), M.black);
  jawR.rotation.z = Math.PI; jawR.rotation.y = -0.4;
  jawR.position.set(0.08, -0.18, 0);
  beak.add(jawR);
  // 齿舌环（光圈式齿）
  const radula = new T.Group();
  radula.position.y = -0.05;
  beak.add(radula);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const th = new T.Mesh(new T.BoxGeometry(0.05, 0.16, 0.05), M.orange);
    th.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34);
    th.rotation.y = -a;
    radula.add(th);
  }
  window.__radula = radula;
  window.__jaws = [jawL, jawR];
})();

/* ============================================================
   4. 臂毂 + 8 条 25 节机械臂
   ============================================================ */
const HUB_Y = -1.35;
const hub = new T.Group();
hub.position.y = HUB_Y;
octo.add(hub);
(function buildHub() {
  for (let i = 0; i < 3; i++) {
    const ring = new T.Mesh(new T.CylinderGeometry(1.18 - i * 0.1, 1.18 - i * 0.1, 0.14, 28), i % 2 ? M.white2 : M.white);
    ring.position.y = -i * 0.15;
    ring.castShadow = true;
    hub.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const socket = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 0.18, 12), M.black);
    socket.position.set(Math.cos(a) * 0.92, -0.32, Math.sin(a) * 0.92);
    hub.add(socket);
  }
})();

const ARMS = 8, SEGS = 25;
const SEG_L = 0.42;
const MAX_BEND = 26 * Math.PI / 180;
const armRoots = [];
const armJoints = [];   // armJoints[arm][j] = joint group

// 共享几何
const geoSeg = new T.CylinderGeometry(0.185, 0.225, SEG_L * 0.92, 10).rotateX(Math.PI / 2);
const geoJoint = new T.SphereGeometry(0.16, 10, 8);
const geoDisc = new T.CylinderGeometry(0.225, 0.225, 0.06, 12).rotateZ(Math.PI / 2);
const geoORing = new T.TorusGeometry(0.17, 0.02, 6, 18);

function bendEnv(j) {
  if (j < 3) return 0.05;
  return 0.05 + 0.95 * Math.pow((j - 3) / 21, 1.35);
}

for (let i = 0; i < ARMS; i++) {
  const az = i / ARMS * Math.PI * 2 + Math.PI / 8;
  const azRot = new T.Group();
  azRot.rotation.y = az;
  azRot.position.y = HUB_Y - 0.32;
  octo.add(azRot);

  const pitch = new T.Group();
  pitch.rotation.x = Math.PI - 0.42;   // 沿局部 +Z 向下略外张
  azRot.add(pitch);

  const root = new T.Group();
  pitch.add(root);
  armRoots.push({ azRot: azRot, pitch: pitch, root: root, az: az, baseY: pitch.rotation.x });

  const joints = [];
  let parent = root;
  for (let j = 0; j < SEGS; j++) {
    const jt = new T.Group();
    jt.position.z = j === 0 ? 0 : SEG_L;
    parent.add(jt);

    // 关节球
    const ball = new T.Mesh(geoJoint, M.black);
    ball.castShadow = true;
    jt.add(ball);
    // 侧轮盘（黑/橙交替，突出关节簇）
    const disc = new T.Mesh(geoDisc, j % 2 ? M.orange : M.blackSoft);
    disc.position.x = (j % 2 ? 1 : -1) * 0.18;
    jt.add(disc);
    // 白色装甲段
    const seg = new T.Mesh(geoSeg, j % 3 === 2 ? M.white2 : M.white);
    seg.position.z = SEG_L / 2;
    seg.castShadow = true;
    jt.add(seg);
    // 紫橙细环（每 3 节）
    if (j % 3 === 1) {
      const ring = new T.Mesh(geoORing, M.orange);
      ring.position.z = SEG_L * 0.72;
      jt.add(ring);
    }

    joints.push(jt);
    parent = jt;
  }
  // 末端紧螺旋小节
  const tip = new T.Mesh(new T.ConeGeometry(0.1, 0.22, 8).rotateX(Math.PI / 2), M.black);
  tip.position.z = SEG_L;
  parent.add(tip);
  armJoints.push(joints);
}

/* ============================================================
   5. 工具函数 / 音效
   ============================================================ */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wrapHalf = p => p - Math.floor(p + 0.5);
const pulseFn = p => Math.exp(-0.5 * Math.pow(wrapHalf(p) / 0.13, 2));
const smooth = (a, b, x) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const flapFn = p => {
  const s = wrapHalf(p);
  return 0.12 + 0.88 * smooth(-0.13, -0.02, s) * (1 - smooth(0.05, 0.18, s));
};

/* ---------- 音效 ---------- */
let audioCtx = null, jetGain = null, soundOn = false;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const len = audioCtx.sampleRate * 2;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.7;
  jetGain = audioCtx.createGain();
  jetGain.gain.value = 0;
  src.connect(bp); bp.connect(jetGain); jetGain.connect(audioCtx.destination);
  src.start();
  // 伺服底噪
  const hum = audioCtx.createOscillator();
  hum.type = 'sawtooth'; hum.frequency.value = 52;
  const humG = audioCtx.createGain();
  humG.gain.value = 0.012;
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 140;
  hum.connect(lp); lp.connect(humG); humG.connect(audioCtx.destination);
  hum.start();
}

/* ============================================================
   6. 交互（轨道 + 按钮 + HUD）
   ============================================================ */
let dragging = false, px = 0, py = 0, moved = 0;
renderer.domElement.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; py = e.clientY; moved = 0; });
addEventListener('pointermove', e => {
  if (!dragging) return;
  orbit.az -= (e.clientX - px) * 0.005;
  orbit.el += (e.clientY - py) * 0.004;
  px = e.clientX; py = e.clientY;
  moved += Math.abs(e.movementX) + Math.abs(e.movementY);
});
addEventListener('pointerup', () => dragging = false);
addEventListener('wheel', e => {
  orbit.r = Math.max(orbit.minR, Math.min(orbit.maxR, orbit.r * (1 + e.deltaY * 0.001)));
}, { passive: true });

const $ = id => document.getElementById(id);
function setBtn(id, on) { $(id).classList.toggle('on', on); }

$('b-explode').onclick = () => {
  explodeTarget = explodeTarget > 0.5 ? 0 : 1;
  $('b-explode').classList.toggle('hot', explodeTarget > 0.5);
  $('c-explode').classList.toggle('on', explodeTarget > 0.5);
  $('v-op').textContent = explodeTarget > 0.5 ? '操作员 · 整机拆解' : '操作员 · 重组完成';
};
$('b-wire').onclick = () => {
  wire = !wire;
  $('b-wire').classList.toggle('on', wire);
  $('c-wire2').classList.toggle('on', !wire);
  const wf = new T.MeshBasicMaterial({ color: 0x54504a, wireframe: true });
  scene.traverse(o => {
    if (o.isMesh && o.material && !o.material._keep) {
      if (wire) { o.userData.om = o.material; o.material = wf; }
      else if (o.userData.om) { o.material = o.userData.om; }
    }
  });
};
$('b-pulse').onclick = () => {
  pulseOn = !pulseOn;
  $('b-pulse').textContent = pulseOn ? '起搏 ON' : '起搏 OFF';
  $('b-pulse').classList.toggle('hot', pulseOn);
};
$('b-turn').onclick = () => {
  turntable = !turntable;
  $('b-turn').classList.toggle('on', turntable);
  $('c-turn').classList.toggle('on', turntable);
};
$('b-sound').onclick = () => {
  initAudio();
  soundOn = !soundOn;
  $('b-sound').classList.toggle('on', soundOn);
  if (!soundOn && jetGain) jetGain.gain.value = 0;
};

// 喷射负载条
(function () {
  const bar = $('loadbar');
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    if (i >= 22) s.className = 'acc';
    bar.appendChild(s);
  }
  const bb = $('battbar');
  for (let i = 0; i < 10; i++) bb.appendChild(document.createElement('i'));
  const cr = $('curlrows');
  for (let i = 0; i < 8; i++) {
    const nm = i < 4 ? 'R' + (i + 1) : 'L' + (i - 3);
    const row = document.createElement('div');
    row.className = 'curlrow';
    row.innerHTML = '<span class="nm">' + nm + '</span><span class="bar"><b style="width:0%"></b></span><span class="pc">0%</span>';
    cr.appendChild(row);
  }
  // 时间轴刻度
  const tl = $('timeline');
  for (const t of [0, 3.5, 7.5, 10, 12.5, 14.5, 16, 18.5, 21.5]) {
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = (t / 25 * 100) + '%';
    tl.appendChild(tick);
  }
})();

/* ============================================================
   7. 主循环
   ============================================================ */
const LOOP = 25;
let hudTimer = 0;
const modeTag = $('modeTag');

function updateArms(p, e0, t) {
  for (let i = 0; i < ARMS; i++) {
    const A = armRoots[i];
    // 拆解：整臂沿方位向外平移
    const off = e0 * 2.3;
    A.root.position.set(Math.cos(A.az) * off, -e0 * 1.6, Math.sin(A.az) * off);
    A.pitch.rotation.x = A.baseY + e0 * 0.25;

    // 卷曲指令
    const base = 0.55 + e0 * -0.3;
    const amp = 0.32 + e0 * -0.26;
    const curl = Math.max(0.06, Math.min(1, base + amp * pulseFn(p - i / 8)));
    const joints = armJoints[i];
    for (let j = 0; j < SEGS; j++) {
      joints[j].rotation.x = -MAX_BEND * bendEnv(j) * curl * (1 + e0 * 0.1);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  simT += dt;
  const t = simT % LOOP;

  // 心跳相位
  const p = pulseOn ? (simT * 1.8) % 1 : 0.5;
  const pulse = pulseOn ? pulseFn(p) : 0;
  const flap = pulseOn ? flapFn(p) : 0.12;

  // 拆解插值
  if (Math.abs(explode - explodeTarget) > 0.0005) {
    explode += (explodeTarget - explode) * Math.min(1, dt * 2.6);
    if (Math.abs(explode - explodeTarget) < 0.002) explode = explodeTarget;
  }
  const e0 = explode;

  // 整体浮动
  octo.position.y = Math.sin(simT * 0.7) * 0.18;
  octo.rotation.y = turntable && !dragging ? simT * 0.07 : octo.rotation.y;

  // 花瓣：呼吸 + 拆解张开 70°（负向 = 瓣尖向上翻起）
  for (const h of petalPivots) {
    h.rotation.z = -(e0 * 1.20 + pulse * 0.055);
  }
  // 脑核：拆解升起慢转
  brain.position.y = 1.35 + e0 * 0.4;
  brain.rotation.y = simT * 0.22;
  // 泵核
  pumpRing.rotation.y = simT * (1.2 + pulse * 2.2);
  for (const pv of pistons) pv.rod.position.y = 0.1 + pulse * 0.12;
  // 光学对焦
  for (const o of optics) {
    o.inner.position.z = 0.25 + Math.sin(simT * 1.1 + o.s) * 0.07 * (1 - e0) + e0 * 0.35;
    o.unit.position.set(o.s * (1.28 + e0 * 0.9), 0.05 - e0 * 0.3, 1.05 + e0 * 0.7);
  }
  // 虹吸
  if (window.__turbine) window.__turbine.rotation.z = simT * (3 + pulse * 12);
  if (window.__nozzle) window.__nozzle.scale.setScalar(0.8 + flap * 0.35);
  if (window.__wake) {
    window.__wake.balls.forEach((b, k) => {
      const vis = pulseOn ? Math.max(0, pulse - k * 0.12) : 0;
      b.material.opacity = vis * 0.4;
      b.scale.setScalar(0.5 + (1 - vis) * 1.6);
    });
  }
  // 喙
  if (window.__jaws) {
    const open = e0 * 0.5 + pulse * 0.12;
    window.__jaws[0].position.x = -0.08 - open * 0.22;
    window.__jaws[1].position.x = 0.08 + open * 0.22;
  }
  if (window.__radula) window.__radula.rotation.y = simT * (0.8 + pulse * 2);

  // 臂
  updateArms(p, e0, t);

  // 音效
  if (soundOn && jetGain) {
    jetGain.gain.value += ((pulse * flap * 0.30) - jetGain.gain.value) * Math.min(1, dt * 14);
  }

  // HUD（节流）
  hudTimer += dt;
  if (hudTimer > 0.12) {
    hudTimer = 0;
    const load = pulse * flap;
    const P = 93 * pulse, Thr = 210.9 * pulse * flap;
    $('v-load').textContent = Math.round(load * 100) + '%';
    $('v-kpa').textContent = Math.round(P);
    $('v-thrust').textContent = Math.round(Thr);
    const batt = Math.max(82.5, 87 - simT / LOOP * 4.5);
    $('v-batt').textContent = batt.toFixed(1);
    const cells = $('battbar').children;
    for (let i = 0; i < 10; i++) cells[i].className = i < batt / 10 ? 'on' : '';
    $('v-watt').textContent = (9 + load * 40).toFixed(1);
    $('v-temp').textContent = Math.round(22 + simT / LOOP * 7);
    // 臂卷曲条
    const rows = $('curlrows').children;
    for (let i = 0; i < 8; i++) {
      const base = 0.55 + e0 * -0.3, amp = 0.32 + e0 * -0.26;
      const curl = Math.max(0.06, Math.min(1, base + amp * pulseFn(p - i / 8)));
      const pc = Math.round(curl * 100);
      const b = rows[i].querySelector('b'), c = rows[i].querySelector('.pc');
      b.style.width = pc + '%';
      c.textContent = pc + '%';
    }
    $('curlTag').textContent = e0 > 0.5 ? 'DETACHED' : (pulse > 0.45 ? 'CURLING' : 'TRAILING');
    // 深度
    $('v-depth').textContent = (11.96 + Math.sin(simT * 0.3) * 0.5).toFixed(2);
    $('v-vs').textContent = (-0.55 + Math.sin(simT * 0.3) * 0.6).toFixed(2);
    $('v-spd').textContent = (load * 2.87).toFixed(2);
    $('v-pitch').textContent = (-72.7 + Math.sin(simT * 0.5) * 8).toFixed(1);
    // 状态与模式
    const runM = String(Math.floor(simT / 60)).padStart(2, '0');
    const runS = String(Math.floor(simT % 60)).padStart(2, '0');
    $('v-run').textContent = runM + ':' + runS;
    const status = e0 > 0.5 ? '拆解 REASSEMBLY' : (pulse > 0.45 ? '喷射 JETTING' : '保持 STATION');
    $('v-status').textContent = status;
    modeTag.firstElementChild.textContent = e0 > 0.5 ? 'REASSEMBLY' : (pulse > 0.45 ? 'JETTING' : 'STATION');
    modeTag.classList.add('show');
    // 时间轴
    $('cursor').style.left = (t / LOOP * 100) + '%';
    // 子系统 chips
    $('s-pump').textContent = pulse > 0.45 ? '峰值' : '工作';
    $('s-siphon').textContent = flap > 0.6 ? '喷射' : '待机';
  }

  if (turntable && !dragging) { /* 已在上方处理 */ }
  applyCamera();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
