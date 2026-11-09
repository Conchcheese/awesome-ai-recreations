import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'artifacts'); await mkdir(artifacts, { recursive: true });
const fps = 24, duration = 20, frames = fps * duration;
await new Promise((resolve, reject) => {
  const p = spawn('python3', [path.join(root, 'tools/sound.py')], { stdio: 'inherit' });
  p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`sound generator exited ${code}`)));
});
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const filmUrl = `${pathToFileURL(path.join(root, 'film.html')).href}?clean=1&t=0`;
await page.goto(filmUrl); await page.waitForFunction(() => window.__BUMBLEBEE__?.ready); await page.waitForTimeout(500);
const output = path.join(artifacts, '大黄蜂-2007-Kimi-K3.1-Pro.mp4');
const args = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-i', path.join(artifacts, '大黄蜂-原创音轨.wav'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), '-movflags', '+faststart', output];
const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
let ffmpegLog = ''; ffmpeg.stderr.on('data', (d) => { ffmpegLog += d.toString(); });
const done = new Promise((resolve, reject) => { ffmpeg.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${ffmpegLog}`))); });
for (let frame = 0; frame < frames; frame++) {
  await page.evaluate((t) => window.__BUMBLEBEE__.setTime(t), frame / fps);
  const png = await page.screenshot({ type: 'png' });
  if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, 'drain');
  if (frame % 48 === 0) console.log(`render ${frame}/${frames}`);
}
ffmpeg.stdin.end(); await done; await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
const report = { model: 'Kimi-K3.1-Pro', source: 'film.html deterministic window.__BUMBLEBEE__.setTime', fps, frames, duration, width: 1280, height: 720, audio: 'original procedural stereo, 48 kHz', output: path.basename(output), pageErrors: errors };
await writeFile(path.join(artifacts, 'render-log.json'), JSON.stringify(report, null, 2));
console.log(output);
