#!/usr/bin/env node
// 交付页验收：检查报错、网络请求、交互按钮与逐帧调用；截图请用 shot.mjs。
//
//   node qa.mjs 00                 # 检查两页
//   node qa.mjs 00 --t=0,8,16       # 指定影片页测试时刻
//   node qa.mjs all
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

const targets = positional.length ? positional : ['all'];
const picked = CONFIG.machines.filter((m) => targets.some((t) => t === 'all' || m.key === t || m.dir.startsWith(t)));

if (!picked.length) throw new Error('没有匹配案例，请使用 all 或机器编号');

const browser = await chromium.launch({
  headless: true,
  args: [...(process.platform === 'darwin' ? ['--use-angle=metal'] : process.platform === 'win32' ? ['--use-angle=d3d11'] : []), '--force_high_performance_gpu', '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization', '--enable-webgl', '--hide-scrollbars'],
});

let failures = 0;
const report = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failures++;
};

for (const m of picked) {
  for (const mode of ['live', 'film']) {
    const label = mode === 'live' ? '互动页' : '影片页';
    const file = path.join(OUT_ROOT, label === '互动页' ? 'index.html' : 'film.html');
    console.log(`\n== ${m.cn} · ${label} ==`);
    if (!fs.existsSync(file)) {
      report(false, `缺少文件 ${file}`);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    report(!/(src|href)\s*=\s*["']https?:/i.test(html), '无外部 src/href 引用');
    report(!/url\(\s*['"]?https?:/i.test(html), 'CSS 无外部 url()');

    const context = await browser.newContext({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1.2});
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
    page.on('request', (r) => { if (!r.url().startsWith('file://')) requests.push(r.url()); });

    try {
      await page.goto(pathToFileURL(file).href, {waitUntil: 'load', timeout: 60000});
      await page.waitForFunction(() => window.__sim && window.__sim.ready === true, null, {timeout: 60000});
      report(true, '页面加载且 ready');
      report(errors.length === 0, `页面零报错（${errors.length}）`);
      report(requests.length === 0, `零网络请求（${requests.length}）`);
      if (requests.length) console.log('   ', requests.slice(0, 5).join('\n    '));

      const info = await page.evaluate(() => ({
        title: document.title,
        duration: window.__sim.duration,
        canvas: !!document.querySelector('canvas#gl'),
        hud: !!document.querySelector('.hud'),
        panels: document.querySelectorAll('.panel').length,
        buttons: document.querySelectorAll('.btn').length,
        beat: (document.querySelector('.beat h1') || {}).textContent || '',
        w: document.querySelector('canvas#gl') ? document.querySelector('canvas#gl').width : 0,
      }));
      report(/·/.test(info.title), `标题中文：${info.title}`);
      report(info.canvas && info.hud, 'canvas + HUD 存在');
      report(info.panels >= 5, `面板数 ${info.panels}`);
      report(info.buttons >= 4, `按钮数 ${info.buttons}`);
      report(Number(info.duration) >= 20, `时长 ${info.duration}s`);

      if (mode === 'live') {
        // 交互：拖拽环绕
        await page.mouse.move(800, 450);
        await page.mouse.down();
        await page.mouse.move(950, 500, {steps: 8});
        await page.mouse.up();
        await page.waitForTimeout(120);
        // 逐个别点按钮（跳过滑杆）
        const btnCount = await page.locator('.btn').count();
        for (let i = 0; i < btnCount; i++) {
          const b = page.locator('.btn').nth(i);
          if (await b.isVisible().catch(() => false)) {
            await b.click({timeout: 2000, force: true}).catch(() => {});
            await page.waitForTimeout(40);
          }
        }
        await page.waitForTimeout(150);
        report(errors.length === 0, `交互后零报错（${errors.length}）`);
        // 拖进度条
        const track = page.locator('.ops-track').first();
        if (await track.count()) {
          const box = await track.boundingBox();
          if (box) { await page.mouse.click(box.x + box.width * 0.7, box.y + box.height / 2); }
          await page.waitForTimeout(120);
        }
      } else {
        const beats = flags.t ? String(flags.t).split(',').map(Number) : [0, Number(info.duration) * 0.4];
        for (const t of beats) {
          await page.evaluate((tt) => window.__sim.renderFrame(tt), t);
          await page.waitForTimeout(80);
        }
        report(errors.length === 0, `逐帧渲染后零报错（${errors.length}）`);
      }
    } catch (err) {
      report(false, '运行异常：' + err.message);
    }
    await context.close();
  }
}

await browser.close();
console.log(`\n===== ${failures === 0 ? '全部通过 ✓' : failures + ' 项失败 ✗'} =====`);
process.exit(failures ? 1 : 0);
