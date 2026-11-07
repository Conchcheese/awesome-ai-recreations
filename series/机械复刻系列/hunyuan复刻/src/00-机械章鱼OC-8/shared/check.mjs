// check.mjs — 宝石蓝版 OC-8 数学核心自检。运行：node shared/check.mjs（本目录下直接 node check.mjs）
// 每一条断言前都写了手算过程；只要有一条不成立就以非零码退出。
import {
  // 常量
  PULSE_HZ, PULSE_PERIOD, PEAK_KPA, NOZZLE_D, NOZZLE_A, THRUST_PEAK,
  LINKS, LINK_LEN, ARMS, WHEELS_PER_ARM, LINKS_TOTAL, WHEELS_TOTAL, JOINT_MAX,
  PETALS, PETAL_OPEN, R2D, D2R, DURATION, ARM_ISO_INDEX,
  // 心跳 / 推力
  jetPulse, pulseShape, mantlePressure, flapOpen, thrust, jetLoad,
  // 节拍
  BEATS, beatAt, beatAmount, beatParam,
  // 运动
  petalOpen, armCurl, armWave, armCurlPct, armChain2D, armJointAngles,
  siphonState, beakOpen, explodeAmount, turretAngle,
  // 读数
  telemetry, pressureHistory, stateAt,
} from './model.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok  ' : 'FAIL  '}${label}${detail ? `  —  ${detail}` : ''}`);
  if (!cond) fails++;
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const hasCJK = (s) => /[\u4e00-\u9fff]/.test(s);

// =====================================================================================
console.log('\n【1】推力手算：A = π·(0.019)²，T = 2·ΔP·A');
// 喷口 38 mm → 半径 0.019 m → A = π·0.019² = 1.134115e-3 m²
// 峰值 93 kPa → T = 2·93 000·1.134115e-3 = 210.945 N ≈ 211 N（与原作 JET 面板一致）
console.log(`  A = π·0.019² = ${NOZZLE_A.toExponential(6)} m²`);
console.log(`  T = 2·93000·A = ${THRUST_PEAK.toFixed(3)} N`);
ok(near(NOZZLE_A, Math.PI * 0.019 ** 2, 1e-15), '喷口面积 A = 1.134115e-3 m²（38 mm 喷口）', NOZZLE_A.toExponential(6));
ok(near(THRUST_PEAK, 210.945, 0.01), '峰值推力 = 210.945 N（2·93 000·A）', THRUST_PEAK.toFixed(3));
ok(near(mantlePressure(0), 93, 1e-12), 't=0 落在脉冲峰值，外套膜压力 = 93 kPa', mantlePressure(0).toFixed(3));
ok(near(thrust(0), THRUST_PEAK, 1e-12), 't=0 推力 = 峰值 210.945 N', thrust(0).toFixed(3));
ok(thrust(0) >= 210 && thrust(0) <= 212, '峰值推力落在 211 N ±1 N', thrust(0).toFixed(2));
// 待机：压力约 24 kPa 时喷口只剩 12% 开度 → T = 2·24 000·A·0.12 ≈ 6.5 N（原作待机 6 N）
{
  // 找脉冲衰减段上压力约 24 kPa 的相位：0.93·exp(-½(Δ/0.13)²)=0.24 → Δ≈0.214
  const t = 0.214 / PULSE_HZ;
  const T = thrust(t);
  ok(T > 2 && T < 15, '24 kPa 待机段推力为个位数（约 6 N 量级）', `${mantlePressure(t).toFixed(1)} kPa → ${T.toFixed(2)} N`);
}

// =====================================================================================
console.log('\n【2】心跳：f = 1.8 Hz → T = 1/1.8 = 0.5556 s');
ok(near(PULSE_PERIOD, 0.555556, 1e-6), '周期 = 0.5556 s', PULSE_PERIOD.toFixed(6));
ok(jetPulse(0) === 0, 'jetPulse(0) = 0（相位从峰值出发）');
{
  let worst = 0;
  for (let i = 0; i < 97; i++) {
    const t = i * 0.1037;
    worst = Math.max(worst, Math.abs(mantlePressure(t) - mantlePressure(t + PULSE_PERIOD)));
  }
  ok(worst < 1e-9, '压力以 1/1.8 s 为周期严格重复', `worst Δ ${worst.toExponential(2)} kPa`);
}
ok(mantlePressure(0) === PEAK_KPA && mantlePressure(PULSE_PERIOD / 2) < 1, '脉冲峰值 93 kPa、半周期处静默', `半周期 ${mantlePressure(PULSE_PERIOD / 2).toExponential(2)} kPa`);
ok(flapOpen(0) === 1 && near(flapOpen(0.4), 0.12, 1e-12), '喷口在峰值全开、其余 12% 泄漏', `flap(0.4)=${flapOpen(0.4)}`);
ok(near(jetLoad(0), 1, 1e-12), '顶部「喷射负载」在峰值 = 100%');

// =====================================================================================
console.log('\n【3】8 臂相位差 1/8 周期：armCurl(t + T/8, i+1) ≡ armCurl(t, i)');
// 相邻臂在 1/8 周期（0.0694 s）后到达对方刚才的卷曲量。选拍内平台区（4.3–6.4 s 等）避免
// 拍点过渡，取 8 条臂里 2–7 号做 40 个采样点比对。
{
  let worst = 0;
  const plateaus = [4.3, 4.9, 5.4, 5.9, 6.4, 8.6, 9.0, 13.2, 13.6, 15.1, 15.4, 17.0, 17.4];
  for (const t0 of plateaus)
    for (let s = 0; s < 10; s++)
      for (let i = 2; i < 7; i++) worst = Math.max(worst, Math.abs(armCurl(t0 + s * 0.02 + PULSE_PERIOD / 8, i + 1) - armCurl(t0 + s * 0.02, i)));
  ok(worst < 1e-9, '8 臂卷曲波严格相差 1/8 周期', `worst Δ ${worst.toExponential(2)}`);
}
{
  const w = armWave(1.234);
  ok(w.length === 8 && w.every((x) => x >= 0 && x <= 1), 'armWave 返回 8 个 0..1 的卷曲量', w.map((x) => x.toFixed(2)).join(', '));
  ok(Math.max(...w) - Math.min(...w) > 0.02, '同一时刻 8 臂卷曲量存在波峰波谷差', `Δ ${(Math.max(...w) - Math.min(...w)).toFixed(3)}`);
  ok(near(armCurl(11, ARM_ISO_INDEX), 0.12, 1e-9), 'R2 臂在 10–12.5 s 拍点分离到 12%（≈100% 展开）', armCurl(11, ARM_ISO_INDEX).toFixed(3));
  ok(armCurlPct(8.5, 0) > 90, '外套膜拍点手臂卷曲 > 90%（原作 HUD 100%）', armCurlPct(8.5, 0).toFixed(0) + '%');
}

// =====================================================================================
console.log('\n【4】臂弯曲 100%：25 节 × 40 mm = 1.0 m，末端卷回');
// 25 节 × 0.04 m = 1.0 m；关节上限 26°，权重和 Σenv = 10.2189 → 整臂相对转角
// 26° × 10.2189 = 265.7°；臂根初倾 -18° → 末端朝向 247.7°（卷过竖直，往回勾）。
// 折线最大半径 0.594 m 出现在第 18 节，末端半径 0.410 m → 末端比最远处收回 0.18 m。
const t100 = 25 / 3; // t = 25/3 s 时 p = 15 个整脉冲，armBase 0.94 + armAmp 0.06 = 1.00
{
  ok(near(armCurl(t100, 0), 1, 1e-12), '存在卷曲 100% 的时刻（t=25/3 s，拍点平台内）', armCurl(t100, 0).toFixed(6));
  const chain = armChain2D(0, t100);
  const tip = chain.tip;
  let maxR = 0;
  for (const [x, y] of chain.pts) maxR = Math.max(maxR, Math.hypot(x, y));
  const endR = Math.hypot(tip[0], tip[1]);
  const tipHeading = chain.headings[LINKS];
  ok(near(chain.length, 1, 1e-12), '臂链总长 = 25 × 0.04 = 1.0 m', chain.length.toFixed(6));
  ok(near(chain.pts.length, LINKS + 1, 0), '折线有 26 个点（25 节）', String(chain.pts.length));
  const ang = armJointAngles(0, t100);
  ok(Math.max(...ang) <= JOINT_MAX + 1e-12, `每个关节 ≤ ${(JOINT_MAX * R2D).toFixed(0)}°`, `${(Math.max(...ang) * R2D).toFixed(2)}°`);
  const sum = ang.reduce((a, b) => a + b, 0) * R2D;
  ok(near(sum, 265.7, 0.1), '整臂相对转角 = 26° × 10.2189 = 265.7°', sum.toFixed(1) + '°');
  ok(tipHeading > 4.0 && tipHeading < 4.8, '末端朝向 229°–275°（卷过竖直往回勾）', (tipHeading * R2D).toFixed(1) + '°');
  ok(maxR > 0.55 && maxR < 0.65, '最大外伸半径 0.594 m', maxR.toFixed(3) + ' m');
  ok(maxR - endR > 0.1, '末端半径比最远处收回 > 0.1 m（螺旋卷回）', `${maxR.toFixed(3)} → ${endR.toFixed(3)} m`);
  ok(tip[1] > 0.1, '末端在臂根上方（螺旋向上勾）', `y = ${tip[1].toFixed(3)} m（相对臂根）`);
}

// =====================================================================================
console.log('\n【5】节拍表：10 拍、严格递增、总长 25 s');
{
  ok(BEATS.length === 10, '巡览共 10 拍', String(BEATS.length));
  ok(BEATS[0].t === 0, '第一拍在 0 s');
  ok(BEATS[BEATS.length - 1].t === 24 && DURATION === 25, '最后一拍 24 s，片长 25 s（留 1 s 退场）');
  let mono = true;
  for (let i = 1; i < BEATS.length; i++) if (!(BEATS[i].t > BEATS[i - 1].t)) mono = false;
  ok(mono, '节拍时间严格单调递增', BEATS.map((b) => b.t).join(' → '));
  const keys = BEATS.map((b) => b.key);
  ok(new Set(keys).size === keys.length, '节拍 key 不重复', keys.join(', '));
  ok(BEATS[1].t === 3.5 && BEATS[2].t === 7.5 && BEATS[3].t === 10 && BEATS[4].t === 12.5, '拍点照原作：3.5 光学 / 7.5 外套膜 / 10 R2 臂 / 12.5 虹吸');
  ok(BEATS[5].t === 14.5 && BEATS[6].t === 16 && BEATS[7].t === 18.5 && BEATS[8].t === 21.5, '拍点照原作：14.5 保持 / 16 喙 / 18.5 拆解 / 21.5 重组');
  ok(BEATS.every((b) => hasCJK(b.mode) && hasCJK(b.sub) && hasCJK(b.status)), '每拍都有中文状态 / 标题 / 副标题');
  ok(BEATS.every((b) => Array.isArray(b.cam.pos) && b.cam.pos.length === 3 && b.cam.pos[1] >= 0.05), '相机位姿齐全，机位高度 ≥ 0.05 m 不穿地');
  ok(BEATS.every((b) => b.cam.fov >= 30 && b.cam.fov <= 45), '垂直视场角均在 30°–45°', BEATS.map((b) => b.cam.fov).join(' / '));
  ok(BEATS[0].cam.target[1] >= 0.45 && BEATS[0].cam.target[1] <= 0.55, '主机位 target 高 0.53 m（机体重心附近）');
  ok(beatAt(8.2).key === 'mantle' && beatAt(0).key === 'jet' && beatAt(24.5).key === 'depart', 'beatAt 查拍正确', beatAt(8.2).key);
}

// =====================================================================================
console.log('\n【6】展开动作：外套膜 70°、虹吸全伸、喙 50%、拆解 100%、转台 330°');
ok(near(petalOpen(8.5) * R2D, 70, 1e-9), '7.5–10 s 外套膜全开 = 70°', (petalOpen(8.5) * R2D).toFixed(2) + '°');
ok(petalOpen(3) * R2D < 10, '平时壳瓣只随脉冲呼吸 3°–9°', (petalOpen(3) * R2D).toFixed(2) + '°');
ok(near(petalOpen(8.5, 1) * R2D, 70, 1e-9), '传入展开量 1 时同样到 70°');
ok(PETALS === 8, '外壳 8 瓣');
{
  const s = siphonState(13.0);
  ok(s.extend > 0.95 && s.spread > 0.95, '12.5 s 拍点虹吸 3 套筒全伸、6 瓣全开', `extend ${s.extend.toFixed(2)} / spread ${s.spread.toFixed(2)}`);
  ok(siphonState(5.0).extend < 0.7, '拍点之外套筒收在 70% 以内', siphonState(5.0).extend.toFixed(2));
}
ok(near(beakOpen(17), 0.5, 0.01), '16 s 拍点双颚 50% 分离', beakOpen(17).toFixed(3));
ok(beakOpen(8.5) < 0.15, '其它拍点双颚只呼吸 < 15%', beakOpen(8.5).toFixed(3));
ok(explodeAmount(19.5) > 0.95 && explodeAmount(17) === 0 && explodeAmount(24) === 0, '拆解 19.5 s ≈100%、17 s 与 24 s 为 0');
ok(near(turretAngle(20) * R2D, 262.8, 3), '转台 20 s 时 ≈262°（原作读数）', (turretAngle(20) * R2D).toFixed(1) + '°');
ok(turretAngle(18.5) === 0 && near(turretAngle(24) * R2D, 330, 1e-6), '转台从 0 转到 330°', (turretAngle(24) * R2D).toFixed(1) + '°');

// =====================================================================================
console.log('\n【7】读数区间：所有 HUD 数字由 telemetry(t) 推出且在合理范围');
{
  const agg = {};
  const keys = ['depth', 'vs', 'pitch', 'roll', 'speed', 'battery', 'draw', 'cell', 'motor', 'load'];
  for (const k of keys) agg[k] = { min: Infinity, max: -Infinity };
  let bad = 0;
  for (let i = 0; i <= 500; i++) {
    const t = (i / 500) * DURATION;
    const s = telemetry(t);
    for (const k of keys) {
      if (!finite(s[k])) bad++;
      agg[k].min = Math.min(agg[k].min, s[k]);
      agg[k].max = Math.max(agg[k].max, s[k]);
    }
  }
  ok(bad === 0, '所有遥测值都是有限数字');
  const within = (k, lo, hi) => ok(agg[k].min >= lo && agg[k].max <= hi, `${k} ∈ [${lo}, ${hi}]`, `${agg[k].min.toFixed(2)} … ${agg[k].max.toFixed(2)}`);
  within('depth', 11.5, 13.0);
  within('vs', -0.6, 0.6);
  within('pitch', -80, 70);
  within('roll', -13, 5);
  within('speed', 0, 4);
  within('battery', 80, 90);
  within('draw', 8, 55);
  within('cell', 3.6, 3.8);
  within('motor', 20, 35);
  within('load', 0, 1);
  ok(telemetry(0).battery > telemetry(24).battery, '电量随时间下降（87% → 82.5%）', `${telemetry(0).battery.toFixed(0)}% → ${telemetry(24).battery.toFixed(0)}%`);
}

// =====================================================================================
console.log('\n【8】其它派生：脉冲曲线、汇总状态、总量核对');
{
  const h = pressureHistory(10);
  ok(h.length === 41 && near(h[40], mantlePressure(10), 1e-12), '01 面板曲线 41 点，末点 = 当前压力', h[40].toFixed(1) + ' kPa');
  ok(Math.max(...h) <= 93 + 1e-9 && Math.min(...h) >= 0, '曲线值在 0–93 kPa 内');
  const st = stateAt(8.5);
  ok(st.beat.key === 'mantle' && st.arms.length === 8 && st.telemetry.depth > 11, 'stateAt 汇总状态可用（拍点/8 臂/遥测）');
  ok(LINKS_TOTAL === 202 && WHEELS_TOTAL === 480, '202 节 / 480 轮（8 × 25 + 2 颚节；8 × 60 轮）', `${LINKS_TOTAL} / ${WHEELS_TOTAL}`);
  ok(ARMS * LINKS + 2 === LINKS_TOTAL && ARMS * WHEELS_PER_ARM === WHEELS_TOTAL, '节数 / 轮数与 8 臂配置自洽');
  ok(LINK_LEN * LINKS === 1.0, '单臂 25 节 × 40 mm = 1.0 m');
  ok(near(beatAmount('beak', 17), 1, 1e-9) && near(beatAmount('mantle', 9), 1, 1e-9), '拍内展开量到达 1');
  ok(beatParam(4, 'armBase') === 0.95 && beatParam(0, 'armBase') === 0.22, '拍参数按节拍切换（4 s 已进入光学拍）');
}

console.log(fails ? `\n${fails} 项检查未通过` : '\n全部检查通过 ✓');
process.exit(fails ? 1 : 0);
