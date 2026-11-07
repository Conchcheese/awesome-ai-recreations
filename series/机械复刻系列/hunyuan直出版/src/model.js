// model.js —— 纯数学层。禁止 import three.js / DOM。
// 唯一输入是时间 t（秒）；所有姿态、读数、曲线、行程都由 t 推导。
// 本文件为 HY4 独立直出版从零编写，不引用任何既有实现。

export const DURATION = 25;
export const PULSE_HZ = 1.8;
export const TAU = Math.PI * 2;

export const ARMS = 8;
export const LINKS = 25;
export const LINK_LEN = 0.04;                 // m
export const ARM_LEN = ARMS && LINKS * LINK_LEN; // 1.0 m
export const WHEELS_PER_ARM = 50 + 6 + 4;    // 关节轮 + 根轮 + 尖轮
export const LINKS_TOTAL = ARMS * LINKS + 2; // 202（含 2 颚节）
export const WHEELS_TOTAL = ARMS * WHEELS_PER_ARM; // 480
export const RIVETS_PER_LINK = 6;
export const RIVETS_TOTAL = ARMS * LINKS * RIVETS_PER_LINK; // 1200
export const PETALS = 8;
export const OPTICS = 2;
export const SIPHON_SLEEVES = 3;
export const NOZZLE_FLAPS = 6;
export const REACTOR_PISTONS = 7;
export const HYDRAULICS_PER_LINK = 1;

export const HUB_Y = 0.315;
export const HUB_R = 0.135;

// ---- 基础工具 -------------------------------------------------------------
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const frac = (x) => x - Math.floor(x);
export const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a || 1e-9));
  return u * u * (3 - 2 * u);
};
export const mix = (a, b, u) => a + (b - a) * u;
// 进入用 cubic-bezier(0.16,1,0.3,1) 的近似；退出用对称的缓入
const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

// ---- 喷射：唯一驱动源 -----------------------------------------------------
export function jetPhase(t) { return frac(t * PULSE_HZ); }

// 单周期内一次高斯喷流，峰在 p = 0.30；连续、可导、t=0 就有值
export function jetPulse(t) {
  const p = jetPhase(t);
  const d = (p - 0.30) / 0.175;
  return Math.exp(-d * d);
}

// ---- 节拍表：时间对齐原作关键帧，镜头语言为本版设计 -------------------------
export const SHOTS = [
  {at: 0.0,  id: 'approach', name: '喷射进场',  note: '八腕收拢 · 主喷口全开',       focus: 'jet'},
  {at: 3.5,  id: 'optics',   name: '光学阵列',  note: '双 82 mm 镜头 · 虹膜展开',   focus: 'optics'},
  {at: 7.5,  id: 'mantle',   name: '外套膜',    note: '八瓣壳张开 · 泵核外露',      focus: 'mantle'},
  {at: 10.0, id: 'arm',      name: 'R2 腕隔离', note: '第 2 腕单独抽出 · 关节特写', focus: 'arm'},
  {at: 12.5, id: 'siphon',   name: '虹吸喷口',  note: '三层套筒 · 六瓣尾喷',        focus: 'siphon'},
  {at: 14.5, id: 'hold',     name: '姿态保持',  note: '悬停 · 8 臂负载再平衡',      focus: 'hub'},
  {at: 16.0, id: 'beak',     name: '颚部机构',  note: '双颚 · 齿舌环',              focus: 'beak'},
  {at: 18.5, id: 'rebuild',  name: '机构复位',  note: '各总成归位',                 focus: 'hub'},
  {at: 20.0, id: 'teardown', name: '整机分解',  note: '六总成沿轴线分离',           focus: 'all'},
  {at: 24.0, id: 'depart',   name: '离站',      note: '喷口收束 · 退出画面',        focus: 'jet'},
];

