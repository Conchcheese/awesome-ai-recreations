// HX-18 本体，全部由代码建出来：六边形机身 + 顶盖 + 电池舱 + 传感桅杆，6 条腿 = 18 个钴蓝
// 舵机盒 + 18 根铝管（髋/股/胫）+ 关节帽 + 橡胶脚垫。update(st) 每帧重排实例矩阵：腿的关节
// 点来自 model.js 的闭式解，机身吃高度/俯仰/横滚微动，腿保持垂直解算让脚绝对贴地。
// 支撑脚→质心连线和落脚点圆片也是这里的纯几何（把求解器正在干的事画在地上）。
import * as THREE from 'three';
import {G, LEGS, bodyH, bodyPitch, bodyRoll, legPose, nominalFoot} from './model.js';

const V3 = THREE.Vector3;
// 蓝系色板（风格指南）
export const PAL = {
  hull: '#1d4478', top: '#c9dcec', batt: '#16233a', servo: '#1e5fd6', servoHot: '#12aecb',
  tube: '#b9c4cf', cap: '#8c8fd0', foot: '#2a3540', mast: '#cfd9e2', lens: '#12aecb',
  line: '#3d8fe0', mark: '#1e5fd6', touch: '#57616e',
};
const HERO = 4; // 隔离腿 = R2
const SEG_OFF = [0.05, 0.10, 0.15, 0.20, 0.24, 0.27, 0.31, 0.37]; // 拆解时各部件沿腿外向的漂移
const SEG = 10;
const HOTC = new THREE.Color(2.1, 2.1, 2.1); // 关节焦点亮度（instanceColor > 1 提亮）
const WHITE = new THREE.Color(1, 1, 1);

