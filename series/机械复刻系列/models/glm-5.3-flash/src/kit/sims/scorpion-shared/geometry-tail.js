// 尾节链：基座鼓 + 5 节锥形壳 + 球关节 + 毒针（锥针 + 毒囊）。set() 每帧把每节的
// 位置/朝向从 model.tailPose 重排 —— 甩击是模型里的刚体转动，这里只负责摆出来。
// 拆解时节 i 沿静息弧线的切向错开（尾链逐节分离）。
import * as THREE from 'three';
import {G, tailPose} from './model.js';

const V3 = THREE.Vector3;
const Y = new V3(0, 1, 0);
const MID = new V3();
const DIR = new V3();

function place(mesh, a, b) {
  DIR.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(1e-6, DIR.length());
  MID.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  mesh.position.copy(MID);
  mesh.quaternion.setFromUnitVectors(Y, DIR.multiplyScalar(1 / len));
  mesh.scale.set(1, len, 1); // 半径已烘进几何
}

export function buildTail(M) {
  const group = new THREE.Group();
  const mats = {
    shell: M.shell.clone(),
    dark: M.dark.clone(),
    accent: M.accent.clone(),
    glow: M.glow.clone(),
  };
  const baseDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.03, 18), mats.dark);
  const baseTrim = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0035, 6, 22), mats.accent);
  const segs = [];
  const joints = [];
  for (let i = 0; i < G.TAIL_SEGS; i++) {
    const r0 = 0.019 - i * 0.0024;
    const r1 = 0.0155 - i * 0.0024;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 12), mats.shell);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), mats.dark);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 1, 5, 16), i === 2 ? M.accent : M.bearing);
    segs.push(seg);
    joints.push([joint, ring]);
    for (const m of [seg, joint, ring]) {
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
  }
  const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.0075, 1, 12), mats.dark);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), mats.glow);
  stinger.castShadow = true;
  bulb.castShadow = true;
  group.add(stinger, bulb);

  // 静息弧线的每节切向（拆解错开方向）
  const REST_DIR = G.REST.map((d) => [0, Math.sin(d * Math.PI / 180), Math.cos(d * Math.PI / 180)]);

  const set = (p, explode = 0) => {
    const tp = tailPose(p);
    baseDrum.position.set(G.TAIL_BASE[0], G.TAIL_BASE[1], G.TAIL_BASE[2]);
    baseDrum.quaternion.setFromUnitVectors(Y, DIR.set(0, Math.sin(tp.th[0]), Math.cos(tp.th[0])).normalize());
    baseTrim.position.copy(baseDrum.position);
    baseTrim.quaternion.copy(baseDrum.quaternion);
    baseTrim.rotateX(Math.PI / 2);
    for (let i = 0; i < G.TAIL_SEGS; i++) {
      // 拆解：节 i 沿自身静息切向后错（先到期的节先走）
      const e = Math.min(1, Math.max(0, explode * 1.7 - i * 0.13));
      const k = e * e * (3 - 2 * e);
      const off = 0.016 * (i + 1) * k;
      const a = [tp.J[i][0] + REST_DIR[i][0] * off, tp.J[i][1] + REST_DIR[i][1] * off, tp.J[i][2] + REST_DIR[i][2] * off];
      const b = [tp.J[i + 1][0] + REST_DIR[i][0] * off, tp.J[i + 1][1] + REST_DIR[i][1] * off, tp.J[i + 1][2] + REST_DIR[i][2] * off];
      place(segs[i], a, b);
      joints[i][0].position.set(b[0], b[1], b[2]);
      joints[i][0].scale.setScalar(0.0125 - i * 0.0008);
      joints[i][1].position.copy(joints[i][0].position);
      joints[i][1].scale.setScalar(0.0085 - i * 0.0005);
      joints[i][1].rotation.set(Math.PI / 2, 0, tp.th[i]);
      joints[i][1].visible = k < 0.5;
    }
    // 毒针：末节方向再折 STINGER_BEND，攻击时毒囊亮起
    const st = tp.stinger;
    const sdir = [0, Math.sin(st), Math.cos(st)];
    const j5 = tp.J[G.TAIL_SEGS];
    const e5 = Math.min(1, Math.max(0, explode * 1.7 - G.TAIL_SEGS * 0.13));
    const k5 = e5 * e5 * (3 - 2 * e5);
    const off5 = 0.016 * G.TAIL_SEGS * k5;
    stinger.position.set(j5[0] + sdir[0] * (G.STINGER * 0.5 + off5), j5[1] + sdir[1] * (G.STINGER * 0.5 + off5), j5[2] + sdir[2] * (G.STINGER * 0.5 + off5));
    stinger.quaternion.setFromUnitVectors(Y, DIR.set(sdir[0], sdir[1], sdir[2]).normalize());
    stinger.scale.set(1, G.STINGER * 0.72, 1);
    bulb.position.set(j5[0] + sdir[0] * off5 * 0.5, j5[1] + sdir[1] * off5 * 0.5, j5[2] + sdir[2] * off5 * 0.5);
    bulb.scale.setScalar(0.011);
    return tp;
  };
  set(0);
  return {group, set, mats, bulb};
}
