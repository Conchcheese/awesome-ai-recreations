// 六足机器人 HX-18 的数学。真实单位（米、牛、牛·米），一个输入：步态相位 p ∈ [0,1) ——
// 一个完整步态周期（T_STEP 秒）。每条腿 3 个关节（髋偏航、股节俯仰、胫节俯仰）全部由 p 闭式
// 解算：支撑腿的脚在机身系里匀速后滑（世界系里原地不动，不打滑），摆动腿的脚沿摆线从 AEP
// 抬到 PEP。机身高度、俯仰随步态微动。三脚架步态：A 组 L1·L3·R2 相位 0，B 组 L2·R1·R3
// 相位 0.5。任何读数（关节角、扭矩、功耗、触地）都是 p 的纯函数。本文件没有 three.js。
//
// 参数表（名称，值，单位，标注）——同时写在 ../06-六足机器人HX-18/ref/spec.md：
//   T_STEP   1.5      s     guess（步态周期，与 0.20 m/s 步速配套）
//   STROKE   0.15     m     guess（支撑相滑移步幅；机身每半周期前进一个步幅）
//   LIFT     0.045    m     guess（抬脚高，约胫节长的 40%）
//   COXA     0.052    m     frame（PhantomX 髋偏置约 52 mm）
//   FEMUR    0.102    m     frame（PhantomX 股节 102 mm）
//   TIBIA    0.114    m     frame（PhantomX 胫节 114 mm）
//   BODY_H   0.098    m     guess（站立机身中心离地）
//   M        3.6      kg    guess（PhantomX 约 3.4 kg + 电池余量）
//   舵机     AX-12A ×18     frame（堵转 15.3 kg·cm ≈ 1.5 N·m @12 V，Robotis 规格）

const D2R = Math.PI / 180;

export const G = {
  T_STEP: 1.5, // s 步态周期
  STROKE: 0.15, // m 支撑相滑移（半周期机身前进量）
  LIFT: 0.045, // m 抬脚高
  COXA: 0.052, // m 髋偏置
  FEMUR: 0.102, // m 股节
  TIBIA: 0.114, // m 胫节
  BODY_H: 0.098, // m 站立机身中心离地
  MOUNT_DY: -0.02, // m 髋轴相对机身中心
  M: 3.6, // kg 整机质量
  SERVO_TQ: 1.5, // N·m AX-12A 堵转扭矩（15.3 kg·cm）
  DUTY: 0.5, // 占空比（三脚架步态定义）
  YAW_MAX: 40 * D2R, // 关节限位：髋偏航
  FEM_MAX: 95 * D2R, // 股节俯仰
  TIB_MAX: 135 * D2R, // 胫节弯折
  SERVE_LIFT: 0.05, // m 维修支架举升（停机拆解时）
};
/** 巡航速度：支撑脚世界静止 ⇒ 机身每半周期前进一个步幅。v = 步幅 ÷ (占空比·周期) = 2·S/T。
 *  手算：0.15 ÷ (0.5 × 1.5) = 0.20 m/s；每整周期位移 0.30 m × 步频 0.667 Hz = 0.20 m/s。 */
export const SPEED = (2 * G.STROKE) / G.T_STEP;

export const frac = (x) => x - Math.floor(x);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// ------------------------------------------------------------ 腿的布置
// 索引 0..5 = L1 L2 L3 R1 R2 R3。安装点在机身六边形边缘，中腿朝正侧、前后腿向外斜
// （LAURON / STEMI 的扇形布置）。out = 腿的中立外向单位向量（水平面）。
export const LEGS = [
  {name: 'L1', side: -1, mx: 0.14, mz: -0.125},
  {name: 'L2', side: -1, mx: 0.0, mz: -0.15},
  {name: 'L3', side: -1, mx: -0.14, mz: -0.125},
  {name: 'R1', side: 1, mx: 0.14, mz: 0.125},
  {name: 'R2', side: 1, mx: 0.0, mz: 0.15},
  {name: 'R3', side: 1, mx: -0.14, mz: 0.125},
].map((l) => {
  const len = Math.hypot(l.mx, l.mz);
  return {...l, ux: l.mx / len, uz: l.mz / len};
});
/** 三脚架分组相位偏移：L1·L3·R2 = 0（A 组），L2·R1·R3 = 0.5（B 组）——相邻组差 0.5 */
export const OFF = [0, 0.5, 0, 0.5, 0, 0.5];
/** 名义侧向外伸：安装点沿外向再伸出去的距离（水平面内） */
export const LAT = 0.175;

