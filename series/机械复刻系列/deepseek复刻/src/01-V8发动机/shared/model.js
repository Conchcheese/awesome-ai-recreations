// ============================================================================
// 01 · V8 发动机（四冲程 · 90° 十字曲轴）— 共享数据模型
// DeepSeek 复刻版共享层。纯 JS，只依赖 Math：
//   * 不 import three.js、不访问 DOM / window / 网络 / 随机数 / 系统时间；
//   * 所有姿态与读数都是曲轴角 θ（度，可连续累积，内部自行折叠）或影片时间 t（秒）的纯函数；
//   * 单位：长度 mm（发动机空间），压力 bar，角度 °，时间 s，转速 r/min；
//   * 坐标：曲轴轴线沿 z（前端 +z、后端 -z），y 向上，x 向右；正视图从 +z 看向 -z。
// 约定：cyl（气缸号）取 1..8；throwNo / pinNo（曲柄销号）取 0..3（前 → 后）；
//       kind（气门种类）取 'in' | 'ex'。（`throw` 是 JS 保留字，接口里用 throwNo 表示曲柄销号。）
//
// 数据来源：原作 teardown v8-shared/kin.js + film.js（MIT），本文件为独立重写，数值口径一致；
// 手算依据见 shared/check.mjs 的注释与 spec.md 第 3、5、6 节。
// ============================================================================

export const VERSION = 'v8-ds-1.0.0';

// ---------------------------------------------------------------- 数学小工具
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
/** 正模：把任意角折回 [0, m) */
export const mod = (a, m) => ((a % m) + m) % m;
export const norm360 = (a) => mod(a, 360);
export const norm720 = (a) => mod(a, 720);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
/** 五次平滑（smootherstep）：0→1 两端一、二阶导为零 */
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const asinDeg = (x) => Math.asin(clamp(x, -1, 1)) * R2D;

const checkCyl = (cyl) => {
  if (!Number.isInteger(cyl) || cyl < 1 || cyl > 8) throw new RangeError(`气缸号必须为 1..8，收到 ${cyl}`);
  return cyl;
};
const checkThrow = (t) => {
  if (!Number.isInteger(t) || t < 0 || t > 3) throw new RangeError(`曲柄销号必须为 0..3，收到 ${t}`);
  return t;
};
/** 气门种类归一：接受 'in' | 'ex' | 'intake' | 'exhaust' */
const valveKind = (kind) => {
  if (kind === 'in' || kind === 'intake' || kind === '进气') return 'in';
  if (kind === 'ex' || kind === 'exhaust' || kind === '排气') return 'ex';
  throw new RangeError(`气门种类必须为 in / ex，收到 ${kind}`);
};

// ---------------------------------------------------------------- 尺寸参数（mm）
/** 发动机尺寸表。来源标注：code = 原作 kin.js 实值；ref = 实车公开数据；guess = 估算。 */
export const E = Object.freeze({
  bore: 101.6, // 缸径 ≈ 4.00 in            code（雪佛兰小缸体 4.00 in）
  r: 44.5, // 曲柄半径                       code（行程 2r = 89 mm ≈ 3.48 in）
  rod: 145, // 连杆长 ≈ 5.71 in              code
  cr: 10.2, // 压缩比                         code（真机 9–11.5，量级正确）
  comp: 30, // 活塞销到活塞顶的距离            code
  deck: 226, // 曲轴轴线到缸体顶面            code
  pinZ: Object.freeze([168, 56, -56, -168]), // 四个曲柄销 z（前 → 后）code
  rodOff: 11, // 同销两列活塞销的 z 错位        code
});
/** 行程 = 2r = 89 mm（手算） */
export const STROKE_MM = 2 * E.r;
/** 上止点时活塞销到曲轴轴线的距离 r + L = 189.5 mm */
export const S_TDC = E.r + E.rod;
/** 下止点时活塞销到曲轴轴线的距离 L − r = 100.5 mm */
export const S_BDC = E.rod - E.r;
/** 排量 = 8 × π/4 · bore² · stroke ≈ 5.77 L（≈ 350 in³，HUD 显示 5.8 L） */
export const DISPLACEMENT_L = ((8 * Math.PI) / 4) * E.bore * E.bore * STROKE_MM / 1e6;
/** 两列气缸的中心夹角（度） */
export const BANK_ANGLE = 90;

