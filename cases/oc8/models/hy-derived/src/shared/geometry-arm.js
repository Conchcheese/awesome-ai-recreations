// 00 机械章鱼 OC-8 · 宝石蓝版 · 八条腕足（本版重点）
//
// 原作每节是一段白色机加工装甲筒，两端法兰 + 分模环槽 + 铆钉 + 丝印编号，
// 节间是黑色橡胶波纹万向节，两侧各挂一只带辐条的驱动滚轮，滚轮内侧还有
// 液压微缸与走线。末端 16 节渐细并卷成螺旋。
//
// 这里用 ~24 个 InstancedMesh 把 8 × 25 节、480 只滚轮、1200 颗铆钉全部批量绘制；
// 姿态只来自 model.js 的 armChain2D / armJointAngles，不手写任何角度。
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {lathe, cyl, rbox, place, gear} from '../../../../../../shared/mechanical/hy-derived-kit/geo.js';
import {ARMS, LINKS, LINK_LEN, WHEELS_PER_ARM, RIVETS_PER_LINK, HUB_R, HUB_Y, TAU, clamp, armChain2D} from './model.js';

const WHEEL_R = 0.0124;      // 滚轮半径 24.8 mm（原作轮子明显凸出于装甲筒）
const SHELL_R = 0.0182;      // 装甲筒半径 36.4 mm
const SHELL_L = LINK_LEN * 0.80; // 筒长 32 mm，留 8 mm 给黑色波纹万向节
const SIDE_OFF = 0.0226;     // 滚轮中心到臂轴的侧向距离
const AZ = (i) => (i + 0.5) * (TAU / ARMS);
const DECAL_AXIS = new THREE.Vector3(0, 1, 0);
const DECAL_Q = new THREE.Quaternion().setFromAxisAngle(DECAL_AXIS, -1.02);
/** 末端渐细：只收半径，不收节距（局部 X/Z 缩放，Y 保持 1） */
const taper = (j) => 1 - 0.46 * Math.pow(j / (LINKS - 1), 1.7);

const V3 = () => new THREE.Vector3();
const _lat = V3(), _rad = V3(), _dir = V3(), _nrm = V3();
const _up = new THREE.Vector3(0, 1, 0); // 注意：V3() 不接受构造参数，世界向上必须显式 new
const _pos = V3(), _tmp = V3(), _scl = V3(), _q = new THREE.Quaternion();
const _basis = new THREE.Matrix4(), _m4 = new THREE.Matrix4(), _dq = new THREE.Quaternion();
const HIDDEN = new THREE.Vector3(0.00001, 0.00001, 0.00001);
const ONE = new THREE.Vector3(1, 1, 1);

function combine(parts) {
  const gs = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = mergeGeometries(gs, false);
  gs.forEach((g) => g.dispose?.());
  return out;
}

/** 全部实例矩阵初始化成「极小」：未被 pose 写到的实例不会出现在原点 */
function instanced(geo, mat, count, castShadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  m.castShadow = castShadow;
  m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const hide = new THREE.Matrix4().compose(new THREE.Vector3(0, -99, 0), new THREE.Quaternion(), HIDDEN);
  for (let i = 0; i < count; i++) m.setMatrixAt(i, hide);
  m.instanceMatrix.needsUpdate = true;
  return m;
}

