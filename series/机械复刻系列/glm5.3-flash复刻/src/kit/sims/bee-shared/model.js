// 机械蜜蜂 Mellis HB-7, the math. A flapping-wing micro air vehicle on a floating stand.
// ONE input: the flap phase p ∈ [0,1) — one full wing stroke every 1/150 s on the machine.
// The screen plays it at 1/50 time scale (SCREEN_HZ = 3 Hz on screen) so the stroke reads;
// the panel's frequency readout shows the real 150 Hz. Every pose angle and every readout
// on the console is a pure function of p (plus the tour's slow inputs, the way the octopus
// arms ride under the tour). No three.js in this file.
//
// Parameter table (name, value, unit, source) — also in ../../07-机械蜜蜂HB-7/ref/spec.md:
//   FLAP_HZ        150        Hz     guess (real RoboBee-class flappers: 100–200 Hz, panel value)
//   DISPLAY_SCALE  1/50       -      guess (任务书: 屏上慢放, 25 s 内扑翼清晰可见)
//   STROKE_AMP     70°        deg    frame (参考帧 WING BEAT 振幅量程; 任务书 ±70°)
//   TWIST_AMP      38°        deg    guess (下拍正攻角/上拍反攻角的展弦经验值)
//   SPAN           0.048      m      guess (展示模型翼展 0.12 m → 单翼 0.048 m)
//   WING_SPAN      0.12       m      frame (任务书: 展示模型放大 ~4×; 真实同类机 0.030–0.035 m)
//   MODEL_MASS     0.42e-3    kg     guess (展示模型; 真实 RoboBee 80–100 mg, frame 公开参数)
//   GEAR_DRIVE/PINION 34/14   tooth  guess (胸内减速齿轮, 传动比 2.43)
//   BATT           3.70 V / 82%      frame (参考帧 02 POWER: 81%→80%, 3.70 V, 4.3 W, 46 °C)
//   LEG_BASE       59/74/48/49/69/62 % frame (参考帧 03 LEG SERVOS 六舵机负载)

const D2R = Math.PI / 180;

export const G = {
  FLAP_HZ: 150,
  DISPLAY_SCALE: 1 / 50,
  STROKE_AMP: 70 * D2R,
  TWIST_AMP: 38 * D2R,
  WING_SPAN: 0.12,
  SPAN: 0.048,
  CHORD: 0.02,
  PLANFORM: 0.55, // wing area ≈ PLANFORM × SPAN × CHORD
  R_MID: 0.62, // aerodynamic mean radius, fraction of span
  MODEL_MASS: 0.42e-3,
  GEAR_DRIVE: 34,
  GEAR_PINION: 14,
  BATT_V0: 3.7,
  BATT_PCT0: 82,
  LEG_BASE: [59, 74, 48, 49, 69, 62],
  BALLAST_MM: 3, // 俯仰配重滑移量程
  AIR_RHO: 1.225,
  CL0: 0.42, // baseline lift coefficient (empirical)
  CLA: 2.1, // per-radian attack-angle lift slope (empirical)
  DOWN_BIAS: 0.3, // downstroke carries more of the mean than the upstroke
};

export const SCREEN_HZ = G.FLAP_HZ * G.DISPLAY_SCALE; // 3 Hz on screen
export const GEAR_RATIO = G.GEAR_DRIVE / G.GEAR_PINION; // 2.428…
export const WING_AREA = G.PLANFORM * G.SPAN * G.CHORD; // 5.28e-4 m²
export const WEIGHT_N = G.MODEL_MASS * 9.81; // 4.12e-3 N hand-check below
export const LIFT_MEAN_WING = WEIGHT_N / 2; // hover: each wing carries half

export const frac = (x) => x - Math.floor(x);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

// ------------------------------------------------------------ the stroke
/** 拍打角 θ(p): the wing tip's stroke angle, 0 = wing plane level, + up.
 * Waveform cos(2πp) + 0.14·cos(4πp), normalised so the peak is exactly +STROKE_AMP
 * (upstroke reaches the full 70°, the downswing bottoms at −0.86·amp — the real
 * asymmetric insect stroke). Downstroke = p ∈ (0, 0.5), upstroke = (0.5, 1). */
export const strokeAngle = (p) => {
  const q = frac(p) * Math.PI * 2;
  return (G.STROKE_AMP / 1.14) * (Math.cos(q) + 0.14 * Math.cos(2 * q));
};
/** 扭转角 α(p): the chord's angle of attack about the span axis. + during the
 * downstroke (lift side up), − during the upstroke (reversed), and exactly zero at
 * the stroke reversals p = 0, 0.5 — the aero requirement the check asserts. */
export const twistAngle = (p) => G.TWIST_AMP * Math.sin(frac(p) * Math.PI * 2);
/** angular rate of the stroke, rad/s, in real machine time (× FLAP_HZ) */
export const strokeRate = (p) => {
  const q = frac(p) * Math.PI * 2;
  return -((G.STROKE_AMP / 1.14) * (Math.sin(q) + 0.28 * Math.sin(2 * q))) * Math.PI * 2 * G.FLAP_HZ;
};
/** 左右翼姿态 (pose readouts): the right wing is the exact world-mirror of the left —
 * same stroke, opposite signed twist about its own span axis. side: −1 left, +1 right. */
