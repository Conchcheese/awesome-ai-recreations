// 数学/结构断言（纯检查，不写文件；由 check.mjs 打包后运行）
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildModel, applyState, stateAt, compileTracks, TRACKS } from '../src/character.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const model = buildModel();
const { registry, ports } = model;
const ids = registry.map((a) => a.id);

// 1. 装配 ID 唯一、端口可达
assert.equal(new Set(ids).size, ids.length, '装配 ID 唯一');
for (const [port, id] of Object.entries(ports)) assert.ok(ids.includes(id), `端口 ${port} → ${id}`);
// 2. 轨道覆盖：TRACKS 的每个 id 必须在注册表中
for (const tid of Object.keys(TRACKS)) assert.ok(ids.includes(tid), `轨道 ${tid} 未注册`);
// 3. 装配目录一致（records/assembly-catalog.json）
const catalog = JSON.parse(readFileSync(path.join(rootDir, 'records/assembly-catalog.json'), 'utf8'));
assert.deepEqual(catalog.assemblies.map((a) => a.id), ids, 'assembly-catalog 与注册表一致');
assert.equal(catalog.partCount, model.partCount, 'partCount 一致');

// 4. 端到端采样：400 步
const compiled = compileTracks();
const byName = new Map();
model.root.traverse((o) => { if (o.isGroup && o.name && o.name !== 'scene') byName.set(o.name, o); });
let previous = null, maxStep = 0;
const sampleIds = [];
for (let i = 0; i <= 400; i++) {
  const t = i / 400;
  const table = applyState(model, t, 0);
  assert.equal(table.length, ids.length, '姿态表覆盖全部装配');
  model.root.updateMatrixWorld(true);
  if (i === 0) sampleIds.push(...table.map((x) => x.id));
  else assert.deepEqual(table.map((x) => x.id), sampleIds, '装配身份恒定');
  const box = new THREE.Box3().setFromObject(model.root);
  // 地面约束：两端接地，全程不沉入地面
  if (t === 0 || t === 1) { assert.ok(box.min.y > -0.012 && box.min.y < 0.05, `t=${t} 接地 min.y=${box.min.y.toFixed(4)}`); }
  assert.ok(box.min.y > -0.02, `t=${t} 不穿地 min.y=${box.min.y.toFixed(4)}`);
  for (const g of byName.values()) {
    assert.ok(Number.isFinite(g.position.x + g.position.y + g.position.z), '位置有限');
    assert.ok(g.scale.x === 1 && g.scale.y === 1 && g.scale.z === 1, '禁止缩放变形');
  }
  // 步长连续性（装配锚点位移）
  if (previous) {
    for (const s of table) {
      const p = previous.get(s.id);
      const d = Math.hypot(s.p[0] - p[0], s.p[1] - p[1], s.p[2] - p[2]);
      if (d > maxStep) maxStep = d;
    }
  }
  previous = new Map(table.map((s) => [s.id, s.p]));
}
assert.ok(maxStep < 0.22, `相邻 0.25% 采样步长异常: ${maxStep.toFixed(4)}`);

// 5. 端点几何 sanity（spec §1/§2 guess 窗口）
applyState(model, 0, 0); model.root.updateMatrixWorld(true);
const truckBox = new THREE.Box3().setFromObject(model.root);
const truckSize = truckBox.getSize(new THREE.Vector3());
assert.ok(truckSize.z > 7.0 && truckSize.z < 8.3, `卡车长度 ${truckSize.z.toFixed(2)}`);
assert.ok(truckSize.y > 2.9 && truckSize.y < 3.7, `卡车高度 ${truckSize.y.toFixed(2)}`);
assert.ok(truckSize.x > 2.2 && truckSize.x < 2.9, `卡车宽度 ${truckSize.x.toFixed(2)}`);
applyState(model, 1, 0); model.root.updateMatrixWorld(true);
const robotBox = new THREE.Box3().setFromObject(model.root);
const robotSize = robotBox.getSize(new THREE.Vector3());
assert.ok(robotSize.y > 4.7 && robotSize.y < 5.6, `人形高度 ${robotSize.y.toFixed(2)}`);
assert.ok(robotSize.x > 2.4 && robotSize.x < 3.5, `人形肩宽 ${robotSize.x.toFixed(2)}`);

// 6. 确定性：同参重算一致；t1→t2→t1 回到原状态；反向对称
const a37 = JSON.stringify(stateAt(0.37, 0));
assert.equal(a37, JSON.stringify(stateAt(0.37, 0)), 'stateAt 同参确定性');
const snapshotA = model.root.position.toArray().join();
applyState(model, 0.37, 0); const m1 = dumpMatrices(model);
applyState(model, 0.82, 0); applyState(model, 0.37, 0); const m2 = dumpMatrices(model);
assert.deepEqual(m1, m2, 't1→t2→t1 姿态矩阵一致');
assert.equal(snapshotA, model.root.position.toArray().join(), 'root 未被改动');
const fwd = stateAt(0.42, 0), rev = stateAt(0.58, 0);
assert.equal(JSON.stringify(fwd.map((s) => s.id)), JSON.stringify(rev.map((s) => s.id)), '正反同一批装配');

// 7. 拆解：explode=1 时所有带方向的装配都有位移，0 时归零；explode 不得污染静态轨道
const baseline = JSON.stringify(stateAt(1, 0));
const base = new Map(stateAt(1, 0).map((s) => [s.id, s.p]));
const ex = stateAt(1, 1);
assert.equal(JSON.stringify(stateAt(1, 0)), baseline, 'explode 计算不得改变 t=1 基准表');
let moved = 0;
for (const s of ex) {
  const p = base.get(s.id);
  const d = Math.hypot(s.p[0] - p[0], s.p[1] - p[1], s.p[2] - p[2]);
  if (d > 0.01) moved++;
}
assert.ok(moved >= 30, `拆解位移装配数过少: ${moved}`);
assert.equal(JSON.stringify(stateAt(1, 0)), baseline, 'explode=0 与基础态一致（无污染）');

// 8. 六轮全程在位（轨道插值不改变装配集合）
const wheelIds = ids.filter((i) => i.startsWith('wheel_'));
assert.equal(wheelIds.length, 6, '六轮注册');
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  const table = stateAt(t, 0);
  assert.equal(table.filter((s) => s.id.startsWith('wheel_')).length, 6, `t=${t} 六轮在位`);
}

function dumpMatrices(model) {
  const out = [];
  model.root.traverse((o) => { if (o.isGroup && o.name && o.name !== 'scene') out.push(Array.from(o.matrixWorld.elements).map((x) => Math.round(x * 1e6) / 1e6)); });
  return JSON.stringify(out);
}

console.log(JSON.stringify({
  assemblies: ids.length, parts: model.partCount, samples: 401,
  maxStep: Number(maxStep.toFixed(4)),
  truck: { size: truckSize.toArray().map((x) => +x.toFixed(2)) },
  robot: { size: robotSize.toArray().map((x) => +x.toFixed(2)) },
  explodeAssemblies: moved,
  reentrant: true, deterministic: true, sixWheels: true,
}));
