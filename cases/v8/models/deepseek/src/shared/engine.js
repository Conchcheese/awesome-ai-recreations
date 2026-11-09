// ============================================================================
// 01 · V8 发动机 — 3D 装配（DeepSeek 复刻）
// 引擎本地坐标沿用原作口径：毫米；曲轴轴线 = +Z（前端），x 跨列，y 向上。
// 根节点 scale 0.001、rotation.y = −π/2 → 世界坐标：长轴 X、前端 −X、两列 ±Z、落 y=0.115。
// 所有姿态由 shared/model.js 的 pure 函数驱动；本文件只做几何与矩阵。
// 重复件用 merge 合批（目标 draw calls ≈ 130、三角面 < 30 万）；frame 内不新建几何/材质。
// ============================================================================
import * as THREE from 'three';
import {merge, rbox, gear, tube, spring, place} from '../../../../../../shared/mechanical/deepseek-kit/geo.js';
import {E, CYL, BANK, PIN_PHASE, pistonPose, camPeakPhase, valveLift, chargeAtPhase, firingNow} from './model.js';

const D2R = Math.PI / 180;
const ROOT_Y = 0.120; // 曲轴轴线离地高度（m）：油底壳底 −112mm + 3mm 余量
const S = 0.001;

// ---------------------------------------------------------------- 小工具
/** 用 Object3D 生成变换矩阵：t 平移（mm）、r 旋转（rad）、s 缩放 */
function xf({t = [0, 0, 0], r = [0, 0, 0], s = 1} = {}) {
  const o = new THREE.Object3D();
  o.position.fromArray(t);
  o.rotation.set(r[0], r[1], r[2]);
  const sc = Array.isArray(s) ? s : [s, s, s];
  o.scale.fromArray(sc);
  o.updateMatrix();
  return o.matrix.clone();
}
const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b));
/** 把几何烘进某个变换（原地） */
const bake = (geo, m) => (geo.applyMatrix4(m), geo);
/** 合并用的几何归一化：统一成非索引，避免 mergeGeometries 拒绝 */
const norm = (g) => (g.index ? g.toNonIndexed() : g);

/** 同材质几何桶：build 时 merge 成 1 个 mesh */
function bucket() {
  const map = new Map();
  return {
    add(mat, geo) {
      if (!geo) return;
      if (!map.has(mat)) map.set(mat, []);
      map.get(mat).push(geo);
    },
    flush(parent, {cast = true, receive = true} = {}) {
      for (const [mat, geos] of map) {
        const g = merge(geos.map(norm));
        if (!g) continue;
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
        mesh.name = 'bucket-' + (mat.color ? mat.color.getHexString() : 'x');
        parent.add(mesh);
      }
      map.clear();
    },
  };
}

/** 十字曲轴曲柄臂形状：主轴颈毂 + 曲柄销座 + 下方配重扇形（XY 平面，+y = 销方向） */
function webShape() {
  const sh = new THREE.Shape();
  const R = 76;
  sh.moveTo(-R * Math.sin(1.05), -R * Math.cos(1.05));
  sh.absarc(0, 0, R, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05, false);
  sh.lineTo(30, 10);
  sh.absarc(0, E.r, 31, 0, Math.PI, false);
  sh.lineTo(-30, 10);
  sh.closePath();
  return sh;
}

/** V 形隔板轮廓（带曲轴孔） */
function bulkheadShape() {
  const W = 54;
  const arm = (bank, w, d) => {
    const B = BANK[bank];
    return [d * B.b[0] + w * B.p[0], d * B.b[1] + w * B.p[1]];
  };
  const pts = [
    [-95, -70], [95, -70],
    arm('L', W + 18, 40), arm('L', W, E.deck - 12), arm('L', -W, E.deck - 12), [0, 118],
    arm('R', -W, E.deck - 12), arm('R', W, E.deck - 12), arm('R', W + 18, 40),
  ];
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 44, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  return sh;
}

/** 桃形凸轮轮廓：基圆 R14 + 桃尖（+y 方向凸起 8mm），XY 平面 */
function lobeShape() {
  const sh = new THREE.Shape();
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    // 桃尖中心在 +y（a = π/2），半宽约 1.35 rad
    const d = Math.cos(a - Math.PI / 2);
    const bump = d > 0 ? Math.pow(d, 2.6) : 0;
    const r = 14 + 8 * bump;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r + 2;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  return sh;
}

let _sparkTex = null;
/** 程序化紫色光晕纹理（点火 sprite 用） */
function sparkTexture() {
  if (_sparkTex) return _sparkTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.22, 'rgba(196,181,253,0.8)');
  gr.addColorStop(0.55, 'rgba(124,58,237,0.32)');
  gr.addColorStop(1, 'rgba(124,58,237,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  _sparkTex = new THREE.CanvasTexture(c);
  _sparkTex.colorSpace = THREE.SRGBColorSpace;
  return _sparkTex;
}

