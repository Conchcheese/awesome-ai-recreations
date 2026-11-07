// geometry.js —— 整机由代码建模。本版从零编写，不复用任何既有 geometry 文件。
// 结构：外套膜 / 双光学 / 虹吸 / 喙 / 中央轮毂 / 8 腕 × 25 节。
// 每节腕足是十层机加工装配体；全部用 InstancedMesh 批量绘制。
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  ARMS, LINKS, LINK_LEN, TAU, PETALS, REACTOR_PISTONS,
  WHEELS_PER_ARM, RIVETS_PER_LINK, HUB_Y, HUB_R,
  armAzimuth, hydraulicStroke,
} from './model.js';

const V = () => new THREE.Vector3();
const SHELL_R = 0.0232;                 // 装甲筒半径 46 mm，近景能读出机加工筒身
const SHELL_L = LINK_LEN * 0.80;
const WHEEL_R = 0.0146;
const SIDE_OFF = 0.0282;
const BELLOW_R = 0.0184;
const taper = (j) => 1 - 0.42 * Math.pow(j / (LINKS - 1), 1.7);

function place(geo, {pos = [0, 0, 0], rot = [0, 0, 0], scale = 1} = {}) {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    new THREE.Vector3(scale, scale === 1 ? 1 : scale, scale)
  );
  g.applyMatrix4(m);
  return g;
}
const combine = (list) => mergeGeometries(list, false);

function inst(geo, mat, count, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  m.castShadow = shadow;
  m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const hide = new THREE.Matrix4().compose(
    new THREE.Vector3(0, -99, 0), new THREE.Quaternion(), new THREE.Vector3(0.0001, 0.0001, 0.0001)
  );
  for (let i = 0; i < count; i++) m.setMatrixAt(i, hide);
  m.instanceMatrix.needsUpdate = true;
  return m;
}

