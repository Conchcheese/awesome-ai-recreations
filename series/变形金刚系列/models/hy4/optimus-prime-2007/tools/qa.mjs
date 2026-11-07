/* HY4 · 页面 QA：DOM 契约 + 真实 Chromium 实跑
 * 执行：NODE_PATH=<同系列 node_modules> node tools/qa.mjs
 * 静态门禁不代替人工视觉评审；视觉差异表见 records/参考测量与差异合同.md。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [], passed = [];
const check = (label, cond) => (cond ? passed : errors).push(label);

const html = read('index.html');
const film = read('film.html');
const app = read('src/main.js');
const shell = read('src/shell.html');

const ids = [...app.matchAll(/el\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
check('main.js 引用的 DOM 节点全部存在（' + ids.length + ' 个）',
  ids.length > 0 && ids.every((id) => html.includes('id="' + id + '"')));
const times = [...html.matchAll(/data-t="([^"]+)"/g)].map((m) => parseFloat(m[1]));
check('形态抽查覆盖车辆/25/50/75%/人形端点',
  times.length === 5 && times.every((v, i) => v >= 0 && v <= 50 && (i === 0 || v > times[i - 1])));
check('侧背视角 / 研究控件 / 时间滑杆存在', html.includes('data-yaw=') &&
  html.includes('id="btn-mode"') && html.includes('id="btn-play"') && html.includes('id="range"') &&
  html.includes('id="range-explode"'));
check('HY4 铭牌在页面显著位置', html.includes('class="hy4"') && /<b>HY4<\/b>/.test(html) &&
  html.includes('Tencent Hunyuan Hy'));
check('页面无外部资源依赖（可离线双击）',
  !/(?:src|href)\s*=\s*["']https?:/i.test(html) && !/@import\s+url\(\s*["']?https?:/i.test(html));
check('index.html 由 shell.html 内联生成',
  shell.includes('/*__HY4_INLINE__*/') && !html.includes('/*__HY4_INLINE__*/'));
check('双页同源，仅自动巡览开关不同',
  film.replace('HY4_AUTOPLAY = true', 'HY4_AUTOPLAY = false') === html);
check('确定性取帧 API 已暴露', /window\.__HY4__\s*=/.test(app) &&
  /setShot/.test(app) && /setCapture/.test(app) && /stateAt/.test(app));

/* 真实浏览器：WebGL 初始化、两端形态、七个镜头、灰模/分色、零件拾取 */
const depDir = resolve(root, '../../../01-擎天柱-电影版/node_modules');
const require = createRequire(join(depDir, 'playwright/package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
await page.goto(pathToFileURL(join(root, 'index.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => window.__HY4__ && window.__HY4__.ready, { timeout: 30000 });

const stats = await page.evaluate(() => window.__HY4__.stats());
check('WebGL 场景就绪：37 装配 / 490 分件 / 974 Mesh',
  stats.assemblies === 37 && stats.parts === 490 && stats.meshes === 974);
check('成片参数 7 镜头 / 672 帧 / 24fps / 28s',
  stats.shots === 7 && stats.frames === 672 && stats.fps === 24 && stats.duration === 28);

const endpoints = await page.evaluate(() => {
  const a = window.__HY4__.seek(0), b = window.__HY4__.seek(19);
  return [a.phase, b.phase];
});
check('两端形态切换有效', endpoints[0] === 0 && endpoints[1] === 1);

const shots = await page.evaluate(() => [48, 228, 408, 492, 558, 612, 654]
  .map((i) => window.__HY4__.setShot(i / 24).shot));
check('七个镜头均可确定性取帧', new Set(shots).size === 7);

const modes = await page.evaluate(() => [window.__HY4__.setMode('grey'),
  window.__HY4__.setMode('systems'), window.__HY4__.setMode('pbr')]);
check('灰模 / 系统分色 / PBR 三模式可切换', modes.join(',') === 'grey,systems,pbr');

await page.locator('[data-t="13.5"]').click();
await page.locator('[data-yaw="2.6"]').click();
await page.locator('#btn-mode').click();
const ui = await page.evaluate(() => ({ t: document.getElementById('range').value,
  mode: document.getElementById('btn-mode').textContent }));
check('控件可点击并回写状态', ui.t === '13.5' && ui.mode === '灰模');
check('浏览器实跑零报错', pageErrors.length === 0);
await browser.close();

for (const p of passed) console.log('  ✓ ' + p);
for (const e of errors) console.log('  ✗ ' + e);
console.log(`页面 QA ${passed.length + errors.length} 项，通过 ${passed.length} 项，失败 ${errors.length} 项。`);
console.log('注意：静态与浏览器门禁不代替人工视觉评审。');
if (errors.length) process.exit(1);
