// main.js —— 页面组装。render(t) 是纯函数：同一 t 永远得到同一帧。
// 真实时钟只用于「互动页自动播放时选取 t」，不参与任何画面计算。
import * as THREE from 'three';
import {CSS} from './style.js';
import {DURATION, stateAt, structure, explode} from './model.js';
import {createStage} from './stage.js';
import {buildMachine} from './geometry.js';
import {createConsole} from './console.js';

const st = document.createElement('style');
st.textContent = CSS;
document.head.append(st);

const app = document.createElement('div');
app.id = 'app';
app.innerHTML = '<canvas id="scene"></canvas><div id="hud"></div>';
document.body.append(app);

const canvas = app.querySelector('#scene');
const hudLayer = app.querySelector('#hud');

// 集成显卡降级：URL 带 ?q=0.75 可降低 pixelRatio / 阴影
const qp = new URLSearchParams(location.search).get('q');
const quality = qp ? Math.max(0.5, Math.min(1, Number(qp) || 1)) : 1;
const mode = document.documentElement.dataset.mode || 'live';

const stage = createStage(canvas, {quality});
const machine = buildMachine(stage);

// 影片页按全屏构图（机器占 60–68%）；互动页要左右面板让位，整体拉远一档
const CAM_FIT = mode === 'film' ? 1.0 : 1.38;

let playing = mode === 'live';
let raf = 0;
let clockT = 0;
let last = 0;
let assemblyForced = false;

function seek(t) { clockT = Math.max(0, Math.min(DURATION, t)); render(clockT); }
function onCommand(cmd) {
  if (cmd === 'play') { playing = !playing; consoleApi.setPlaying(playing); last = 0; if (playing) loop(0); }
  if (cmd === 'assembly') { assemblyForced = !assemblyForced; seek(assemblyForced ? 21.6 : 0); }
  if (cmd === 'display') consoleApi.setHudVisible(!consoleApi.hudVisible);
  if (cmd === 'reset') { assemblyForced = false; seek(0); }
}
const consoleApi = createConsole(hudLayer, {mode, onCommand});

// 让 3D 锚点投到 1920×1080 设计画布上
const _w = new THREE.Vector3();
const ANCHOR_NAMES = ['optics', 'mantle', 'brain', 'siphon', 'beak', 'hub'];
const points = {};
function projectAnchors(cam) {
  cam.updateMatrixWorld();
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  for (const name of ANCHOR_NAMES) {
    _w.copy(machine.anchors[name]()).project(cam);
    const x = (_w.x * 0.5 + 0.5) * 1920, y = (-_w.y * 0.5 + 0.5) * 1080;
    points[name] = {x, y, visible: _w.z > -1 && _w.z < 1 && x > 40 && x < 1500 && y > 110 && y < 880};
  }
  return points;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  stage.resize();
  const k = Math.min(w / 1920, h / 1080);
  hudLayer.style.transform = `translate(${((w - 1920 * k) / 2).toFixed(1)}px,${((h - 1080 * k) / 2).toFixed(1)}px) scale(${k})`;
}
window.addEventListener('resize', resize);

function render(t) {
  // 外部调用逐帧接口时，停掉内部自动播放，保证画面只由 t 决定
  if (raf) { cancelAnimationFrame(raf); raf = 0; playing = false; consoleApi.setPlaying(false); }
  const s = stateAt(t, CAM_FIT);
  stage.setCamera(s.camera);
  machine.update(s);
  // 让 matrixWorld 与当前 t 对齐（标注锚点依赖它）
  stage.scene.updateMatrixWorld(true);
  projectAnchors(stage.camera);
  consoleApi.update(s, points);
  stage.render();
  clockT = t;
  return s;
}

function loop(now) {
  if (!playing) return;
  if (!last) last = now;
  clockT += Math.min(0.08, (now - last) / 1000);
  last = now;
  if (clockT >= DURATION) clockT = 0;
  const s = stateAt(clockT, CAM_FIT);
  stage.setCamera(s.camera);
  machine.update(s);
  stage.scene.updateMatrixWorld(true);
  projectAnchors(stage.camera);
  consoleApi.update(s, points);
  stage.render();
  raf = requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'spacebar') { e.preventDefault(); onCommand('play'); }
  if (k === 'a') onCommand('assembly');
  if (k === 'h') onCommand('display');
  if (k === 'r') onCommand('reset');
  if (k === 'arrowright') seek(clockT + 0.5);
  if (k === 'arrowleft') seek(clockT - 0.5);
});

// 影片页：HUD 分层淡出（见 style.js 的 data-film 规则）；互动页保持完整 HUD 供操作
if (mode === 'film') document.body.dataset.film = '1';

resize();
render(0);
if (mode === 'live') { last = 0; loop(0); }

// 统一逐帧接口：录制管线可用 window.SIM.render(t) 或 window.__sim.renderFrame(t)
window.SIM = {
  render, duration: DURATION, fps: 30, ready: true,
  structure: structure(), stateAt, explode,
};
window.__sim = {renderFrame: render, duration: DURATION, ready: true};
window.__OC8 = {stage, machine};
document.documentElement.dataset.ready = '1';