export function buildHexapod() {
  const root = new THREE.Group();
  const mats = {
    hull: new THREE.MeshStandardMaterial({color: PAL.hull, roughness: 0.5, metalness: 0.55}),
    top: new THREE.MeshStandardMaterial({color: PAL.top, roughness: 0.45, metalness: 0.25}),
    batt: new THREE.MeshStandardMaterial({color: PAL.batt, roughness: 0.55, metalness: 0.3}),
    servo: new THREE.MeshStandardMaterial({color: PAL.servo, roughness: 0.42, metalness: 0.15, transparent: true}),
    servoHot: new THREE.MeshStandardMaterial({color: PAL.servoHot, roughness: 0.35, metalness: 0.1, transparent: true}),
    tube: new THREE.MeshStandardMaterial({color: PAL.tube, roughness: 0.45, metalness: 0.85, transparent: true}),
    cap: new THREE.MeshStandardMaterial({color: PAL.cap, roughness: 0.4, metalness: 0.6, transparent: true}),
    foot: new THREE.MeshStandardMaterial({color: PAL.foot, roughness: 0.9, metalness: 0, transparent: true}),
    mast: new THREE.MeshStandardMaterial({color: PAL.mast, roughness: 0.5, metalness: 0.4}),
    lens: new THREE.MeshStandardMaterial({color: PAL.lens, roughness: 0.3, metalness: 0.2, emissive: PAL.lens, emissiveIntensity: 0.55}),
    mark: new THREE.MeshBasicMaterial({color: PAL.mark, transparent: true, opacity: 0, side: THREE.DoubleSide}),
    touch: new THREE.MeshBasicMaterial({color: PAL.touch, transparent: true, opacity: 0, side: THREE.DoubleSide}),
  };
  for (const k of ['servo', 'servoHot', 'tube', 'cap', 'foot']) mats[k].depthWrite = true;

  // ------------------------------------------------------------ 机身组
  const hull = new THREE.Group();
  root.add(hull);
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.17, 0.055, 6, 1), mats.hull);
  hex.scale.x = 1.42;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.15, 0.012, 6, 1), mats.top);
  top.scale.x = 1.42;
  const batt = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.044, 0.076), mats.batt);
  const battStrip = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.008, 0.018), new THREE.MeshStandardMaterial({color: PAL.servo, roughness: 0.5}));
  battStrip.position.set(0, 0.014, 0.03);
  batt.add(battStrip);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.15, 8), mats.mast);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.036, 0.06), mats.hull);
  const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 12), mats.lens);
  const lensR = lensL.clone();
  lensL.rotation.x = lensR.rotation.x = Math.PI / 2;
  lensL.position.set(-0.013, 0.004, 0.032);
  lensR.position.set(0.013, 0.004, 0.032);
  head.add(lensL, lensR);
  hull.add(hex, top, batt, mast, head);
  // 髋座：机身边缘的 6 个小台
  const mounts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.017, 0.021, 0.018, 10), mats.hull, 6);
  hull.add(mounts);

  // ------------------------------------------------------------ 腿：实例化的舵机盒 / 铝管 / 关节帽 / 脚垫
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const capGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  const footGeo = new THREE.CylinderGeometry(0.013, 0.018, 0.016, 10);
  const NB = 18;
  const servosMain = new THREE.InstancedMesh(boxGeo, mats.servo, NB);
  const servosHero = new THREE.InstancedMesh(boxGeo, mats.servoHot, 3);
  const tubesMain = new THREE.InstancedMesh(tubeGeo, mats.tube, NB);
  const tubesHero = new THREE.InstancedMesh(tubeGeo, mats.tube, 3);
  const capsMain = new THREE.InstancedMesh(capGeo, mats.cap, 12);
  const feetMain = new THREE.InstancedMesh(footGeo, mats.foot, 6);
  const feetHero = new THREE.InstancedMesh(footGeo, mats.foot, 1);
  for (const m of [servosMain, servosHero, tubesMain, tubesHero, capsMain, feetMain, feetHero]) {
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(m);
  }
  // 支撑脚→质心连线（细杆实例，1px 线在 1080p 下看不见）+ 落脚点/接触点圆片（地面上的求解器读数）
  const lineGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const lines = new THREE.InstancedMesh(lineGeo, new THREE.MeshBasicMaterial({color: PAL.line, transparent: true, opacity: 0}), 6);
  lines.frustumCulled = false;
  lines.renderOrder = 1;
  root.add(lines);
  const markGeo = new THREE.CircleGeometry(1, 20);
  markGeo.rotateX(-Math.PI / 2);
  const marks = new THREE.InstancedMesh(markGeo, mats.mark, 6);
  const touches = new THREE.InstancedMesh(markGeo, mats.touch, 6);
  for (const m of [marks, touches]) {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.renderOrder = 1;
    root.add(m);
  }

  // 每条腿的部件索引：主腿按腿序压缩，hero 腿单独走 hero 实例
  const segIdx = (() => {
    const out = [];
    let c = 0;
    for (let i = 0; i < 6; i++) {
      const hero = i === HERO;
      out.push({hero, box: hero ? -1 : c, tube: hero ? -1 : c});
      if (!hero) c++;
    }
    return out;
  })();
  const mainN = 5; // 非 hero 腿数（隔离时）

  const M4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const Y = new V3(0, 1, 0);
  const dir = new V3();
  const mid = new V3();
  const sc = new V3();
  const p6 = [];
  const put = (mesh, idx, ax, ay, az, bx, by, bz, r, isBox, w, h) => {
    dir.set(bx - ax, by - ay, bz - az);
    const L = Math.max(1e-6, dir.length());
    mid.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    q.setFromUnitVectors(Y, dir.multiplyScalar(1 / L));
    if (isBox) {
      mid.addScaledVector(dir, -0.0); // 盒中心在段中点，compose 时再压长度
      sc.set(w, L, h);
    } else sc.set(r, L, r);
    M4.compose(mid, q, sc);
    mesh.setMatrixAt(idx, M4);
  };
  const putFlat = (mesh, idx, x, y, z, s) => {
    mid.set(x, y, z);
    q.identity();
    sc.set(s, 1, s);
    M4.compose(mid, q, sc);
    mesh.setMatrixAt(idx, M4);
  };

  /**
   * st: {p, park, worldX, isoK, jf, legExplode, explode, gaitK}
   * 坐标：root 在世界原点上方（root.position.x = worldX）；腿点 = 机身系 + bodyH 修到地面。
   */
  const update = (st) => {
    const p = st.p;
    const park = st.park ?? 0;
    const bh = bodyH(p, park);
    const pitch = bodyPitch(p);
    const roll = bodyRoll(p);
    hull.position.set(0, bh, 0);
    hull.rotation.set(roll, 0, -pitch); // 横滚绕 x、俯仰绕 z（+x 前进）
    // 拆解：机身件上浮，腿件沿各自腿平面向外上漂
    const ex = st.explode ?? 0;
    hull.position.y += 0.055 * ex;
    top.position.y = 0.0335 + 0.15 * ex;
    batt.position.set(0.02, 0.05 + 0.27 * ex, 0);
    mast.position.set(-0.1, 0.09 + 0.42 * ex, 0);
    head.position.set(-0.1, 0.175 + 0.42 * ex, 0);
    mounts.position.y = -0.024;

    const iso = st.isoK ?? 0;
    const ghost = 1 - 0.9 * iso;
    mats.servo.opacity = ghost;
    mats.tube.opacity = 1 - 0.82 * iso;
    mats.cap.opacity = ghost;
    mats.foot.opacity = ghost;
    mats.hull.transparent = true;
    mats.top.transparent = true;
    mats.hull.opacity = 1 - 0.88 * iso;
    mats.top.opacity = 1 - 0.88 * iso;
    const heroSolid = iso > 0.001;
    servosHero.visible = tubesHero.visible = feetHero.visible = heroSolid;
    servosHero.material.opacity = 1;
    tubesHero.material.opacity = 1;
    feetHero.material.opacity = 1;
    // hero 腿的关节焦点：第三个参数 jf ∈ {0,1,2} 高亮对应舵机
    const jf = st.jf ?? -1;

    let ib = 0, it = 0, ic = 0, ift = 0, hb = 0, ht2 = 0, hf = 0;
    let li = 0;
    for (let i = 0; i < 6; i++) {
      const s = legPose(i, p, {park});
      p6[i] = s;
      const hero = iso > 0.001 && i === HERO;
      const ly = bh; // 机身系 → root 系
      const lx = s.legdir[0], lz = s.legdir[1];
      const outD = new V3(lx, 0.5, lz).normalize(); // 拆解漂移方向（腿平面向外上）
      const e = hero ? (st.legExplode ?? 0) : ex; // 本腿的爆炸量
      const seg = (k) => outD.clone().multiplyScalar(SEG_OFF[k] * e);
      const jointHot = hero && jf >= 0;
      const [M, K0, K, F] = [s.M, s.K0, s.K, s.F];
      const m2 = [M[0], M[1] + ly, M[2]], k02 = [K0[0], K0[1] + ly, K0[2]];
      const k2 = [K[0], K[1] + ly, K[2]], f2 = [F[0], F[1] + ly, F[2]];
      // 三段的方向单位向量（机身系）
      const femd = [Math.cos(s.femur) * lx, Math.sin(s.femur), Math.cos(s.femur) * lz];
      const tibAbs = s.femur - s.bend;
      const tibd = [Math.cos(tibAbs) * lx, Math.sin(tibAbs), Math.cos(tibAbs) * lz];
      const box = (pt, d, len, w, h, joint) => {
        const o = seg(joint);
        const c = [pt[0] + d[0] * len * 0.5 + o.x, pt[1] + d[1] * len * 0.5 + o.y, pt[2] + d[2] * len * 0.5 + o.z];
        const mesh = hero ? servosHero : servosMain;
        const idx = hero ? hb++ : ib++;
        dir.set(d[0], d[1], d[2]);
        mid.set(c[0], c[1], c[2]);
        q.setFromUnitVectors(Y, dir);
        sc.set(w, len, h);
        if (hero && jf === joint) sc.multiplyScalar(1.22);
        M4.compose(mid, q, sc);
        mesh.setMatrixAt(idx, M4);
        if (hero) {
          // 关节焦点逐个高亮（instanceColor 放大亮度）
          const hot = jf === joint;
          mesh.setColorAt(idx, hot ? HOTC : WHITE);
        }
      };
      const tube = (a, b, r, joint) => {
        const o = seg(joint);
        const mesh = hero ? tubesHero : tubesMain;
        const idx = hero ? ht2++ : it++;
        put(mesh, idx, a[0] + o.x, a[1] + o.y, a[2] + o.z, b[0] + o.x, b[1] + o.y, b[2] + o.z, r, false);
      };
      // 髋偏航舵机（盒贴机身）+ 髋段管
      box([M[0] - lx * 0.004, m2[1], M[2] - lz * 0.004], [lx, 0, lz], 0.05, 0.034, 0.042, 0);
      tube(m2, k02, 0.0095, 1);
      // 股节舵机 + 股管
      box(k02, femd, 0.052, 0.032, 0.04, 2);
      tube(k02, k2, 0.0085, 3);
      // 胫节舵机 + 胫管
      box(k2, tibd, 0.05, 0.03, 0.038, 4);
      tube(k2, f2, 0.0068, 5);
      // 关节帽（髋段末端 + 膝）
      const capO1 = seg(1), capO2 = seg(4);
      {
        const mesh = capsMain; // 帽不做 hero 分离，随主管材质淡出
        const i1 = ic++;
        mid.set(k02[0] + capO1.x, k02[1] + capO1.y, k02[2] + capO1.z);
        sc.set(0.013, 0.02, 0.013);
        q.setFromUnitVectors(Y, new V3(femd[0], femd[1], femd[2]));
        M4.compose(mid, q, sc);
        mesh.setMatrixAt(i1, M4);
        const i2 = ic++;
        mid.set(k2[0] + capO2.x, k2[1] + capO2.y, k2[2] + capO2.z);
        sc.set(0.012, 0.018, 0.012);
        q.setFromUnitVectors(Y, new V3(tibd[0], tibd[1], tibd[2]));
        M4.compose(mid, q, sc);
        mesh.setMatrixAt(i2, M4);
      }
      // 脚垫
      {
        const o = seg(6);
        const mesh = hero ? feetHero : feetMain;
        const idx = hero ? hf++ : ift++;
        mid.set(f2[0] + o.x, f2[1] + 0.008 + o.y, f2[2] + o.z);
        q.identity();
        sc.set(1, 1, 1);
        M4.compose(mid, q, sc);
        mesh.setMatrixAt(idx, M4);
      }
      // 地面：支撑脚→质心连线（细杆）+ 接触点；摆动腿画下一个落脚点
      const stance = s.stance && park < 0.5;
      {
        const cxx = f2[0] / 2, czz = f2[2] / 2;
        const len = Math.hypot(f2[0], f2[2]);
        dir.set(f2[0], 0, f2[2]);
        mid.set(cxx, 0.006, czz);
        if (stance && len > 1e-4) {
          q.setFromUnitVectors(Y, dir.multiplyScalar(1 / len));
          sc.set(0.0042, len, 0.0042);
        } else {
          q.identity();
          sc.set(0.0001, 0.0001, 0.0001);
        }
        M4.compose(mid, q, sc);
        lines.setMatrixAt(li++, M4);
      }
      if (stance) {
        putFlat(touches, i, f2[0], 0.004, f2[2], 0.02);
        putFlat(marks, i, 0, -5, 0, 0.001);
      } else {
        putFlat(touches, i, 0, -5, 0, 0.001);
        const nf = nominalFoot(i);
        putFlat(marks, i, nf[0], 0.004, nf[2], 0.028);
      }
    }
    lines.instanceMatrix.needsUpdate = true;
    servosMain.count = ib;
    tubesMain.count = it;
    capsMain.count = ic;
    feetMain.count = ift;
    servosHero.count = hb;
    tubesHero.count = ht2;
    feetHero.count = hf;
    if (servosHero.instanceColor) servosHero.instanceColor.needsUpdate = true;
    for (const m of [servosMain, servosHero, tubesMain, tubesHero, capsMain, feetMain, feetHero]) m.instanceMatrix.needsUpdate = true;
    // 地面读数的透明度：步态视角显示，拆解/停机时淡出
    const g = (st.gaitK ?? 0) * (1 - ex) * (1 - park);
    lines.material.opacity = 0.75 * g;
    mats.mark.opacity = 0.85 * g;
    mats.touch.opacity = 0.5 * g;
    marks.visible = touches.visible = lines.visible = g > 0.02;
    // 静态髋座
    for (let i = 0; i < 6; i++) {
      const L = LEGS[i];
      mid.set(L.mx, -0.024, L.mz);
      q.identity();
      sc.set(1, 1, 1);
      M4.compose(mid, q, sc);
      mounts.setMatrixAt(i, M4);
    }
    mounts.instanceMatrix.needsUpdate = true;
    return {p6, bh};
  };
  root.position.x = 0;
  return {root, update, mats, hull, HERO, lines, marks, touches};
}
