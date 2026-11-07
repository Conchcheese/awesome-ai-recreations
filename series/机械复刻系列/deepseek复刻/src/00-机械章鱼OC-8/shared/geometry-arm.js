// 00 机械章鱼 OC-8 · 8 条臂链：25 节白色装甲 + 黑色关节鼓包 + 两侧紫轮盘 + 紫细环 + 铆钉条，
// 末端收进螺旋；每臂 60 轮（480 总），结构与原作一致。全部用 InstancedMesh 装配 —— 8 条臂
// 只占十几条 draw call。姿态来自 shared/model.js 的 armChain2D / armCurl，绝不手写角度。
import * as THREE from 'three';
import {bevelCyl, rbox, spring, gear} from '../../kit/geo.js';
import {armChain2D, HUB_R} from './model.js';

const ARMS = 8;
const LINKS = 25;
const HUB_Y = 0.4;
const AZ = (i) => (i + 0.5) * (Math.PI * 2 / ARMS); // 正面留空档
const OPEN_LINKS = [7, 11, 15]; // 这三节不装白壳：露出内部弹簧 / 齿轮 / 玻璃连杆
const SPRING_LINKS = [7, 15];
const WHEEL_N = 60; // 50 关节轮 + 6 根轮 + 4 末端轮 = 60/臂
const T = new THREE.Vector3();
const X = new THREE.Vector3();
const Y = new THREE.Vector3();
const Z = new THREE.Vector3();
const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3(1, 1, 1);
const T2 = new THREE.Vector3();
const SMALL = new THREE.Vector3(0.0001, 0.0001, 0.0001);

function instanced(geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  m.castShadow = true;
  m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return m;
}

