import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
for (const name of ['index', 'film']) {
  const entry = name === 'index' ? 'app.js' : 'film.js';
  const result = await build({ entryPoints: [path.join(root, 'src', entry)], bundle: true, minify: true, format: 'iife', platform: 'browser', write: false, legalComments: 'inline' });
  const template = await readFile(path.join(root, `src/${name}.template.html`), 'utf8');
  const html = template.replace('/*__CSS__*/', css).replace('/*__JS__*/', () => result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
  await writeFile(path.join(root, `${name}.html`), html);
  console.log(`built ${name}.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB)`);
}
