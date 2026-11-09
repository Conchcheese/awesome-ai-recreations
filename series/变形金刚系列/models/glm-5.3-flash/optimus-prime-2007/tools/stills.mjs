// 静帧生成：灰模同机位五态和彩色关键帧，接触表由 Python 合成。
import { dep, root } from './deps.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const { chromium } = await dep('playwright');
const browser = await chromium.launch({
  headless: true,
  channel: process.platform === 'darwin' ? 'chromium' : undefined,
  args: ['--allow-file-access-from-files', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : ['--enable-unsafe-swiftshader'])],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const tmp = path.join(root, 'artifacts/stills');
await fs.mkdir(tmp, { recursive: true });
await fs.mkdir(path.join(root, 'stills'), { recursive: true });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?capture');
await page.waitForFunction(() => window.study?.ready, { timeout: 30000 });

const shots = [
  // 灰模五态（同机位：¾ 视角，spec §4）
  ['gray-truck', () => study.setGray(true), 0],
  ['gray-25', null, 0.25],
  ['gray-50', null, 0.5],
  ['gray-75', null, 0.75],
  ['gray-robot', null, 1],
  // 彩色关键帧
  ['color-truck', () => study.setGray(false), 0],
  ['color-50', null, 0.5],
  ['color-robot', null, 1],
  ['color-explode', () => study.setExplode(1), 1],
  ['color-reassemble', () => study.setExplode(0), 1],
];
for (const [name, pre, t] of shots) {
  await page.evaluate(() => { study.setCamera('three'); study.setExplode(0); study.setProgress(0); });
  if (pre) await page.evaluate(pre);
  await page.evaluate((t) => study.setProgress(t), t);
  await page.screenshot({ path: path.join(tmp, `${name}.png`), type: 'png' });
  console.log('shot', name);
}
// 影片页头胸特写（灰模外）
await page.evaluate(() => study.setFilm(true));
await page.evaluate(() => study.renderAt(29.5));
await page.screenshot({ path: path.join(tmp, 'color-head.png'), type: 'png' });
await browser.close();

// 接触表（灰模五态，横向拼接 + 时间标签底色条）
const py = `
import sys
from PIL import Image, ImageDraw
import os
root = sys.argv[1]
names = ["gray-truck", "gray-25", "gray-50", "gray-75", "gray-robot"]
labels = ["t=0.00 卡车", "t=0.25", "t=0.50", "t=0.75", "t=1.00 人形"]
imgs = [Image.open(os.path.join(root, "artifacts/stills", n + ".png")).resize((512, 320)) for n in names]
W, H = 512, 320
sheet = Image.new("RGB", (W * len(imgs), H + 34), "#0b0e13")
d = ImageDraw.Draw(sheet)
for i, im in enumerate(imgs):
    sheet.paste(im, (i * W, 0))
    d.rectangle([i * W, H, (i + 1) * W, H + 34], fill="#141a22")
    d.text((i * W + 14, H + 9), labels[i], fill="#cfd6dd")
sheet.save(os.path.join(root, "stills", "灰模五态接触表.jpg"), quality=90)
# 彩色关键帧接触表
names2 = ["color-truck", "color-50", "color-robot", "color-head"]
labels2 = ["t=0.00 卡车形态", "t=0.50 变形中段", "t=1.00 人形形态", "影片 29.5s 头胸特写"]
imgs2 = [Image.open(os.path.join(root, "artifacts/stills", n + ".png")).resize((512, 320)) for n in names2]
sheet2 = Image.new("RGB", (W * len(imgs2), H + 34), "#0b0e13")
d2 = ImageDraw.Draw(sheet2)
for i, im in enumerate(imgs2):
    sheet2.paste(im, (i * W, 0))
    d2.rectangle([i * W, H, (i + 1) * W, H + 34], fill="#141a22")
    d2.text((i * W + 14, H + 9), labels2[i], fill="#cfd6dd")
sheet2.save(os.path.join(root, "stills", "关键帧接触表.jpg"), quality=90)
# 封面：人形
hero = Image.open(os.path.join(root, "artifacts/stills/color-robot.png"))
hero.save(os.path.join(root, "stills", "hero.jpg"), quality=88)
truck = Image.open(os.path.join(root, "artifacts/stills/color-truck.png"))
truck.save(os.path.join(root, "stills", "truck.jpg"), quality=88)
print("stills ok")
`;
execFileSync('python3', ['-I', '-c', py, root], { stdio: 'inherit' });
console.log('静帧与接触表已生成 stills/');