// ---------------------------------------------------------------- 两列与缸位
const S = Math.SQRT1_2; // sin45 = cos45
/**
 * 列坐标架（XY 平面，单位向量）：
 *   b = 沿缸轴指向缸盖（活塞上行方向）；p = 与该列缸轴垂直、指向列外。
 * 左列（L，+x 侧）b=[+√½,+√½]，右列（R，−x 侧）b=[−√½,+√½]；两列夹角 90°。
 */
export const BANK = Object.freeze({
  L: Object.freeze({b: Object.freeze([S, S]), p: Object.freeze([S, -S]), sign: 1, nameCN: '左列'}),
  R: Object.freeze({b: Object.freeze([-S, S]), p: Object.freeze([-S, -S]), sign: -1, nameCN: '右列'}),
});
/**
 * 八个气缸：奇数缸在左列，偶数缸在右列；每列 4 缸共用一根曲柄销。
 * pin = 曲柄销号 0..3；z = 该缸的 z 坐标（同销两列以 rodOff 错开，避免连杆干涉）。
 */
export const CYL = Object.freeze(
  [1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
    const odd = c % 2 === 1;
    const pin = Math.floor((c - 1) / 2);
    return Object.freeze({
      c,
      bank: odd ? 'L' : 'R',
      bankCN: odd ? '左列' : '右列',
      pin,
      z: E.pinZ[pin] + (odd ? E.rodOff : -E.rodOff),
    });
  }),
);
/** 点火顺序（雪佛兰小缸体）：1-8-4-3-6-5-7-2 */
export const firingOrder = Object.freeze([1, 8, 4, 3, 6, 5, 7, 2]);
/** 点火相位表（度，点火后曲轴角）：每个气缸的做功上止点相对 0° 的位置 */
export const FIRE = Object.freeze({1: 0, 8: 90, 4: 180, 3: 270, 6: 360, 5: 450, 7: 540, 2: 630});
/** 十字曲轴四个曲柄销的相位（度，从 +y 起、正视顺时针），互成 90° */
export const PIN_PHASE = Object.freeze([45, 135, -45, 225]);
/** 十字曲轴正视图四个节点按钮的标签（同销两缸） */
export const PIN_LABELS = Object.freeze(['1·2', '3·4', '5·6', '7·8']);
/** 每个点火间隔（度）：720 / 8 = 90° */
export const FIRE_INTERVAL = 720 / firingOrder.length;

// ---------------------------------------------------------------- 冲程与相位
/** 四冲程的时间顺序（点火后曲轴角 0–720°） */
export const STROKE_KEYS = Object.freeze(['power', 'exhaust', 'intake', 'compression']);
/** 冲程中文名 */
export const STROKE_CN = Object.freeze({power: '做功', exhaust: '排气', intake: '进气', compression: '压缩'});
/** 气缸面板里的四冲程图例显示顺序（进气 → 压缩 → 做功 → 排气） */
export const STROKE_HUD_ORDER = Object.freeze(['intake', 'compression', 'power', 'exhaust']);
/** 各冲程的相位窗口（度，点火后） */
export const STROKE_WINDOWS = Object.freeze({
  power: Object.freeze([0, 180]),
  exhaust: Object.freeze([180, 360]),
  intake: Object.freeze([360, 540]),
  compression: Object.freeze([540, 720]),
});

// ---------------------------------------------------------------- 气门
/** 气门窗口（度，点火后曲轴角）与最大升程（mm）：排气 140–380°，进气 340–580°，升程 10.5 mm */
export const VALVE = Object.freeze({
  ex: Object.freeze([140, 380]),
  in: Object.freeze([340, 580]),
  lift: 10.5,
});
/** 气门峰值相位（窗口中点）：排气 260°、进气 460° */
export const VALVE_PEAK = Object.freeze({ex: 260, in: 460});
/** 气门重叠窗口（度）：340–380°，进排气同时微开 */
export const VALVE_OVERLAP = Object.freeze([340, 380]);

