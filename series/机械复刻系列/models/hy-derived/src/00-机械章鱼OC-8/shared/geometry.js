// 00 机械章鱼 OC-8 · 宝石蓝版 · 整机装配
// 外套膜 + 光学 + 虹吸 + 喙 + 臂毂 + 8 腕 + 喷射尾流。
// update(st) 是唯一入口：所有运动量来自 shared/model.js，几何只负责摆位。单位米，正面 +Z。
import * as THREE from 'three';
import {ring, rbox} from '../../kit/geo.js';
import {TAU} from '../../kit/util.js';
import * as MODEL from './model.js';
import {buildMantle} from './geometry-mantle.js';
import {buildOptics} from './geometry-head.js';
import {buildSiphon} from './geometry-siphon.js';
import {buildBeak} from './geometry-beak.js';
import {buildArms} from './geometry-arm.js';

const {HUB_Y, HUB_R, ARM_ISO_INDEX} = MODEL;

export function buildMachine(studio) {
  const M = studio.materials;
  const root = new THREE.Group();

  const mantle = buildMantle(M);
  const optics = buildOptics(M);
  const siphon = buildSiphon(M);
  const beak = buildBeak(M);
  const arms = buildArms(M);
  root.add(mantle.root, optics.root, siphon.root, beak.root, arms.group);

  /* ---------------------------------------------------------------- 臂毂：8 个万向节座 */
  const hub = new THREE.Group();
  hub.position.y = HUB_Y;
  root.add(hub);
  {
    const disc = new THREE.Mesh(ring(0.178, 0.116, 0.040, 48), M.white);
    disc.castShadow = true; disc.receiveShadow = true;
    hub.add(disc);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.0045, 8, 48).rotateX(Math.PI / 2), M.accent);
    trim.position.y = 0.021;
    hub.add(trim);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.088, 0.032, 36), M.dark);
    under.position.y = -0.026; under.castShadow = true;
    hub.add(under);
    // 下缘一圈散热槽
    const vents = new THREE.InstancedMesh(rbox(0.010, 0.014, 0.005, 0.0016, 2), M.darkSoft, 32);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      e.set(0, -a, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.sin(a) * 0.100, -0.026, Math.cos(a) * 0.100), q, new THREE.Vector3(1, 1, 1));
      vents.setMatrixAt(i, m4);
    }
    hub.add(vents);

    // 8 组：白色安装座 + 深色球铰 + 蓝色卡箍 + 4 颗固定螺栓
    const sockets = new THREE.InstancedMesh(rbox(0.042, 0.034, 0.048, 0.006, 3), M.white, MODEL.ARMS);
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 12, 10), M.dark, MODEL.ARMS);
    const clamps = new THREE.InstancedMesh(new THREE.TorusGeometry(0.0185, 0.0032, 6, 18).rotateX(Math.PI / 2), M.accent, MODEL.ARMS);
    const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0026, 7, 5), M.steelDark, MODEL.ARMS * 4);
    let bi = 0;
    for (let i = 0; i < MODEL.ARMS; i++) {
      const a = (i + 0.5) * (TAU / MODEL.ARMS);
      e.set(0, a, 0); q.setFromEuler(e);
      const sx = Math.sin(a), sz = Math.cos(a);
      m4.compose(new THREE.Vector3(sx * 0.152, 0.014, sz * 0.152), q, new THREE.Vector3(1, 1, 1));
      sockets.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(sx * 0.170, 0.014, sz * 0.170), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      balls.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(sx * 0.152, 0.034, sz * 0.152), q, new THREE.Vector3(1, 1, 1));
      clamps.setMatrixAt(i, m4);
      for (const [dx, dz] of [[-0.016, -0.018], [0.016, -0.018], [-0.016, 0.018], [0.016, 0.018]]) {
        const lx = sx * (0.152 + dz), lz = sz * (0.152 + dz);
        m4.makeTranslation(lx + Math.cos(a) * dx, 0.032, lz - Math.sin(a) * dx);
        bolts.setMatrixAt(bi++, m4);
      }
    }
    sockets.castShadow = true; balls.castShadow = true;
    hub.add(sockets, balls, clamps, bolts);
  }

  /* ---------------------------------------------------------------- 喷射尾流（气泡） */
  const WAKE_N = 54;
  const wakeMat = new THREE.MeshBasicMaterial({color: 0xbfd7fa, transparent: true, opacity: 0.55, depthWrite: false});
  const wake = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), wakeMat, WAKE_N);
  wake.frustumCulled = false;
  wake.visible = false;
  root.add(wake);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const wp = new THREE.Vector3();
  const ws = new THREE.Vector3();
  const emitter = new THREE.Vector3();

  /* ---------------------------------------------------------------- 每帧装配 */
  const armMid = new THREE.Vector3();
  const local = new THREE.Vector3();

  function update(st) {
    const {t, petals, breathe, optics: opt, siphon: sip, beak: bk,
      explode = 0, turret = 0, dy = 0, wake: wakeK = 0, opens = {}} = st;
    root.rotation.y = turret;
    root.position.y = dy;

    // 拆解时各总成沿空间关系漂开（舞台调度，不是模型数学）
    mantle.set({
      petalAngle: petals,
      brainRise: 0.02 + (opens.mantle || 0) * 0.065 + explode * 0.05,
      brainTurn: t * 0.35 + explode * 0.8,
      breath: breathe,
      portSpin: t * 0.5,
      open: opens.mantle || 0,
    });
    // 位移量比早期版本加大一倍：20 s「整机拆解」要一眼看出各总成真的分离
    mantle.root.position.set(0, 0.62 + 0.40 * explode, 0);
    mantle.root.rotation.z = explode * 0.08;

    optics.set(opt);
    optics.root.position.set(0, 0.40 * explode, 0.38 * explode);

    siphon.set(sip);
    siphon.root.position.set(0, 0.3 - 0.02 * explode, -0.16 - 0.44 * explode);

    beak.set({jaw: bk.jaw, radulaAngle: bk.radula});
    beak.root.position.set(0, 0.318 - 0.32 * explode, 0);

    hub.position.y = HUB_Y + 0.10 * explode;

    // 第三参把「液压微缸行程」也接到 model.js 的纯函数上：HUD 读数与几何同源
    const wheelCount = arms.pose(t, explode, MODEL.hydraulicStroke);
    if (wheelCount !== MODEL.WHEELS_TOTAL) {
      throw new Error(`滚轮实例数不守恒：${wheelCount} ≠ ${MODEL.WHEELS_TOTAL}`);
    }

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

    // 标注锚点：R2 腕链中点
    {
      const az = (ARM_ISO_INDEX + 0.5) * (TAU / MODEL.ARMS);
      const c = arms.chains[ARM_ISO_INDEX];
      if (c) {
        const p = c.pts[13];
        const rr = HUB_R + 0.34 * explode;
        armMid.set(Math.sin(az) * (rr + p[0]), HUB_Y + 0.10 * explode + p[1], Math.cos(az) * (rr + p[0]));
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
    joint: () => {
      // R2 腕第 14 节关节（HUD 09 面板标注用）
      const az = (ARM_ISO_INDEX + 0.5) * (TAU / MODEL.ARMS);
      const c = arms.chains[ARM_ISO_INDEX];
      if (!c) return armMid.clone();
      const p = c.pts[14];
      local.set(Math.sin(az) * (HUB_R + p[0]), HUB_Y + p[1], Math.cos(az) * (HUB_R + p[0]));
      return root.localToWorld(local.clone());
    },
  };

  return {root, update, mantle, optics, siphon, beak, arms, hub, labelPoints, wake};
}
