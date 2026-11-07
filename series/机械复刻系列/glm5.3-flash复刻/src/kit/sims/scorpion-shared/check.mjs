// check.mjs —— 断言模型的数字（照 teardown 方法：run with `node sims/scorpion-shared/check.mjs`）。
import {
  G, RIGID_R, MODE_NAME,
  frac, modeOf, settleK, archK, whipW, bodyPose,
  gaitPhase, gaitStats, legRoot, legTarget, legIK, legPose, contacts, loads,
  tailAngles, tailPose, tailTipSpeed, whipHandPeak, strikeDeg,
  clawOpenDeg, clawOpenRate, clawFingerSpeed, clawSnapHandPeak, clawPose,
  powerW, pAt, GUARD_MID,
} from './model.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};

// ------------------------------------------------------------ 手算对照（打印出来）
const handTip = whipHandPeak();
const handSnap = clawSnapHandPeak();
console.log('hand-check: 尾链刚性甩击与钳咬合的峰值速度（角速度 × 半径）');
console.log(`  ω峰 = 1.5·Ψ/T = 1.5·${G.PSI}°/${(G.WHIP_WIN * G.CYCLE).toFixed(3)} s = ${((G.PSI * Math.PI / 180) * 1.5 / (G.WHIP_WIN * G.CYCLE)).toFixed(2)} rad/s`);
console.log(`  R(静息针尖-尾基) = ${RIGID_R.toFixed(4)} m  →  v峰 = ${handTip.toFixed(3)} m/s`);
console.log(`  钳咬合 ω峰 = 1.5·ΔA/T = 1.5·${Math.abs(G.CLAW_OPEN - G.CLAW_SNAP)}°/${(0.02 * G.CYCLE).toFixed(3)} s → v峰 = ${handSnap.toFixed(3)} m/s`);

// 1. 八足支撑相足端恰好 y=0；摆动相抬到设计高度（全程扫描）
{
  let worstStance = 0;
  let swingMax = 0;
  for (let n = 0; n < 800; n++) {
    const p = (n / 800) * G.WALK_END; // 行走带
    for (let i = 0; i < G.LEGS; i++) {
      const t = legTarget(i, p);
      const f = legPose(i, p).F;
      if (t.contact) worstStance = Math.max(worstStance, Math.abs(f[1]));
      else swingMax = Math.max(swingMax, f[1]);
    }
  }
  ok(worstStance < 1e-9, '八足支撑相足端 y = 0（正运动学回代）', `worst |y| ${worstStance.toExponential(2)} m`);
  ok(swingMax > 0.5 * G.LIFT && swingMax <= G.LIFT * 1.02, '摆动相足端抬起且不超设计抬脚', `max ${swingMax.toFixed(4)} m`);
}

// 2. 步态组相位差恒为 0.5
{
  let worst = 0;
  for (let n = 0; n < 400; n++) {
    const p = (n / 400) * G.WALK_END;
    const d = Math.abs(frac(gaitPhase(0, p) - gaitPhase(4, p)) - 0.5); // L1(A) vs R1(B)
    const d2 = Math.abs(frac(gaitPhase(1, p) - gaitPhase(5, p)) - 0.5); // L2(B) vs R2(A)
    worst = Math.max(worst, d, d2);
  }
  ok(worst < 1e-9, '步态两足组相位差 = 0.5（A/B 组）', `worst Δ ${worst.toExponential(2)}`);
}

// 3. IK/FK 闭合：解出的角度回代足端 = 目标（可行域内不削顶）
{
  let worst = 0;
  for (let n = 0; n < 300; n++) {
    const p = (n / 300) * 0.999;
    for (let i = 0; i < G.LEGS; i++) {
      const t = legTarget(i, p);
      const lp = legPose(i, p);
      worst = Math.max(worst, Math.hypot(lp.F[0] - t.x, lp.F[1] - t.y, lp.F[2] - t.z));
    }
  }
  ok(worst < 1e-9, '腿 IK→FK 闭合（闭式解回代 = 目标）', `worst ${worst.toExponential(2)} m`);
}

