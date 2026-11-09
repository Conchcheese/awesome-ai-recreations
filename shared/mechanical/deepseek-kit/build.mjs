#!/usr/bin/env node
// 把一台机器的 live/film 入口打包成单文件离线 HTML（three.js、字体、CSS 全部内联）。
//
//   node build.mjs            构建 machines.json 里全部机器
//   node build.mjs 00         只构建 key 以 00 开头的机器
//   DS_DEBUG=1 node build.mjs 00   不压缩（便于调试）
//
// 产物：deepseek复刻/<机器目录>/<中文名>-互动页.html / <中文名>-影片页.html
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve('src');
const OUT_ROOT = process.cwd();

const DEPS_CANDIDATES = [
  process.env.DS_DEPS,
  path.join(HERE, 'node_modules'),
  path.resolve(HERE, '../kit/node_modules'),
].filter(Boolean);
const DEPS = DEPS_CANDIDATES.find((p) => fs.existsSync(path.join(p, 'esbuild', 'package.json')));
if (!DEPS) {
  console.error('找不到依赖目录（three/esbuild/@fontsource）。请设置 DS_DEPS 或在 src/kit 下 npm install。');
  process.exit(1);
}
const require = createRequire(path.join(DEPS, 'x.js'));
const esbuild = require('esbuild');

const config = JSON.parse(fs.readFileSync(path.join(HERE, 'machines.json'), 'utf8'));
const caseId = path.basename(path.dirname(path.dirname(process.cwd())));
const machineKey = {oc8: '00', v8: '01'}[caseId];
const CONFIG = {machines: config.machines.filter(machine => machine.key === machineKey)};
const MINIFY = !process.env.DS_DEBUG;

/* ---------------------------------------------------------------- 字体 & CSS */
function fontFace(family, weight, file) {
  const b64 = fs.readFileSync(path.join(DEPS, file)).toString('base64');
  return `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}
const FONTS = [
  fontFace('JetBrains Mono', 400, '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2'),
  fontFace('JetBrains Mono', 600, '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2'),
  fontFace('JetBrains Mono', 700, '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2'),
  fontFace('Inter', '100 900', '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
].join('\n');

const KIT_CSS = fs.readFileSync(path.join(HERE, 'style.css'), 'utf8');

/* ---------------------------------------------------------------- 构建 */
async function buildPage(m, mode) {
  const dir = SRC;
  const entry = path.join(dir, mode, 'main.js');
  if (!fs.existsSync(entry)) throw new Error(`缺少入口：${entry}`);
  const css = [KIT_CSS, fs.existsSync(path.join(dir, 'style.css')) ? fs.readFileSync(path.join(dir, 'style.css'), 'utf8') : '']
    .filter(Boolean).join('\n');
  const t0 = Date.now();
  const res = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    minify: MINIFY,
    write: false,
    nodePaths: [DEPS],
    legalComments: 'none',
    logLevel: 'warning',
    loader: {'.woff2': 'dataurl', '.woff': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl'},
    define: {
      __PAGE_MODE__: JSON.stringify(mode),
      'process.env.NODE_ENV': '"production"',
    },
  });
  const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  const label = mode === 'live' ? '互动页' : '影片页';
  const title = `${m.cn} · ${label}`;
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>${title}</title>
<style>
${FONTS}
${css}
</style>
</head>
<body>
<div id="app"></div>
<script type="module">
${js}
</script>
</body>
</html>
`;
  const outDir = OUT_ROOT;
  fs.mkdirSync(outDir, {recursive: true});
  const out = path.join(outDir, label === '互动页' ? 'index.html' : 'film.html');
  fs.writeFileSync(out, html);
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`✓ ${path.relative(process.cwd(), out)}  ${kb} KB  (${Date.now() - t0} ms)`);
  return out;
}

const args = process.argv.slice(2);
let picked = CONFIG.machines;
if (args.length && !args.includes('all')) {
  picked = CONFIG.machines.filter((m) => args.some((a) => m.key === a || m.dir.startsWith(a) || m.key.startsWith(a)));
  if (!picked.length) {
    console.error(`没有匹配的机器：${args.join(', ')}；可选 ${CONFIG.machines.map((m) => m.key).join(' ')}`);
    process.exit(1);
  }
}

for (const m of picked) {
  for (const mode of ['live', 'film']) {
    try {
      await buildPage(m, mode);
    } catch (err) {
      console.error(`✗ ${m.dir} ${mode}: ${err.message}`);
      process.exitCode = 1;
    }
  }
}
