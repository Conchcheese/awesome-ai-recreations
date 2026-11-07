// 机械蝎子 Telson SC-8 的数学。真实单位（米、秒、瓦、牛、rad），唯一输入：
// 动作相位 p ∈ [0,1) —— 一个完整动作周期 CYCLE = 2.2 s，内含三个子相位区间：
//   行走 0 ≤ p < 0.62   两足组交替步态（A/B 组相位差 0.5，2 个整步幅，占空比 0.5）
//   警戒 0.62 ≤ p < 0.72  八足全支撑、身体抬高、钳张开抬起、尾再拱起（参考帧的 STANCE · 8 FEET）
//   攻击 0.72 ≤ p < 1    尾链整体刚性前甩（毒针沿可算弧线）、钳张到最大后 0.88 咬合，随后回位
// 每一个姿态角与面板读数都是 p（加上影片巡览的演示输入，像 Cessna 的行程骑在飞行相位下）
// 的纯函数；p=0 与 p=1⁻ 的姿态连续。本文件不出现 three.js。
//
// 参数表（名称, 值, 单位, 来源）—— 同 ../08-机械蝎子SC-8/ref/spec.md：
//   CYCLE      2.2      s     guess（动作周期）
//   WALK_END   0.62     -     guess（行走/警戒边界）
//   GUARD_END  0.72     -     guess（警戒/攻击边界）
//   STEPS      2        -     guess（行走带内整步幅数）
//   DUTY       0.5      -     guess（占空比 → 步态图支撑相）
//   STRIDE_X   0.020    m     guess（步幅半程，沿行进轴 z）
//   LIFT       0.018    m     guess（摆动相抬脚高度）
//   COXA       0.028    m     guess（基节长）
//   DROP       0.012    m     guess（基节下探）
//   FEMUR      0.082    m     guess（股节）
//   TIBIA      0.108    m     guess（胫节）
//   LEGS       8        -     frame（参考帧 STANCE · 8 FEET / LEG SERVOS L1–L8）
//   TAIL_SEGS  5        -     frame（尾节链 5 节）
//   SEG_LEN    0.042    m     guess（每节长）
//   STINGER    0.034    m     guess（毒针长）
//   PSI        88°      -     guess（尾链刚性前甩角；甩后针尖高于背甲、不触头）
//   WHIP_WIN   0.109    -     guess（甩击窗 = 0.24 s / CYCLE，ω峰 = 1.5·Ψ/T 手算基准）
//   CLAW_OPEN  54°      -     guess（攻击段最大开口）
//   CLAW_SNAP  4°       -     guess（咬合角，0.875–0.895 内闭合）

const D2R = Math.PI / 180;

export const G = {
  CYCLE: 2.2,
  WALK_END: 0.62,
  GUARD_END: 0.72,
  STEPS: 2,
  DUTY: 0.5,
  STRIDE_X: 0.02,
  LIFT: 0.018,
  LEGS: 8,
  COXA: 0.028,
  DROP: 0.012,
  FEMUR: 0.082,
  TIBIA: 0.108,
  COXA_X: 0.058,
  COXA_Y: 0.072,
  COXA_Z: [0.055, 0.015, -0.03, -0.085],
  AZ: [40, 75, 105, 140], // 左侧四对的方位角（自 +z 前向），右侧镜像
  FOOT_OUT: [0.095, 0.105, 0.105, 0.085], // 支撑点沿方位角离基节根的水平距
  BODY_LIFT: 0.012,
  TAIL_SEGS: 5,
  SEG_LEN: 0.042,
  STINGER: 0.034,
  TAIL_BASE: [0, 0.055, -0.125],
  REST: [115, 130, 120, 95, 65], // 尾节静息方向角（°，自水平，+z 分量为前）
  ARCH: 6, // 警戒段整链再拱起（刚体，°）
  PSI: 88, // 攻击段整链刚性前甩（°）
  WHIP_T0: 0.74,
  WHIP_WIN: 0.109, // 0.24 s / 2.2 s
  RELAX_T0: 0.9,
  RELAX_WIN: 0.085, // 0.90→0.985 回位
  STINGER_BEND: 60, // 毒针相对末节的折角（°）
  TAIL_I: 0.0034, // kg·m²，尾链绕基座的等效转动惯量（guess：尾质量 × 回转半径²）
  CLAW_REST: 16,
  CLAW_OPEN: 58, // 真实上限 = 静息 16 + 警戒 28 + 攻击 14
  CLAW_SNAP: 4,
  CLAW_BREATH: 6,
  PALM: 0.052, // 掌段长
  FINGER: 0.052, // 指长
  BASE_SEG: 0.048, // 钳基段长
};

