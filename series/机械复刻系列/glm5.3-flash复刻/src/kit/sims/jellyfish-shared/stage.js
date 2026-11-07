// MJ-9 的舞台：淡蓝水色影棚（冷灰影棚调成水下色），软阴影落在机下方不可见的地面，
// 地面三圈虚线勘测环，GTAO 缝隙阴影；水体里预预算好的上升气泡粒子（setup 时算好
// 位置数组，render 只读；气泡从 t=0 就存在，纯函数于 t）。frame(state, cam) 摆水母并画一帧。
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {rng} from '../kit/util.js';
import {buildJellyfish} from './geometry.js';

const V3 = THREE.Vector3;
// 蓝系色板（风格指南）：浅蓝灰影棚 → 淡蓝水色
export const COL = {bg: '#e9f1f7', ground: '#e0eaf2', mark: '#c3d6e6', shadow: '#57616e'};

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uG; uniform vec3 uM; uniform vec3 uBg; uniform vec3 uC; varying vec3 vW;
  float ring(vec2 p, float r, float w){ return step(abs(length(p) - r), w); }
  float dash(vec2 p, float r, float on){ float a = atan(p.y, p.x); return step(mod(a / 6.2831853 * 90.0, 2.0), on); }
  void main(){
    vec2 p = vW.xz - uC.xz;
    float m = 0.0;
    m = max(m, ring(p, 0.8, 0.006) * dash(p, 0.8, 1.1));
    m = max(m, ring(p, 1.35, 0.006) * dash(p, 1.35, 1.2));
    m = max(m, ring(p, 1.95, 0.005) * dash(p, 1.95, 1.3));
    m = max(m, step(abs(p.x), 0.004) * step(abs(p.y), 2.4));
    m = max(m, step(abs(p.y), 0.004) * step(abs(p.x), 2.4));
    float n = fract(sin(dot(floor(vW.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 col = mix(uG, uM, m * 0.5) * (0.988 + 0.024 * n);
    float d = length(p);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(2.4, 9.0, d)), 1.0);
  }`;

export function createJellyStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 6.5, 22);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 80);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.07, distanceExponent: 1.4, thickness: 0.6, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const groundVis = (v) => () => {
    ground.visible = v;
    shade.visible = v;
  };
  composer.addPass(new Toggle(groundVis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(groundVis(true)));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#dde9f2');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.93, 0.98, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new V3(0, 14, 2), 2.4);
    box(3, 14, new V3(-12, 4, 6), 3.0);
    box(3, 14, new V3(12, 4, -4), 2.0);
    box(18, 2, new V3(0, 2, 14), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#bfd2e2', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.95;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.35, 0.82, 0.45).normalize();
  const sun = new THREE.DirectionalLight('#f0f7ff', 2.3);
  sun.castShadow = true;
  const EXT = 1.9;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 20});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 10;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#eaf4ff', '#b8c9d8', 0.7));

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uM: {value: new THREE.Color(COL.mark)}, uBg: {value: new THREE.Color(COL.bg)}, uC: {value: new V3()}},
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.35;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = -1.349;
  shade.receiveShadow = true;
  scene.add(shade);

  const jelly = buildJellyfish();
  scene.add(jelly.root);

  // ------------------------------------------------------------ 上升气泡：setup 时预算位置数组，render 只读
  const BUB_N = 110;
  const bub = {
    x: new Float32Array(BUB_N),
    z: new Float32Array(BUB_N),
    y0: new Float32Array(BUB_N),
    v: new Float32Array(BUB_N),
    ph: new Float32Array(BUB_N),
    sw: new Float32Array(BUB_N),
    sf: new Float32Array(BUB_N),
    r: new Float32Array(BUB_N),
  };
  {
    const r = rng(20260905);
    for (let i = 0; i < BUB_N; i++) {
      bub.x[i] = (r() - 0.5) * 5.2;
      bub.z[i] = (r() - 0.5) * 5.2;
      bub.y0[i] = -1.2 + r() * 2.9;
      bub.v[i] = 0.05 + r() * 0.14;
      bub.ph[i] = r() * Math.PI * 2;
      bub.sw[i] = 0.02 + r() * 0.05;
      bub.sf[i] = 0.2 + r() * 0.4;
      bub.r[i] = 0.0025 + r() * 0.006;
    }
  }
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), jelly.M.bubble, BUB_N);
  bubbles.frustumCulled = false;
  scene.add(bubbles);
  const BS = new V3();
  const BS2 = new V3();
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const drawBubbles = (t) => {
    for (let i = 0; i < BUB_N; i++) {
      const y = -1.25 + (((bub.y0[i] - -1.25 + t * bub.v[i]) % 2.9) + 2.9) % 2.9;
      const x = bub.x[i] + bub.sw[i] * Math.sin(t * bub.sf[i] + bub.ph[i]);
      m4.compose(BS.set(x, y, bub.z[i]), q0, BS2.setScalar(bub.r[i]));
      bubbles.setMatrixAt(i, m4);
    }
    bubbles.instanceMatrix.needsUpdate = true;
  };
  jelly.M.bubble.opacity = 0.5;

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
  const tmp = new V3();
  const right = new V3().crossVectors(new V3(0, 1, 0), SUN_DIR).normalize();
  const upL = new V3().crossVectors(SUN_DIR, right);
  let texel = (2 * EXT) / sun.shadow.mapSize.x;

  // st: {p, bell, pump, tentacle, skirt, explode, wake, wakeT}
  // cam: {tx, ty, tz, az, el, d, sx, sy}；目标点相对机器
  const frame = (st, cam) => {
    jelly.update(st);
    const ty = cam.ty;
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    groundMat.uniforms.uC.value.set(0, 0, 0);
    tmp.set(0, -0.42, 0);
    const rr = Math.round(tmp.dot(right) / texel) * texel;
    const uu = Math.round(tmp.dot(upL) / texel) * texel;
    sun.target.position.copy(right).multiplyScalar(rr).addScaledVector(upL, uu).addScaledVector(SUN_DIR, tmp.dot(SUN_DIR));
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 8);
    sun.target.updateMatrixWorld();
    drawBubbles(st.bubbleT ?? 0);
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
      texel = (2 * EXT) / shadow;
    }
  };
  return {renderer, scene, camera, jelly, composer, gtao, sun, resize, frame, project, size, setQuality};
}