// 机位用**球坐标**定义（az 方位角 / polar 极角 / d 距离 / target 注视点 / fov）。
// 插值时相机沿球面绕行，不会像直线插值那样从机器内部穿过去。
// d 按「机器在 1920×1080 里占 60–68%」反算：主机位约 1.7–2.3 m，特写拍点 0.94–1.34 m。
// 虹吸机位放在右后方（az 112°）而不是正后方，避免与前后两个机位形成 180° 对穿。
export const VIEWS = {
  approach: {az: 36,  polar: 81, d: 1.86, target: [0, 0.46, 0], fov: 36},
  optics:   {az: 27,  polar: 83, d: 1.42, target: [0.02, 0.57, 0.14], fov: 32},
  mantle:   {az: 31,  polar: 76, d: 1.95, target: [0, 0.56, 0], fov: 34},
  // 第 2 腕方位 67.5°，机位正对它，才能看出「单独抽出」
  arm:      {az: 70,  polar: 78, d: 1.55, target: [0.17, 0.36, 0.07], fov: 31},
  siphon:   {az: 112, polar: 82, d: 1.58, target: [0, 0.46, -0.14], fov: 34},
  hold:     {az: 34,  polar: 82, d: 1.74, target: [0, 0.49, 0], fov: 34},
  beak:     {az: 17,  polar: 86, d: 1.30, target: [0, 0.33, 0.10], fov: 31},
  rebuild:  {az: 33,  polar: 80, d: 1.70, target: [0, 0.49, 0], fov: 34},
  teardown: {az: 21,  polar: 74, d: 2.60, target: [0, 0.72, 0], fov: 40},
  depart:   {az: 37,  polar: 81, d: 2.32, target: [0, 0.48, 0], fov: 38},
};

export function shotAt(t) {
  const x = clamp(t, 0, DURATION);
  let i = SHOTS.length - 1;
  for (let k = 0; k < SHOTS.length; k++) if (SHOTS[k].at > x) { i = k - 1; break; }
  i = Math.max(0, i);
  const cur = SHOTS[i];
  const next = SHOTS[Math.min(i + 1, SHOTS.length - 1)];
  const span = Math.max(0.25, (next.at > cur.at ? next.at : DURATION) - cur.at);
  return {index: i, shot: cur, local: clamp((x - cur.at) / span), elapsed: x - cur.at};
}

