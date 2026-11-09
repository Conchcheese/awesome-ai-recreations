// MJ-9 的钟体：8 片透明柔性瓣（半球瓣，铰接在钟缘环上，收缩时下压收拢、舒张回弹张开），
// 钟缘环与 8 只缘节（触须挂点）、锯齿裙边（收缩内收）、钟顶极板与青色灯圈。
// set(breath, petalAngle[], dent, flare) 每帧从 model.js 的量摆姿势。
import * as THREE from 'three';
import {G} from './model.js';

const V3 = THREE.Vector3;

export function buildBell(M) {
  const root = new THREE.Group();
  const add = (parent, geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };

  const R = G.BELL_R;
  const PHI = Math.acos(0.32); // 球冠角：冠高 = R·(1-cosφ) ≈ 0.17
  const RIM_R = R * Math.sin(PHI); // ≈ 0.237
  const RIM_Y = R * Math.cos(PHI) - 0.14; // 球心下移 0.14，让钟口落在 y = -0.06
  const DOME_DY = -0.14;

  // ------------------------------------------------------------ 8 片透明瓣
  const dome = new THREE.Group();
  dome.position.y = DOME_DY;
  root.add(dome);
  const azSpan = (Math.PI * 2) / G.PETALS;
  const gap = 2.6 * (Math.PI / 180);
  const petals = [];
  for (let i = 0; i < G.PETALS; i++) {
    const az = i * azSpan;
    const g = new THREE.SphereGeometry(R, 7, 9, az + gap, azSpan - 2 * gap, 0, PHI);
    const h = new V3(Math.sin(az) * RIM_R, RIM_Y - DOME_DY, Math.cos(az) * RIM_R);
    g.translate(-h.x, -h.y, -h.z); // 把瓣的缘点搬到原点，绕它铰接
    const pivot = new THREE.Group();
    pivot.position.copy(h);
    pivot.add(new THREE.Mesh(g, M.bellGlass));
    dome.add(pivot);
    petals.push({pivot, az});
  }

  // ------------------------------------------------------------ 钟缘环 + 缘节
  const rim = new THREE.Group();
  rim.position.y = RIM_Y;
  root.add(rim);
  add(rim, new THREE.TorusGeometry(RIM_R, 0.009, 10, 48).rotateX(Math.PI / 2), M.white);
  add(rim, new THREE.TorusGeometry(RIM_R, 0.0045, 6, 48).rotateX(Math.PI / 2), M.cyan).position.y = -0.008;
  for (let i = 0; i < G.PETALS; i++) {
    const az = (i + 0.5) * azSpan;
    const knuckle = add(rim, new THREE.SphereGeometry(0.016, 12, 10), M.white);
    knuckle.position.set(Math.sin(az) * RIM_R, -0.004, Math.cos(az) * RIM_R);
    add(rim, new THREE.TorusGeometry(0.02, 0.004, 6, 16).rotateX(Math.PI / 2).translate(Math.sin(az) * RIM_R, -0.012, Math.cos(az) * RIM_R), M.steel);
  }

  // ------------------------------------------------------------ 锯齿裙边（收缩内收 / 隔离外张）
  const skirt = new THREE.Group();
  skirt.position.y = RIM_Y - 0.004;
  root.add(skirt);
  const skirtFlaps = [];
  for (let i = 0; i < G.SKIRT_FLAPS; i++) {
    const az = (i + 0.5) * azSpan;
    const g = new THREE.CylinderGeometry(RIM_R * 0.97, RIM_R * 0.8, 0.055, 4, 1, true, az + gap * 0.5, azSpan - gap);
    const flap = new THREE.Mesh(g, M.skirtDS);
    skirt.add(flap);
    skirtFlaps.push(flap);
  }

  // ------------------------------------------------------------ 钟顶极板 + 灯圈
  const top = new THREE.Group();
  top.position.y = R * Math.cos(0) + DOME_DY; // 冠顶
  root.add(top);
  const plate = add(top, new THREE.CylinderGeometry(0.052, 0.06, 0.012, 32), M.white);
  plate.castShadow = true;
  add(top, new THREE.TorusGeometry(0.042, 0.007, 8, 32).rotateX(Math.PI / 2), M.lamp);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bolt = add(top, new THREE.CylinderGeometry(0.004, 0.004, 0.006, 8), M.steel);
    bolt.position.set(Math.cos(a) * 0.046, 0.009, Math.sin(a) * 0.046);
  }

  const TANGENT = new V3();
  return {
    root, petals, rim, skirt, top, R, RIM_R, RIM_Y,
    /** breath = bellBreath(p)；angles = 每瓣铰接角；dent 内收量；flare 0..1 外张 */
    set(breath, angles, dent, flare) {
      dome.scale.set(breath.r, breath.h, breath.r);
      top.position.y = (R + DOME_DY) * breath.h; // 极板跟着冠顶走
      for (let i = 0; i < petals.length; i++) {
        const {pivot, az} = petals[i];
        TANGENT.set(-Math.cos(az), 0, Math.sin(az)); // 正角 = 瓣缘向钟内收拢
        pivot.setRotationFromAxisAngle(TANGENT, angles[i]);
      }
      const rk = 1 - dent / RIM_R + flare * 0.3;
      skirt.scale.set(rk, 1, rk);
    },
  };
}
