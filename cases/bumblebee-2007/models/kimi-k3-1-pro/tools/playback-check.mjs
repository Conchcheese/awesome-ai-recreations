import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
const result = await page.evaluate(async () => {
  const video = document.createElement('video');
  video.src = 'artifacts/大黄蜂-2007-Kimi-K3.1-Pro.mp4';
  video.preload = 'auto'; video.muted = true;
  document.body.appendChild(video);
  await new Promise((resolve, reject) => { video.oncanplay = resolve; video.onerror = () => reject(new Error('video load failed')); });
  await video.play();
  const started = performance.now();
  await new Promise((resolve, reject) => {
    video.onended = resolve;
    video.onerror = () => reject(new Error('video playback failed'));
    setTimeout(() => reject(new Error('playback timeout')), 26000);
  });
  return { ended: video.ended, duration: video.duration, currentTime: video.currentTime, wallSeconds: (performance.now() - started) / 1000, error: video.error?.message || null };
});
await browser.close();
await writeFile(path.join(root, 'artifacts/playback-check.json'), JSON.stringify(result, null, 2));
console.log(result);
if (!result.ended || Math.abs(result.duration - 20) > 0.05) throw new Error('full playback check failed');
