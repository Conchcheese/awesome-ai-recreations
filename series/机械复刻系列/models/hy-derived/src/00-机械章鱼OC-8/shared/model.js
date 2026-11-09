// 00 机械章鱼 Pelagos OC-8 · 宝石蓝版 · 运动学核心
//
// 独立实现：唯一输入是时间 t（秒），喷射相位 p = frac(t · 1.8)。
// 所有姿态角、关节量、遥测读数都是 t 的纯函数；页面与 HUD 只格式化，不写死任何数字。
// 无 three / 无 DOM / 无副作用，可直接被 check.mjs 在 Node 里导入断言。
//
// 单位：长度 m、压力 kPa、推力 N、扭矩 N·m、角度内部一律弧度。
// 坐标：Y 轴朝上、地面 y=0、机器正面 +Z。
// 每个常量标来源：[frame] 原作逐帧可读 · [ref] 控制台/规格书 · [calc] 公式推出 · [guess] 按比例估算。

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- 规格常量 */
export const PULSE_HZ = 1.8;                       // 脉冲频率 [frame]
export const PULSE_PERIOD = 1 / PULSE_HZ;         // 0.55556 s [calc]
export const PULSE_SIGMA = 0.13;                  // 高斯脉冲宽度（相位）[guess]
export const PEAK_KPA = 93;                       // 外套膜峰值压力 [frame]
export const NOZZLE_D = 0.038;                    // 喷口直径 38 mm [ref]
export const NOZZLE_A = Math.PI * (NOZZLE_D / 2) ** 2; // 1.1341e-3 m² [calc]
export const THRUST_PEAK = 2 * PEAK_KPA * 1000 * NOZZLE_A; // ≈ 210.9 N [calc]
export const THRUST_FLOOR = 0.12;                 // 待机泄漏开度 [guess]

export const MANTLE_LEN = 0.42;                   // 外套膜长 420 mm [ref]
export const MANTLE_DIA = 0.30;                   // 外套膜直径 300 mm [ref]
export const MANTLE_R = MANTLE_DIA / 2;
export const PETALS = 8;                          // 8 片壳瓣 [frame]
export const PETAL_OPEN = 70 * D2R;               // 全开 70° [ref]
export const PORT_D = 0.12;                      // 玻璃舷窗 120 mm [ref]
export const OPTIC_D = 0.082;                    // 光学镜头 82 mm [frame]
export const OPTIC_IRIS_BLADES = 10;             // 光圈 10 叶 [frame]
export const OPTIC_IR_LEDS = 16;                 // 红外环 16 颗 [frame]

export const ARMS = 8;                            // 8 条腕 [frame]
export const LINKS = 25;                          // 每腕 25 节 [frame]
export const LINK_LEN = 0.04;                     // 节距 40 mm [ref]
export const ARM_LEN = LINKS * LINK_LEN;          // 1.0 m [calc]
export const JOINT_MAX = 26 * D2R;                // 单关节最大弯角 26° [calc]
export const WHEELS_PER_ARM = 60;                 // 每腕 60 轮 [frame]
export const LINKS_TOTAL = ARMS * LINKS + 2;      // 202 节（含双颚 2 节）[frame]
export const WHEELS_TOTAL = ARMS * WHEELS_PER_ARM; // 480 轮 [frame]
export const RIVETS_PER_LINK = 6;                 // 每节 6 颗铆钉 [guess]
export const RIVETS_TOTAL = ARMS * LINKS * RIVETS_PER_LINK; // 1200 [calc]
export const HYDRAULIC_PER_LINK = 2;              // 每节 2 根液压微缸 [guess]
export const SPIRAL_TIP_LINKS = 16;               // 末端 16 节收成螺旋 [frame]
export const ARM_NAMES = ['R1', 'R2', 'R3', 'R4', 'L1', 'L2', 'L3', 'L4'];
export const ARM_ISO_INDEX = 1;                   // 「R2 腕」= 索引 1

export const HUB_R = 0.165;                       // 腕毂安装半径 [guess]
export const HUB_Y = 0.40;                        // 腕毂高度 [guess]
export const ARM_PITCH0 = -18 * D2R;              // 腕根初倾角 [guess]

