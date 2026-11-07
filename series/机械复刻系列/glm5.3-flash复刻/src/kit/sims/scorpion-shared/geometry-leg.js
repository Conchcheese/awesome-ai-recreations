// 一条步行足：基节（带偏航）+ 股节 + 胫节 + 足垫，全部由代码搭出。pose() 每帧把
// 关节矩阵从 model.legPose 重排 —— 没有任何手工动画。每条腿持有自己的材质副本，
// 便于影片里隔离腿 R2 时把其余部件淡成玻璃。
import * as THREE from 'three';
import {G, legPose} from './model.js';

const V3 = THREE.Vector3;
const Y = new V3(0, 1, 0);
const DOWN = new V3(0, -1, 0);
const MID = new V3();
const DIR = new V3();

/** a→b 之间放一根几何（高 1 的单位几何，按长度拉伸、按方向转向） */
function place(mesh, a, b) {
  DIR.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(1e-6, DIR.length());
  MID.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  mesh.position.copy(MID);
  mesh.quaternion.setFromUnitVectors(Y, DIR.multiplyScalar(1 / len));
  mesh.scale.set(1, len, 1);
}

const tapered = (r0, r1) => new THREE.CylinderGeometry(r1, r0, 1, 12); // 底=根部 r0, 顶=端部 r1

export function buildLeg(M) {
  const group = new THREE.Group();
  const mats = {
    tube: M.shell.clone(),
    cap: M.dark.clone(),
    foot: M.rubber.clone(),
  };
  const femur = new THREE.Mesh(tapered(0.0135, 0.0095), mats.tube);
  const tibia = new THREE.Mesh(tapered(0.0085, 0.005), mats.tube);
  const coxa = new THREE.Mesh(tapered(0.013, 0.011), mats.cap);
  const hip = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mats.cap);
  const knee = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mats.cap);
  const bearing = new THREE.Mesh(new THREE.TorusGeometry(1, 1, 6, 18), M.bearing);
  const pad = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 10), mats.foot);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mats.cap);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.02), M.accent);
  for (const m of [femur, tibia, coxa, hip, knee, bearing, pad, tip, badge]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  const pose = (i, p, opts = {}) => {
    const lp = legPose(i, p, opts);
    place(coxa, lp.P0, lp.C);
    place(femur, lp.C, lp.K);
    place(tibia, lp.K, lp.F);
    hip.position.set(lp.C[0], lp.C[1], lp.C[2]);
    hip.scale.setScalar(0.011);
    knee.position.set(lp.K[0], lp.K[1], lp.K[2]);
    knee.scale.setScalar(0.008);
    bearing.position.copy(knee.position);
    bearing.scale.setScalar(0.0068);
    bearing.rotation.set(Math.PI / 2, 0, lp.az);
    // 足垫：沿胫节方向的小锥 + 端点球，钉在地面上
    DIR.set(lp.F[0] - lp.K[0], lp.F[1] - lp.K[1], lp.F[2] - lp.K[2]).normalize();
    pad.position.set(lp.F[0] + DIR.x * 0.004, lp.F[1] + DIR.y * 0.004 - 0.002, lp.F[2] + DIR.z * 0.004);
    pad.quaternion.setFromUnitVectors(DOWN, DIR);
    pad.scale.set(0.0095, 0.017, 0.0095);
    tip.position.set(lp.F[0], lp.F[1] - 0.004, lp.F[2]);
    tip.scale.setScalar(0.0055);
    // 伺服小牌贴在股节中段
    badge.position.set((lp.C[0] + lp.K[0]) / 2, (lp.C[1] + lp.K[1]) / 2 + 0.002, (lp.C[2] + lp.K[2]) / 2);
    badge.rotation.y = -lp.az;
    badge.visible = opts.badge !== false;
    return lp;
  };
  pose(0, 0);
  return {group, pose, mats};
}
