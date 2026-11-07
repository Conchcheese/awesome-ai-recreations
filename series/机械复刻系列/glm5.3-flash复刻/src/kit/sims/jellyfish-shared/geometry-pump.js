// MJ-9 的泵核：吊在钟心的耐压舱（白壳 + 钢端环 + 端盖螺钉），顶部吸入环（4 片导流叶随泵转），
// 底部喷口 4 瓣（排气段张开），侧面的平衡腔玻璃管里一颗随相位微动的浮沉活塞。
// set(spin, spread, intake, piston, dip) 每帧从 model.js 的量摆姿势。
import * as THREE from 'three';
import {G} from './model.js';

export function buildPump(M) {
  const root = new THREE.Group();
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    root.add(m);
    return m;
  };

  // ------------------------------------------------------------ 耐压舱（吊在钟心，舱身探出钟口下方，如参考图）
  const pod = new THREE.Group();
  pod.position.y = 0.0;
  root.add(pod);
  const body = add(new THREE.CylinderGeometry(G.PUMP_D / 2, G.PUMP_D / 2, G.PUMP_H * 0.62, 28), M.white);
  body.position.y = 0.01;
  const capTop = add(new THREE.SphereGeometry(G.PUMP_D / 2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.white);
  capTop.position.y = 0.01 + G.PUMP_H * 0.31;
  const capBot = add(new THREE.SphereGeometry(G.PUMP_D / 2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), M.white);
  capBot.position.y = 0.01 - G.PUMP_H * 0.31;
  for (const sy of [0.052, -0.052]) {
    const ring = add(new THREE.TorusGeometry(G.PUMP_D / 2 + 0.002, 0.005, 8, 32).rotateX(Math.PI / 2), M.steel);
    ring.position.y = sy;
  }
  // 舱体上 6 颗端盖螺钉 + 一条青色条码带
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bolt = add(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 8), M.steel);
    bolt.position.set(Math.cos(a) * (G.PUMP_D / 2 + 0.001), 0.052, Math.sin(a) * (G.PUMP_D / 2 + 0.001));
  }
  const band = add(new THREE.CylinderGeometry(G.PUMP_D / 2 + 0.0025, G.PUMP_D / 2 + 0.0025, 0.02, 28, 1, true), M.cyan);
  band.position.y = -0.01;

  // ------------------------------------------------------------ 顶部吸入环 + 导流叶
  const intake = new THREE.Group();
  intake.position.y = 0.01 + G.PUMP_H * 0.31 + G.PUMP_D / 2 - 0.012;
  pod.add(intake);
  const iRing = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.008, 8, 28).rotateX(Math.PI / 2), M.dark);
  iRing.castShadow = true;
  intake.add(iRing);
  const vane = new THREE.BoxGeometry(0.006, 0.038, 0.014);
  const vanes = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const vm = new THREE.Mesh(vane, M.cyan);
    vm.position.set(Math.cos(a) * 0.023, 0.012, Math.sin(a) * 0.023);
    vm.rotation.y = -a;
    intake.add(vm);
    vanes.push(vm);
  }

  // ------------------------------------------------------------ 底部喷口 4 瓣
  const nozzle = new THREE.Group();
  nozzle.position.y = 0.01 - G.PUMP_H * 0.31 - G.PUMP_D / 2 + 0.01;
  pod.add(nozzle);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.017, 0.016, 16), M.dark);
  hub.castShadow = true;
  nozzle.add(hub);
  const flaps = [];
  for (let i = 0; i < G.NOZZLE_FLAPS; i++) {
    const a = (i / G.NOZZLE_FLAPS) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.y = a; // pivot 的 +x 指向径向外
    nozzle.add(pivot);
    const hinge = new THREE.Group();
    hinge.position.set(0.015, 0, 0);
    pivot.add(hinge);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.024), M.dark);
    flap.castShadow = true;
    flap.position.x = 0.008;
    hinge.add(flap);
    flaps.push(hinge);
  }

  // ------------------------------------------------------------ 平衡腔（玻璃管 + 浮沉活塞）
  const chamber = new THREE.Group();
  chamber.position.set(G.PUMP_D / 2 + 0.012, 0.02, 0.012);
  pod.add(chamber);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.058, 20, 1, true), M.bellGlass);
  chamber.add(glass);
  const chRing = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0035, 6, 20).rotateX(Math.PI / 2), M.steel);
  chRing.position.y = 0.029;
  chamber.add(chRing);
  const chRing2 = chRing.clone();
  chRing2.position.y = -0.029;
  chamber.add(chRing2);
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.02, 16), M.steel);
  piston.castShadow = true;
  chamber.add(piston);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 8), M.dark);
  piston.add(rod);
  rod.position.y = 0.024;

  return {
    root, pod, nozzle, intake, chamber, piston,
    /** spin 泵转速角；spread 喷口瓣开度；intake 吸入叶敛散；piston 活塞行程；dip 隔离时舱体下探 */
    set(spin, spread, intakeK, pistonY, dip) {
      intake.rotation.y = spin;
      intake.scale.setScalar(1 - intakeK * 0.12);
      for (const h of flaps) h.rotation.z = -(0.06 + spread * 0.8);
      piston.position.y = pistonY;
      pod.position.y = -dip * 0.075;
    },
  };
}