export const WALK_STEPS = G.STEPS; // 步态图/配乐共用
export const GUARD_MID = 0.66; // 影片收尾驻停的警戒相位
/** 咬合下降量：由上限/静息/警戒/攻击分量推导，保证咬合点恰好落在 CLAW_SNAP */
const SNAP_DROP = G.CLAW_REST + 28 + 14 - G.CLAW_SNAP;

export const frac = (x) => x - Math.floor(x);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** smoothstep 的解析导数（对 p）—— 面板速度读数与手算都从这里来 */
const ssd = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return (6 * u * (1 - u)) / (b - a);
};

// ------------------------------------------------------------ 模式与包络
/** 模式：0 行走 / 1 警戒 / 2 攻击 */
export const modeOf = (p) => (p < G.WALK_END ? 0 : p < G.GUARD_END ? 1 : 2);
export const MODE_NAME = ['行走', '警戒', '攻击'];

/** 支撑收敛包络：警戒/攻击段八足全支撑；p=0 处为 1（与 p=1⁻ 连续），0.03 内放开进步行 */
export const settleK = (p) => Math.max(ss(G.WALK_END - 0.06, G.WALK_END, p), 1 - ss(0, 0.03, p));
/** 警戒拱起包络（身抬、尾拱、钳抬共用；攻击段保持，0.90–0.985 回位） */
export const archK = (p) => ss(G.WALK_END, G.GUARD_END, p) * (1 - ss(G.RELAX_T0, G.RELAX_T0 + G.RELAX_WIN, p));
/** 尾链刚性前甩包络 */
export const whipW = (p) => ss(G.WHIP_T0, G.WHIP_T0 + G.WHIP_WIN, p) * (1 - ss(G.RELAX_T0, G.RELAX_T0 + G.RELAX_WIN, p));

/** 身体：抬高 + 俯仰 + 步行轻微起伏（全部连续） */
export const bodyPose = (p) => {
  const k = archK(p);
  const walkK = 1 - settleK(p);
  return {
    lift: G.BODY_LIFT * k,
    pitch: -1.6 * D2R * k + 0.5 * D2R * walkK * Math.sin(Math.PI * 2 * frac((p / G.WALK_END) * G.STEPS)),
    bob: 0.0028 * walkK * Math.sin(Math.PI * 2 * frac((p / G.WALK_END) * G.STEPS) * 2),
  };
};

// ------------------------------------------------------------ 步态与腿
export const LEG_NAME = (i) => (i < 4 ? `L${i + 1}` : `R${i - 3}`); // 0..3 左（+x），4..7 右
/** 两足组：A 组 L1/R2/L3/R4，B 组 R1/L2/R3/L4，相位差 0.5 */
export const legGroup = (i) => (i === 0 || i === 5 || i === 2 || i === 7 ? 0 : 1);
/** 腿 i 的步态相位 u ∈ [0,1)：u < DUTY 为支撑相 */
export const gaitPhase = (i, p) => frac(((p / G.WALK_END) * G.STEPS + legGroup(i) * 0.5));
/** 步态统计（面板 01 大读数）：步频 Hz、步长 m、巡航步速 m/s —— 全由参数算出 */
export const gaitStats = () => ({
  hz: G.STEPS / (G.WALK_END * G.CYCLE),
  stepLen: 2 * G.STRIDE_X,
  speed: (2 * G.STRIDE_X * G.STEPS) / (G.WALK_END * G.CYCLE),
});

/** 腿 i 的几何根：基节根 P0（随身体抬升 lift）、方位角 az（rad，左正右负）、外向单位向量 ou */
export const legRoot = (i, lift = 0) => {
  const k = i < 4 ? i : i - 4;
  const sgn = i < 4 ? 1 : -1;
  const az = sgn * G.AZ[k] * D2R;
  return {
    az,
    ou: [Math.sin(az), 0, Math.cos(az)],
    P0: [sgn * G.COXA_X, G.COXA_Y + lift, G.COXA_Z[k]],
  };
};

