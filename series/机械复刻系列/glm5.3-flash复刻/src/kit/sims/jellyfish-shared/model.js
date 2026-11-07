// 机械水母 MJ-9，纯数学模型。真实单位（米、帕、牛），唯一输入：脉动相位 p ∈ [0,1) ——
// 一次完整的收缩-舒张周期，频率 PULSE_HZ。钟体的每片瓣、每节触须、泵核喷口、平衡腔活塞，
// 以及控制台上的每一个读数，都是 p（加上巡览慢输入）的纯函数。本文件不出现 three.js。
//
// 参数表（名称、值、单位、来源）——同 ../05-机械水母MJ-9/ref/spec.md：
//   PULSE_HZ        0.85      Hz    guess（水母脉动量级 0.5–1 Hz）
//   PEAK_KPA        12        kPa   guess（柔性钟腔压力峰，比硬壳喷水推进低一个量级）
//   NOZZLE_D        0.042     m     guess  → A = π·0.021² = 1.3854e-3 m²，推力峰 2·ΔP·A ≈ 33.25 N（手算）
//   BELL_R          0.25      m     guess（任务设定钟体直径约 0.5 m）
//   BELL_H          0.17      m     guess（参考钟罩高/径比 ≈0.68）
//   PETALS          8         -     frame（AquaJelly 钟缘 8 骨架）
//   PETAL_LAG       0.045     周期  guess（相邻瓣滞后，沿缘收缩波）
//   PETAL_DIP       16        deg   guess（收缩时瓣尖下压）
//   SKIRT_FLAPS     8         -     frame（裙边 8 瓣锯齿）
//   SKIRT_DENT      0.032     m     guess（收缩时裙边内收）
//   NOZZLE_FLAPS    4         -     frame（喷口 4 瓣）
//   TENTACLES       5         -     frame（任务设定 4-6 条）
//   SEG_PER_T       22        -     guess（每须链节数）
//   SEG_LEN         0.042     m     guess（触须全长约 0.92 m）
//   TENT_PHASE_STEP 1/5 周期  -     frame（相位沿须错开）
//   SWAY_MAX        26        deg   guess（节摆角幅）
//   PISTON_STROKE   0.008     m     guess（平衡腔活塞行程 ±8 mm）

const D2R = Math.PI / 180;

export const G = {
  PULSE_HZ: 0.85,
  PEAK_KPA: 12,
  NOZZLE_D: 0.042,
  BELL_R: 0.25,
  BELL_H: 0.17,
  PETALS: 8,
  PETAL_LAG: 0.045,
  PETAL_DIP: 16 * D2R,
  PETAL_OPEN: 52 * D2R,
  SKIRT_FLAPS: 8,
  SKIRT_DENT: 0.032,
  NOZZLE_FLAPS: 4,
  PUMP_D: 0.105,
  PUMP_H: 0.115,
  TENTACLES: 5,
  SEG_PER_T: 22,
  SEG_LEN: 0.042,
  SWAY_MAX: 26 * D2R,
  PISTON_STROKE: 0.008,
  // 钟缘环：触须与裙边的挂点高度（钟口平面）
  RIM_Y: -0.06,
  TENT_TILT0: 10 * D2R, // 触须根部的初始外倾
};

export const NOZZLE_A = Math.PI * (G.NOZZLE_D / 2) ** 2; // 1.3854e-3 m²
export const THRUST_PEAK = 2 * G.PEAK_KPA * 1000 * NOZZLE_A; // ≈ 33.25 N
export const SEG_TOTAL = G.TENTACLES * G.SEG_PER_T; // 110 节触须链
export const TENT_STEP = 1 / G.TENTACLES; // 相邻须相位差 1/5 周期

export const frac = (x) => x - Math.floor(x);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

// ------------------------------------------------------------ 脉动
/** 收缩 bump：每个周期一次高斯，峰在 p = 0.35（收缩偏前，舒张回弹占后半程） */
export const pulse = (p) => Math.exp(-0.5 * ((frac(p) - 0.35) / 0.12) ** 2);
/** 喷口 4 瓣：排气段张开（跟在收缩峰后），其余时间闭合节流 */
export const flap = (p) => ss(0.22, 0.34, p) * (1 - ss(0.52, 0.78, p));

export const pressureKPa = (p) => G.PEAK_KPA * pulse(p);
/** T = 2·ΔP·A，喷口瓣节流 */
export const thrustN = (p) => 2 * pressureKPa(p) * 1000 * NOZZLE_A * flap(p);
/** 巡游速度（深度面板的 SPEED） */
export const speed = (p) => 0.055 + 0.115 * pulse(p);

