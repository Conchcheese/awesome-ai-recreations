// 仿生沙虫 MK-X，数学核心。真实单位（米、帕、牛、rpm），唯一输入：爬行相位 p ∈ [0,1)
// —— 一个蠕动波周期（1/0.55 秒）。每一个姿态角、每一条面板读数都是 p（加上巡览的慢变
// 模式量：里程 s、埋深 depth、升出量 lift）的纯函数。本文件没有 three.js。
//
// 参数表（名称、值、单位、来源）——同样写在 ../../04-仿生沙虫MK-X/ref/spec.md：
//   WAVE_HZ      0.55    Hz    guess（蠕动波频率，机器的心跳）
//   RING_N       14      -     guess（12–16 环段取中）
//   PITCH        0.20    m     guess（环距）
//   R_BODY       0.25    m     guess（环段体半径）
//   BULGE        0.32    -     guess（波峰处径向鼓胀 +32%）
//   CONSTRICT    0.18    -     guess（波谷处径向收缩 −18%）
//   EPS_L        0.10    -     guess（纵向应变）→ v = λ·f·ε（手算 0.154 m/s）
//   PEAK_KPA     220     kPa   guess（环段液压峰值）
//   RPM_IDLE/MAX 12/46   rpm   guess（钻速随波峰加载）
//   T0/KT        180/260 N·m   guess（空钻扭矩 / 波峰增益）
//   MAW_TEETH    24      -     frame（2021 剧照：针齿向圆心辐射，取整 24）
//   JAWS         8       -     frame（剧照口缘分瓣）
//   JAW_MAX      26      °     guess（颚片最大张角）
//   DEPTH_CRUISE 0.42    m     guess（巡航埋深，轴心到沙面）

const D2R = Math.PI / 180;

export const G = {
  WAVE_HZ: 0.55,
  RING_N: 14,
  PITCH: 0.2,
  R_BODY: 0.25,
  BULGE: 0.32,
  CONSTRICT: 0.18,
  EPS_L: 0.1,
  PEAK_KPA: 220,
  RPM_IDLE: 12,
  RPM_MAX: 46,
  T0: 180,
  KT: 260,
  HEAD_R: 0.3,
  HEAD_LEN: 0.46,
  MAW_R: 0.17,
  MAW_TEETH: 24,
  JAWS: 8,
  JAW_MAX: 26 * D2R,
  DRILL_R: 0.095,
  DRILL_BLADES: 3,
  NOZZLE_R: 0.055,
  TAIL_LEN: 0.34,
  DEPTH_CRUISE: 0.42,
  SPRAY_N: 26,
  SAND_W: 9,
  SAND_D: 6,
  // 行进路径：一条缓弧（曲率 1/m），虫沿 +x 前进，轨迹图照它画
  CURV: 0.045,
  // 环带螺栓（每节 6 颗，frame：剧照体表一圈圈棱环取 6 点）
  BAND_BOLTS: 6,
};

// 环段区长度与波长（一个鼓包走完全身），波速 c = λ·f
export const BODY_LEN = G.RING_N * G.PITCH; // 2.8 m
export const LAMBDA = BODY_LEN; // 2.8 m
export const WAVE_C = LAMBDA * G.WAVE_HZ; // 1.54 m/s
export const SPEED_BASE = WAVE_C * G.EPS_L; // 0.154 m/s（手算核对值）
export const TOTAL_LEN = G.HEAD_LEN + BODY_LEN + G.TAIL_LEN; // ≈3.60 m
export const DRILL_PEAK_RPM = G.RPM_MAX;
export const TORQUE_PEAK = G.T0 + G.KT; // 440 N·m
export const POWER_PEAK_W = TORQUE_PEAK * (G.RPM_MAX * 2 * Math.PI) / 60; // P = T·ω

export const WAVE_HZ = G.WAVE_HZ;
export const PEAK_KPA = G.PEAK_KPA;
export const frac = (x) => x - Math.floor(x);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ss = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** 皮肤相对虫体后滑速率（环距/秒）：v = c·ε 的整流效应，棱环纹理按它后移 */
export const SKIN_SLIDE = SPEED_BASE / G.PITCH;

