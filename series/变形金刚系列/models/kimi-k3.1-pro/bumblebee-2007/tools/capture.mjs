import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'artifacts/qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const url = (name) => pathToFileURL(path.join(root, name)).href;
await page.goto(url('index.html'));
await page.waitForFunction(() => window.__BUMBLEBEE__?.ready);
await page.waitForTimeout(600);

const state = await page.evaluate(() => window.__BUMBLEBEE__.getState());
if (state.parts !== 47 || state.model !== 'Kimi-K3.1-Pro') throw new Error(`bad model state ${JSON.stringify(state)}`);
await page.evaluate(() => { window.__BUMBLEBEE__.setTransform(1); window.__BUMBLEBEE__.setView('hero'); });
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(output, '大黄蜂-人形.png') });
await page.evaluate(() => { window.__BUMBLEBEE__.setTransform(0); window.__BUMBLEBEE__.setView('hero'); });
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(output, '大黄蜂-车辆.png') });
await page.evaluate(() => { window.__BUMBLEBEE__.setTransform(0.52); window.__BUMBLEBEE__.setView('hero'); });
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(output, '大黄蜂-变形中段.png') });
await page.evaluate(() => { window.__BUMBLEBEE__.setTransform(1); window.__BUMBLEBEE__.setExplode(0.72); window.__BUMBLEBEE__.setView('hero'); });
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(output, '大黄蜂-分层展开.png') });
await page.evaluate(() => window.__BUMBLEBEE__.setExplode(0));

await page.click('[data-mode="0"]');
await page.waitForFunction(() => window.__BUMBLEBEE__.getState().transform < 0.99, null, { timeout: 8000 });
const playingState = await page.evaluate(() => window.__BUMBLEBEE__.getState().transform);
if (playingState >= 0.99) throw new Error('animation should progress from the initial pose');
await page.click('#pause-btn');
await page.click('#gray');
if (!(await page.evaluate(() => window.__BUMBLEBEE__.getState().gray))) throw new Error('gray mode did not activate');
await page.click('#gray');
await page.locator('#transform').evaluate((el) => { el.value = '500'; el.dispatchEvent(new Event('input', { bubbles: true })); });
const midway = await page.evaluate(() => window.__BUMBLEBEE__.getState().transform);
if (Math.abs(midway - 0.5) > 0.001) throw new Error('transform slider failed');

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => { window.__BUMBLEBEE__.setTransform(1); window.__BUMBLEBEE__.setView('hero'); });
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(output, '大黄蜂-移动端.png') });

const film = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
film.on('pageerror', (e) => errors.push(e.message));
await film.goto(`${url('film.html')}?clean=1&t=10.2`);
await film.waitForFunction(() => window.__BUMBLEBEE__?.ready);
await film.waitForTimeout(500);
const filmState = await film.evaluate(() => window.__BUMBLEBEE__.getState());
if (filmState.transform !== 1 || filmState.parts !== 47) throw new Error('film state mismatch');
await film.screenshot({ path: path.join(output, '大黄蜂-电影巡览.png') });

const report = {
  date: new Date().toISOString(), model: 'Kimi-K3.1-Pro', engine: 'Chromium / Playwright',
  checks: ['offline file URL', '47 assembly modules', 'vehicle and robot endpoints', 'continuous control', 'gray material toggle', 'mobile viewport', 'film deterministic seek'],
  errors, screenshots: 6
};
await writeFile(path.join(output, 'browser-qa.json'), JSON.stringify(report, null, 2));
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
console.log('PASS: browser QA and 6 screenshots; no page errors');