/** 腿 i 的足端目标（机器系，y=0 为地面）：支撑相沿 z 后擦、摆动相抬起回落；settle 时归支撑站位 */
export const legTarget = (i, p, opts = {}) => {
  const {ou, P0} = legRoot(i, opts.lift || 0);
  const k = i < 4 ? i : i - 4;
  const settle = Math.max(settleK(p), opts.settle || 0);
  const u = gaitPhase(i, p);
  const out = G.FOOT_OUT[k];
  let dz = 0;
  let dy = 0;
  if (settle < 1) {
    if (u < G.DUTY) {
      dz = G.STRIDE_X * (1 - (2 * u) / G.DUTY); // 支撑相：+sx → −sx
    } else {
      const v = (u - G.DUTY) / (1 - G.DUTY);
      dz = -G.STRIDE_X + 2 * G.STRIDE_X * v; // 摆动相：−sx → +sx
      dy = G.LIFT * Math.sin(Math.PI * v);
    }
  }
  const w = 1 - settle; // 步态分量权重
  const contact = settle > 0.5 || u < G.DUTY;
  return {
    x: P0[0] + ou[0] * out,
    y: contact ? 0 : dy * w, // 触地足严格贴地；过渡段足沿地面滑入支撑站位
    z: P0[2] + ou[2] * out + dz * w,
    contact,
    swing: !contact && u >= G.DUTY ? Math.sin(Math.PI * ((u - G.DUTY) / (1 - G.DUTY))) : 0,
  };
};

/**
 * 平面 2 连杆闭式 IK + 基节偏航：偏航把腿平面转到包含足端（步幅沿体轴 z，落在平面内由
 * 偏航角吸收），平面内 (u 水平, v 竖直) 用余弦定理解股/胫角，膝在上。返回解与关节点。
 */
export const legIK = (i, target, lift = 0) => {
  const {az, ou, P0} = legRoot(i, lift);
  const C = [P0[0] + ou[0] * G.COXA, G.COXA_Y - G.DROP, P0[2] + ou[2] * G.COXA];
  const dx = target.x - C[0];
  const dy = target.y - C[1];
  const dz = target.z - C[2];
  const hor = Math.hypot(dx, dz);
  const ouR = hor > 1e-9 ? [dx / hor, 0, dz / hor] : [...ou];
  const yaw = Math.atan2(ou[2] * ouR[0] - ou[0] * ouR[2], ou[0] * ouR[0] + ou[2] * ouR[2]); // 基节偏航角
  const D0 = Math.hypot(hor, dy);
  const D = Math.min(0.995 * (G.FEMUR + G.TIBIA), Math.max(0.3 * (G.FEMUR + G.TIBIA), D0));
  const a = Math.atan2(dy, hor);
  const cosB = (G.FEMUR * G.FEMUR + D * D - G.TIBIA * G.TIBIA) / (2 * G.FEMUR * D);
  const b = Math.acos(Math.min(1, Math.max(-1, cosB)));
  const th1 = a + b; // 股节角（自水平外向，膝在上）
  const K = [C[0] + ouR[0] * Math.cos(th1) * G.FEMUR, C[1] + Math.sin(th1) * G.FEMUR, C[2] + ouR[2] * Math.cos(th1) * G.FEMUR];
  const th2 = Math.atan2(target.y - K[1], (target.x - K[0]) * ouR[0] + (target.z - K[2]) * ouR[2]); // 胫节角
  return {az, ou, ouR, yaw, P0, C, K, th1, th2, D, reach: D0};
};

/** 腿 i 在相位 p 的完整姿态（几何渲染与面板共用） */
export const legPose = (i, p, opts = {}) => {
  const t = legTarget(i, p, opts);
  const ik = legIK(i, t, opts.lift || 0);
  // 由解出的角度做正运动学回算足端（与目标一致，check 验证）
  const F = [
    ik.K[0] + ik.ouR[0] * Math.cos(ik.th2) * G.TIBIA,
    ik.K[1] + Math.sin(ik.th2) * G.TIBIA,
    ik.K[2] + ik.ouR[2] * Math.cos(ik.th2) * G.TIBIA,
  ];
  return {...ik, F, target: t, contact: t.contact, swing: t.swing};
};