export const wingPose = (p, side) => {
  const s = strokeAngle(p);
  const t = twistAngle(p);
  return {stroke: s, twist: side > 0 ? t : -t, mirrorTwist: side > 0 ? -t : t};
};

// ------------------------------------------------------------ lift (single wing)
/** raw quasi-steady lift shape: 0.5·ρ·S·C(α)·v̄² with v ∝ |θ̇| at the mean radius,
 * plus the downstroke bias. Calibrated below so its mean is exactly half the weight. */
const LIFT_RAW = (p) => {
  const q = frac(p) * Math.PI * 2;
  const v = Math.abs(Math.sin(q) + 0.28 * Math.sin(2 * q)); // ∝ |θ̇| shape, unit scale
  const alpha = Math.abs(twistAngle(p));
  return 0.5 * G.AIR_RHO * WING_AREA * (G.CL0 + G.CLA * alpha) * v * v * (1 + G.DOWN_BIAS * Math.sin(q));
};
// K calibrates the empirical estimate so a hovering bee's mean wing lift = m·g/2 exactly.
const K_LIFT = (() => {
  let sum = 0;
  const N = 720;
  for (let i = 0; i < N; i++) sum += LIFT_RAW((i + 0.5) / N);
  return LIFT_MEAN_WING / (sum / N);
})();
/** 单翼升力, N — the panel's 模型估计 readout (经验式: 拍打角速度² × 攻角系数) */
export const liftN = (p) => K_LIFT * LIFT_RAW(p);
/** 升力-相位曲线, 33 samples over one stroke for the 01 panel chart */
export const liftTrace = () => Array.from({length: 33}, (_, i) => liftN(i / 32));
/** 翼尖在竖直扑动面内的轨迹 (x 外向, y 上), 65 samples, closed loop */
export const tipTrace = () =>
  Array.from({length: 65}, (_, i) => {
    const th = strokeAngle(i / 64);
    return [G.SPAN * Math.cos(th), G.SPAN * Math.sin(th)];
  });
/** peak single-wing lift and the phase it peaks at (check: mid-downstroke) */
export const liftPeak = () => {
  let best = 0;
  let at = 0;
  for (let i = 0; i < 1440; i++) {
    const p = i / 1440;
    const L = liftN(p);
    if (L > best) {
      best = L;
      at = p;
    }
  }
  return {L: best, p: at};
};
/** mean wing lift over one stroke (the hover hand-check) */
export const liftMean = () => {
  let sum = 0;
  const N = 1440;
  for (let i = 0; i < N; i++) sum += liftN(i / N);
  return sum / N;
};
/** wingtip speed, m/s, real machine time (check: stays under the 60 m/s display cap) */
export const tipSpeed = (p) => Math.abs(strokeRate(p)) * G.SPAN;
export const tipSpeedMax = () => {
  let m = 0;
  for (let i = 0; i < 1440; i++) m = Math.max(m, tipSpeed(i / 1440));
  return m;
};

// ------------------------------------------------------------ drive (胸内齿轮组)
/** crank angle = one full turn per stroke; the big gear runs the ratio the other way */
export const crankAngle = (p) => frac(p) * Math.PI * 2;
export const gearAngle = (p) => -crankAngle(p) * GEAR_RATIO;
/** crank pin position on the drive disk (thorax frame, metres) */
export const crankPin = (p) => {
  const a = crankAngle(p);
  return [0.0075 * Math.cos(a), 0.0075 * Math.sin(a)];
};

// ------------------------------------------------------------ power, flight, legs
/** 电量 %: 82 → 80 across the film (frame: 02 POWER shows 81 → 80) */
export const batteryPct = (t) => G.BATT_PCT0 - 0.08 * t;
/** 功耗 W: 4.3 W base (frame), breathing with the lift pulse */
export const drawW = (p) => 4.3 + 0.5 * (liftN(p) / LIFT_MEAN_WING - 1);
export const cellV = (t) => G.BATT_V0 - 0.0008 * t;
export const motorC = (t) => 44 + 2.4 * clamp01(t / 25) + 0.3 * Math.sin(t * 0.9);
/** 六舵机负载 %: the frame's six baselines, breathing with the stroke */
export const legLoad = (p, t) => G.LEG_BASE.map((b, i) => b + 6 * Math.sin(frac(p) * Math.PI * 2 + i * 1.1) + 1.5 * Math.sin(t * 0.8 + i));
/** 高度 mm: a slow hover band 148–164 (frame: 04 FLIGHT), rising on the departure */
export const altMm = (t, departAt = 22) => 156 + 6 * Math.sin(t * 0.55) + 150 * ss(departAt, departAt + 2.4, t);
export const vsMmS = (t, departAt = 22) => (altMm(t + 0.05, departAt) - altMm(t - 0.05, departAt)) / 0.1;
/** 俯仰°: hover trim + the tour's ballast slide (b 0..1) + a faint bob */
export const pitchDeg = (t, ballast = 0) => 0.45 + 1.6 * ballast + 0.35 * Math.sin(t * 0.7);
export const rollDeg = (t) => -0.5 + 0.6 * Math.sin(t * 0.5 + 1);
/** 配重滑移: the abdomen capsule slides forward, metres (tour input b 0..1) */
export const ballastSlide = (b) => G.BALLAST_MM * 0.001 * b;
/** 空速 m/s: hovering on station — the hover bob only */
export const airspeed = (t) => Math.abs(0.02 * Math.sin(t * 0.55));
