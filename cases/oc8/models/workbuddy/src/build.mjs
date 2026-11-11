// WorkBuddy 版 OC-8 · 构建：由互动页 + 巡览驱动生成 film.html
// 用法：node src/build.mjs（从本版本目录执行）
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(join(root, 'index.html'), 'utf-8');

const driver = `
<script>
/* ===== 自动巡览：25s 一轮，时间轴 0/3.5/7.5/10/12.5/14.5/16/18.5/21.5 ===== */
(function(){
  const q = id => document.getElementById(id);
  const badge = document.createElement('div');
  badge.textContent = 'FILM · AUTO TOUR 25s';
  badge.style.cssText = 'position:fixed;right:16px;bottom:14px;z-index:9;font-size:10px;letter-spacing:.2em;color:#e8541e;border:1px solid #e8541e;padding:4px 10px;border-radius:3px;background:rgba(251,249,244,.85)';
  document.body.appendChild(badge);

  const acts = [
    [3.5,  () => q('b-explode').onclick()],
    [7.5,  () => q('b-wire').onclick()],
    [12.5, () => q('b-wire').onclick()],
    [18.5, () => q('b-explode').onclick()],
  ];

  let ft = 0, last = performance.now();
  const fired = {};

  function frame(now){
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const prevLap = Math.floor(ft / 25);
    ft += dt;
    const curLap = Math.floor(ft / 25);
    const tt = ft % 25;
    if (curLap !== prevLap) for (const k in fired) delete fired[k];

    // 相机：连续环绕 + 特写段（14.5-18.5s）拉近抬角
    orbit.az = 0.85 + tt * 0.075;
    if (tt >= 14.5 && tt < 18.5) {
      orbit.r += (11 - orbit.r) * 0.03;
      orbit.el += (0.42 - orbit.el) * 0.03;
    } else {
      orbit.r += (25 - orbit.r) * 0.02;
      orbit.el += (0.18 - orbit.el) * 0.02;
    }

    for (const [t0, fn] of acts){
      const key = t0 + ':' + curLap;
      if (tt >= t0 && tt < t0 + 0.4 && !fired[key]){ fired[key] = 1; fn(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
</script>
</body>`;

const film = index
  .replace('<title>PELAGOS OC-8 · 机械章鱼复刻版</title>', '<title>PELAGOS OC-8 · 自动巡览</title>')
  .replace('</body>', driver);

writeFileSync(join(root, 'film.html'), film);
console.log('build: film.html generated from index.html + film driver');