export const SIPHON_D = 0.038;                    // 喷口 38 mm [ref]
export const SIPHON_SLEEVES = 3;                  // 3 层套筒 [frame]
export const NOZZLE_FLAPS = 6;                    // 6 瓣喷口 [frame]
export const TURBINE_BLADES = 12;                 // 涡轮 12 叶 [frame]
export const BEAK_RADULA_D = 0.09;                // 齿舌环 90 mm [ref]
export const REACTOR_PISTONS = 7;                 // 泵核 7 活塞 [frame]
export const TURRET_TOTAL = 330 * D2R;            // 拆解转台 330° [frame]
export const DURATION = 25;                       // 巡览 25 s [frame]

/** 机体世界锚点（米）[guess] */
export const BODY = {
  centerY: 0.55, mantleCenterY: 0.62, mantleBottomY: 0.41, mantleTopY: 0.83,
  petalHingeY: 0.60, hubY: HUB_Y, hubR: HUB_R,
  portY: 0.49, portZ: 0.137, opticY: 0.638, opticZ: 0.115,
  siphonY: 0.30, siphonZ: -0.17, beakY: 0.318, armRootY: HUB_Y,
};

/** 装配体统计（HUD 07 / 09 面板与 check.mjs 共用，禁止别处写死） */
export function structureCounts() {
  return {
    arms: ARMS, linksPerArm: LINKS, links: LINKS_TOTAL,
    wheelsPerArm: WHEELS_PER_ARM, wheels: WHEELS_TOTAL,
    rivets: RIVETS_TOTAL, hydraulics: ARMS * LINKS * HYDRAULIC_PER_LINK,
    petals: PETALS, opticLenses: 2, siphonSleeves: SIPHON_SLEEVES,
    nozzleFlaps: NOZZLE_FLAPS, turbineBlades: TURBINE_BLADES,
    reactorPistons: REACTOR_PISTONS, irisBlades: OPTIC_IRIS_BLADES,
    irLeds: OPTIC_IR_LEDS,
  };
}

/* ---------------------------------------------------------------- 基础工具 */
export const frac = (x) => x - Math.floor(x);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const wrapHalf = (p) => (frac(p) < 0.5 ? frac(p) : frac(p) - 1);
export const smoothstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
export const smootherstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
/** 固定种子伪随机（几何构造用，保证每次加载完全一致） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- 喷射心跳 */
export const jetPulse = (t) => frac(t * PULSE_HZ);
/** 单脉冲包络：高斯，峰在 p=0（t=0 即落在峰值，第 0 帧就有内容） */
export const pulseShape = (p) => Math.exp(-0.5 * (wrapHalf(p) / PULSE_SIGMA) ** 2);
export const mantlePressure = (t) => PEAK_KPA * pulseShape(jetPulse(t));

/** 喷口瓣开度 0..1：呼气峰附近全开，其余保留 12% 泄漏 */
export function flapOpen(p) {
  const s = wrapHalf(p);
  const open = smoothstep(-0.13, -0.02, s) * (1 - smoothstep(0.05, 0.18, s));
  return THRUST_FLOOR + (1 - THRUST_FLOOR) * open;
}
/** T = 2·ΔP·A·开度；峰值 ≈ 210.9 N [calc] */
export const thrust = (t) => 2 * mantlePressure(t) * 1000 * NOZZLE_A * flapOpen(jetPulse(t));
export const thrustN = thrust;
export const jetLoad = (t) => clamp(pulseShape(jetPulse(t)) * flapOpen(jetPulse(t)));

/** 外套膜呼吸：脉冲时收窄 5%、拉长 4.5% */
export function mantleBreath(t) {
  const s = pulseShape(jetPulse(t));
  return {r: 1 - 0.05 * s, len: 1 + 0.045 * s};
}