// 4. 腿不超伸（可达域内留余量，不撞 IK 削顶）
{
  let maxReach = 0;
  for (let n = 0; n < 400; n++) {
    const p = (n / 400) * 0.999;
    for (let i = 0; i < G.LEGS; i++) maxReach = Math.max(maxReach, legPose(i, p).reach);
  }
  ok(maxReach < 0.97 * (G.FEMUR + G.TIBIA), '八足全程不超伸（< 0.97×股+胫）', `${(maxReach * 1000).toFixed(1)} mm < ${(0.97 * (G.FEMUR + G.TIBIA) * 1000).toFixed(1)} mm`);
}

// 5. 尾节角不超限位（静息角 ±35° 行程内），且攻击末低于静息（甩向前）
{
  let minTh = 999;
  let maxTh = -999;
  for (let n = 0; n < 800; n++) {
    const p = n / 800;
    for (const th of tailAngles(p)) {
      minTh = Math.min(minTh, th / (Math.PI / 180));
      maxTh = Math.max(maxTh, th / (Math.PI / 180));
    }
  }
  const lo = Math.min(...G.REST) - G.PSI;
  const hi = Math.max(...G.REST) + G.ARCH;
  ok(minTh > lo - 1.5 && maxTh < hi + 1.5, '尾节角不超限位（静息±甩击/拱起包络）', `[${minTh.toFixed(1)}°, ${maxTh.toFixed(1)}°] ⊆ [${lo.toFixed(1)}°, ${hi.toFixed(1)}°]`);
  ok(tailAngles(0.8)[0] < tailAngles(0.6)[0] - 40 * Math.PI / 180, '攻击段尾链确实前甩（节1 角下降 > 40°）');
}

// 6. 攻击段毒针尖端速度峰：数值 FK 微分 vs 手算（角速度×半径）
{
  const DP = 1 / 2400;
  let vPeak = 0;
  for (let n = 0; n < 2400; n++) {
    const p = n / 2400;
    const a = tailPose(frac(p - DP)).tip;
    const b = tailPose(frac(p + DP)).tip;
    const v = (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * DP)) / G.CYCLE;
    if (p >= G.GUARD_END && p <= G.RELAX_T0) vPeak = Math.max(vPeak, v);
  }
  ok(Math.abs(vPeak - handTip) / handTip < 0.08, '攻击段尾尖速度峰 = 手算 ω峰×R（±8%）', `数值 ${vPeak.toFixed(3)} vs 手算 ${handTip.toFixed(3)} m/s`);
  const walkMax = (() => {
    let m = 0;
    for (let n = 0; n < 700; n++) m = Math.max(m, tailTipSpeed((n / 700) * G.WALK_END));
    return m;
  })();
  ok(tailTipSpeed(0.795) > 1.5 && walkMax < 0.05, '毒针速度只在攻击段出现（行走进 < 0.05 m/s）', `attack ${tailTipSpeed(0.795).toFixed(2)} m/s`);
}

// 7. 毒针全程不触地、不进背甲（针尖 y 下限）
{
  let minY = 9;
  for (let n = 0; n <= 1200; n++) minY = Math.min(minY, tailPose(n / 1200).tip[1]);
  ok(minY > 0.03, '毒针尖端全程不触地（y > 30 mm）', `min y ${minY.toFixed(3)} m`);
}

// 8. 钳开合：攻击段张到最大、咬合到最小、全程限位内；指尖速度峰 vs 手算
{
  let maxOpen = 0;
  let minOpen = 999;
  for (let n = 0; n <= 1600; n++) {
    const o = clawOpenDeg(n / 1600);
    maxOpen = Math.max(maxOpen, o);
    minOpen = Math.min(minOpen, o);
  }
  ok(maxOpen > G.CLAW_OPEN - 0.5, '攻击段钳张到最大开口', `${maxOpen.toFixed(1)}°`);
  ok(minOpen < G.CLAW_SNAP + 1 && minOpen >= G.CLAW_SNAP - 0.5, '咬合到 4° 附近且不为负', `${minOpen.toFixed(1)}°`);
  const DP = 1 / 4800;
  let vPeak = 0;
  for (let n = 0; n < 4800; n++) {
    const p = n / 4800;
    const v = (Math.abs(clawOpenDeg(frac(p + DP)) - clawOpenDeg(frac(p - DP))) / (2 * DP) / G.CYCLE) * (Math.PI / 180) * G.FINGER;
    vPeak = Math.max(vPeak, v);
  }
  ok(Math.abs(vPeak - handSnap) / handSnap < 0.1, '钳指尖速度峰 = 手算 1.5·ΔA/T×指长（±10%）', `数值 ${vPeak.toFixed(3)} vs 手算 ${handSnap.toFixed(3)} m/s`);
  ok(clawPose(1, 0.86).openDeg > 45 && clawPose(-1, 0.86).openDeg > 45, '双钳对称张开（0.86 处 > 45°）');
}

