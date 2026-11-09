#!/usr/bin/env node
// 独立性审计：把本版 src/*.js 与其余实现的全部 js/mjs 逐行、逐 8-gram 比对。
// 目的：提供代码重合信号；它不能证明创作过程、模型身份或无派生关系。
// 用法：node tools/independence.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERIES = path.resolve(HERE, '../..');
const SRC = path.join(SERIES, 'hy4-direct/src');
const GROUPS = [
  ['DeepSeek 版', path.join(SERIES, 'deepseek/src')],
  ['GLM 5.3-Flash 版', path.join(SERIES, 'glm-5.3-flash/src')],
  ['HY 衍生版（旧）', path.join(SERIES, 'hy-derived/src')],
];

const strip = (s) => s
  .replace(/\/\/.*$/gm, '')
  .replace(/#[0-9a-fA-F]{3,8}|0x[0-9a-fA-F]{3,8}/g, 'COLOR');

function lines(p) {
  const out = new Set();
  for (const raw of strip(fs.readFileSync(p, 'utf8')).split('\n')) {
    const l = raw.trim().replace(/\s+/g, ' ');
    if (l.length > 24) out.add(l);
  }
  return out;
}
function shingles(p, k = 8) {
  const toks = strip(fs.readFileSync(p, 'utf8')).match(/[A-Za-z_$][\w$]*|\d+|[^\s\w]/g) || [];
  const out = new Set();
  for (let i = 0; i + k <= toks.length; i++) out.add(toks.slice(i, i + k).join('\u0001'));
  return out;
}
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') out.push(...walk(p));
    } else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const own = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).map((f) => path.join(SRC, f));
const ownLines = new Set(own.flatMap((p) => [...lines(p)]));
const ownSh = new Set(own.flatMap((p) => [...shingles(p)]));
console.log(`HY4 独立直出版：${own.length} 个源码文件 / ${ownLines.size} 条有效代码行 / ${ownSh.size} 个 8-gram\n`);

for (const [label, dir] of GROUPS) {
  const files = walk(dir);
  if (!files.length) { console.log(`${label}：目录不存在，跳过`); continue; }
  const ol = new Set(), osh = new Set();
  for (const p of files) {
    for (const x of lines(p)) ol.add(x);
    for (const x of shingles(p)) osh.add(x);
  }
  const dup = [...ownLines].filter((x) => ol.has(x));
  const inter = [...ownSh].filter((x) => osh.has(x)).length;
  const jac = inter / Math.max(1, ownSh.size + osh.size - inter);
  console.log(`${label.padEnd(20)} ${String(files.length).padStart(3)} 个 js | 逐字相同行 ${String(dup.length).padStart(3)} / ${ownLines.size} | 8-gram Jaccard ${(jac * 100).toFixed(2)}%`);
  for (const x of dup.slice(0, 5)) console.log(`    · ${x.slice(0, 92)}`);
}

console.log('\n对照基准：旧 HY 衍生版曾出现多个文件与 DeepSeek 版 99.8–100% 同源（kit 逐字节相同）。');
console.log('限制：这是简化词法比对，受变量名、样板、比较集合大小与注释处理影响；低重合率不能证明无派生关系，高重合率也需核对许可与实际复用。');
console.log('独立性需结合允许输入、实际提示词、工具日志、代码演进与人工介入记录判断；本脚本不做独立性判决。');
