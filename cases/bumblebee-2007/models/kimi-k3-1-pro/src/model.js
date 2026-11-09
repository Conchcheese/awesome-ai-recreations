import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (a) => new THREE.Vector3(...a);
const E = (a) => new THREE.Euler(...a);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));

export function createBumblebee() {
  const root = new THREE.Group();
  root.name = 'Bumblebee_2007_Kimi-K3.1-Pro';
  const parts = [];
  const materials = {
    yellow: new THREE.MeshPhysicalMaterial({ color: 0xe89100, metalness: 0.72, roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.17 }),
    yellowDark: new THREE.MeshStandardMaterial({ color: 0x9b5700, metalness: 0.75, roughness: 0.34 }),
    black: new THREE.MeshStandardMaterial({ color: 0x101419, metalness: 0.72, roughness: 0.3 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x293139, metalness: 0.85, roughness: 0.32 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x85919b, metalness: 0.94, roughness: 0.23 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd4dce2, metalness: 1, roughness: 0.14 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x090b0d, metalness: 0.08, roughness: 0.83 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x172e3b, metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.82 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x77dcff, emissive: 0x23aee8, emissiveIntensity: 4, metalness: 0.15, roughness: 0.18 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xf27d00, emissiveIntensity: 2.2 }),
    red: new THREE.MeshStandardMaterial({ color: 0x7f120c, emissive: 0x3b0300, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.35 })
  };

  function mesh(parent, geometry, material, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...p); m.rotation.set(...r); m.scale.set(...s);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (p, mat, size, pos = [0, 0, 0], rot = [0, 0, 0], bevel = 0.05) =>
    mesh(p, new RoundedBoxGeometry(...size, 2, Math.min(bevel, Math.min(...size) * 0.24)), mat, pos, rot);
  const cyl = (p, mat, radius, length, pos = [0, 0, 0], rot = [0, 0, 0], segments = 20) =>
    mesh(p, new THREE.CylinderGeometry(radius, radius, length, segments), mat, pos, rot);
  const ball = (p, mat, radius, pos = [0, 0, 0], scale = [1, 1, 1]) =>
    mesh(p, new THREE.SphereGeometry(radius, 20, 12), mat, pos, [0, 0, 0], scale);
  const torus = (p, mat, radius, tube, pos = [0, 0, 0], rot = [0, 0, 0]) =>
    mesh(p, new THREE.TorusGeometry(radius, tube, 10, 28), mat, pos, rot);

  function part(id, label, system, car, robot, build, options = {}) {
    const g = new THREE.Group(); g.name = id;
    const record = {
      id, label, system, group: g,
      car: { p: V(car.p), q: new THREE.Quaternion().setFromEuler(E(car.r || [0, 0, 0])), s: V(car.s || [1, 1, 1]) },
      robot: { p: V(robot.p), q: new THREE.Quaternion().setFromEuler(E(robot.r || [0, 0, 0])), s: V(robot.s || [1, 1, 1]) },
      explode: V(options.explode || [robot.p[0] * 0.4, robot.p[1] * 0.12, -0.8]),
      phase: options.phase || [0, 1]
    };
    build(g, record);
    g.traverse((o) => { if (o.isMesh) o.userData.partId = id; });
    root.add(g); parts.push(record);
    return record;
  }
  const hiddenCar = (p = [0, 0.8, 0]) => ({ p, s: [0.001, 0.001, 0.001] });

  // Chassis and chest: the front fascia remains the visual anchor in both forms.
  part('chassis-spine', '纵向承载骨架', 'core',
    { p: [0, 0.58, 0], s: [1, 1, 1] }, { p: [0, 4.35, -0.05], r: [Math.PI / 2, 0, 0], s: [0.52, 0.72, 0.55] }, (g) => {
      box(g, materials.graphite, [1.65, 0.28, 5.2]);
      for (const x of [-0.66, 0.66]) box(g, materials.steel, [0.12, 0.16, 4.8], [x, 0.2, 0]);
      for (let z = -2; z <= 2; z += 0.5) box(g, materials.black, [1.45, 0.12, 0.08], [0, 0.26, z]);
    }, { phase: [0.05, 0.72], explode: [0, 0.3, -1.1] });

  part('front-fascia', 'Camaro 前保险杠 / 主胸甲', 'armor',
    { p: [0, 0.69, 2.82] }, { p: [0, 5.22, 0.62], r: [-0.08, 0, 0], s: [0.93, 1.2, 0.85] }, (g) => {
      box(g, materials.yellow, [3.0, 0.48, 0.34], [0, 0, 0], [0, 0, 0], 0.11);
      box(g, materials.black, [1.46, 0.18, 0.07], [0, 0.04, 0.2]);
      box(g, materials.graphite, [0.95, 0.12, 0.09], [0, -0.16, 0.19]);
      for (const x of [-1.14, 1.14]) cyl(g, materials.black, 0.13, 0.05, [x, -0.04, 0.2], [Math.PI / 2, 0, 0]);
      box(g, materials.chrome, [0.26, 0.07, 0.04], [0, 0.04, 0.25]);
    }, { phase: [0.18, 0.78], explode: [0, 0.3, 1.35] });

  for (const side of [-1, 1]) {
    const sn = side < 0 ? 'left' : 'right';
    part(`hood-${sn}`, `${sn === 'left' ? '左' : '右'}引擎盖 / 胸窗甲`, 'armor',
      { p: [side * 0.68, 1.13, 1.45], r: [0.03, 0, 0] },
      { p: [side * 0.64, 5.72, 0.56], r: [-0.18, side * 0.08, side * -0.14], s: [0.92, 1, 0.82] }, (g) => {
        box(g, materials.yellow, [1.32, 0.17, 1.82], [0, 0, 0], [0, 0, 0], 0.08);
        box(g, materials.black, [0.19, 0.025, 1.64], [side * -0.23, 0.1, 0]);
        box(g, materials.yellowDark, [0.65, 0.05, 0.12], [0, -0.11, -0.62]);
        box(g, materials.steel, [0.44, 0.06, 0.06], [0, -0.12, 0.46]);
      }, { phase: [0.2 + (side + 1) * 0.025, 0.8], explode: [side * 1.0, 0.75, 1.0] });

    part(`headlamp-${sn}`, `${sn === 'left' ? '左' : '右'}前灯`, 'detail',
      { p: [side * 1.03, 0.94, 2.79] }, { p: [side * 0.94, 5.43, 0.85], s: [0.72, 0.72, 0.72] }, (g) => {
        box(g, materials.black, [0.64, 0.26, 0.12]);
        for (const x of [-0.17, 0.17]) cyl(g, materials.blue, 0.095, 0.05, [x, 0, 0.08], [Math.PI / 2, 0, 0]);
      }, { phase: [0.25, 0.76], explode: [side * 1.1, 0.45, 1.5] });

    part(`door-${sn}`, `${sn === 'left' ? '左' : '右'}车门翼`, 'armor',
      { p: [side * 1.48, 1.12, -0.35], r: [0, 0, 0], s: [1, 1, 1] },
      { p: [side * 1.56, 5.55, -0.48], r: [-0.12, side * -0.22, side * -0.28], s: [0.9, 1.15, 0.95] }, (g) => {
        box(g, materials.yellow, [0.14, 0.83, 1.75], [0, 0, 0], [0, 0, 0], 0.06);
        box(g, materials.black, [0.04, 0.12, 0.34], [side * 0.09, 0.18, 0.25]);
        box(g, materials.yellowDark, [0.08, 0.12, 1.5], [0, -0.45, 0]);
        box(g, materials.glass, [0.09, 0.58, 1.1], [0, 0.66, -0.16], [side * -0.12, 0, 0]);
        box(g, materials.yellow, [0.28, 0.16, 0.38], [side * 0.14, 0.36, 0.78]);
      }, { phase: [0.1, 0.68], explode: [side * 1.8, 0.65, -0.4] });

    part(`side-skirt-${sn}`, `${sn === 'left' ? '左' : '右'}侧裙 / 骨盆侧甲`, 'armor',
      { p: [side * 1.42, 0.52, -0.25] }, { p: [side * 0.72, 3.28, 0.02], r: [Math.PI / 2, 0, side * 0.12], s: [0.68, 0.7, 0.55] }, (g) => {
        box(g, materials.yellow, [0.16, 0.24, 2.45]);
        box(g, materials.graphite, [0.1, 0.1, 2.1], [0, 0.17, 0]);
      }, { phase: [0.34, 0.88], explode: [side * 1.0, -0.1, 0.4] });

    part(`front-fender-${sn}`, `${sn === 'left' ? '左' : '右'}前翼子板`, 'armor',
      { p: [side * 1.23, 1.0, 1.63], r: [0, 0, side * -0.08] }, hiddenCar(), (g) => {
        box(g, materials.yellow, [0.62, 0.54, 1.62], [0, 0, 0], [0, 0, 0], 0.12);
        box(g, materials.yellowDark, [0.09, 0.17, 1.18], [side * 0.33, -0.19, 0]);
      }, { phase: [0, 0.38] });
    part(`rear-fender-${sn}`, `${sn === 'left' ? '左' : '右'}后翼子板`, 'armor',
      { p: [side * 1.23, 1.0, -1.75] }, hiddenCar(), (g) => {
        box(g, materials.yellow, [0.62, 0.58, 1.5], [0, 0, 0], [0, 0, 0], 0.12);
        box(g, materials.black, [0.05, 0.09, 0.34], [side * 0.33, 0.1, 0.3]);
      }, { phase: [0, 0.38] });
  }

  part('cabin-roof', '车顶 / 背部主甲', 'armor',
    { p: [0, 1.79, -0.55], s: [1, 1, 1] }, { p: [0, 5.15, -0.58], r: [Math.PI / 2, 0, 0], s: [0.84, 0.8, 0.8] }, (g) => {
    box(g, materials.yellow, [2.35, 0.15, 1.45], [0, 0, 0], [0, 0, 0], 0.09);
    for (const x of [-0.36, 0.36]) box(g, materials.black, [0.22, 0.02, 1.35], [x, 0.09, 0]);
    box(g, materials.graphite, [1.7, 0.1, 0.65], [0, -0.13, 0]);
  }, { phase: [0.12, 0.74], explode: [0, 1.2, -1.2] });

  part('windscreen', '前风挡 / 背部上甲', 'glass',
    { p: [0, 1.49, 0.38], r: [-0.48, 0, 0] }, { p: [0, 5.87, -0.55], r: [1.12, 0, 0], s: [0.85, 0.85, 0.85] }, (g) => {
    box(g, materials.glass, [2.28, 0.07, 1.12]);
    for (const x of [-1.13, 1.13]) box(g, materials.yellow, [0.09, 0.1, 1.16], [x, 0, 0]);
  }, { phase: [0.16, 0.7], explode: [0, 1.3, -0.7] });

  part('rear-deck', '后甲板 / 腰部背甲', 'armor',
    { p: [0, 1.08, -2.08] }, { p: [0, 3.62, -0.45], r: [Math.PI / 2, 0, 0], s: [0.78, 0.72, 0.65] }, (g) => {
    box(g, materials.yellow, [2.6, 0.17, 1.12]);
    box(g, materials.black, [1.5, 0.04, 0.48], [0, 0.1, -0.12]);
    for (const x of [-0.94, 0.94]) box(g, materials.red, [0.55, 0.1, 0.09], [x, -0.02, -0.58]);
  }, { phase: [0.3, 0.84], explode: [0, 0.2, -1.5] });

  // Head, battle mask, and neck are inferred mechanisms, not recovered film rig data.
  part('neck-gimbal', '颈部万向节', 'head', hiddenCar(), { p: [0, 6.12, 0.04] }, (g) => {
    cyl(g, materials.steel, 0.22, 0.34);
    torus(g, materials.graphite, 0.26, 0.07, [0, 0.1, 0], [Math.PI / 2, 0, 0]);
    for (const x of [-0.24, 0.24]) cyl(g, materials.chrome, 0.045, 0.42, [x, 0.08, 0], [0, 0, 0.35]);
  }, { phase: [0.48, 0.9], explode: [0, 0.7, 0] });

  part('head-cranium', '黄色盔壳与战斗面罩', 'head', hiddenCar(), { p: [0, 6.63, 0.17], s: [1, 1, 1] }, (g) => {
    box(g, materials.yellow, [0.76, 0.62, 0.62], [0, 0.08, 0], [0, 0, 0], 0.14);
    box(g, materials.black, [0.64, 0.3, 0.12], [0, 0.04, 0.34]);
    box(g, materials.graphite, [0.48, 0.3, 0.16], [0, -0.24, 0.3]);
    box(g, materials.chrome, [0.29, 0.19, 0.11], [0, -0.28, 0.4]);
    for (const side of [-1, 1]) {
      const x = side * 0.19;
      cyl(g, materials.blue, 0.092, 0.06, [x, 0.08, 0.4], [Math.PI / 2, 0, 0]);
      torus(g, materials.chrome, 0.104, 0.022, [x, 0.08, 0.41]);
      box(g, materials.yellow, [0.15, 0.4, 0.24], [side * 0.43, 0.05, 0], [0, 0, side * -0.18]);
      box(g, materials.yellow, [0.12, 0.34, 0.16], [side * 0.31, 0.46, -0.02], [0, 0, side * -0.22]);
      cyl(g, materials.graphite, 0.17, 0.12, [side * 0.48, 0.03, 0], [0, 0, Math.PI / 2]);
      box(g, materials.steel, [0.07, 0.24, 0.12], [side * 0.34, -0.2, 0.25], [0, 0, side * 0.25]);
    }
    box(g, materials.yellowDark, [0.14, 0.36, 0.3], [0, 0.42, -0.02]);
    box(g, materials.black, [0.32, 0.06, 0.06], [0, -0.41, 0.36]);
  }, { phase: [0.5, 0.93], explode: [0, 1.45, 0.3] });

  part('abdomen', '腹部机械连锁', 'core', hiddenCar(), { p: [0, 4.28, 0.32] }, (g) => {
    box(g, materials.black, [0.94, 1.1, 0.52]);
    for (let y = -0.38; y <= 0.4; y += 0.2) {
      box(g, materials.steel, [0.64, 0.09, 0.15], [0, y, 0.33]);
      for (const x of [-0.42, 0.42]) cyl(g, materials.graphite, 0.1, 0.15, [x, y, 0.18], [Math.PI / 2, 0, 0]);
    }
    for (const x of [-0.32, 0.32]) cyl(g, materials.chrome, 0.045, 0.85, [x, 0, 0.4], [0, 0, x * 0.25]);
  }, { phase: [0.35, 0.84], explode: [0, 0.2, 1.0] });

  part('pelvis', '骨盆与中央护甲', 'core', hiddenCar(), { p: [0, 3.42, 0.15] }, (g) => {
    box(g, materials.graphite, [1.24, 0.5, 0.64]);
    box(g, materials.steel, [0.48, 0.75, 0.18], [0, -0.25, 0.42], [0.12, 0, 0]);
    cyl(g, materials.chrome, 0.18, 0.08, [0, -0.08, 0.55], [Math.PI / 2, 0, 0]);
    for (const x of [-0.55, 0.55]) ball(g, materials.black, 0.28, [x, -0.12, 0]);
  }, { phase: [0.38, 0.86], explode: [0, -0.3, 0.85] });

  function wheel(id, label, carPos, robotPos, phase) {
    part(id, label, 'wheel', { p: carPos }, { p: robotPos, s: [0.86, 0.86, 0.86] }, (g) => {
      cyl(g, materials.rubber, 0.57, 0.34, [0, 0, 0], [0, 0, Math.PI / 2], 32);
      cyl(g, materials.graphite, 0.41, 0.36, [0, 0, 0], [0, 0, Math.PI / 2], 28);
      cyl(g, materials.chrome, 0.34, 0.38, [0, 0, 0], [0, 0, Math.PI / 2], 28);
      cyl(g, materials.black, 0.27, 0.4, [0, 0, 0], [0, 0, Math.PI / 2], 24);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        box(g, materials.chrome, [0.41, 0.1, 0.44], [0, Math.sin(a) * 0.17, Math.cos(a) * 0.17], [a, 0, 0], 0.025);
      }
      cyl(g, materials.steel, 0.09, 0.43, [0, 0, 0], [0, 0, Math.PI / 2]);
      torus(g, materials.steel, 0.49, 0.025, [0.19, 0, 0], [0, Math.PI / 2, 0]);
    }, { phase, explode: [robotPos[0] * 0.7, 0.25, -0.3] });
  }
  wheel('wheel-front-left', '左前轮 / 左肩轮', [-1.47, 0.61, 1.92], [-1.48, 5.38, -0.28], [0.12, 0.7]);
  wheel('wheel-front-right', '右前轮 / 右肩轮', [1.47, 0.61, 1.92], [1.48, 5.38, -0.28], [0.12, 0.7]);
  wheel('wheel-rear-left', '左后轮 / 左小腿轮', [-1.47, 0.61, -1.92], [-0.92, 1.18, -0.2], [0.28, 0.84]);
  wheel('wheel-rear-right', '右后轮 / 右小腿轮', [1.47, 0.61, -1.92], [0.92, 1.18, -0.2], [0.28, 0.84]);

  for (const side of [-1, 1]) {
    const sn = side < 0 ? 'left' : 'right';
    const zh = side < 0 ? '左' : '右';
    part(`shoulder-${sn}`, `${zh}肩部支架`, 'arm', hiddenCar(), { p: [side * 1.35, 5.33, 0.05] }, (g) => {
      ball(g, materials.graphite, 0.34);
      cyl(g, materials.steel, 0.24, 0.48, [0, 0, 0], [0, 0, Math.PI / 2]);
      box(g, materials.yellow, [0.52, 0.26, 0.58], [side * 0.1, 0.27, 0], [0, 0, side * -0.15]);
    }, { phase: [0.32, 0.78], explode: [side * 1.0, 0.5, 0] });

    part(`upper-arm-${sn}`, `${zh}上臂骨架`, 'arm', hiddenCar(), { p: [side * 1.7, 4.62, 0.03], r: [0, 0, side * -0.1] }, (g) => {
      box(g, materials.black, [0.43, 1.02, 0.48]);
      cyl(g, materials.steel, 0.14, 0.95, [side * 0.22, 0, 0.1]);
      cyl(g, materials.chrome, 0.06, 0.82, [side * -0.23, 0.02, 0.23]);
      box(g, materials.yellow, [0.23, 0.72, 0.45], [side * 0.3, 0.05, 0], [0, 0, side * -0.12]);
      for (const y of [-0.38, 0.38]) cyl(g, materials.graphite, 0.25, 0.48, [0, y, 0], [0, 0, Math.PI / 2]);
    }, { phase: [0.38, 0.86], explode: [side * 1.25, 0.2, 0.15] });

    part(`elbow-${sn}`, `${zh}肘关节`, 'arm', hiddenCar(), { p: [side * 1.78, 4.02, 0.08] }, (g) => {
      cyl(g, materials.graphite, 0.28, 0.54, [0, 0, 0], [0, 0, Math.PI / 2]);
      cyl(g, materials.chrome, 0.14, 0.58, [0, 0, 0], [0, 0, Math.PI / 2]);
      torus(g, materials.yellowDark, 0.22, 0.05, [side * 0.3, 0, 0], [0, Math.PI / 2, 0]);
    }, { phase: [0.42, 0.88], explode: [side * 1.35, 0, 0.25] });

    part(`forearm-${sn}`, `${zh}前臂甲与活塞`, 'arm', hiddenCar(), { p: [side * 1.86, 3.45, 0.17], r: [0.04, 0, side * -0.04] }, (g) => {
      box(g, materials.graphite, [0.54, 1.0, 0.57]);
      box(g, materials.yellow, [0.38, 0.92, 0.22], [side * 0.31, 0, 0.05], [0, 0, side * -0.09]);
      box(g, materials.yellow, [0.42, 0.68, 0.18], [0, 0.08, 0.37]);
      box(g, materials.black, [0.22, 0.52, 0.06], [0, 0.08, 0.49]);
      for (const x of [-0.19, 0.19]) cyl(g, materials.chrome, 0.045, 0.72, [x, 0, -0.34]);
      for (const y of [-0.35, 0.35]) box(g, materials.steel, [0.62, 0.08, 0.63], [0, y, 0]);
    }, { phase: [0.45, 0.92], explode: [side * 1.5, -0.15, 0.45] });

    part(`hand-${sn}`, `${zh}手掌与指节`, 'arm', hiddenCar(), { p: [side * 1.9, 2.77, 0.23] }, (g) => {
      box(g, materials.graphite, [0.48, 0.43, 0.32]);
      box(g, materials.yellow, [0.42, 0.24, 0.12], [0, 0.06, 0.22]);
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.12;
        box(g, materials.steel, [0.09, 0.29, 0.12], [x, -0.31, 0.02], [0.12, 0, 0]);
        box(g, materials.graphite, [0.085, 0.22, 0.11], [x, -0.52, 0.08], [0.35, 0, 0]);
      }
      box(g, materials.steel, [0.12, 0.32, 0.14], [side * -0.31, -0.05, 0.1], [0, 0, side * 0.55]);
    }, { phase: [0.52, 0.95], explode: [side * 1.6, -0.4, 0.55] });

    part(`hip-${sn}`, `${zh}髋关节`, 'leg', hiddenCar(), { p: [side * 0.61, 3.12, 0] }, (g) => {
      ball(g, materials.graphite, 0.32);
      cyl(g, materials.chrome, 0.17, 0.5, [0, 0, 0], [0, 0, Math.PI / 2]);
    }, { phase: [0.4, 0.85], explode: [side * 0.6, -0.25, 0] });

    part(`thigh-${sn}`, `${zh}大腿骨架`, 'leg', hiddenCar(), { p: [side * 0.67, 2.48, 0.02], r: [0, 0, side * 0.06] }, (g) => {
      box(g, materials.black, [0.58, 1.08, 0.62]);
      box(g, materials.graphite, [0.44, 0.82, 0.2], [0, 0, 0.4]);
      for (const x of [-0.25, 0.25]) cyl(g, materials.steel, 0.07, 0.88, [x, 0, 0.26]);
      box(g, materials.yellowDark, [0.18, 0.65, 0.5], [side * 0.36, 0, 0]);
      box(g, materials.yellow, [0.28, 0.44, 0.18], [side * 0.33, 0.15, 0.27]);
    }, { phase: [0.43, 0.9], explode: [side * 0.8, -0.4, 0.2] });

    part(`knee-${sn}`, `${zh}膝关节`, 'leg', hiddenCar(), { p: [side * 0.73, 1.78, 0.12] }, (g) => {
      cyl(g, materials.graphite, 0.32, 0.6, [0, 0, 0], [0, 0, Math.PI / 2]);
      cyl(g, materials.chrome, 0.18, 0.64, [0, 0, 0], [0, 0, Math.PI / 2]);
      box(g, materials.yellow, [0.48, 0.42, 0.22], [0, 0.05, 0.34], [0.18, 0, 0]);
    }, { phase: [0.46, 0.91], explode: [side * 0.85, -0.55, 0.45] });

    part(`shin-${sn}`, `${zh}小腿外甲`, 'leg', hiddenCar(), { p: [side * 0.78, 1.1, 0.1], r: [-0.04, 0, side * -0.03] }, (g) => {
      box(g, materials.graphite, [0.62, 1.15, 0.66]);
      box(g, materials.yellow, [0.54, 1.06, 0.22], [0, 0.08, 0.42], [-0.08, 0, 0]);
      box(g, materials.yellow, [0.2, 0.9, 0.5], [side * 0.38, 0.06, 0.03], [0, 0, side * -0.12]);
      box(g, materials.black, [0.17, 0.78, 0.08], [0, 0.08, 0.56]);
      for (const x of [-0.21, 0.21]) cyl(g, materials.chrome, 0.045, 0.76, [x, -0.04, -0.38]);
      box(g, materials.steel, [0.38, 0.12, 0.1], [0, -0.42, 0.51]);
    }, { phase: [0.48, 0.94], explode: [side * 0.95, -0.8, 0.5] });

    part(`foot-${sn}`, `${zh}分趾足部`, 'leg', hiddenCar(), { p: [side * 0.8, 0.3, 0.42] }, (g) => {
      box(g, materials.graphite, [0.68, 0.36, 1.0], [0, 0, 0.12]);
      box(g, materials.yellow, [0.58, 0.28, 0.54], [0, 0.08, 0.55], [0.08, 0, 0]);
      for (const x of [-0.19, 0.19]) box(g, materials.chrome, [0.23, 0.15, 0.36], [x, -0.06, 0.87]);
      box(g, materials.steel, [0.5, 0.23, 0.28], [0, 0.02, -0.5]);
      cyl(g, materials.black, 0.22, 0.52, [0, 0.28, -0.15], [0, 0, Math.PI / 2]);
    }, { phase: [0.52, 0.97], explode: [side * 0.95, -0.75, 1.0] });
  }

  // Small car-only details collapse into the chassis during transformation.
  part('car-grille', '车辆格栅与车标', 'detail', { p: [0, 0.95, 2.94] }, hiddenCar(), (g) => {
    box(g, materials.black, [1.65, 0.26, 0.08]);
    for (let x = -0.72; x <= 0.72; x += 0.18) box(g, materials.graphite, [0.04, 0.22, 0.04], [x, 0, 0.06]);
    box(g, materials.chrome, [0.3, 0.08, 0.05], [0, 0, 0.1]);
  }, { phase: [0, 0.35] });
  part('rear-bumper', '后保险杠', 'detail', { p: [0, 0.67, -2.78] }, hiddenCar(), (g) => {
    box(g, materials.yellow, [2.85, 0.4, 0.25]);
    box(g, materials.black, [1.4, 0.16, 0.08], [0, -0.06, -0.16]);
  }, { phase: [0, 0.35] });

  const tmpP = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  let gray = false;
  const grayMaterial = new THREE.MeshStandardMaterial({ color: 0x8d969e, metalness: 0.35, roughness: 0.58 });

  function stateAt(transform = 1, explode = 0) {
    const t = clamp(transform);
    const e = clamp(explode) * t;
    for (const p of parts) {
      const localT = ramp(t, p.phase[0], p.phase[1]);
      tmpP.lerpVectors(p.car.p, p.robot.p, localT);
      tmpQ.slerpQuaternions(p.car.q, p.robot.q, localT);
      tmpS.lerpVectors(p.car.s, p.robot.s, localT);
      p.group.position.copy(tmpP).addScaledVector(p.explode, e);
      p.group.quaternion.copy(tmpQ);
      p.group.scale.copy(tmpS).multiplyScalar(1 + e * 0.03);
    }
    root.updateMatrixWorld(true);
    return { transform: t, explode: e, phase: t < 0.02 ? 'VEHICLE' : t > 0.98 ? 'ROBOT' : 'METAMORPHOSIS' };
  }

  function setGray(value) {
    gray = Boolean(value);
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (gray) { o.userData.originalMaterial = o.material; o.material = grayMaterial; }
      else if (o.userData.originalMaterial) { o.material = o.userData.originalMaterial; delete o.userData.originalMaterial; }
    });
  }

  function select(id) {
    const p = parts.find((item) => item.id === id);
    if (!p) return null;
    return { id: p.id, label: p.label, system: p.system, evidence: '展示设计 / 隐藏机构为推断' };
  }

  stateAt(1, 0);
  return { root, parts, materials, stateAt, setGray, select, get gray() { return gray; } };
}

export function createStudio(scene, renderer) {
  scene.background = new THREE.Color(0x080b0e);
  scene.fog = new THREE.FogExp2(0x080b0e, 0.027);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const hemi = new THREE.HemisphereLight(0x9ac6dd, 0x181006, 1.35); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2b0, 5.2); key.position.set(5, 10, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 10; key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.00025; scene.add(key);
  const rim = new THREE.DirectionalLight(0x42b7ee, 4.4); rim.position.set(-6, 6, -6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffb000, 2.1); fill.position.set(-5, 3, 5); scene.add(fill);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 80), new THREE.MeshStandardMaterial({ color: 0x10151a, metalness: 0.65, roughness: 0.48 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.015; floor.receiveShadow = true; scene.add(floor);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6b4b12, transparent: true, opacity: 0.58, side: THREE.DoubleSide });
  for (const r of [4.5, 5.2, 7.8]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.018, 96), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; scene.add(ring);
  }
  const grid = new THREE.GridHelper(28, 56, 0x3c3120, 0x192127); grid.position.y = 0.002;
  grid.material.transparent = true; grid.material.opacity = 0.34; scene.add(grid);
  return { key, rim, fill, floor };
}
