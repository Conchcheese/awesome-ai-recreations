// Structural checks that need no browser.
//
// These prove data integrity only: every assembly owns a mesh, every pose is
// finite, the rig is a pure function of time, and the edit list satisfies the
// production contract. They do not prove visual fidelity or mechanical
// plausibility.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCharacter } from '../src/model.mjs';
import { createRig } from '../src/rig.mjs';
import { SHOTS, EDIT, TRANSFORM, SOURCE_DURATION, FPS } from '../src/shots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const notes = [];

const character = buildCharacter();
const rig = createRig(character);

// --- mesh and assembly integrity -----------------------------------------
let triangleCount = 0;
let vertexCount = 0;
for (const [id, g] of Object.entries(character.meshes)) {
  if (!g.positions.length || !g.indices.length) errors.push(`几何体为空: ${id}`);
  if (g.positions.length % 3) errors.push(`顶点数据不是 3 的倍数: ${id}`);
  if (g.indices.length % 3) errors.push(`索引数据不是 3 的倍数: ${id}`);
  for (const v of g.positions) {
    if (!Number.isFinite(v)) { errors.push(`几何体含非有限坐标: ${id}`); break; }
  }
  for (const n of g.normals) {
    if (!Number.isFinite(n)) { errors.push(`几何体含非有限法线: ${id}`); break; }
  }
  for (const i of g.indices) {
    if (i >= g.positions.length / 3) { errors.push(`索引越界: ${id}`); break; }
  }
  vertexCount += g.positions.length / 3;
  triangleCount += g.indices.length / 3;
}

const ids = new Set();
const owned = new Map();
for (const a of character.assemblies) {
  if (ids.has(a.id)) errors.push(`装配 ID 重复: ${a.id}`);
  ids.add(a.id);
  if (!character.meshes[a.mesh]) errors.push(`装配缺少几何体: ${a.id} -> ${a.mesh}`);
  if (a.parent !== character.rootId && !ids.has(a.parent)) errors.push(`父装配缺失或后置: ${a.id} -> ${a.parent}`);
  if (!a.vehicle || !a.robot) errors.push(`装配缺少端点位姿: ${a.id}`);
  if (!a.window && a.reveal === undefined) notes.push(`装配无时间窗（静态件）: ${a.id}`);
  if (a.window && (a.window[1] <= a.window[0])) errors.push(`时间窗非法: ${a.id}`);
  owned.set(a.id, (owned.get(a.id) || 0) + 1);
}
notes.push(`装配 ${character.assemblies.length} · 几何体 ${Object.keys(character.meshes).length} · 顶点 ${vertexCount} · 三角形 ${triangleCount}`);

// --- pose sanity ----------------------------------------------------------
const samples = [0, 1, 3.5, 3.9, 5.0, 6.5, 8.0, 9.4, 9.6, 12, 16, 19.9];
for (const t of samples) {
  const mats = rig.poseAt(t);
  for (const a of character.assemblies) {
    const m = mats.get(a.id);
    if (!m) { errors.push(`t=${t} 缺少位姿: ${a.id}`); continue; }
    for (let i = 0; i < 16; i++) {
      if (!Number.isFinite(m[i])) { errors.push(`t=${t} 位姿含非有限值: ${a.id}`); break; }
    }
  }
}

// --- determinism: t1 -> t2 -> t1 -----------------------------------------
const digest = (t) => {
  const mats = rig.poseAt(t);
  let acc = 0;
  for (const m of mats.values()) for (let i = 0; i < 16; i++) acc = (acc + m[i] * (i + 1)) % 1e9;
  return acc;
};
const d1 = digest(6.25);
digest(12.5);
const d2 = digest(6.25);
if (Math.abs(d1 - d2) > 1e-6) errors.push('rig 非确定性: t1 -> t2 -> t1 结果不一致');

// --- transform coverage ----------------------------------------------------
const coverage = EDIT.filter((c) => c.purpose === 'transformation');
if (!coverage.length) errors.push('剪辑中缺少连续变形镜头');
else {
  const c = coverage[0];
  if (!(c.sourceIn <= TRANSFORM[0] && c.sourceOut >= TRANSFORM[1])) {
    errors.push('连续变形镜头未覆盖完整变形区间');
  }
  if (c.sourceOut - c.sourceIn < 1) errors.push('变形镜头时长过短，无法作为机构证据');
}

// --- edit continuity and frame alignment ----------------------------------
let cursor = 0;
for (const c of EDIT) {
  if (Math.abs(c.in - cursor) > 1e-7) errors.push(`剪辑不连续: ${c.in} 应接 ${cursor}`);
  if (c.out <= c.in) errors.push(`剪辑段时长非正: ${c.in}-${c.out}`);
  for (const edge of [c.in, c.out, c.sourceIn, c.sourceOut]) {
    if (Math.abs(edge * FPS - Math.round(edge * FPS)) > 1e-7) errors.push(`剪辑边界未落在整帧: ${edge}`);
  }
  cursor = c.out;
}
if (Math.abs(cursor - SOURCE_DURATION) > 1e-7) errors.push(`影片总时长不一致: ${cursor} vs ${SOURCE_DURATION}`);
if (SHOTS.length !== EDIT.length) errors.push('镜头表与剪辑表长度不一致');

// --- contract manifest ------------------------------------------------------
try {
  const manifest = JSON.parse(await readFile(path.join(root, 'production.json'), 'utf8'));
  if (manifest.character.id !== 'bumblebee-2007') errors.push('production.json 角色 ID 不符');
  if (!manifest.rig.ports || !Object.keys(manifest.rig.ports).length) errors.push('production.json 缺少语义接口');
  for (const [name, id] of Object.entries(manifest.rig.ports || {})) {
    if (!ids.has(id)) errors.push(`语义接口指向未知装配: ${name} -> ${id}`);
  }
  for (const p of manifest.rig.requiredPorts || []) {
    if (!manifest.rig.ports?.[p]) errors.push(`缺少语义接口: ${p}`);
  }
} catch (e) {
  errors.push(`production.json 无法读取: ${e.message}`);
}

console.log(notes.join('\n'));
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log('结构检查通过；仅验证数据完整性，不证明视觉还原、碰撞或可制造性。');
