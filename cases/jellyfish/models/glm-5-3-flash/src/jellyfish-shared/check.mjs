// check.mjs —— 按任务要求断言模型数字：`node sims/jellyfish-shared/check.mjs`。
import {
  G, NOZZLE_A, THRUST_PEAK, SEG_TOTAL, TENT_STEP,
  pulse, flap, pressureKPa, thrustN, speed, bellBreath, petalWave, petalAngle, skirtDent,
  tentSway, tentTilt, tentacleChain, pumpState, pistonStroke, drawW,
} from './model.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};

// ------------------------------------------------------------ 手算，展示
console.log('手算：喷口面积与推力峰');
console.log(`  A = π·(${G.NOZZLE_D}/2)² = ${NOZZLE_A.toExponential(4)} m²`);
console.log(`  T = 2·ΔP·A = 2·${G.PEAK_KPA}e3·${NOZZLE_A.toExponential(4)} = ${THRUST_PEAK.toFixed(2)} N  （面板峰读数 ≈33 N）`);

// 1. 手算：推力峰与 T = 2·ΔP·A 一致（±1 N），且等于 33.25 N
const pPeak = 0.35;
ok(Math.abs(pulse(pPeak) - 1) < 1e-9, '脉动峰在 p = 0.35');
ok(Math.abs(pressureKPa(pPeak) - G.PEAK_KPA) < 1e-9, `钟腔压力峰 = ${G.PEAK_KPA} kPa`, pressureKPa(pPeak).toFixed(2));
const fl = flap(pPeak);
ok(Math.abs(fl - 1) < 1e-6, '喷口 4 瓣在脉动峰处全开', fl.toFixed(4));
ok(Math.abs(thrustN(pPeak) - 33.25) <= 1, '推力峰与手算 33.25 N 一致（±1 N）', thrustN(pPeak).toFixed(2) + ' N');

// 2. 脉动相位关系：瓣 1 的收缩量 = 瓣 0 的收缩量滞后 PETAL_LAG
{
  let worst = 0;
  for (let i = 0; i < 40; i++) {
    const p = i / 40;
    const a = petalWave(0, p - G.PETAL_LAG);
    const b = petalWave(1, p);
    worst = Math.max(worst, Math.abs(a - b));
  }
  ok(worst < 1e-9, '瓣 1 收缩量 = 瓣 0 收缩量滞后 PETAL_LAG', `worst Δ ${worst.toExponential(2)}`);
}

// 3. 相邻触须相位差：须 2 的摆角 = 须 1 的摆角滞后 1/5 周期
{
  let worst = 0;
  for (let i = 0; i < 40; i++) {
    const p = i / 40;
    for (const j of [0, 5, 12, 21]) {
      const a = tentSway(1, j, p - TENT_STEP);
      const b = tentSway(2, j, p);
      worst = Math.max(worst, Math.abs(a - b));
    }
  }
  ok(worst < 1e-9, '相邻触须相位差恰为 1/5 周期（5 条须错相）', `worst Δ ${worst.toExponential(2)}`);
}

// 4. 链节几何：每节累计摆角单调有界，链末端不高于挂点（触须下垂）
{
  const pts = new Float64Array((G.SEG_PER_T + 1) * 3);
  const ang = new Float64Array(G.SEG_PER_T + 1);
  let minDy = 9;
  let maxTh = 0;
  for (const i of [0, 2, 4]) {
    for (const p of [0, 0.2, 0.35, 0.6, 0.9]) {
      tentacleChain(0.3, i, p, pts, ang);
      const dy = pts[1] - pts[G.SEG_PER_T * 3 + 1];
      minDy = Math.min(minDy, dy);
      maxTh = Math.max(maxTh, ang[G.SEG_PER_T]);
    }
  }
  ok(minDy > G.SEG_PER_T * G.SEG_LEN * 0.55, '触须链始终下垂（末端低于挂点半程以上）', `min 垂距 ${minDy.toFixed(3)} m`);
  ok(maxTh < Math.PI * 0.5, '触须末端不翻回水平以上', `${((maxTh * 180) / Math.PI).toFixed(1)}° < 90°`);
}

