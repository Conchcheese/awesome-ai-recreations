// 00 机械章鱼 OC-8 · DeepSeek 版 · 共享数学核心（纯 ESM，无 three、无 DOM、无副作用）
//
// 唯一输入是时间 t（秒）：心跳相位 p = frac(t · 1.8)。本文件里每一个姿态角、每一个读数
// 都是 t 的纯函数，页面/HUD 只做格式化，不写死任何数字。检查脚本见 ./check.mjs。
//
// 单位约定：长度 m、压力 kPa、推力 N、角度输入用弧度、HUD 显示由页面转成 °。
// 坐标约定（与 kit 一致）：Y 轴朝上、世界原点在地面 y=0、机器正面朝 +Z。
// 参数来源标注：[frame] = 原作逐帧可读；[guess] = 按比例估算；[calc] = 由公式推出。

// ---------------------------------------------------------------- 常量表
export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

// 心跳：1.8 Hz，一次脉冲 0.5556 s [frame]（参考帧 JET 面板 1.8 HZ）
export const PULSE_HZ = 1.8;
export const PULSE_PERIOD = 1 / PULSE_HZ; // 0.55556 s [calc]
export const PULSE_SIGMA = 0.13; // 脉冲宽度（相位）[guess]
export const PEAK_KPA = 93; // 峰值外套膜压力 [frame]
export const NOZZLE_D = 0.038; // 喷口直径 38 mm [guess]
export const NOZZLE_A = Math.PI * (NOZZLE_D / 2) ** 2; // 1.1341e-3 m² [calc]
export const THRUST_PEAK = 2 * PEAK_KPA * 1000 * NOZZLE_A; // ≈ 210.9 N [calc]
export const THRUST_FLOOR = 0.12; // 喷口最小开度（读数不为 0 的余量）[guess]

// 整机规模 [frame/guess]
export const MANTLE_LEN = 0.42; // 外套膜长 420 mm [guess]
export const MANTLE_DIA = 0.3; // 外套膜直径 300 mm [guess]
export const PETALS = 8; // 8 片壳瓣 [frame]
export const PETAL_OPEN = 70 * D2R; // 全开 70° [guess]
export const OPTIC_D = 0.082; // 光学镜头 82 mm [frame]
export const OPTIC_IRIS_BLADES = 10; // 光圈 10 叶片 [frame]
export const OPTIC_IR_LEDS = 16; // 红外环 16 颗 LED · 850 nm [frame]
export const PORT_D = 0.12; // 正面玻璃舷窗 120 mm [guess]
export const ARMS = 8; // 8 臂 [frame]
export const LINKS = 25; // 每臂 25 节 [frame]
export const LINK_LEN = 0.04; // 每节 40 mm [guess]
export const JOINT_MAX = 26 * D2R; // 单关节最大 26°（100% 时整臂转约 247°，末段收成螺旋）[guess/calc]
export const WHEELS_PER_ARM = 60; // 每臂 60 轮 [frame]
export const LINKS_TOTAL = ARMS * LINKS + 2; // 202 节（含双颚 2 节）[frame]
export const WHEELS_TOTAL = ARMS * WHEELS_PER_ARM; // 480 轮 [frame]
export const SPIRAL_TIP_LINKS = 16; // 末端 16 节收成螺旋 [frame]
export const HUB_R = 0.165; // 8 臂安装毂半径 [guess]
export const ARM_PITCH0 = -18 * D2R; // 臂根初倾角（略向下）[guess]
export const ARM_ISO_INDEX = 1; // 装配体「R2 臂」= 索引 1
export const ARM_NAMES = ['R1', 'R2', 'R3', 'R4', 'L1', 'L2', 'L3', 'L4'];
export const SIPHON_D = 0.038; // 喷口 38 mm [guess]
export const SIPHON_SLEEVES = 3; // 3 层套筒 [frame]
export const NOZZLE_FLAPS = 6; // 6 瓣喷口 [frame]
export const TURBINE_BLADES = 12; // 喷射涡轮 12 叶片 [frame]
export const BEAK_RADULA_D = 0.09; // 齿舌环约 90 mm [guess]
export const REACTOR_PISTONS = 7; // 反应环 7 活塞 [frame]
export const TURRET_TOTAL = 330 * D2R; // 拆解转台 330° [frame]
export const DURATION = 25; // 影片时长 25 s [frame]

