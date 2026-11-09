// 00 机械章鱼 OC-8 · 喙：中心下方的深色双颚 + 宝石紫齿舌环（像光圈一样开合）。
// 局部原点在世界 (0, 0.27, 0)，齿舌环朝下前方；jaw 0..0.5 让双颚向两侧分开。
import * as THREE from 'three';
import {bevelCyl, gear, ring} from '../../../../../../shared/mechanical/deepseek-kit/geo.js';

export function buildBeak(M) {
  const root = new THREE.Group();
  root.position.set(0, 0.318, 0);
  root.scale.setScalar(0.78);

  const add = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // 深色基座（半球碗，开口朝上接住机腹）
  add(new THREE.SphereGeometry(0.092, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), M.dark, [0, 0.075, 0], [Math.PI, 0, 0]);
  add(new THREE.TorusGeometry(0.086, 0.007, 8, 32), M.white, [0, 0.098, 0], [Math.PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(0.078, 0.004, 8, 32), M.accent, [0, 0.06, 0], [Math.PI / 2, 0, 0]);

  // 齿舌环：宝石紫齿轮 + 中央轴
  const radula = new THREE.Group();
  radula.position.set(0, -0.012, 0.012);
  radula.rotation.x = -1.02; // 齿舌环朝前下方，从机腹看是正圆
  root.add(radula);
  {
    const g = new THREE.Mesh(gear({radius: 0.044, teeth: 16, thickness: 0.013, toothH: 0.008, hole: 0.012}), M.accent);
    g.castShadow = true;
    radula.add(g);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.016, 22), M.steelDark);
    radula.add(inner);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 12), M.dark);
    radula.add(axle);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 12), M.dark);
    tip.position.y = -0.038;
    tip.rotation.x = Math.PI;
    radula.add(tip);
  }

  // 双颚：弯曲的深色板，向两侧分开
  const jawGeo = (() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.038, 0.045, 0.012),
      new THREE.Vector3(0.052, 0.018, 0.006),
      new THREE.Vector3(0.048, -0.02, 0),
      new THREE.Vector3(0.028, -0.052, -0.004),
    ]);
    const sh = new THREE.Shape();
    sh.moveTo(-0.011, -0.014);
    sh.lineTo(0.011, -0.014);
    sh.lineTo(0.008, 0.014);
    sh.lineTo(-0.008, 0.014);
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, {steps: 20, extrudePath: curve, bevelEnabled: false});
  })();
  const jaws = [1, -1].map((sx) => {
    const j = new THREE.Mesh(jawGeo, M.dark);
    j.scale.x = sx;
    j.castShadow = true;
    root.add(j);
    return j;
  });

  // 颚上的紫色小条与铆钉
  const jawTrim = [1, -1].map((sx) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.006), M.accent);
    t.position.set(sx * 0.05, 0.05, 0.015);
    root.add(t);
    return t;
  });

  return {
    root,
    radula,
    jaws,
    /** jaw 0..1：双颚分开；radulaAngle：齿舌环转动 */
    set({jaw = 0, radulaAngle = 0} = {}) {
      jaws.forEach((j, i) => {
        const sx = i === 0 ? 1 : -1;
        j.position.x = sx * (0.004 + jaw * 0.075);
        j.rotation.z = -sx * jaw * 0.55;
        jawTrim[i].position.x = sx * (0.05 + jaw * 0.07);
        jawTrim[i].rotation.z = -sx * jaw * 0.55;
      });
      radula.rotation.y = radulaAngle;
    },
    jawWorld(v = new THREE.Vector3()) {
      return root.getWorldPosition(v).add(new THREE.Vector3(0, -0.02, 0.04));
    },
  };
}