// ---------------------------------------------------------------- 外套膜总成
function buildMantle(M) {
  const root = new THREE.Group();
  root.position.y = 0.635;

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.186, 0.052, 40), M.dark);
  collar.castShadow = true; root.add(collar);
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.184, 0.006, 8, 48).rotateX(Math.PI / 2), M.accent);
  collarRing.position.y = -0.020; root.add(collarRing);

  // 8 片球面壳瓣：球面扇形以机体中心为球心，铰链放在赤道外缘，绕切向轴像花瓣一样翻开。
  // （壳瓣几何必须相对铰链平移 -R，否则每片会变成「长在边缘的小球冠」，闭合成不了完整穹顶。）
  const petals = [];
  const PETAL_R = 0.178;
  const gap = 0.050;
  const half = (TAU / PETALS - gap) / 2;
  for (let k = 0; k < PETALS; k++) {
    const az = (k / PETALS) * TAU;
    const hinge = new THREE.Group();
    hinge.rotation.y = az;                       // 局部 +Z 指向该瓣的径向外侧
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.012, PETAL_R);
    const shellGeo = new THREE.SphereGeometry(PETAL_R, 14, 14, Math.PI / 2 - half, half * 2, 0, Math.PI / 2);
    shellGeo.translate(0, 0, -PETAL_R);         // 把球心挪回机体中心
    const shell = new THREE.Mesh(shellGeo, M.white);
    shell.castShadow = true; shell.receiveShadow = true;
    pivot.add(shell);
    // 壳瓣内衬加强肋：三条沿纬线的细弧
    const ribParts = [];
    for (let r = 0; r < 3; r++) {
      const th = 0.38 + r * 0.30;
      ribParts.push(place(
        new THREE.TorusGeometry(Math.sin(th) * PETAL_R * 0.965, 0.0016, 5, 16, half * 1.7),
        {pos: [0, Math.cos(th) * PETAL_R * 0.965, -PETAL_R], rot: [Math.PI / 2, 0, Math.PI / 2 - half * 0.85]}
      ));
    }
    pivot.add(new THREE.Mesh(combine(ribParts), M.whiteSoft));
    // 每瓣下缘 5 颗铆钉
    const rivetParts = [];
    for (let n = 0; n < 5; n++) {
      const a = -half * 0.78 + (n / 4) * half * 1.56;
      rivetParts.push(place(new THREE.SphereGeometry(0.0028, 6, 5),
        {pos: [Math.sin(a) * PETAL_R * 0.98, 0.004, Math.cos(a) * PETAL_R * 0.98 - PETAL_R]}));
    }
    pivot.add(new THREE.Mesh(combine(rivetParts), M.steelDark));
    hinge.add(pivot); root.add(hinge);
    petals.push({pivot, az});
  }

  // 内衬 / 脑核 / 泵核 / 玻璃舷窗
  const liner = new THREE.Mesh(new THREE.SphereGeometry(0.126, 24, 16, 0, TAU, 0, Math.PI / 2), M.dark);
  liner.position.y = 0.012; root.add(liner);
  const brain = new THREE.Group();
  brain.position.y = 0.075;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.070, 20, 14), M.dark);
  brain.add(core);
  const coilParts = [];
  for (let n = 0; n < 22; n++) {
    const a = (n / 22) * TAU;
    coilParts.push(place(new THREE.TorusGeometry(0.070, 0.0026, 5, 22),
      {rot: [a * 0.7, a, a * 0.4]}));
  }
  brain.add(new THREE.Mesh(combine(coilParts), M.steelDark));
  brain.add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), M.accentGlow));
  root.add(brain);

  const reactor = new THREE.Group();
  reactor.position.y = -0.018;
  reactor.add(new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.011, 8, 36).rotateX(Math.PI / 2), M.steel));
  const pistons = [];
  for (let n = 0; n < REACTOR_PISTONS; n++) {
    const a = (n / REACTOR_PISTONS) * TAU;
    pistons.push(place(new THREE.CylinderGeometry(0.008, 0.008, 0.034, 10),
      {pos: [Math.sin(a) * 0.075, 0.012, Math.cos(a) * 0.075], rot: [0, 0, 0.3]}));
  }
  reactor.add(new THREE.Mesh(combine(pistons), M.accent));
  root.add(reactor);

  const port = new THREE.Group();
  port.position.set(0, 0.105, 0.116);
  port.add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.010, 28), M.steel));
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.033, 20, 12, 0, TAU, 0, Math.PI / 2), M.glass);
  glass.rotation.x = Math.PI; port.add(glass);
  const gearParts = [];
  for (let n = 0; n < 24; n++) {
    const a = (n / 24) * TAU;
    gearParts.push(place(new THREE.BoxGeometry(0.005, 0.004, 0.007),
      {pos: [Math.sin(a) * 0.040, 0.006, Math.cos(a) * 0.040], rot: [0, a, 0]}));
  }
  port.add(new THREE.Mesh(combine(gearParts), M.steelDark));
  root.add(port);

  const _v = V();
  function set({open = 0, breath = 0, brainRise = 0, portSpin = 0}) {
    for (const p of petals) p.pivot.rotation.x = open * 1.02;
    brain.position.y = 0.075 + brainRise;
    brain.rotation.y = portSpin * 0.6;
    brain.scale.setScalar(1 + breath * 0.03);
    port.rotation.y = portSpin;
    reactor.rotation.y = -portSpin * 1.4;
    collarRing.material = M.accent;
  }
  return {root, set, portWorld: (v = V()) => port.getWorldPosition(v), brainWorld: (v = V()) => brain.getWorldPosition(v), _v};
}

// ------------------------------------------------------------------ 双光学
function buildOptics(M) {
  const root = new THREE.Group();
  root.position.set(0, 0.585, 0.128);
  const units = [];
  for (let k = 0; k < 2; k++) {
    const sx = k === 0 ? -1 : 1;
    const unit = new THREE.Group();
    unit.position.x = sx * 0.082;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.047, 0.092, 28).rotateX(Math.PI / 2), M.white);
    body.castShadow = true; unit.add(body);
    const rings = [];
    for (let n = 0; n < 3; n++) {
      rings.push(place(new THREE.TorusGeometry(0.0455, 0.0022, 6, 28), {pos: [0, 0, -0.030 + n * 0.026]}));
    }
    unit.add(new THREE.Mesh(combine(rings), M.steelDark));
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.040, 0.006, 8, 32), M.accentDeep);
    bezel.position.z = 0.048; unit.add(bezel);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16, 0, TAU, 0, Math.PI / 2), M.lens);
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.047; unit.add(lens);
    const bore = new THREE.Mesh(new THREE.CircleGeometry(0.013, 20), M.bore);
    bore.position.z = 0.052; unit.add(bore);
    // 虹膜叶片
    const iris = new THREE.Group(); iris.position.z = 0.050;
    const blades = [];
    for (let n = 0; n < 9; n++) {
      const a = (n / 9) * TAU;
      blades.push(place(new THREE.BoxGeometry(0.004, 0.020, 0.0015),
        {pos: [Math.sin(a) * 0.023, Math.cos(a) * 0.023, 0], rot: [0, 0, -a]}));
    }
    iris.add(new THREE.Mesh(combine(blades), M.steel));
    unit.add(iris);
    // 镜筒刻度与铆钉
    const marks = [];
    for (let n = 0; n < 12; n++) {
      const a = (n / 12) * TAU;
      marks.push(place(new THREE.BoxGeometry(0.0022, 0.005, 0.0015),
        {pos: [Math.sin(a) * 0.046, Math.cos(a) * 0.046, 0.010], rot: [0, 0, -a]}));
    }
    unit.add(new THREE.Mesh(combine(marks), M.accent));
    root.add(unit);
    units.push({unit, iris});
  }
  function set({iris = 0}) {
    for (const u of units) { u.iris.rotation.z = iris * 0.9; u.iris.scale.setScalar(1 - iris * 0.42); }
  }
  return {root, set, units};
}