/* ---------------------------------------------------------------- 25 s 巡览节拍 */
// 机位 {pos:[x,y,z], target:[x,y,z], fov}；全身拍保证 8 腕完整入画，特写靠拉远而非缩 fov。
const CAM = {
  hero:     {pos: [1.62, 1.68, 2.02], target: [0, 0.50, 0.02], fov: 34},
  optics:   {pos: [0.40, 0.98, 1.54], target: [0, 0.61, 0.05], fov: 33},
  mantle:   {pos: [0.90, 1.74, 1.44], target: [0, 0.58, 0.00], fov: 34},
  // R2 腕拍点推成中近景：让关节法兰 / 辐条滚轮 / 波纹万向节在成片里可辨
  arm:      {pos: [-0.28, 0.78, 1.46], target: [0.14, 0.40, 0.04], fov: 33},
  siphon:   {pos: [-1.04, 0.42, -2.12], target: [0, 0.37, -0.16], fov: 34},
  hold:     {pos: [0.52, 0.97, 1.82], target: [0, 0.52, 0.00], fov: 33},
  beak:     {pos: [0.66, 0.20, 2.27], target: [0, 0.30, 0.04], fov: 34},
  teardown: {pos: [1.47, 2.07, 1.97], target: [0, 0.52, 0.00], fov: 34},
  rebuild:  {pos: [1.87, 1.47, 2.27], target: [0, 0.52, 0.00], fov: 34},
  depart:   {pos: [2.02, 1.17, 2.37], target: [0, 0.55, 0.00], fov: 34},
};

/** 10 拍：0 喷进 · 3.5 光学 · 7.5 外套膜 · 10 R2 腕 · 12.5 虹吸 ·
 *         14.5 保持 · 16 喙 · 18.5 拆解 · 21.5 重组 · 24 离站 [frame] */
export const BEATS = [
  {t: 0,    key: 'jet',      status: '喷射中',     mode: '喷射循环',   sub: '脉冲 1.8 Hz · 峰值推力 211 N', phase: '自动 · 喷射循环',      isolate: 'hero',    armBase: 0.22, armAmp: 0.12, cam: CAM.hero},
  {t: 3.5,  key: 'optics',   status: '跟踪中',     mode: '光学跟踪',   sub: '2 × 82 mm 镜头 · 红外环开启', phase: '操作员 · 隔离光学',    isolate: 'optics',  armBase: 0.95, armAmp: 0.05, cam: CAM.optics},
  {t: 7.5,  key: 'mantle',   status: '外套膜张开', mode: '外套膜张开', sub: '8 瓣 · 70° 张开 · 脑核升起', phase: '操作员 · 隔离外套膜',  isolate: 'mantle',  armBase: 0.94, armAmp: 0.06, cam: CAM.mantle},
  {t: 10,   key: 'arm',      status: 'R2 腕分离',  mode: 'R2 腕分离',  sub: '25 节 · 60 轮 · 100% 展开', phase: '操作员 · 隔离 R2 腕',  isolate: 'arm2',    armBase: 0.74, armAmp: 0.14, cam: CAM.arm},
  {t: 12.5, key: 'siphon',   status: '虹吸张开',   mode: '虹吸张开',   sub: '3 套筒 · 6 瓣喷口 · 全伸',  phase: '操作员 · 隔离虹吸',    isolate: 'siphon',  armBase: 0.94, armAmp: 0.06, cam: CAM.siphon},
  {t: 14.5, key: 'hold',     status: '保持',       mode: '站位保持',   sub: '站位保持 · 深度 12.4 m',    phase: '操作员 · 站位保持',    isolate: 'hero',    armBase: 0.84, armAmp: 0.14, cam: CAM.hold},
  {t: 16,   key: 'beak',     status: '喙张开',     mode: '喙张开',     sub: '双颚 50% 分离 · 齿舌环旋转', phase: '操作员 · 隔离喙',     isolate: 'beak',    armBase: 0.94, armAmp: 0.06, cam: CAM.beak},
  {t: 18.5, key: 'teardown', status: '整机拆解',   mode: '整机拆解',   sub: '转台旋转 · 202 节全分离',   phase: '操作员 · 整机拆解',    isolate: 'hero',    armBase: 0.50, armAmp: 0.30, cam: CAM.teardown},
  {t: 21.5, key: 'rebuild',  status: '重组',       mode: '重组',       sub: '转台 330° · 重新对接',      phase: '操作员 · 重组',        isolate: 'hero',    armBase: 0.70, armAmp: 0.12, cam: CAM.rebuild},
  {t: 24,   key: 'depart',   status: '离站',       mode: '离站',       sub: '升离站位 · 推进器点火',     phase: '自动 · 离站',          isolate: 'hero',    armBase: 0.20, armAmp: 0.10, cam: CAM.depart},
];

