// Research page: same model, same rig, same shots as the offline renderer.
//
// Controls are limited to what the model actually contains: form scrubbing,
// timeline playback, gray model, system colouring, exploded view and
// per-assembly inspection.

import { createStage, SYSTEMS } from './stage.js';
import { SHOTS, SOURCE_DURATION, FPS } from './shots.mjs';
import { Raycaster, Vector2 } from 'three';

const container = document.getElementById('view');
const stage = createStage(container, { film: false });
const { character, rig, state } = stage;

const ui = {
  timeline: document.getElementById('timeline'),
  play: document.getElementById('play'),
  time: document.getElementById('time'),
  gray: document.getElementById('gray'),
  system: document.getElementById('system'),
  explode: document.getElementById('explode'),
  explodeVal: document.getElementById('explodeVal'),
  film: document.getElementById('film'),
  info: document.getElementById('info'),
  tree: document.getElementById('tree'),
  counts: document.getElementById('counts'),
};

ui.timeline.min = '0';
ui.timeline.max = String(SOURCE_DURATION);
ui.timeline.step = String(1 / FPS);

let playing = false;
let selected = null;

function parentOf(a) {
  return a.parent !== character.rootId ? rig.byId.get(a.parent) : null;
}

function buildTree() {
  const rows = [];
  const walk = (a, depth) => {
    const c = (SYSTEMS[a.system]?.color ?? 0x888888).toString(16).padStart(6, '0');
    rows.push(`<div class="row${selected === a.id ? ' sel' : ''}" data-id="${a.id}" style="padding-left:${6 + depth * 13}px">`
      + `<span class="dot" style="background:#${c}"></span>${a.id}</div>`);
    for (const child of character.assemblies.filter((x) => x.parent === a.id)) walk(child, depth + 1);
  };
  for (const root of character.assemblies.filter((a) => !parentOf(a))) walk(root, 0);
  ui.tree.innerHTML = rows.join('');
  for (const el of ui.tree.querySelectorAll('.row')) {
    el.addEventListener('click', () => {
      selected = el.dataset.id;
      buildTree();
      updateInfo();
    });
  }
}

function updateInfo() {
  ui.counts.textContent = `装配 ${character.assemblies.length} · 渲染网格 ${stage.meshRecords.length} · 几何体 ${Object.keys(character.meshes).length}`;
  const shot = SHOTS.find((s) => state.t >= s.from && state.t < s.to) || SHOTS[0];
  if (selected) {
    const a = rig.byId.get(selected);
    if (a) {
      ui.info.innerHTML = `<strong>${a.id}</strong><br>`
        + `系统：${SYSTEMS[a.system]?.label || a.system}<br>`
        + `材质：${a.material}<br>`
        + `父级：${a.parent}<br>`
        + `时间窗：${a.window ? a.window.join(' s → ') + ' s' : '静态'}<br>`
        + (a.note ? `说明：${a.note}` : '');
      return;
    }
  }
  ui.info.innerHTML = `<strong>研究台</strong><br>时间 ${state.t.toFixed(2)} s / ${SOURCE_DURATION.toFixed(2)} s<br>`
    + `镜头：${shot.label}（${shot.id}）<br>点击模型或右侧列表查看装配。`;
  const cam = stage.camera;
  const t = stage.controls.target;
  ui.info.innerHTML += `<br><span style="color:#6f7a87">相机 fov ${cam.fov.toFixed(1)}° · `
    + `eye ${cam.position.toArray().map((v) => v.toFixed(2)).join(', ')} · `
    + `target ${t.toArray().map((v) => v.toFixed(2)).join(', ')}</span>`;
}

ui.timeline.addEventListener('input', () => {
  stage.setTime(parseFloat(ui.timeline.value));
  ui.time.textContent = `${state.t.toFixed(2)} s`;
  // Re-frame: the vehicle and the robot have very different silhouettes.
  stage.fitFreeCamera();
  updateInfo();
  writeHash();
});

// The address bar keeps the inspected state, so a QA pass can return to the
// exact frame and camera mode that was reviewed.
function writeHash() {
  const params = new URLSearchParams();
  params.set('t', state.t.toFixed(2));
  if (ui.film.checked) params.set('film', '1');
  history.replaceState(null, '', `#${params.toString()}`);
}

function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const t = parseFloat(params.get('t'));
  if (Number.isFinite(t)) {
    stage.setTime(t);
    ui.timeline.value = String(t);
    ui.time.textContent = `${state.t.toFixed(2)} s`;
  }
  if (params.get('film') === '1') {
    ui.film.checked = true;
    stage.controls.enabled = false;
  }
}
ui.play.addEventListener('click', () => {
  playing = !playing;
  ui.play.textContent = playing ? '暂停' : '播放';
});
ui.gray.addEventListener('change', () => {
  state.gray = ui.gray.checked;
  stage.applyMaterials();
});
ui.system.addEventListener('change', () => {
  state.colorBySystem = ui.system.checked;
  stage.applyMaterials();
});
ui.explode.addEventListener('input', () => {
  state.explode = parseFloat(ui.explode.value);
  ui.explodeVal.textContent = state.explode.toFixed(2);
});
ui.film.addEventListener('change', () => {
  stage.controls.enabled = !ui.film.checked;
});

// Click to inspect an assembly.
const raycaster = new Raycaster();
const pointer = new Vector2();
stage.renderer.domElement.addEventListener('pointerdown', (ev) => {
  const rect = stage.renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, stage.camera);
  const hit = raycaster.intersectObjects(stage.meshRecords, false)[0];
  if (hit?.object?.userData?.assemblyId) {
    selected = hit.object.userData.assemblyId;
    buildTree();
    updateInfo();
  }
});

buildTree();
stage.applyMaterials();
readHash();
stage.fitFreeCamera();
updateInfo();
stage.controls.addEventListener('change', updateInfo);

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    stage.setTime((state.t + dt) % SOURCE_DURATION);
    ui.timeline.value = String(state.t);
    ui.time.textContent = `${state.t.toFixed(2)} s`;
    updateInfo();
  }
  stage.applyPose();
  if (ui.film.checked) stage.useFilmCamera(state.t);
  else stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.__bb = {
  stage, rig, character,
  setTime: (t) => { stage.setTime(t); ui.timeline.value = String(t); },
  poseDigest: (t) => {
    const mats = rig.poseAt(t);
    let acc = 0;
    for (const m of mats.values()) for (let i = 0; i < 16; i++) acc = (acc + m[i] * (i + 1)) % 1e9;
    return acc;
  },
};