/** 八足触地状态与每腿负载%（支撑分摊 + 摆动伺服保持） */
export const contacts = (p, opts = {}) => Array.from({length: G.LEGS}, (_, i) => legTarget(i, p, opts).contact);
export const loads = (p, opts = {}) => {
  const c = contacts(p, opts);
  const n = c.filter(Boolean).length || 1;
  return c.map((on) => (on ? 92 / n : 10));
};

// ------------------------------------------------------------ 尾节链（刚体甩击 → 手算基准）
/** 尾链：节 i 方向角 θi(p)（rad）。arch 与 whip 对每节等量 → 全程刚体，毒针尖端 = 绕尾基的纯转动 */
export const tailAngles = (p) => {
  const arch = G.ARCH * D2R * archK(p);
  const whip = G.PSI * D2R * whipW(p);
  return Array.from({length: G.TAIL_SEGS}, (_, i) => {
    const breath = 0.9 * D2R * Math.sin(Math.PI * 2 * frac(2 * p) + i * 0.6);
    return G.REST[i] * D2R + arch - whip + breath;
  });
};
/** 尾链正运动学：关节 J0..J5、毒针尖、打击角 φ（针尖矢量自水平/前轴）、针尖半径 R */
export const tailPose = (p) => {
  const th = tailAngles(p);
  const J = [[...G.TAIL_BASE]];
  for (let i = 0; i < G.TAIL_SEGS; i++) {
    const a = th[i];
    J.push([J[i][0], J[i][1] + Math.sin(a) * G.SEG_LEN, J[i][2] + Math.cos(a) * G.SEG_LEN]);
  }
  const st = th[G.TAIL_SEGS - 1] - G.STINGER_BEND * D2R;
  const tip = [J[G.TAIL_SEGS][0], J[G.TAIL_SEGS][1] + Math.sin(st) * G.STINGER, J[G.TAIL_SEGS][2] + Math.cos(st) * G.STINGER];
  const ry = tip[1] - G.TAIL_BASE[1];
  const rz = tip[2] - G.TAIL_BASE[2];
  return {th, J, stinger: st, tip, phi: Math.atan2(ry, rz), R: Math.hypot(ry, rz)};
};
/** 刚体基准半径：静息链（无呼吸涟漪）的针尖-尾基距离 —— 手算与读数共用 */
export const RIGID_R = (() => {
  let y = G.TAIL_BASE[1];
  let z = G.TAIL_BASE[2];
  for (let i = 0; i < G.TAIL_SEGS; i++) {
    y += Math.sin(G.REST[i] * D2R) * G.SEG_LEN;
    z += Math.cos(G.REST[i] * D2R) * G.SEG_LEN;
  }
  y += Math.sin((G.REST[G.TAIL_SEGS - 1] - G.STINGER_BEND) * D2R) * G.STINGER;
  z += Math.cos((G.REST[G.TAIL_SEGS - 1] - G.STINGER_BEND) * D2R) * G.STINGER;
  return Math.hypot(y - G.TAIL_BASE[1], z - G.TAIL_BASE[2]);
})();
/** 毒针尖端速度（m/s，解析）：v = R·|dφ/dt|，φ = φ0 + ARCH·archK − PSI·whipW */
export const tailTipSpeed = (p) => {
  const rel = G.RELAX_T0 + G.RELAX_WIN;
  const arch = G.ARCH * D2R * (ssd(G.WALK_END, G.GUARD_END, p) * (1 - ss(G.RELAX_T0, rel, p)) - ss(G.WALK_END, G.GUARD_END, p) * ssd(G.RELAX_T0, rel, p));
  const whip = G.PSI * D2R * (ssd(G.WHIP_T0, G.WHIP_T0 + G.WHIP_WIN, p) * (1 - ss(G.RELAX_T0, rel, p)) - ss(G.WHIP_T0, G.WHIP_T0 + G.WHIP_WIN, p) * ssd(G.RELAX_T0, rel, p));
  return (RIGID_R * Math.abs(arch - whip)) / G.CYCLE;
};
/** 甩击手算基准：ω峰 = 1.5·Ψ/T（smoothstep 峰值导数），v峰 = ω峰·R */
export const whipHandPeak = () => {
  const W = G.WHIP_WIN * G.CYCLE;
  return ((G.PSI * D2R * 1.5) / W) * tailPose(0).R;
};
/** 尾部击打力矩（N·m）= I·|dω/dt|，I 由尾链质量 × 回转半径估出（面板读数） */
export const tailTorqueNm = (p) => {
  const h = 1e-3;
  const w = (q) => tailTipSpeed(frac(q)) / RIGID_R;
  return G.TAIL_I * Math.abs(w(p + h) - w(p - h)) / (2 * h * G.CYCLE);
};
/** 打击角（°，面板 02 表盘）：针尖矢量与 +z 前轴的夹角 */
export const strikeDeg = (p) => {
  const tp = tailPose(p);
  return (Math.atan2(tp.tip[1] - G.TAIL_BASE[1], tp.tip[2] - G.TAIL_BASE[2]) * 180) / Math.PI;
};