// 机体世界坐标锚点（米；世界原点在地面，机器正面 +Z）[guess]
export const BODY = {
  centerY: 0.55, // 相机 target 的参考中心
  mantleBottomY: 0.41,
  mantleTopY: 0.83, // 420 mm 外套膜
  mantleCenterY: 0.62,
  mantleR: MANTLE_DIA / 2,
  petalHingeY: 0.56,
  hubY: 0.4,
  hubR: HUB_R,
  portY: 0.54,
  portZ: 0.145,
  opticY: 0.68,
  opticZ: 0.13,
  siphonY: 0.44,
  siphonZ: -0.18,
  beakY: 0.27,
  armRootY: 0.4,
};

// ---------------------------------------------------------------- 基础工具
export const frac = (x) => x - Math.floor(x);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
/** 相位折到 [-0.5, 0.5)，脉冲中心在 0 */
export const wrapHalf = (p) => (frac(p) < 0.5 ? frac(p) : frac(p) - 1);
export const smoothstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
export const smootherstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// ---------------------------------------------------------------- 心跳 / 喷射
/** 喷射相位 p ∈ [0,1)：p=0 为呼气峰值（推力峰），t=0 时正落在峰值上 [frame/calc] */
export const jetPulse = (t) => frac(t * PULSE_HZ);

/** 单脉冲包络 0..1（高斯，峰值 p=0；一周期内近似独立脉冲）[calc] */
export const pulseShape = (p) => Math.exp(-0.5 * (wrapHalf(p) / PULSE_SIGMA) ** 2);

/** 外套膜压力 kPa：93 kPa × 脉冲包络 [frame] */
export const mantlePressure = (t) => PEAK_KPA * pulseShape(jetPulse(t));

/** 喷口开度 0..1：在呼气峰附近全开，其余时间保留 12% 泄漏（参考待机 6 N）[frame/calc] */
export function flapOpen(p) {
  const s = wrapHalf(p);
  const open = smoothstep(-0.13, -0.02, s) * (1 - smoothstep(0.05, 0.18, s));
  return THRUST_FLOOR + (1 - THRUST_FLOOR) * open;
}

/** 推力 N：T = 2·ΔP·A·喷口开度；峰值 2·93 000·1.1341e-3 ≈ 210.9 N [calc] */
export const thrust = (t) => 2 * mantlePressure(t) * 1000 * NOZZLE_A * flapOpen(jetPulse(t));
export const thrustN = thrust; // 别名，方便照原作术语阅读

/** 顶部「喷射负载」条 0..1（压力 × 开度）[calc] */
export const jetLoad = (t) => clamp(pulseShape(jetPulse(t)) * flapOpen(jetPulse(t)));

/** 外套膜呼吸：脉冲时收窄、拉长 5% / 4.5% [frame/guess] */
export function mantleBreath(t) {
  const s = pulseShape(jetPulse(t));
  return { r: 1 - 0.05 * s, len: 1 + 0.045 * s };
}

