/* HY4 · 构建：把 Three.js 与 src/ 打成单文件 IIFE，内联进 shell.html
 * 依赖来自同系列既有案例的已锁定 node_modules（Three.js 0.186.1 / esbuild 0.28.1），
 * 不在本版本目录复制依赖；生成的页面完全离线自包含。
 * 执行：node tools/build.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const depDir = resolve(root, '../gpt-6-1-sol/node_modules');
if (!existsSync(join(depDir, 'three/package.json'))) throw new Error('找不到同系列已锁定的 Three.js 依赖：' + depDir);

const require = createRequire(join(depDir, 'esbuild/package.json'));
const esbuild = require('esbuild');

const result = await esbuild.build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020',
  nodePaths: [depDir], legalComments: 'none', minify: false,
  define: { 'process.env.NODE_ENV': '"production"' }
});
const bundle = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const shell = readFileSync(join(root, 'src/shell.html'), 'utf8');
if (!shell.includes('/*__HY4_INLINE__*/')) throw new Error('shell.html 缺少内联占位');

function build(name, autoplay) {
  const html = shell.replace('/*__HY4_INLINE__*/',
    'window.HY4_AUTOPLAY = ' + String(autoplay) + ';\n' + bundle);
  writeFileSync(join(root, name), html);
  console.log('写入 ' + name + ' · ' + (Buffer.byteLength(html) / 1024 / 1024).toFixed(2) + ' MB · 自包含离线页面');
}
build('index.html', false);
build('film.html', true);
