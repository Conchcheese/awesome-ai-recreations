// assets.mjs —— 生成正式交付静帧、十拍接触表、4:3 封面。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fromDeps, CHROMIUM_ARGS} from './deps.mjs';
import {SHOTS} from '../src/model.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const {chromium} = fromDeps('playwright');

const STILLS = path.join(ROOT, '', 'stills');
const COVERS = path.join(ROOT, 'covers');
fs.mkdirSync(STILLS, {recursive: true});
fs.mkdirSync(COVERS, {recursive: true});
const PAGE = path.join(ROOT, '', 'film.html');

const browser = await chromium.launch({
  headless: true,
  args: [...CHROMIUM_ARGS, '--run-all-compositor-stages-before-draw'],
});
const ctx = await browser.newContext({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
await page.goto(pathToFileURL(PAGE).href, {waitUntil: 'load', timeout: 60000});
await page.waitForFunction(() => window.__sim && window.__sim.ready === true, null, {timeout: 60000});
await page.evaluate(() => document.fonts.ready);

const shoot = async (t, out, {nohud = false, pose = null} = {}) => {
  await page.evaluate(({tt, nohud, pose}) => {
    document.querySelector('#hud').style.display = nohud ? 'none' : '';
    window.__sim.renderFrame(tt);
    if (pose) { window.__OC8.stage.setCamera(pose); window.__OC8.stage.render(); }
  }, {tt: t, nohud, pose});
  await page.waitForTimeout(50);
  await page.screenshot({path: out, type: 'jpeg', quality: 92});
  return out;
};

// 1. 十拍接触表用的十张带 HUD 静帧
const cards = [];
for (let i = 0; i < SHOTS.length; i++) {
  const s = SHOTS[i];
  const t = Math.min(24.6, s.at + 0.45);
  const name = `静帧-${String(i + 1).padStart(2, '0')}-${s.name}.jpg`;
  const p = path.join(STILLS, name);
  await shoot(t, p);
  cards.push({name: s.name, t, data: 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64')});
  console.log(`✓ ${name}`);
}

// 2. 光影静帧（无 HUD）与关节微距
await shoot(0, path.join(STILLS, '光影-主机位-无HUD.jpg'), {nohud: true});
await shoot(8.2, path.join(STILLS, '光影-外套膜打开-无HUD.jpg'), {nohud: true});
await shoot(21.5, path.join(STILLS, '光影-整机分解-无HUD.jpg'), {nohud: true});
await shoot(10.4, path.join(STILLS, '光影-R2腕关节微距-无HUD.jpg'), {nohud: true});
console.log('✓ 光影 4 张（含 R2 腕近景）');

// 3. 十拍接触表
const sheetHtml = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:2000px;background:#0a1a32;font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#dcecff}
header{padding:26px 34px 18px;font-size:40px;font-weight:800;letter-spacing:.04em}
header em{font-style:normal;font-size:26px;color:#8fb4e9;font-weight:500;margin-left:18px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;padding:0 26px 26px}
.cell{background:#102547;border:1px solid #2c5590;border-radius:10px;overflow:hidden}
.cell img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.cell div{padding:10px 12px;font-size:24px;line-height:1.35}
.cell span{color:#8fb4e9;font-size:21px;margin-right:10px}
</style><body><header>00 机械章鱼 OC-8 · 十拍巡览接触表<em>HY4 独立直出版 · 中文界面 · 宝石蓝 #0F52BA</em></header>
<div class="grid">${cards.map((c, i) => `<div class="cell"><img src="${c.data}"><div><span>${String(i + 1).padStart(2, '0')} / ${c.t.toFixed(2)}s</span>${c.name}</div></div>`).join('')}</div></body></html>`;
const sheetPage = await ctx.newPage();
await sheetPage.setViewportSize({width: 2000, height: 1});
await sheetPage.setContent(sheetHtml, {waitUntil: 'load'});
await sheetPage.screenshot({path: path.join(STILLS, '总览-十拍接触表.jpg'), type: 'jpeg', quality: 90, fullPage: true});
await sheetPage.close();
console.log('✓ 总览-十拍接触表.jpg');

// 4. 4:3 封面
const hero = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(STILLS, '光影-外套膜打开-无HUD.jpg')).toString('base64');
const hero2 = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(STILLS, '光影-R2腕关节微距-无HUD.jpg')).toString('base64');
const coverHtml = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1600px;height:1200px;overflow:hidden;position:relative;
 font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#fff;background:#0a1a32}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92}
.veil{position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,20,44,.96) 0%,rgba(6,20,44,.86) 40%,rgba(6,20,44,.12) 78%)}
.bar{position:absolute;left:0;top:0;width:100%;height:14px;background:linear-gradient(90deg,#4a86e8,#0f52ba,#0a357a)}
.box{position:absolute;left:88px;top:170px;width:1000px}
.kick{display:inline-block;font-size:30px;letter-spacing:.22em;color:#9fc0ef;border:2px solid #4a86e8;padding:8px 20px;border-radius:8px}
h1{font-size:118px;line-height:1.12;font-weight:800;margin-top:42px;letter-spacing:.02em;text-shadow:0 8px 40px rgba(0,0,0,.5)}
h1 b{color:#6fa4ff}
h2{font-size:46px;font-weight:500;color:#cfe2ff;margin-top:22px;letter-spacing:.08em}
.desc{font-size:29px;color:#a9c8f2;line-height:1.85;margin-top:52px;max-width:960px}
.tags{margin-top:56px;display:flex;gap:16px;flex-wrap:wrap}
.tag{font-size:27px;padding:9px 22px;border-radius:999px;background:rgba(15,82,186,.42);border:1px solid #4a86e8}
.foot{position:absolute;left:88px;bottom:78px;font-size:27px;color:#8fb4e9;letter-spacing:.05em}
.thumb{position:absolute;right:70px;bottom:70px;width:430px;border:4px solid rgba(138,180,255,.75);border-radius:12px;overflow:hidden;
 box-shadow:0 20px 60px rgba(0,0,0,.5)}
.thumb img{display:block;width:100%}
.thumb div{background:rgba(8,24,50,.94);font-size:23px;padding:10px 16px;color:#cfe2ff;white-space:nowrap}
</style><body><img class="bg" src="${hero}"><div class="veil"></div><div class="bar"></div>
<div class="box"><div class="kick">MECHANICAL RECREATION · 00</div>
<h1>机械章鱼 <b>OC-8</b></h1>
<h2>HY4 独立直出版 · 从原作参考帧直出</h2>
<div class="desc">八腕 × 25 节机加工装配体 · 480 只辐条滚轮 · 1200 颗铆钉<br>
单一时间输入 t 的确定性模拟器，全中文控制台，宝石蓝 #0F52BA</div>
<div class="tags"><span class="tag">单文件离线 HTML</span><span class="tag">25 s / 10 拍巡览</span><span class="tag">逐帧可复现</span></div></div>
<div class="thumb"><img src="${hero2}"><div>R2 腕关节微距 · 法兰 / 波纹节 / 液压微缸</div></div>
<div class="foot">awesome-ai-recreations · 机械复刻系列 · 依据方法论 A.4 / B 硬规则实现</div></body></html>`;
const coverPage = await ctx.newPage();
await coverPage.setViewportSize({width: 1600, height: 1200});
await coverPage.setContent(coverHtml, {waitUntil: 'load'});
await coverPage.screenshot({path: path.join(COVERS, '封面-HY4独立直出版.jpg'), type: 'jpeg', quality: 93});
await coverPage.close();
console.log('✓ 封面-HY4独立直出版.jpg');

console.log(`页面报错：${errors.length}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
