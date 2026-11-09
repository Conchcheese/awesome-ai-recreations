// check.mjs — 按任务书断言模型的数字：`node sims/sandworm-shared/check.mjs`。
import {
  G, BODY_LEN, LAMBDA, WAVE_C, SPEED_BASE, TOTAL_LEN, TORQUE_PEAK, DRILL_PEAK_RPM,
  bulge, ringPhase, ringRadius, ringTaper, ringBulgePct, pressureKPa, drillRpm,
  headTorque, drillPowerW, speed, jawAngle, sprayRate, ringDy, pathAt, ringArc,
  drillAngleAt,
} from './model.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};

// ------------------------------------------------------------ 手算，展示出来
console.log('hand-check: 波速、前进速度（v = 波速 × 应变）');
console.log(`  c = λ·f = ${LAMBDA} m × ${G.WAVE_HZ} Hz = ${WAVE_C} m/s`);
console.log(`  v = c·ε = ${WAVE_C} × ${G.EPS_L} = ${SPEED_BASE} m/s  （面板前进速度的基准值）`);

// 1. 手算核对：v = λ·f·ε = 0.10 × 2.8 × 0.55 = 0.154 m/s
ok(Math.abs(WAVE_C - 1.54) < 1e-9, '波速 c = λ·f = 1.54 m/s', `${WAVE_C} m/s`);
ok(Math.abs(SPEED_BASE - 0.154) < 1e-9, '前进速度基准 v = c·ε = 0.154 m/s', `${SPEED_BASE} m/s`);

// 2. 蠕动波相位关系：波从头向尾传，环 2 的鼓胀 = 环 1 在 PITCH/λ 之前的鼓胀
{
  let worst = 0;
  for (let i = 0; i < 60; i++) {
    const p = i / 60;
    const a = bulge(ringPhase(1, p - G.PITCH / LAMBDA));
    const b = bulge(ringPhase(2, p));
    worst = Math.max(worst, Math.abs(a - b));
  }
  ok(worst < 1e-9, '环 2 鼓胀 = 环 1 滞后 PITCH/λ 周期（波向尾传）', `最大差 ${worst.toExponential(2)}`);
}

// 3. 鼓包函数：周期、峰值、谷值
ok(Math.abs(bulge(0) - 1) < 1e-12 && Math.abs(bulge(3) - 1) < 1e-12, '鼓包峰 = 1 且周期（φ=0 与 φ=3 同值）');
ok(bulge(0.5) < 0.001, '鼓包谷接近 0（收缩位），无跳变', bulge(0.5).toExponential(3));

