// check.mjs — asserts the bee's numbers the way the doc asks. Run: `node sims/bee-shared/check.mjs`.
import {
  G, SCREEN_HZ, GEAR_RATIO, WING_AREA, WEIGHT_N, LIFT_MEAN_WING,
  strokeAngle, twistAngle, strokeRate, wingPose,
  liftN, liftMean, liftPeak, tipSpeed, tipSpeedMax, tipTrace,
  crankAngle, gearAngle, crankPin,
  batteryPct, drawW, cellV, legLoad, altMm, vsMmS, pitchDeg, rollDeg, ballastSlide, airspeed,
} from './model.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};

// ------------------------------------------------------------ hand-check, shown
console.log('hand-check: hover lift = weight');
console.log(`  m·g = ${G.MODEL_MASS * 1e3} g × 9.81 = ${(WEIGHT_N * 1e3).toFixed(3)} mN → 单翼均值 ${(LIFT_MEAN_WING * 1e3).toFixed(3)} mN`);
console.log(`  翼面积 S = ${G.PLANFORM}×${G.SPAN}×${G.CHORD} = ${WING_AREA.toExponential(3)} m²; 屏上频率 = ${G.FLAP_HZ}×1/50 = ${SCREEN_HZ} Hz`);

// 1. 左右翼对称: same stroke, mirrored twist, at every phase
{
  let worst = 0;
  for (let i = 0; i < 72; i++) {
    const p = i / 72;
    const L = wingPose(p, -1);
    const R = wingPose(p, 1);
    worst = Math.max(worst, Math.abs(L.stroke - R.stroke), Math.abs(L.twist + R.twist));
  }
  ok(worst < 1e-12, '左右翼对称: 拍打同相、扭转镜像', `worst Δ ${worst.toExponential(1)} rad`);
}

// 2. 扭转在换向处过零 (stroke reversals p = 0, 0.5), 且下拍正/上拍反
{
  const z = [twistAngle(0), twistAngle(0.5), twistAngle(1)].every((a) => Math.abs(a) < 1e-12);
  ok(z, '扭转在换向处 (p=0/0.5/1) 过零', twistAngle(0.5).toExponential(1));
  ok(twistAngle(0.25) > 0 && twistAngle(0.75) < 0, '下拍正攻角、上拍反攻角', `α(0.25)=${((twistAngle(0.25) * 180) / Math.PI).toFixed(1)}° α(0.75)=${((twistAngle(0.75) * 180) / Math.PI).toFixed(1)}°`);
}

// 3. 拍打幅 ≤ 70°
{
  let maxA = 0;
  let minA = 0;
  for (let i = 0; i < 1440; i++) {
    const a = strokeAngle(i / 1440);
    maxA = Math.max(maxA, a);
    minA = Math.min(minA, a);
  }
  ok(maxA <= G.STROKE_AMP + 1e-12 && minA >= -G.STROKE_AMP - 1e-12, '拍打幅 ≤ 70°', `+${((maxA * 180) / Math.PI).toFixed(1)}° / ${((minA * 180) / Math.PI).toFixed(1)}°`);
}

// 4. 升力峰相位与下拍中段一致 (p ≈ 0.25)
{
  const {p} = liftPeak();
  ok(Math.abs(p - 0.25) < 0.06, '升力峰相位与下拍中段一致', `peak at p=${p.toFixed(3)}`);
}

// 5. 悬停平均升力 ≈ 重力 (手算见上)
{
  const mean = liftMean();
  const {L} = liftPeak();
  ok(Math.abs(mean - LIFT_MEAN_WING) / LIFT_MEAN_WING < 0.01, '悬停平均单翼升力 = m·g/2', `${(mean * 1e3).toFixed(3)} mN vs ${(LIFT_MEAN_WING * 1e3).toFixed(3)} mN`);
  ok(L > mean && L < 4 * mean, '峰值升力在均值 1–4 倍之间 (悬停可信)', `peak ${(L * 1e3).toFixed(2)} mN, mean ${(mean * 1e3).toFixed(2)} mN`);
}

// 6. 翼尖速度上限
{
  const vmax = tipSpeedMax();
  ok(vmax < 60, '翼尖速度 < 60 m/s (展示模型上限)', `${vmax.toFixed(1)} m/s @ 150 Hz`);
}

