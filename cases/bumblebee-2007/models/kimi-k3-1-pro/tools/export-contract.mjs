import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBumblebee } from '../src/model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const model = createBumblebee();
const assemblies = [];
const parts = [];
for (const assembly of model.parts) {
  const owned = [];
  let index = 0;
  assembly.group.traverse((object) => {
    if (!object.isMesh) return;
    const id = `${assembly.id}/mesh-${String(index++).padStart(3, '0')}`;
    owned.push(id);
    parts.push({ id, assembly: assembly.id, evidence: 'designed', geometry: object.geometry.type });
  });
  assemblies.push({ id: assembly.id, parent: 'scene-root', label: assembly.label, system: assembly.system, parts: owned });
}
const output = { schemaVersion: 1, model: 'Kimi-K3.1-Pro', assemblies, parts };
await writeFile(path.join(root, 'records/assembly-catalog.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`exported ${assemblies.length} assemblies / ${parts.length} visual meshes`);