export function buildArms(M) {
  const group = new THREE.Group();
  group.position.y = 0;

  const shell = instanced(bevelCyl(0.0185, 0.034, 0.005, 14), M.white, ARMS * LINKS);
  const core = instanced(bevelCyl(0.0135, 0.044, 0.004, 12), M.dark, ARMS * LINKS);
  const joint = instanced(new THREE.SphereGeometry(0.0162, 10, 8), M.dark, ARMS * (LINKS + 1));
  const wheelGeo = new THREE.CylinderGeometry(0.0086, 0.0086, 0.007, 16);
  wheelGeo.rotateZ(Math.PI / 2); // 轮轴沿局部 X（臂侧向）
  const wheels = instanced(wheelGeo, M.steelDark, ARMS * WHEEL_N);
  const rimGeo = new THREE.TorusGeometry(0.0074, 0.0016, 6, 16).rotateY(Math.PI / 2);
  const wheelRims = instanced(rimGeo, M.accent, ARMS * WHEEL_N);
  const hubGeo = new THREE.CylinderGeometry(0.0052, 0.0052, 0.0092, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hubs = instanced(hubGeo, M.dark, ARMS * WHEEL_N);
  const ringGeo = new THREE.TorusGeometry(0.0202, 0.0012, 6, 22).rotateX(Math.PI / 2);
  const rings = instanced(ringGeo, M.accent, ARMS * LINKS);
  const ringsSteel = instanced(ringGeo, M.steelDark, ARMS * LINKS);
  const stripGeo = new THREE.BoxGeometry(0.022, 0.0035, 0.004);
  const strips = instanced(stripGeo, M.accent, ARMS * LINKS);
  const rivets = instanced(new THREE.SphereGeometry(0.0024, 6, 5), M.dark, ARMS * LINKS);
  const springGeo = spring({radius: 0.0105, height: 0.034, turns: 5, wire: 0.0016, seg: 10});
  springGeo.translate(0, -0.017, 0);
  const springs = instanced(springGeo, M.steel, ARMS * SPRING_LINKS.length);
  const glassGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.036, 14, 1, true);
  const glassLinks = instanced(glassGeo, M.glass, ARMS);
  glassLinks.material = M.glass;
  const gearGeo = gear({radius: 0.011, teeth: 10, thickness: 0.007, toothH: 0.004, hole: 0.004});
  gearGeo.rotateX(Math.PI / 2);
  const gears = instanced(gearGeo, M.accent, ARMS);
  const clawGeo = new THREE.ConeGeometry(0.011, 0.032, 10);
  const claws = instanced(clawGeo, M.dark, ARMS);
  const collarGeo = new THREE.TorusGeometry(0.027, 0.011, 8, 22);
  const collars = instanced(collarGeo, M.white, ARMS);
  const collarTrimGeo = new THREE.TorusGeometry(0.027, 0.0035, 6, 22);
  const collarTrims = instanced(collarTrimGeo, M.accent, ARMS);
  const actGeo = rbox(0.052, 0.034, 0.044, 0.008, 3);
  const actuators = instanced(actGeo, M.dark, ARMS);
  const actTrimGeo = new THREE.TorusGeometry(0.026, 0.0045, 6, 20).rotateX(Math.PI / 2);
  const actTrims = instanced(actTrimGeo, M.accent, ARMS);

  for (const m of [shell, core, joint, wheels, wheelRims, hubs, rings, ringsSteel, strips, rivets, springs, glassLinks, gears, claws, collars, collarTrims, actuators, actTrims]) group.add(m);

  const tmpP = new THREE.Vector3();
  const lat = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const chain = [];
  const armOffset = new THREE.Vector3();

  function basis(x, y, z) {
    M4.makeBasis(x, y, z);
    return M4;
  }

  /** 每帧装配：t 是巡览时间，explode 0..1 让八臂向外漂开 */
  function pose(t, explode = 0) {
    let shellI = 0;
    let coreI = 0;
    let jointI = 0;
    let wheelI = 0;
    let ringI = 0;
    let stripI = 0;
    let springI = 0;

    for (let i = 0; i < ARMS; i++) {
      const az = AZ(i);
      const c = armChain2D(i, t);
      chain[i] = c;
      radial.set(Math.sin(az), 0, Math.cos(az));
      lat.set(Math.cos(az), 0, -Math.sin(az));
      armOffset.copy(radial).multiplyScalar(0.2 * explode).setY(0.055 * explode);
      const rootX = radial.x * HUB_R + armOffset.x;
      const rootZ = radial.z * HUB_R + armOffset.z;
      const rootY = HUB_Y + armOffset.y;

      // 根部执行器 / 环
      {
        T.set(rootX - radial.x * 0.022, rootY + 0.008, rootZ - radial.z * 0.022);
        basis(lat, radial, nrm.crossVectors(lat, radial));
        M4.setPosition(T);
        actuators.setMatrixAt(i, M4);
        T.set(rootX - radial.x * 0.012, rootY + 0.008, rootZ - radial.z * 0.012);
        M4.setPosition(T);
        actTrims.setMatrixAt(i, M4);
      }

      for (let j = 0; j < LINKS; j++) {
        const th = c.headings[j];
        const ct = Math.cos(th);
        const st = Math.sin(th);
        dir.copy(radial).multiplyScalar(ct).setY(st);
        nrm.crossVectors(lat, dir);
        const p0 = c.pts[j];
        const p1 = c.pts[j + 1];
        const mx = (p0[0] + p1[0]) * 0.5;
        const my = (p0[1] + p1[1]) * 0.5;
        T.set(rootX + radial.x * mx + armOffset.x, rootY + my, rootZ + radial.z * mx + armOffset.z);

        // 白壳：选中 OPEN_LINKS 时缩小隐藏，露出内部
        const open = OPEN_LINKS.includes(j);
        basis(lat, dir, nrm);
        M4.setPosition(T);
        if (open) M4.scale(SMALL);
        shell.setMatrixAt(shellI++, M4);

        // 深色内芯
        basis(lat, dir, nrm);
        M4.setPosition(T);
        core.setMatrixAt(coreI++, M4);

        // 铆钉（每节一颗）
        T2.copy(T).addScaledVector(nrm, 0.0162);
        M4.setPosition(T2);
        rivets.setMatrixAt(stripI, M4);
        // 细环：每 2 节一圈紫环，其余为钢色细环
        basis(lat, dir, nrm);
        M4.setPosition(T);
        if (j % 2 === 0) {
          rings.setMatrixAt(ringI, M4);
          M4.scale(SMALL);
          ringsSteel.setMatrixAt(ringI, M4);
        } else {
          M4.scale(SMALL);
          rings.setMatrixAt(ringI, M4);
          basis(lat, dir, nrm);
          M4.setPosition(T);
          ringsSteel.setMatrixAt(ringI, M4);
        }
        ringI++;
        // 紫色小条：每 4 节一段
        T2.copy(T).addScaledVector(nrm, 0.0182);
        M4.setPosition(T2);
        if (j % 4 === 0) strips.setMatrixAt(stripI, M4);
        else {
          M4.scale(SMALL);
          strips.setMatrixAt(stripI, M4);
        }
        stripI++;

        // 弹簧 / 玻璃连杆 / 齿轮
        if (SPRING_LINKS.includes(j)) {
          M4.setPosition(T);
          springs.setMatrixAt(springI++, M4);
        }
        if (j === 11) {
          M4.setPosition(T);
          glassLinks.setMatrixAt(i, M4);
          T2.copy(T);
          M4.setPosition(T2);
          gears.setMatrixAt(i, M4);
        }

        // 关节鼓包（每个节点）
        const jp = c.pts[j];
        T.set(rootX + radial.x * jp[0], rootY + jp[1], rootZ + radial.z * jp[0]);
        joint.setMatrixAt(jointI++, M4.identity().setPosition(T));
      }

      // 末端关节、爪子、套环
      {
        const jp = c.pts[LINKS];
        T.set(rootX + radial.x * jp[0], rootY + jp[1], rootZ + radial.z * jp[0]);
        joint.setMatrixAt(jointI++, M4.identity().setPosition(T));
        const th = c.headings[LINKS];
        dir.copy(radial).multiplyScalar(Math.cos(th)).setY(Math.sin(th));
        T2.copy(T).addScaledVector(dir, 0.016);
        basis(lat, dir, nrm.crossVectors(lat, dir));
        M4.setPosition(T2);
        claws.setMatrixAt(i, M4);
        // 根部套环
        const th0 = c.headings[0];
        dir.copy(radial).multiplyScalar(Math.cos(th0)).setY(Math.sin(th0));
        T.set(rootX + radial.x * c.pts[0][0], rootY + c.pts[0][1], rootZ + radial.z * c.pts[0][0]);
        basis(lat, dir, nrm.crossVectors(lat, dir));
        M4.setPosition(T);
        collars.setMatrixAt(i, M4);
        collarTrims.setMatrixAt(i, M4);
      }

      // 轮盘：50 个关节轮 + 6 根轮 + 4 末端轮 = 60
      let w = 0;
      for (let j = 1; j <= LINKS; j++) {
        const th = c.headings[j];
        dir.copy(radial).multiplyScalar(Math.cos(th)).setY(Math.sin(th));
        nrm.crossVectors(lat, dir);
        const jp = c.pts[j];
        T.set(rootX + radial.x * jp[0], rootY + jp[1], rootZ + radial.z * jp[0]);
        basis(lat, dir, nrm);
        for (const s of [1, -1]) {
          T2.copy(T).addScaledVector(lat, s * 0.0188);
          M4.setPosition(T2);
          wheels.setMatrixAt(wheelI, M4);
          hubs.setMatrixAt(wheelI, M4);
          basis(lat, dir, nrm);
          M4.setPosition(T2);
          if (j % 2 === 0) wheelRims.setMatrixAt(wheelI, M4);
          else {
            M4.scale(SMALL);
            wheelRims.setMatrixAt(wheelI, M4);
          }
          wheelI++;
        }
        w += 2;
      }
      const rootTh = c.headings[0];
      dir.copy(radial).multiplyScalar(Math.cos(rootTh)).setY(Math.sin(rootTh));
      nrm.crossVectors(lat, dir);
      const p0 = c.pts[0];
      T.set(rootX + radial.x * p0[0], rootY + p0[1], rootZ + radial.z * p0[0]);
      basis(lat, dir, nrm);
      const rootOffsets = [
        [1, 0.0188, 0], [-1, 0.0188, 0], [1, 0.0188, 0.017], [-1, 0.0188, 0.017],
        [0, 0, 0.023], [0, 0, -0.023],
      ];
      for (const [s, lo, no] of rootOffsets) {
        T2.copy(T).addScaledVector(lat, s * lo).addScaledVector(nrm, no);
        M4.setPosition(T2);
        wheels.setMatrixAt(wheelI, M4);
        hubs.setMatrixAt(wheelI, M4);
        basis(lat, dir, nrm);
        M4.setPosition(T2);
        wheelRims.setMatrixAt(wheelI, M4);
        wheelI++;
      }
      const tipTh = c.headings[LINKS];
      dir.copy(radial).multiplyScalar(Math.cos(tipTh)).setY(Math.sin(tipTh));
      nrm.crossVectors(lat, dir);
      const pT = c.pts[LINKS];
      T.set(rootX + radial.x * pT[0], rootY + pT[1], rootZ + radial.z * pT[0]);
      basis(lat, dir, nrm);
      const tipOffsets = [[1, 0.015, 0.008], [-1, 0.015, 0.008], [0, 0, 0.019], [0, 0, -0.019]];
      for (const [s, lo, no] of tipOffsets) {
        T2.copy(T).addScaledVector(lat, s * lo).addScaledVector(nrm, no);
        M4.setPosition(T2);
        wheels.setMatrixAt(wheelI, M4);
        hubs.setMatrixAt(wheelI, M4);
        basis(lat, dir, nrm);
        M4.setPosition(T2);
        wheelRims.setMatrixAt(wheelI, M4);
        wheelI++;
      }
    }

    for (const m of [shell, core, joint, wheels, wheelRims, hubs, rings, ringsSteel, strips, rivets, springs, glassLinks, gears, claws, collars, collarTrims, actuators, actTrims]) {
      m.instanceMatrix.needsUpdate = true;
    }
    void shellI; void coreI; void jointI; void ringI; void stripI; void springI;
  }

  return {group, pose, chain, ARMS, LINKS};
}