// 7. 翼尖轨迹闭合且幅值等于翼长
{
  const tr = tipTrace();
  const d0 = Math.hypot(tr[0][0] - tr[64][0], tr[0][1] - tr[64][1]);
  const rMax = Math.max(...tr.map(([x, y]) => Math.hypot(x, y)));
  ok(d0 < 1e-9 && Math.abs(rMax - G.SPAN) < 1e-12, '翼尖轨迹闭合、半径 = 翼长', `gap ${d0.toExponential(1)} m, r ${rMax.toFixed(4)} m`);
}

// 8. 传动: 曲柄一冲程一圈, 大齿轮按齿数比反转
{
  const g0 = gearAngle(0.25);
  const expected = -crankAngle(0.25) * GEAR_RATIO;
  ok(Math.abs(g0 - expected) < 1e-12, `齿轮按 ${G.GEAR_DRIVE}:${G.GEAR_PINION} 齿数比随曲柄反转 (×${GEAR_RATIO.toFixed(3)})`, `${(g0 / (Math.PI * 2)).toFixed(3)} 圈/冲程`);
  const pin = crankPin(0.125);
  ok(Math.abs(Math.hypot(pin[0], pin[1]) - 0.0075) < 1e-12, '曲柄销半径 7.5 mm 恒定', `${(Math.hypot(pin[0], pin[1]) * 1e3).toFixed(3)} mm`);
}

// 9. 电源读数在参考帧的量程内
{
  let dMin = 9, dMax = 0;
  for (let i = 0; i < 720; i++) {
    const d = drawW(i / 720);
    dMin = Math.min(dMin, d);
    dMax = Math.max(dMax, d);
  }
  ok(dMin > 3.5 && dMax < 5.6, '功耗在 4.3 W 基线附近脉动 (frame: 4.3 W)', `${dMin.toFixed(2)}–${dMax.toFixed(2)} W`);
  ok(Math.abs(cellV(0) - 3.7) < 1e-12 && cellV(25) >= 3.679, '电芯电压 3.70 V 缓降 (frame)', `${cellV(0).toFixed(2)} → ${cellV(25).toFixed(3)} V`);
  ok(batteryPct(0) === 82 && batteryPct(25) === 80, '电量 82% → 80% (frame: 81/80)', `${batteryPct(0)} → ${batteryPct(25)}`);
}

// 10. 飞行读数: 高度带 148–164 mm、垂速有界、配重俯仰单调
{
  let aMin = 999, aMax = 0;
  for (let i = 0; i < 440; i++) {
    const a = altMm((i / 440) * 21.8);
    aMin = Math.min(aMin, a);
    aMax = Math.max(aMax, a);
  }
  ok(aMin > 147 && aMax < 165, '悬停高度带 148–164 mm (frame: 04 FLIGHT)', `${aMin.toFixed(1)}–${aMax.toFixed(1)} mm`);
  ok(Math.abs(vsMmS(3)) < 6, '悬停垂速 < 6 mm/s (frame: ±4.7)', `${vsMmS(3).toFixed(2)} mm/s`);
  ok(pitchDeg(3, 0) < pitchDeg(3, 1), '配重前滑 → 俯仰抬头单调', `${pitchDeg(3, 0).toFixed(2)}° → ${pitchDeg(3, 1).toFixed(2)}°`);
  ok(Math.abs(ballastSlide(1) * 1e3 - G.BALLAST_MM) < 1e-12, `配重滑移量程 ${G.BALLAST_MM} mm`, `${(ballastSlide(1) * 1e3).toFixed(1)} mm`);
}

// 11. 舵机负载围绕参考帧基线波动
{
  const L = legLoad(0.25, 3);
  ok(L.length === 6 && L.every((v, i) => Math.abs(v - G.LEG_BASE[i]) < 8), '六舵机负载围绕 frame 基线 ±8% 内', `[${L.map((v) => v.toFixed(0)).join(' ')}]%`);
  ok(airspeed(5) < 0.05, '悬停空速 ≈ 0 (frame: 0.00 m/s)', `${airspeed(5).toFixed(3)} m/s`);
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
