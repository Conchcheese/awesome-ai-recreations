import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBumblebee, createStudio } from './model.js';

const duration = 20;
const params = new URLSearchParams(location.search);
if (params.get('clean') === '1') document.body.classList.add('clean');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
document.querySelector('#stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
createStudio(scene, renderer);
const model = createBumblebee(); scene.add(model.root);
const $ = (s) => document.querySelector(s);
const clamp = (value, min = 0, max = 1) => THREE.MathUtils.clamp(value, min, max);
const ease = (v) => { const x = clamp(v); return x * x * (3 - 2 * x); };
let time = 0, playing = !params.has('t'), last = performance.now(), activeChapter = -1;

const chapters = [
  { at: 0, chapter: '01 / VEHICLE ESTABLISHING', title: '黄色 Camaro，就位。', sub: '低机位建立 · 车漆 / 黑纹 / 轮组' },
  { at: 3, chapter: '02 / CONTINUOUS TRANSFORMATION', title: '解锁。展开。起立。', sub: '6 秒连续变形 · 无中段切镜' },
  { at: 9, chapter: '03 / AUTOBOT REVEAL', title: 'B–127，准备出发。', sub: '低机位英雄轮廓 · 门翼 / 肩轮 / 车头胸' },
  { at: 12, chapter: '04 / HEAD & THORAX', title: '蓝眼与战斗面罩。', sub: '头雕特写 · 胸部机械层次' },
  { at: 15, chapter: '05 / ASSEMBLY RESEARCH', title: '每一层，都有去处。', sub: '分层拆解为展示设计 · 非原片机构复原' },
  { at: 18, chapter: '06 / FINAL LOCK', title: '大黄蜂，就位。', sub: '重组落幅 · Kimi-K3.1-Pro 独立复刻' }
];
function cameraBlend(a, b, u) {
  const k = ease(u);
  camera.position.set(...a.p.map((v, i) => THREE.MathUtils.lerp(v, b.p[i], k)));
  const target = a.t.map((v, i) => THREE.MathUtils.lerp(v, b.t[i], k));
  camera.lookAt(...target);
  camera.fov = THREE.MathUtils.lerp(a.f || 35, b.f || 35, k); camera.updateProjectionMatrix();
}
function applyTime(value) {
  time = clamp(Number(value), 0, duration);
  let transform = 0, explode = 0;
  if (time < 3) {
    cameraBlend({ p: [7.4, 2.8, 8.4], t: [0, 0.82, 0], f: 34 }, { p: [5.6, 2.0, 7.4], t: [0, 0.85, 0], f: 33 }, time / 3);
  } else if (time < 9) {
    transform = ease((time - 3) / 6);
    cameraBlend({ p: [6.7, 3.0, 8.7], t: [0, 1.0, 0], f: 35 }, { p: [9.5, 6.0, 13.2], t: [0, 3.4, 0], f: 36 }, (time - 3) / 6);
  } else if (time < 12) {
    transform = 1;
    cameraBlend({ p: [9.5, 6.0, 13.2], t: [0, 3.4, 0], f: 36 }, { p: [8.2, 5.5, 12.5], t: [0, 3.4, 0], f: 35 }, (time - 9) / 3);
  } else if (time < 15) {
    transform = 1;
    cameraBlend({ p: [2.4, 6.7, 4.4], t: [0, 5.85, 0.1], f: 30 }, { p: [3.5, 5.7, 5.8], t: [0, 5.2, 0.2], f: 32 }, (time - 12) / 3);
  } else if (time < 18) {
    transform = 1; explode = ease((time - 15) / 3) * 0.72;
    cameraBlend({ p: [9.5, 6.5, 13.5], t: [0, 3.9, 0], f: 38 }, { p: [10.5, 7.2, 14.5], t: [0, 4.0, 0], f: 40 }, (time - 15) / 3);
  } else {
    transform = 1; explode = (1 - ease((time - 18) / 2)) * 0.72;
    cameraBlend({ p: [9.8, 6.5, 13.5], t: [0, 3.8, 0], f: 38 }, { p: [9.0, 6.0, 13.0], t: [0, 3.4, 0], f: 35 }, (time - 18) / 2);
  }
  model.stateAt(transform, explode);
  const index = chapters.findLastIndex((c) => time >= c.at);
  if (index !== activeChapter) {
    activeChapter = index; const c = chapters[index];
    $('#chapter').textContent = c.chapter; $('#caption').textContent = c.title; $('#subcaption').textContent = c.sub;
  }
  $('#timeline').value = Math.round(time * 1000);
  $('#time').value = `${time.toFixed(1).padStart(4, '0')} / 20.0`;
  renderer.render(scene, camera);
  return { time, transform, explode, chapter: activeChapter + 1 };
}
function animate(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing) { time += dt; if (time >= duration) { time = duration; playing = false; $('#play').textContent = '重播'; } }
  applyTime(time); requestAnimationFrame(animate);
}
$('#play').addEventListener('click', () => { if (time >= duration) time = 0; playing = !playing; $('#play').textContent = playing ? '暂停' : '播放'; });
$('#timeline').addEventListener('input', (e) => { playing = false; $('#play').textContent = '播放'; applyTime(Number(e.target.value) / 1000); });
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); $('#play').click(); } });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); applyTime(time); });
window.__BUMBLEBEE__ = {
  ready: true, duration,
  setTime(value) { playing = false; $('#play').textContent = '播放'; return applyTime(value); },
  play() { playing = true; },
  pause() { playing = false; },
  getState() { return { ...applyTime(time), model: 'Kimi-K3.1-Pro', parts: model.parts.length, camera: camera.position.toArray(), direction: camera.getWorldDirection(new THREE.Vector3()).toArray() }; }
};
applyTime(params.has('t') ? Number(params.get('t')) : 0);
requestAnimationFrame(animate); requestAnimationFrame(() => $('#loading').classList.add('done'));
