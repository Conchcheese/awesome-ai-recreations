// Write the assembly / part catalogue consumed by the production contract.
//
// An assembly is a rigid node with one owner and a stable id. A part is a
// visual piece owned by exactly one assembly. The count of parts is a
// bookkeeping number, not a measure of geometric freedom.

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCharacter } from '../src/model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const character = buildCharacter();

// Visual sub-pieces per assembly. Meshes without an entry are a single part.
const BREAKDOWN = {
  'body.frame': ['rail.l', 'rail.r', 'crossmember.f1', 'crossmember.f2', 'crossmember.m1', 'crossmember.m2', 'crossmember.r'],
  'body.wheel': ['tire', 'rim', 'spoke.1', 'spoke.2', 'spoke.3', 'spoke.4', 'spoke.5', 'hub', 'cap'],
  'body.grille': ['surround', 'slat.1', 'slat.2', 'slat.3', 'slat.4', 'slat.5'],
  'body.bowtie': ['bar', 'wing.l', 'wing.r'],
  'body.bumper.front': ['bar', 'valance'],
  'body.bumper.rear': ['bar', 'valance'],
  'body.nose': ['fascia', 'return.flange.l', 'return.flange.r'],
  'body.tail': ['fascia', 'return.flange.l', 'return.flange.r'],
  'body.hood': ['skin', 'crown'],
  'body.roof': ['skin', 'crown'],
  'body.deck': ['skin', 'crown'],
  'body.hood.stripe.l': ['stripe'],
  'body.hood.stripe.r': ['stripe'],
  'body.roof.stripe.l': ['stripe'],
  'body.roof.stripe.r': ['stripe'],
  'body.deck.stripe.l': ['stripe'],
  'body.deck.stripe.r': ['stripe'],
  'body.door.l': ['skin', 'return.flange.top', 'return.flange.bottom'],
  'body.door.r': ['skin', 'return.flange.top', 'return.flange.bottom'],
  'body.door.inner.l': ['inner-skin'],
  'body.door.inner.r': ['inner-skin'],
  'body.fender.l': ['skin', 'return.flange.top', 'return.flange.bottom'],
  'body.fender.r': ['skin', 'return.flange.top', 'return.flange.bottom'],
  'body.quarter.l': ['skin', 'return.flange.top', 'return.flange.bottom'],
  'body.quarter.r': ['skin', 'return.flange.top', 'return.flange.bottom'],
  'body.rocker.l': ['skin', 'return.flange.top', 'return.flange.bottom'],
  'body.rocker.r': ['skin', 'return.flange.top', 'return.flange.bottom'],
  'body.tub': ['shell'],
  'body.windshield': ['glass'],
  'body.rearwindow': ['glass'],
  'body.pillar.a': ['pillar'],
  'body.pillar.c': ['pillar'],
  'body.mirror': ['housing', 'stalk'],
  'body.engine': ['block', 'head.l', 'head.r', 'piston.l', 'piston.r'],
  'body.headlight': ['lens', 'housing'],
  'body.fog': ['lens', 'housing'],
  'body.taillight': ['lens', 'housing'],
  'body.exhaust': ['tip'],
  'core.chest': ['block', 'spine'],
  'core.pelvis': ['block'],
  'core.rib': ['rib'],
  'head.shell': ['dome', 'crest'],
  'head.face': ['plate'],
  'head.eye': ['lens'],
  'head.pod': ['pod'],
  'arm.fore': ['shell', 'piston'],
  'hand.fist': ['palm', 'finger.1', 'finger.2', 'finger.3'],
  'foot.plate': ['sole', 'toe'],
  'foot.heel': ['block'],
};

const assemblies = [];
const parts = [];
for (const a of character.assemblies) {
  const list = BREAKDOWN[a.id] || ['body'];
  const ids = list.map((n) => `${a.id}.${n}`);
  assemblies.push({
    id: a.id,
    parent: a.parent,
    system: a.system,
    material: a.material,
    mesh: a.mesh,
    parts: ids,
    window: a.window || null,
    note: a.note || '',
  });
  for (const id of ids) parts.push({ id, assembly: a.id });
}

const out = {
  schemaVersion: 1,
  generatedFrom: 'src/model.mjs',
  rootId: character.rootId,
  counts: { assemblies: assemblies.length, parts: parts.length, meshes: Object.keys(character.meshes).length },
  assemblies,
  parts,
};

await writeFile(
  path.join(root, 'records', 'assembly-catalog.json'),
  JSON.stringify(out, null, 2) + '\n',
);
console.log(`assemblies ${assemblies.length} · parts ${parts.length}`);
