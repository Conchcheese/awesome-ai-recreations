// 整机 Telson SC-8：底盘 + 背甲 5 板 + 腹部背板 5 板 + 传感头（双镜头）+ 基座，再挂上
// 8 条腿（geometry-leg）、2 只钳（geometry-claw）、尾节链（geometry-tail）与触地连线覆盖层。
// update(input) 是唯一动部件的地方，每个角度都来自 model.js。
// input: {p, settleF, explode, isoKey, isoK, gaitK, demo, liftOverride}。
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {G, archK, bodyPose, contacts, legRoot, legPose, tailPose} from './model.js';
import {buildLeg} from './geometry-leg.js';
import {buildClaw} from './geometry-claw.js';
import {buildTail} from './geometry-tail.js';

const V3 = THREE.Vector3;

export function buildMaterials() {
  return {
    shell: new THREE.MeshPhysicalMaterial({color: '#edf3f8', roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4}),
    shell2: new THREE.MeshPhysicalMaterial({color: '#dfe9f2', roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.45}),
    dark: new THREE.MeshPhysicalMaterial({color: '#1c2b3a', roughness: 0.42, metalness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    accent: new THREE.MeshPhysicalMaterial({color: '#1e5fd6', roughness: 0.4, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    sky: new THREE.MeshPhysicalMaterial({color: '#3d8fe0', roughness: 0.42, metalness: 0.05, clearcoat: 0.45, clearcoatRoughness: 0.3}),
    bearing: new THREE.MeshStandardMaterial({color: '#8c8fd0', roughness: 0.38, metalness: 0.65}),
    rubber: new THREE.MeshStandardMaterial({color: '#232e3a', roughness: 0.9, metalness: 0}),
    lens: new THREE.MeshPhysicalMaterial({color: '#0d1826', roughness: 0.1, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08}),
    glow: new THREE.MeshStandardMaterial({color: '#0a2438', emissive: '#12aecb', emissiveIntensity: 0.55, roughness: 0.4}),
    ir: new THREE.MeshStandardMaterial({color: '#0a1c30', emissive: '#3d8fe0', emissiveIntensity: 0.3, roughness: 0.4}),
    headShell: new THREE.MeshPhysicalMaterial({color: '#edf3f8', roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4}),
    clawRestShell: new THREE.MeshPhysicalMaterial({color: '#edf3f8', roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4}),
  };
}

const PLATE_Z = [0.062, 0.024, -0.014, -0.052, -0.09];

export function buildScorpion() {
  const M = buildMaterials();
  const root = new THREE.Group();
  const body = new THREE.Group(); // 随身体抬升的部分（腿的 IK 会跟上，足不动）
  root.add(body);

  // ---- 底盘 + 背甲 + 腹板
  const shellParts = new THREE.Group();
  body.add(shellParts);
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.055, 0.2, 3, 0.012), M.shell2);
  chassis.position.set(0, 0.055, -0.01);
  chassis.castShadow = chassis.receiveShadow = true;
  shellParts.add(chassis);
  const plates = [];
  for (let i = 0; i < 5; i++) {
    const w = 0.104 - i * 0.007;
    const plate = new THREE.Mesh(new RoundedBoxGeometry(w, 0.012, 0.034, 2, 0.004), i % 2 ? M.shell2 : M.shell);
    plate.position.set(0, 0.084 + 0.011 * Math.sin(Math.PI * (0.18 + (0.72 * i) / 4)), PLATE_Z[i]);
    plate.rotation.x = (i - 2) * 0.05;
    plate.castShadow = plate.receiveShadow = true;
    shellParts.add(plate);
    plates.push(plate);
    if (i === 2) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.003, 0.008), M.accent);
      stripe.position.set(0, 0.008, 0);
      plate.add(stripe);
    }
    const bellyDark = new THREE.MeshStandardMaterial({color: '#1c2b3a', roughness: 0.5, metalness: 0.2});
    const belly = new THREE.Mesh(new RoundedBoxGeometry(0.088, 0.007, 0.032, 1, 0.003), bellyDark);
    belly.position.set(0, 0.0245, PLATE_Z[i]);
    belly.castShadow = belly.receiveShadow = true;
    shellParts.add(belly);
    plates.push(belly);
  }

  // ---- 传感头：楔形头 + 双镜头 + IR 圈 + 中眼（头壳用独立材质副本，隔离时不牵连背甲）
  const head = new THREE.Group();
  body.add(head);
  const skull = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.046, 0.056, 2, 0.01), M.headShell);
  skull.position.set(0, 0.062, 0.108);
  skull.castShadow = skull.receiveShadow = true;
  head.add(skull);
  const lensParts = [];
  for (const sx of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 20).rotateX(Math.PI / 2), M.lens);
    lens.position.set(sx * 0.021, 0.07, 0.136);
    lens.castShadow = true;
    head.add(lens);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0135, 0.0022, 6, 22), M.ir);
    rim.position.copy(lens.position);
    head.add(rim);
    lensParts.push(rim);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), M.glow);
  eye.position.set(0, 0.079, 0.134);
  head.add(eye);

  // ---- 腿 ×8、钳 ×2、尾
  const legs = [];
  for (let i = 0; i < G.LEGS; i++) {
    const leg = buildLeg(M);
    root.add(leg.group);
    legs.push(leg);
  }
  const claws = [buildClaw(M), buildClaw(M)];
  body.add(claws[0].group, claws[1].group);
  const tail = buildTail(M);
  body.add(tail.group);

  // ---- 触地连线覆盖层（显示·触地连线）
  const gaitGroup = new THREE.Group();
  gaitGroup.visible = false;
  root.add(gaitGroup);
  const rings = [];
  for (let i = 0; i < G.LEGS; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.02, 0.0018, 6, 22).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({color: '#1e5fd6', transparent: true, opacity: 0.8, depthWrite: false}),
    );
    ring.renderOrder = 4;
    gaitGroup.add(ring);
    rings.push(ring);
  }
  const polyGeo = new THREE.BufferGeometry();
  polyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(G.LEGS * 2 * 3), 3));
  const poly = new THREE.LineSegments(
    polyGeo,
    new THREE.LineBasicMaterial({color: '#1e5fd6', transparent: true, opacity: 0.7, depthWrite: false}),
  );
  poly.renderOrder = 4;
  gaitGroup.add(poly);

  // ------------------------------------------------------------ 隔离（玻璃化）
  // 桶：shell(底盘+背板) / head / tail / claw(左钳) / clawRest(右钳) / legHero(腿R2=5) / legRest
  const BUCKETS = () => ({
    shell: [M.shell, M.shell2, M.dark],
    head: [M.headShell, M.lens, M.ir, M.glow],
    tail: [tail.mats.shell, tail.mats.dark, tail.mats.accent, tail.mats.glow],
    claw: [claws[0].mats.shell, claws[0].mats.dark, claws[0].mats.accent],
    clawRest: [claws[1].mats.shell, claws[1].mats.dark, claws[1].mats.accent],
    legHero: Object.values(legs[5].mats),
    legRest: legs.filter((_, i) => i !== 5).flatMap((l) => Object.values(l.mats)),
  });
  const setOpacity = (mats, o) => {
    for (const m of mats) {
      m.opacity = o;
      m.transparent = true;
      m.depthWrite = o > 0.6;
    }
  };
  const isolate = (key, k) => {
    const b = BUCKETS();
    const off = !key || key === 'hero' || k < 0.02;
    const o = (name) => (off ? 1 : name === key ? 1 : 1 - 0.86 * k);
    const ghost = 1 - 0.86 * k;
    setOpacity(b.shell, o('shell'));
    setOpacity(b.head, o('head'));
    setOpacity(b.tail, o('tail'));
    setOpacity(b.claw, o('claw'));
    setOpacity(b.clawRest, off ? 1 : ghost); // 右钳永非主角
    setOpacity(b.legHero, o('leg'));
    setOpacity(b.legRest, off ? 1 : ghost); // 其余七腿永非主角
  };

  // ------------------------------------------------------------ 拆解偏移
  const home = {
    head: head.position.clone(),
    claw0: claws[0].group.position.clone(),
    claw1: claws[1].group.position.clone(),
    legs: legs.map((l) => l.group.position.clone()),
    plates: plates.map((p) => p.position.clone()),
  };

  const out = {p: 0, mode: 0};
  /** 唯一的状态应用入口 */
  const update = ({p = 0, settleF = 0, explode = 0, isoKey = null, isoK = 0, gaitK = 0, demo = 0} = {}) => {
    out.p = p;
    const bp = bodyPose(p);
    const lift = bp.lift + bp.bob;
    root.position.y = lift;
    root.rotation.x = bp.pitch;
    // 背板拆解：顶板逐块上浮，腹板下沉
    for (let i = 0; i < 5; i++) {
      const e = Math.min(1, Math.max(0, explode * 1.8 - i * 0.14));
      const k = e * e * (3 - 2 * e);
      plates[i * 2].position.y = home.plates[i * 2].y + (0.05 + 0.026 * i) * k;
      plates[i * 2 + 1].position.y = home.plates[i * 2 + 1].y - 0.045 * k;
    }
    // 头 / 钳 / 腿的拆解平移
    const eh = Math.min(1, Math.max(0, explode * 1.6));
    head.position.set(0, 0.02 * eh, 0.13 * eh);
    claws[0].group.position.set(0.05 * eh, 0.01 * eh, 0.09 * eh);
    claws[1].group.position.set(-0.05 * eh, 0.01 * eh, 0.09 * eh);
    for (let i = 0; i < G.LEGS; i++) {
      const {ou} = legRoot(i);
      legs[i].group.position.set(ou[0] * 0.07 * eh, 0.02 * eh, ou[2] * 0.07 * eh);
    }
    // 部件姿态（腿的 lift 让足端保持贴地）
    const opts = {settle: settleF, lift};
    for (let i = 0; i < G.LEGS; i++) legs[i].pose(i, p, opts);
    claws[0].set(1, p, demo);
    claws[1].set(-1, p, demo);
    tail.set(p, explode);
    // IR 圈呼吸 + 攻击时毒囊亮
    const k = archK(p);
    M.ir.emissiveIntensity = 0.22 + 0.4 * k + 0.3 * Math.sin(p * Math.PI * 2 * 3);
    M.glow.emissiveIntensity = 0.35 + 0.6 * k;
    // 触地连线：支撑足下的环 + 相邻支撑足的多边形
    gaitGroup.visible = gaitK > 0.02;
    if (gaitGroup.visible) {
      const cs = contacts(p, opts);
      const posAttr = polyGeo.attributes.position;
      let n = 0;
      const order = [0, 1, 2, 3, 7, 6, 5, 4]; // L1..L4, R4..R1 环绕
      for (let q = 0; q < 8; q++) {
        const i = order[q];
        const j = order[(q + 1) % 8];
        const fi = legs[i].pose(i, p, opts).F;
        const fj = legs[j].pose(j, p, opts).F;
        const on = cs[i] && cs[j] ? 1 : 0;
        posAttr.setXYZ(n++, fi[0], 0.003, fi[2]);
        posAttr.setXYZ(n++, fj[0], 0.003, fj[2]);
        rings[i].visible = cs[i];
        rings[i].position.set(fi[0], 0.004, fi[2]);
        rings[i].material.opacity = 0.8 * gaitK * on;
      }
      posAttr.needsUpdate = true;
      poly.material.opacity = 0.7 * gaitK;
    }
    isolate(isoKey, isoK);
  };
  update();
  return {root, update, M, legs, claws, tail, head, plates, gaitGroup, out};
}