// ------------------------------------------------------------------- 虹吸
function buildSiphon(M) {
  const root = new THREE.Group();
  root.position.set(0, 0.46, -0.16);
  const sleeves = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const r = 0.070 - i * 0.012;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.030, 28).rotateX(Math.PI / 2), M.white));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 6, 28), M.accentDeep));
    const rivets = [];
    for (let n = 0; n < 10; n++) {
      const a = (n / 10) * TAU;
      rivets.push(place(new THREE.SphereGeometry(0.0022, 6, 5),
        {pos: [Math.sin(a) * r, Math.cos(a) * r, 0.012]}));
    }
    g.add(new THREE.Mesh(combine(rivets), M.steelDark));
    root.add(g); sleeves.push(g);
  }
  const flaps = [];
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * TAU;
    const pivot = new THREE.Group(); pivot.rotation.z = a;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.052, 0.006), M.white);
    f.position.set(0.040, 0, -0.018); f.rotation.y = 0.25;
    f.castShadow = true; pivot.add(f);
    root.add(pivot); flaps.push(pivot);
  }
  const turbine = new THREE.Group();
  turbine.position.z = -0.030;
  const blades = [];
  for (let n = 0; n < 12; n++) {
    const a = (n / 12) * TAU;
    blades.push(place(new THREE.BoxGeometry(0.006, 0.040, 0.003),
      {pos: [Math.sin(a) * 0.030, Math.cos(a) * 0.030, 0], rot: [0, 0, -a + 0.5]}));
  }
  turbine.add(new THREE.Mesh(combine(blades), M.steel));
  root.add(turbine);
  function set({extend = 0, spread = 0, spin = 0}) {
    sleeves.forEach((g, i) => { g.position.z = -i * (0.026 + extend * 0.030); });
    for (const f of flaps) f.rotation.x = -(0.06 + spread * 0.85);
    turbine.rotation.z = spin;
  }
  return {root, set, tipWorld: (v = V()) => sleeves[2].getWorldPosition(v)};
}

// --------------------------------------------------------------------- 喙
function buildBeak(M) {
  const root = new THREE.Group();
  root.position.set(0, 0.318, 0.110);
  const jaws = [];
  for (let k = 0; k < 2; k++) {
    const sx = k === 0 ? 1 : -1;
    const g = new THREE.Group();
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.030, 0.070, 4).rotateZ(Math.PI / 2), M.white);
    jaw.rotation.z = sx * 0.35; jaw.castShadow = true; g.add(jaw);
    const teeth = [];
    for (let n = 0; n < 7; n++) {
      teeth.push(place(new THREE.ConeGeometry(0.0035, 0.010, 4),
        {pos: [0.010 + n * 0.007, -0.012, 0], rot: [0, 0, Math.PI]}));
    }
    g.add(new THREE.Mesh(combine(teeth), M.steel));
    root.add(g); jaws.push(g);
  }
  const radula = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 8, 28).rotateX(Math.PI / 2), M.accent);
  radula.position.z = -0.024; root.add(radula);
  function set({jaw = 0, spin = 0}) {
    jaws.forEach((g, i) => {
      const sx = i === 0 ? 1 : -1;
      g.position.x = sx * (0.004 + jaw * 0.062);
      g.rotation.z = -sx * jaw * 0.48;
    });
    radula.rotation.y = spin;
  }
  return {root, set, jawWorld: (v = V()) => jaws[0].getWorldPosition(v)};
}