const DEG = Math.PI / 180;
// 五次缓动：两端一阶、二阶导都为 0，速度与加速度都连续（C2）
const smoothstep5 = (a, b, x) => {
  const u = clamp((x - a) / (b - a || 1e-9));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
// 最短弧：方位角差折算到 (-180, 180]，避免绕远路
const shortestArc = (a, b) => (((b - a + 540) % 360) - 180);

/**
 * 相机在拍间**沿球面绕行**：az 走最短弧、polar / d / target / fov 线性。
 * 过渡铺满整个拍间隔（只留 0.22 s 稳定窗口），再叠加低频漂移，
 * 因此任何时刻都在缓慢移动，不会出现「定格 → 闪现 → 定格」。
 * fit > 1 时整体拉远（互动页要给左右面板让位），fit = 1 用于录制。
 */
export function cameraAt(t, fit = 1) {
  const {index, shot} = shotAt(t);
  const a = VIEWS[shot.id];
  const nextShot = SHOTS[Math.min(index + 1, SHOTS.length - 1)];
  const b = VIEWS[nextShot.id] || a;
  const span = Math.max(0.9, (nextShot.at > shot.at ? nextShot.at : DURATION) - shot.at);
  const u = smoothstep5(0.22, Math.max(0.30, span - 0.22), t - shot.at);

  // 低频漂移：2.1°/s 的慢摆 + 1.8% 的距离呼吸，让画面永远「活着」
  const az = a.az + shortestArc(a.az, b.az) * u + 2.1 * Math.sin(t * 0.41 + 0.6);
  const polar = mix(a.polar, b.polar, u) + 0.9 * Math.sin(t * 0.33 + 2.0);
  const d = mix(a.d, b.d, u) * (1 + 0.018 * Math.sin(t * 0.27 + 1.1)) * fit;
  const target = [
    mix(a.target[0], b.target[0], u),
    mix(a.target[1], b.target[1], u),
    mix(a.target[2], b.target[2], u),
  ];
  const sp = Math.sin(polar * DEG), cp = Math.cos(polar * DEG);
  const sa = Math.sin(az * DEG), ca = Math.cos(az * DEG);
  return {
    eye: [target[0] + sa * sp * d, target[1] + cp * d, target[2] + ca * sp * d],
    look: target,
    fov: mix(a.fov, b.fov, u),
    dist: d,
  };
}

// ---- 拍内动作量（0..1），全部由 t 推导 ------------------------------------
function shotAmount(id, t) {
  const s = SHOTS.find((x) => x.id === id);
  if (!s) return 0;
  const d = t - s.at;
  if (d < -0.15) return 0;
  // 进入 0.5 s，保持 1.6 s，退出 0.6 s
  return easeOut(clamp((d + 0.15) / 0.5)) * (1 - smooth(2.1, 2.7, d));
}

export function mantleOpen(t)  { return clamp(shotAmount('mantle', t) + 1.0 * explode(t)); }
export function opticIris(t)   { return shotAmount('optics', t); }
export function siphonExtend(t){ return shotAmount('siphon', t); }
export function beakOpen(t)    { return shotAmount('beak', t); }
export function armIsolate(t)  { return shotAmount('arm', t); }

export function explode(t) {
  // 20 s 起分离，21–23 s 保持峰值，23.6 s 后回落（对应原作 REASSEMBLY → 离站）
  return easeOut(smooth(19.6, 21.2, t)) * (1 - smooth(23.2, 24.4, t));
}

export function turretAngle(t) {
  const s = shotAt(t);
  return 0.10 * Math.sin(t * 0.42) + 0.16 * s.local * (s.shot.id === 'teardown' ? 1 : 0.25);
}

// ---- 遥测：每个数字都由 t 推导，无手写字面量 -------------------------------
export function telemetry(t) {
  const j = jetPulse(t);
  const ex = explode(t);
  const pressure = 11.5 + 64.5 * j;                    // kPa，峰值 76
  const thrust = 24 + 148 * j;                        // N，峰值 172
  const power = 16.4 + 30.6 * j + 4.2 * ex;           // W
  const battery = 87 - 0.055 * t - 0.7 * j;           // %
  const cell = 3.72 - 0.05 * j;                       // V
  const temp = 21.5 + 5.4 * j + 0.09 * t;             // °C
  const depth = 11.96 - 0.42 * Math.sin(t * 0.31) - 0.9 * ex;
  const speed = 2.87 * (0.24 + 0.76 * j) * (1 - 0.85 * ex);
  const pitch = -72.76 + 4.6 * Math.sin(t * 0.55);
  const roll = 1.78 + 2.2 * Math.sin(t * 0.37 + 0.8);
  return {pressure, thrust, power, battery, cell, temp, depth, speed, pitch, roll,
          phase: jetPhase(t), pulse: j, explode: ex};
}

// ---- 腕足运动学 -----------------------------------------------------------
// 每腕有独立的方位角；卷曲由喷射相位 + 拍点隔离 + 腕序相位共同决定
export function armAzimuth(i) { return (i / ARMS) * TAU + Math.PI / 8; }

export function armCurl(i, t) {
  const j = jetPulse(t);
  const az = armAzimuth(i);
  const base = 0.20 + 0.16 * j + 0.07 * Math.sin(t * 0.83 + az * 2.0);
  const iso = armIsolate(t) * (i === 1 ? 0.42 : -0.06);
  const ex = explode(t);
  return clamp(base + iso + 0.07 * ex * Math.sin(az * 3.0), 0.02, 0.78);
}

// 单节偏角：根部稳定，尖端逐渐卷成螺旋；与 armCurl 同源
export function armJointAngle(i, j, t) {
  const u = j / (LINKS - 1);
  const curl = armCurl(i, t);
  const wave = Math.sin(t * 2.15 * PULSE_HZ / 1.8 - u * 5.2 + armAzimuth(i) * 1.4);
  return curl * (0.10 + 0.72 * Math.pow(u, 1.65)) + 0.055 * wave * (0.25 + u);
}

export function armChain2D(i, t) {
  const pts = [[0, 0]], dirs = [];
  let x = 0, y = 0, th = -0.30;
  for (let j = 0; j < LINKS; j++) {
    th += armJointAngle(i, j, t);
    dirs.push(th);
    x += Math.cos(th) * LINK_LEN;
    y += Math.sin(th) * LINK_LEN;
    pts.push([x, y]);
  }
  const tail = pts.slice(-7);
  let cx = 0, cy = 0;
  for (const p of tail) { cx += p[0]; cy += p[1]; }
  cx /= tail.length; cy /= tail.length;
  let sr = 0;
  for (const p of tail) sr += Math.hypot(p[0] - cx, p[1] - cy);
  return {pts, dirs, tip: [x, y], spiralRadius: sr / tail.length, length: ARM_LEN};
}

export function hydraulicStroke(i, j, t) {
  const u = j / (LINKS - 1);
  return clamp(0.28 + 0.52 * jetPulse(t) + 0.20 * Math.sin(t * 1.7 + armAzimuth(i) + u * 4.0));
}

export function armLoad(i, t) {
  return clamp(0.28 + 0.42 * Math.abs(Math.sin(armAzimuth(i) + t * 0.62))
               + 0.18 * jetPulse(t) + (i === 1 ? 0.28 * armIsolate(t) : 0), 0, 1);
}

// ---- 汇总状态：HUD 与几何读同一份 -----------------------------------------
export function stateAt(t, fit = 1) {
  const x = clamp(t, 0, DURATION);
  const shot = shotAt(x);
  const tel = telemetry(x);
  return {
    t: x,
    phase: tel.phase,
    pulse: tel.pulse,
    shot,
    camera: cameraAt(x, fit),
    telemetry: tel,
    opens: {
      mantle: mantleOpen(x), optics: opticIris(x), siphon: siphonExtend(x),
      beak: beakOpen(x), isolate: armIsolate(x), explode: explode(x),
    },
    turret: turretAngle(x),
    arms: Array.from({length: ARMS}, (_, i) => ({
      index: i, azimuth: armAzimuth(i), curl: armCurl(i, x),
      load: armLoad(i, x), chain: armChain2D(i, x),
    })),
  };
}

export function structure() {
  return {
    arms: ARMS, linksPerArm: LINKS, links: LINKS_TOTAL,
    wheelsPerArm: WHEELS_PER_ARM, wheels: WHEELS_TOTAL,
    rivets: RIVETS_TOTAL, petals: PETALS, optics: OPTICS,
    siphonSleeves: SIPHON_SLEEVES, nozzleFlaps: NOZZLE_FLAPS,
    reactorPistons: REACTOR_PISTONS,
    hydraulics: ARMS * LINKS * HYDRAULICS_PER_LINK,
    armLength: ARM_LEN, duration: DURATION, pulseHz: PULSE_HZ, shots: SHOTS.length,
  };
}

// 供 HUD 画曲线：取 t 之前的等间隔采样，仍然只依赖 t
export function trace(fn, t, count = 56, span = 2.2) {
  const out = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const tk = t - span + (span * k) / (count - 1);
    out[k] = fn(tk < 0 ? tk + Math.ceil(-tk / (1 / PULSE_HZ)) * (1 / PULSE_HZ) : tk);
  }
  return out;
}