export function beatAt(t) {
  const tt = clamp(t, 0, DURATION);
  let b = BEATS[0];
  for (const x of BEATS) if (x.t <= tt) b = x;
  return b;
}
export const beatProgress = (t) => clamp(t / DURATION);
export function nextBeatT(key) {
  const i = BEATS.findIndex((b) => b.key === key);
  return i >= 0 && i < BEATS.length - 1 ? BEATS[i + 1].t : DURATION;
}
/** 某拍的展开量：拍点前 0.9 s 进入、拍点后 0.2 s 到位，下一拍前渐退 */
export function beatAmount(key, t) {
  const i = BEATS.findIndex((b) => b.key === key);
  if (i < 0) return 0;
  const a = BEATS[i].t, b = nextBeatT(key), span = b - a;
  const in0 = a - 0.9, in1 = a + Math.min(0.2, span * 0.1);
  const out0 = b - Math.min(0.7, span * 0.35), out1 = b - 0.02;
  return clamp(smootherstep(in0, in1, t) * (1 - smootherstep(out0, out1, t)));
}
/** 拍参数（armBase / armAmp）在拍点前 0.9 s 平滑过渡，保证 HUD 与姿态同步 */
export function beatParam(t, field) {
  let i = 0;
  for (let k = 0; k < BEATS.length; k++) if (BEATS[k].t <= t) i = k;
  const cur = BEATS[i];
  if (i === 0) return cur[field];
  return lerp(BEATS[i - 1][field], cur[field], smootherstep(cur.t - 0.9, cur.t, t));
}

/* ---------------------------------------------------------------- 外套膜 / 光学 */
/** 壳瓣铰接角：平时随脉冲呼吸，「外套膜张开」拍全开 70° */
export function petalOpen(t, open = null) {
  const amt = open == null ? beatAmount('mantle', t) : clamp(open);
  const breath = (0.8 + 2.2 * pulseShape(jetPulse(t))) * D2R;
  return Math.max(PETAL_OPEN * amt, breath);
}
/** 光学：对焦行程、红外亮度、光圈开度 */
export function opticState(t) {
  const s = pulseShape(jetPulse(t));
  return {focus: 0.30 + 0.14 * Math.sin(t * 1.3), ir: 0.25 + 0.75 * s, iris: 0.55 + 0.35 * s};
}

/* ---------------------------------------------------------------- 8 条腕链 */
/** 弯曲包络：前 3 节近直，越靠末端弯得越狠，100% 时收成螺旋 */
export const bendEnvelope = (j) => 0.05 + 0.95 * Math.pow(Math.max(0, (j - 3) / (LINKS - 4)), 1.35);

/** 单腕卷曲指令 0..1：基础握持 + 沿 8 腕滚动的脉冲波（相邻腕差 1/8 周期） */
export function armCurl(t, armIdx = 0) {
  const base = beatParam(t, 'armBase');
  const amp = beatParam(t, 'armAmp');
  let c = base + amp * pulseShape(frac(jetPulse(t) - armIdx / ARMS));
  if (armIdx === ARM_ISO_INDEX) c = lerp(c, 0.12, beatAmount('arm', t));
  return clamp(c);
}
export const armWave = (t) => Array.from({length: ARMS}, (_, i) => armCurl(t, i));
export const armCurlPct = (t, armIdx = 0) => armCurl(t, armIdx) * 100;

/** 单腕 25 个关节相对转角（弧度） */
export function armJointAngles(armIdx, t) {
  const cmd = armCurl(t, armIdx);
  return Array.from({length: LINKS}, (_, j) => JOINT_MAX * bendEnvelope(j) * cmd);
}