// ----------------------------------------------------------------- 中央轮毂
function buildHub(M) {
  const root = new THREE.Group();
  root.position.y = HUB_Y;
  const parts = [];
  parts.push(place(new THREE.CylinderGeometry(HUB_R, HUB_R * 0.92, 0.075, 40), {}));
  for (let n = 0; n < 4; n++) {
    parts.push(place(new THREE.TorusGeometry(HUB_R - n * 0.003, 0.0035, 6, 40).rotateX(Math.PI / 2),
      {pos: [0, -0.030 + n * 0.020, 0]}));
  }
  for (let n = 0; n < ARMS; n++) {
    const a = armAzimuth(n);
    parts.push(place(new THREE.BoxGeometry(0.030, 0.024, 0.044),
      {pos: [Math.sin(a) * HUB_R, 0, Math.cos(a) * HUB_R], rot: [0, a, 0]}));
  }
  const body = new THREE.Mesh(combine(parts), M.white);
  body.castShadow = true; root.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(HUB_R + 0.004, 0.007, 8, 40).rotateX(Math.PI / 2), M.accent);
  root.add(ring);
  // 轮毂下缘深色环带：白色机体在浅色影棚里需要一圈硬对比才不「糊」
  const band = new THREE.Mesh(new THREE.CylinderGeometry(HUB_R * 1.012, HUB_R * 1.012, 0.016, 40), M.dark);
  band.position.y = -0.030; root.add(band);

  // 中央躯干：把外套膜、光学、轮毂连成实体，而不是几组漂浮零件
  const torso = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.118, 0.235, 36), M.white);
  shell.position.y = 0.150; shell.castShadow = true; torso.add(shell);
  for (const y of [0.055, 0.145, 0.245]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.110, 0.0038, 8, 36).rotateX(Math.PI / 2), M.steelDark);
    r.position.y = y; torso.add(r);
  }
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.020, 36), M.accent);
  belt.position.y = 0.195; torso.add(belt);
  const gasket = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.104, 0.018, 36), M.dark);
  gasket.position.y = 0.038; torso.add(gasket);
  // 躯干两侧检修板与铆钉列
  for (const sx of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.120, 0.072), M.whiteSoft);
    panel.position.set(sx * 0.105, 0.155, 0); torso.add(panel);
    for (let n = 0; n < 4; n++) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 8, 6), M.steelDark);
      bolt.position.set(sx * 0.109, 0.108 + n * 0.030, 0.026); torso.add(bolt);
    }
  }
  root.add(torso);
  return {root};
}

