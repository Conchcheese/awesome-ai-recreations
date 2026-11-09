import assert from 'node:assert/strict';
import { createBumblebee } from '../src/model.js';

const model = createBumblebee();
assert.equal(model.parts.length, 47, 'expected 47 stable assembly modules');
assert.equal(new Set(model.parts.map((p) => p.id)).size, model.parts.length, 'assembly IDs must be unique');
assert.equal(model.parts.filter((p) => p.system === 'wheel').length, 4, 'Camaro has four visible wheel stations');
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  const state = model.stateAt(t, 0);
  assert.equal(state.transform, t);
  model.root.traverse((o) => {
    assert.ok(o.position.toArray().every(Number.isFinite), `${o.name}: non-finite position`);
    assert.ok(o.scale.toArray().every((v) => Number.isFinite(v) && v > 0), `${o.name}: invalid scale`);
  });
}
model.stateAt(0.25, 0.2);
const before = model.parts.map((p) => p.group.matrixWorld.toArray());
model.stateAt(1, 0.8);
model.stateAt(0.25, 0.2);
const after = model.parts.map((p) => p.group.matrixWorld.toArray());
assert.deepEqual(after, before, 't1 → t2 → t1 must reproduce matrices exactly');
const feet = model.parts.filter((p) => p.id.startsWith('foot-'));
model.stateAt(1, 0);
for (const foot of feet) assert.ok(foot.group.position.y > 0 && foot.group.position.y < 0.5, 'robot feet remain at ground level');
assert.equal(model.select('head-cranium').label, '黄色盔壳与战斗面罩');
assert.equal(model.select('not-a-part'), null);
console.log(`PASS: ${model.parts.length} modules, 4 wheels, 5 poses, deterministic replay, finite transforms, grounded feet`);
