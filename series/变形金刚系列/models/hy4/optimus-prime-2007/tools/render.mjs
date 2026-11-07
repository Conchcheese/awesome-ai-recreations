/* HY4 · 逐帧离线渲染（同源模型 / 确定性时间 / 非网页录屏）
 * 执行：NODE_PATH=<同系列 node_modules> node tools/render.mjs [--start 0] [--end 672]
 * 每帧按 cameraAt(i/24) 求源时间与镜头，调用 window.__HY4__.setShot 同步重绘后截图。
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const depDir = resolve(root, '../../../01-擎天柱-电影版/node_modules');
const require = createRequire(join(depDir, 'playwright/package.json'));
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? Number(argv[i + 1]) : def; };
const START = arg('--start', 0);
const END = arg('--end', 672);
const WIDTH = 1920, HEIGHT = 804, FPS = 24;
const outDir = join(root, 'artifacts/frames');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--disable-lcd-text']
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('frame pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(pathToFileURL(join(root, 'index.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => window.__HY4__ && window.__HY4__.ready, { timeout: 30000 });
await page.evaluate(() => window.__HY4__.setCapture(true));
await page.waitForTimeout(500);

const stats = await page.evaluate(() => window.__HY4__.stats());
const manifest = { width: WIDTH, height: HEIGHT, fps: FPS, totalFrames: 672,
  rendered: [START, END], model: stats, frames: [], startedAt: new Date().toISOString() };

const t0 = Date.now();
for (let i = START; i < END; i++) {
  const info = await page.evaluate((frame) => window.__HY4__.setShot(frame / 24), i);
  const file = join(outDir, String(i).padStart(4, '0') + '.png');
  await page.screenshot({ path: file, animations: 'disabled' });
  manifest.frames.push({ i, movieTime: +(i / FPS).toFixed(6), shot: info.shot,
    sourceT: +info.sourceT.toFixed(6), fov: +info.fov.toFixed(3), explode: +info.explode.toFixed(4), deploy: +info.deploy.toFixed(4) });
  if (i % 48 === 0 || i === END - 1) {
    const el = (Date.now() - t0) / 1000;
    console.log(`帧 ${String(i).padStart(4)} / ${END} · ${info.shot} · ${el.toFixed(1)}s · ${(el / (i - START + 1)).toFixed(3)}s/帧`);
  }
}
manifest.finishedAt = new Date().toISOString();
manifest.seconds = +((Date.now() - t0) / 1000).toFixed(2);
manifest.pageErrors = errors;
manifest.digest = createHash('sha256').update(JSON.stringify(manifest.frames)).digest('hex');
writeFileSync(join(root, 'artifacts/render-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await browser.close();
console.log(`完成 ${END - START} 帧；耗时 ${manifest.seconds}s；页面错误 ${errors.length}`);
if (errors.length) { console.error(errors.slice(0, 8).join('\n')); process.exit(1); }
