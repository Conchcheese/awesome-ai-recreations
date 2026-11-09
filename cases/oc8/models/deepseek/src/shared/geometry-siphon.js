// 00 机械章鱼 OC-8 · 虹吸：白色外壳 + 3 层套筒 + 6 瓣喷口 + 12 叶片涡轮，位于外套膜后下方。
// 局部原点在后下方，喷口朝 -Z 略向下；extend 伸出套筒，spread 打开喷口，turbine 驱动叶片。
import * as THREE from 'three';
import {bevelCyl, ring} from '../../../../../../shared/mechanical/deepseek-kit/geo.js';

export function buildSiphon(M) {
  const root = new THREE.Group();
  root.position.set(0, 0.3, -0.17);
  root.rotation.x = -0.36; // 喷口朝后下方
  root.scale.setScalar(1.08);

  const add = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // 外壳漏斗
  add(new THREE.CylinderGeometry(0.055, 0.07, 0.06, 28), M.white, [0, 0, -0.005], [Math.PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(0.058, 0.006, 8, 30), M.accent, [0, 0, -0.03]);
  add(new THREE.TorusGeometry(0.066, 0.004, 8, 30), M.white, [0, 0, 0.022]);

  // 3 层套筒（沿 -Z 依次缩径）
  const sleeves = [];
  const sleeveDefs = [
    {r: 0.043, len: 0.062, mat: M.darkSoft},
    {r: 0.037, len: 0.058, mat: M.white},
    {r: 0.031, len: 0.054, mat: M.darkSoft},
  ];
  sleeveDefs.forEach((d, i) => {
    const g = new THREE.Group();
    root.add(g);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r * 0.96, d.len, 24), d.mat);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -d.len / 2;
    tube.castShadow = true;
    g.add(tube);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(d.r + 0.001, 0.0022, 8, 26), M.accent);
    trim.position.z = -d.len;
    g.add(trim);
    sleeves.push(g);
  });

  // 喷口 6 瓣
  const flaps = [];
  const flapRoot = new THREE.Group();
  flapRoot.position.z = -0.16;
  root.add(flapRoot);
  {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.018, 18), M.dark);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.004;
    flapRoot.add(hub);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.z = a;
    flapRoot.add(pivot);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.018, 0);
    pivot.add(hinge);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.032), M.dark);
    flap.position.z = 0.016;
    flap.castShadow = true;
    hinge.add(flap);
    flaps.push(hinge);
  }

  // 涡轮：12 片叶（InstancedMesh，每帧按 turbine 角装配）
  const blades = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.026, 0.016), M.steelDark, 12);
  blades.castShadow = true;
  root.add(blades);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);

  const tip = new THREE.Vector3();
  return {
    root,
    sleeves,
    flaps,
    /** extend 0..1 套筒；spread 0..1 喷口；turbine 0..1 转速相位 */
    set({extend = 0, spread = 0, turbine = 0} = {}) {
      sleeves.forEach((g, i) => {
        g.position.z = -0.05 - i * (0.024 + extend * 0.032);
      });
      flapRoot.position.z = -0.148 - 0.096 * extend;
      for (const h of flaps) h.rotation.x = -(0.05 + spread * 0.95);
      const ang = turbine * Math.PI * 2 * 2.4;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + ang;
        e.set(0, 0, a);
        q.setFromEuler(e);
        p.set(Math.cos(a) * 0.026, Math.sin(a) * 0.026, flapRoot.position.z + 0.004);
        m4.compose(p, q, s);
        blades.setMatrixAt(i, m4);
      }
      blades.instanceMatrix.needsUpdate = true;
    },
    /** 喷口世界坐标（尾流 / 标注用） */
    tipWorld(v = new THREE.Vector3()) {
      tip.set(0, 0, flapRoot.position.z - 0.02);
      return root.localToWorld(tip.clone());
    },
  };
}
