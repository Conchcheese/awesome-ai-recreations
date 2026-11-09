import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBumblebee, createStudio } from './model.js';

const host = document.querySelector('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(7.4, 4.8, 9.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3.45, 0); controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 3; controls.maxDistance = 23; controls.maxPolarAngle = Math.PI * 0.49;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
createStudio(scene, renderer);
const model = createBumblebee(); scene.add(model.root);

const $ = (s) => document.querySelector(s);
let transform = 1, explode = 0, target = 1, playing = false, paused = false, autoCamera = true;
let last = performance.now();
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();

function updateModel() {
  const state = model.stateAt(transform, explode);
  $('#transform').value = Math.round(transform * 1000);
  $('#transform-out').value = `${Math.round(transform * 100).toString().padStart(3, '0')}%`;
  $('#explode-out').value = `${Math.round(explode * 100).toString().padStart(2, '0')}%`;
  $('#phase').textContent = state.phase;
  $('#phase-meter').style.width = `${Math.max(2, transform * 100)}%`;
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', Number(b.dataset.mode) === (transform > 0.5 ? 1 : 0)));
  if (autoCamera) {
    const k = transform;
    const desired = new THREE.Vector3(7.4 - k * 0.8, 2.4 + k * 2.4, 8.2 + k * 1.0);
    camera.position.lerp(desired, 0.045);
    controls.target.lerp(new THREE.Vector3(0, 0.8 + k * 2.65, 0), 0.06);
  }
  renderer.render(scene, camera);
}
function animate(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing && !paused) {
    const direction = Math.sign(target - transform);
    transform = THREE.MathUtils.clamp(transform + direction * dt / 5.2, 0, 1);
    if (Math.abs(target - transform) < 0.001) { transform = target; playing = false; }
  }
  controls.autoRotate = $('#rotate').classList.contains('active');
  controls.autoRotateSpeed = 0.55;
  controls.update(); updateModel(); requestAnimationFrame(animate);
}
function goTo(value) { target = value; playing = true; paused = false; autoCamera = true; $('#pause-btn').textContent = '暂停'; }
function setView(name) {
  autoCamera = false;
  const views = {
    hero: transform > 0.5 ? [[9.6, 6.2, 14.5], [0, 3.35, 0], 35] : [[8.8, 3.5, 11.8], [0, 0.85, 0], 35],
    front: transform > 0.5 ? [[0, 4.5, 15.5], [0, 3.55, 0], 34] : [[0, 2.2, 11.5], [0, 0.85, 0], 34],
    back: [[-8.5, 5.7, -13], [0, transform > 0.5 ? 3.55 : 0.85, 0], 36],
    head: [[2.2, 6.75, 4.2], [0, 5.75, 0.1], 30]
  };
  const v = views[name] || views.hero;
  camera.position.set(...v[0]); controls.target.set(...v[1]); camera.fov = v[2]; camera.updateProjectionMatrix(); controls.update(); renderer.render(scene, camera);
}

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => goTo(Number(b.dataset.mode))));
$('#transform-btn').addEventListener('click', () => goTo(transform > 0.5 ? 0 : 1));
$('#pause-btn').addEventListener('click', () => { paused = !paused; $('#pause-btn').textContent = paused ? '继续' : '暂停'; });
$('#transform').addEventListener('input', (e) => { transform = Number(e.target.value) / 1000; target = transform; playing = false; autoCamera = true; updateModel(); });
$('#explode').addEventListener('input', (e) => { explode = Number(e.target.value) / 1000; updateModel(); });
$('#gray').addEventListener('click', () => { model.setGray(!model.gray); $('#gray').classList.toggle('active', model.gray); updateModel(); });
$('#rotate').addEventListener('click', () => { autoCamera = false; $('#rotate').classList.toggle('active'); });
$('#reset').addEventListener('click', () => setView(transform > 0.5 ? 'hero' : 'hero'));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
controls.addEventListener('start', () => { autoCamera = false; $('#rotate').classList.remove('active'); });

let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(model.root, true).filter((h) => h.object.userData.partId);
  if (!hits.length) return;
  const info = model.select(hits[0].object.userData.partId);
  $('#selection').innerHTML = `<b>${info.label}</b><p>ID / ${info.id}<br>系统 / ${info.system.toUpperCase()}<br>${info.evidence}</p>`;
});
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); goTo(transform > 0.5 ? 0 : 1); }
  if (e.key.toLowerCase() === 'g') $('#gray').click();
  if (e.key.toLowerCase() === 'r') $('#reset').click();
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

$('#part-count').textContent = model.parts.length.toString().padStart(2, '0');
window.__BUMBLEBEE__ = {
  ready: true,
  setTransform(value) { transform = THREE.MathUtils.clamp(Number(value), 0, 1); target = transform; playing = false; autoCamera = false; updateModel(); return transform; },
  setExplode(value) { explode = THREE.MathUtils.clamp(Number(value), 0, 1); updateModel(); return explode; },
  setTime(seconds) { return this.setTransform(Number(seconds) / 5.2); },
  setView,
  getState() { return { transform, explode, parts: model.parts.length, gray: model.gray, model: 'Kimi-K3.1-Pro', phase: model.stateAt(transform, explode).phase }; }
};
updateModel(); requestAnimationFrame(animate);
requestAnimationFrame(() => $('#loading').classList.add('done'));
