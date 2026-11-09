#!/usr/bin/env node
// 三个复刻版本按同一时间轴确定性逐帧录制：
//   GLM      → window.SIM.render(t)      （需 __CAPTURE=true 冻结时钟）
//   DeepSeek → window.__sim.renderFrame(t)
//   HY4      → window.__sim.renderFrame(t)
// 每路直接管道给 ffmpeg，得到 25 s / 30 fps 的同步中间片。
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {CHROMIUM_ARGS, playwright} from '../../../models/glm-5.3-flash/src/kit/paths.mjs';

const SERIES = fileURLToPath(new URL('../../../', import.meta.url));
const {chromium} = playwright();

const OUT = process.env.COMPARE_TMP || path.join(tmpdir(), 'oc8-compare');
const W = 1280, H = 720;
const FPS = Number(process.env.FPS || 30);
const FRAMES = Number(process.env.FRAMES || 25 * FPS);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ONLY_KEYS = ['glm', 'deepseek', 'hy'];

const PAGES = [
  {
    key: 'glm', glm: true,
    file: path.join(SERIES, 'glm5.3-flash复刻/pages/00-机械章鱼OC-8/机械章鱼OC-8-影片页.html'),
  },
  {
    key: 'deepseek',
    file: path.join(SERIES, 'deepseek复刻/00-机械章鱼OC-8/机械章鱼OC-8-影片页.html'),
  },
  {
    key: 'hy',
    file: path.join(SERIES, 'hunyuan复刻/00-机械章鱼OC-8/机械章鱼OC-8-影片页.html'),
  },
].filter((p) => (ONLY ? ONLY.includes(p.key) : ONLY_KEYS.includes(p.key)));

if (!PAGES.length) throw new Error('没有待录制的版本');
if (!(FPS > 0 && Number.isFinite(FPS) && Number.isInteger(FRAMES) && FRAMES > 0)) throw new Error('FPS/FRAMES 必须为有效正数');
fs.mkdirSync(OUT, {recursive: true});

const browser = await chromium.launch({
  headless: true,
  args: [...CHROMIUM_ARGS, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--run-all-compositor-stages-before-draw'],
});

const jobs = [];
for (const p of PAGES) {
  const context = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: 1});
  if (p.glm) await context.addInitScript(() => { window.__CAPTURE = true; });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(pathToFileURL(p.file).href, {waitUntil: 'load', timeout: 60000});
  if (p.glm) await page.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 60000});
  else await page.waitForFunction(() => window.__sim && window.__sim.ready === true, null, {timeout: 60000});
  await page.evaluate(() => document.fonts.ready);

  const out = path.join(OUT, `${p.key}.mp4`);
  const ff = spawn('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ], {stdio: ['pipe', 'inherit', 'inherit']});
  const completion = new Promise((resolve, reject) => {
    ff.once('error', reject);
    ff.once('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg 失败：${code}`)));
  });
  completion.catch(() => {}); // attach immediately; awaited below
  ff.stdin.on('error', (error) => errors.push(error.message));
  jobs.push({...p, context, page, ff, out, errors, completion});
  console.log(`✓ ${p.key} 页面就绪 → ${out}`);
}

const drain = (stream) => new Promise((resolve, reject) => {
  const clean = () => { stream.off('drain', ready); stream.off('error', failed); stream.off('close', closed); };
  const ready = () => { clean(); resolve(); };
  const failed = (error) => { clean(); reject(error); };
  const closed = () => failed(new Error('编码管道提前关闭'));
  if (stream.destroyed) return reject(new Error('编码管道已关闭'));
  stream.once('drain', ready); stream.once('error', failed); stream.once('close', closed);
});
const t0 = Date.now();

for (let i = 0; i < FRAMES; i++) {
  const t = i / FPS;
  await Promise.all(jobs.map(async (j) => {
    await j.page.evaluate(({tt, glm}) => {
      if (glm) window.SIM.render(tt);
      else window.__sim.renderFrame(tt);
    }, {tt: t, glm: !!j.glm});
    await j.page.waitForTimeout(12);
    const buf = await j.page.screenshot({type: 'jpeg', quality: 92});
    if (!j.ff.stdin.write(buf)) await drain(j.ff.stdin);
  }));
  if (i % 30 === 0 || i === FRAMES - 1) {
    const el = (Date.now() - t0) / 1000;
    const eta = i > 0 ? (el / (i + 1)) * (FRAMES - i - 1) : 0;
    process.stdout.write(`\r  ${i + 1}/${FRAMES} 帧  ${el.toFixed(0)} s  剩余约 ${eta.toFixed(0)} s   `);
  }
}
console.log('');

for (const j of jobs) {
  j.ff.stdin.end();
  await j.completion;
  const size = (fs.statSync(j.out).size / 1024 / 1024).toFixed(1);
  console.log(`✓ ${j.key}.mp4  ${size} MB  页面报错 ${j.errors.length}`);
  if (j.errors.length) { console.log('   ', j.errors.slice(0, 3)); process.exitCode = 1; }
  await j.context.close();
}
await browser.close();
console.log('全部中间片完成');
