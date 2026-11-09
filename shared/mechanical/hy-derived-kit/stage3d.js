// 影棚：渲染器、环境、灯光、地面、相机机位、轨道交互、材质库。
// 设计约定：单位米，Y 轴向上，机器落在 y=0，正面朝 +Z。
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {DEG, RAD, clamp, lerp, lerpAngle, shortAngle, easeInOutCubic} from './util.js';

const BASE_ASPECT = 16 / 9;

export function createStudio({canvas, shadowSize = 2.4, exposure = 1.02, floorY = 0} = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();

  /* ------------------------------------------------ 环境反射 */
  let envTex = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.62;
  } catch (err) {
    console.warn('env failed', err);
  }

  /* ------------------------------------------------ 灯光 */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc2d3ec, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.55);
  key.position.set(2.7, 3.7, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -shadowSize;
  key.shadow.camera.right = shadowSize;
  key.shadow.camera.top = shadowSize;
  key.shadow.camera.bottom = -shadowSize;
  key.shadow.camera.near = 0.4;
  key.shadow.camera.far = 11;
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3.5;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xf2f7ff, 0.95);
  fill.position.set(-3.2, 1.9, 2.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 1.9);
  rim.position.set(-1.4, 2.7, -3.6);
  scene.add(rim);

  const bounce = new THREE.DirectionalLight(0xe3eeff, 0.45);
  bounce.position.set(0.4, -0.8, 1.8);
  scene.add(bounce);

  /* ------------------------------------------------ 地面 */
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xeef4fc, roughness: 0.96, metalness: 0.0,
    transparent: true, opacity: 1, alphaMap: radialFade(), depthWrite: true,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 128), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY - 0.004;
  floor.receiveShadow = true;
  floor.renderOrder = -2;
  scene.add(floor);

  // 地面细纹：只保留同心圆 / 径向刻度 / 十字，不要满屏方格（原作是干净影棚）
  const deco = new THREE.Mesh(
    new THREE.CircleGeometry(9, 128),
    new THREE.MeshBasicMaterial({
      map: floorPattern(), transparent: true, opacity: 0.72, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
  );
  deco.rotation.x = -Math.PI / 2;
  deco.position.y = floorY - 0.002;
  deco.renderOrder = -1;
  scene.add(deco);

  scene.fog = new THREE.Fog(new THREE.Color('#e2ecf9'), 6.2, 13.5);

  /* ------------------------------------------------ 接触阴影 */
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: contactTexture(), transparent: true, opacity: 0.34, depthWrite: false,
      color: 0x3a5a8c,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = floorY + 0.001;
  contact.renderOrder = 1;
  contact.scale.setScalar(1);
  scene.add(contact);

  /* ------------------------------------------------ 相机 */
  const camera = new THREE.PerspectiveCamera(34, BASE_ASPECT, 0.02, 60);
  const rig = {
    target: new THREE.Vector3(0, 0.45, 0),
    distance: 3.1,
    azimuth: 0.62,
    polar: 1.2,
    fov: 34,
  };
  let viewW = 1, viewH = 1;

  const fovForAspect = (fov, aspect) => {
    const hfov = 2 * Math.atan(Math.tan((fov * DEG) / 2) * BASE_ASPECT);
    return 2 * Math.atan(Math.tan(hfov / 2) / aspect) * RAD;
  };

  function applyCamera() {
    const sph = new THREE.Spherical(rig.distance, rig.polar, rig.azimuth);
    camera.position.setFromSpherical(sph).add(rig.target);
    camera.up.set(0, 1, 0);
    camera.lookAt(rig.target);
    const f = fovForAspect(rig.fov, camera.aspect);
    if (Math.abs(camera.fov - f) > 1e-4) {
      camera.fov = f;
      camera.updateProjectionMatrix();
    }
  }

  function setSize(w, h) {
    viewW = w; viewH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyCamera();
  }

  function setPose(pose) {
    if (!pose) return;
    if (pose.pos) {
      const t = new THREE.Vector3().fromArray(pose.target || [0, rig.target.y, 0]);
      const p = new THREE.Vector3().fromArray(pose.pos);
      const sph = new THREE.Spherical().setFromVector3(p.clone().sub(t));
      rig.target.copy(t);
      rig.distance = sph.radius;
      rig.polar = clamp(sph.phi, 0.08, 1.55);
      rig.azimuth = sph.theta;
    }
    if (pose.target) rig.target.fromArray(pose.target);
    if (Number.isFinite(pose.fov)) rig.fov = pose.fov;
    if (Number.isFinite(pose.distance)) rig.distance = pose.distance;
    applyCamera();
  }

  function getPose() {
    const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(rig.distance, rig.polar, rig.azimuth)).add(rig.target);
    return {pos: pos.toArray(), target: rig.target.toArray(), fov: rig.fov};
  }

  /* ------------------------------------------------ 机位补间 */
  let tween = null;
  function tweenPose(pose, duration = 0.9) {
    const from = {target: rig.target.clone(), distance: rig.distance, azimuth: rig.azimuth, polar: rig.polar, fov: rig.fov};
    const toTmp = new THREE.Object3D();
    const t = new THREE.Vector3().fromArray(pose.target || from.target.toArray());
    const p = new THREE.Vector3().fromArray(pose.pos || getPose().pos);
    const s = new THREE.Spherical().setFromVector3(p.clone().sub(t));
    tween = {
      t: 0, duration: Math.max(duration, 0.001),
      from,
      to: {target: t, distance: s.radius, azimuth: s.theta, polar: clamp(s.phi, 0.08, 1.55), fov: pose.fov ?? from.fov},
    };
    void toTmp;
  }
  function update(dt) {
    if (!tween) return;
    tween.t += dt;
    const k = easeInOutCubic(clamp(tween.t / tween.duration));
    rig.target.lerpVectors(tween.from.target, tween.to.target, k);
    rig.distance = lerp(tween.from.distance, tween.to.distance, k);
    rig.polar = lerp(tween.from.polar, tween.to.polar, k);
    rig.azimuth = tween.from.azimuth + shortAngle(tween.from.azimuth, tween.to.azimuth) * k;
    rig.fov = lerp(tween.from.fov, tween.to.fov, k);
    if (k >= 1) tween = null;
  }
  const isTweening = () => !!tween;
  const cancelTween = () => { tween = null; };

  /* ------------------------------------------------ 轨道交互 */
  const controls = {enabled: true, onTakeover: null, dragging: false};
  let drag = null;
  const el = canvas;

  el.addEventListener('pointerdown', (e) => {
    if (!controls.enabled) return;
    el.setPointerCapture?.(e.pointerId);
    drag = {x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey};
    controls.dragging = true;
    cancelTween();
    controls.onTakeover && controls.onTakeover();
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.button === 0 && !drag.shift) {
      rig.azimuth -= dx * 0.0058;
      rig.polar = clamp(rig.polar - dy * 0.005, 0.18, 1.5);
    } else {
      const k = rig.distance * 0.0014;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      rig.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    }
    applyCamera();
  });
  const endDrag = () => { drag = null; controls.dragging = false; };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('pointerleave', () => { if (drag && !el.hasPointerCapture?.(drag.id)) endDrag(); });
  el.addEventListener('wheel', (e) => {
    if (!controls.enabled) return;
    e.preventDefault();
    rig.distance = clamp(rig.distance * Math.exp(e.deltaY * 0.0011), 0.55, 9);
    cancelTween();
    controls.onTakeover && controls.onTakeover();
    applyCamera();
  }, {passive: false});

  /* ------------------------------------------------ 材质库 */
  const materials = createMaterialLibrary();

  /* ------------------------------------------------ 对外 */
  const studio = {
    renderer, scene, camera, rig, controls, materials, floor, contact,
    lights: {hemi, key, fill, rim, bounce},
    setSize, applyCamera, setPose, getPose, tweenPose, update, isTweening, cancelTween,
    setExposure(v) { renderer.toneMappingExposure = v; },
    setContactShadow(radius, opacity = 0.34) {
      contact.scale.set(radius * 2.4, radius * 2.4, 1);
      contact.material.opacity = opacity;
    },
    render() { applyCamera(); renderer.render(scene, camera); },
    get size() { return {w: viewW, h: viewH}; },
    // 世界坐标 → 浏览器像素（HUD 标注用）
    project(v) {
      const p = v.isVector3 ? v.clone() : new THREE.Vector3().fromArray(v);
      p.project(camera);
      return {x: (p.x * 0.5 + 0.5) * viewW, y: (-p.y * 0.5 + 0.5) * viewH, z: p.z};
    },
  };

  applyCamera();
  return studio;
}