// ---------------------------------------------------------------- 25 s 巡览节拍
// 机器朝向 +Z；相机位姿格式 {pos:[x,y,z], target:[x,y,z], fov}，单位米 / 垂直视场角。
// 机位高度全部 ≥ 0.24 m，target 取机体重心附近（近景特写允许低至 0.30 m）。
const CAM = {
  // 全片目标：整机（含 8 臂）完整入画；特写拍加大 distance 而不是把 fov 收窄
  hero: { pos: [1.60, 1.66, 1.98], target: [0, 0.5, 0.02], fov: 34 }, // 3/4 俯视
  optics: { pos: [0.38, 0.96, 1.52], target: [0, 0.61, 0.05], fov: 33 }, // 头部/光学
  mantle: { pos: [0.88, 1.72, 1.42], target: [0, 0.58, 0], fov: 34 }, // 正面略高，整机
  arm: { pos: [-1.0, 0.8, 2.4], target: [0, 0.45, 0], fov: 34 }, // 垂直于 R2 臂侧向，整机入画
  siphon: { pos: [-1.02, 0.4, -2.1], target: [0, 0.37, -0.16], fov: 34 }, // 后方低机位，拉远 10%
  hold: { pos: [0.5, 0.95, 1.8], target: [0, 0.52, 0], fov: 33 }, // 正面全景
  beak: { pos: [0.65, 0.18, 2.25], target: [0, 0.3, 0.04], fov: 34 }, // 底部低机位仰视，整机入画
  teardown: { pos: [1.45, 2.05, 1.95], target: [0, 0.52, 0], fov: 34 }, // 俯视全景
  rebuild: { pos: [1.85, 1.45, 2.25], target: [0, 0.52, 0], fov: 34 },
  depart: { pos: [2.0, 1.15, 2.35], target: [0, 0.55, 0], fov: 34 }, // 拉远收尾
};

// 10 个节拍：t / 状态名 / 运行模式大字 / 副标题 / 隔离对象 / 相机
// 时间点照原作：0 喷进 · 3.5 光学 · 7.5 外套膜 · 10 R2 臂 · 12.5 虹吸 ·
//              14.5 保持 · 16 喙 · 18.5 拆解+转台 · 21.5 重组 · 24 退场。
// armBase / armAmp：本拍 8 臂的基础卷曲量与脉冲波幅（照原作 HUD：喷进/退场约 25%，工作拍约 100%）
export const BEATS = [
  { t: 0, key: 'jet', status: '喷射中', mode: '喷射循环', sub: '脉冲 1.8 Hz · 峰值推力 211 N', phase: '自动 · 喷射循环', isolate: 'hero', armBase: 0.22, armAmp: 0.12, cam: CAM.hero },
  { t: 3.5, key: 'optics', status: '跟踪中', mode: '光学跟踪', sub: '2 × 82 mm 镜头 · 红外环开启', phase: '操作员 · 隔离光学', isolate: 'optics', armBase: 0.95, armAmp: 0.05, cam: CAM.optics },
  { t: 7.5, key: 'mantle', status: '外套膜张开', mode: '外套膜张开', sub: '8 瓣 · 70° 张开 · 脑核升起', phase: '操作员 · 隔离外套膜', isolate: 'mantle', armBase: 0.94, armAmp: 0.06, cam: CAM.mantle },
  { t: 10, key: 'arm', status: 'R2 臂分离', mode: 'R2 臂分离', sub: '25 节 · 100% 展开', phase: '操作员 · 隔离 R2 臂', isolate: 'arm2', armBase: 0.74, armAmp: 0.14, cam: CAM.arm },
  { t: 12.5, key: 'siphon', status: '虹吸张开', mode: '虹吸张开', sub: '3 套筒 · 6 瓣喷口 · 全伸', phase: '操作员 · 隔离虹吸', isolate: 'siphon', armBase: 0.94, armAmp: 0.06, cam: CAM.siphon },
  { t: 14.5, key: 'hold', status: '保持', mode: '保持', sub: '站位保持 · 深度 12.4 m', phase: '操作员 · 站位保持', isolate: 'hero', armBase: 0.84, armAmp: 0.14, cam: CAM.hold },
  { t: 16, key: 'beak', status: '喙张开', mode: '喙张开', sub: '双颚 50% 分离 · 齿舌环旋转', phase: '操作员 · 隔离喙', isolate: 'beak', armBase: 0.94, armAmp: 0.06, cam: CAM.beak },
  { t: 18.5, key: 'teardown', status: '整机拆解', mode: '整机拆解', sub: '转台旋转 · 100% 分离', phase: '操作员 · 整机拆解', isolate: 'hero', armBase: 0.5, armAmp: 0.3, cam: CAM.teardown },
  { t: 21.5, key: 'rebuild', status: '重组', mode: '重组', sub: '转台 330° · 重新对接', phase: '操作员 · 重组', isolate: 'hero', armBase: 0.7, armAmp: 0.12, cam: CAM.rebuild },
  { t: 24, key: 'depart', status: '离站', mode: '离站', sub: '升离站位 · 推进器点火', phase: '自动 · 离站', isolate: 'hero', armBase: 0.2, armAmp: 0.1, cam: CAM.depart },
];