// ------------------------------------------------------------ 钟体
/** 整钟呼吸：收缩时半径内收、拱高拉长 */
export const bellBreath = (p) => {
  const c = pulse(p);
  return {c, r: 1 - 0.1 * c, h: 1 + 0.06 * c};
};
/** 第 i 片瓣的收缩量：沿缘滞后一波（波动绕钟口传播） */
export const petalWave = (i, p) => pulse(frac(p - i * G.PETAL_LAG));
/**
 * 瓣的铰接角：收缩波把瓣缘往里压（正 = 收拢），隔离钟体时整圈瓣向外翻开花（负 = 张开）。
 * 合成角总是落在 [-PETAL_OPEN, PETAL_DIP + PETAL_OPEN] 内。
 */
export const petalAngle = (i, p, open) => G.PETAL_DIP * petalWave(i, p) - open * G.PETAL_OPEN;
/** 裙边内收量（0..SKIRT_DENT·1.6），隔离裙边时整圈外张（dent 传负由几何处理） */
export const skirtDent = (p, open) => G.SKIRT_DENT * Math.max(pulse(p), open * 1.6);

// ------------------------------------------------------------ 触须
/**
 * 被动拖曳的摆角（绝对值，0 = 竖直向下，正 = 向外）：拖曳滞后收缩峰约 0.14 周期，
 * 波沿链节传播（u 里含 j 项），须间相位错开 1/5 周期。包络让须梢比须根摆得多。
 */
export const tentSway = (i, j, p) => {
  const u = frac(p - i * TENT_STEP - j * 0.028 - 0.14);
  const drag = pulse(u);
  const ripple = 0.5 + 0.5 * Math.sin(u * Math.PI * 2);
  const env = 0.3 + 0.7 * Math.pow(j / (G.SEG_PER_T - 1), 1.15);
  return G.SWAY_MAX * (0.5 * drag + 0.28 * ripple + 0.22) * env;
};
/** 根部外倾角：拖曳时须根也被向外推 */
export const tentTilt = (i, p) => G.TENT_TILT0 + 14 * D2R * pulse(frac(p - i * TENT_STEP - 0.14));

/**
 * 一条触须的链，在该须的竖直平面内。az = 须的方位角。填 out 数组：
 * pts（SEG_PER_T+1 个关节点 xyz）与 ang（各节方向角，弧度，0 = 竖直向下，正 = 向外）。
 * 返回末端角。纯函数，循环内不分配。
 */
export function tentacleChain(az, i, p, pts, ang, swayK = 1) {
  const rx = Math.cos(az);
  const rz = Math.sin(az);
  const tilt = tentTilt(i, p) * swayK;
  let x = rx * G.BELL_R * 0.9;
  let y = G.RIM_Y;
  let z = rz * G.BELL_R * 0.9;
  pts[0] = x;
  pts[1] = y;
  pts[2] = z;
  ang[0] = tilt;
  for (let j = 0; j < G.SEG_PER_T; j++) {
    const th = tilt + tentSway(i, j, p) * swayK * (j === 0 ? 0.6 : 1);
    const st = Math.sin(th);
    const ct = Math.cos(th);
    x += rx * st * G.SEG_LEN;
    y -= ct * G.SEG_LEN; // y 沿重力方向递减，th 正 = 向外偏
    z += rz * st * G.SEG_LEN;
    const k = (j + 1) * 3;
    pts[k] = x;
    pts[k + 1] = y;
    pts[k + 2] = z;
    ang[j + 1] = th;
  }
  return ang[G.SEG_PER_T];
}

// ------------------------------------------------------------ 泵核 / 平衡腔 / 喷口
/** 泵核状态：叶轮转速随收缩，喷口瓣开度随排气 */
export const pumpState = (p, open) => {
  const f = flap(p);
  return {spin: p * Math.PI * 2 * 3, spread: Math.max(open, f), intake: 0.15 + 0.85 * (1 - ss(0.3, 0.45, p))};
};
/** 平衡腔活塞行程：随相位微动（每周期一个往复，与收缩错相半周期） */
export const pistonStroke = (p) => G.PISTON_STROKE * Math.sin((frac(p + 0.5) - 0.5) * Math.PI * 2);

// ------------------------------------------------------------ 读数（面板专用，均从上面的量算出）
export const drawW = (p) => 9 + 16 * pulse(p); // 功耗 W
export const cellV = (batt) => 3.6 + 0.0015 * (batt - 80); // 电芯电压