/* ================================================================ 纹理 */

function radialFade(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.62, '#ffffff');
  grd.addColorStop(1, '#000000');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function contactTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function floorPattern(size = 2048) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2;
  const R = size / 2;

  // 大圆（虚线）：影棚刻度环，机器脚下唯一的地面参照
  const rings = [0.18, 0.30, 0.44, 0.62, 0.82].map((k) => k * R);
  g.setLineDash([14, 16]);
  g.lineWidth = 1.5;
  rings.forEach((r, i) => {
    g.strokeStyle = `rgba(38, 82, 148,${i === 2 ? 0.16 : 0.10})`;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  });

  // 径向刻度
  g.setLineDash([]);
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const r0 = 0.30 * R, r1 = i % 8 === 0 ? 0.355 * R : 0.325 * R;
    g.strokeStyle = `rgba(38, 82, 148,${i % 8 === 0 ? 0.20 : 0.10})`;
    g.lineWidth = i % 8 === 0 ? 1.6 : 1;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.stroke();
  }

  // 十字标记
  g.strokeStyle = 'rgba(15, 82, 186,0.16)';
  g.lineWidth = 1.4;
  const marks = [
    [0.30, 0.24], [0.62, 0.16], [0.44, 0.52], [0.20, 0.72], [0.52, 0.84], [0.74, 0.62],
  ];
  marks.forEach(([u, v]) => {
    const x = u * size, y = v * size;
    const s = 9;
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
  });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ================================================================ 材质库 */
