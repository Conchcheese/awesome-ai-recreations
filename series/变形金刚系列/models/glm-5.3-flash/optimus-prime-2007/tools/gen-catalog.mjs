// 生成 records/assembly-catalog.json（注册表与分件数的事实快照）
import { dep, dependency, root } from './deps.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';

const { build } = await dep('esbuild');
const out = path.join(root, 'artifacts/gen-catalog.mjs');
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(path.join(root, 'artifacts/gen-catalog.entry.mjs'), `
import * as THREE from 'three';
import { buildModel } from '${path.join(root, 'src/character.mjs')}';
const m = buildModel();
console.log(JSON.stringify({ assemblies: m.registry, partCount: m.partCount, ports: m.ports }));
`);
await build({
  entryPoints: [path.join(root, 'artifacts/gen-catalog.entry.mjs')],
  bundle: true, platform: 'node', format: 'esm', outfile: out,
  alias: {
    'three/addons': path.resolve(path.dirname(dependency('three')), '../examples/jsm'),
    three: path.dirname(dependency('three')) + '/three.module.js',
  },
});
const { execFileSync } = await import('node:child_process');
const json = execFileSync(process.execPath, [out], { encoding: 'utf8' });
const parsed = JSON.parse(json.trim().split('\n').pop());
await fs.writeFile(path.join(root, 'records/assembly-catalog.json'), JSON.stringify(parsed, null, 2) + '\n');
console.log(`已生成 records/assembly-catalog.json：${parsed.assemblies.length} 装配 / ${parsed.partCount} 分件`);