// ============================================================================
export function buildEngine({materials}) {
  const root = new THREE.Group();
  root.scale.setScalar(S);
  root.rotation.y = -Math.PI / 2;
  root.position.y = ROOT_Y;

  // 材质
  const glassMat = materials.bore.clone();
  glassMat.opacity = 0.2;
  glassMat.envMapIntensity = 1.4;
  const solidMat = new THREE.MeshStandardMaterial({color: 0x241f33, roughness: 0.36, metalness: 0.55});
  const matBlack = materials.dark.clone();
  matBlack.color.setHex(0x0d0c11);
  matBlack.roughness = 0.4;
  matBlack.metalness = 0.38;
  matBlack.clearcoat = 0.32;
  matBlack.clearcoatRoughness = 0.3;
  matBlack.envMapIntensity = 0.72;
  const matMatte = materials.darkSoft;
  const matSteel = materials.steel;
  const matSteelDark = materials.steelDark;
  const matWhite = materials.white;
  const matAccent = new THREE.MeshBasicMaterial({color: 0x9b5cff, transparent: true, opacity: 1, depthWrite: false});
  const matHi = new THREE.MeshBasicMaterial({color: 0x8b5cf6, transparent: true, opacity: 0.9});
  // 排气深炭黑（不带紫调）、弹簧/气门冷白钢
  const matExhaust = new THREE.MeshStandardMaterial({color: 0x1a191e, roughness: 0.5, metalness: 0.45, envMapIntensity: 0.55});
  const matSpring = new THREE.MeshStandardMaterial({color: 0xc7cad2, roughness: 0.3, metalness: 0.9, envMapIntensity: 0.95});
  // 活塞：铝灰（高光但不发白）；中性钢（弹簧座/螺栓/滚子，去掉紫调）
  const matPiston = new THREE.MeshStandardMaterial({color: 0xb9bcc3, roughness: 0.38, metalness: 0.6, envMapIntensity: 0.7});
  const matNeutral = new THREE.MeshStandardMaterial({color: 0x8b8e96, roughness: 0.38, metalness: 0.82, envMapIntensity: 0.8});
  // 气场：进气灰蓝 / 压缩深灰 / 做功宝石紫 / 排气灰紫（紫只留在做功）
  const CHARGE_HEX = [0x9fb0c4, 0x565b66, 0x7c3aed, 0xa9a4b2];
  const chargeMats = CYL.map(() => new THREE.MeshBasicMaterial({color: CHARGE_HEX[0], transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide}));

  // 各层容器
  const assembly = new THREE.Group();
  root.add(assembly);
  const cylLayer = new THREE.Group();
  assembly.add(cylLayer);

  // ---------------------------------------------------------------- 缸体（静态，合批）
  const block = new THREE.Group();
  assembly.add(block);
  {
    const bb = bucket();
    const bh = new THREE.ExtrudeGeometry(bulkheadShape(), {depth: 16, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 1, curveSegments: 18});
    bh.translate(0, 0, -8);
    [236, 112, 0, -112, -236].forEach((z) => bb.add(matBlack, place(bh, {pos: [0, 0, z]})));
    // 两列 deck 梁
    for (const bank of ['L', 'R']) {
      const B = BANK[bank];
      for (const w of [-60, 60]) {
        const x = (E.deck - 18) * B.b[0] + w * B.p[0];
        const y = (E.deck - 18) * B.b[1] + w * B.p[1];
        bb.add(matBlack, place(new THREE.BoxGeometry(14, 16, 488), {pos: [x, y, 0], rot: [0, 0, Math.atan2(B.b[1], B.b[0]) - Math.PI / 2]}));
      }
    }
    // 缸体外侧散热筋（每侧 3 道，沿 z 通长）
    for (const bank of ['L', 'R']) {
      const B = BANK[bank];
      for (let k = 0; k < 3; k++) {
        const d = 88 + k * 30;
        const w = 84;
        const x = d * B.b[0] + w * B.p[0];
        const y = d * B.b[1] + w * B.p[1];
        bb.add(matBlack, place(new THREE.BoxGeometry(9, 5, 476), {pos: [x, y, 0], rot: [0, 0, Math.atan2(B.b[1], B.b[0]) - Math.PI / 2]}));
      }
    }
    // 隔板底部螺栓（沿曲轴箱两侧）
    for (const z of [236, 112, 0, -112, -236]) {
      for (const x of [-78, 78]) bb.add(matSteelDark, place(new THREE.CylinderGeometry(6, 6, 8, 10), {pos: [x, -64, z + 0], rot: [Math.PI / 2, 0, 0]}));
    }
    // 曲轴箱侧壁（实块感）
    for (const x of [-88, 88]) bb.add(matBlack, place(rbox(16, 86, 486, 4, 2), {pos: [x, -32, 0]}));
    // 曲轴箱前后端板（正时齿轮前 / 飞轮后）
    bb.add(matBlack, place(rbox(176, 150, 14, 6, 2), {pos: [0, 16, 250]}));
    bb.add(matBlack, place(rbox(176, 150, 14, 6, 2), {pos: [0, 16, -250]}));
    // 端板螺栓圈
    for (const zz of [250, -250]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        bb.add(matSteelDark, place(new THREE.CylinderGeometry(4, 4, 8, 8), {pos: [Math.cos(a) * 64, 16 + Math.sin(a) * 56, zz + (zz > 0 ? 9 : -9)], rot: [Math.PI / 2, 0, 0]}));
      }
    }
    // 排气汇总管：每列一根，贴着缸体侧面沿 z 通长，尾部向下折出
    for (const bank of ['L', 'R']) {
      const B = BANK[bank];
      const out = bank === 'L' ? 1 : -1;
      const px = 202 * B.sign; // 局部 (x=94, y=deck-30) 经列变换后的引擎 x
      const py = 69;
      bb.add(matExhaust, place(new THREE.CylinderGeometry(14, 14, 468, 18), {pos: [px, py, 0], rot: [Math.PI / 2, 0, 0]}));
      bb.add(matExhaust, place(tube([[px, py, -234], [px, py - 48, -258], [px * 0.86, py - 92, -276]], 12, 22, 8), {}));
      for (const zc of [-168, -56, 56, 168]) {
        bb.add(matExhaust, place(new THREE.CylinderGeometry(16.5, 16.5, 10, 16), {pos: [px, py, zc], rot: [Math.PI / 2, 0, 0]}));
      }
      void B;
    }
    bb.flush(block);
    // 油底壳 / 曲轴箱下缘（更实体）
    const pan = new THREE.Mesh(rbox(210, 50, 486, 10, 4), matMatte);
    pan.position.set(0, -95, 0);
    pan.castShadow = pan.receiveShadow = true;
    block.add(pan);
    const rail = new THREE.Mesh(rbox(230, 16, 504, 5, 2), matBlack);
    rail.position.set(0, -64, 0);
    rail.castShadow = rail.receiveShadow = true;
    block.add(rail);
  }

  // ---------------------------------------------------------------- 曲轴总成（刚体，绕 z 转 −θ）
  let webGeo = null;
  const crank = new THREE.Group();
  assembly.add(crank);
  {
    const black = bucket();
    const steel = bucket();
    const matte = bucket();
    // 曲柄臂（8 片）+ 配重
    webGeo = new THREE.ExtrudeGeometry(webShape(), {depth: 18, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 1, curveSegments: 16});
    webGeo.translate(0, 0, -9);
    E.pinZ.forEach((z, p) => {
      for (const dz of [-34, 34]) {
        black.add(matBlack, place(webGeo, {pos: [0, 0, z + dz], rot: [0, 0, -PIN_PHASE[p] * D2R]}));
      }
    });
    // 曲柄销（θ=0 位置烘死，随组旋转）
    E.pinZ.forEach((z, p) => {
      const a = PIN_PHASE[p] * D2R;
      steel.add(matSteel, place(new THREE.CylinderGeometry(25, 25, 52, 22), {pos: [E.r * Math.sin(a), E.r * Math.cos(a), z], rot: [Math.PI / 2, 0, 0]}));
    });
    // 主轴颈
    [236, 112, 0, -112, -236].forEach((z) => steel.add(matSteel, place(new THREE.CylinderGeometry(30, 30, 42, 24), {pos: [0, 0, z], rot: [Math.PI / 2, 0, 0]})));
    // 正时齿轮 24 齿（斜齿）：节圆半径放大到与 72T 惰轮啮合（44 + 106 ≈ 中心距 150）
    black.add(matBlack, place(gear({radius: 41, teeth: 24, thickness: 22, toothH: 5, toothW: 0.55, hole: 10, twist: 0.35}), {pos: [0, 0, 268], rot: [Math.PI / 2, 0, 0]}));
    // 前端皮带轮 + 多槽 + 螺栓 + 轮毂
    black.add(matBlack, place(new THREE.CylinderGeometry(84, 84, 34, 48), {pos: [0, 0, 312], rot: [Math.PI / 2, 0, 0]}));
    black.add(matBlack, place(new THREE.TorusGeometry(84, 4, 8, 48), {pos: [0, 0, 312]}));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      steel.add(matSteel, place(new THREE.CylinderGeometry(6, 6, 6, 10), {pos: [Math.cos(a) * 52, Math.sin(a) * 52, 330], rot: [Math.PI / 2, 0, 0]}));
    }
    steel.add(matSteelDark, place(gear({radius: 23, teeth: 18, thickness: 50, toothH: 3, toothW: 0.55, hole: 8}), {pos: [0, 0, 342], rot: [Math.PI / 2, 0, 0]}));
    // 飞轮 + 齿圈 + 减重孔
    black.add(matBlack, place(new THREE.CylinderGeometry(150, 150, 22, 64), {pos: [0, 0, -290], rot: [Math.PI / 2, 0, 0]}));
    black.add(matBlack, place(gear({radius: 158, teeth: 120, thickness: 20, toothH: 8, toothW: 0.5, hub: 140}), {pos: [0, 0, -290], rot: [Math.PI / 2, 0, 0]}));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      matte.add(matMatte, place(new THREE.CylinderGeometry(19, 19, 4, 16), {pos: [Math.cos(a) * 96, Math.sin(a) * 96, -301], rot: [Math.PI / 2, 0, 0]}));
    }
    steel.add(matSteel, place(new THREE.CylinderGeometry(14, 14, 40, 12), {pos: [0, 0, -306], rot: [Math.PI / 2, 0, 0]}));
    black.flush(crank);
    steel.flush(crank);
    matte.flush(crank);
    // 前端轮毂细紫环
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(30, 1.4, 6, 44), matHi);
    hubRing.position.z = 352;
    crank.add(hubRing);
  }

  // ---------------------------------------------------------------- 隔离模式：单曲柄销总成（单独 4 组，只在隔离时显示）
  const soloThrows = [];
  {
    const pinGeo = new THREE.CylinderGeometry(25, 25, 52, 22);
    for (let p = 0; p < 4; p++) {
      const g = new THREE.Group();
      for (const dz of [-34, 34]) {
        const w = new THREE.Mesh(webGeo.clone(), matBlack);
        w.position.z = E.pinZ[p] + dz;
        w.rotation.z = -PIN_PHASE[p] * D2R;
        w.castShadow = w.receiveShadow = true;
        g.add(w);
      }
      const a = PIN_PHASE[p] * D2R;
      const pin = new THREE.Mesh(pinGeo, matSteel);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(E.r * Math.sin(a), E.r * Math.cos(a), E.pinZ[p]);
      pin.castShadow = true;
      g.add(pin);
      g.visible = false;
      assembly.add(g);
      soloThrows.push(g);
    }
  }

  // ---------------------------------------------------------------- 前端惰轮（72 齿 ×2，随曲轴 24/72）
  const idlers = ['L', 'R'].map((bank, k) => {
    const B = BANK[bank];
    const g = new THREE.Group();
    // 与曲轴 24T 啮合的中心距 = 44 + 106 = 150（两惰轮仍在 ±45° 方向上）
    g.position.set(150 * B.b[0], 150 * B.b[1], k === 0 ? 262 : 272);
    const mesh = new THREE.Mesh(gear({radius: 106, teeth: 72, thickness: 22, toothH: 5, toothW: 0.5, hole: 30, twist: 0.35}), matBlack);
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    // 轮毂 + 螺栓 + 减重孔
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 30, 24), matMatte);
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    g.add(hub);
    const bolts = [];
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2;
      bolts.push(norm(place(new THREE.CylinderGeometry(5.5, 5.5, 8, 8), {pos: [Math.cos(a) * 20, Math.sin(a) * 20, 15], rot: [Math.PI / 2, 0, 0]})));
    }
    const bm = new THREE.Mesh(merge(bolts), matSteelDark);
    bm.castShadow = true;
    g.add(bm);
    // 轮毂细紫环（1 圈）
    const ring = new THREE.Mesh(new THREE.TorusGeometry(38, 1.4, 6, 40), matHi);
    ring.position.z = 12;
    g.add(ring);
    assembly.add(g);
    return g;
  });

  // ---------------------------------------------------------------- 双弧旋转方向箭头（紫色，0.25 倍速）
  const arcGroup = new THREE.Group();
  arcGroup.position.z = 334;
  assembly.add(arcGroup);
  {
    for (const a0 of [0, Math.PI]) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(108, 6.5, 8, 48, Math.PI * 0.62), matAccent);
      arc.rotation.z = a0;
      const ta = a0 + Math.PI * 0.62;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(15, 34, 16), matAccent);
      tip.position.set(Math.cos(ta) * 108, Math.sin(ta) * 108, 0);
      tip.rotation.z = ta;
      arcGroup.add(arc, tip);
    }
  }

  // ---------------------------------------------------------------- 凸轮轴（每列 1 根，半速；16 桃形烘相位）
  const cams = ['L', 'R'].map((bank) => {
    const B = BANK[bank];
    const g = new THREE.Group();
    g.position.set((E.deck + 90) * B.b[0], (E.deck + 90) * B.b[1], 0);
    const parts = [];
    parts.push(place(new THREE.CylinderGeometry(9, 9, 520, 20), {rot: [Math.PI / 2, 0, 0]}));
    for (const cy of CYL.filter((c) => c.bank === bank)) {
      for (const kind of ['in', 'ex']) {
        const peak = camPeakPhase(cy.c, kind);
        const z = cy.z + (kind === 'in' ? -18 : 18);
        const lobe = new THREE.ExtrudeGeometry(lobeShape(), {depth: 14, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 1, curveSegments: 16});
        lobe.translate(0, 0, -7);
        parts.push(place(lobe, {pos: [0, 0, z], rot: [0, 0, (peak / 2) * D2R]}));
      }
    }
    const mesh = new THREE.Mesh(merge(parts.map(norm)), matBlack);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    const camRing = new THREE.Mesh(new THREE.TorusGeometry(13, 1.2, 6, 32), matHi);
    camRing.position.z = 236;
    g.add(camRing);
    assembly.add(g);
    return g;
  });

  // ---------------------------------------------------------------- 每缸：缸套 / 缸头体块 / 气门 / 活塞 / 连杆 / 气场 / 火花
  const cylParts = CYL.map((cy, i) => {
    const B = BANK[cy.bank];
    const ang = Math.atan2(B.b[1], B.b[0]) - Math.PI / 2;
    const g = new THREE.Group();
    g.position.z = cy.z;
    g.rotation.z = ang;
    cylLayer.add(g);
    const out = cy.bank === 'L' ? 1 : -1;
    const L = ({t = [0, 0, 0], r = [0, 0, 0], s = 1} = {}) => xf({t, r, s});
    let ringMesh = null;

    // --- 玻璃缸套 + 上下环 + 内壁薄环
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(E.bore / 2 + 3, E.bore / 2 + 3, 118, 40, 1, true), glassMat);
    liner.position.y = E.deck - 59;
    liner.renderOrder = 3;
    g.add(liner);
    {
      const rings = merge([
        norm(place(new THREE.TorusGeometry(E.bore / 2 + 4, 3.2, 8, 40), {pos: [0, E.deck - 118, 0], rot: [Math.PI / 2, 0, 0]})),
        norm(place(new THREE.TorusGeometry(E.bore / 2 + 4, 3.2, 8, 40), {pos: [0, E.deck, 0], rot: [Math.PI / 2, 0, 0]})),
      ]);
      const rm = new THREE.Mesh(rings, matBlack);
      rm.castShadow = true;
      rm.receiveShadow = true;
      g.add(rm);
      ringMesh = rm;
      // 内壁薄环：透过玻璃缸套可见
      const inner = new THREE.Mesh(new THREE.TorusGeometry(E.bore / 2 + 0.4, 0.7, 6, 40), matSteelDark);
      inner.rotation.x = Math.PI / 2;
      inner.position.y = E.deck - 59;
      g.add(inner);
    }

    // --- 缸头体块（带缸孔）+ 弹簧座 + 凸轮轴座 + 摇臂 + 排气 + 火花塞
    const bb = bucket();
    {
      // 实心缸头体块（带倒角，不再开孔，避免俯视时像空框）
      bb.add(matBlack, bake(rbox(124, 26, 92, 7, 3), L({t: [0, E.deck + 13, 0]})));
      // 缸头与缸体之间的密封带
      bb.add(matMatte, bake(rbox(130, 6, 96, 3, 1), L({t: [0, E.deck - 1, 0]})));
      // 弹簧座（每气门一个圆台）
      for (const xx of [-out * 21, out * 21]) bb.add(matNeutral, bake(new THREE.CylinderGeometry(16, 19, 8, 20), L({t: [xx, E.deck + 29, 0]})));
      // 凸轮轴座：每缸两块实体轴承座（从缸头顶到凸轮轴线）
      for (const zz of [-48, 48]) bb.add(matBlack, bake(rbox(46, 58, 18, 5, 2), L({t: [0, E.deck + 54, zz]})));
      // 摇臂（厚块，压在气门杆上）+ 滚子
      for (const xx of [-21, 21]) {
        bb.add(matBlack, bake(rbox(18, 8, 72, 3, 2), L({t: [xx, E.deck + 72, 0]})));
        bb.add(matNeutral, bake(new THREE.CylinderGeometry(6.5, 6.5, 8, 12), L({t: [xx, E.deck + 78, -30], r: [Math.PI / 2, 0, 0]})));
      }
      // 排气：短弯管接缸体侧面的汇总管（汇总管在 block 里，沿 z 通长）
      bb.add(matExhaust, bake(tube([[out * 52, E.deck + 6, -20], [out * 76, E.deck - 8, -24], [out * 92, E.deck - 30, -24]], 12, 18, 9), L()));
      // 火花塞（冷白瓷 + 钢，斜插在进排气之间）
      const plug = mul(L({t: [out * 44, E.deck + 22, 0], r: [0, 0, -out * 0.13]}));
      bb.add(matWhite, bake(new THREE.CylinderGeometry(5.0, 5.0, 20, 12), mul(plug, L({t: [0, 16, 0]}))));
      bb.add(matSteel, bake(new THREE.CylinderGeometry(6.6, 6.6, 7, 10), mul(plug, L({t: [0, 5, 0]}))));
      bb.add(matSteel, bake(new THREE.CylinderGeometry(1.8, 1.8, 12, 8), mul(plug, L({t: [0, 31, 0]}))));
      // 缸头螺栓
      for (const xx of [-52, 52]) for (const zz of [-36, 36]) bb.add(matNeutral, bake(new THREE.CylinderGeometry(4.4, 4.4, 12, 10), L({t: [xx, E.deck + 18, zz]})));
      bb.flush(g);
    }

    // --- 气场柱
    const charge = new THREE.Mesh(new THREE.CylinderGeometry(E.bore / 2 - 1, E.bore / 2 - 1, 1, 24, 1, true), chargeMats[i]);
    charge.renderOrder = 2;
    g.add(charge);

    // --- 气门（进：缸谷侧；排：外侧），杆/盘/座合并；小弹簧（冷白钢）
    const valves = ['in', 'ex'].map((kind) => {
      const x = kind === 'in' ? -out * 21 : out * 21;
      const vg = new THREE.Group();
      vg.position.x = x;
      const stem = place(new THREE.CylinderGeometry(3.2, 3.2, 72, 12), {pos: [0, E.deck + 38, 0]});
      const disc = place(new THREE.CylinderGeometry(16, 7, 6, 20), {pos: [0, E.deck + 2, 0]});
      const ret = place(new THREE.CylinderGeometry(13, 13, 4, 16), {pos: [0, E.deck + 64, 0]});
      const vm = new THREE.Mesh(merge([stem, disc, ret].map(norm)), matSpring);
      vm.castShadow = true;
      vm.receiveShadow = true;
      vg.add(vm);
      g.add(vg);
      const sp = new THREE.Group();
      sp.position.set(x, E.deck + 33, 0);
      const sg = merge([
        norm(spring({radius: 9.5, height: 34, turns: 6, wire: 1.9, seg: 10})),
        norm(spring({radius: 6.6, height: 34, turns: 8, wire: 1.4, seg: 9})),
      ]);
      const sm = new THREE.Mesh(sg, matSpring);
      sm.castShadow = true;
      sp.add(sm);
      g.add(sp);
      return {kind, vg, sp};
    });

    // --- 活塞（白）+ 环 + 销
    const pist = new THREE.Group();
    g.add(pist);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(E.bore / 2 - 1.5, E.bore / 2 - 1.5, 62, 36), matPiston);
    body.position.y = E.comp - 31;
    body.castShadow = body.receiveShadow = true;
    pist.add(body);
    {
      const rings = [];
      for (let k = 0; k < 3; k++) rings.push(norm(place(new THREE.TorusGeometry(E.bore / 2 - 1.2, 1.6, 6, 36), {pos: [0, E.comp - 8 - k * 7, 0], rot: [Math.PI / 2, 0, 0]})));
      const rm = new THREE.Mesh(merge(rings), matMatte);
      rm.castShadow = true;
      pist.add(rm);
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, E.bore - 10, 14), matSteel);
    pin.rotation.z = Math.PI / 2;
    pin.castShadow = true;
    pist.add(pin);

    // --- 活塞方向箭头（紫色，图层开关）
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 46, 10), matAccent);
    shaft.position.y = -10;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(11, 26, 12), matAccent);
    tip.position.y = 23;
    arrow.add(shaft, tip);
    arrow.position.set(out * 78, 0, 0);
    arrow.visible = false;
    g.add(arrow);

    // --- 跟踪缸：缸套外环（紫色，只在跟踪缸显示）
    const trackRing = new THREE.Mesh(new THREE.TorusGeometry(E.bore / 2 + 12, 1.8, 6, 44), matHi);
    trackRing.position.y = E.deck - 62;
    trackRing.rotation.x = Math.PI / 2;
    trackRing.visible = false;
    g.add(trackRing);

    // --- 跟踪缸高亮环（紫色细环）
    const hi = new THREE.Mesh(new THREE.TorusGeometry(E.bore / 2 + 2, 1.3, 6, 40), matHi);
    hi.position.y = E.deck + 1.5;
    hi.rotation.x = Math.PI / 2;
    hi.visible = false;
    g.add(hi);

    // --- 点火火花（做功上止点瞬间的紫色辉光）
    const sparkMat = new THREE.MeshBasicMaterial({color: 0xc4b5fd, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
    const spark = new THREE.Mesh(new THREE.SphereGeometry(19, 14, 12), sparkMat);
    spark.position.set(out * 20, E.deck - 6, 8);
    spark.visible = false;
    g.add(spark);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkTexture(), color: 0xa78bfa, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.copy(spark.position);
    halo.scale.setScalar(0.06);
    g.add(halo);

    // --- 连杆（引擎系：两端点定位）
    const rodGeo = merge([
      norm(place(new THREE.BoxGeometry(16, 122, 13), {})),
      norm(place(new THREE.CylinderGeometry(33, 33, 20, 20), {pos: [0, -E.rod / 2, 0], rot: [Math.PI / 2, 0, 0]})),
      norm(place(new THREE.CylinderGeometry(17, 17, 20, 16), {pos: [0, E.rod / 2, 0], rot: [Math.PI / 2, 0, 0]})),
    ]);
    const rod = new THREE.Mesh(rodGeo, matBlack);
    rod.castShadow = rod.receiveShadow = true;
    assembly.add(rod);

    return {cy, g, out, liner, ringMesh, trackRing, charge, valves, pist, rod, arrow, hi, spark, sparkMat, halo};
  });

  // ---------------------------------------------------------------- 材质/剖切状态
  const allSolidMats = [matBlack, matMatte, matSteel, matSteelDark, matWhite, matExhaust, matSpring, matPiston, matNeutral, solidMat, matAccent, matHi];
  let cutMode = 'glass';
  let refractOn = false;
  let clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  let clipMats = [...allSolidMats, glassMat];
  const extraClipMats = [];
  let solo = -1;

  const setRefract = (on) => {
    refractOn = on;
    glassMat.opacity = on ? 0.2 : 0.06;
    glassMat.envMapIntensity = on ? 1.35 : 0.3;
  };
  const applyLinerMaterial = () => {
    const solid = cutMode === 'solid';
    for (const p of cylParts) {
      p.liner.material = solid ? solidMat : glassMat;
      p.liner.visible = true;
    }
    glassMat.opacity = refractOn ? 0.2 : 0.06;
  };
  const setCut = (mode, tracked = 0) => {
    const changed = mode !== cutMode;
    cutMode = mode;
    const section = mode === 'section';
    for (const m of [...clipMats, ...extraClipMats]) {
      m.clippingPlanes = section ? [clipPlane] : null;
      m.needsUpdate = true;
      if (m !== glassMat) m.side = section ? THREE.DoubleSide : THREE.FrontSide;
    }
    if (changed) applyLinerMaterial();
    if (section) {
      // 沿跟踪缸的 z 面切开：世界 x = −z·0.001，保留后半（远离前端）
      const zWorld = -CYL[Math.max(0, Math.min(7, tracked))].z * S;
      clipPlane.distanceToPoint(new THREE.Vector3(zWorld, 0, 0));
      clipPlane.normal.set(1, 0, 0);
      clipPlane.constant = -zWorld;
    }
  };

  // ---------------------------------------------------------------- 隔离：其余部件幽灵化（保留跟踪缸实体）
  const ghostCache = new Map();
  const ghostMat = (base) => {
    if (!ghostCache.has(base)) {
      const m = base.clone();
      m.transparent = true;
      m.opacity = 0.075;
      m.depthWrite = false;
      m.side = THREE.FrontSide;
      ghostCache.set(base, m);
      extraClipMats.push(m);
      if (cutMode === 'section') {
        m.clippingPlanes = [clipPlane];
        m.side = THREE.DoubleSide;
        m.needsUpdate = true;
      }
    }
    return ghostCache.get(base);
  };
  let ghostedList = [];
  const ghostObj = (obj) => {
    obj.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.userData.__mat0) o.userData.__mat0 = o.material;
      o.material = ghostMat(o.userData.__mat0);
      ghostedList.push(o);
    });
  };
  const unghost = () => {
    for (const o of ghostedList) if (o.userData.__mat0) o.material = o.userData.__mat0;
    ghostedList = [];
  };
  let lastSolo = -2;

  // ---------------------------------------------------------------- 每帧姿态
  const D = Math.PI / 180;
  const update = (theta, ops = {}) => {
    const th = theta * D;
    crank.rotation.z = -th;
    arcGroup.rotation.z = -th * 0.25;
    idlers.forEach((g) => (g.rotation.z = th * (24 / 72)));
    cams.forEach((g) => (g.rotation.z = -th / 2));
    const chargeOn = ops.charge ?? 1;
    const arrowsOn = ops.arrows ?? 1;
    const track = ops.track ?? 0;
    solo = ops.solo ?? -1;
    const arrowLayer = arrowsOn > 0.01 && cutMode === 'glass';
    const firing = firingNow(theta);

    cylParts.forEach((p, i) => {
      const {cy, g, charge, valves, pist, arrow, hi} = p;
      const pose = pistonPose(theta, cy.c);
      // 活塞
      pist.position.y = pose.s;
      // 连杆：曲柄销 → 活塞销
      const [px, py] = pose.pinXY;
      const [wx, wy] = [pose.wristPin[0], pose.wristPin[1]];
      p.rod.position.set((px + wx) / 2, (py + wy) / 2, cy.z);
      p.rod.rotation.z = Math.atan2(wy - py, wx - px) - Math.PI / 2;
      // 气场柱
      const crown = pose.s + E.comp;
      charge.position.y = (crown + E.deck) / 2;
      charge.scale.y = Math.max(1, E.deck - crown);
      const key = chargeAtPhase(pose.psi);
      const glow = key === 2 ? Math.min(1, (ops.fire ?? 1) * 0.6 + 0.4) : 0;
      charge.material.color.setHex(CHARGE_HEX[key]);
      charge.material.opacity = chargeOn * (key === 2 ? 0.4 + 0.5 * glow : key === 0 ? 0.085 : 0.07);
      charge.visible = chargeOn > 0.01;
      // 气门 + 弹簧
      for (const v of valves) {
        const lift = valveLift(theta, cy.c, v.kind);
        v.vg.position.y = -lift;
        v.sp.scale.y = (34 - lift) / 34;
      }
      // 箭头：只保留当前做功缸 1 个方向箭头（剖面/实体不显示）
      const arrowOn = arrowLayer && cy.c === firing && Math.abs(pose.vel) > 0.05;
      arrow.visible = arrowOn && solo < 0;
      if (arrowOn) {
        arrow.rotation.z = pose.vel > 0 ? Math.PI : 0;
        arrow.scale.setScalar(arrowsOn * Math.min(1, Math.abs(pose.vel) / 0.5));
        arrow.position.y = E.deck - 70;
      }
      // 点火火花：ψ 在 ±16° 内闪灭
      const ig = pose.psi <= 360 ? pose.psi : pose.psi - 720;
      const flash = ig > -16 && ig < 16 ? 1 - Math.abs(ig) / 16 : 0;
      p.spark.visible = flash > 0.02 && solo < 0;
      if (p.spark.visible) {
        p.spark.scale.setScalar(0.5 + 1.4 * (1 - flash));
        p.sparkMat.opacity = 0.98 * flash;
        p.halo.visible = true;
        p.halo.material.opacity = 0.62 * flash;
        p.halo.scale.setScalar(52 + 46 * (1 - flash));
      } else {
        p.halo.visible = false;
      }
      // 跟踪缸高亮：缸套上下环转宝石紫 + 细环
      if (p.ringMesh) p.ringMesh.material = i === track ? matHi : matBlack;
      hi.visible = i === track && solo < 0;
      p.trackRing.visible = i === track && solo < 0;
      // 隔离
      g.visible = solo < 0 || i === solo;
      p.rod.visible = solo < 0 || i === solo;
    });

    // 隔离：跟踪缸 + 其曲柄销 + 本列凸轮保持实体，其余部件幽灵化
    const iso = solo >= 0;
    block.visible = true;
    crank.visible = true;
    idlers.forEach((g) => (g.visible = true));
    arcGroup.visible = arrowLayer;
    cams.forEach((g) => (g.visible = true));
    const soloPin = iso ? CYL[solo].pin : -1;
    soloThrows.forEach((g, p) => {
      g.visible = iso && p === soloPin;
      g.rotation.z = -th;
    });
    if (solo !== lastSolo) {
      lastSolo = solo;
      unghost();
      if (iso) {
        const keepBank = CYL[solo].bank;
        crank.visible = false;
        idlers.forEach((g) => (g.visible = false));
        arcGroup.visible = false;
        ghostObj(block);
        cams.forEach((g, k) => {
          if ((k === 0 ? 'L' : 'R') !== keepBank) ghostObj(g);
        });
        cylParts.forEach((p, i) => {
          if (i === solo) return;
          ghostObj(p.g);
          ghostObj(p.rod);
        });
      }
    }
  };

  setCut('glass', 0);
  setRefract(true);

  // 引擎坐标（mm）→ 世界（m）
  const worldPoint = (x, y, z) => new THREE.Vector3(-z * S, y * S + ROOT_Y, x * S);

  return {
    root,
    assembly,
    update,
    setCut,
    setRefract,
    // 引擎坐标（mm）→ 世界（m）：世界 x = −z_engine、y = y_engine + 落地高、z = x_engine
    worldPoint,
    anchors: {
      camshaft: (bank = 'L') => worldPoint((E.deck + 90) * BANK[bank].b[0], (E.deck + 90) * BANK[bank].b[1], -40),
      flywheel: worldPoint(120, -40, -290),
      timingGears: worldPoint(150 * BANK.L.b[0], 150 * BANK.L.b[1], 266),
      cylinder: (i) => {
        const cy = CYL[i] || CYL[0];
        const B = BANK[cy.bank];
        return worldPoint(170 * B.b[0], 170 * B.b[1], cy.z);
      },
    },
    materials: {matBlack, matMatte, matSteel, matSteelDark, matWhite, matExhaust, matSpring, glassMat, solidMat, matAccent, matHi, chargeMats},
    state: () => ({cutMode, refractOn, solo}),
  };
}

/** 曲轴销相位（度）→ 引擎 XY 位置（mm），供 HUD 正视图复用 */
export function pinPhaseXY(p) {
  const a = (p * Math.PI) / 180;
  return [E.r * Math.sin(a), E.r * Math.cos(a)];
}
