import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {CHROMIUM_ARGS, playwright} from '../../glm5.3-flash复刻/src/kit/paths.mjs';

const SERIES = fileURLToPath(new URL('../../', import.meta.url));
const {chromium} = playwright();

const OUT = path.join(process.env.COMPARE_TMP || path.join(tmpdir(), 'oc8-compare'), 'badges');
fs.mkdirSync(OUT, {recursive: true});

const BADGES = [
  {id: 'b0', name: 'GLM 5.3-Flash',           a: '#3b82f6', b: '#1550c8', glow: '#3b82f6'},
  {id: 'b1', name: 'DeepSeek', a: '#9b6cff', b: '#5b21b6', glow: '#8b5cf6'},
  {id: 'b2', name: 'HY4',                     a: '#1a6ce8', b: '#08306e', glow: '#0f52ba'},
  {id: 'b3', name: '@0x_fokki',                a: '#ffa342', b: '#d95a06', glow: '#ff8a1f', tag: '原版'},
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background: transparent; }
  body { width: 900px; }
  .wrap { display: inline-block; padding: 24px; background: transparent; }
  .badge {
    display: inline-flex; align-items: center; gap: 15px;
    padding: 13px 26px 13px 17px;
    border-radius: 15px;
    background: linear-gradient(135deg, var(--a) 0%, var(--b) 100%);
    border: 2px solid rgba(255,255,255,.94);
    box-shadow: 0 0 0 5px rgba(255,255,255,.16), 0 0 34px var(--glow),
                0 12px 30px rgba(4,10,22,.55), inset 0 1px 0 rgba(255,255,255,.45);
    color: #fff;
    font: 800 31px/1.1 -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    letter-spacing: .4px;
    white-space: nowrap;
    text-shadow: 0 2px 7px rgba(0,0,0,.4);
  }
  .dot {
    width: 13px; height: 13px; border-radius: 50%;
    background: #fff; box-shadow: 0 0 12px #fff, 0 0 3px rgba(0,0,0,.3);
    flex: none;
  }
  .tag {
    font-size: 20px; font-weight: 800; letter-spacing: 1px;
    color: #7a3200; background: #fff; border-radius: 7px;
    padding: 5px 9px; line-height: 1;
    text-shadow: none; box-shadow: 0 2px 6px rgba(0,0,0,.25);
  }
  .row { padding: 4px 0 4px 0; }
</style></head><body>
${BADGES.map((x) => `<div class="row"><div class="wrap" id="${x.id}">
  <div class="badge" style="--a:${x.a};--b:${x.b};--glow:${x.glow}">
    <span class="dot"></span>${x.tag ? `<span class="tag">${x.tag}</span>` : ''}<span>${x.name}</span>
  </div>
</div></div>`).join('\n')}
</body></html>`;

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 900, height: 600}, deviceScaleFactor: 1});
await page.setContent(html, {waitUntil: 'load'});
await page.evaluate(() => document.fonts.ready);
for (const x of BADGES) {
  const el = page.locator(`#${x.id}`);
  const out = path.join(OUT, `${x.id}.png`);
  await el.screenshot({path: out, omitBackground: true});
  const {width, height} = await el.boundingBox();
  console.log(`✓ ${out}  ${Math.round(width)}×${Math.round(height)}  ${x.name}`);
}
await browser.close();
