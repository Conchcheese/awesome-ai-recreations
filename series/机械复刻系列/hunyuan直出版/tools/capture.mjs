// capture.mjs —— 逐帧静帧验收（确定性调用 window.__sim.renderFrame(t)）。
// 用法：
//   node tools/capture.mjs --t=0,3.6,7.8,10.4,12.8,16.4,21.5,24.4 --out=stills
//   node tools/capture.mjs --t=10.4 --nohud --pose=1.0,0.5,0.9,0.5,0.3,0.2,28 --name=关节微距
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fromDeps, CHROMIUM_ARGS} from './deps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const {chromium} = fromDeps('playwright');

const flags = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) flags[m[1]] = m[2] === undefined ? '1' : m[2];
}
const times = String(flags.t || '0,3.6,7.8,10.4,12.8,16.4,21.5,24.4').split(',').map(Number);
const W = Number(flags.w || 1920), H = Number(flags.h || 1080);
const outDir = path.resolve(ROOT, flags.out || 'stills');
fs.mkdirSync(outDir, {recursive: true});
const pageFile = path.join(ROOT, '00-机械章鱼OC-8', '机械章鱼OC-8-影片页.html');

let pose = null;
if (flags.pose) {
  const v = flags.pose.split(',').map(Number);
  if (v.length < 6 || v.some((x) => !Number.isFinite(x))) throw new Error('--pose 需要 px,py,pz,tx,ty,tz[,fov]');
  pose = {eye: v.slice(0, 3), look: v.slice(3, 6), fov: Number.isFinite(v[6]) ? v[6] : 32};
}

const browser = await chromium.launch({
  headless: true,
  args: [...CHROMIUM_ARGS, '--run-all-compositor-stages-before-draw'],
});
const ctx = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: 1});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(pathToFileURL(pageFile).href, {waitUntil: 'load', timeout: 60000});
await page.waitForFunction(() => window.__sim && window.__sim.ready === true, null, {timeout: 60000});
await page.evaluate(() => document.fonts.ready);
if (flags.nohud) await page.evaluate(() => { document.querySelector('#hud').style.display = 'none'; });

for (const t of times) {
  await page.evaluate(({tt, pose}) => {
    window.__sim.renderFrame(tt);
    if (pose) { window.__OC8.stage.setCamera(pose); window.__OC8.stage.render(); }
  }, {tt: t, pose});
  await page.waitForTimeout(60);
  const name = flags.name
    ? `${flags.name}.jpg`
    : `静帧-${String(t).replace('.', '_')}s${flags.nohud ? '-无HUD' : ''}.jpg`;
  const out = path.join(outDir, name);
  await page.screenshot({path: out, type: 'jpeg', quality: 92});
  console.log(`✓ ${name}  t=${t}s`);
}
console.log(`页面报错：${errors.length}`);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
await browser.close();
process.exit(errors.length ? 1 : 0);
