// SC-8 的舞台：冷灰影棚（沙漠试验场模拟舱），石板地面 + 细虚线勘测圈，GTAO 补缝隙。
// frame(state, cam) 摆好蝎子并画一帧。相机参数化与章鱼/带兽一致：{tx,ty,tz,az,el,d,sx,sy}。
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildScorpion} from './geometry.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#e8edf3', ground: '#dfe6ee', mark: '#c3d2e2', shadow: '#4d5c6e'};

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uG; uniform vec3 uM; uniform vec3 uBg; uniform vec3 uC; varying vec3 vW;
  float ring(vec2 p, float r, float w){ return step(abs(length(p) - r), w); }
  float dash(vec2 p, float r, float on){ float a = atan(p.y, p.x); return step(mod(a / 6.2831853 * 90.0, 2.0), on); }
  void main(){
    vec2 p = vW.xz - uC.xz;
    float m = 0.0;
    // 三圈虚线勘测圈
    m = max(m, ring(p, 0.55, 0.005) * dash(p, 0.55, 1.1));
    m = max(m, ring(p, 0.95, 0.005) * dash(p, 0.95, 1.2));
    m = max(m, ring(p, 1.45, 0.004) * dash(p, 1.45, 1.3));
    // 两条轴线
    m = max(m, step(abs(p.x), 0.0035) * step(abs(p.y), 2.2));
    m = max(m, step(abs(p.y), 0.0035) * step(abs(p.x), 2.2));
    // 石板：0.11 m 网格缝 + 每格微色调
    vec2 cell = floor(vW.xz / 0.11);
    vec2 fr = fract(vW.xz / 0.11);
    float seam = step(max(fr.x, fr.y), 0.045) + step(fr.x, 0.045) + step(fr.y, 0.045);
    seam = clamp(seam, 0.0, 1.0);
    float n = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 col = mix(uG, uG * (0.955 + 0.07 * n), 1.0);
    col = mix(col, uM, seam * 0.35);
    m = max(m, 0.0);
    col = mix(col, uM, m * 0.5);
    float d = length(p);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(2.4, 8.5, d)), 1.0);
  }`;

export function createScorpionStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 5, 18);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 80);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.75;
  gtao.updateGtaoMaterial({radius: 0.06, distanceExponent: 1.4, thickness: 0.6, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
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
    env.background = new THREE.Color('#dde5ec');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.96, 0.99, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new V3(0, 14, 2), 2.4);
    box(3, 14, new V3(-12, 4, 6), 3.0);
    box(3, 14, new V3(12, 4, -4), 2.0);
    box(18, 2, new V3(0, 2, 14), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c2cfda', side: THREE.DoubleSide}));
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
  const EXT = 1.4;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 20});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 10;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#f0f7ff', '#c2ccd4', 0.65));

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uM: {value: new THREE.Color(COL.mark)}, uBg: {value: new THREE.Color(COL.bg)}, uC: {value: new V3()}},
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.28, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = -0.001;
  shade.receiveShadow = true;
  scene.add(shade);

  const scorp = buildScorpion();
  scene.add(scorp.root);

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

  // st: {p, settleF, explode, isoKey, isoK, gaitK, demo}
  // cam: {tx, ty, tz, az, el, d (弧度, 米), sx, sy}；目标点相对机器原点
  const frame = (st, cam) => {
    scorp.update(st);
    const ty = cam.ty;
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    groundMat.uniforms.uC.value.set(0, 0, 0);
    tmp.set(0, 0, 0);
    const rr = Math.round(tmp.dot(right) / texel) * texel;
    const uu = Math.round(tmp.dot(upL) / texel) * texel;
    sun.target.position.copy(right).multiplyScalar(rr).addScaledVector(upL, uu).addScaledVector(SUN_DIR, tmp.dot(SUN_DIR));
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 8);
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
      texel = (2 * EXT) / shadow;
    }
  };
  return {renderer, scene, camera, scorp, composer, gtao, sun, resize, frame, project, size, setQuality};
}