// 9. 行走-攻击相位边界连续：p=0 与 p→1⁻ 的姿态关键量一致
{
  const eps = 1e-9;
  const gap = (f) => Math.abs(f(frac(1 - eps)) - f(0));
  let worst = Math.max(
    gap((p) => bodyPose(p).lift),
    gap((p) => tailPose(p).tip[1]),
    gap((p) => tailPose(p).tip[2]),
    gap((p) => clawOpenDeg(p)),
    gap((p) => (clawPose(1, p).tipM[2] - clawPose(-1, p).tipM[2]) / 2),
  );
  for (let i = 0; i < G.LEGS; i++) {
    const a = legTarget(i, frac(1 - eps));
    const b = legTarget(i, 0);
    worst = Math.max(worst, Math.abs(a.y - b.y), Math.abs(a.z - b.z));
  }
  ok(worst < 5e-4, '行走-攻击相位边界连续（p=1⁻ ≡ p=0）', `worst ${worst.toExponential(2)}`);
}

// 10. 警戒/攻击段八足全支撑；行走段交替支撑（4 足）
{
  const cGuard = contacts(0.66).filter(Boolean).length;
  const cAttack = contacts(0.85).filter(Boolean).length;
  ok(cGuard === 8 && cAttack === 8, '警戒/攻击段八足全支撑（STANCE · 8 FEET）', `guard ${cGuard}, attack ${cAttack}`);
  let walkN = 0;
  for (let n = 0; n < 300; n++) walkN = Math.max(walkN, contacts(0.06 + (n / 300) * 0.49).filter(Boolean).length); // 稳态行走带
  ok(walkN === 4, '行走段恒 4 足支撑（两足组交替；进出过渡段除外）', `max ${walkN}`);
}

// 11. 功耗带宽；攻击峰显著高于行走均值
{
  let pMin = 999;
  let pMax = 0;
  let walkSum = 0;
  for (let n = 0; n < 900; n++) {
    const p = n / 900;
    const w = powerW(p);
    pMin = Math.min(pMin, w);
    pMax = Math.max(pMax, w);
    if (p < G.WALK_END) walkSum += w;
  }
  const walkMean = walkSum / (900 * G.WALK_END);
  ok(pMin > 3 && pMax < 60, '功耗在 3–60 W 带内', `${pMin.toFixed(1)}–${pMax.toFixed(1)} W`);
  ok(pMax > walkMean + 8, '攻击段功耗峰高出行走均值 8 W 以上', `峰 ${pMax.toFixed(1)} vs 均值 ${walkMean.toFixed(1)} W`);
}

// 12. 相位映射：alertT 后驻停警戒带，模式读数正确；gaitStats 自洽
{
  const alertT = 22;
  const pEnd = pAt(24.9, alertT);
  ok(Math.abs(pEnd - GUARD_MID) < 1e-6 && modeOf(Math.max(0, pEnd)) === 1, '收尾驻停警戒带（pAt(24.9) = 警戒中点）', `p ${pEnd.toFixed(3)}`);
  const gs = gaitStats();
  ok(Math.abs(gs.speed - gs.stepLen * gs.hz) < 1e-9, '步速 = 步长 × 步频（面板自洽）', `${gs.speed.toFixed(3)} m/s`);
  ok(modeOf(0.3) === 0 && modeOf(0.66) === 1 && modeOf(0.9) === 2, `模式边界正确（${MODE_NAME.join('/')}）`);
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\n全部通过');
process.exit(fails ? 1 : 0);
