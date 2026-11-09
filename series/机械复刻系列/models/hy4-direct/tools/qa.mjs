// qa.mjs —— 单文件离线 / 零网络 / 零报错 / 逐帧确定性 / 交互冒烟验收。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fromDeps, CHROMIUM_ARGS} from './deps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const {chromium} = fromDeps('playwright');

const DIR = path.join(ROOT, '../../hunyuan直出版/00-机械章鱼OC-8');
const FILES = ['机械章鱼OC-8-互动页.html', '机械章鱼OC-8-影片页.html'];
let pass = 0, fail = 0;
const ok = (c, n, d = '') => { c ? (pass++, console.log(`  ✓ ${n}${d ? '  ' + d : ''}`)) : (fail++, console.log(`  ✗ ${n}  ${d}`)); };

console.log('== 静态检查 ==');
for (const f of FILES) {
  const p = path.join(DIR, f), txt = fs.readFileSync(p, 'utf8');
  const kb = fs.statSync(p).size / 1024;
  ok(kb < 1024, `${f} < 1 MB`, `${kb.toFixed(0)} KB`);
  ok(!/<(?:script|link|img|video|source)[^>]+(?:src|href)\s*=\s*["']https?:/i.test(txt), `${f} 无外链资源`);
  ok(!/url\(\s*["']?https?:/i.test(txt), `${f} CSS 无外部 url()`);
  ok(/<html lang="zh-CN"/.test(txt) && /机械章鱼OC-8/.test(txt), `${f} 中文语言与标题`);
  ok(!/deepseek复刻|glm5\.3-flash复刻|hunyuan复刻/.test(txt), `${f} 无既有实现路径残留`);
}

console.log('== 浏览器运行时 ==');
const browser = await chromium.launch({
  headless: true,
  args: [...CHROMIUM_ARGS, '--run-all-compositor-stages-before-draw'],
});
for (const f of FILES) {
  const ctx = await browser.newContext({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
  const page = await ctx.newPage();
  const errors = [], requests = [];
  await ctx.route(/^https?:/, (route) => route.abort());
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith('file:')) requests.push(r.url()); });
  await page.goto(pathToFileURL(path.join(DIR, f)).href, {waitUntil: 'load', timeout: 60000});
  await page.waitForFunction(() => window.__sim && window.__sim.ready === true, null, {timeout: 60000});
  await page.evaluate(() => document.fonts.ready);
  ok(errors.length === 0, `${f} 加载零报错`, String(errors.length));
  ok(requests.length === 0, `${f} 零网络请求`, String(requests.length));
  const info = await page.evaluate(() => ({
    title: document.title,
    duration: window.SIM.duration,
    panel: document.querySelectorAll('.panel').length,
    chinese: /喷射压力/.test(document.querySelector('#hud').textContent)
      && /电源与姿态/.test(document.querySelector('#hud').textContent)
      && /子系统状态/.test(document.querySelector('#hud').textContent),
    same: JSON.stringify(window.SIM.stateAt(7.7)) === JSON.stringify(window.SIM.stateAt(7.7)),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent') || '',
  }));
  ok(/机械章鱼OC-8/.test(info.title), `${f} 标题中文`, info.title);
  ok(info.duration === 25, `${f} 时长 25 s`);
  ok(info.panel === 5, `${f} 五个独立面板`, String(info.panel));
  ok(info.chinese, `${f} HUD 全中文关键区块`);
  ok(info.same, `${f} 同一 t 状态一致`);

  // 逐帧渲染一整轮，检查全程不抛错
  for (let t = 0; t <= 25; t += 0.5) await page.evaluate((tt) => window.__sim.renderFrame(tt), t);
  ok(errors.length === 0, `${f} 逐帧渲染 51 帧零报错`, String(errors.length));

  // Re-enter t1 after t2: compare both renderer state and the actual page pixels.
  const first = await page.evaluate(() => window.__sim.renderFrame(7.7));
  const firstImage = await page.screenshot({animations: 'disabled'});
  await page.evaluate(() => window.__sim.renderFrame(21.5));
  const replay = await page.evaluate(() => window.__sim.renderFrame(7.7));
  const replayImage = await page.screenshot({animations: 'disabled'});
  ok(JSON.stringify(first) === JSON.stringify(replay), `${f} t1→t2→t1 状态一致`);
  ok(firstImage.equals(replayImage), `${f} 同环境回放像素一致`);

  if (f.includes('互动页')) {
    for (const cmd of ['play', 'assembly', 'display', 'reset', 'display']) {
      await page.evaluate((c) => document.querySelector(`[data-cmd="${c}"]`).click(), cmd);
    }
    ok(errors.length === 0, `${f} 五个按钮交互零报错`, String(errors.length));
  }
  ok(requests.length === 0, `${f} 全过程零网络请求`, String(requests.length));
  await ctx.close();
  if (errors.length) console.log('   ', errors.slice(0, 5).join('\n    '));
}
await browser.close();
console.log(`\n===== ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