// ------------------------------------------------------------ 步态
/** 一条腿的局部位相：q = frac(p − off) ∈ [0,1)。q < DUTY 支撑，其余摆动。 */
export const legPhase = (i, p) => frac(p - OFF[i]);
/** 摆动腿的抬脚高度：H·sin²(πu)，起落两端导数为零（轻提轻放） */
export const liftOf = (q) => (q < G.DUTY ? 0 : G.LIFT * Math.sin(Math.PI * (q - G.DUTY) / (1 - G.DUTY)) ** 2);
/** 支撑/摆动的水平滑移 s（机身系，沿行进方向 +x）：支撑 +S/2 → −S/2 匀速，摆动 −S/2 → +S/2 缓动 */
export const slideOf = (q) => {
  if (q < G.DUTY) return G.STROKE * (0.5 - q / G.DUTY);
  const u = (q - G.DUTY) / (1 - G.DUTY);
  return G.STROKE * (ss(0, 1, u) - 0.5);
};
/** 机身高度：站立值 + 步态微动（每组触地时机身轻沉）+ 维修举升 */
export const bodyH = (p, park = 0) => G.BODY_H + 0.005 * Math.sin(4 * Math.PI * p) + G.SERVE_LIFT * park;
/** 机身俯仰/横滚（rad）：随步态微动 */
export const bodyPitch = (p) => 0.010 * Math.sin(2 * Math.PI * p + 0.6);
export const bodyRoll = (p) => 0.008 * Math.sin(4 * Math.PI * p + 1.0);

/**
 * 一条腿的完整闭式解。返回关节角与机身系关键点：
 *   yaw（髋偏航，绕竖直轴）、femur（股节相对水平的仰角）、bend（胫节相对股节的弯折角），
 *   M 髋轴心、K0 股节舵机轴心（髋段末端）、K 膝、F 脚。opts: {park, bodyH}
 */
export function legPose(i, p, opts = {}) {
  const park = opts.park ?? 0;
  const bh = opts.bodyH ?? bodyH(p, park);
  const L = LEGS[i];
  const q = legPhase(i, p);
  const stance = q < G.DUTY;
  // 落脚点（机身系）：名义点 + 滑移。停机（park）时收到名义点（s=0, lift=0）。
  const s = slideOf(q) * (1 - park);
  const lift = liftOf(q) * (1 - park);
  const fx = L.mx + L.ux * LAT + s;
  const fz = L.mz + L.uz * LAT;
  const fy = -bh + lift;
  // 髋偏航：外向方向转到指向落点
  const dx = fx - L.mx;
  const dz = fz - L.mz;
  const Lh = Math.hypot(dx, dz) || 1e-9;
  const yaw = Math.atan2(L.uz * dx - L.ux * dz, L.ux * dx + L.uz * dz);
  const lx = L.ux * Math.cos(yaw) + L.uz * Math.sin(yaw); // 腿平面水平方向（rotY(u, yaw)）
  const lz = -L.ux * Math.sin(yaw) + L.uz * Math.cos(yaw);
  const my = G.MOUNT_DY;
  const dy = fy - my;
  // 二连杆（股节 + 胫节），从髋段末端 K0 到脚
  const hr = Lh - G.COXA; // K0 → 脚 的水平距离
  const r = Math.hypot(hr, dy);
  const c = clamp((G.FEMUR * G.FEMUR + r * r - G.TIBIA * G.TIBIA) / (2 * G.FEMUR * r), -1, 1);
  const beta = Math.acos(c);
  const phi1 = Math.atan2(dy, hr);
  const femur = phi1 + beta; // 股节仰角（膝高于髋段末端时为正）
  const kx = L.mx + lx * G.COXA;
  const kz = L.mz + lz * G.COXA;
  const K = [kx + G.FEMUR * Math.cos(femur) * lx, my + G.FEMUR * Math.sin(femur), kz + G.FEMUR * Math.cos(femur) * lz];
  // 胫节水平投影带符号（昆虫式站姿脚落在膝内侧时为负）
  const hRem = hr - G.FEMUR * Math.cos(femur);
  const tibiaAbs = Math.atan2(fy - K[1], hRem);
  const bend = femur - tibiaAbs; // 膝弯折（胫节相对股节）
  return {
    q, stance, s, lift, yaw, femur, bend,
    M: [L.mx, my, L.mz],
    K0: [kx, my, kz],
    K,
    F: [fx, fy, fz],
    legdir: [lx, lz],
    footY: fy,
  };
}