// ---------------------------------------------------------------- 转速与影片
/** 转速（r/min）与回放 */
export const RPM = Object.freeze({
  idle: 700, // 巡览 / 默认转速
  filmEnd: 2400, // 影片 12.1 s 起拉到的转速
  max: 8000, // 转速表满量程
  liveMin: 300, // 互动页滑块有效下限
  filmRamp: Object.freeze([700, 2400, 1.4]), // [起, 止, 缓动秒数]
});
/** 回放速度：1/20（700 rpm → 屏上 210°/s） */
export const PLAYBACK = 1 / 20;
/** 影片总时长（秒） */
export const FILM_DURATION = 26;
/** 影片起始曲轴角（度）：1 缸点火后 12° */
export const FILM_THETA0 = 12;

/**
 * 26 s 巡览节拍表（照原作 film.js 的 SCRIPT）。时间是绝对秒，镜头名与 model 的 TOUR 对应；
 * 相机曲线在 film/camera.js 里实现，本表只负责「何时切到哪儿、跟踪哪个缸、转速怎么变」。
 */
export const TOUR = Object.freeze([
  Object.freeze({t: 0, cam: 'open', label: '主机位环绕推进'}),
  Object.freeze({t: 3.5, cam: 'cyl', track: 1, label: '气缸 1 特写'}),
  Object.freeze({t: 6.9, track: 6, label: '跟踪切到气缸 6'}),
  Object.freeze({t: 9.7, cam: 'valley', label: '气门室俯视'}),
  Object.freeze({t: 12.1, rpm: RPM.filmRamp, label: '转速 700 → 2400'}),
  Object.freeze({t: 14.7, cam: 'side', label: '侧面'}),
  Object.freeze({t: 17.3, cam: 'front', label: '正面'}),
  Object.freeze({t: 19.9, cam: 'hero', label: '主机位'}),
  Object.freeze({t: 22.5, track: 1, label: '跟踪回气缸 1'}),
]);

// ---------------------------------------------------------------- HUD 派生常量（只读，供界面直接显示）
/** 屏上要显示的所有派生常量：全部由 E / STROKE_MM / DISPLACEMENT_L 等算出，不另写死。 */
export const HUDFMT = Object.freeze({
  strokeMm: STROKE_MM, // 89 毫米
  rCm: Math.floor(E.r) / 10, // 4.4 cm（原作一位小数口径）
  rodCm: E.rod / 10, // 14.5 cm
  boreMm: E.bore, // 101.6
  compressionRatio: E.cr, // 10.2
  displacementL: Number(DISPLACEMENT_L.toFixed(1)), // 5.8 L
  firingOrderText: firingOrder.join('-'), // 1-8-4-3-6-5-7-2
  fireIntervalDeg: FIRE_INTERVAL, // 90°
  timingGearText: '24 : 72', // 斜齿正时齿轮齿数比
  camSpeedText: '半速', // 凸轮轴 = 曲轴半速
  rpmIdle: RPM.idle, // 700
  rpmMax: RPM.max, // 8000
  playbackText: `1 / ${Math.round(1 / PLAYBACK)} 速度`, // 1 / 20 速度
  formula: 's = r·cos φ + √(L² − r² sin²φ)',
  valveLiftMm: VALVE.lift, // 10.5
  valveExWindow: `${VALVE.ex[0]}–${VALVE.ex[1]}°`, // 140–380°
  valveInWindow: `${VALVE.in[0]}–${VALVE.in[1]}°`, // 340–580°
});

// ---------------------------------------------------------------- 曲柄销与相位
/**
 * 曲柄销角度（度，从 +y 起正视顺时针）：θ + 销相位。
 * 十字曲轴：四个销在任意 θ 下互成 90°（45 / 135 / 225 / 315 的循环）。
 */
export function crankPinAngle(theta, throwNo) {
  return theta + PIN_PHASE[checkThrow(throwNo)];
}
/** 曲柄销在正视图 XY 平面上的坐标（mm）：[r·sin a, r·cos a]；throwNo = 0..3 */
export function crankPinXY(theta, throwNo) {
  const a = crankPinAngle(theta, throwNo) * D2R;
  return [E.r * Math.sin(a), E.r * Math.cos(a)];
}
/** 四个曲柄销的角度（度，原始连续值，前 → 后） */
export function crankPinAngles(theta) {
  return PIN_PHASE.map((p) => theta + p);
}
/** 凸轮轴角度（度）：以曲轴半速旋转，720° 曲轴角 = 360° 凸轮角 */
export function camAngle(theta) {
  return theta / 2;
}
/**
 * 凸轮桃形峰值所在的气门相位（度，点火后曲轴角）：点火相位 + 气门窗口中点。
 * 桃形在凸轮轴上的角位置 = camPeakPhase / 2（凸轮角）。
 */