/**
 * 单腕 2D 折线（腕平面：+x 为离体径向、+y 为世界向上）。
 * 返回 {pts:[[x,y]...26], headings:[...26], length, tip, spiralRadius}。
 * 3D 装配时 dir = (sin az·cos th, sin th, cos az·cos th)。
 */
export function armChain2D(armIdx, t) {
  const angles = armJointAngles(armIdx, t);
  const pts = [[0, 0]], headings = [];
  let th = ARM_PITCH0, x = 0, y = 0;
  headings.push(th);
  for (let j = 0; j < LINKS; j++) {
    th += angles[j];
    x += Math.cos(th) * LINK_LEN;
    y += Math.sin(th) * LINK_LEN;
    pts.push([x, y]);
    headings.push(th);
  }
  // 腕尖螺旋半径：用末端 6 节到其重心的平均距离（HUD 09 面板读数）
  let cx = 0, cy = 0;
  for (let k = LINKS - 6; k <= LINKS; k++) { cx += pts[k][0]; cy += pts[k][1]; }
  cx /= 7; cy /= 7;
  let sr = 0;
  for (let k = LINKS - 6; k <= LINKS; k++) sr += Math.hypot(pts[k][0] - cx, pts[k][1] - cy);
  return {pts, headings, length: ARM_LEN, tip: [x, y], spiralRadius: sr / 7};
}

/** 关节驱动量：液压微缸行程 0..1（由该节弯角与脉冲共同推出）[calc] */
export function hydraulicStroke(t, armIdx, j) {
  const a = armJointAngles(armIdx, t)[j];
  const s = pulseShape(frac(jetPulse(t) - armIdx / ARMS - j / (LINKS * 2)));
  return clamp(Math.abs(a) / JOINT_MAX * 0.82 + 0.18 * s);
}
/** 关节扭矩 N·m：弯角 × 等效刚度 × 负载，纯公式推导 [calc/guess] */
export function jointTorque(t, armIdx, j) {
  const a = armJointAngles(armIdx, t)[j];
  const load = 0.55 + 0.45 * pulseShape(jetPulse(t));
  return (0.9 + 7.2 * load) * Math.abs(a) / JOINT_MAX * (1 - 0.35 * j / LINKS);
}
/** 滚轮转速 rpm：由脉冲与臂的卷曲变化率推出 [calc] */
export function wheelRpm(t, armIdx = 0) {
  const h = 0.02;
  const dc = (armCurl(t + h, armIdx) - armCurl(t - h, armIdx)) / (2 * h);
  const jet = pulseShape(jetPulse(t));
  return 18 + 260 * Math.abs(dc) + 95 * jet;
}
/** 单腕当前最大关节角（度）与腕尖螺旋半径（mm） */
export function armDetail(t, armIdx = 0) {
  const angles = armJointAngles(armIdx, t);
  const chain = armChain2D(armIdx, t);
  let peak = 0;
  for (const a of angles) peak = Math.max(peak, Math.abs(a));
  return {
    peakDeg: peak * R2D,
    spiralMm: chain.spiralRadius * 1000,
    stroke: hydraulicStroke(t, armIdx, 14),
    torque: jointTorque(t, armIdx, 14),
    rpm: wheelRpm(t, armIdx),
  };
}

/* ---------------------------------------------------------------- 虹吸 / 喙 / 拆解 / 转台 */
export function siphonState(t) {
  const open = beatAmount('siphon', t);
  const f = flapOpen(jetPulse(t));
  return {
    extend: clamp(Math.max(0.10 + 0.45 * f, open)),
    spread: clamp(Math.max(0.90 * f, open)),
    open,
    turbine: pulseShape(jetPulse(t)),
  };
}
/** 双颚开度：平时 5% 呼吸，16 s 拍点张到 50% [frame] */
export function beakOpen(t) {
  const idle = 0.05 + 0.10 * pulseShape(jetPulse(t));
  return clamp(Math.max(idle, 0.5 * beatAmount('beak', t)), 0, 0.5);
}
export function beakState(t) {
  return {jaw: beakOpen(t), radula: t * 2.2};
}
/** 整机拆解量：18.55 s 升到 100%，22.3 s 收完 */
export function explodeAmount(t) {
  return clamp(smootherstep(18.55, 19.6, t) * (1 - smootherstep(20.2, 22.3, t)));
}
/** 转台角：18.6 s 起 easeOut 转到 330°，22 s 到位 */
export function turretAngle(t) {
  const u = clamp((t - 18.6) / (22 - 18.6));
  return TURRET_TOTAL * (1 - (1 - u) ** 3);
}