/** 正运动学：由三关节角重建脚的位置（验证闭式逆解自洽） */
export function fkFoot(i, yaw, femur, bend) {
  const L = LEGS[i];
  const lx = L.ux * Math.cos(yaw) + L.uz * Math.sin(yaw);
  const lz = -L.ux * Math.sin(yaw) + L.uz * Math.cos(yaw);
  const kx = L.mx + lx * G.COXA;
  const kz = L.mz + lz * G.COXA;
  const kyx = G.FEMUR * Math.cos(femur);
  const K = [kx + kyx * lx, G.MOUNT_DY + G.FEMUR * Math.sin(femur), kz + kyx * lz];
  const tib = femur - bend; // 胫节绝对仰角
  const hT = G.TIBIA * Math.cos(tib);
  return [K[0] + hT * lx, K[1] + G.TIBIA * Math.sin(tib), K[2] + hT * lz];
}

/** 脚是否触地（停机维修时全部着地） */
export const contactOf = (i, p, park = 0) => (park > 0.5 ? true : legPhase(i, p) < G.DUTY);
/** 名义落脚点（机身系）——摆动腿瞄准的下一个真实落点 */
export const nominalFoot = (i) => {
  const L = LEGS[i];
  return [L.mx + L.ux * LAT, -G.BODY_H, L.mz + L.uz * LAT];
};

// ------------------------------------------------------------ 负载与功耗
/**
 * 单腿三关节的静载扭矩估计（N·m）。支撑腿均担整机重量（三脚架瞬时 3 脚着地），
 * 力臂取关节轴到脚的水平投影；摆动腿只负担自重（小扭矩）。
 */
export function legTorques(i, p, opts = {}) {
  const pose = opts.pose ?? legPose(i, p, opts);
  const stance = pose.stance && !(opts.park > 0.5);
  const F = stance ? (G.M * 9.81) / 3 : 0.9; // 支撑反力 / 摆动自重等效力
  const [mx, , mz] = pose.M;
  const fh = Math.hypot(pose.F[0] - mx, pose.F[2] - mz); // 髋轴→脚 水平距离
  const kh = Math.hypot(pose.F[0] - pose.K0[0], pose.F[2] - pose.K0[2]); // 股节轴→脚
  const th = Math.hypot(pose.F[0] - pose.K[0], pose.F[2] - pose.K[2]); // 膝→脚
  const yawL = stance ? 0.018 : 0.01; // 偏航轴主要吃摩擦力矩
  return [F * yawL, F * kh, F * th * 0.55];
}
/** 角速度（rad/s）：闭式解的数值导数，纯函数 */
export const jointRates = (i, p, opts = {}) => {
  const h = 0.004;
  const a = legPose(i, frac(p - h + 1), opts);
  const b = legPose(i, frac(p + h + 1), opts);
  const w = 1 / (2 * h * G.T_STEP);
  return [(b.yaw - a.yaw) * w, (b.femur - a.femur) * w, (b.bend - a.bend) * w];
};
const INST = 3.2; // W 电子底载（主控 + 传感）
/** 整机功耗：Σ τ·|ω| ÷ 0.8（减速箱效率）+ 底载，停机时只剩底载 */
export function powerW(p, opts = {}) {
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    const tq = legTorques(i, p, opts);
    const w = jointRates(i, p, opts);
    for (let j = 0; j < 3; j++) sum += tq[j] * Math.abs(w[j]);
  }
  return INST + (sum / 0.8) * (1 - (opts.park ?? 0));
}
/** 母线电压：LiPo 3S 静息 11.9 V，随负载与放电微降 */
export const voltV = (p, t, opts = {}) => 11.9 - 0.10 * (powerW(p, opts) / 40) - 0.006 * t;

// ------------------------------------------------------------ 面板读数
/** 步态图一行：44 列 × 1.45 s 窗口内的触地布尔（历史从旧到新） */
export const gaitRow = (i, t, cols = 44, win = 1.45) => {
  const row = [];
  for (let c = 0; c < cols; c++) {
    const tt = Math.max(0, t - win * (1 - c / (cols - 1)));
    row.push(contactOf(i, tt / G.T_STEP));
  }
  return row;
};
export const gaitRows = (t, cols = 44) => [0, 1, 2, 3, 4, 5].map((i) => gaitRow(i, t, cols));
export const stanceN = (p, park = 0) => {
  let n = 0;
  for (let i = 0; i < 6; i++) if (contactOf(i, p, park)) n++;
  return n;
};
/** 关节角（度）：6 腿 × 3，供关节表面板 */
export const jointDeg = (p, opts = {}) => {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const s = legPose(i, p, opts);
    out.push([s.yaw / D2R, s.femur / D2R, s.bend / D2R]);
  }
  return out;
};
