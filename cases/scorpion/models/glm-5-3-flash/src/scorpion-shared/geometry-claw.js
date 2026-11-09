// 一只螯钳：肩球 + 基段 + 齿轮减速鼓 + 掌 + 不动指/动指。set() 每帧把关节点从
// model.clawPose 重排：动指绕掌端铰链轴张开 open 角，攻击段张到最大后咬合。
// 每只钳持有自己的材质副本，便于隔离左钳时把其余部件淡成玻璃。
import * as THREE from 'three';
import {G, clawPose} from './model.js';

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
  mesh.scale.set(1, len, 1); // 截面尺寸已烘进几何
}

/** 把 +Y 对准 dir 的完整朝向（供沿轴的齿轮鼓使用） */
function orient(mesh, dir, side) {
  mesh.quaternion.setFromUnitVectors(Y, DIR.set(dir[0], dir[1], dir[2]).normalize());
  mesh.rotation.y = side; // 无实际作用，保持引用避免被优化
}

const rounded = (w, h, d, r) => new THREE.BoxGeometry(w, h, d, 2, 2, 2); // 简单盒（低多边形面数友好）

export function buildClaw(M) {
  const group = new THREE.Group();
  const mats = {
    shell: M.shell.clone(),
    dark: M.dark.clone(),
    accent: M.accent.clone(),
  };
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mats.dark);
  const base = new THREE.Mesh(rounded(0.028, 1, 0.03, 0), mats.shell); // 基段：高 1 沿方向拉伸
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 16), M.bearing); // 齿轮减速鼓
  const drumCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.034, 12), mats.accent);
  const palm = new THREE.Mesh(rounded(0.034, 1, 0.038, 0), mats.shell);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 6, 20), mats.accent);
  const fingerF = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 10), mats.dark); // 不动指
  const fingerM = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 10), mats.shell); // 动指
  const tipF = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mats.dark);
  const tipM = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mats.accent);
  for (const m of [shoulder, base, drum, drumCap, palm, trim, fingerF, fingerM, tipF, tipM]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  const set = (side, p, demo = 0) => {
    const cp = clawPose(side, p, demo);
    shoulder.position.set(cp.S[0], cp.S[1], cp.S[2]);
    shoulder.scale.setScalar(0.016);
    place(base, cp.S, cp.E);
    drum.position.set(cp.E[0], cp.E[1], cp.E[2]);
    orient(drum, [cp.dirM[2], 0, -cp.dirM[0]], side); // 鼓轴 = 铰链横轴
    drumCap.position.copy(drum.position);
    drumCap.quaternion.copy(drum.quaternion);
    place(palm, cp.E, cp.W);
    trim.position.set(cp.W[0], cp.W[1], cp.W[2]);
    trim.quaternion.setFromUnitVectors(new V3(0, 0, 1), DIR.set(cp.dir[0], cp.dir[1], cp.dir[2]).normalize());
    // 指是锥体（尖朝 +Y）：放在 W→指尖 的前 60% 段，尖由端帽球补
    const finger = (mesh, cap, dir, tipAt) => {
      const w = 0.0095;
      mesh.position.set(cp.W[0] + dir[0] * G.FINGER * 0.42, cp.W[1] + dir[1] * G.FINGER * 0.42, cp.W[2] + dir[2] * G.FINGER * 0.42);
      mesh.quaternion.setFromUnitVectors(Y, DIR.set(dir[0], dir[1], dir[2]).normalize());
      mesh.scale.set(w, G.FINGER * 0.74, w * 0.8);
      cap.position.set(tipAt[0], tipAt[1], tipAt[2]);
      cap.scale.setScalar(0.0042);
    };
    finger(fingerF, tipF, cp.dirF, cp.tipF);
    finger(fingerM, tipM, cp.dirM, cp.tipM);
    return cp;
  };
  set(1, 0);
  return {group, set, mats};
}
