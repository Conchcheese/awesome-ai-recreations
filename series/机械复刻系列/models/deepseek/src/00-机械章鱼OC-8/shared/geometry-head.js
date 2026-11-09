// 00 机械章鱼 OC-8 · 光学阵列：两只 82 mm 大镜头（白色镜筒 + 深色内筒 + 10 叶光圈 + 玻璃 + 紫环 + 红外环）。
// 装在头部前上方两侧，朝 +Z 略向外撇；focus 让内筒伸出，ir 控制红外环亮度，iris 微调光圈。
import * as THREE from 'three';
import {bevelCyl, merge, place} from '../../kit/geo.js';

const D2R = Math.PI / 180;
const BLADES = 10;
const IR_LEDS = 16;

export function buildOptics(M) {
  const root = new THREE.Group();
  const units = [];

  // 头部白色整流罩：包住镜筒根部，融入外壳
  for (const sx of [1, -1]) {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.082, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), M.white);
    pod.scale.set(0.9, 0.72, 1.05);
    pod.rotation.x = Math.PI * 0.52;
    pod.position.set(sx * 0.098, 0.638, 0.072);
    pod.castShadow = true;
    pod.receiveShadow = true;
    root.add(pod);
    // 整流罩上的紫色条块
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.011, 0.006), M.accent);
    strip.position.set(sx * 0.1, 0.688, 0.118);
    strip.rotation.z = sx * 0.12;
    root.add(strip);
    // 罩壳铆钉
    const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0028, 8, 6), M.dark, 6);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      m4.makeTranslation(sx * 0.098 + Math.cos(a) * 0.064, 0.638 + Math.sin(a) * 0.045, 0.13);
      bolts.setMatrixAt(i, m4);
    }
    root.add(bolts);
  }

  for (const sx of [1, -1]) {
    const unit = new THREE.Group();
    unit.position.set(sx * 0.098, 0.638, 0.115);
    unit.rotation.set(-5 * D2R, sx * 20 * D2R, 0);
    root.add(unit);

    const add = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      m.rotation.set(...rot);
      m.castShadow = true;
      m.receiveShadow = true;
      unit.add(m);
      return m;
    };

    /* --- 镜筒 --- */
    add(bevelCyl(0.047, 0.115, 0.008, 30), M.white, [0, 0, 0.005], [Math.PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(0.0475, 0.005, 8, 36), M.white, [0, 0, 0.06]);
    // 镜筒后部与机体的黑色法兰
    add(new THREE.CylinderGeometry(0.052, 0.057, 0.05, 26), M.darkSoft, [0, 0, -0.062], [Math.PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(0.052, 0.004, 8, 30), M.accent, [0, 0, -0.04]);
    // 镜筒前缘紫色细环
    add(new THREE.TorusGeometry(0.0435, 0.0038, 8, 36), M.accent, [0, 0, 0.062]);
    // 与穹顶的安装座 / 卡箍
    add(new THREE.TorusGeometry(0.0555, 0.0085, 8, 30), M.white, [0, 0, -0.028]);
    add(new THREE.TorusGeometry(0.0525, 0.003, 6, 30), M.darkSoft, [0, 0, -0.037]);
    const clampBolts = merge(
      Array.from({length: 6}, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        return place(new THREE.SphereGeometry(0.0034, 6, 4), {pos: [Math.cos(a) * 0.0585, Math.sin(a) * 0.0585, -0.022]});
      }),
    );
    unit.add(new THREE.Mesh(clampBolts, M.darkSoft));

    /* --- 内筒（对焦时前伸） --- */
    const focus = new THREE.Group();
    unit.add(focus);
    const tube = new THREE.Mesh(bevelCyl(0.0365, 0.048, 0.004, 26), M.dark);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = 0.045;
    tube.castShadow = true;
    focus.add(tube);
    // 内筒上的三道凸筋
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.007, 0.04), M.darkSoft);
      rib.position.set(Math.cos(a) * 0.0365, Math.sin(a) * 0.0365, 0.045);
      focus.add(rib);
    }

    /* --- 10 叶光圈 --- */
    const irisGeo = merge(
      Array.from({length: BLADES}, (_, i) => {
        const blade = new THREE.BoxGeometry(0.028, 0.004, 0.006);
        const a = (i / BLADES) * Math.PI * 2;
        return place(blade, {pos: [Math.cos(a) * 0.0155, Math.sin(a) * 0.0155, 0.069], rot: [0, 0, a + 0.5]});
      }),
    );
    const irisMat = M.dark.clone();
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = 0;
    focus.add(iris);
    add(new THREE.CylinderGeometry(0.0195, 0.0195, 0.012, 22), M.dark, [0, 0, 0.066], [Math.PI / 2, 0, 0]);

    /* --- 玻璃面 + 高光 --- */
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.0315, 0.0315, 0.006, 32), M.lens);
    glass.rotation.x = Math.PI / 2;
    glass.position.z = 0.073;
    focus.add(glass);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), M.glass);
    glint.position.set(-0.011, 0.009, 0.077);
    glint.rotation.z = 0.5;
    focus.add(glint);

    /* --- 红外环：细环 + 16 颗小灯点 --- */
    const irMat = M.accentGlow.clone();
    irMat.emissiveIntensity = 0.2;
    const irRing = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.0018, 6, 40), irMat);
    irRing.position.z = 0.068;
    focus.add(irRing);
    const ledGeo = merge(
      Array.from({length: IR_LEDS}, (_, i) => {
        const a = (i / IR_LEDS) * Math.PI * 2;
        return place(new THREE.SphereGeometry(0.0017, 6, 4), {pos: [Math.cos(a) * 0.0385, Math.sin(a) * 0.0385, 0.066]});
      }),
    );
    const leds = new THREE.Mesh(ledGeo, irMat);
    focus.add(leds);

    units.push({unit, focus, irMat, irRing, sx});
  }

  // 两眼之间的深色传感器
  {
    const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.018, 20), M.dark);
    sensor.rotation.x = Math.PI / 2;
    sensor.position.set(0, 0.612, 0.145);
    root.add(sensor);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.009, 16), M.accentGlow);
    dot.position.set(0, 0.612, 0.155);
    root.add(dot);
  }

  return {
    root,
    units,
    set({focus = 0, ir = 0, iris = 0.5} = {}) {
      for (const u of units) {
        u.focus.position.z = 0.002 + focus * 0.012;
        u.irMat.emissiveIntensity = 0.12 + ir * 1.35;
        u.irRing.scale.setScalar(0.97 + iris * 0.05);
      }
    },
    leftWorld(v = new THREE.Vector3()) {
      return units[0].unit.getWorldPosition(v).add(new THREE.Vector3(0, 0, 0.05));
    },
    rightWorld(v = new THREE.Vector3()) {
      return units[1].unit.getWorldPosition(v).add(new THREE.Vector3(0, 0, 0.05));
    },
  };
}
