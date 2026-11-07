// build.mjs —— 把 three.js / CSS / 程序化贴图全部打进单个离线 HTML。
// 用法：node tools/build.mjs [live|film|all]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEPS, fromDeps} from './deps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const esbuild = fromDeps('esbuild');

const OUT = path.join(ROOT, '00-机械章鱼OC-8');
fs.mkdirSync(OUT, {recursive: true});

const PAGES = {
  live: {title: '机械章鱼OC-8 · 互动页', file: '机械章鱼OC-8-互动页.html'},
  film: {title: '机械章鱼OC-8 · 影片页', file: '机械章鱼OC-8-影片页.html'},
};

function html(mode, title, js) {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-mode="${mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>${title} · HY4 独立直出版</title>
<style>html,body{margin:0;padding:0}</style>
</head>
<body>
<script>${js.replace(/<\/script/gi, '<\\/script')}<\/script>
</body>
</html>
`;
}

const which = process.argv[2] || 'all';
const modes = which === 'all' ? Object.keys(PAGES) : [which];
for (const mode of modes) {
  if (!PAGES[mode]) throw new Error(`未知页面模式：${mode}`);
  const res = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'main.js')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: true,
    write: false,
    nodePaths: [DEPS],
    legalComments: 'none',
    define: {'__PAGE_MODE__': JSON.stringify(mode)},
    logLevel: 'warning',
  });
  const js = res.outputFiles[0].text;
  const out = path.join(OUT, PAGES[mode].file);
  fs.writeFileSync(out, html(mode, PAGES[mode].title, js));
  console.log(`✓ ${path.relative(ROOT, out)}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
