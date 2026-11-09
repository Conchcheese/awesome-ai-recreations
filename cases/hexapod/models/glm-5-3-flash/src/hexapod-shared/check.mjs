// check.mjs — 按任务书断言模型：node sims/hexapod-shared/check.mjs
import {
  G, SPEED, LEGS, OFF, LAT,
  legPose, fkFoot, legPhase, contactOf, stanceN, gaitRows,
  legTorques, jointRates, powerW, voltV, bodyH, bodyPitch, bodyRoll, nominalFoot,
} from './model.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};
const D2R = Math.PI / 180;

// ------------------------------------------------------------ 手算展示
console.log('hand-check: 步速与股节扭矩');
console.log(`  v = 2·步幅/周期 = 2×${G.STROKE} / ${G.T_STEP} = ${SPEED.toFixed(3)} m/s（0.30 m × 0.667 Hz）`);
{
  const s = legPose(4, 0.25); // R2 支撑中
  const F = (G.M * 9.81) / 3;
  const kh = Math.hypot(s.F[0] - s.K0[0], s.F[2] - s.K0[2]);
  console.log(`  股节扭矩 ≈ W/3 × 力臂 = ${(F / 3 * 3).toFixed(1)} N × ${kh.toFixed(3)} m = ${(F * kh).toFixed(2)} N·m（AX-12A 堵转 ${G.SERVO_TQ} N·m）`);
}

const NP = 720;
const poses = (park = 0) => {
  const out = [];
  for (let k = 0; k < NP; k++) {
    const p = k / NP;
    for (let i = 0; i < 6; i++) out.push({i, p, s: legPose(i, p, {park})});
  }
  return out;
};
const ALL = poses();
const PARKED = poses(1);

// 1. 18 个关节角全部在限位内
{
  let maxYaw = 0, minFem = 99, maxFem = -99, minBend = 99, maxBend = -99;
  for (const {s} of ALL) {
    maxYaw = Math.max(maxYaw, Math.abs(s.yaw));
    minFem = Math.min(minFem, s.femur);
    maxFem = Math.max(maxFem, s.femur);
    minBend = Math.min(minBend, s.bend);
    maxBend = Math.max(maxBend, s.bend);
  }
  ok(maxYaw <= G.YAW_MAX + 1e-9, '髋偏航 |yaw| ≤ 40°', `${(maxYaw / D2R).toFixed(2)}°`);
  ok(minFem >= -G.FEM_MAX - 1e-9 && maxFem <= G.FEM_MAX + 1e-9, '股节 ∈ [−95°, +95°]', `${(minFem / D2R).toFixed(1)}°..${(maxFem / D2R).toFixed(1)}°`);
  ok(minBend >= 0 - 1e-9 && maxBend <= G.TIB_MAX + 1e-9, '胫节弯折 ∈ [0°, 135°]', `${(minBend / D2R).toFixed(1)}°..${(maxBend / D2R).toFixed(1)}°`);
  ok(18 === LEGS.length * 3, '关节总数 = 6 腿 × 3 = 18（型号 HX-18）', String(LEGS.length * 3));
}

// 2. 支撑腿不打滑：世界系脚位置（机身前进 2·S·p + 机身系滑移）在支撑段内恒定
{
  let worst = 0;
  for (const {i, p, s} of ALL) {
    if (!s.stance) continue;
    const dp = 0.01;
    const s2 = legPose(i, p + dp);
    if (!s2.stance) continue; // 只比较同一段内的样本
    const w1 = 2 * G.STROKE * p + s.s;
    const w2 = 2 * G.STROKE * (p + dp) + s2.s;
    worst = Math.max(worst, Math.abs(w2 - w1));
  }
  ok(worst < 1e-9, '支撑脚世界系静止（不打滑）', `worst Δ ${(worst).toExponential(2)} m`);
}

// 3. 摆动腿抬起高度 > 0，峰值 = LIFT
{
  let peak = 0, mid = 0;
  for (const {s} of ALL) {
    if (s.stance) continue;
    peak = Math.max(peak, s.lift);
    if (Math.abs(s.q - 0.75) < 0.01) mid = Math.max(mid, s.lift);
  }
  ok(peak > G.LIFT - 1e-9 && peak < G.LIFT + 1e-9, '摆动腿峰值抬脚 = 0.045 m', peak.toFixed(4));
  ok(mid > 0.9 * G.LIFT, '摆动中段明显离地', mid.toFixed(4));
}

// 4. 三脚架分组相位差 0.5
{
  const group = LEGS.map((_, i) => OFF[i]);
  const alt = group.every((o, i) => o === (i % 2 === 0 ? 0 : 0.5));
  ok(alt, 'A 组 L1·L3·R2 相位 0，B 组 L2·R1·R3 相位 0.5', group.join(' '));
  let nMin = 9, nMax = 0;
  for (let k = 0; k < NP; k++) {
    const n = stanceN(k / NP);
    nMin = Math.min(nMin, n);
    nMax = Math.max(nMax, n);
  }
  ok(nMin === 3 && nMax === 3, '任意相位恰好 3 脚支撑（三脚架）', `${nMin}..${nMax}`);
}

// 5. 机身速度 = 步幅 × 步频（手算闭合）
ok(Math.abs(SPEED - 0.2) < 1e-12, 'SPEED = 2×0.15/1.5 = 0.20 m/s', SPEED.toFixed(4));
ok(Math.abs(SPEED * G.T_STEP - 2 * G.STROKE) < 1e-12, '每周期位移 = 2 × 步幅', (SPEED * G.T_STEP).toFixed(3));

