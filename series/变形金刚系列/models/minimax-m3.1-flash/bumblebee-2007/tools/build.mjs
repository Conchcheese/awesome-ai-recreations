// Build the offline pages: bundle three.js + the model into a single HTML
// file so the page can be opened without a server or a network connection.

import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  { entry: 'src/app.js', template: 'src/index.template.html', out: 'index.html' },
  { entry: 'src/film.js', template: 'src/film.template.html', out: 'film.html' },
];

const results = [];
for (const t of targets) {
  const result = await build({
    entryPoints: [path.join(root, t.entry)],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    minify: true,
    legalComments: 'none',
    write: false,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  const template = await readFile(path.join(root, t.template), 'utf8');
  const html = template.replace('/*__BUNDLE__*/', () => code);
  await writeFile(path.join(root, t.out), html);
  results.push({ file: t.out, bytes: Buffer.byteLength(html), bundle: Buffer.byteLength(code) });
  console.log(`built ${t.out}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
}

await writeFile(
  path.join(root, 'artifacts', 'build-summary.json'),
  JSON.stringify({ builtAt: new Date().toISOString(), outputs: results }, null, 2) + '\n',
).catch(() => {});
