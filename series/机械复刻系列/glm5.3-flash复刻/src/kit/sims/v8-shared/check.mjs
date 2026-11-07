// check.mjs — V8 发动机模型数字断言。运行：node check.mjs（需与 kin.js 同目录，或用下面的路径）。
// 用法：node sims/v8-shared/check.mjs（从 kit/ 下）或复制到机器目录后 node check.mjs。
import {E, CYL, ORDER, FIRE, PIN_PHASE, psi, STROKES, volume, pressure, liftEx, liftIn, pistonFrac, chargeOf, bankXY, piston} from './kin.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};
const mod = (a, m) => ((a % m) + m) % m;

// ------------------------------------------------------------ 手算检验
console.log('hand-check: 行程与点火间隔');
console.log(`  行程 = 2r = 2 × ${E.r} = ${(2 * E.r).toFixed(1)} mm（console 标注 89 毫米）`);
console.log(`  点火间隔 = 720°/8 = ${720 / 8}°；V8 曲轴夹角 90°`);

// 1. 滑块曲柄两端点与行程
{
  let sMin = 1e9, sMax = -1e9;
  for (let th = 0; th < 720; th += 0.5) {
    const {s} = piston(0, th);
    sMin = Math.min(sMin, s);
    sMax = Math.max(sMax, s);
  }
  ok(Math.abs(sMax - sMin - 2 * E.r) < 1e-6, '活塞行程 = 2r = 89 mm', `${(sMax - sMin).toFixed(3)} mm`);
  ok(Math.abs(sMax - (E.r + E.rod)) < 1e-6, 'TDC 销距 = r + L', sMax.toFixed(2));
}

// 2. 点火顺序与间隔：FIRE 表每 90° 一个
{
  const vals = ORDER.map((c) => FIRE[c]);
  const sorted = [...vals].sort((a, b) => a - b);
  ok(sorted.every((v, i) => v === i * 90), 'FIRE 表 = 0..630 每 90°', sorted.join(','));
  ok(psi(1, 0) === 0, 'ψ(缸1, 0°) = 0（点火后相位）');
  ok(Math.abs(psi(8, 90) - 0) < 1e-9, '90° 时轮到缸 8 点火');
}

// 3. 曲柄销互成 90°
{
  const ph = [...PIN_PHASE].sort((a, b) => a - b);
  const gaps = ph.map((v, i) => mod(ph[(i + 1) % 4] - v, 360));
  ok(gaps.slice(0, 3).every((g) => Math.abs(g - 90) < 1e-9), '曲柄销相位互成 90°', gaps.join(','));
}

// 4. 容积比与缸压
{
  ok(Math.abs(volume(0) - 1) < 1e-9, 'V(0°) = 1 ×VC（上止点）');
  ok(Math.abs(volume(180) - E.cr) < 1e-6, `V(180°) = ${E.cr} ×VC（下止点）`);
  let pMax = 0;
  for (let ps = 0; ps < 720; ps += 0.25) pMax = Math.max(pMax, pressure(ps));
  ok(pMax > 45 && pMax < 62, '缸压峰值在 45–62 bar（console 满量程 60）', pMax.toFixed(1));
  ok(pressure(430) < 1.0, '进气冲程缸压 ≈ 0.9 bar', pressure(430).toFixed(2));
}

// 5. 气门窗口与升程
{
  ok(liftEx(260) > 0.9 && liftEx(100) === 0, '排气门在 140–380° 打开，100° 关闭', `liftEx(260)=${liftEx(260).toFixed(2)}`);
  ok(liftIn(460) > 0.9 && liftIn(300) === 0, '进气门在 340–580° 打开，300° 关闭', `liftIn(460)=${liftIn(460).toFixed(2)}`);
  ok(liftEx(360) > 0 && liftIn(360) > 0, '360° 附近气门重叠', `ex ${liftEx(360).toFixed(2)}, in ${liftIn(360).toFixed(2)}`);
}

// 6. 充量颜色键与冲程名对应（console 图例一致）
{
  ok(chargeOf(30) === 2 && chargeOf(200) === 3 && chargeOf(430) === 0 && chargeOf(600) === 1, '充量键：燃烧→排气→进气→压缩', '2/3/0/1 at 30/200/430/600');
  ok(STROKES.join('|') === 'POWER|EXHAUST|INTAKE|COMPRESSION', 'STROKES 顺序 = 做功/排气/进气/压缩（console 用 STROKE_CN 映射中文）');
}

// 7. 活塞位置分数：0° 上止点；90° 时 s = √(L²−r²)，滑块曲柄此时已过半程（手算 √(145²−44.5²)=137.99）
{
  const f0 = pistonFrac(0);
  const f90 = pistonFrac(90);
  const half = (E.r + E.rod - Math.sqrt(E.rod ** 2 - E.r ** 2)) / (2 * E.r);
  ok(Math.abs(f0) < 1e-9, 'pistonFrac: 0° 在上止点', f0.toFixed(4));
  ok(Math.abs(f90 - half) < 1e-6, 'pistonFrac: 90° = (r+L−√(L²−r²))/2r ≈ 0.579（滑块曲柄手算一致）', `${f90.toFixed(4)} vs ${half.toFixed(4)}`);
}

// 8. 缸位布置：奇数左列、偶数右列，1 缸在前
{
  ok(CYL.every((c) => (c.c % 2 === 1) === (c.bank === 'L')), '奇数缸在左列，偶数在右列');
  const [x1] = bankXY('L', 0, 0);
  ok(typeof x1 === 'number', 'bankXY 可用');
  ok(Math.abs(E.pinZ[0] - 168) < 1e-9 && Math.abs(E.pinZ[3] + 168) < 1e-9, '缸位 z：前 168 → 后 -168', E.pinZ.join(','));
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
