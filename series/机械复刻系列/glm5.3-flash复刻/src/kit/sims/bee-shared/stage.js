// The bee's stage: a cool grey studio (a field-simulator void), soft shadows on an invisible
// floor below the floating machine, faint dashed survey circles on the ground, and the key
// light drifting slowly so the ground shadow turns with the tour. GTAO for the crevices.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildBee} from './geometry.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#e8edf4', ground: '#dfe6ef', mark: '#c2cfdf', shadow: '#57616e'};

const GROUND_VERT = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = `uniform vec3 uG; uniform vec3 uM; uniform vec3 uBg; uniform vec3 uC; varying vec3 vW;
  float ring(vec2 p, float r, float w){ return step(abs(length(p) - r), w); }
  float dash(vec2 p, float r, float on){ float a = atan(p.y, p.x); return step(mod(a / 6.2831853 * 90.0, 2.0), on); }
  void main(){
    vec2 p = vW.xz - uC.xz;
    float m = 0.0;
    m = max(m, ring(p, 0.34, 0.0022) * dash(p, 0.34, 1.1));
    m = max(m, ring(p, 0.58, 0.0022) * dash(p, 0.58, 1.2));
    m = max(m, ring(p, 0.86, 0.0018) * dash(p, 0.86, 1.3));
    m = max(m, step(abs(p.x), 0.0016) * step(abs(p.y), 1.1));
    m = max(m, step(abs(p.y), 0.0016) * step(abs(p.x), 1.1));
    float n = fract(sin(dot(floor(vW.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 col = mix(uG, uM, m * 0.5) * (0.988 + 0.024 * n);
    float d = length(p);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(1.1, 4.5, d)), 1.0);
  }`;

export function createBeeStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 2.4, 9);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 40);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.035, distanceExponent: 1.4, thickness: 0.4, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
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
    env.background = new THREE.Color('#e2e9f2');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.96, 0.99, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(10, 10, new V3(0, 8, 1), 2.4);
    box(2.4, 9, new V3(-9, 2.4, 4), 3.0);
    box(2.4, 9, new V3(9, 2.4, -3), 2.0);
    box(14, 1.6, new V3(0, 1.4, 10), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({color: '#c3cedd', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -1.4;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.95;
    pm.dispose();
  }
  // the key light drifts ~4°/s around the machine, so the ground shadow turns with the tour
  const SUN_ELEV = 0.86;
  const sun = new THREE.DirectionalLight('#eef4ff', 2.3);
  sun.castShadow = true;
  const EXT = 0.55;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.1, far: 8});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 9;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.0012;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#f0f6ff', '#c2ccd8', 0.65));

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uM: {value: new THREE.Color(COL.mark)}, uBg: {value: new THREE.Color(COL.bg)}, uC: {value: new V3()}},
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.28;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = -0.2795;
  shade.receiveShadow = true;
  scene.add(shade);

  const bee = buildBee();
  scene.add(bee.root);

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
  const right = new V3();
  const upL = new V3();
  let SUN_DIR = new V3();
  const setSunAz = (az) => {
    SUN_DIR.set(Math.sin(az), SUN_ELEV, Math.cos(az)).normalize();
    right.set(0, 1, 0).cross(SUN_DIR).normalize();
    upL.crossVectors(SUN_DIR, right);
  };
  setSunAz(0.6);
  let texel = (2 * EXT) / sun.shadow.mapSize.x;

  // st: {p, ballast, explode, tipTrace, t, dy, pitchTilt}
  // cam: {tx, ty, tz, az, el, d (radians, metres), sx, sy}; the target is relative to the machine
  const frame = (st, cam) => {
    setSunAz(0.6 + (st.shadowAz ?? 0));
    bee.update(st);
    const ty = cam.ty;
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    groundMat.uniforms.uC.value.set(0, 0, 0);
    tmp.set(0, -0.14, 0);
    const rr = Math.round(tmp.dot(right) / texel) * texel;
    const uu = Math.round(tmp.dot(upL) / texel) * texel;
    sun.target.position.copy(right).multiplyScalar(rr).addScaledVector(upL, uu).addScaledVector(SUN_DIR, tmp.dot(SUN_DIR));
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 3);
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
  return {renderer, scene, camera, bee, composer, gtao, sun, resize, frame, project, size, setQuality};
}