/** 当前节拍（t 落在 [BEATS[i].t, BEATS[i+1].t)） */
export function beatAt(t) {
  const tt = clamp(t, 0, DURATION);
  let b = BEATS[0];
  for (const x of BEATS) if (x.t <= tt) b = x;
  return b;
}

/** 当前节拍在整个巡览里的进度 0..1 */
export const beatProgress = (t) => clamp(t / DURATION);

/** 下一拍的时间（最后一拍为 DURATION） */
export function nextBeatT(key) {
  const i = BEATS.findIndex((b) => b.key === key);
  return i >= 0 && i < BEATS.length - 1 ? BEATS[i + 1].t : DURATION;
}

/**
 * 某一拍的展开量 0..1：拍点前 0.12 s 开始进、拍点后约 0.9 s 到位；
 * 下一拍前约 0.5 s 开始退，下一拍后 0.28 s 收完。纯 t 的函数。
 */
export function beatAmount(key, t) {
  const i = BEATS.findIndex((b) => b.key === key);
  if (i < 0) return 0;
  const a = BEATS[i].t;
  const b = nextBeatT(key);
  const span = b - a;
  const in0 = a - 0.9;
  const in1 = a + Math.min(0.2, span * 0.1);
  const out0 = b - Math.min(0.7, span * 0.35);
  const out1 = b - 0.02;
  return clamp(smootherstep(in0, in1, t) * (1 - smootherstep(out0, out1, t)));
}

/**
 * 某一拍参数（如 armBase / armAmp）的当前值：在拍点前 0.9 s 内从上一拍平滑过渡到本拍，
 * 使 HUD 在拍点那一刻已经是新状态。纯 t 的函数。
 */
export function beatParam(t, field) {
  let i = 0;
  for (let k = 0; k < BEATS.length; k++) if (BEATS[k].t <= t) i = k;
  const cur = BEATS[i];
  if (i === 0) return cur[field];
  const prev = BEATS[i - 1];
  return lerp(prev[field], cur[field], smootherstep(cur.t - 0.9, cur.t, t));
}

// ---------------------------------------------------------------- 外套膜 / 光学
/**
 * 8 片壳瓣的铰接角（弧度）。第二参数可以是：
 *   - 省略：自动取本拍的展开量（7.5 s 外套膜张开）；
 *   - 数字 0..1：直接给定展开量（页面按钮/自定义用）；
 *   - 对象且含 open：取对象里的展开量。
 * 壳瓣平时随脉冲轻微呼吸，全开 70°。
 */
export function petalOpen(t, beat = null) {
  let open = beatAmount('mantle', t);
  if (typeof beat === 'number') open = beat;
  else if (beat && typeof beat === 'object' && Number.isFinite(beat.open)) open = beat.open;
  const breath = (0.8 + 2.2 * pulseShape(jetPulse(t))) * D2R;
  return Math.max(PETAL_OPEN * clamp(open), breath);
}

