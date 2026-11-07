// MK-X 的舞台：浅蓝灰影棚 + 一块程序化沙丘沙面（虫从沙下钻行，沙面随之隆起一条移动的脊），
// 柔和的日向光与地面阴影，GTAO 补缝隙。frame(state, cam) 摆好虫体并画一帧。
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildWorm, buildMaterials} from './geometry.js';
import {buildSand} from './geometry-sand.js';
import {G, pathAt} from './model.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#e9eef5', sand: '#dde4ee', shadow: '#57616e'};

export function createSandwormStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 9, 26);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 80);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.07, distanceExponent: 1.4, thickness: 0.6, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  composer.addPass(gtao);
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e2e9f1');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.96, 0.99, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(14, 14, new V3(0, 14, 2), 2.4);
    box(3, 14, new V3(-12, 4, 6), 3.0);
    box(3, 14, new V3(12, 4, -4), 2.0);
    box(18, 2, new V3(0, 2, 14), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#ccd8e4', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.95;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.35, 0.82, 0.45).normalize();
  const sun = new THREE.DirectionalLight('#eef6ff', 2.3);
  sun.castShadow = true;
  const EXT = 3.4;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 24});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 10;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#f0f7ff', '#c2ccd8', 0.65));

  const M = buildMaterials();
  const worm = buildWorm(M);
  scene.add(worm.root);
  const sand = buildSand(M);
  scene.add(sand.mesh);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // st: {p, s, y, spin, explode, drillA, jaw, sprayK, t, xray, deposit}
  // cam: {tx, ty, tz (虫体局部), az, el, d (°·m), sx, sy}
  const frame = (st, cam) => {
    const p0 = pathAt(st.s ?? 0);
    const th = p0.th;
    worm.root.position.set(p0.x, st.y ?? -G.DEPTH_CRUISE, p0.z);
    worm.root.rotation.y = -th;
    worm.update(st);
    sand.updateWormFeatures({p: st.p, s: st.s ?? 0, depth: -(st.y ?? -G.DEPTH_CRUISE), t: st.t, lift: Math.max(0, (st.y ?? 0) + 0.1), deposit: st.deposit ?? 0});
    sand.apply(st.t);
    sand.setXray(st.xray ?? 0);
    // 相机目标在虫体局部系里，世界系方位角
    const c = Math.cos(th), sn = Math.sin(th);
    const wx = p0.x + cam.tx * c - cam.tz * sn;
    const wz = p0.z + cam.tx * sn + cam.tz * c;
    const wy = (st.y ?? -G.DEPTH_CRUISE) + cam.ty;
    camera.position.set(wx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), wy + cam.d * Math.sin(cam.el), wz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(wx, wy, wz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    // 太阳跟着虫走（阴影贴图对准当前段）
    sun.target.position.set(p0.x, 0, p0.z);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 9);
    sun.target.updateMatrixWorld();
    composer.render();
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  // 世界坐标（标注/部件定位用）
  const worldOf = (s, dx, dy, dz) => {
    const p0 = pathAt(s);
    const c = Math.cos(p0.th), sn = Math.sin(p0.th);
    return new V3(p0.x + dx * c - dz * sn, dy, p0.z + dx * sn + dz * c);
  };
  return {renderer, scene, camera, worm, sand, M, composer, gtao, sun, resize, frame, project, size, setQuality, worldOf};
}
