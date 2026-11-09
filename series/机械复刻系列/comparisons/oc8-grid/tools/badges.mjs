// 四宫格 4K 版高亮铭牌：相对 720p 纵向版整体放大 1.5×，
// 让每格 1920×1080 里的右上角模型名醒目且不遮挡主体。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {CHROMIUM_ARGS, playwright} from '../../../models/glm-5.3-flash/src/kit/paths.mjs';

const SERIES = fileURLToPath(new URL('../../../', import.meta.url));
const {chromium} = playwright();

const OUT = path.join(process.env.COMPARE_TMP || path.join(tmpdir(), 'oc8-grid'), 'badges');
fs.mkdirSync(OUT, {recursive: true});

const BADGES = [
  {id: 'b0', name: 'GLM 5.3-Flash',            a: '#3b82f6', b: '#1550c8', glow: '#3b82f6'},
  {id: 'b1', name: 'DeepSeek', a: '#9b6cff', b: '#5b21b6', glow: '#8b5cf6'},
  {id: 'b2', name: 'HY4',                      a: '#1a6ce8', b: '#08306e', glow: '#0f52ba', tag: '直出'},
  {id: 'b3', name: '@0x_fokki',                 a: '#ffa342', b: '#d95a06', glow: '#ff8a1f', tag: '原版'},
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background: transparent; }
  body { width: 1400px; }
  .wrap { display: inline-block; padding: 36px; background: transparent; }
  .badge {
    display: inline-flex; align-items: center; gap: 22px;
    padding: 20px 39px 20px 26px;
    border-radius: 22px;
    background: linear-gradient(135deg, var(--a) 0%, var(--b) 100%);
    border: 3px solid rgba(255,255,255,.96);
    box-shadow: 0 0 0 8px rgba(255,255,255,.16), 0 0 52px var(--glow),
                0 18px 45px rgba(4,10,22,.60), inset 0 1px 0 rgba(255,255,255,.5);
    color: #fff;
    font: 800 47px/1.1 -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    letter-spacing: .4px;
    white-space: nowrap;
    text-shadow: 0 3px 10px rgba(0,0,0,.45);
  }
  .dot { width: 20px; height: 20px; border-radius: 50%; background: #fff;
         box-shadow: 0 0 18px #fff, 0 0 4px rgba(0,0,0,.3); flex: none; }
  .tag { font-size: 30px; font-weight: 800; letter-spacing: 2px;
         color: #123a78; background: #fff; border-radius: 11px;
         padding: 7px 14px; line-height: 1;
         text-shadow: none; box-shadow: 0 3px 9px rgba(0,0,0,.28); }
  .row { padding: 6px 0; }
</style></head><body>
${BADGES.map((x) => `<div class="row"><div class="wrap" id="${x.id}">
  <div class="badge" style="--a:${x.a};--b:${x.b};--glow:${x.glow}">
    <span class="dot"></span>${x.tag ? `<span class="tag">${x.tag}</span>` : ''}<span>${x.name}</span>
  </div>
</div></div>`).join('\n')}
</body></html>`;

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1400, height: 900}, deviceScaleFactor: 1});
await page.setContent(html, {waitUntil: 'load'});
await page.evaluate(() => document.fonts.ready);
for (const x of BADGES) {
  const el = page.locator(`#${x.id}`);
  const out = path.join(OUT, `${x.id}.png`);
  await el.screenshot({path: out, omitBackground: true});
  const {width, height} = await el.boundingBox();
  console.log(`✓ ${x.id}.png  ${Math.round(width)}×${Math.round(height)}  ${x.name}`);
}
await browser.close();
