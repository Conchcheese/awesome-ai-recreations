// 00 机械章鱼 OC-8 · 宝石蓝版 · 外套膜
// 深色盆体 + 白色铆钉带 + 8 片球面壳瓣（带真实铰链轴、液压撑杆、内衬肋、铆钉排）
// + 密绕线缆脑核 + 7 活塞泵核 + 正面齿轮玻璃舷窗。
// 全部由 set({petalAngle, brainRise, brainTurn, breath, portSpin, open}) 驱动。单位米，正面 +Z。
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {lathe, ring, gear, tube, place, bevelCyl} from '../../kit/geo.js';
import {PETALS, TAU, mulberry32, MANTLE_R} from './model.js';

const R = MANTLE_R;          // 0.15
const DOME_H = 0.225;        // 铰链面到壳顶
const HINGE_Y = -0.02;
const GAP = 0.013;           // 瓣缝
const THETA0 = 0.13;

function combine(parts) {
  const gs = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = mergeGeometries(gs, false);
  return out;
}

export function buildMantle(M) {
  const root = new THREE.Group();
  root.position.y = 0.62;

  const add = (geo, mat, {pos = [0, 0, 0], rot = [0, 0, 0]} = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.rotation.set(...rot);
    m.castShadow = true; m.receiveShadow = true;
    root.add(m); return m;
  };

  /* ---------------------------------------------------------------- 盆体 / 内碗 */
  add(lathe([[0.02, -0.208], [0.062, -0.199], [0.112, -0.174], [0.142, -0.140], [0.152, -0.106]], 52), M.dark);
  const bowl = add(lathe([[0.02, 0.088], [0.062, 0.062], [0.102, 0.027], [0.132, -0.004], [0.145, -0.022]], 48), M.darkSoft);
  bowl.material = M.darkSoft.clone();
  bowl.material.side = THREE.DoubleSide;
  // 内碗的同心肋
  for (let i = 0; i < 3; i++) {
    add(new THREE.TorusGeometry(0.055 + i * 0.032, 0.0016, 5, 40).rotateX(Math.PI / 2), M.steelDark, {pos: [0, 0.052 - i * 0.026, 0]});
  }

  /* ---------------------------------------------------------------- 白色铆钉带 */
  add(lathe([[0.148, -0.110], [0.1525, -0.076], [0.1525, -0.040], [0.150, -0.023], [0.145, -0.020]], 52), M.white);
  add(ring(0.1505, 0.131, 0.009, 52), M.white, {pos: [0, HINGE_Y, 0]});
  add(ring(0.152, 0.1492, 0.0035, 52), M.accent, {pos: [0, -0.037, 0]});
  {
    const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0031, 8, 6), M.steelDark, 48);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      m4.makeTranslation(Math.sin(a) * 0.1525, -0.063, Math.cos(a) * 0.1525);
      bolts.setMatrixAt(i, m4);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.1;
      m4.makeTranslation(Math.sin(a) * 0.148, HINGE_Y + 0.006, Math.cos(a) * 0.148);
      bolts.setMatrixAt(32 + i, m4);
    }
    bolts.castShadow = true;
    root.add(bolts);
  }
  // 带上的蓝色识别块（4 处）
  {
    const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.042, 0.011, 0.0045), M.accent, 4);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.78;
      e.set(0, a, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.sin(a) * 0.152, -0.062, Math.cos(a) * 0.152), q, new THREE.Vector3(1, 1, 1));
      strips.setMatrixAt(i, m4);
    }
    root.add(strips);
  }

  /* ---------------------------------------------------------------- 8 片壳瓣几何 */
  const azStep = TAU / PETALS;
  const halfBase = (azStep - GAP) / 2;
  const NU = 12, NV = 16;
  const thetaAt = (v) => THETA0 + (Math.PI / 2 - THETA0) * v;
  const widenAt = (v) => 1 + 0.15 * (1 - v);
  const ptAt = (v, phi) => {
    const th = thetaAt(v), r = R * Math.sin(th);
    return new THREE.Vector3(-r * Math.cos(phi), DOME_H * Math.cos(th), r * Math.sin(phi));
  };

  function petalGeometry() {
    const pos = [], idx = [];
    for (let v = 0; v <= NV; v++) {
      const vv = v / NV, half = halfBase * widenAt(vv);
      for (let u = 0; u <= NU; u++) {
        const p = ptAt(vv, (u / NU - 0.5) * 2 * half);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) {
      const a = v * (NU + 1) + u, b = a + 1, c = a + NU + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    // mergeGeometries 要求所有部件属性集合一致；tube() 带 uv，这里必须补一份
    const uv = [];
    for (let v = 0; v <= NV; v++) for (let u = 0; u <= NU; u++) uv.push(u / NU, v / NV);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const parts = [g];
    // 外缘 + 两侧包边（做出板厚）
    const rim = [];
    for (let u = 0; u <= 18; u++) rim.push(ptAt(0, (u / 18 - 0.5) * 2 * halfBase * widenAt(0)));
    parts.push(tube(rim, 0.0082, 22, 6));
    for (const side of [-1, 1]) {
      const pts = [];
      for (let v = 0; v <= 16; v++) {
        const vv = v / 16;
        pts.push(ptAt(vv, side * halfBase * widenAt(vv)));
      }
      parts.push(tube(pts, 0.0052, 18, 5));
    }
    // 内衬三道加强肋
    for (const vv of [0.30, 0.55, 0.80]) {
      const pts = [];
      const half = halfBase * widenAt(vv);
      for (let u = 0; u <= 10; u++) {
        const p = ptAt(vv, (u / 10 - 0.5) * 2 * half * 0.92);
        pts.push([p.x, p.y + 0.004, p.z]);
      }
      parts.push(tube(pts, 0.0022, 14, 5));
    }
    return combine(parts);
  }
  const petalBase = petalGeometry();
  const petalMat = M.white.clone();
  petalMat.side = THREE.DoubleSide;

  const petals = [];
  const struts = [];
  for (let i = 0; i < PETALS; i++) {
    const az = i * azStep;
    const pivot = new THREE.Group();
    pivot.position.set(Math.sin(az) * R, HINGE_Y, Math.cos(az) * R);
    root.add(pivot);

    const geo = petalBase.clone();
    geo.rotateY(az + Math.PI / 2);
    const shell = new THREE.Mesh(geo, petalMat);
    shell.position.set(-Math.sin(az) * R, 0, -Math.cos(az) * R);
    shell.castShadow = true; shell.receiveShadow = true;
    pivot.add(shell);

    // 瓣面铆钉：两列各 5 颗，贴着球面
    const rivetParts = [];
    for (const vv of [0.16, 0.34, 0.52, 0.70, 0.88]) {
      for (const s of [-1, 1]) {
        const p = ptAt(vv, s * halfBase * widenAt(vv) * 0.82);
        rivetParts.push(place(new THREE.SphereGeometry(0.0024, 6, 5), {pos: [p.x, p.y + 0.003, p.z]}));
      }
    }
    const rv = new THREE.Mesh(combine(rivetParts), M.steelDark);
    rv.position.copy(shell.position);
    rv.rotation.y = az + Math.PI / 2;
    pivot.add(rv);

    // 蓝色识别条 + 编号块（瓣中段）
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.013, 0.004), M.accent);
    strip.position.set(-Math.sin(az) * 0.014, 0.103, -Math.cos(az) * 0.014);
    strip.rotation.y = az;
    pivot.add(strip);

    // 铰链轴：钢轴 + 两侧白色铰链座 + 端盖（固定在 root 上，不随瓣转）
    const hx = Math.sin(az) * R, hz = Math.cos(az) * R;
    const axisDir = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.074, 12), M.steel);
    hinge.position.set(hx, HINGE_Y, hz);
    hinge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisDir);
    hinge.castShadow = true;
    root.add(hinge);
    for (const s of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.009, 12), M.white);
      seat.position.set(hx + axisDir.x * s * 0.033, HINGE_Y, hz + axisDir.z * s * 0.033);
      seat.quaternion.copy(hinge.quaternion);
      seat.castShadow = true;
      root.add(seat);
    }

    // 液压撑杆：一端固定在盆体，一端随瓣转；每帧重算长度与朝向
    const strut = new THREE.Group();
    root.add(strut);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0046, 1, 10), M.darkSoft);
    barrel.scale.y = 0.62; barrel.position.y = 0.31; barrel.castShadow = true;
    strut.add(barrel);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0019, 0.0019, 1, 8), M.steel);
    rod.scale.y = 0.42; rod.position.y = 0.79; rod.castShadow = true;
    strut.add(rod);
    for (const y of [0.02, 0.98]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 8, 6), M.steelDark);
      eye.position.y = y; strut.add(eye);
    }
    struts.push({group: strut, az, hx, hz, axisDir});
    petals.push({pivot, az, axisDir});
  }

  /* ---------------------------------------------------------------- 顶部舱口 */
  const topCap = new THREE.Group();
  topCap.position.y = DOME_H + HINGE_Y - 0.002;
  root.add(topCap);
  {
    const capRing = new THREE.Mesh(ring(0.052, 0.028, 0.009, 32), M.white);
    capRing.castShadow = true; topCap.add(capRing);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.014, 24), M.dark);
    well.position.y = -0.006; topCap.add(well);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.0285, 0.0018, 6, 24).rotateX(Math.PI / 2), M.accent);
    trim.position.y = 0.004; topCap.add(trim);
  }

  /* ---------------------------------------------------------------- 脑核：密绕线缆团 */
  const brain = new THREE.Group();
  brain.position.y = 0.045;
  root.add(brain);
  {
    const rand = mulberry32(881103);
    const cableParts = [];
    for (let k = 0; k < 34; k++) {
      const pts = [];
      const a0 = rand() * TAU, b0 = rand() * Math.PI;
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const a = a0 + u * (4.2 + rand() * 3.4);
        const b = b0 + Math.sin(u * Math.PI * (1.4 + rand())) * (0.7 + rand() * 0.5);
        const rr = 0.040 + 0.012 * Math.sin(u * Math.PI * 2 + k);
        pts.push([
          Math.sin(b) * Math.cos(a) * rr,
          Math.cos(b) * rr * 0.86,
          Math.sin(b) * Math.sin(a) * rr,
        ]);
      }
      cableParts.push(tube(pts, 0.0021 + rand() * 0.0009, 26, 5));
    }
    const cables = new THREE.Mesh(combine(cableParts), M.darkSoft);
    cables.castShadow = true;
    brain.add(cables);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.043, 20, 14), M.dark);
    core.castShadow = true; brain.add(core);
    // 蓝色卡扣 / 分线环
    const clips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.011, 0.0045, 0.007), M.accent, 10);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (let i = 0; i < 10; i++) {
      e.set(rand() * TAU, rand() * TAU, rand() * TAU); q.setFromEuler(e);
      const a = rand() * TAU, b = rand() * Math.PI;
      p.set(Math.sin(b) * Math.cos(a) * 0.046, Math.cos(b) * 0.040, Math.sin(b) * Math.sin(a) * 0.046);
      m4.compose(p, q, s); clips.setMatrixAt(i, m4);
    }
    clips.castShadow = true; brain.add(clips);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.0022, 6, 36).rotateX(Math.PI / 2), M.accentMatte);
    brain.add(band);
  }

  /* ---------------------------------------------------------------- 泵核：反应环 + 7 活塞 */
  const reactor = new THREE.Group();
  reactor.position.y = 0.004;
  root.add(reactor);
  {
    const rr = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.0072, 8, 36).rotateX(Math.PI / 2), M.accentMatte);
    rr.position.y = 0.004; reactor.add(rr);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.050, 0.0035, 6, 32).rotateX(Math.PI / 2), M.steelDark);
    inner.position.y = 0.004; reactor.add(inner);
    const pist = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.024, 10), M.steel, 7);
    const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0068, 8, 6), M.accent, 7);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      m4.makeTranslation(Math.cos(a) * 0.072, 0.014, Math.sin(a) * 0.072);
      pist.setMatrixAt(i, m4);
      m4.makeTranslation(Math.cos(a) * 0.072, 0.027, Math.sin(a) * 0.072);
      caps.setMatrixAt(i, m4);
    }
    pist.castShadow = true; reactor.add(pist, caps);
  }

  /* ---------------------------------------------------------------- 正面玻璃舷窗 Ø120 */
  const port = new THREE.Group();
  port.position.set(0, -0.132, 0.138);
  root.add(port);
  {
    const housing = new THREE.Mesh(bevelCyl(0.063, 0.050, 0.006, 36), M.white);
    housing.rotation.x = Math.PI / 2; housing.position.z = 0.002;
    housing.castShadow = true; port.add(housing);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.061, 0.0055, 10, 44), M.white);
    lip.position.z = 0.028; port.add(lip);
    const glassMat = M.lens.clone();
    glassMat.color.set(0x0a1424); glassMat.envMapIntensity = 0.8;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.008, 40), glassMat);
    glass.rotation.x = Math.PI / 2; glass.position.z = 0.028; port.add(glass);
    // 玻璃后的齿轮 + 辐条剪影
    const innerGear = new THREE.Mesh(gear({radius: 0.033, teeth: 16, thickness: 0.005, toothH: 0.0045, hole: 0.009}), M.steelDark);
    innerGear.rotation.x = Math.PI / 2; innerGear.position.z = 0.020; port.add(innerGear);
    const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.052, 0.003), M.dark, 6);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 6; i++) {
      m4.makeRotationZ((i / 6) * TAU); m4.setPosition(0, 0, 0.024);
      spokes.setMatrixAt(i, m4);
    }
    port.add(spokes);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0016, 6, 40), M.accentGlow);
    glowRing.position.z = 0.0335; port.add(glowRing);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0515, 0.0046, 10, 44), M.accent);
    rim.position.z = 0.033; port.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.010, 16), M.accent);
    hub.rotation.x = Math.PI / 2; hub.position.z = 0.028; port.add(hub);
    const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0026, 8, 6), M.steelDark, 10);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      m4.makeTranslation(Math.cos(a) * 0.056, Math.sin(a) * 0.056, 0.030);
      bolts.setMatrixAt(i, m4);
    }
    port.add(bolts);
    // 舷窗刻度环
    const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0012, 0.005, 0.0012), M.accent, 24);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      m4.makeRotationZ(-a);
      m4.setPosition(Math.cos(a) * 0.0445, Math.sin(a) * 0.0445, 0.0345);
      ticks.setMatrixAt(i, m4);
    }
    port.add(ticks);
  }

  /* ---------------------------------------------------------------- 每帧装配 */
  const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const Q = new THREE.Quaternion();
  const attach = new THREE.Vector3();
  const hingePoint = new THREE.Vector3();
  const unit = new THREE.Vector3(); // 每帧复用，避免 frame(t) 内 new 对象

  return {
    root, brain, petals, port, reactor, topCap, struts,
    set({petalAngle = 0, brainRise = 0, brainTurn = 0, breath = {r: 1, len: 1}, portSpin = 0, open = 0} = {}) {
      root.scale.set(breath.r, breath.len, breath.r);
      for (const {pivot, axisDir} of petals) pivot.quaternion.setFromAxisAngle(axisDir, petalAngle);
      topCap.scale.setScalar(Math.max(0.001, 1 - open * 0.92));
      brain.position.y = 0.045 + brainRise;
      brain.rotation.y = brainTurn;
      reactor.rotation.y = portSpin;

      // 液压撑杆：A 固定在盆体，B 随瓣绕铰链轴转动
      for (const s of struts) {
        hingePoint.set(s.hx, HINGE_Y, s.hz);
        A.set(Math.sin(s.az) * 0.108, -0.086, Math.cos(s.az) * 0.108);
        attach.set(Math.sin(s.az) * 0.058, 0.104, Math.cos(s.az) * 0.058);
        B.copy(attach).sub(hingePoint).applyAxisAngle(s.axisDir, petalAngle).add(hingePoint);
        D.subVectors(B, A);
        const len = D.length();
        unit.copy(D).divideScalar(len || 1);
        Q.setFromUnitVectors(UP, unit);
        s.group.position.copy(A);
        s.group.quaternion.copy(Q);
        s.group.scale.set(1, len, 1);
      }
    },
    portWorld(v = new THREE.Vector3()) { return port.getWorldPosition(v); },
    brainWorld(v = new THREE.Vector3()) { return brain.getWorldPosition(v); },
  };
}
