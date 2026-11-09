import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {CHROMIUM_ARGS, playwright} from '../../../models/glm-5.3-flash/src/kit/paths.mjs';

const SERIES = fileURLToPath(new URL('../../../', import.meta.url));
const {chromium} = playwright();

const PAGES = [
  {
    key: 'glm',
    file: path.join(SERIES, 'glm5.3-flash复刻/pages/00-机械章鱼OC-8/机械章鱼OC-8-影片页.html'),
    capture: true,
  },
  {
    key: 'deepseek',
    file: path.join(SERIES, 'deepseek复刻/00-机械章鱼OC-8/机械章鱼OC-8-影片页.html'),
  },
  {
    key: 'hy',
    file: path.join(SERIES, 'hunyuan复刻/00-机械章鱼OC-8/机械章鱼OC-8-影片页.html'),
  },
];

const W = 1280, H = 720;
const OUT = process.env.COMPARE_TMP || path.join(tmpdir(), 'oc8-compare');
fs.mkdirSync(OUT, {recursive: true});
let failures = 0;

const browser = await chromium.launch({
  headless: true,
  args: [...CHROMIUM_ARGS, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--run-all-compositor-stages-before-draw'],
});

for (const p of PAGES) {
  const context = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: 1});
  if (p.capture) await context.addInitScript(() => { window.__CAPTURE = true; });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  try {
    await page.goto(pathToFileURL(p.file).href, {waitUntil: 'load', timeout: 60000});
    if (p.capture) {
      await page.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 60000});
    } else {
      await page.waitForFunction(() => window.__sim && window.__sim.ready === true, null, {timeout: 60000});
    }
    const info = await page.evaluate((isGlm) => {
      const s = isGlm ? window.SIM : window.__sim;
      return {
        keys: Object.keys(s).slice(0, 30),
        duration: s.duration,
        fps: s.fps,
        ready: s.ready,
        hasRender: typeof s.render,
        hasRenderFrame: typeof s.renderFrame,
        hudCount: document.querySelectorAll('.hud').length,
        title: document.title,
      };
    }, p.capture);
    console.log(`\n=== ${p.key} ===`);
    console.log(JSON.stringify(info, null, 2));
    for (const t of [0, 10]) {
      await page.evaluate(({tt, isGlm}) => {
        if (isGlm) window.SIM.render(tt);
        else window.__sim.renderFrame(tt);
      }, {tt: t, isGlm: p.capture});
      await page.waitForTimeout(120);
      await page.screenshot({path: path.join(OUT, `probe-${p.key}-t${t}.png`)});
      console.log(`  ✓ probe-${p.key}-t${t}.png`);
    }
  } catch (e) {
    failures++;
    console.log(`\n=== ${p.key} FAILED === ${e.message}`);
  }
  if (errors.length) failures++;
  if (errors.length) console.log(`  errors:`, errors.slice(0, 5));
  await context.close();
}
await browser.close();

process.exitCode = failures ? 1 : 0;
