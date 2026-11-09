// 00 机械章鱼 OC-8 · 整机装配：外套膜 + 光学 + 虹吸 + 喙 + 臂毂 + 8 臂 + 喷射尾流。
// update(st) 是唯一入口，所有运动量由 shared/model.js 算出后传进来。单位米，机器正面 +Z。
import * as THREE from 'three';
import {ring, rbox, place, merge} from '../../../../../../shared/mechanical/deepseek-kit/geo.js';
import {mulberry32, TAU, clamp} from '../../../../../../shared/mechanical/deepseek-kit/util.js';
import {buildMantle} from './geometry-mantle.js';
import {buildOptics} from './geometry-head.js';
import {buildSiphon} from './geometry-siphon.js';
import {buildBeak} from './geometry-beak.js';
import {buildArms} from './geometry-arm.js';

const HUB_Y = 0.4;
const HUB_R = 0.165;

export function buildMachine(studio) {
  const M = studio.materials;
  const root = new THREE.Group();

  const mantle = buildMantle(M);
  const optics = buildOptics(M);
  const siphon = buildSiphon(M);
  const beak = buildBeak(M);
  const arms = buildArms(M);
  root.add(mantle.root, optics.root, siphon.root, beak.root, arms.group);

  /* ---------------------------------------------------------------- 臂毂 */
  const hub = new THREE.Group();
  hub.position.y = HUB_Y;
  root.add(hub);
  {
    const disc = new THREE.Mesh(ring(0.175, 0.118, 0.04, 48), M.white);
    disc.castShadow = true;
    disc.receiveShadow = true;
    hub.add(disc);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.169, 0.0045, 8, 48).rotateX(Math.PI / 2), M.accent);
    trim.position.y = 0.021;
    hub.add(trim);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.088, 0.032, 36), M.dark);
    under.position.y = -0.026;
    hub.add(under);
    const sockets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.032, 0.045), M.white, 8);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) * (TAU / 8);
      e.set(0, a, 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.sin(a) * 0.152, 0.014, Math.cos(a) * 0.152), q, new THREE.Vector3(1, 1, 1));
      sockets.setMatrixAt(i, m4);
    }
    sockets.castShadow = true;
    hub.add(sockets);
  }

  /* ---------------------------------------------------------------- 喷射尾流（气泡） */
  const WAKE_N = 54;
  const wakeMat = new THREE.MeshBasicMaterial({color: 0xc4b5fd, transparent: true, opacity: 0.55, depthWrite: false});
  const wake = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), wakeMat, WAKE_N);
  wake.frustumCulled = false;
  wake.visible = false;
  root.add(wake);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const wp = new THREE.Vector3();
  const ws = new THREE.Vector3();
  const emitter = new THREE.Vector3();

  /* ---------------------------------------------------------------- 更新 */
  const armMid = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function update(st) {
    const {t, petals, breathe, optics: opt, siphon: sip, beak: bk, explode = 0, turret = 0, dy = 0, wake: wakeK = 0, opens = {}} = st;
    root.rotation.y = turret;
    root.position.y = dy;

    // 拆解时各总成沿空间关系漂开（数值是舞台调度，不是模型数学）
    mantle.set({
      petalAngle: petals,
      brainRise: 0.02 + (opens.mantle || 0) * 0.065 + explode * 0.05,
      brainTurn: t * 0.35 + explode * 0.8,
      breath: breathe,
      portSpin: t * 0.5,
      open: opens.mantle || 0,
    });
    mantle.root.position.set(0, 0.62 + 0.2 * explode, 0);
    mantle.root.rotation.z = explode * 0.08;

    optics.set(opt);
    optics.root.position.set(0, 0.34 * explode, 0.24 * explode);

    siphon.set(sip);
    siphon.root.position.set(0, 0.3 - 0.015 * explode, -0.16 - 0.24 * explode);

    beak.set({jaw: bk.jaw, radulaAngle: bk.radula});
    beak.root.position.set(0, 0.318 - 0.18 * explode, 0);

    hub.position.y = HUB_Y + 0.05 * explode;

    arms.pose(t, explode);

    // 尾流：从虹吸喷口向后扩散（局部坐标，随整机转台旋转）
    siphon.root.updateMatrix();
    emitter.set(0, 0.02, -0.2 - 0.12 * (sip.extend || 0)).applyMatrix4(siphon.root.matrix);
    wake.visible = wakeK > 0.02;
    if (wake.visible) {
      for (let i = 0; i < WAKE_N; i++) {
        const u = (i / WAKE_N + t * 1.05) % 1;
        const spread = 0.015 + u * 0.12;
        const a = i * 2.39996;
        wp.set(
          emitter.x + Math.cos(a) * spread,
          emitter.y - 0.03 - u * 0.18 - 0.05 * u * u,
          emitter.z - (0.03 + u * 0.75) * (0.4 + 0.6 * wakeK),
        );
        const s = 0.0062 * (1 - u) * (0.45 + wakeK);
        ws.set(s, s, s);
        m4.compose(wp, q, ws);
        wake.setMatrixAt(i, m4);
      }
      wake.instanceMatrix.needsUpdate = true;
      wakeMat.opacity = 0.2 + 0.4 * wakeK;
    }

    // 标注用的臂链中点（R2 臂）
    {
      const az = 1.5 * (TAU / 8);
      const c = arms.chain[1];
      if (c) {
        const p = c.pts[13];
        armMid.set(Math.sin(az) * HUB_R + Math.sin(az) * p[0], HUB_Y + p[1], Math.cos(az) * HUB_R + Math.cos(az) * p[0]);
        root.localToWorld(armMid);
      }
    }

    root.updateMatrixWorld(true);
  }

  const labelPoints = {
    optics: () => optics.units[0].unit.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, 0.06)),
    mantle: () => mantle.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.1, 0.16, 0.02)),
    port: () => mantle.portWorld(new THREE.Vector3()),
    brain: () => mantle.brainWorld(new THREE.Vector3()),
    siphon: () => siphon.tipWorld(new THREE.Vector3()),
    beak: () => beak.jawWorld(new THREE.Vector3()),
    arm: () => armMid.clone(),
    hub: () => hub.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.12, 0.01, 0.06)),
  };

  return {root, update, mantle, optics, siphon, beak, arms, hub, labelPoints, wake};
}