// ------------------------------------------------------------ 蠕动波
/** 周期鼓包：峰在 φ=0，用 cos 形式保证首尾相接无跳变 */
export const bulge = (phi) => Math.exp(6 * (Math.cos(Math.PI * 2 * frac(phi)) - 1));
/** 第 i 节的波相位：波从头向尾传播（真实蚯蚓/沙虫蠕动方向） */
export const ringPhase = (i, p) => frac(p - (i * G.PITCH) / LAMBDA);
/** 第 i 节半径：波峰鼓胀、波谷收缩，沿身向尾微收 */
export const ringTaper = (i) => 1 - 0.3 * Math.pow(i / (G.RING_N - 1), 1.4);
export const ringRadius = (i, p) => {
  const b = bulge(ringPhase(i, p));
  return G.R_BODY * ringTaper(i) * (1 + G.BULGE * b - G.CONSTRICT * (1 - b));
};
/** 环段波面板的鼓胀百分比：把半径归一到 [收缩, 鼓胀] 区间 */
export const ringBulgePct = (i, p) => {
  const r = ringRadius(i, p) / (G.R_BODY * ringTaper(i));
  return clamp01((r - (1 - G.CONSTRICT)) / (G.BULGE + G.CONSTRICT)) * 100;
};
/** 波峰所在节（实时读数用） */
export const waveCrest = (p) => frac(p) * LAMBDA; // 波峰距头端的弧长

// ------------------------------------------------------------ 读数（全部从 p 算出）
/** 环段液压 kPa：波峰处峰值 */
export const pressureKPa = (p) => G.PEAK_KPA * bulge(frac(p));
/** 钻速 rpm：波峰加载到头部时提速（头部相位超前环段 0.15 个周期） */
export const drillRpm = (p) => G.RPM_IDLE + (G.RPM_MAX - G.RPM_IDLE) * bulge(frac(p + 0.15));
/** 头部扭矩 N·m：空钻 + 波峰增益 */
export const headTorque = (p) => G.T0 + G.KT * bulge(frac(p));
/** 钻进功率 W：P = T·ω（ω 由 rpm 换算，恒等式由构造保证） */
export const drillPowerW = (p) => headTorque(p) * ((drillRpm(p) * 2 * Math.PI) / 60);
/** 前进速度 m/s：v = c·ε·(1 + 0.25·波峰加成) */
export const speed = (p) => SPEED_BASE * (1 + 0.25 * bulge(frac(p + 0.3)));
/** 颚环张角：波峰抵达头部时张到最大 */
export const jawAngle = (p) => G.JAW_MAX * (0.22 + 0.78 * bulge(frac(p + 0.5)));
/** 尾喷排沙率 0..1：波传到尾端时喷发 */
export const sprayRate = (p) => bulge(frac(p + 0.86));
/** 钻芯累计转角：由 rpm 积分（闭式——rpm 是 p 的已知周期函数，dt 内线性足够） */
export const drillAngleAt = (table, t) => {
  const u = clamp01(t / table.dt) * (table.n - 1);
  const i = Math.min(table.n - 2, Math.floor(u));
  return table.a[i] + (table.a[i + 1] - table.a[i]) * (u - i);
};

// ------------------------------------------------------------ 行进路径（缓弧，闭式）
/** 里程 s 处的世界坐标与航向角（绕 y）。x = sin(κs)/κ, z = (1−cos κs)/κ, θ = κs */
export const pathAt = (s) => ({
  x: Math.sin(G.CURV * s) / G.CURV,
  z: (1 - Math.cos(G.CURV * s)) / G.CURV,
  th: G.CURV * s,
});
/** 环段 i 距头端的弧长（头段在 s，环段向后排） */
export const ringArc = (i) => G.HEAD_LEN + i * G.PITCH;

// ------------------------------------------------------------ 埋深与姿态
/** 环段 i 的竖向微动：埋着的虫体有极轻的起伏（不穿沙面：幅度 8 mm） */
export const ringDy = (i, p) => 0.008 * Math.sin(Math.PI * 2 * p - i * 0.42);
/** 头部俯仰：钻进时低头，波峰时抬头一点（rad） */
export const headPitch = (p) => -0.1 + 0.06 * bulge(frac(p + 0.2));

// ------------------------------------------------------------ 深度剖面（04 面板 svg 用）
export const STRATA = [
  {name: '沙面', top: 0, bot: -0.35, shade: 0.0},
  {name: '浅沙层', top: -0.35, bot: -0.62, shade: 0.5},
  {name: '深沙层', top: -0.62, bot: -0.95, shade: 1},
];
export const DEPTH_MIN = -0.95;
