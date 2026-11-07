// 浏览器 QA：真实 Chromium 渲染断言（回放一致性/身份恒定/交互/小屏/无控制台错误）
import { dep, root } from './deps.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const { chromium } = await dep('playwright');
const browser = await chromium.launch({
  headless: true,
  channel: process.platform === 'darwin' ? 'chromium' : undefined,
  args: ['--allow-file-access-from-files', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : ['--enable-unsafe-swiftshader'])],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGE EXCEPTION', String(e)); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('PAGE ERROR', m.text()); } });
await fs.mkdir(path.join(root, 'artifacts/qa'), { recursive: true });
await fs.writeFile(path.join(root, 'artifacts/qa/report.json'), JSON.stringify({ result: 'running' }));
try {
const waitForReady = async (url) => {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url);
      await page.waitForFunction(() => window.study?.ready, { timeout: 20000 });
      return;
    } catch (e) {
      if (i === 2) throw e;
      console.log('retry load', String(e).split('\n')[0]);
    }
  }
};
  await waitForReady(pathToFileURL(path.join(root, 'index.html')).href + '?capture');
  await page.evaluate(() => study.setFilm(true));
  // 影片时间轴节拍截图（两页共用渲染路径）
  for (const [name, t] of [['film-truck', 2], ['film-detail', 7], ['film-transform-25', 12.75], ['film-transform-50', 16.5], ['film-transform-75', 20.25], ['film-hero', 27], ['film-head', 30.5], ['film-arm', 35], ['film-legs', 39], ['film-explode', 43.5], ['film-final', 49]]) {
    await page.evaluate((t) => study.renderAt(t), t);
    await page.screenshot({ path: path.join(root, `artifacts/qa/${name}.jpg`), type: 'jpeg', quality: 90 });
  }
  // 回放一致性：t1→t2→t1 整页截图与姿态快照一致
  const first = await page.evaluate(() => { study.renderAt(16.5); return study.snapshot(); });
  const a = await page.screenshot();
  await page.evaluate(() => study.renderAt(35));
  await page.evaluate(() => study.renderAt(16.5));
  const b = await page.screenshot();
  const second = await page.evaluate(() => study.snapshot());
  assert.deepEqual(first, second, '全模型姿态 t1→t2→t1');
  assert(a.equals(b), '整页截图重入一致');
  const identities = await page.evaluate(() => {
    const ids = [];
    for (const t of [0, 6, 12.75, 24, 49]) { study.renderAt(t); ids.push(study.snapshot().map((x) => x.id).join('|')); }
    return ids;
  });
  assert(identities.every((x) => x === identities[0]), '所有镜头保留同一批装配');
  // 交互页模式
  await page.evaluate(() => study.setFilm(false));
  await page.evaluate(() => study.setCamera('three'));
  await page.evaluate(() => study.setProgress(0));
  await page.evaluate(() => study.setGray(true));
  await page.screenshot({ path: path.join(root, 'artifacts/qa/gray-truck.jpg'), type: 'jpeg', quality: 92 });
  for (const [name, t] of [['gray-25', 0.25], ['gray-50', 0.5], ['gray-75', 0.75]]) {
    await page.evaluate((t) => { study.setGray(true); study.setProgress(t); }, t);
    await page.screenshot({ path: path.join(root, `artifacts/qa/${name}.jpg`), type: 'jpeg', quality: 92 });
  }
  await page.evaluate(() => { study.setGray(false); study.setProgress(1); });
  await page.screenshot({ path: path.join(root, 'artifacts/qa/robot-front.jpg'), type: 'jpeg', quality: 92 });
  await page.evaluate(() => study.setCamera('side'));
  await page.screenshot({ path: path.join(root, 'artifacts/qa/robot-side.jpg'), type: 'jpeg', quality: 92 });
  await page.evaluate(() => study.setCamera('back'));
  await page.screenshot({ path: path.join(root, 'artifacts/qa/robot-back.jpg'), type: 'jpeg', quality: 92 });
  // 按钮交互
  let truck = await page.evaluate(() => { study.setProgress(0); return study.bounds(); });
  const tires = await page.evaluate(() => study.snapshot().filter((x) => x.id.startsWith('wheel_')).length);
  assert.equal(tires, 6, '卡车态六轮');
  const robot = await page.evaluate(() => { study.setProgress(1); return study.bounds(); });
  await page.getByRole('button', { name: '研究模式', exact: false }).click();
  await page.getByRole('button', { name: '关节轴', exact: true }).click();
  await page.getByRole('button', { name: '拆分查看', exact: true }).click();
  await page.screenshot({ path: path.join(root, 'artifacts/qa/research.jpg'), type: 'jpeg', quality: 90 });
  await page.getByRole('button', { name: '收拢拆解', exact: true }).click();
  await page.getByRole('button', { name: '关节轴', exact: true }).click();
  await page.locator('#timeline').fill('5');
  await page.locator('#timeline').dispatchEvent('input');
  assert.equal(await page.locator('#timeline').inputValue(), '5', '时间线输入');
  // 小屏
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '研究模式', exact: false }).click();
  await page.getByRole('button', { name: '人形', exact: true }).click();
  await page.screenshot({ path: path.join(root, 'artifacts/qa/mobile.jpg'), type: 'jpeg', quality: 90 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '小屏无横向溢出');
  // 真实播放推进与暂停（独立新页面，避免长会话上下文问题）
  const page2 = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page2.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGE EXCEPTION', String(e)); });
  page2.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('PAGE ERROR', m.text()); } });
  await page2.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page2.waitForFunction(() => window.study?.ready, { timeout: 20000 });
  await page2.locator('#play').click();
  await page2.waitForFunction(() => Number(document.querySelector('#timeline').value) > 0.15, { timeout: 20000 });
  await page2.locator('#play').click();
  const paused = await page2.locator('#timeline').inputValue();
  await page2.waitForTimeout(150);
  assert.equal(await page2.locator('#timeline').inputValue(), paused, '播放推进且暂停后不变');
  await page2.close();
  // 影片页就绪与首帧
  await waitForReady(pathToFileURL(path.join(root, 'film.html')).href);
  await page.screenshot({ path: path.join(root, 'artifacts/qa/film-page.jpg'), type: 'jpeg', quality: 90 });
  assert.equal(errors.length, 0, errors.join('\n'));
  const report = {
    date: new Date().toISOString(), result: 'passed',
    robotBounds: robot, truckBounds: truck,
    reentrantScreenshot: true, samePartIdentity: true, tireCount: 6,
    mobileNoOverflow: true, playbackAdvancesAndPauses: true, consoleErrors: errors,
    limits: ['不验证真实机构碰撞', '未完成原片同机位轮廓误差量化', '截图需人工视觉复查'],
  };
  await fs.writeFile(path.join(root, 'artifacts/qa/report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await fs.writeFile(path.join(root, 'artifacts/qa/report.json'), JSON.stringify({ result: 'failed', error: String(error), consoleErrors: errors }, null, 2));
  throw error;
} finally {
  await browser.close();
}