/** 光学：对焦行程 0..1 与红外环亮度 0..1 [frame/guess] */
export function opticState(t) {
  const s = pulseShape(jetPulse(t));
  return { focus: 0.3 + 0.14 * Math.sin(t * 1.3), ir: 0.25 + 0.75 * s, iris: 0.55 + 0.35 * s };
}

// ---------------------------------------------------------------- 8 条臂链
/** 每节弯曲权重：前 4 节近直，越靠末端弯得越狠，保证 100% 时收成螺旋 [guess/calc] */
export const bendEnvelope = (j) => 0.05 + 0.95 * Math.pow(Math.max(0, (j - 3) / (LINKS - 4)), 1.35);

/**
 * 单臂卷曲指令 0..1：基础握持 0.78 + 脉冲波沿 8 臂滚动，相邻臂差 1/8 周期。
 * 隔离 R2 臂（10–12.5 s）时该臂展开到 0.12（≈100% 展开）。
 */
export function armCurl(t, armIdx = 0) {
  const p = jetPulse(t);
  const base = beatParam(t, 'armBase');
  const amp = beatParam(t, 'armAmp');
  // 取负号：armCurl(t + T/8, i+1) === armCurl(t, i)，即相邻臂相位差正好 1/8 周期
  let c = base + amp * pulseShape(frac(p - armIdx / ARMS));
  if (armIdx === ARM_ISO_INDEX) {
    const apart = beatAmount('arm', t);
    c = lerp(c, 0.12, apart);
  }
  return clamp(c);
}

/** 8 条臂的卷曲指令数组（HUD 03 面板直接读它） */
export const armWave = (t) => Array.from({ length: ARMS }, (_, i) => armCurl(t, i));

/** 单臂卷曲百分比（HUD 用） */
export const armCurlPct = (t, armIdx = 0) => armCurl(t, armIdx) * 100;

/** 单臂各关节的相对转角（弧度，长 25），由 armCurl 与弯曲包络推出 */
export function armJointAngles(armIdx, t) {
  const cmd = armCurl(t, armIdx);
  const out = new Array(LINKS);
  for (let j = 0; j < LINKS; j++) out[j] = JOINT_MAX * bendEnvelope(j) * cmd;
  return out;
}

/**
 * 单臂 2D 折线（臂平面：+x 为离体径向、+y 为世界向上），用于检查与 3D 装配。
 * 返回 {pts:[[x,y]...26], headings:[...26], length:1.0, tip:[x,y]}。
 * 3D 时令 dir = (cos az·cos th, sin th, sin az·cos th) 即可。
 */
export function armChain2D(armIdx, t) {
  const angles = armJointAngles(armIdx, t);
  const pts = [[0, 0]];
  const headings = [];
  let th = ARM_PITCH0;
  let x = 0;
  let y = 0;
  headings.push(th);
  for (let j = 0; j < LINKS; j++) {
    th += angles[j];
    x += Math.cos(th) * LINK_LEN;
    y += Math.sin(th) * LINK_LEN;
    pts.push([x, y]);
    headings.push(th);
  }
  return { pts, headings, length: LINKS * LINK_LEN, tip: [x, y] };
}

// ---------------------------------------------------------------- 虹吸 / 喙 / 拆解 / 转台
/** 虹吸：3 套筒伸出 + 6 瓣喷口张开 + 涡轮脉冲；12.5 s 拍点全开 [frame] */
export function siphonState(t) {
  const open = beatAmount('siphon', t);
  const f = flapOpen(jetPulse(t));
  return {
    extend: clamp(Math.max(0.1 + 0.45 * f, open)),
    spread: clamp(Math.max(0.9 * f, open)),
    open,
    turbine: pulseShape(jetPulse(t)),
  };
}

/** 喙的双颚开度 0..1：平时 5% 呼吸，16 s 拍点张到 50%（原作 50% APART）[frame] */
export function beakOpen(t) {
  const idle = 0.05 + 0.1 * pulseShape(jetPulse(t));
  return clamp(Math.max(idle, 0.5 * beatAmount('beak', t)), 0, 0.5);
}