// 6. 落脚点连续（q=0.5 与 q=1/0 处脚位置无跳变）
{
  let worst = 0;
  const eps = 1e-6;
  for (let i = 0; i < 6; i++) {
    for (const b of [0.5, 1]) {
      const a = legPose(i, (b - eps + 1) % 1);
      const c = legPose(i, (b + eps) % 1);
      for (let j = 0; j < 3; j++) worst = Math.max(worst, Math.abs(a.F[j] - c.F[j]));
    }
  }
  ok(worst < 1e-5, '落脚点函数连续（摆动↔支撑切换无跳变）', `worst Δ ${(worst).toExponential(2)} m`);
}

// 7. 逆解自洽：正运动学由三关节角重建脚位置
{
  let worst = 0;
  for (const {i, s} of ALL) {
    const f = fkFoot(i, s.yaw, s.femur, s.bend);
    for (let j = 0; j < 3; j++) worst = Math.max(worst, Math.abs(f[j] - s.F[j]));
  }
  ok(worst < 1e-9, 'FK(逆解三关节角) = 落脚点（闭式解自洽）', `worst Δ ${(worst).toExponential(2)} m`);
}

// 8. 可达性：膝到脚的距离留在连杆行程的安全带内
{
  let rMin = 9, rMax = 0;
  for (const {s} of ALL) {
    const r = Math.hypot(s.F[0] - s.K0[0], s.F[1] - s.K0[1], s.F[2] - s.K0[2]);
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
  }
  ok(rMin > Math.abs(G.FEMUR - G.TIBIA) + 0.005, '连杆不越过奇异内界', `${rMin.toFixed(3)} > ${Math.abs(G.FEMUR - G.TIBIA) + 0.005}`);
  ok(rMax < G.FEMUR + G.TIBIA - 0.005, '连杆不越过奇异外界（不蹬直锁死）', `${rMax.toFixed(3)} < ${(G.FEMUR + G.TIBIA - 0.005).toFixed(3)}`);
}

// 9. 支撑腿脚底恰好贴地 y = −bodyH（机身系）且摆动腿悬空
{
  let worst = 0;
  for (const {p, s} of ALL) {
    const want = -bodyH(p) + (s.stance ? 0 : s.lift);
    worst = Math.max(worst, Math.abs(s.F[1] - want));
  }
  ok(worst < 1e-9, '支撑脚底 y=0（地面）、摆动脚按抬脚曲线', `worst Δ ${(worst).toExponential(2)} m`);
}

// 10. 停机（维修举升）姿态仍然全部在限位内且六脚着地
{
  let okLimits = true;
  for (const {s} of PARKED) {
    okLimits &&= Math.abs(s.yaw) <= G.YAW_MAX + 1e-9 && Math.abs(s.femur) <= G.FEM_MAX + 1e-9 && s.bend <= G.TIB_MAX + 1e-9;
  }
  const down = PARKED.every(({s}) => Math.abs(s.lift) < 1e-12);
  ok(okLimits && down, '停机姿态六脚平放、关节全部在限位内', `bodyH ${(bodyH(0.3, 1) * 1000).toFixed(0)} mm`);
}

// 11. 功耗/电压/机身姿态读数有界
{
  let pMin = 1e9, pMax = 0, vMin = 99, vMax = 0, hMin = 9, hMax = 0;
  for (let k = 0; k < NP; k++) {
    const p = k / NP;
    const w = powerW(p);
    pMin = Math.min(pMin, w);
    pMax = Math.max(pMax, w);
    const v = voltV(p, 12);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
    hMin = Math.min(hMin, bodyH(p));
    hMax = Math.max(hMax, bodyH(p));
  }
  ok(pMin > 2 && pMax < 90, '功耗 ∈ (2, 90) W', `${pMin.toFixed(1)}–${pMax.toFixed(1)} W`);
  ok(vMin > 11.0 && vMax < 12.0, '母线电压 ∈ (11.0, 12.0) V', `${vMin.toFixed(2)}–${vMax.toFixed(2)} V`);
  ok(hMin > 0.08 && hMax < 0.16, '机身高度微动 ∈ (80, 160) mm', `${(hMin * 1000).toFixed(1)}–${(hMax * 1000).toFixed(1)} mm`);
  ok(Math.abs(bodyPitch(0.1)) < 1.5 * D2R && Math.abs(bodyRoll(0.1)) < 1.5 * D2R, '俯仰/横滚微动 < 1.5°');
}

// 12. 步态图与扭矩表的形状与量级
{
  const rows = gaitRows(3.21);
  const shape = rows.length === 6 && rows.every((r) => r.length === 44 && r.every((b) => typeof b === 'boolean'));
  const colsOk = rows[0].every((_, c) => rows.reduce((a, r) => a + (r[c] ? 1 : 0), 0) === 3);
  ok(shape && colsOk, '步态图 6 行 × 44 列，每列恰好 3 脚触地', shape ? 'shape ok' : 'bad shape');
  let tqMax = 0;
  for (let i = 0; i < 6; i++) for (const tq of legTorques(i, 0.25)) tqMax = Math.max(tqMax, tq);
  ok(tqMax > 0.5 && tqMax <= G.SERVO_TQ + 1e-6, '单腿扭矩峰值 ≤ AX-12A 堵转 1.5 N·m', `${tqMax.toFixed(2)} N·m`);
  const w = jointRates(0, 0.6);
  ok(w.every((x) => Math.abs(x) < 40), '关节角速度有界 (<40 rad/s)', w.map((x) => x.toFixed(1)).join(' '));
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