/* ---------------------------------------------------------------- 程序化丝印贴花 */
// 4 套编号贴花按节号循环，贴在装甲筒弧面上；全部 canvas 生成，不引用外部图片。
function decalTexture(line1, serial, code) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(20,32,52,0.78)';
  g.lineWidth = 3;
  g.strokeRect(9, 9, 238, 110);
  g.fillStyle = 'rgba(15,82,186,0.92)';
  g.fillRect(9, 9, 238, 13);
  g.fillStyle = 'rgba(20,32,52,0.86)';
  g.font = 'bold 30px "JetBrains Mono", monospace';
  g.fillText(serial, 20, 72);
  g.font = '15px "JetBrains Mono", monospace';
  g.fillText(line1, 20, 96);
  g.fillStyle = 'rgba(20,32,52,0.55)';
  g.font = '11px "JetBrains Mono", monospace';
  g.fillText(code, 150, 58);
  // 条码
  for (let i = 0; i < 16; i++) {
    const w = 1 + ((i * 7 + serial.length * 3) % 4);
    g.fillRect(150 + i * 6, 68, w, 26);
  }
  // 蓝白警示斜纹
  g.save();
  g.beginPath(); g.rect(9, 108, 238, 11); g.clip();
  for (let i = -2; i < 26; i++) {
    g.fillStyle = i % 2 ? 'rgba(15,82,186,0.85)' : 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.moveTo(i * 11, 108); g.lineTo(i * 11 + 6, 108);
    g.lineTo(i * 11 + 1, 119); g.lineTo(i * 11 - 5, 119);
    g.closePath(); g.fill();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildArms(M) {
  const group = new THREE.Group();
  const all = [];
  const inst = (geo, mat, n, shadow = true) => {
    const m = instanced(geo, mat, n, shadow);
    group.add(m); all.push(m);
    return m;
  };

  /* ---------------------------------------------------------------- 装甲筒 */
  // 车削轮廓：端法兰 → 退刀槽 → 筒身两道分模环 → 另一端法兰，全部一次成型。
  const shellGeo = lathe([
    [0.0001, -SHELL_L / 2],
    [SHELL_R * 0.80, -SHELL_L / 2],
    [SHELL_R * 0.97, -SHELL_L / 2 + 0.0018],
    [SHELL_R, -SHELL_L / 2 + 0.0042],
    [SHELL_R, -0.0062],
    [SHELL_R * 0.955, -0.0050],
    [SHELL_R * 0.955, -0.0034],
    [SHELL_R, -0.0022],
    [SHELL_R, 0.0022],
    [SHELL_R * 0.955, 0.0034],
    [SHELL_R * 0.955, 0.0050],
    [SHELL_R, 0.0062],
    [SHELL_R, SHELL_L / 2 - 0.0042],
    [SHELL_R * 0.97, SHELL_L / 2 - 0.0018],
    [SHELL_R * 0.80, SHELL_L / 2],
    [0.0001, SHELL_L / 2],
  ], 22);
  const shell = inst(shellGeo, M.white, ARMS * LINKS);

  // 两端深色端法兰 + 中缝刻线（合并成一个几何，一次 draw call 画完全部环）
  const flangeGeo = combine([
    place(new THREE.TorusGeometry(SHELL_R * 0.995, 0.00170, 6, 20).rotateX(Math.PI / 2), {pos: [0, -SHELL_L / 2 + 0.0035, 0]}),
    place(new THREE.TorusGeometry(SHELL_R * 0.995, 0.00170, 6, 20).rotateX(Math.PI / 2), {pos: [0, SHELL_L / 2 - 0.0035, 0]}),
    place(new THREE.TorusGeometry(SHELL_R * 0.958, 0.00075, 4, 20).rotateX(Math.PI / 2), {pos: [0, 0, 0]}),
    // 法兰上的 8 颗微型紧固螺钉，跟法兰一起批量绘制
    ...Array.from({length: 8}, (_, i) => {
      const a = (i / 8) * TAU;
      return place(new THREE.CylinderGeometry(0.00085, 0.00085, 0.0011, 5),
        {pos: [Math.sin(a) * SHELL_R * 0.995, -SHELL_L / 2 + 0.0035, Math.cos(a) * SHELL_R * 0.995]});
    }),
  ]);
  const flanges = inst(flangeGeo, M.steel, ARMS * LINKS);

  // 端面深色盖板（露出黑色内芯的接缝）
  const endCap = inst(new THREE.CylinderGeometry(SHELL_R * 0.79, SHELL_R * 0.79, 0.0015, 16), M.dark, ARMS * LINKS * 2);

  /* ---------------------------------------------------------------- 铆钉 / 检修板 / 丝印 */
  const rivetGeo = new THREE.SphereGeometry(0.00135, 7, 5);
  const rivets = inst(rivetGeo, M.steel, ARMS * LINKS * RIVETS_PER_LINK);

  // 检修盖板：银色机加工小盖板 + 深色密封边框（两层，近景能看出装配缝）
  const panelGeo = rbox(0.0105, 0.0125, 0.0016, 0.0013, 2);
  const panels = inst(panelGeo, M.steel, ARMS * LINKS);
  const panelRimGeo = rbox(0.0130, 0.0150, 0.0009, 0.0016, 2);
  const panelRims = inst(panelRimGeo, M.darkSoft, ARMS * LINKS);

  // 弧面丝印：CylinderGeometry 的一段 theta，正好贴合筒身
  const decalGeo = new THREE.CylinderGeometry(SHELL_R + 0.00035, SHELL_R + 0.00035, 0.0115, 10, 1, true, -0.62, 1.24);
  const decalSets = [
    {label: 'PELAGOS', serial: '07', code: 'OC8-A'},
    {label: 'MANTLE ', serial: '12', code: 'OC8-B'},
    {label: 'DRIVE  ', serial: '19', code: 'OC8-C'},
    {label: 'TIP    ', serial: '24', code: 'OC8-D'},
  ].map((d) => {
    const mat = new THREE.MeshStandardMaterial({
      map: decalTexture(d.label, d.serial, d.code),
      transparent: true, roughness: 0.72, metalness: 0.02,
      side: THREE.DoubleSide, depthWrite: false, polygonOffset: true,
      polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    return inst(decalGeo, mat, ARMS * Math.ceil(LINKS / 4), false);
  });

  // 宝石蓝识别条（每 4 节一段，贴在 +lat 侧，薄面朝侧向）
  const stripeGeo = rbox(0.0011, 0.0042, 0.013, 0.0005, 2);
  const stripes = inst(stripeGeo, M.accent, ARMS * LINKS);

  /* ---------------------------------------------------------------- 节间：波纹管 + 万向节 + 叉臂 + 液压 */
  // 黑色橡胶波纹管（5 个波）
  const bellowsProfile = [];
  const BZ = 0.0108;
  for (let k = 0; k <= 24; k++) {
    const u = k / 24;
    // 波峰半径略大于装甲筒，节间才能看到明确的黑色橡胶波纹而不是一条细缝
    bellowsProfile.push([0.0152 + 0.0032 * Math.pow(Math.abs(Math.sin(u * Math.PI * 5)), 0.7), -BZ / 2 + u * BZ]);
  }
  const bellows = inst(lathe(bellowsProfile, 16), M.rubber, ARMS * (LINKS + 1));

  // 万向节：黑色球 + 十字轴（合并）
  const jointGeo = combine([
    new THREE.SphereGeometry(0.0078, 10, 8),
    place(new THREE.CylinderGeometry(0.0021, 0.0021, 0.023, 8), {rot: [0, 0, Math.PI / 2]}),
    place(new THREE.CylinderGeometry(0.0021, 0.0021, 0.020, 8), {rot: [Math.PI / 2, 0, 0]}),
  ]);
  const joints = inst(jointGeo, M.dark, ARMS * (LINKS + 1));

  // 两侧叉臂：连接相邻两节，中间正好夹住滚轮轴
  const yokeGeo = combine([
    place(rbox(0.0032, 0.030, 0.0062, 0.0013, 2), {pos: [0.0142, 0, 0]}),
    place(rbox(0.0032, 0.030, 0.0062, 0.0013, 2), {pos: [-0.0142, 0, 0]}),
  ]);
  const yokes = inst(yokeGeo, M.darkSoft, ARMS * (LINKS + 1));

  // 液压微缸（缸体深色 + 活塞杆钢色），每节左右各一根
  const cylGeo = new THREE.CylinderGeometry(0.0026, 0.0029, 0.020, 8);
  const rodGeo = new THREE.CylinderGeometry(0.00125, 0.00125, 0.011, 8);
  const cylinders = inst(cylGeo, M.darkSoft, ARMS * LINKS * 2);
  const rods = inst(rodGeo, M.steel, ARMS * LINKS * 2);

  // 沿腕走的深色线束（每节一小段，串起来像连续软管）
  const cable = inst(new THREE.CylinderGeometry(0.0015, 0.0015, LINK_LEN * 0.94, 7), M.dark, ARMS * LINKS);

  /* ---------------------------------------------------------------- 滚轮组（480 只） */
  // 轮胎 / 辐条盘 / 轮毂 / 中轴：几何统一在 XY 平面法线 +Z，再整体转 90° 使轮轴沿局部 X。
  const tireGeo = new THREE.TorusGeometry(WHEEL_R * 0.83, 0.0031, 8, 20).rotateY(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(WHEEL_R * 0.69, 0.0016, 6, 20).rotateY(Math.PI / 2);
  const spokeParts = [new THREE.TorusGeometry(WHEEL_R * 0.66, 0.0010, 5, 20)];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    spokeParts.push(place(rbox(0.0016, WHEEL_R * 1.32, 0.0019, 0.0005, 1), {rot: [0, 0, a]}));
  }
  spokeParts.push(new THREE.TorusGeometry(WHEEL_R * 0.20, 0.0014, 5, 12));
  const spokeGeo = combine(spokeParts).rotateY(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.0036, 0.0036, 0.0050, 10).rotateZ(Math.PI / 2);
  const axleGeo = new THREE.CylinderGeometry(0.0017, 0.0017, 0.0125, 8).rotateZ(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(0.0024, 0.0024, 0.0020, 10).rotateZ(Math.PI / 2);

  const WCOUNT = ARMS * WHEELS_PER_ARM;
  const tires = inst(tireGeo, M.rubber, WCOUNT);
  const rims = inst(rimGeo, M.steelDark, WCOUNT);
  const spokes = inst(spokeGeo, M.steel, WCOUNT);
  const hubs = inst(hubGeo, M.steelDark, WCOUNT);
  const axles = inst(axleGeo, M.steel, WCOUNT);
  const caps = inst(capGeo, M.accentGlow, WCOUNT);

  /* ---------------------------------------------------------------- 根部 / 末端 */
  const tipGeo = combine([
    place(new THREE.ConeGeometry(0.0125, 0.030, 12), {pos: [0, 0.015, 0]}),
    place(new THREE.SphereGeometry(0.0075, 10, 8), {pos: [0, 0.030, 0]}),
  ]);
  const tips = inst(tipGeo, M.white, ARMS);
  const tipTrim = inst(new THREE.TorusGeometry(0.0118, 0.0016, 6, 16).rotateX(Math.PI / 2), M.accent, ARMS);

  const collarGeo = combine([
    new THREE.TorusGeometry(0.0265, 0.0062, 8, 24).rotateX(Math.PI / 2),
    place(new THREE.TorusGeometry(0.0265, 0.0024, 6, 24).rotateX(Math.PI / 2), {pos: [0, 0.008, 0]}),
  ]);
  const collars = inst(collarGeo, M.white, ARMS);
  const actuator = inst(rbox(0.050, 0.032, 0.042, 0.006, 3), M.dark, ARMS);
  const actTrim = inst(new THREE.TorusGeometry(0.024, 0.0032, 6, 20).rotateX(Math.PI / 2), M.accent, ARMS);
  const rootGear = inst(gear({radius: 0.014, teeth: 12, thickness: 0.006, toothH: 0.0035, hole: 0.004}).rotateX(Math.PI / 2), M.steelDark, ARMS);

  /* ---------------------------------------------------------------- 每帧装配 */
  const chains = [];
  const setM = (mesh, idx, pos, quat, scale) => {
    _m4.compose(pos, quat, scale);
    mesh.setMatrixAt(idx, _m4);
  };
  const hideAt = (mesh, idx) => setM(mesh, idx, _pos.set(0, -99, 0), _q.identity(), HIDDEN);

  /** 由 2D 链的 heading 构造 3D 正交基；写入 _pos/_q/_scl */
  function nodeFrame(c, j, root, radial, lat, taperK) {
    const th = c.headings[Math.min(j, LINKS)];
    _dir.copy(radial).multiplyScalar(Math.cos(th)).addScaledVector(_up, Math.sin(th)).normalize();
    _nrm.crossVectors(lat, _dir).normalize();
    _basis.makeBasis(lat, _dir, _nrm);
    _q.setFromRotationMatrix(_basis);
    _scl.set(taperK, 1, taperK);
  }

  function pose(t, explode = 0, armDetailFn = null) {
    let iShell = 0, iFlange = 0, iCap = 0, iRivet = 0, iPanel = 0, iStripe = 0;
    let iBellows = 0, iJoint = 0, iYoke = 0, iCyl = 0, iRod = 0, iCable = 0;
    let iWheel = 0;
    let iTip = 0, iCollar = 0, iAct = 0, iGear = 0;
    const decalIdx = [0, 0, 0, 0];

    for (let a = 0; a < ARMS; a++) {
      const az = AZ(a);
      const c = armChain2D(a, t);
      chains[a] = c;
      _rad.set(Math.sin(az), 0, Math.cos(az));
      _lat.set(Math.cos(az), 0, -Math.sin(az));
      const root = V3().set(_rad.x * HUB_R + _rad.x * 0.34 * explode,
        HUB_Y + 0.10 * explode,
        _rad.z * HUB_R + _rad.z * 0.34 * explode);

      /* --- 根部：卡箍 / 执行器 / 驱动齿轮 --- */
      nodeFrame(c, 0, root, _rad, _lat, 1);
      _pos.copy(root).addScaledVector(_rad, -0.014);
      setM(collars, iCollar++, _pos, _q, ONE);
      setM(actTrim, iAct, _pos, _q, ONE);
      _tmp.copy(root).addScaledVector(_rad, -0.030).addScaledVector(_up, 0.006);
      setM(actuator, iAct++, _tmp, _q, ONE);
      setM(rootGear, iGear++, _tmp.clone().addScaledVector(_lat, 0.023), _q, ONE);

      /* --- 25 节装甲筒 --- */
      for (let j = 0; j < LINKS; j++) {
        const p0 = c.pts[j], p1 = c.pts[j + 1];
        const k = taper(j);
        nodeFrame(c, j, root, _rad, _lat, k);
        // 用节起止朝向取平均，壳体沿切线摆放更顺
        const thMid = 0.5 * (c.headings[j] + c.headings[j + 1]);
        _dir.copy(_rad).multiplyScalar(Math.cos(thMid)).addScaledVector(_up, Math.sin(thMid)).normalize();
        _nrm.crossVectors(_lat, _dir).normalize();
        _basis.makeBasis(_lat, _dir, _nrm);
        _q.setFromRotationMatrix(_basis);
        _scl.set(k, 1, k);
        _pos.set(root.x + _rad.x * (p0[0] + p1[0]) * 0.5,
          root.y + (p0[1] + p1[1]) * 0.5,
          root.z + _rad.z * (p0[0] + p1[0]) * 0.5);

        setM(shell, iShell++, _pos, _q, _scl);
        setM(flanges, iFlange++, _pos, _q, _scl);
        setM(cable, iCable++, _tmp.copy(_pos).addScaledVector(_nrm, -0.0142 * k), _q, _scl.set(k * 0.9, 1, k * 0.9));
        _scl.set(k, 1, k);

        // 两端深色端盖（圆柱默认沿局部 Y，与筒同轴）
        for (const s of [-1, 1]) {
          setM(endCap, iCap++, _tmp.copy(_pos).addScaledVector(_dir, s * SHELL_L * 0.495), _q, _scl);
        }

        // 6 颗铆钉：两端各 3 颗，绕筒周向分布
        for (let r = 0; r < RIVETS_PER_LINK; r++) {
          const ang = (r % 3) * (TAU / 3) + 0.42;
          const yy = (r < 3 ? -1 : 1) * (SHELL_L * 0.37);
          _tmp.copy(_pos)
            .addScaledVector(_lat, Math.sin(ang) * SHELL_R * 0.985 * k)
            .addScaledVector(_nrm, Math.cos(ang) * SHELL_R * 0.985 * k)
            .addScaledVector(_dir, yy * k);
          setM(rivets, iRivet++, _tmp, _q, _scl.set(k, k, k));
        }
        _scl.set(k, 1, k);

        // 检修盖板（贴在 +nrm 侧）：深色密封框在内、银色盖板在外
        setM(panelRims, iPanel, _tmp.copy(_pos).addScaledVector(_nrm, (SHELL_R * 0.975 - 0.0011) * k), _q, _scl);
        setM(panels, iPanel++, _tmp.copy(_pos).addScaledVector(_nrm, SHELL_R * 0.975 * k), _q, _scl);

        // 丝印贴花：4 套按节号循环，贴在 -lat 侧偏 +nrm 的弧面上
        // 弧面默认朝 +Z(局部 nrm)，绕筒轴转到 -lat 侧，避开检修板
        const di = j % 4;
        _dq.copy(_q).multiply(DECAL_Q);
        setM(decalSets[di], decalIdx[di]++, _tmp.copy(_pos), _dq, _scl);

        // 宝石蓝识别条：每 4 节一段，贴 +lat 侧
        if (j % 4 === 0) {
          setM(stripes, iStripe, _tmp.copy(_pos).addScaledVector(_lat, SHELL_R * 0.99 * k).addScaledVector(_dir, 0.006), _q, _scl);
        } else hideAt(stripes, iStripe);
        iStripe++;

        // 液压微缸：左右各一，活塞杆随该节行程伸缩
        const stroke = armDetailFn ? armDetailFn(t, a, j) : 0.5 + 0.3 * clamp(c.headings[j + 1] - c.headings[j]);
        for (const s of [-1, 1]) {
          // 微缸半嵌在装甲筒表面，活塞杆只露一小截：近景是装配细节而不是「伸出的天线」
          _tmp.copy(_pos).addScaledVector(_lat, s * 0.0136 * k).addScaledVector(_nrm, -0.0105 * k);
          setM(cylinders, iCyl++, _tmp, _q, _scl.set(k, k * (0.8 + 0.2 * stroke), k));
          setM(rods, iRod++, _tmp.clone().addScaledVector(_dir, 0.0075 * k), _q, _scl.set(k, k * (0.7 + 0.65 * stroke), k));
        }
        _scl.set(k, 1, k);
      }

      /* --- 26 个关节节点：波纹管 / 万向节 / 叉臂 --- */
      for (let j = 0; j <= LINKS; j++) {
        const k = taper(Math.min(j, LINKS - 1));
        nodeFrame(c, j, root, _rad, _lat, k);
        const p = c.pts[j];
        _pos.set(root.x + _rad.x * p[0], root.y + p[1], root.z + _rad.z * p[0]);
        setM(bellows, iBellows++, _pos, _q, _scl);
        setM(joints, iJoint++, _pos, _q, _scl);
        setM(yokes, iYoke++, _pos, _q, _scl);
      }

      /* --- 50 只关节滚轮（每节点左右各 1） --- */
      for (let j = 1; j <= LINKS; j++) {
        const k = taper(Math.min(j, LINKS - 1));
        nodeFrame(c, j, root, _rad, _lat, k);
        const p = c.pts[j];
        _pos.set(root.x + _rad.x * p[0], root.y + p[1], root.z + _rad.z * p[0]);
        for (const s of [-1, 1]) {
          _tmp.copy(_pos).addScaledVector(_lat, s * SIDE_OFF * k);
          setM(tires, iWheel, _tmp, _q, _scl);
          setM(rims, iWheel, _tmp, _q, _scl);
          setM(spokes, iWheel, _tmp, _q, _scl);
          setM(hubs, iWheel, _tmp, _q, _scl);
          setM(axles, iWheel, _tmp, _q, _scl);
          setM(caps, iWheel, _tmp, _q, _scl);
          iWheel++;
        }
      }
      // 根部 6 只 + 末端 4 只 = 每腕 60 只（与原作 480 轮一致）
      const extraNodes = [
        [0, 0.000, 0.016], [0, 0.000, -0.016], [0, 0.016, 0.000], [0, -0.016, 0.000],
        [0, 0.000, 0.024], [0, 0.000, -0.024],
        [LINKS, 0.010, 0.008], [LINKS, -0.010, 0.008], [LINKS, 0.010, -0.008], [LINKS, -0.010, -0.008],
      ];
      for (const [j, lo, no] of extraNodes) {
        const k = taper(Math.min(j, LINKS - 1));
        nodeFrame(c, j, root, _rad, _lat, k);
        const p = c.pts[j];
        _tmp.set(root.x + _rad.x * p[0], root.y + p[1], root.z + _rad.z * p[0])
          .addScaledVector(_lat, lo * k).addScaledVector(_nrm, no * k);
        setM(tires, iWheel, _tmp, _q, _scl);
        setM(rims, iWheel, _tmp, _q, _scl);
        setM(spokes, iWheel, _tmp, _q, _scl);
        setM(hubs, iWheel, _tmp, _q, _scl);
        setM(axles, iWheel, _tmp, _q, _scl);
        setM(caps, iWheel, _tmp, _q, _scl);
        iWheel++;
      }

      /* --- 末端锥头 --- */
      {
        const k = taper(LINKS - 1);
        nodeFrame(c, LINKS, root, _rad, _lat, k);
        const p = c.pts[LINKS];
        _tmp.set(root.x + _rad.x * p[0], root.y + p[1], root.z + _rad.z * p[0]).addScaledVector(_dir, 0.004);
        setM(tips, iTip, _tmp, _q, _scl);
        setM(tipTrim, iTip, _tmp.clone().addScaledVector(_dir, 0.004), _q, _scl);
        iTip++;
      }
    }

    // 未用到的贴花实例隐藏（按 j%4 分配，4 组数量不等）
    for (let d = 0; d < 4; d++) {
      const m = decalSets[d];
      for (let i = decalIdx[d]; i < m.count; i++) hideAt(m, i);
    }
    for (const m of all) m.instanceMatrix.needsUpdate = true;
    return iWheel; // 断言用：应等于 480
  }

  return {
    group, pose, chains,
    counts: {shell: ARMS * LINKS, wheels: WCOUNT, rivets: ARMS * LINKS * RIVETS_PER_LINK},
  };
}
