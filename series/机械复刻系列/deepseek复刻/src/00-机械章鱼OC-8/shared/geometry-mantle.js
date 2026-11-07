// 00 机械章鱼 OC-8 · 外套膜：深色盆体 + 白色铆钉带 + 8 片球面壳瓣 + 脑核线缆团 + 泵核 + 正面玻璃舷窗。
// 壳瓣是球面曲面板（带圆润外缘），闭合时合成光滑穹顶，打开时绕底部铰链向外下方翻 70°。
// 全部由 set({petalAngle, brainRise, brainTurn, breath, portSpin, open}) 驱动。单位米，正面 +Z。
import * as THREE from 'three';
import {lathe, ring, gear, bevelCyl, tube} from '../../kit/geo.js';
import {mulberry32, TAU} from '../../kit/util.js';

const R = 0.145; // 壳半径（外套膜直径 300 mm）
const DOME_H = 0.22; // 铰链面到壳顶
const HINGE_Y = -0.02; // 铰链面局部高度（世界 0.60）
const PETALS = 8;
const GAP = 0.012; // 花瓣缝（弧度，约 1.7 mm）
const THETA0 = 0.14; // 顶部留出的小盖角度（球面片从 8° 开始）

export function buildMantle(M) {
  const petalMat = M.white.clone();
  petalMat.side = THREE.DoubleSide; // 壳瓣是薄板，打开后要从内侧也看得见
  const root = new THREE.Group();
  root.position.y = 0.62;

  const add = (geo, mat, {pos = [0, 0, 0], rot = [0, 0, 0], scale = 1} = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    if (Array.isArray(scale)) m.scale.set(...scale);
    else m.scale.setScalar(scale);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  /* ---------------------------------------------------------------- 深色盆体 / 内碗 */
  add(lathe([[0.02, -0.205], [0.06, -0.197], [0.11, -0.172], [0.14, -0.138], [0.15, -0.105]], 48), M.dark);
  const inner = new THREE.Mesh(lathe([[0.02, 0.085], [0.06, 0.06], [0.1, 0.025], [0.13, -0.005], [0.143, -0.02]], 48), M.darkSoft);
  inner.material = M.darkSoft;
  inner.material.side = THREE.DoubleSide;
  inner.receiveShadow = true;
  root.add(inner);

  /* ---------------------------------------------------------------- 白色铆钉带 */
  add(lathe([[0.147, -0.108], [0.151, -0.075], [0.151, -0.04], [0.149, -0.023], [0.145, -0.02]], 48), M.white);
  add(ring(0.149, 0.132, 0.008, 48), M.white, {pos: [0, HINGE_Y, 0]});
  add(ring(0.1505, 0.1478, 0.0035, 48), M.accent, {pos: [0, -0.036, 0]});
  {
    const g = new THREE.SphereGeometry(0.0042, 8, 6);
    const bolts = new THREE.InstancedMesh(g, M.dark, 40);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      m4.makeTranslation(Math.sin(a) * 0.151, -0.062, Math.cos(a) * 0.151);
      bolts.setMatrixAt(i, m4);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.1;
      m4.makeTranslation(Math.sin(a) * 0.147, HINGE_Y + 0.007, Math.cos(a) * 0.147);
      bolts.setMatrixAt(24 + i, m4);
    }
    bolts.castShadow = true;
    root.add(bolts);
  }

  /* ---------------------------------------------------------------- 8 片球面壳瓣 */
  const petals = [];
  const azStep = TAU / PETALS;
  const petalBase = (() => {
    const halfBase = (azStep - GAP) / 2;
    const NU = 10;
    const NV = 14;
    const pos = [];
    const idx = [];
    const thetaAt = (v) => THETA0 + (Math.PI / 2 - THETA0) * v;
    const widenAt = (v) => 1 + 0.16 * (1 - v); // 外缘加宽 ~16%，尖端更圆润
    const ptAt = (v, phi) => {
      const theta = thetaAt(v);
      const r = R * Math.sin(theta);
      return [-r * Math.cos(phi), DOME_H * Math.cos(theta), r * Math.sin(phi)];
    };
    for (let v = 0; v <= NV; v++) {
      const vv = v / NV;
      const half = halfBase * widenAt(vv);
      for (let u = 0; u <= NU; u++) {
        const phi = (u / NU - 0.5) * 2 * half;
        pos.push(...ptAt(vv, phi));
      }
    }
    for (let v = 0; v < NV; v++) {
      for (let u = 0; u < NU; u++) {
        const a = v * (NU + 1) + u;
        const b = a + 1;
        const c = a + NU + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const parts = [g];
    // 外缘一圈圆角包边（倒圆尖端）
    const rimPts = [];
    for (let u = 0; u <= 16; u++) {
      const phi = (u / 16 - 0.5) * 2 * halfBase * widenAt(0);
      rimPts.push(ptAt(0, phi));
    }
    parts.push(tube(rimPts, 0.0095, 18, 6));
    // 两条侧边包边
    for (const side of [-1, 1]) {
      const pts = [];
      for (let v = 0; v <= 14; v++) {
        const vv = v / 14;
        const half = halfBase * widenAt(vv);
        pts.push(ptAt(vv, side * half));
      }
      parts.push(tube(pts, 0.006, 14, 5));
    }
    return mergeGeo(parts);
  })();

  const hingeAxis = new THREE.Vector3();
  for (let i = 0; i < PETALS; i++) {
    const az = i * azStep;
    const pivot = new THREE.Group();
    pivot.position.set(Math.sin(az) * R, HINGE_Y, Math.cos(az) * R);
    root.add(pivot);

    const geo = petalBase.clone();
    geo.rotateY(az + Math.PI / 2);
    const petal = new THREE.Mesh(geo, petalMat);
    petal.position.set(-Math.sin(az) * R, 0, -Math.cos(az) * R);
    petal.castShadow = true;
    petal.receiveShadow = true;
    pivot.add(petal);

    // 花瓣中段偏下的紫色条块（原作橙色块 → 宝石紫）
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.005), M.accent);
    strip.position.set(-Math.sin(az) * 0.016, 0.1, -Math.cos(az) * 0.016);
    strip.rotation.y = az;
    pivot.add(strip);


    petals.push({pivot, az});
  }

  // 顶部下凹舱口：贴合穹顶顶面，打开时缩进去
  const topCap = new THREE.Group();
  topCap.position.y = DOME_H + HINGE_Y - 0.002;
  root.add(topCap);
  {
    const capRing = new THREE.Mesh(ring(0.052, 0.028, 0.009, 32), M.white);
    capRing.castShadow = true;
    topCap.add(capRing);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.014, 24), M.dark);
    well.position.y = -0.006;
    topCap.add(well);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.0285, 0.0018, 6, 24).rotateX(Math.PI / 2), M.accent);
    trim.position.y = 0.004;
    topCap.add(trim);
  }

  /* ---------------------------------------------------------------- 脑核：黑色线缆团 + 紫夹扣 */
  const brain = new THREE.Group();
  brain.position.y = 0.045;
  root.add(brain);
  {
    const rand = mulberry32(20261103);
    const cableGeo = new THREE.TorusGeometry(1, 0.1, 4, 8, Math.PI * (0.9 + rand() * 1.2));
    const cables = new THREE.InstancedMesh(cableGeo, M.darkSoft, 84);
    cables.castShadow = true;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < 84; i++) {
      e.set(rand() * TAU, rand() * TAU, rand() * TAU);
      q.setFromEuler(e);
      const rad = 0.014 + rand() * 0.02;
      p.set((rand() - 0.5) * 0.095, (rand() - 0.5) * 0.075, (rand() - 0.5) * 0.095);
      s.set(rad, rad, rad * (0.7 + rand() * 0.6));
      m4.compose(p, q, s);
      cables.setMatrixAt(i, m4);
    }
    cables.instanceMatrix.needsUpdate = true;
    brain.add(cables);

    const clipGeo = new THREE.BoxGeometry(0.011, 0.005, 0.008);
    const clips = new THREE.InstancedMesh(clipGeo, M.accent, 4);
    for (let i = 0; i < 4; i++) {
      e.set(rand() * TAU, rand() * TAU, rand() * TAU);
      q.setFromEuler(e);
      p.set((rand() - 0.5) * 0.1, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.1);
      m4.compose(p, q, s.set(1, 1, 1));
      clips.setMatrixAt(i, m4);
    }
    clips.castShadow = true;
    brain.add(clips);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 14), M.dark);
    core.castShadow = true;
    brain.add(core);
  }

  /* ---------------------------------------------------------------- 泵核（反应环 + 7 活塞） */
  const reactor = new THREE.Group();
  reactor.position.y = 0.005;
  root.add(reactor);
  {
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.0075, 8, 32).rotateX(Math.PI / 2), M.accent);
    reactor.add(ringMesh);
    const piston = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.026, 10), M.steel, 7);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      m4.makeTranslation(Math.cos(a) * 0.072, 0.012, Math.sin(a) * 0.072);
      piston.setMatrixAt(i, m4);
    }
    piston.castShadow = true;
    reactor.add(piston);
  }

  /* ---------------------------------------------------------------- 正面玻璃舷窗（低位于前下方，Ø120） */
  const port = new THREE.Group();
  port.position.set(0, -0.132, 0.137);
  root.add(port);
  {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.067, 0.048, 36), M.white);
    housing.rotation.x = Math.PI / 2;
    housing.position.z = 0.002;
    housing.castShadow = true;
    port.add(housing);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.061, 0.006, 10, 40), M.white);
    lip.position.z = 0.028;
    port.add(lip);
    // 深色舷窗玻璃：不透明的深色亮面，内部机构以近黑剪影 + 紫圈呈现
    const lensMat = M.lens.clone();
    lensMat.color.set(0x0b0813);
    lensMat.envMapIntensity = 0.7;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.01, 36), lensMat);
    glass.rotation.x = Math.PI / 2;
    glass.position.z = 0.029;
    port.add(glass);
    const innerGear = new THREE.Mesh(gear({radius: 0.031, teeth: 14, thickness: 0.004, toothH: 0.004, hole: 0.008}), M.darkSoft);
    innerGear.rotation.x = Math.PI / 2;
    innerGear.position.z = 0.0345;
    port.add(innerGear);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0018, 6, 36), M.accentGlow);
    glowRing.position.z = 0.035;
    port.add(glowRing);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0515, 0.0048, 10, 40), M.accent);
    rim.position.z = 0.034;
    port.add(rim);
    const mech = new THREE.Mesh(gear({radius: 0.033, teeth: 14, thickness: 0.007, toothH: 0.005, hole: 0.009}), M.steelDark);
    mech.rotation.x = Math.PI / 2;
    mech.position.z = 0.013;
    port.add(mech);
    const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.052, 0.004), M.dark, 6);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 6; i++) {
      m4.makeRotationZ((i / 6) * TAU);
      m4.setPosition(0, 0, 0.02);
      spokes.setMatrixAt(i, m4);
    }
    port.add(spokes);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 14), M.accent);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.024;
    port.add(hub);
    const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0028, 8, 6), M.dark, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      m4.makeTranslation(Math.cos(a) * 0.057, Math.sin(a) * 0.057, 0.028);
      bolts.setMatrixAt(i, m4);
    }
    port.add(bolts);
  }

  /* ---------------------------------------------------------------- 铆钉带上的紫条 */
  {
    const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.044, 0.011, 0.005), M.accent, 4);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.78;
      e.set(0, a, 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.sin(a) * 0.147, -0.062, Math.cos(a) * 0.147), q, new THREE.Vector3(1, 1, 1));
      strips.setMatrixAt(i, m4);
    }
    root.add(strips);
  }

  /* ---------------------------------------------------------------- 每帧装配 */
  const HINGE_AXIS = new THREE.Vector3();
  const out = {
    root,
    brain,
    petals,
    port,
    reactor,
    set({petalAngle = 0, brainRise = 0, brainTurn = 0, breath = {r: 1, len: 1}, portSpin = 0, open = 0} = {}) {
      root.scale.set(breath.r, breath.len, breath.r);
      for (const {pivot, az} of petals) {
        HINGE_AXIS.set(Math.cos(az), 0, -Math.sin(az));
        pivot.quaternion.setFromAxisAngle(HINGE_AXIS, petalAngle);
      }
      topCap.scale.setScalar(Math.max(0.001, 1 - open * 0.92));
      brain.position.y = 0.045 + brainRise;
      brain.rotation.y = brainTurn;
      reactor.rotation.y = portSpin;
    },
    portWorld(v = new THREE.Vector3()) {
      return port.getWorldPosition(v);
    },
    brainWorld(v = new THREE.Vector3()) {
      return brain.getWorldPosition(v);
    },
  };
  return out;
}

/** 合并同材质几何（球面片 + 包边），避免引入额外 draw call */
function mergeGeo(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let off = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, off);
    nor.set(g.attributes.normal.array, off);
    off += g.attributes.position.array.length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return merged;
}