// 5. 瓣开幅：收缩下压不超过 PETAL_DIP，隔离外翻恰为 PETAL_OPEN
{
  let maxDip = 0;
  for (let i = 0; i < 40; i++) {
    const p = i / 40;
    for (let k = 0; k < G.PETALS; k++) maxDip = Math.max(maxDip, petalAngle(k, p, 0));
  }
  ok(maxDip <= G.PETAL_DIP + 1e-12, '收缩时瓣缘下压 ≤ PETAL_DIP', `${((maxDip * 180) / Math.PI).toFixed(2)}° ≤ 16°`);
  ok(Math.abs(petalAngle(0, 0.99, 1) + G.PETAL_OPEN) < 1e-3, `隔离钟体时瓣外翻 ${G.PETAL_OPEN * 180 / Math.PI}°（舒张位）`, `${(petalAngle(0, 0.99, 1) * 180 / Math.PI).toFixed(2)}°`);
}

// 6. 钟体呼吸：收缩时半径内收、拱高拉长，幅度在带内
{
  const b = bellBreath(pPeak);
  ok(b.r > 0.88 && b.r < 1 && b.h > 1 && b.h < 1.1, '收缩时钟体内收拉长', `r ${b.r.toFixed(3)}, h ${b.h.toFixed(3)}`);
  ok(Math.abs(bellBreath(0.9).r - 1) < 1e-4, '舒张回到原位', bellBreath(0.9).r.toFixed(6));
}

// 7. 裙边内收与活塞行程的包络
{
  let maxDent = 0;
  let maxPis = 0;
  for (let i = 0; i < 720; i++) {
    const p = i / 720;
    maxDent = Math.max(maxDent, skirtDent(p, 0));
    maxPis = Math.max(maxPis, Math.abs(pistonStroke(p)));
  }
  ok(maxDent <= G.SKIRT_DENT + 1e-12, '裙边内收 ≤ SKIRT_DENT', `${(maxDent * 1000).toFixed(1)} mm ≤ 32 mm`);
  ok(maxPis <= G.PISTON_STROKE + 1e-12, '平衡腔活塞行程 ≤ ±8 mm', `±${(maxPis * 1000).toFixed(2)} mm`);
}

// 8. 速度带与功耗带
{
  let sMin = 9, sMax = 0, tMax = 0, dMax = 0;
  for (let i = 0; i < 720; i++) {
    const p = i / 720;
    sMin = Math.min(sMin, speed(p));
    sMax = Math.max(sMax, speed(p));
    tMax = Math.max(tMax, thrustN(p));
    dMax = Math.max(dMax, drawW(p));
  }
  ok(sMin > 0.04 && sMax < 0.2, '巡游速度在 0.04–0.20 m/s 带内', `${sMin.toFixed(3)}–${sMax.toFixed(3)} m/s`);
  ok(Math.abs(tMax - THRUST_PEAK) < 0.5, '推力最大值等于手算峰', tMax.toFixed(2));
  ok(dMax < 30 && dMax > 20, '功耗峰在 20–30 W（水下桌面尺度量级）', `${dMax.toFixed(1)} W`);
}

// 9. 泵核状态：排气段喷口瓣张开、待机时收拢
{
  const s1 = pumpState(pPeak, 0);
  ok(s1.spread > 0.9, '排气段喷口瓣张开', s1.spread.toFixed(2));
  ok(pumpState(0.05, 0).spread < 0.1, '待机段喷口瓣闭合', pumpState(0.05, 0).spread.toFixed(3));
  ok(SEG_TOTAL === 110, '触须链总节数 110（控制台口径 5 × 22）', String(SEG_TOTAL));
}

console.log(fails ? `\n${fails} 项未过` : '\n全部检查通过');
process.exit(fails ? 1 : 0);