/* ---------------------------------------------------------------- 遥测 */
// 逐拍姿态读数（照原作 HUD 帧）[frame]；中间用 smootherstep 插值，仍是 t 的纯函数。
const PITCH_KEYS = [[0, -73], [3.5, -2], [7.5, -1.5], [10, 2], [12.5, -2], [14.5, 12], [16, 59], [18.5, 2], [21.5, -1], [24, -74], [25, -74]];
const ROLL_KEYS  = [[0, 1.8], [3.5, -0.2], [7.5, -0.9], [10, -0.9], [12.5, 2], [14.5, -1.4], [16, -0.3], [18.5, 0], [21.5, -0.5], [24, -12.6], [25, -12.6]];
const SPEED_KEYS = [[0, 2.87], [3.5, 0.02], [7.5, 0.08], [10, 0.09], [12.5, 0.06], [14.5, 0.57], [16, 0.12], [18.5, 0], [21.5, 0.09], [24, 2.01], [25, 2.01]];

function keyLerp(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return lerp(v0, v1, smootherstep(t0, t1, t));
    }
  }
  return keys[keys.length - 1][1];
}
export const depthAt = (t) => 12.42 - 0.06 * Math.sin(0.8 * t) - 0.03 * Math.sin(2.3 * t) - 0.62 * smootherstep(22.6, 24.8, t);

export function telemetry(t) {
  const h = 0.01, load = jetLoad(t);
  return {
    depth: depthAt(t),
    vs: (depthAt(t + h) - depthAt(t - h)) / (2 * h),
    pitch: keyLerp(PITCH_KEYS, t),
    roll: keyLerp(ROLL_KEYS, t),
    speed: keyLerp(SPEED_KEYS, t),
    battery: clamp(87 - 0.18 * t, 0, 100),
    draw: clamp(10 + 34 * load + 3 * Math.sin(0.9 * t + 0.4) + 2, 0, 99),
    cell: 3.72 - 0.0006 * t + 0.0015 * Math.sin(1.3 * t),
    motor: 24 + 3.2 * load + 2 * Math.sin(0.4 * t + 0.6),
    load,
  };
}
/** 01 面板「-1.2 s → 现在」压力曲线 */
export function pressureHistory(t, n = 41, span = 1.2) {
  return Array.from({length: n}, (_, i) => mantlePressure(t - span + (span * i) / (n - 1)));
}
/** 03 面板八腕弯曲曲线（用于迷你趋势图） */
export function curlHistory(t, armIdx = 1, n = 30, span = 1.2) {
  return Array.from({length: n}, (_, i) => armCurl(t - span + (span * i) / (n - 1), armIdx) * 100);
}

/** 汇总状态：页面每帧调用一次 */
export function stateAt(t) {
  const opens = {
    mantle: beatAmount('mantle', t), siphon: beatAmount('siphon', t),
    beak: beatAmount('beak', t), arm: beatAmount('arm', t),
  };
  return {
    t, p: jetPulse(t), beat: beatAt(t), opens,
    explode: explodeAmount(t), turret: turretAngle(t),
    petals: petalOpen(t, opens.mantle), breathe: mantleBreath(t),
    optics: opticState(t), siphon: siphonState(t), beak: beakState(t),
    arms: Array.from({length: ARMS}, (_, i) => ({curl: armCurl(t, i), angles: armJointAngles(i, t)})),
    telemetry: telemetry(t),
  };
}