// ------------------------------------------------------------ 钳（开合 + 抬摆）
/**
 * 开口角（°）：静息 12 ± 6 呼吸；警戒 +28；攻击 +14 → 最大 54°；0.875–0.895 整口咬合到 4°；
 * 0.90–0.985 整组回位。括号项整体乘回位系数 → 全程不越过 [4°, 54°]。
 */
export const clawOpenDeg = (p, demo = 0) => {
  const rel = 1 - ss(G.RELAX_T0, G.RELAX_T0 + G.RELAX_WIN, p);
  const breath = G.CLAW_BREATH * Math.sin(Math.PI * 2 * frac(2 * p)) * (1 - archK(p));
  const bite = 28 * ss(G.WALK_END, G.GUARD_END, p) + 14 * ss(G.GUARD_END, 0.8, p) - SNAP_DROP * ss(0.875, 0.895, p);
  const demoK = demo * 20 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * frac(2 * p))) * (1 - rel * ss(0.875, 0.895, p));
  return G.CLAW_REST + breath + bite * rel + demoK;
};
/** 钳抬摆（°）：静息抬 10°，警戒再抬高，攻击前扑 */
export const clawLiftDeg = (p) => 10 + 4 * Math.sin(Math.PI * 2 * frac(2 * p) + 1) * (1 - archK(p)) + 14 * archK(p) + 6 * ss(G.GUARD_END, 0.8, p) * (1 - ss(0.94, G.RELAX_T0 + G.RELAX_WIN, p));
export const clawSwayDeg = (p) => 8 * archK(p);
/** 开口角解析导数（°/p）—— 指尖速度与功耗读数用 */
export const clawOpenRate = (p) => {
  const relT = G.RELAX_T0 + G.RELAX_WIN;
  const rel = 1 - ss(G.RELAX_T0, relT, p);
  const relD = -ssd(G.RELAX_T0, relT, p);
  const ai = ss(G.WALK_END, G.GUARD_END, p);
  const aiD = ssd(G.WALK_END, G.GUARD_END, p);
  const s1 = ss(G.GUARD_END, 0.8, p);
  const s1D = ssd(G.GUARD_END, 0.8, p);
  const s2 = ss(0.875, 0.895, p);
  const s2D = ssd(0.875, 0.895, p);
  const bite = 28 * ai + 14 * s1 - SNAP_DROP * s2;
  const biteD = 28 * aiD + 14 * s1D - SNAP_DROP * s2D;
  const arch = archK(p);
  const breath = G.CLAW_BREATH * Math.sin(Math.PI * 2 * frac(2 * p));
  return G.CLAW_BREATH * 2 * Math.PI * Math.cos(Math.PI * 2 * frac(2 * p)) * (1 - arch) - breath * (aiD * rel + ai * relD) + biteD * rel + bite * relD;
};
/** 钳指尖速度（m/s）= 指长 × |d开口/dt|，咬合峰手算：1.5·ΔA/T × 指长 */
export const clawSnapHandPeak = () => ((Math.abs(G.CLAW_SNAP - G.CLAW_OPEN) * D2R * 1.5) / (0.02 * G.CYCLE)) * G.FINGER;
export const clawFingerSpeed = (p, demo = 0) => (G.FINGER * Math.abs(clawOpenRate(p, demo)) * D2R) / G.CYCLE;
/** 钳的关节点（机器系）：肩 S → 肘 E → 掌端 W；不动指沿 dirF，动指随开口张角 */
export const clawPose = (side, p, demo = 0) => {
  const open = clawOpenDeg(p, demo) * D2R;
  const lift = clawLiftDeg(p) * D2R;
  const sway = side * (20 * D2R + clawSwayDeg(p) * D2R);
  const S = [side * 0.048, 0.05, 0.082];
  const dir = [
    Math.sin(sway) * Math.cos(lift),
    Math.sin(lift),
    Math.cos(sway) * Math.cos(lift),
  ];
  const E = [S[0] + dir[0] * G.BASE_SEG, S[1] + dir[1] * G.BASE_SEG, S[2] + dir[2] * G.BASE_SEG];
  const W = [E[0] + dir[0] * G.PALM, E[1] + dir[1] * G.PALM, E[2] + dir[2] * G.PALM];
  // 掌平面：不动指沿 dir 微下压前伸；动指绕掌端铰链（横轴 h）在竖直掌面内张开 open 角
  const dirF = [dir[0], dir[1] - 0.18, dir[2]]; // 不动指微微下压
  const fl = Math.hypot(...dirF);
  dirF[0] /= fl;
  dirF[1] /= fl;
  dirF[2] /= fl;
  const h = [dirF[2], 0, -dirF[0]];
  const hl = Math.hypot(h[0], h[2]) || 1;
  h[0] /= hl;
  h[2] /= hl;
  const rot = (v, ax, ang) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2];
    return [
      v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * s + ax[0] * d * (1 - c),
      v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * s + ax[1] * d * (1 - c),
      v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * s + ax[2] * d * (1 - c),
    ];
  };
  const dirM = rot(dirF, h, open);
  return {
    S, E, W, dir, dirF, dirM, open,
    tipF: [W[0] + dirF[0] * G.FINGER, W[1] + dirF[1] * G.FINGER, W[2] + dirF[2] * G.FINGER],
    tipM: [W[0] + dirM[0] * G.FINGER, W[1] + dirM[1] * G.FINGER, W[2] + dirM[2] * G.FINGER],
    openDeg: open / D2R,
    liftDeg: lift / D2R,
  };
};

