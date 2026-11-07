/* HY4 · 场景与摄影（Three.js）
 * 环境为程序化 equirectangular（非外部 HDRI 文件），经 PMREM 生成反射；
 * 机库立柱与灯带只提供空间尺度，不冒充原片场景。
 */
import * as THREE from 'three';
import { environmentTexture, box, bevelBox } from './kit.js';

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1c222b'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(140,160,185,.10)'; g.lineWidth = 1;
  for (let i = 0; i <= 16; i++) {
    const v = i * 32;
    g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 512); g.stroke();
    g.beginPath(); g.moveTo(0, v); g.lineTo(512, v); g.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    g.fillStyle = `rgba(190,205,225,${Math.random() * .045})`;
    g.fillRect(x, y, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function contactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(128, 128, 8, 128, 128, 126);
  rg.addColorStop(0, 'rgba(0,0,0,.72)');
  rg.addColorStop(.45, 'rgba(0,0,0,.36)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createStage(canvasEl, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl, antialias: true, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: !!opts.preserveDrawingBuffer
  });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111821);
  scene.fog = new THREE.FogExp2(0x111821, 0.012);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTex = environmentTexture();
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  envTex.dispose(); pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 160);
  camera.position.set(7.6, 2.35, 10.8);
  camera.lookAt(0, 1.85, 1.15);

  /* 主光 / 冷补光 / 暖轮廓光 / 顶光 */
  const key = new THREE.DirectionalLight(0xfff0dd, 3.1);
  key.position.set(-7, 12, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12; key.shadow.camera.right = 12;
  key.shadow.camera.top = 15; key.shadow.camera.bottom = -6;
  key.shadow.camera.near = 1; key.shadow.camera.far = 42;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8fb8ff, 1.25);
  fill.position.set(9, 5, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffa45c, 2.35);
  rim.position.set(3, 7, -11); scene.add(rim);
  const top = new THREE.DirectionalLight(0xdfeaff, .55);
  top.position.set(0, 14, 0); scene.add(top);
  scene.add(new THREE.AmbientLight(0x42536b, .55));

  /* 地面 */
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture(), color: 0x39434f, metalness: .22, roughness: .66 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  /* 接地软阴影（跟随主体，不依赖实时阴影分辨率） */
  const shadowMat = new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false, opacity: .85 });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), shadowMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.005;
  scene.add(blob);

  /* 机库：立柱、灯带与后墙，只作尺度参照 */
  const hall = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x28313c, metalness: .25, roughness: .62 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x39434f, metalness: .55, roughness: .38 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe6bb });
  for (const x of [-9.5, -5.2, 5.2, 9.5]) {
    hall.add(bevelBox(.34, 11, .34, .04, pillarMat, x, 5.4, -7.6));
    hall.add(box(.10, 3.4, .06, lightMat, x + (x < 0 ? .20 : -.20), 4.2, -7.38));
  }
  hall.add(box(22, 11, .3, wallMat, 0, 5.4, -8.2));
  for (let i = 0; i < 9; i++) hall.add(box(22, .055, .05, pillarMat, 0, 1.2 + i * 1.05, -8.0));
  hall.add(box(22, .12, .6, pillarMat, 0, 10.6, -7.6));
  scene.add(hall);

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setCamera(cam, target, fov) {
    camera.position.set(cam[0], cam[1], cam[2]);
    camera.fov = fov;
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
  }

  return {
    renderer, scene, camera, resize, setCamera,
    setGround(v) { blob.position.z = v; },
    render() { renderer.render(scene, camera); },
    setExposure(v) { renderer.toneMappingExposure = v; }
  };
}
