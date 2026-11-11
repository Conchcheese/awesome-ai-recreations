// WorkBuddy 版 OC-8 · 仓库自检脚本
// 用法：node src/check.mjs（从本版本目录执行）
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const need = [
  'index.html',
  'film.html',
  'README.md',
  'records/实现与验证.md',
  'src/spec.md',
  'src/main.js',
  'lib/three.min.js',
  'covers/00-机械章鱼OC-8-封面-workbuddy.png',
];
for (const f of need) {
  const p = join(root, f);
  if (existsSync(p) && statSync(p).size > 0) {
    console.log('  ok  ' + f);
  } else {
    console.error('  MISS ' + f);
    fail = 1;
  }
}
// 页面引用一致性
for (const page of ['index.html', 'film.html']) {
  const html = readFileSync(join(root, page), 'utf-8');
  for (const ref of ['src="lib/three.min.js"', 'src="src/main.js"']) {
    if (!html.includes(ref)) {
      console.error('  MISS ' + page + ' 引用 ' + ref);
      fail = 1;
    }
  }
}
// film.html 必须含自动巡览驱动标记
if (!readFileSync(join(root, 'film.html'), 'utf-8').includes('AUTO TOUR')) {
  console.error('  MISS film.html 自动巡览驱动');
  fail = 1;
}
if (fail) { console.error('check FAILED'); process.exit(1); }
console.log('workbuddy variant check: ALL OK');
