// 构建：esbuild 打包并内联 Three.js，输出 index.html 与 film.html（离线可开）
import fs from 'node:fs/promises';
import path from 'node:path';
import { dep, dependency, root } from './deps.mjs';

const { build } = await dep('esbuild');
const result = await build({
  entryPoints: [path.join(root, 'src/main.mjs')],
  bundle: true, write: false, format: 'iife', minify: true, legalComments: 'inline',
  alias: {
    'three/addons': path.resolve(path.dirname(dependency('three')), '../examples/jsm'),
    three: path.dirname(dependency('three')) + '/three.module.js',
  },
});
const license = await fs.readFile(path.resolve(path.dirname(dependency('three')), '../LICENSE'), 'utf8');
let html = await fs.readFile(path.join(root, 'src/shell.html'), 'utf8');
html = html.replace('</head>', () => `<!-- Three.js runtime license:\n${license}\n--></head>`);
html = html.replace('/* APP */', () => result.outputFiles[0].text.replaceAll('</script', '<\\/script'));
await fs.writeFile(path.join(root, 'index.html'), html);
await fs.writeFile(path.join(root, 'film.html'), html.replace('<body>', '<body data-film="true">').replace('<title>擎天柱 · 2007 真人电影版 · 变形研究</title>', '<title>擎天柱 · 2007 真人电影版 · 影片巡览</title>'));
const kb = Math.round(result.outputFiles[0].text.length / 1024);
console.log(`已生成 index.html / film.html（Three.js 内联，JS 约 ${kb} KB，运行不依赖网络）`);
