/* HY4 · 页面装配与对外 API
 * 互动页 / 影片页同源，仅 HY4_AUTOPLAY 不同；渲染脚本通过 window.__HY4__ 确定性取帧。
 */
import * as THREE from 'three';
import { ASSEMBLIES, PARTS, TIMELINE, PORTS } from './rig.mjs';
import { stateAt } from './state.mjs';
import { cameraAt, SHOTS, FRAME_COUNT } from './camera.mjs';
import { buildModel, applyMaterialMode } from './geometry.js';
import { createStage } from './scene.js';

const canvasEl = document.getElementById('stage');
const stage = createStage(canvasEl);
const model = buildModel();
stage.scene.add(model.root);

const labelMap = Object.fromEntries(PARTS.map((p) => [p.id, p.label]));
const view = { yaw: 0.62, pitch: 0.14, dist: 15.2, targetY: 3.6, mode: 'free' };
let current = stateAt(0);
let playing = window.HY4_AUTOPLAY === true;
let movieT = 0, lastFrame = performance.now();
let captureMode = false, picked = null, mode = 'pbr';

/* ---------- 状态与相机 ---------- */
function applyState(s) {
  current = s;
  for (const row of s.assemblies) {
    const g = model.groups[row.id];
    g.position.set(row.pos[0], row.pos[1], row.pos[2]);
    g.rotation.set(row.rot[0], row.rot[1], row.rot[2]);
    g.scale.setScalar(row.scale);
  }
}
function freeCamera() {
  const d = view.dist, y = view.pitch;
  const cam = [Math.sin(view.yaw) * Math.cos(y) * d,
               view.targetY + Math.sin(y) * d + 0.45,
               Math.cos(view.yaw) * Math.cos(y) * d];
  stage.setCamera(cam, [0, view.targetY, 0], 40);
  stage.setGround(0);
}
function shotCamera(shot) {
  stage.setCamera(shot.cam, shot.target, shot.fov);
  stage.setGround(0);
}
function redraw() { stage.render(); }

/* ---------- HUD ---------- */
const el = (id) => document.getElementById(id);
function paintHud(shot) {
  el('form-label').textContent = current.phase <= 0 ? '车辆形态 / VEHICLE'
    : current.phase >= 1 ? '人形形态 / ROBOT' : `变形中 ${Math.round(current.phase * 100)}%`;
  el('time-label').textContent = `源时间 ${current.t.toFixed(2)}s`;
  el('part-label').textContent = picked ? `${picked} · ${labelMap[picked] || ''}` : '点击实体查看分件';
  el('stat-label').textContent = `${model.assemblyCount} 装配 · ${model.partCount} 分件 · ${model.meshCount} Mesh`;
  if (shot) {
    el('caption').textContent = shot.caption;
    el('shot-label').textContent = `${shot.shot}  ${String(Math.floor(movieT * TIMELINE.fps)).padStart(4, '0')} / ${FRAME_COUNT}`;
  }
}

/* ---------- 对外确定性 API（供逐帧离线渲染） ---------- */
function seek(sourceT, explode = 0) {
  applyState(stateAt(sourceT, { explode }));
  /* 灰模阶段校准的取景：随躯干起立把焦点抬高、相机后退，避免裁掉头部或主体过小 */
  const ph = current.phase;
  view.targetY = 1.90 + 2.30 * ph;
  view.dist = 13.8 + 1.1 * ph;
  view.pitch = 0.155 - 0.085 * ph;
  view.mode = 'free';
  freeCamera();
  redraw();
  paintHud();
  return { t: sourceT, explode, phase: current.phase };
}
function setShot(movieTime) {
  movieT = movieTime;
  const shot = cameraAt(movieTime);
  applyState(stateAt(shot.sourceT, { explode: shot.explode, deploy: shot.deploy }));
  view.mode = 'shot';
  shotCamera(shot);
  redraw();
  paintHud(shot);
  return { shot: shot.shot, sourceT: shot.sourceT, cam: shot.cam, fov: shot.fov, explode: shot.explode, deploy: shot.deploy };
}
function setCapture(on) {
  captureMode = !!on;
  document.body.classList.toggle('capture', captureMode);
  redraw();
}
function setMode(m) {
  mode = m;
  applyMaterialMode(model, m);
  redraw();
  return mode;
}

window.__HY4__ = {
  ready: true,
  seek, setShot, setCapture, setMode, redraw, freeCamera,
  model: { assemblyCount: model.assemblyCount, partCount: model.partCount, meshCount: model.meshCount },
  stats: () => ({ assemblies: model.assemblyCount, parts: model.partCount, meshes: model.meshCount,
                  shots: SHOTS.length, frames: FRAME_COUNT, fps: TIMELINE.fps,
                  duration: TIMELINE.movieDuration, ports: PORTS }),
  canvas: () => canvasEl
};

/* ---------- 交互 ---------- */
const range = el('range');
range.addEventListener('input', () => {
  playing = false; el('btn-play').textContent = '播放';
  seek(parseFloat(range.value));
});
document.querySelectorAll('[data-t]').forEach((b) => {
  b.addEventListener('click', () => {
    playing = false; el('btn-play').textContent = '播放';
    const t = parseFloat(b.dataset.t);
    range.value = String(t);
    seek(t);
  });
});
document.querySelectorAll('[data-yaw]').forEach((b) => {
  b.addEventListener('click', () => { view.yaw = parseFloat(b.dataset.yaw); freeCamera(); redraw(); });
});
el('btn-play').addEventListener('click', () => {
  playing = !playing;
  el('btn-play').textContent = playing ? '暂停' : '播放';
  lastFrame = performance.now();
});
el('btn-mode').addEventListener('click', () => {
  const next = mode === 'pbr' ? 'grey' : mode === 'grey' ? 'systems' : 'pbr';
  setMode(next);
  el('btn-mode').textContent = { pbr: '材质', grey: '灰模', systems: '系统分色' }[next];
});
const ex = el('range-explode');
if (ex) ex.addEventListener('input', () => {
  playing = false;
  seek(parseFloat(range.value), parseFloat(ex.value));
});

/* 零件拾取：射线命中 mesh 后回溯到命名分件 */
const ray = new THREE.Raycaster();
canvasEl.addEventListener('click', (e) => {
  const r = canvasEl.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1,
                                     -((e.clientY - r.top) / r.height) * 2 + 1), stage.camera);
  const hit = ray.intersectObject(model.root, true)[0];
  let o = hit && hit.object;
  while (o && !o.userData.id) o = o.parent;
  picked = o ? o.userData.id : null;
  paintHud();
});

/* ---------- 尺寸与帧循环 ---------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  stage.resize(w, h);
  redraw();
}
window.addEventListener('resize', resize);

function loop(now) {
  const dt = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (playing) {
    if (window.HY4_AUTOPLAY) {
      movieT += dt;
      if (movieT >= TIMELINE.movieDuration) movieT = 0;
      setShot(movieT);
    } else {
      let t = parseFloat(range.value) + dt * 2;
      if (t > TIMELINE.duration) t = 0;
      range.value = String(t);
      seek(t);
    }
  }
  requestAnimationFrame(loop);
}

resize();
if (window.HY4_AUTOPLAY) setShot(0); else seek(0);
requestAnimationFrame(loop);