// ------------------------------------------------------- 8 腕 × 25 节装配体
function buildArms(M) {
  const group = new THREE.Group();
  const N = ARMS * LINKS;

  const shellParts = [
    place(new THREE.CylinderGeometry(SHELL_R, SHELL_R * 0.96, SHELL_L, 18), {}),
    place(new THREE.TorusGeometry(SHELL_R * 0.98, 0.0020, 6, 20).rotateX(Math.PI / 2), {pos: [0, -SHELL_L / 2 + 0.002, 0]}),
    place(new THREE.TorusGeometry(SHELL_R * 0.98, 0.0020, 6, 20).rotateX(Math.PI / 2), {pos: [0, SHELL_L / 2 - 0.002, 0]}),
  ];
  const shells = inst(combine(shellParts), M.white, N);

  // 银法兰：双端环 + 8 颗紧固螺钉 + 中环槽
  const flangeParts = [];
  for (const s of [-1, 1]) {
    flangeParts.push(place(new THREE.TorusGeometry(SHELL_R * 0.995, 0.0016, 6, 20).rotateX(Math.PI / 2),
      {pos: [0, s * (SHELL_L / 2 - 0.0035), 0]}));
    for (let n = 0; n < 8; n++) {
      const a = (n / 8) * TAU;
      flangeParts.push(place(new THREE.CylinderGeometry(0.0009, 0.0009, 0.0014, 5),
        {pos: [Math.sin(a) * SHELL_R * 0.995, s * (SHELL_L / 2 - 0.0035), Math.cos(a) * SHELL_R * 0.995]}));
    }
  }
  flangeParts.push(place(new THREE.TorusGeometry(SHELL_R * 0.955, 0.0008, 4, 20).rotateX(Math.PI / 2), {pos: [0, 0, 0]}));
  const flanges = inst(combine(flangeParts), M.steel, N);

  // 检修板：筒侧一块带边框的浅色板
  const plateParts = [
    place(new THREE.BoxGeometry(0.0016, SHELL_L * 0.52, 0.018), {pos: [SHELL_R * 0.99, 0, 0]}),
    place(new THREE.BoxGeometry(0.0010, SHELL_L * 0.56, 0.020), {pos: [SHELL_R * 0.965, 0, 0]}),
  ];
  const plates = inst(combine(plateParts), M.accentSoft, N);

  // 铆钉 6/节
  const rivetGeo = new THREE.SphereGeometry(0.0018, 6, 5);
  const rivets = inst(rivetGeo, M.steelDark, ARMS * LINKS * RIVETS_PER_LINK);

  // 丝印贴花
  const decals = inst(new THREE.PlaneGeometry(0.024, 0.012), M.decal, N, false);

  // 黑色橡胶波纹万向节：3 道波峰
  const bellowsParts = [];
  for (let n = 0; n < 3; n++) {
    bellowsParts.push(place(new THREE.TorusGeometry(BELLOW_R - n * 0.0006, 0.0030, 6, 18).rotateX(Math.PI / 2),
      {pos: [0, (n - 1) * 0.0034, 0]}));
  }
  const bellows = inst(combine(bellowsParts), M.rubber, N);

  // 滚轮：轮胎 / 钢轮辋 / 8 辐条 / 轮毂 / 中轴 / 宝石蓝端盖
  const WCOUNT = ARMS * WHEELS_PER_ARM;
  const tireGeo = new THREE.TorusGeometry(WHEEL_R * 0.84, 0.0031, 8, 20).rotateX(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(WHEEL_R * 0.68, 0.0016, 6, 20).rotateX(Math.PI / 2);
  const spokeParts = [];
  for (let n = 0; n < 8; n++) {
    spokeParts.push(place(new THREE.BoxGeometry(0.0017, 0.0020, WHEEL_R * 1.30), {rot: [0, (n / 8) * TAU, 0]}));
  }
  const spokeGeo = combine(spokeParts);
  const hubGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.0056, 12);
  const axleGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 0.010, 8);
  const capGeo = new THREE.CylinderGeometry(0.0050, 0.0050, 0.0018, 14);
  const tires = inst(tireGeo, M.rubber, WCOUNT);
  const rims = inst(rimGeo, M.steelDark, WCOUNT);
  const spokes = inst(spokeGeo, M.steel, WCOUNT);
  const hubs = inst(hubGeo, M.steelDark, WCOUNT);
  const axles = inst(axleGeo, M.steel, WCOUNT);
  const caps = inst(capGeo, M.accent, WCOUNT);

  // 液压微缸 + 钢活塞杆 + 线束
  const cylinders = inst(new THREE.CylinderGeometry(0.0032, 0.0032, 0.012, 8), M.steelDark, N);
  const rods = inst(new THREE.CylinderGeometry(0.0013, 0.0013, 0.010, 8), M.steel, N);
  const cables = inst(new THREE.TorusGeometry(0.0032, 0.0009, 5, 10, Math.PI), M.dark, N, false);

  const all = [shells, flanges, plates, rivets, decals, bellows, tires, rims, spokes, hubs,
               axles, caps, cylinders, rods, cables];
  all.forEach((m) => group.add(m));

  // 注意：base / rad / nrm 必须各占一个向量，不能被循环里的临时量覆盖，
  // 否则第一条腕之后所有节段都会漂到错误位置。
  const _pos = V(), _tmp = V(), _base = V(), _rad = V(), _rootRad = V();
  const _dir = V(), _nrm = V(), _scl = V();
  const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _dq = new THREE.Quaternion();
  const _mat = new THREE.Matrix4();
  const _up = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);
  const setM = (mesh, idx, p, q, s) => {
    _mat.compose(p, q, s); mesh.setMatrixAt(idx, _mat);
  };

  function pose(st) {
    const t = st.t;
    const ex = st.opens.explode;
    let iS = 0, iF = 0, iP = 0, iR = 0, iD = 0, iB = 0, iW = 0, iC = 0, iA = 0;
    for (let i = 0; i < ARMS; i++) {
      const az = armAzimuth(i);
      const rad = _rad.set(Math.cos(az), 0, Math.sin(az));
      const nrm = _nrm.set(-Math.sin(az), 0, Math.cos(az)); // 轮轴方向
      const arm = st.arms[i];
      const pts = arm.chain.pts;
      const iso = (i === 1 ? st.opens.isolate : 0);
      const rootAz = az + ex * 0.16 * Math.sin(az * 3.0);
      const rootRad = _rootRad.set(Math.cos(rootAz), 0, Math.sin(rootAz));
      const base = _base.set(0, HUB_Y, 0).addScaledVector(rootRad, HUB_R + 0.028 + ex * 0.26 + iso * 0.10);
      // 拆解时整条腕做刚性抬升，绝不能逐节 sin(j) 抖动（会把 25 节打散成一串散珠）
      const lift = ex * 0.052 * Math.sin(i * 1.7);
      _wq.setFromUnitVectors(_up, nrm);
      for (let j = 0; j < LINKS; j++) {
        const k = taper(j);
        const a = pts[j], b = pts[j + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        _pos.copy(base).addScaledVector(rad, mid[0]).addScaledVector(_up, mid[1] + lift);
        _dir.set(0, 0, 0).addScaledVector(rad, dx).addScaledVector(_up, dy).normalize();
        _q.setFromUnitVectors(_up, _dir);
        _scl.set(k, k, k);

        setM(shells, iS, _pos, _q, _scl); iS++;
        setM(flanges, iF, _pos, _q, _scl); iF++;
        setM(plates, iP, _pos, _q, _scl); iP++;
        // 波纹节放在节首
        _tmp.copy(_pos).addScaledVector(_dir, -LINK_LEN * 0.46);
        setM(bellows, iB++, _tmp, _q, _scl);
        // 铆钉 6 颗，绕筒一周
        for (let n = 0; n < RIVETS_PER_LINK; n++) {
          const ang = (n / RIVETS_PER_LINK) * TAU;
          _tmp.copy(_pos)
            .addScaledVector(nrm, Math.sin(ang) * SHELL_R * k)
            .addScaledVector(_dir, Math.cos(ang) * SHELL_L * 0.32 * k);
          setM(rivets, iR++, _tmp, _q, _scl.set(k, k, k).multiplyScalar(0.85));
        }
        // 丝印贴花朝侧面
        _dq.setFromUnitVectors(_z, nrm);
        _tmp.copy(_pos).addScaledVector(nrm, SHELL_R * 1.02 * k);
        setM(decals, iD++, _tmp, _dq, _scl.set(k, k, k));
        // 液压微缸半嵌筒身，活塞杆只露一小截
        const stroke = hydraulicStroke(i, j, t);
        _tmp.copy(_pos).addScaledVector(_up, 0.0125 * k).addScaledVector(nrm, 0.006 * k);
        setM(cylinders, iC, _tmp, _q, _scl.set(k, k, k)); iC++;
        _tmp.addScaledVector(_dir, 0.0075 * k);
        setM(rods, iC - 1, _tmp, _q, _scl.set(k, k * (0.7 + 0.6 * stroke), k));
        _tmp.copy(_pos).addScaledVector(_up, -0.013 * k);
        setM(cables, iA++, _tmp, _q, _scl.set(k, k, k));

        // 每节左右各一只滚轮（50 只/腕）
        for (const side of [-1, 1]) {
          _tmp.copy(_pos).addScaledVector(nrm, side * SIDE_OFF * k);
          const ws = _scl.set(k, k, k);
          setM(tires, iW, _tmp, _wq, ws);
          setM(rims, iW, _tmp, _wq, ws);
          setM(spokes, iW, _tmp, _wq, ws);
          setM(hubs, iW, _tmp, _wq, ws);
          setM(axles, iW, _tmp, _wq, ws);
          _tmp.addScaledVector(nrm, side * 0.0032 * k);
          setM(caps, iW, _tmp, _wq, ws);
          iW++;
        }
      }
      // 根轮 6 只（前 3 节，略外偏）/ 尖轮 4 只（末 2 节）
      for (let j = 0; j < 3; j++) {
        const k = taper(j) * 0.86;
        const a = pts[j], b = pts[j + 1];
        _dir.set(0, 0, 0).addScaledVector(rad, b[0] - a[0]).addScaledVector(_up, b[1] - a[1]).normalize();
        _pos.copy(base).addScaledVector(rad, (a[0] + b[0]) / 2).addScaledVector(_up, (a[1] + b[1]) / 2 - 0.012 + lift);
        for (const side of [-1, 1]) {
          _tmp.copy(_pos).addScaledVector(nrm, side * SIDE_OFF * 1.16 * k);
          _scl.set(k, k, k);
          setM(tires, iW, _tmp, _wq, _scl); setM(rims, iW, _tmp, _wq, _scl);
          setM(spokes, iW, _tmp, _wq, _scl); setM(hubs, iW, _tmp, _wq, _scl);
          setM(axles, iW, _tmp, _wq, _scl); setM(caps, iW, _tmp, _wq, _scl);
          iW++;
        }
      }
      for (let j = LINKS - 2; j < LINKS; j++) {
        const k = taper(j) * 0.72;
        const a = pts[j], b = pts[j + 1];
        _pos.copy(base).addScaledVector(rad, (a[0] + b[0]) / 2).addScaledVector(_up, (a[1] + b[1]) / 2 + 0.006 + lift);
        for (const side of [-1, 1]) {
          _tmp.copy(_pos).addScaledVector(nrm, side * SIDE_OFF * 0.72 * k);
          _scl.set(k, k, k);
          setM(tires, iW, _tmp, _wq, _scl); setM(rims, iW, _tmp, _wq, _scl);
          setM(spokes, iW, _tmp, _wq, _scl); setM(hubs, iW, _tmp, _wq, _scl);
          setM(axles, iW, _tmp, _wq, _scl); setM(caps, iW, _tmp, _wq, _scl);
          iW++;
        }
      }
    }
    for (const m of all) m.instanceMatrix.needsUpdate = true;
    return iW; // 应等于 480
  }

  return {group, pose, count: WCOUNT};
}