export function camPeakPhase(cyl, kind) {
  checkCyl(cyl);
  const k = valveKind(kind);
  return FIRE[cyl] + VALVE_PEAK[k];
}
export function camLobeAngle(cyl, kind) {
  return camPeakPhase(cyl, kind) / 2;
}

// ---------------------------------------------------------------- 相位与冲程
/** 四冲程相位 ψ（度，点火后曲轴角，0–720）：0 = 该缸压缩上止点（点火时刻） */
export function phaseOf(theta, cyl) {
  checkCyl(cyl);
  return norm720(theta - FIRE[cyl]);
}
/** 相位折算到正视图曲柄角（度，0–360，「xxx° 上止点后」） */
export function afterTDCOf(theta, cyl) {
  return norm360(phaseOf(theta, cyl));
}
/** 冲程键：'power' | 'exhaust' | 'intake' | 'compression' */
export function strokeKeyOf(theta, cyl) {
  return STROKE_KEYS[Math.floor(phaseOf(theta, cyl) / 180)];
}
/** 冲程中文名：'做功' | '排气' | '进气' | '压缩' */
export function strokeOf(theta, cyl) {
  return STROKE_CN[strokeKeyOf(theta, cyl)];
}
/** 当前正在点火（刚过做功上止点）的气缸号；用于点火顺序节点的实时光晕 */
export function firingNow(theta) {
  let best = firingOrder[0];
  let bp = Infinity;
  for (const c of firingOrder) {
    const p = phaseOf(theta, c);
    if (p < bp) {
      bp = p;
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------- 活塞/连杆运动学
/**
 * 活塞位置分数：0 = 上止点，1 = 下止点。
 * 解析式：disp = r(1 − cos ψ) + (L − √(L² − r² sin²ψ))，再除以行程 2r。
 */
export function pistonFracAtPhase(psi) {
  const a = psi * D2R;
  const sn = Math.sin(a);
  const root = Math.sqrt(E.rod * E.rod - E.r * E.r * sn * sn);
  return (E.r * (1 - Math.cos(a)) + (E.rod - root)) / STROKE_MM;
}
/** 活塞位移（mm，自上止点向下为正） */
export function pistonDisplacementAtPhase(psi) {
  return pistonFracAtPhase(psi) * STROKE_MM;
}
/** 活塞速度（mm/度曲轴角，向下的方向为正）；ψ=90° 时约 0.777 mm/° */
export function pistonSpeedMMperDegAtPhase(psi) {
  const a = psi * D2R;
  const sn = Math.sin(a);
  const cs = Math.cos(a);
  const root = Math.sqrt(E.rod * E.rod - E.r * E.r * sn * sn);
  // d(disp)/dψ [mm/rad] = r·sinψ · (1 + r·cosψ / √(L² − r²sin²ψ))
  return E.r * sn * (1 + (E.r * cs) / root) * D2R;
}
/** 连杆相对本列缸轴的夹角（度，带符号；同一曲柄销两列符号相反）：sin β = (r/L)·sin ψ */
export function rodAngleAtPhase(psi, bank) {
  return (bank === 'R' ? -1 : 1) * asinDeg((E.r / E.rod) * Math.sin(psi * D2R));
}

/**
 * 单个气缸的完整活塞/连杆姿态（纯函数）。
 * @returns {{c:number, bank:string, pin:number, z:number, psi:number, afterTDC:number,
 *            strokeKey:string, strokeCN:string, s:number, disp:number,
 *            strokeFrac:number, pistonPct:number, vel:number, rodAngle:number,
 *            pinAngle:number, pinXY:number[], wristPin:number[], travel:number}}
 *   s       活塞销到曲轴轴线的距离（mm）         disp    自上止点的下行位移（mm）
 *   pistonPct 从下止点算起的行程百分比（HUD 用）  vel     速度 mm/度（向下为正）
 *   rodAngle  连杆相对缸轴夹角（度）              pinXY   曲柄销在正视图 XY 的坐标（mm）
 *   wristPin  活塞销在发动机空间的三维坐标（mm）
 */
export function pistonPose(theta, cyl) {
  checkCyl(cyl);
  const cy = CYL[cyl - 1];
  const psi = phaseOf(theta, cyl);
  const a = psi * D2R;
  const sn = Math.sin(a);
  const cs = Math.cos(a);
  const root = Math.sqrt(E.rod * E.rod - E.r * E.r * sn * sn);
  const s = E.r * cs + root;
  const disp = S_TDC - s;
  const strokeFrac = disp / STROKE_MM;
  const B = BANK[cy.bank];
  const pinAngleRaw = crankPinAngle(theta, cy.pin);
  const pinXY = crankPinXY(theta, cy.pin);
  return {
    c: cy.c,
    bank: cy.bank,
    bankCN: cy.bankCN,
    pin: cy.pin,
    z: cy.z,
    psi,
    afterTDC: norm360(psi),
    strokeKey: STROKE_KEYS[Math.floor(psi / 180)],
    strokeCN: STROKE_CN[STROKE_KEYS[Math.floor(psi / 180)]],
    s,
    disp,
    strokeFrac,
    pistonPct: 100 * (1 - strokeFrac),
    vel: pistonSpeedMMperDegAtPhase(psi),
    rodAngle: rodAngleAtPhase(psi, cy.bank),
    pinAngle: pinAngleRaw,
    pinXY,
    wristPin: [s * B.b[0], s * B.b[1], cy.z],
    travel: STROKE_MM,
  };
}
/** 由转速换算活塞平均/瞬时速度：mm/度 × rpm × 6 = mm/s */
export function pistonSpeedMMps(velMMperDeg, rpm) {
  return velMMperDeg * rpm * 6;
}

// ---------------------------------------------------------------- 容积、压力、气场颜色
/** 气缸容积（以余隙容积 VC 为单位）：V(ψ) = 1 + (cr − 1)·活塞位置分数；上止点 1、下止点 10.2 */
export function volumeAtPhase(psi) {
  return 1 + (E.cr - 1) * pistonFracAtPhase(psi);
}
/**
 * 缸内压力（bar），ψ = 点火后曲轴角：
 *   ψ ∈ [360,540)  进气：0.9
 *   ψ ∈ [180,360)  排气：从 1.5 泄压到 1.1
 *   ψ ∈ [540,720)  压缩：0.95·(cr/V)^1.32（多方压缩）
 *   ψ ∈ [0,180)    做功：压缩值 + 前 10° 快速燃烧（最高 54·(1/V)^1.28），smoother 过渡后多方膨胀
 * 峰值 ≈ 48.6 bar（燃烧后约 10°），见 check.mjs 实测。
 */
export function pressureAtPhase(psi) {
  const ps = norm720(psi);
  const V = volumeAtPhase(ps);
  if (ps >= 360 && ps < 540) return 0.9; // 进气
  if (ps >= 180 && ps < 360) return 1.1 + 0.4 * Math.max(0, 1 - (ps - 180) / 40); // 排气（先泄压）
  if (ps >= 540) return Math.max(0.9, 0.95 * Math.pow(E.cr / V, 1.32)); // 压缩
  const comp = 0.95 * Math.pow(E.cr / V, 1.32); // 做功起点：压缩终了压力
  const burn = 54 * Math.pow(1 / V, 1.28); // 燃烧后的峰值包络
  const k = Math.min(1, ps / 10); // 前 10° 完成燃烧
  return Math.max(1.1, comp + (burn - comp) * (k * k * (3 - 2 * k)));
}
/** 某气缸缸内压力（bar） */
export function cylinderPressure(theta, cyl) {
  return pressureAtPhase(phaseOf(theta, cyl));
}
/** 缸压峰值（bar）与相位（度）：模型实值，check 用它断言 45–62 bar */
let _peak = null;
export function pressurePeak() {
  if (_peak) return _peak;
  let bar = 0;
  let psi = 0;
  for (let ps = 0; ps < 720; ps += 0.05) {
    const p = pressureAtPhase(ps);
    if (p > bar) {
      bar = p;
      psi = ps;
    }
  }
  _peak = Object.freeze({bar, psi});
  return _peak;
}
/** 气场颜色键：0 = 进气·混合气，1 = 压缩，2 = 做功燃烧，3 = 排气 */
export const CHARGE_KEYS = Object.freeze(['intake', 'compressed', 'combustion', 'exhaust']);
/** 气场中文图例（与 CHARGE_KEYS 同序，HUD 顶部图例直接引用） */
export const CHARGE_LABELS = Object.freeze(['进气·混合气', '压缩', '做功燃烧', '排气']);
/** 气场颜色键（0–3） */
export function chargeAtPhase(psi) {
  const ps = norm720(psi);
  if (ps < 60) return 2; // 做功燃烧（点火后 60° 内可见火焰）
  if (ps < 360) return 3; // 排气
  if (ps < 540) return 0; // 进气
  return 1; // 压缩
}
/** 气场键名（'intake' | 'compressed' | 'combustion' | 'exhaust'） */
export function chargeKeyAtPhase(psi) {
  return CHARGE_KEYS[chargeAtPhase(psi)];
}

// ---------------------------------------------------------------- 气门升程
/**
 * 气门升程（mm）：窗口 [a,b] 内用 sin²(πx) 的平滑凸包，窗内零重叠；窗口外为 0。
 * 排气 140–380°、进气 340–580°，峰值 10.5 mm，在窗口中点（260° / 460°）。
 */
export function valveLiftAtPhase(psi, kind) {
  const k = valveKind(kind);
  const [a, b] = VALVE[k];
  const x = norm720(psi - a) / (b - a);
  return x <= 1 ? VALVE.lift * Math.sin(Math.PI * x) ** 2 : 0;
}
/** 归一化气门升程（0–1），曲线图用 */
export function valveLiftNormAtPhase(psi, kind) {
  return valveLiftAtPhase(psi, kind) / VALVE.lift;
}
/** 某气缸某气门的升程（mm） */
export function valveLift(theta, cyl, kind) {
  return valveLiftAtPhase(phaseOf(theta, cyl), kind);
}
/** 某气缸某气门的归一化升程（0–1） */
export function valveLiftNorm(theta, cyl, kind) {
  return valveLiftNormAtPhase(phaseOf(theta, cyl), kind);
}
/** 气门窗口（度，点火后曲轴角）：kind = 'in' | 'ex' */
export function valveWindow(kind) {
  return VALVE[valveKind(kind)];
}

// ---------------------------------------------------------------- 转速曲线与曲轴角积分（影片）
/** 转速节拍（取自 TOUR，保证时间与转速只有一处定义） */
const RPM_BEAT = TOUR.find((b) => b.rpm);
/** 影片转速曲线（r/min）：0–12.1 s 恒 700；12.1→13.5 s 五次缓动升到 2400；之后恒 2400 */
export function rpmAt(t) {
  const [a, b, ramp] = RPM_BEAT.rpm;
  return a + (b - a) * smoother((t - RPM_BEAT.t) / ramp);
}
/** 影片曲轴角预积分表：θ 随转速积分（回放 1/20），与 thetaAt 一起保证纯函数 */
const FILM_DT = 1 / 240;
const TH = (() => {
  const out = [];
  let th = FILM_THETA0;
  const n = Math.ceil((FILM_DURATION + 1) / FILM_DT);
  for (let i = 0; i <= n; i++) {
    out.push(th);
    // 中点法：一个步长内用 t + DT/2 处的转速，积分 dθ = rpm/60·360·dt·playback
    th += (rpmAt(i * FILM_DT + FILM_DT / 2) / 60) * 360 * FILM_DT * PLAYBACK;
  }
  return Object.freeze(out);
})();
/** 影片曲轴角（度）在时间 t 的值：线性插值预积分表，纯函数 */
export function thetaAt(t) {
  const u = clamp(t / FILM_DT, 0, TH.length - 2);
  const i = Math.floor(u);
  return TH[i] + (TH[i + 1] - TH[i]) * (u - i);
}
/** 互动页推进曲轴角：dθ = rpm/60·360·dt·playback（回放 1/20 时 700 rpm → 210°/s） */
export function advanceTheta(theta, rpm, dtSeconds, playback = PLAYBACK) {
  return theta + (rpm / 60) * 360 * dtSeconds * playback;
}
/** 影片跟踪的气缸号：0–6.9 s 缸 1；6.9–22.5 s 缸 6；22.5 s 起回缸 1 */
export function trackedCylinderAt(t) {
  let cyl = 1;
  for (const beat of TOUR) if (beat.track && beat.t <= t) cyl = beat.track;
  return cyl;
}
/** 影片当前镜头键：'open' | 'cyl' | 'valley' | 'side' | 'front' | 'hero' */
export function camKeyAt(t) {
  let key = TOUR[0].cam;
  for (const beat of TOUR) if (beat.cam && beat.t <= t) key = beat.cam;
  return key;
}
/** 当前镜头进入的时刻（秒），供镜头缓动用 */
export function camBeatAt(t) {
  let beat = TOUR[0];
  for (const b of TOUR) if (b.cam && b.t <= t) beat = b;
  return beat;
}

// ---------------------------------------------------------------- 曲线采样（HUD 图表数据）
/** 示功图采样：bar-vs-容积（×VC，1 → 10.2），沿 720° 相位每 step 度一个点 */
export function pvLoopSamples(cyl = 1, step = 2) {
  checkCyl(cyl);
  const n = Math.round(720 / step);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const psi = i * step;
    out.push({psi, v: volumeAtPhase(psi), p: pressureAtPhase(psi)});
  }
  return out;
}
/** 气门正时曲线采样：0–720° 每 step 度一个点（活塞 % / 进气 / 排气） */
export function valveTimingSamples(step = 2) {
  const n = Math.round(720 / step);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const psi = i * step;
    out.push({
      psi,
      pistonPct: 100 * (1 - pistonFracAtPhase(psi)),
      liftIn: valveLiftAtPhase(psi, 'in'),
      liftEx: valveLiftAtPhase(psi, 'ex'),
      liftInN: valveLiftNormAtPhase(psi, 'in'),
      liftExN: valveLiftNormAtPhase(psi, 'ex'),
    });
  }
  return out;
}

// ---------------------------------------------------------------- 影片/界面遥测聚合
/**
 * 一帧的全部派生读数（数字同源：屏上所有读数都从这里取）。
 * @param {number} t 影片时间（秒）
 * @param {{theta?:number, rpm?:number, cyl?:number}} [opts] 互动页可传入自己的实时状态
 * @returns {{t:number, rpm:number, theta:number, crank:number, cyl:number, psi:number,
 *            afterTDC:number, strokeKey:string, strokeCN:string, pressure:number, volume:number,
 *            pistonPct:number, liftIn:number, liftEx:number, liftInN:number, liftExN:number,
 *            camAngle:number, firing:number, charge:number, chargeKey:string, pin:number,
 *            pinAngle:number, peakPressure:number}}
 */
export function telemetry(t, opts = {}) {
  const theta = opts.theta ?? thetaAt(t);
  const rpm = opts.rpm ?? rpmAt(t);
  const cyl = checkCyl(opts.cyl ?? trackedCylinderAt(t));
  const psi = phaseOf(theta, cyl);
  const charge = chargeAtPhase(psi);
  return {
    t,
    rpm,
    theta,
    crank: norm720(theta),
    cyl,
    psi,
    afterTDC: norm360(psi),
    strokeKey: strokeKeyOf(theta, cyl),
    strokeCN: strokeOf(theta, cyl),
    pressure: pressureAtPhase(psi),
    volume: volumeAtPhase(psi),
    pistonPct: 100 * (1 - pistonFracAtPhase(psi)),
    liftIn: valveLiftAtPhase(psi, 'in'),
    liftEx: valveLiftAtPhase(psi, 'ex'),
    liftInN: valveLiftNormAtPhase(psi, 'in'),
    liftExN: valveLiftNormAtPhase(psi, 'ex'),
    camAngle: camAngle(theta),
    firing: firingNow(theta),
    charge,
    chargeKey: CHARGE_KEYS[charge],
    pin: CYL[cyl - 1].pin,
    pinAngle: norm360(crankPinAngle(theta, CYL[cyl - 1].pin)),
    peakPressure: pressurePeak().bar,
  };
}
