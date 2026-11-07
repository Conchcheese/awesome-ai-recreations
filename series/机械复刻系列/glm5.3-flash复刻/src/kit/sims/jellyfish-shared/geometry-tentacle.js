// MJ-9 的 5 条触须：每条 22 节，白色链节串在深色内芯上、节间夹青色 LED 方块（参考图里
// AquaJelly 触须上的灯段），须端一片叶状鳍。全部实例化 —— 5 条触须共 4 个 draw call。
// poseAll(p) 从 model.tentacleChain 摆每一条，被动拖曳的相位沿须错开。
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {G, tentacleChain} from './model.js';

const V3 = THREE.Vector3;
const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const P = new V3();
const S = new V3(1, 1, 1);

export const TENT_AZ = (i) => (i + 0.5) * ((Math.PI * 2) / G.PETALS); // 与钟缘节同位
export const TENT_NAME = (i) => `T${i + 1}`;

export function buildTentacles(M) {
  const group = new THREE.Group();
  const N = G.TENTACLES * G.SEG_PER_T;

  const links = new THREE.InstancedMesh(new RoundedBoxGeometry(0.023, 0.042, 0.023, 1, 0.008), M.white, N);
  const cores = new THREE.InstancedMesh(new RoundedBoxGeometry(0.012, 0.02, 0.012, 1, 0.003), M.dark, N);
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.013, 0.008, 0.003), M.lamp, N);
  const fins = new THREE.InstancedMesh(new RoundedBoxGeometry(0.006, 0.052, 0.026, 1, 0.002), M.skirt, G.TENTACLES);
  for (const m of [links, cores, leds, fins]) {
    m.castShadow = true;
    m.frustumCulled = false;
    group.add(m);
  }

  // 每条须一份 scratch
  const pts = [];
  const ang = [];
  for (let i = 0; i < G.TENTACLES; i++) {
    pts.push(new Float64Array((G.SEG_PER_T + 1) * 3));
    ang.push(new Float64Array(G.SEG_PER_T + 1));
  }
  const lat = new V3();
  const dir = new V3();
  const nrm = new V3();
  const basis = new THREE.Matrix4();

  /** 摆全部 5 条。yield 0..1：其余部件让位时触须收拢贴钟（拖曳摆幅收小） */
  const poseAll = (p, yieldK = 0) => {
    let idx = 0;
    for (let i = 0; i < G.TENTACLES; i++) {
      const az = TENT_AZ(i);
      const Pi = pts[i];
      const Ai = ang[i];
      // 让位：摆角与外倾整体收小 —— 须贴拢钟口
      const shy = 1 - 0.45 * yieldK;
      tentacleChain(az, i, p, Pi, Ai, shy);
      const rx = Math.cos(az);
      const rz = Math.sin(az);
      lat.set(rz, 0, -rx); // 须的侧向
      for (let j = 0; j < G.SEG_PER_T; j++) {
        const th = (Ai[j] + Ai[j + 1]) / 2;
        dir.set(rx * Math.sin(th), -Math.cos(th), rz * Math.sin(th));
        nrm.copy(lat).cross(dir); // 右手基：z = x × y，否则核心内外翻呈黑楔
        basis.makeBasis(lat, dir, nrm);
        const x = (Pi[j * 3] + Pi[j * 3 + 3]) / 2;
        const y = (Pi[j * 3 + 1] + Pi[j * 3 + 4]) / 2;
        const z = (Pi[j * 3 + 2] + Pi[j * 3 + 5]) / 2;
        P.set(x, y, z);
        M4.compose(P, Q.setFromRotationMatrix(basis), S);
        links.setMatrixAt(idx, M4);
        P.set(Pi[j * 3 + 3], Pi[j * 3 + 4], Pi[j * 3 + 5]);
        M4.compose(P, Q, S);
        cores.setMatrixAt(idx, M4);
        P.set(Pi[j * 3] + lat.x * 0.013, Pi[j * 3 + 1] + lat.y * 0.013, Pi[j * 3 + 2] + lat.z * 0.013);
        M4.compose(P, Q, S);
        leds.setMatrixAt(idx, M4);
        idx++;
      }
      // 须端叶鳍，顺末端方向
      {
        const j = G.SEG_PER_T;
        const th = Ai[j];
        dir.set(rx * Math.sin(th), -Math.cos(th), rz * Math.sin(th));
        nrm.copy(lat).cross(dir); // 右手基：z = x × y，否则核心内外翻呈黑楔
        basis.makeBasis(lat, dir, nrm);
        P.set(Pi[j * 3], Pi[j * 3 + 1] + 0.012, Pi[j * 3 + 2]);
        M4.compose(P, Q.setFromRotationMatrix(basis), S);
        fins.setMatrixAt(i, M4);
      }
    }
    for (const m of [links, cores, leds, fins]) m.instanceMatrix.needsUpdate = true;
  };
  poseAll(0, 0);
  return {group, poseAll, pts, ang};
}
