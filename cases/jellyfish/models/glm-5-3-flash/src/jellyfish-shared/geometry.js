// 整台 MJ-9：钟体（8 透明瓣 + 裙边 + 顶板）、泵核（耐压舱 + 喷口 + 平衡腔）、5 条触须。
// update(input) 是唯一动姿势的入口，每个角度都来自 model.js。
// input: {p, bell, pump, tentacle, skirt, explode, wake, wakeT, tilt, dy}，bell/pump/tentacle/skirt
// 为各隔离按钮的开度 0..1 —— 按下去那部分散开，其余身体让位。
import * as THREE from 'three';
import {G, bellBreath, petalAngle, skirtDent, pumpState, pistonStroke, pulse} from './model.js';
import {buildBell} from './geometry-bell.js';
import {buildPump} from './geometry-pump.js';
import {buildTentacles, TENT_AZ, TENT_NAME} from './geometry-tentacle.js';

export function buildMaterials() {
  return {
    white: new THREE.MeshPhysicalMaterial({color: '#eef1f4', roughness: 0.45, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4}),
    dark: new THREE.MeshPhysicalMaterial({color: '#182433', roughness: 0.38, metalness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    steel: new THREE.MeshStandardMaterial({color: '#b9c2cb', roughness: 0.32, metalness: 0.9}),
    blue: new THREE.MeshPhysicalMaterial({color: '#1e5fd6', roughness: 0.4, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    cyan: new THREE.MeshPhysicalMaterial({color: '#12aecb', roughness: 0.42, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.3}),
    // 透明瓣：opacity + depthWrite:false，双面
    bellGlass: new THREE.MeshPhysicalMaterial({color: '#bfe0f0', transparent: true, opacity: 0.3, roughness: 0.12, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15, side: THREE.DoubleSide, depthWrite: false}),
    skirtDS: new THREE.MeshPhysicalMaterial({color: '#9cc8e6', transparent: true, opacity: 0.42, roughness: 0.3, metalness: 0, side: THREE.DoubleSide, depthWrite: false}),
    lamp: new THREE.MeshStandardMaterial({color: '#cfeffc', emissive: '#54d8ff', emissiveIntensity: 0.55, roughness: 0.4}),
    bubble: new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false}),
  };
}

export function buildJellyfish() {
  const M = buildMaterials();
  const root = new THREE.Group();
  const all = [];
  const collect = (g) => g.traverse((o) => o.isMesh && all.push(o));

  const bell = buildBell(M);
  root.add(bell.root);
  const pump = buildPump(M);
  root.add(pump.root);
  const tents = buildTentacles(M);
  root.add(tents.group);
  collect(root);

  // ------------------------------------------------------------ 排气尾流：实例化气泡，位置是 wakeT 的闭式函数
  const WAKE_N = 40;
  const wake = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.bubble, WAKE_N);
  wake.frustumCulled = false;
  wake.visible = false;
  root.add(wake);
  const S1 = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const v0 = new THREE.Vector3();

  // ------------------------------------------------------------ 拆解偏移（舞台调度，不属于模型数学）
  const OFF = {
    bell: new THREE.Vector3(0, 0.26, 0),
    pump: new THREE.Vector3(0, -0.3, 0),
    tents: new THREE.Vector3(0, -0.1, 0),
    skirt: new THREE.Vector3(0, 0.0, 0),
  };
  const ASM = [['bell', bell.root], ['pump', pump.root], ['tents', tents.group]];
  for (const [, g] of ASM) g.userData.home = g.position.clone();

  const out = {p: 0, angles: new Float64Array(8)};
  /** 唯一 update：机器上的一切经这里读 model.js */
  const update = ({p = 0, bell: bellOpen = 0, pump: pumpOpen = 0, tentacle: tentOpen = 0, skirt: skirtOpen = 0, explode = 0, wake: wakeK = 0, wakeT = 0, tilt = 0, dy = 0} = {}) => {
    out.p = p;
    root.rotation.x = tilt;
    root.position.y = dy;
    M.lamp.emissiveIntensity = 0.3 + 0.55 * pulse(p); // 触须灯段与钟顶灯圈随收缩点亮
    const breath = bellBreath(p);
    // 各瓣收缩波 + 隔离外翻
    for (let i = 0; i < G.PETALS; i++) out.angles[i] = petalAngle(i, p, bellOpen);
    // 其余身体让位：钟体或裙边隔离时触须收拢，泵核隔离时触须也让
    const tentYield = Math.max(bellOpen * 0.7, skirtOpen * 0.7, pumpOpen * 0.4);
    bell.set(breath, out.angles, skirtDent(p, skirtOpen), skirtOpen);
    const ps = pumpState(p, pumpOpen);
    pump.set(ps.spin, ps.spread, ps.intake, pistonStroke(p), pumpOpen);
    // 隔离触须：须根外倾散开（由 tentOpen 增大根部偏角——用负 yield 模拟外张）
    tents.poseAll(p, tentOpen > 0.5 ? -tentOpen * 0.5 : tentYield);
    // 拆解：钟体上浮、泵核下沉穿钟口而出、触须下坠外漂、裙边随钟
    for (const [k, g] of ASM) g.position.copy(g.userData.home).addScaledVector(OFF[k], explode);
    bell.skirt.position.y = bell.RIM_Y - 0.004 + OFF.tents.y * explode;
    // 排气尾流
    wake.visible = wakeK > 0.02;
    if (wake.visible) {
      pump.nozzle.updateWorldMatrix(true, false);
      v0.set(0, -0.03, 0).applyMatrix4(pump.nozzle.matrixWorld);
      const off = new THREE.Vector3();
      for (let i = 0; i < WAKE_N; i++) {
        const u = (i / WAKE_N + wakeT * 0.75) % 1;
        const spread = 0.015 + u * 0.1;
        const ang = i * 2.39996;
        off.set(v0.x + Math.cos(ang) * spread * u, v0.y - u * u * 0.09 - u * 0.02, v0.z + Math.sin(ang) * spread * u);
        m4.compose(
          off,
          q0,
          S1.set(1, 1, 1).multiplyScalar(0.005 * (1 - u) * (0.35 + wakeK)),
        );
        wake.setMatrixAt(i, m4);
      }
      wake.instanceMatrix.needsUpdate = true;
      M.bubble.opacity = 0.22 + 0.3 * wakeK;
    }
  };
  update();
  return {root, update, M, all, bell, pump, tents, TENT_AZ, TENT_NAME, out};
}
