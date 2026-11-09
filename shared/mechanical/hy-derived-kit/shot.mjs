#!/usr/bin/env node
// 逐帧截图工具：加载单文件页面，调用 window.__sim.renderFrame(t) 后截图。
//
//   node shot.mjs 00 预览 --t=0,4,8        # 机器 key → 自动找 互动页 html
//   node shot.mjs 00 预览 --t=0 --mode=film
//   node shot.mjs ../path/page.html out --t=8 --w=1920 --h=1080 --dpr=1 --nohud
//   node shot.mjs 00 out --t=10.6 --pose=1.13,0.47,-0.235,0.65,0.25,0.27,30 --nohud
//     --pose=px,py,pz,tx,ty,tz,fov 覆盖巡览机位（用于关节微距等交付静帧）
//
// 输出：<out>.png（单帧）或 <out>-t8p0.png（多帧）；打印页面报错数量。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = process.cwd();

const DEPS_CANDIDATES = [
  process.env.DS_DEPS,
  path.join(HERE, 'node_modules'),
  path.resolve(HERE, '../kit/node_modules'),
].filter(Boolean);
const DEPS = DEPS_CANDIDATES.find((p) => fs.existsSync(path.join(p, 'playwright', 'package.json')));
if (!DEPS) {
  console.error('找不到 playwright 依赖目录，设置 DS_DEPS。');
  process.exit(1);
}
const require = createRequire(path.join(DEPS, 'x.js'));
const {chromium} = require('playwright');

const config = JSON.parse(fs.readFileSync(path.join(HERE, 'machines.json'), 'utf8'));
const caseId = path.basename(path.dirname(path.dirname(process.cwd())));
const machineKey = {oc8: '00', v8: '01'}[caseId];
const CONFIG = {machines: config.machines.filter(machine => machine.key === machineKey)};
const positional = [];
const flags = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  else positional.push(a);
}

let target = positional[0];
let outPrefix = positional[1] || path.join(HERE, 'shot');
if (!target) {
  console.error('用法：node shot.mjs <机器key|html路径> <输出前缀> [--t=0,4,8] [--mode=live|film] [--w=1600] [--h=900] [--dpr=1.2] [--nohud]');
  process.exit(1);
}
if (!fs.existsSync(target)) {
  const m = CONFIG.machines.find((x) => x.key === String(target) || x.dir.startsWith(String(target)));
  if (!m) {
    console.error(`找不到机器或文件：${target}`);
    process.exit(1);
  }
  const mode = flags.mode === 'film' ? 'film' : 'live';
  const label = mode === 'film' ? '影片页' : '互动页';
  target = path.join(OUT_ROOT, label === '互动页' ? 'index.html' : 'film.html');
}
target = path.resolve(target);
if (!fs.existsSync(target)) {
  console.error(`文件不存在：${target}`);
  process.exit(1);
}

const W = Number(flags.w || 1600);
const H = Number(flags.h || 900);
const DPR = Number(flags.dpr || 1.2);
const times = String(flags.t || '0').split(',').map(Number).filter((n) => Number.isFinite(n));
const multi = times.length > 1;
const quiet = !!flags.quiet;

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=metal', '--force_high_performance_gpu', '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization', '--enable-webgl', '--hide-scrollbars',
  ],
});
const context = await browser.newContext({
  viewport: {width: W, height: H},
  deviceScaleFactor: DPR,
});
const page = await context.newPage();
const errors = [];
const logs = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${msg.text()}`);
});

let ok = true;
try {
  await page.goto('file://' + target, {waitUntil: 'load', timeout: 60000});
  await page.waitForFunction(() => window.__sim && window.__sim.ready === true, null, {timeout: 60000});
  if (flags.nohud) {
    await page.evaluate(() => { const el = document.querySelector('.hud'); if (el) el.style.display = 'none'; });
  }
  let poseOverride = null;
  if (flags.pose) {
    const v = String(flags.pose).split(',').map(Number);
    if (v.length < 6 || v.some((x) => !Number.isFinite(x))) {
      throw new Error(`--pose 需要 6~7 个数字：px,py,pz,tx,ty,tz[,fov]，收到 ${flags.pose}`);
    }
    poseOverride = {pos: v.slice(0, 3), target: v.slice(3, 6), fov: Number.isFinite(v[6]) ? v[6] : 34};
  }
  for (const t of times) {
    await page.evaluate(({tt, pose}) => {
      window.__sim.renderFrame(tt);
      if (pose && window.__OC8) {
        window.__OC8.studio.setPose(pose);
        window.__OC8.studio.render();
      }
    }, {tt: t, pose: poseOverride});
    await page.waitForTimeout(Number(flags.wait || 140));
    const name = multi ? `${outPrefix}-t${String(t).replace('.', 'p')}.png` : `${outPrefix}.png`;
    await page.screenshot({path: name});
    if (!quiet) console.log(`✓ ${name}  (t=${t})`);
  }
} catch (err) {
  ok = false;
  console.error('截图失败：', err.message);
}
await browser.close();

if (errors.length) {
  ok = false;
  console.error(`\n页面报错 ${errors.length} 条：`);
  errors.slice(0, 12).forEach((e) => console.error('  ✗', e));
}
if (logs.length) {
  console.log(`\n控制台警告/错误 ${logs.length} 条：`);
  logs.slice(0, 20).forEach((l) => console.log('  ·', l));
}
if (flags.strict && !ok) process.exit(1);