// ------------------------------------------------------------ 功耗与面板汇总
/** 功耗 W：电子常量 + 八足伺服（支撑/摆动）+ 钳驱动（含咬合峰）+ 尾部执行器（含甩击峰） */
export const powerW = (p, opts = {}) => {
  const c = contacts(p, opts);
  let legW = 0;
  for (const on of c) legW += on ? 0.85 : 1.55;
  const clawW = 2 * (0.5 + 9 * (Math.abs(clawOpenRate(p)) * D2R) / G.CYCLE / 30);
  const tailW = 0.8 + 16 * tailTipSpeed(p) / Math.max(0.1, whipHandPeak());
  return 3.4 + legW + clawW + tailW;
};

// ------------------------------------------------------------ 影片/实页共用的相位映射
/** t → p：平时匀速转（PHASE0 让第 0 帧就在步行中）；alertT 后减速驻停到警戒带中点（score.py 同规则复刻） */
export const PHASE0 = 0.35;
export const pAt = (t, alertT) => {
  if (t >= alertT) {
    const pA = frac((alertT + PHASE0) / G.CYCLE);
    const target = pA < G.WALK_END ? GUARD_MID : 1 + GUARD_MID;
    return pA + (target - pA) * ss(alertT, alertT + 1.3, t);
  }
  return frac((t + PHASE0) / G.CYCLE);
};
/** 影片标注用的部件表（film.js 读取；at 由几何层给出） */
export const SUBSYSTEMS = [
  ['01', '传感头', '2 × 26 毫米镜头 · 红外圈'],
  ['02', '钳驱动', '双螯 · 齿轮减速基座'],
  ['03', '背甲核心', '背甲 5 板 · 腹板 5 板'],
  ['04', '腿部伺服', '8 足 × 2 关节 · 16 伺服'],
  ['05', '尾部执行器', '尾节链 5 节 · 刚性甩击'],
  ['06', '毒针', '锥针 · 毒囊'],
];
