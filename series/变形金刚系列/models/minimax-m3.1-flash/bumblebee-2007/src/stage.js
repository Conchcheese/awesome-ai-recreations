// Shared stage: builds the character in a three.js scene.
//
// Both the research page and the film page mount the same scene from the same
// model data, so what the viewer inspects in the browser is what the offline
// renderer shoots.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCharacter } from './model.mjs';
import { createRig } from './rig.mjs';
import { cameraAt, LIGHTS, SOURCE_DURATION, FPS } from './shots.mjs';

export const SYSTEMS = {
  body: { color: 0x9aa3ad, label: '车身外壳' },
  chest: { color: 0xd08a1a, label: '胸腔系统' },
  wing: { color: 0x3f7fd0, label: '翼/门系统' },
  arm: { color: 0x4fbf7a, label: '手臂系统' },
  leg: { color: 0xc05ad0, label: '下肢系统' },
  head: { color: 0xd04f4f, label: '头部系统' },
  pelvis: { color: 0xd0a03a, label: '骨盆系统' },
  frame: { color: 0x8a8f98, label: '内部骨架' },
};

export function createStage(container, { film = false } = {}) {
  const character = buildCharacter();
  const rig = createRig(character);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070b);

  const camera = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 0.05, 400);
  camera.position.set(5.7, 0.72, 4.3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0.2, 0.8, 0);
  controls.minDistance = 1.2;
  controls.maxDistance = 26;
  controls.enabled = !film;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  // Studio lighting, matching the offline renderer's key / fill / rim rig.
  // Positions are the light origins: a directional light travels from its
  // position towards the target.
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
  key.position.set(5.5, 7.6, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 34;
  const d = 10;
  key.shadow.camera.left = -d; key.shadow.camera.right = d;
  key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
  key.shadow.bias = -0.0009;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8fb4e8, 0.7);
  fill.position.set(-7.2, 2.4, 3.6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xd4e4ff, 1.9);
  rim.position.set(-2.6, 3.0, -9.2);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(0x2b3a55, 0x14100c, 0.45));

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(26, 96),
    new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.40, metalness: 0.18 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6.2, 6.42, 128),
    new THREE.MeshBasicMaterial({ color: 0x1b2632, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);

  /* ---------------- character ---------------- */

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  const materialCache = new Map();
  function threeMaterial(name, gray) {
    const key = `${name}|${gray ? 'gray' : 'color'}`;
    if (materialCache.has(key)) return materialCache.get(key);
    const def = character.materials[name] || { baseColor: [0.6, 0.6, 0.6], metallic: 0.5, roughness: 0.4 };
    const base = gray ? new THREE.Color(0x6c7176) : new THREE.Color(...def.baseColor);
    const mat = new THREE.MeshPhysicalMaterial({
      color: base,
      metalness: def.metallic ?? 0.5,
      roughness: def.roughness ?? 0.4,
      clearcoat: name.startsWith('paint') ? 0.5 : 0.0,
      clearcoatRoughness: 0.24,
      emissive: new THREE.Color(...(def.emissive || [0, 0, 0])),
      emissiveIntensity: def.emissiveStrength ?? 0,
      side: THREE.DoubleSide,
    });
    materialCache.set(key, mat);
    return mat;
  }

  const systemMaterials = new Map();
  function systemMaterial(system) {
    if (!systemMaterials.has(system)) {
      systemMaterials.set(system, new THREE.MeshStandardMaterial({
        color: SYSTEMS[system]?.color ?? 0x888888, metalness: 0.35, roughness: 0.5,
      }));
    }
    return systemMaterials.get(system);
  }

  const nodes = new Map();
  const meshRecords = [];
  for (const a of character.assemblies) {
    const g = character.meshes[a.mesh];
    if (!g) { console.warn('missing mesh', a.mesh, a.id); continue; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
    const group = new THREE.Group();
    group.name = a.id;
    const mesh = new THREE.Mesh(geo, threeMaterial(a.material, false));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.assemblyId = a.id;
    group.add(mesh);
    meshRecords.push(mesh);
    nodes.set(a.id, group);
    // The rig already resolves the assembly tree, so the scene graph stays
    // flat and each node receives a world transform. Nesting them here would
    // apply the parent transform twice.
    rootGroup.add(group);
  }

  const state = { t: 0, gray: false, colorBySystem: false, explode: 0 };

  function applyMaterials() {
    for (const a of character.assemblies) {
      const node = nodes.get(a.id);
      if (!node) continue;
      for (const child of node.children) {
        if (!child.isMesh) continue;
        child.material = state.colorBySystem
          ? systemMaterial(a.system)
          : threeMaterial(a.material, state.gray);
      }
    }
  }

  const tmpMat = new THREE.Matrix4();
  function applyPose() {
    const mats = rig.poseAt(state.t);
    const centre = new THREE.Vector3(0, 1.15, 0);
    for (const a of character.assemblies) {
      const node = nodes.get(a.id);
      const m = mats.get(a.id);
      if (!node || !m) continue;
      tmpMat.set(
        m[0], m[4], m[8], m[12],
        m[1], m[5], m[9], m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15],
      );
      const p = new THREE.Vector3(m[12], m[13], m[14]);
      const q = new THREE.Quaternion().setFromRotationMatrix(tmpMat);
      const s = new THREE.Vector3(m[0], m[1], m[2]).length() || 1;
      if (state.explode > 0) {
        const dir = p.clone().sub(centre);
        if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
        dir.normalize().multiplyScalar(state.explode * 1.15);
        p.add(dir);
      }
      node.position.copy(p);
      node.quaternion.copy(q);
      node.scale.setScalar(s);
    }
  }

  function setTime(t) {
    state.t = Math.max(0, Math.min(SOURCE_DURATION, t));
  }

  function useFilmCamera(t) {
    const c = cameraAt(t);
    camera.position.set(c.eye[0], c.eye[1], c.eye[2]);
    camera.lookAt(c.target[0], c.target[1], c.target[2]);
    // The authored field of view is the vertical one at a 16:9 frame. On
    // narrower frames keep the horizontal coverage instead of cropping the
    // character, otherwise a tall viewport squeezes the shot.
    const REF_ASPECT = 16 / 9;
    const aspect = camera.aspect || REF_ASPECT;
    const fovH = 2 * Math.atan(Math.tan((c.fov * Math.PI) / 360) * REF_ASPECT);
    const fovV = (2 * Math.atan(Math.tan(fovH / 2) / Math.max(0.2, aspect)) * 180) / Math.PI;
    camera.fov = Math.min(78, fovV);
    camera.updateProjectionMatrix();
  }

  // Fit the free camera to the character so a narrow viewport still frames it.
  function fitFreeCamera() {
    const aspect = camera.aspect || 16 / 9;
    const b = currentBounds();
    const centre = new THREE.Vector3(
      (b.min[0] + b.max[0]) / 2,
      (b.min[1] + b.max[1]) / 2,
      (b.min[2] + b.max[2]) / 2,
    );
    const radius = Math.max(
      0.6,
      0.5 * Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]),
    );
    const fovV = (camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
    const distance = (radius / Math.sin(Math.min(fovV, fovH) / 2)) * 1.05;
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.35, 1.2);
    dir.normalize();
    controls.target.copy(centre);
    camera.position.copy(centre).add(dir.multiplyScalar(distance));
    camera.lookAt(centre);
  }

  // Local space bounds per mesh, computed once.
  const localBounds = new Map();
  function meshBounds(id) {
    if (!localBounds.has(id)) {
      const g = character.meshes[id];
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      if (g) {
        for (let i = 0; i < g.positions.length; i += 3) {
          for (let k = 0; k < 3; k++) {
            const v = g.positions[i + k];
            if (v < min[k]) min[k] = v;
            if (v > max[k]) max[k] = v;
          }
        }
      }
      localBounds.set(id, { min, max });
    }
    return localBounds.get(id);
  }

  // World bounds of the character at the current time.
  function currentBounds() {
    const mats = rig.poseAt(state.t);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const v = new THREE.Vector3();
    for (const a of character.assemblies) {
      const m = mats.get(a.id);
      const b = meshBounds(a.mesh);
      if (!m || !b) continue;
      for (let i = 0; i < 8; i++) {
        v.set(
          i & 1 ? b.max[0] : b.min[0],
          i & 2 ? b.max[1] : b.min[1],
          i & 4 ? b.max[2] : b.min[2],
        ).applyMatrix4(new THREE.Matrix4().set(
          m[0], m[4], m[8], m[12],
          m[1], m[5], m[9], m[13],
          m[2], m[6], m[10], m[14],
          m[3], m[7], m[11], m[15],
        ));
        const p = [v.x, v.y, v.z];
        for (let k = 0; k < 3; k++) {
          if (p[k] < min[k]) min[k] = p[k];
          if (p[k] > max[k]) max[k] = p[k];
        }
      }
    }
    return { min, max };
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!film) fitFreeCamera();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    character, rig, scene, camera, renderer, controls, nodes, meshRecords,
    state, applyMaterials, applyPose, setTime, useFilmCamera, resize, fitFreeCamera,
    LIGHTS, FPS, SOURCE_DURATION,
  };
}
