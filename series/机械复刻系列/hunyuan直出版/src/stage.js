// stage.js —— 影棚、材质、灯光、相机、程序化贴图。本版自建，不复用任何 kit。
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

const C = (hex) => new THREE.Color(hex);

function decalCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#eef3fa'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#0a357a';
  g.font = 'bold 27px Arial'; g.fillText('OC8 / HY4', 14, 38);
  g.font = 'bold 19px monospace'; g.fillText('PLG-0825', 14, 68);
  g.fillRect(14, 82, 152, 5);
  for (let i = 0; i < 15; i++) {
    g.fillStyle = i % 3 ? '#101826' : '#0f52ba';
    g.fillRect(14 + i * 11, 96, i % 4 === 0 ? 5 : 2, 20);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function floorCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#d3e2f4'; g.fillRect(0, 0, 1024, 1024);
  // 极淡的同心刻度环与十字，干净影棚，不做满屏网格
  g.translate(512, 512);
  g.strokeStyle = 'rgba(15,82,186,0.10)';
  for (let r = 90; r <= 470; r += 76) {
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  }
  g.strokeStyle = 'rgba(15,82,186,0.13)'; g.lineWidth = 2;
  for (let a = 0; a < 72; a++) {
    const th = (a / 72) * Math.PI * 2;
    const r0 = a % 6 === 0 ? 448 : 462;
    g.beginPath(); g.moveTo(Math.cos(th) * r0, Math.sin(th) * r0);
    g.lineTo(Math.cos(th) * 474, Math.sin(th) * 474); g.stroke();
  }
  g.beginPath(); g.moveTo(-480, 0); g.lineTo(480, 0); g.moveTo(0, -480); g.lineTo(0, 480); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function shadowCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(128, 128, 8, 128, 128, 124);
  rg.addColorStop(0, 'rgba(24,42,72,0.42)');
  rg.addColorStop(0.55, 'rgba(24,42,72,0.18)');
  rg.addColorStop(1, 'rgba(24,42,72,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createStage(canvas, {quality = 1} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * quality);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = C('#dbe8f8');
  scene.fog = new THREE.Fog(C('#d3e3f6'), 6.0, 13.0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.02, 60);
  camera.position.set(1.46, 0.86, 2.04);
  camera.lookAt(0, 0.47, 0);

  // 冷白蓝影棚：一主、一补、一轮廓、一反弹 + 半球环境
  const hemi = new THREE.HemisphereLight(0xffffff, 0xa9bdd6, 1.35);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.25);
  key.position.set(2.6, 4.0, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 12;
  key.shadow.camera.left = -2.2; key.shadow.camera.right = 2.2;
  key.shadow.camera.top = 2.2; key.shadow.camera.bottom = -2.2;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.012;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc9dcff, 0.85);
  fill.position.set(-3.0, 1.6, 1.8); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xdbe9ff, 1.15);
  rim.position.set(-1.2, 2.2, -3.0); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xffffff, 0.42);
  bounce.position.set(0, -1.5, 1.2); scene.add(bounce);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({map: floorCanvas(), color: 0xb9cfe9, roughness: 0.92, metalness: 0.0})
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.receiveShadow = true;
  scene.add(floor);

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.1),
    new THREE.MeshBasicMaterial({map: shadowCanvas(), transparent: true, depthWrite: false, opacity: 0.9})
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.001;
  scene.add(contact);

  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const decalMap = decalCanvas();
  const M = {
    white: phys({color: 0xf0f5fc, roughness: 0.36, metalness: 0.06, clearcoat: 0.52, clearcoatRoughness: 0.28, envMapIntensity: 0.95}),
    whiteSoft: phys({color: 0xdce7f5, roughness: 0.55, metalness: 0.03, envMapIntensity: 0.8}),
    dark: phys({color: 0x1b2230, roughness: 0.44, metalness: 0.32, envMapIntensity: 0.8}),
    rubber: phys({color: 0x11161f, roughness: 0.88, metalness: 0.02, envMapIntensity: 0.45}),
    steel: phys({color: 0xa8b7c9, roughness: 0.30, metalness: 0.86, envMapIntensity: 1.1}),
    steelDark: phys({color: 0x5d6b7e, roughness: 0.38, metalness: 0.82, envMapIntensity: 0.9}),
    accent: phys({color: 0x0f52ba, roughness: 0.30, metalness: 0.68, clearcoat: 0.5, envMapIntensity: 1.0}),
    accentDeep: phys({color: 0x0a357a, roughness: 0.40, metalness: 0.55, envMapIntensity: 0.9}),
    accentGlow: new THREE.MeshBasicMaterial({color: 0x4a86e8}),
    accentSoft: phys({color: 0xbfd7fa, roughness: 0.6, metalness: 0.1}),
    glass: phys({color: 0x8fb6ea, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.42,
                 transmission: 0.35, thickness: 0.02, envMapIntensity: 1.4}),
    lens: phys({color: 0x0b1b33, roughness: 0.10, metalness: 0.42, clearcoat: 1.0, envMapIntensity: 1.5}),
    bore: new THREE.MeshBasicMaterial({color: 0x080d16}),
    decal: new THREE.MeshBasicMaterial({map: decalMap, transparent: true, side: THREE.DoubleSide, depthWrite: false}),
  };

  function setCamera({eye, look, fov}) {
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(look[0], look[1], look[2]);
    if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() { renderer.render(scene, camera); }

  resize();
  return {scene, camera, renderer, M, floor, contact, setCamera, resize, render};
}