// ------------------------------------------------------------------ 整机装配
export function buildMachine(stage) {
  const M = stage.M;
  const root = new THREE.Group();
  const mantle = buildMantle(M);
  const optics = buildOptics(M);
  const siphon = buildSiphon(M);
  const beak = buildBeak(M);
  const hub = buildHub(M);
  const arms = buildArms(M);
  root.add(mantle.root, optics.root, siphon.root, beak.root, hub.root, arms.group);
  stage.scene.add(root);

  const _v = V();
  function update(st) {
    const t = st.t, o = st.opens, ex = o.explode;
    root.rotation.y = st.turret;
    mantle.root.position.set(0, 0.635 + 0.34 * ex, 0);
    optics.root.position.set(0, 0.585 + 0.30 * ex, 0.128 + 0.34 * ex);
    siphon.root.position.set(0, 0.46 - 0.10 * ex, -0.16 - 0.42 * ex);
    beak.root.position.set(0, 0.318 - 0.30 * ex, 0.110 + 0.12 * ex);
    hub.root.position.y = HUB_Y + 0.06 * ex;

    mantle.set({
      open: o.mantle, breath: st.pulse * 0.5,
      brainRise: 0.020 * o.mantle + 0.06 * ex, portSpin: t * 0.22,
    });
    optics.set({iris: o.optics});
    siphon.set({extend: o.siphon, spread: o.siphon, spin: t * 1.4});
    beak.set({jaw: o.beak, spin: t * 0.55});
    const wheelCount = arms.pose(st);
    if (wheelCount !== arms.count) {
      throw new Error(`滚轮实例数不守恒：${wheelCount} ≠ ${arms.count}`);
    }
  }

  // 3D 引线锚点（世界坐标），供 HUD 标注投影
  const anchors = {
    optics: () => optics.units[0].unit.getWorldPosition(_v.set(0, 0, 0)).clone().add(new THREE.Vector3(0, 0.05, 0.05)),
    mantle: () => mantle.root.getWorldPosition(_v.set(0, 0, 0)).clone().add(new THREE.Vector3(0.10, 0.16, 0)),
    brain: () => mantle.brainWorld(_v.set(0, 0, 0)).clone(),
    siphon: () => siphon.tipWorld(_v.set(0, 0, 0)).clone(),
    beak: () => beak.jawWorld(_v.set(0, 0, 0)).clone(),
    hub: () => hub.root.getWorldPosition(_v.set(0, 0, 0)).clone().add(new THREE.Vector3(0.10, 0, 0.06)),
  };
  return {root, update, anchors, arms};
}