export function createMaterialLibrary() {
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    // 白瓷装甲：主结构
    white: phys({
      color: 0xf2f6fc, roughness: 0.34, metalness: 0.06,
      clearcoat: 0.55, clearcoatRoughness: 0.26, envMapIntensity: 0.95,
    }),
    whiteSoft: phys({
      color: 0xeaf1fa, roughness: 0.46, metalness: 0.04,
      clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.85,
    }),
    // 黑色机加工件
    dark: phys({
      color: 0x111925, roughness: 0.34, metalness: 0.55,
      clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 0.9,
    }),
    darkSoft: std({color: 0x1a2331, roughness: 0.62, metalness: 0.25, envMapIntensity: 0.7}),
    rubber: std({color: 0x0d1119, roughness: 0.9, metalness: 0.05}),
    // 金属
    steel: std({color: 0xb8c3d4, roughness: 0.26, metalness: 0.92, envMapIntensity: 1.1}),
    steelDark: std({color: 0x66738a, roughness: 0.32, metalness: 0.85, envMapIntensity: 1.0}),
    // 宝石蓝阳极氧化件
    accent: phys({
      color: 0x0f52ba, roughness: 0.3, metalness: 0.72,
      clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.0,
    }),
    accentMatte: std({color: 0x0b3f96, roughness: 0.44, metalness: 0.55}),
    accentGlow: std({
      color: 0x0f52ba, emissive: 0x0f52ba, emissiveIntensity: 0.85,
      roughness: 0.32, metalness: 0.2,
    }),
    accentSoft: std({color: 0x8fb4f2, roughness: 0.4, metalness: 0.3}),
    // 玻璃 / 镜片
    glass: phys({
      color: 0x121b2b, roughness: 0.06, metalness: 0.25,
      clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4,
    }),
    lens: phys({
      color: 0x0a101c, roughness: 0.03, metalness: 0.1,
      clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8,
    }),
    // 缸套玻璃（V8 剖切用）
    bore: phys({
      color: 0xcfe0f2, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.16,
      clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide,
      depthWrite: false, envMapIntensity: 1.3,
    }),
    // 发光粒子/线
    glow: new THREE.MeshBasicMaterial({color: 0x4a86e8, transparent: true, opacity: 0.85}),
  };
}

/* ================================================================ 动画辅助 */
export class Spin {
  constructor(axis = 'y', rate = 0.6) { this.axis = axis; this.rate = rate; this.angle = 0; }
  update(dt) { this.angle += this.rate * dt; }
  apply(obj) {
    if (this.axis === 'y') obj.rotation.y = this.angle;
    else if (this.axis === 'x') obj.rotation.x = this.angle;
    else obj.rotation.z = this.angle;
  }
}