/** 齿舌环旋转角 + 当前开度（3D 装配直接用）[frame/calc] */
export function beakState(t) {
  return { jaw: beakOpen(t), radula: t * 2.2 };
}

/** 整机拆解量 0..1：18.55 s 起升到 100%，20.2 s 后回落，22.3 s 收完 [frame] */
export function explodeAmount(t) {
  return clamp(smootherstep(18.55, 19.6, t) * (1 - smootherstep(20.2, 22.3, t)));
}

/** 转台角（弧度）：18.6 s 起 easeOut 转到 330°，22 s 到位（20 s 时约 262°）[frame/calc] */
export function turretAngle(t) {
  const u = clamp((t - 18.6) / (22 - 18.6));
  return TURRET_TOTAL * (1 - (1 - u) ** 3);
}

// ---------------------------------------------------------------- 遥测读数
// 逐拍姿态关键帧（照原作 HUD 读数）：[t, 值]
const PITCH_KEYS = [[0, -73], [3.5, -2], [7.5, -1.5], [10, 2], [12.5, -2], [14.5, 12], [16, 59], [18.5, 2], [21.5, -1], [24, -74], [25, -74]];
const ROLL_KEYS = [[0, 1.8], [3.5, -0.2], [7.5, -0.9], [10, -0.9], [12.5, 2], [14.5, -1.4], [16, -0.3], [18.5, 0], [21.5, -0.5], [24, -12.6], [25, -12.6]];
const SPEED_KEYS = [[0, 2.87], [3.5, 0.02], [7.5, 0.08], [10, 0.09], [12.5, 0.06], [14.5, 0.57], [16, 0.12], [18.5, 0], [21.5, 0.09], [24, 2.01], [25, 2.01]];

function keyLerp(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return lerp(v0, v1, smootherstep(t0, t1, t));
    }
  }
  return keys[keys.length - 1][1];
}

/** 深度 m：围绕 12.4 m 缓慢起伏，退场段上升约 0.6 m [frame/guess] */
export const depthAt = (t) => 12.42 - 0.06 * Math.sin(0.8 * t) - 0.03 * Math.sin(2.3 * t) - 0.62 * smootherstep(22.6, 24.8, t);

/**
 * HUD 04/02 面板的全部遥测：深度、垂速、俯仰、横滚、电量、功耗、电芯、电机、速度、负载。
 * 全部由 t 推出，页面不写死数字。
 */
export function telemetry(t) {
  const h = 0.01;
  const load = jetLoad(t);
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

/** 01 面板的「-1.2 s → 现在」脉冲曲线：n 个采样点的压力 kPa [calc] */
export function pressureHistory(t, n = 41, span = 1.2) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = mantlePressure(t - span + (span * i) / (n - 1));
  return out;
}

// ---------------------------------------------------------------- 汇总状态（页面每帧一次调用）
/**
 * 把某一时刻的全部运动学状态打包（无 three，纯数据）：
 * { p, opens:{mantle,siphon,beak,arm}, explode, turret, petals, arms:[{curl,angles}],
 *   siphon, beak, optics, breathe, telemetry, beat }
 */
export function stateAt(t) {
  const opens = {
    mantle: beatAmount('mantle', t),
    siphon: beatAmount('siphon', t),
    beak: beatAmount('beak', t),
    arm: beatAmount('arm', t),
  };
  return {
    t,
    p: jetPulse(t),
    beat: beatAt(t),
    opens,
    explode: explodeAmount(t),
    turret: turretAngle(t),
    petals: petalOpen(t, opens.mantle),
    breathe: mantleBreath(t),
    optics: opticState(t),
    siphon: siphonState(t),
    beak: beakState(t),
    arms: Array.from({ length: ARMS }, (_, i) => ({ curl: armCurl(t, i), angles: armJointAngles(i, t) })),
    telemetry: telemetry(t),
  };
}