// 4. 环段半径不越界、相邻环不自交
{
  let rMin = 9, rMax = 0, worstGap = 0;
  for (let i = 0; i < G.RING_N; i++) {
    const taper = G.R_BODY * ringTaper(i);
    for (let k = 0; k < 240; k++) {
      const r = ringRadius(i, k / 240);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    if (i > 0) worstGap = Math.max(worstGap, Math.abs(ringRadius(i, 0.13) - ringRadius(i - 1, 0.13)));
  }
  ok(rMin >= G.R_BODY * (1 - G.CONSTRICT) * (1 - 0.3) - 1e-9, '环半径 ≥ 收缩下限（含锥度）', `${rMin.toFixed(3)} m`);
  ok(rMax <= G.R_BODY * (1 + G.BULGE) + 1e-9, '环半径 ≤ 鼓胀上限', `${rMax.toFixed(3)} m`);
  ok(worstGap < G.PITCH, '相邻环半径差 < 环距（皮不自交）', `${worstGap.toFixed(3)} m < ${G.PITCH} m`);
}

// 5. 功率恒等式 P = T·ω
{
  let worst = 0;
  for (let k = 0; k < 240; k++) {
    const p = k / 240;
    worst = Math.max(worst, Math.abs(drillPowerW(p) - headTorque(p) * ((drillRpm(p) * 2 * Math.PI) / 60)));
  }
  ok(worst < 1e-9, '功率 P = T·ω 恒等', `最大差 ${worst.toExponential(2)} W`);
}

// 6. 钻速带与峰值位置（头部相位超前 0.15 → 峰在 p = 0.85）
ok(Math.abs(drillRpm(0.85) - G.RPM_MAX) < 1e-9, `钻速峰值 = ${G.RPM_MAX} rpm（p=0.85）`, `${drillRpm(0.85).toFixed(1)} rpm`);
{
  let rMin = 99, rMax = 0;
  for (let k = 0; k < 360; k++) {
    const r = drillRpm(k / 360);
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
  }
  ok(rMin >= G.RPM_IDLE - 1e-9 && rMax <= G.RPM_MAX + 1e-9, '钻速保持在怠速–峰值带内', `${rMin.toFixed(1)}–${rMax.toFixed(1)} rpm`);
  ok(Math.abs(DRILL_PEAK_RPM - G.RPM_MAX) < 1e-9 && Math.abs(TORQUE_PEAK - 440) < 1e-9, '峰值扭矩 T0+KT = 440 N·m', `${TORQUE_PEAK} N·m`);
}

// 7. 颚环与尾喷
{
  const j = jawAngle(0.5);
  ok(j > 0.9 * G.JAW_MAX && j <= G.JAW_MAX + 1e-12, '波峰抵达头部时颚环张到最大', `${((j * 180) / Math.PI).toFixed(1)}°`);
  ok(jawAngle(0) < 0.3 * G.JAW_MAX, '波谷时颚环近闭', `${((jawAngle(0) * 180) / Math.PI).toFixed(1)}°`);
  ok(Math.abs(sprayRate(0.14) - 1) < 1e-9, '波传到尾端时排沙喷口满喷（p=0.14）', sprayRate(0.14).toFixed(3));
}

// 8. 压力峰值与环段波百分比
ok(Math.abs(pressureKPa(0) - G.PEAK_KPA) < 1e-9, `环段液压峰值 = ${G.PEAK_KPA} kPa（p=0）`);
{
  const pct = ringBulgePct(0, 0);
  ok(Math.abs(pct - 100) < 1e-9, '波峰节的鼓胀百分比 = 100%', pct.toFixed(1));
}

// 9. 路径与几何常量
{
  const a = pathAt(0), b = pathAt(10);
  ok(Math.abs(a.x) < 1e-12 && Math.abs(a.z) < 1e-12, '路径从原点出发');
  ok(Math.abs(b.th - G.CURV * 10) < 1e-12, '航向角 θ = κs（闭式缓弧）', `θ=${b.th.toFixed(3)} rad`);
  ok(Math.abs(ringArc(0) - G.HEAD_LEN) < 1e-12, '环 0 从头段之后开始', `${ringArc(0)} m`);
  ok(Math.abs(TOTAL_LEN - 3.6) < 1e-9, '整机长 = 头 0.46 + 环区 2.8 + 尾 0.34 = 3.6 m', `${TOTAL_LEN} m`);
}

// 10. 钻芯转角表：恒 rpm 线性积分核对（ω·t）
{
  const dt = 1 / 60, n = 31;
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = ((G.RPM_MAX * 2 * Math.PI) / 60) * (i * dt);
  const got = drillAngleAt({dt, n, a}, 0.5);
  ok(Math.abs(got - ((G.RPM_MAX * 2 * Math.PI) / 60) * 0.5) < 1e-9, '钻芯转角 = ∫ω dt（恒速线性段核对）', `${got.toFixed(3)} rad`);
}

// 11. 环段竖向微动不破沙面（幅度 ≤ 8 mm）
{
  let worst = 0;
  for (let i = 0; i < G.RING_N; i++) for (let k = 0; k < 120; k++) worst = Math.max(worst, Math.abs(ringDy(i, k / 120)));
  ok(worst <= 0.008 + 1e-12, '虫体竖向微动 ≤ 8 mm', `${(worst * 1000).toFixed(2)} mm`);
}

// 12. 速度带：波峰加成 ≤ +25%
{
  let sMin = 9, sMax = 0;
  for (let k = 0; k < 360; k++) {
    const s = speed(k / 360);
    sMin = Math.min(sMin, s);
    sMax = Math.max(sMax, s);
  }
  ok(sMin >= SPEED_BASE - 1e-12 && sMax <= SPEED_BASE * 1.25 + 1e-12, '前进速度在 0.154–0.193 m/s 带', `${sMin.toFixed(3)}–${sMax.toFixed(3)} m/s`);
}

console.log(fails ? `\n${fails} 项未过` : '\n全部通过');
process.exit(fails ? 1 : 0);
