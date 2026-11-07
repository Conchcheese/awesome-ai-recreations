// ============================================================================
// 01 · V8 发动机（四冲程 · 90° 十字曲轴）— 模型自检
// 运行：node shared/check.mjs     （Node ≥ 22.7 直接跑，model.js 自动按 ESM 解析）
// 每条断言都在注释里写了手算依据；失败会打印 FAIL 并以非零码退出。
// ============================================================================
import {
  VERSION,
  E,
  STROKE_MM,
  S_TDC,
  S_BDC,
  DISPLACEMENT_L,
  BANK_ANGLE,
  BANK,
  CYL,
  firingOrder,
  FIRE,
  PIN_PHASE,
  PIN_LABELS,
  FIRE_INTERVAL,
  STROKE_KEYS,
  STROKE_CN,
  STROKE_HUD_ORDER,
  VALVE,
  VALVE_PEAK,
  RPM,
  PLAYBACK,
  FILM_DURATION,
  FILM_THETA0,
  TOUR,
  HUDFMT,
  CHARGE_KEYS,
  CHARGE_LABELS,
  mod,
  norm360,
  norm720,
  crankPinAngle,
  crankPinXY,
  crankPinAngles,
  camAngle,
  camPeakPhase,
  camLobeAngle,
  phaseOf,
  afterTDCOf,
  strokeKeyOf,
  strokeOf,
  firingNow,
  pistonFracAtPhase,
  pistonDisplacementAtPhase,
  pistonSpeedMMperDegAtPhase,
  rodAngleAtPhase,
  pistonPose,
  volumeAtPhase,
  pressureAtPhase,
  cylinderPressure,
  pressurePeak,
  chargeAtPhase,
  chargeKeyAtPhase,
  valveLiftAtPhase,
  valveLiftNormAtPhase,
  valveLift,
  valveWindow,
  rpmAt,
  thetaAt,
  advanceTheta,
  trackedCylinderAt,
  camKeyAt,
  pvLoopSamples,
  valveTimingSamples,
  telemetry,
} from './model.js';

let fails = 0;
let oks = 0;
const ok = (cond, label, detail = '') => {
  if (cond) oks++;
  else fails++;
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? `  —— ${detail}` : ''}`);
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const throws = (fn, label) => {
  try {
    fn();
    ok(false, label, '未抛错');
  } catch (e) {
    ok(e instanceof RangeError, label, `${e.constructor.name}: ${e.message}`);
  }
};
const section = (t) => console.log(`\n[${t}]`);
const D2R = Math.PI / 180;
const mm = (v) => v.toFixed(4);

console.log('==============================================================');
console.log(` 01 V8 发动机 · 数据模型自检   model ${VERSION}`);
console.log(' 手算口径：行程 2r；点火间隔 720/8；滑块曲柄解析解；多方压缩 + 快速燃烧');
console.log('==============================================================');

// ---------------------------------------------------------------------------
section('1 尺寸与行程');
// 手算：行程 = 2r = 2 × 44.5 = 89.0 mm；S_TDC = r + L = 44.5 + 145 = 189.5；
//       S_BDC = L − r = 145 − 44.5 = 100.5；两者差 = 2r = 89。
ok(near(STROKE_MM, 89), '行程 2r = 89 mm', mm(STROKE_MM));
ok(near(S_TDC, 189.5) && near(S_BDC, 100.5), '上/下止点销距 = r+L / L−r', `${mm(S_TDC)} / ${mm(S_BDC)}`);
ok(near(S_TDC - S_BDC, STROKE_MM), 'S_TDC − S_BDC = 2r');
// 排量 = 8 · π/4 · 101.6² · 89 = 5.7724 L → HUD 显示 5.8 L（350 in³ ≈ 5.735 L，参考实车吻合）
const dispHand = (8 * Math.PI * E.bore * E.bore * STROKE_MM) / 4e6;
ok(near(DISPLACEMENT_L, dispHand, 1e-9), '排量 = 8·π/4·bore²·stroke', `${DISPLACEMENT_L.toFixed(4)} L`);
ok(HUDFMT.displacementL === 5.8, 'HUD 排量显示 5.8 L', `${HUDFMT.displacementL}`);
ok(HUDFMT.strokeMm === 89 && HUDFMT.rCm === 4.4 && HUDFMT.rodCm === 14.5, 'HUD 行程/曲柄半径/连杆长 = 89 / 4.4 / 14.5', `${HUDFMT.strokeMm} / ${HUDFMT.rCm} / ${HUDFMT.rodCm}`);
ok(HUDFMT.compressionRatio === 10.2 && HUDFMT.rpmIdle === 700 && HUDFMT.rpmMax === 8000, 'HUD 压缩比/怠速/满量程 = 10.2 / 700 / 8000');
ok(BANK_ANGLE === 90 && BANK.L.b[0] === BANK.R.b[0] * -1, '两列夹角 90°（b 向量互为镜像）');
ok(near(Math.hypot(BANK.L.b[0], BANK.L.b[1]), 1) && near(Math.hypot(BANK.R.p[0], BANK.R.p[1]), 1), '列坐标架 b / p 为单位向量');

// ---------------------------------------------------------------------------
section('2 点火顺序与相位');
// 手算：八缸四冲程 720° 一个循环，点火间隔 = 720 / 8 = 90°。
ok(firingOrder.join('-') === '1-8-4-3-6-5-7-2', '点火顺序 = 1-8-4-3-6-5-7-2', firingOrder.join('-'));
ok(near(FIRE_INTERVAL, 90), '点火间隔 = 720/8 = 90°', `${FIRE_INTERVAL}°`);
ok(firingOrder.map((c) => FIRE[c]).join(',') === '0,90,180,270,360,450,540,630', 'FIRE 表每 90° 一个', firingOrder.map((c) => FIRE[c]).join(','));
ok(phaseOf(0, 1) === 0, 'θ=0 时 1 缸相位 ψ=0（点火后 0°）');
ok(near(phaseOf(90, 8), 0), 'θ=90° 时轮到 8 缸（ψ(90°,8 缸)=0）');
// 每 90° 一台缸点火：θ = k·90 时 firingNow 依次为点火顺序
ok(firingOrder.every((c, k) => firingNow(k * 90) === c), '每 90° 一次点火，顺序与点火顺序一致');
ok(firingNow(0) === 1 && firingNow(45) === 1 && firingNow(90) === 8, '点火缸实时判定（0°/45°→1，90°→8）');

// ---------------------------------------------------------------------------
section('3 十字曲轴：四个曲柄销互成 90°');
// 手算：PIN_PHASE = 45°,135°,−45°,225° → 折回 0..360 为 45,135,315,225，排序后间隔均 90°。
const pins0 = crankPinAngles(0).map(norm360).sort((a, b) => a - b);
ok(pins0.join(',') === '45,135,225,315', 'θ=0 时四销角度 = 45/135/225/315', pins0.join(','));
ok(pins0.every((v, i) => near(mod(pins0[(i + 1) % 4] - v, 360), 90)), '相邻曲柄销夹角 = 90°');
ok(crankPinAngle(370, 0) === 415 && crankPinAngle(0, 0) === 45, 'crankPinAngle = θ + 销相位', 'θ=370,销0→415°');
ok(near(Math.hypot(...crankPinXY(123, 2)), E.r), '曲柄销旋转半径 = r = 44.5 mm');
ok(near(crankPinXY(0, 0)[0], E.r * Math.SQRT1_2) && near(crankPinXY(0, 0)[1], E.r * Math.SQRT1_2), '销 0 在 θ=0 时位于 +x+y 45°');
ok(PIN_LABELS.join(',') === '1·2,3·4,5·6,7·8', '正视图节点标签 = 同销两缸', PIN_LABELS.join(','));

// ---------------------------------------------------------------------------
section('4 滑块曲柄运动学（解析解）');
// 手算：disp(ψ) = r(1−cosψ) + (L − √(L² − r²sin²ψ))；ψ=0 → 0；ψ=180 → r·2 = 89。
ok(near(pistonDisplacementAtPhase(0), 0), 'ψ=0° 上止点，位移 = 0');
ok(near(pistonDisplacementAtPhase(180), STROKE_MM), 'ψ=180° 下止点，位移 = 2r = 89', mm(pistonDisplacementAtPhase(180)));
ok(near(pistonFracAtPhase(0), 0) && near(pistonFracAtPhase(180), 1), '活塞位置分数 0 → 1（上止点 → 下止点）');
ok(near(pistonFracAtPhase(90), (E.r + E.rod - Math.sqrt(E.rod * E.rod - E.r * E.r)) / STROKE_MM), 'ψ=90° 位置分数与手算 (r+L−√(L²−r²))/2r 一致', pistonFracAtPhase(90).toFixed(6));
// 手算：ψ=90° 时 cos=0，速度 = r·sin90·(π/180) = 44.5 × 0.017453 = 0.7767 mm/°
ok(near(pistonSpeedMMperDegAtPhase(90), E.r * D2R, 1e-12), 'ψ=90° 活塞速度 = r·π/180 = 0.7767 mm/°', pistonSpeedMMperDegAtPhase(90).toFixed(6));
ok(near(pistonSpeedMMperDegAtPhase(0), 0, 1e-9) && near(pistonSpeedMMperDegAtPhase(180), 0, 1e-9), '上/下止点速度为 0');
// 手算：s = r·cosψ + √(L²−r²sin²ψ)；ψ=0 → r+L = 189.5，ψ=180 → L−r = 100.5。
ok(near(pistonPose(0, 1).s, S_TDC) && near(pistonPose(180, 1).s, S_BDC), '活塞销距 s(0)=r+L、s(180)=L−r');
// 手算：sinβ = (r/L)·sinψ；ψ=90° → β = asin(44.5/145) = 17.874°
ok(near(rodAngleAtPhase(90, 'L'), Math.asin(E.r / E.rod) / D2R, 1e-12), 'ψ=90° 连杆角 = asin(r/L) = 17.872°', rodAngleAtPhase(90, 'L').toFixed(4));
ok(rodAngleAtPhase(90, 'R') === -rodAngleAtPhase(90, 'L'), '同一曲柄销两列连杆角符号相反（列坐标架镜像）');
// 位移以 360° 为周期（四冲程 720° 里活塞走两遍）
ok(near(pistonDisplacementAtPhase(37), pistonDisplacementAtPhase(397), 1e-9), '活塞位置以 360° 曲轴角为周期');
// 速度与数值微分一致（避开死点）
{
  let worst = 0;
  for (const ps of [30, 60, 90, 120, 150, 210, 270, 330, 420, 480, 600, 660]) {
    const h = 1e-4;
    const num = (pistonDisplacementAtPhase(ps + h) - pistonDisplacementAtPhase(ps - h)) / (2 * h);
    worst = Math.max(worst, Math.abs(num - pistonSpeedMMperDegAtPhase(ps)));
  }
  ok(worst < 1e-7, '速度解析式与数值微分一致', `最大误差 ${worst.toExponential(2)} mm/°`);
}
// 用曲柄销投影独立复算活塞位置：s = 销在缸轴上的投影 + √(L² − 垂轴投影²)，验证 psi 推导
{
  let worst = 0;
  for (const cy of CYL) {
    const B = BANK[cy.bank];
    for (let th = -360; th <= 1080; th += 17.3) {
      const [px, py] = crankPinXY(th, cy.pin);
      const pb = px * B.b[0] + py * B.b[1];
      const pp = px * B.p[0] + py * B.p[1];
      const sPin = pb + Math.sqrt(E.rod * E.rod - pp * pp);
      worst = Math.max(worst, Math.abs(sPin - pistonPose(th, cy.c).s));
    }
  }
  ok(worst < 1e-9, '解析式 s(ψ) 与曲柄销投影法完全一致（8 缸 × 84 个 θ）', `最大误差 ${worst.toExponential(2)} mm`);
}
// 活塞销三维坐标：XY 长度 = s，z = 缸位
{
  const p = pistonPose(247, 6);
  const cy = CYL[5];
  ok(near(Math.hypot(p.wristPin[0], p.wristPin[1]), p.s), '活塞销 XY 模长 = s');
  ok(p.wristPin[2] === cy.z && p.z === cy.z, '活塞销 z = 气缸 z 坐标', `${p.wristPin[2]}`);
}
ok(near(pistonPose(-1, 1).disp, pistonPose(719, 1).disp), 'θ 可为负/超出 720°，内部自动折叠');

// ---------------------------------------------------------------------------
section('5 凸轮轴与气门（半速 + 窗口）');
// 手算：凸轮轴半速 → camAngle(720) = 360°；桃形峰值在窗口中点：排气 260°，进气 460°。
ok(camAngle(720) === 360 && camAngle(180) === 90, '凸轮轴半速：720° 曲轴角 = 360° 凸轮角');
ok(camPeakPhase(1, 'ex') === 260 && camPeakPhase(1, 'in') === 460, '气门峰值相位：排气 260°、进气 460°');
ok(camLobeAngle(1, 'ex') === 130 && camLobeAngle(1, 'in') === 230, '凸轮桃形角位置 = 峰值相位 / 2（凸轮角）');
// 手算：窗口 [140,380]，中点 260；sin²(πx) 在两端为 0、中点为 1。
ok(near(valveLiftAtPhase(260, 'ex'), VALVE.lift, 1e-12), '排气门峰值升程 10.5 mm（ψ=260°）');
ok(near(valveLiftAtPhase(460, 'in'), VALVE.lift, 1e-12), '进气门峰值升程 10.5 mm（ψ=460°）');
ok(valveLiftAtPhase(100, 'ex') === 0 && valveLiftAtPhase(420, 'ex') === 0, '排气门窗口外关闭（ψ=100°/420°）');
ok(valveLiftAtPhase(300, 'in') === 0 && valveLiftAtPhase(600, 'in') === 0, '进气门窗口外关闭（ψ=300°/600°）');
ok(valveLiftAtPhase(139.5, 'ex') === 0 && valveLiftAtPhase(380.5, 'ex') === 0, '排气门窗口边界 140–380° 外为 0');
ok(valveLiftAtPhase(339.5, 'in') === 0 && valveLiftAtPhase(580.5, 'in') === 0, '进气门窗口边界 340–580° 外为 0');
ok(near(valveLiftAtPhase(340, 'in'), 0, 1e-12) && near(valveLiftAtPhase(580, 'in'), 0, 1e-12), '进气门窗口端点升程为 0（平滑开启/闭合）');
// 手算：360° 时两门同开 → 气门重叠；重叠区 340–380°，中点 360°。
ok(valveLiftAtPhase(360, 'ex') > 0 && valveLiftAtPhase(360, 'in') > 0, 'ψ=360° 进排气门重叠', `排 ${valveLiftAtPhase(360, 'ex').toFixed(3)} / 进 ${valveLiftAtPhase(360, 'in').toFixed(3)} mm`);
ok(VALVE.ex[0] === 140 && VALVE.ex[1] === 380 && VALVE.in[0] === 340 && VALVE.in[1] === 580, '气门窗口 = 排气 140–380°、进气 340–580°');
ok(VALVE_PEAK.ex === 260 && VALVE_PEAK.in === 460, '气门峰值相位 = 窗口中点');
ok(valveWindow('exhaust').join(',') === '140,380' && valveWindow('intake').join(',') === '340,580', 'valveWindow 接受 in/ex 与 intake/exhaust 别名');
// 窗口外逐点为零
{
  let bad = 0;
  for (let ps = 0; ps < 720; ps += 0.5) {
    const ex = norm720(ps - 140) <= 240;
    const inn = norm720(ps - 340) <= 240;
    if (!ex && valveLiftAtPhase(ps, 'ex') !== 0) bad++;
    if (!inn && valveLiftAtPhase(ps, 'in') !== 0) bad++;
    if (Math.max(valveLiftAtPhase(ps, 'ex'), valveLiftAtPhase(ps, 'in')) > VALVE.lift + 1e-9) bad++;
  }
  ok(bad === 0, '1440 个相位采样：窗口外升程为 0，且不超过 10.5 mm');
}
ok(near(valveLiftNormAtPhase(460, 'in'), 1) && near(valveLiftNormAtPhase(0, 'in'), 0), '归一化升程 0–1');
{
  // 气缸相位调用与相位函数一致：θ=700 时 1 缸 ψ=700 → 进气门关闭、排气门临近关闭
  ok(near(valveLift(700, 1, 'in'), valveLiftAtPhase(phaseOf(700, 1), 'in')), 'valveLift(θ,c,kind) = 相位函数复合');

  // -------------------------------------------------------------------------
  section('6 缸压模型（多方压缩 + 快速燃烧）');
  // 手算：进气段 0.9 bar；排气段自 1.5 泄到 1.1；压缩 0.95·(cr/V)^1.32；
  //       做功前 10° 燃烧，峰值 54·(1/V)^1.28，落在 45–62 bar（真机 40–70 bar）。
  const pk = pressurePeak();
  ok(pk.bar > 45 && pk.bar < 62, '缸压峰值在 45–62 bar', `${pk.bar.toFixed(1)} bar @ ψ=${pk.psi.toFixed(2)}°`);
  ok(pk.psi > 4 && pk.psi < 20, '峰值出现在燃烧后 5–20°', `${pk.psi.toFixed(2)}°`);
  ok(near(pressureAtPhase(430), 0.9), '进气冲程缸压 0.9 bar（ψ=430°）');
  ok(near(pressureAtPhase(180), 1.5) && near(pressureAtPhase(240), 1.1), '排气冲程：打开瞬间 1.5 bar → 1.1 bar');
  ok(near(pressureAtPhase(540), 0.95, 1e-6), '压缩起点 ψ=540° 缸压 = 0.95·(cr/cr)^1.32 = 0.95 bar');
  // 手算：ψ=720° 与 ψ=0° 首尾相接（V=1），压缩终了压力 = 0.95·10.2^1.32 ≈ 20.38 bar。
  ok(near(pressureAtPhase(0), 0.95 * Math.pow(E.cr, 1.32), 1e-9), '压缩终了 ψ=0° 缸压 = 0.95·cr^1.32 ≈ 20.38 bar', pressureAtPhase(0).toFixed(3));
  ok(near(pressureAtPhase(719.999), pressureAtPhase(0), 0.01), '压力曲线在 720°→0° 首尾连续');
  ok(near(cylinderPressure(0, 1), pressureAtPhase(phaseOf(0, 1))), 'cylinderPressure(θ,c) = 相位压力复合');
  // 峰值也在 720° 循环内：沿全循环采样 48.6 bar 只出现一次
  {
    let cnt = 0;
    for (let ps = 0; ps < 720; ps += 0.05) if (pressureAtPhase(ps) > 45) cnt++;
    ok(cnt > 20 && cnt < 400, '缸压 > 45 bar 的相位区间窄（仅燃烧初期）', `${cnt} 个 0.05° 采样`);
  }

  // -------------------------------------------------------------------------
  section('7 容积与示功图');
  ok(near(volumeAtPhase(0), 1) && near(volumeAtPhase(180), E.cr), 'V(0°)=1×VC（上止点）、V(180°)=10.2×VC（下止点）');
  ok(near(volumeAtPhase(90), 1 + (E.cr - 1) * pistonFracAtPhase(90)), 'V = 1 + (cr−1)·活塞位置分数');
  // 每 180° 冲程内容积单调：做功/进气下行体积增，排气/压缩上行体积减
  {
    const mono = (a, b) => {
      let up = 0;
      let down = 0;
      let prev = volumeAtPhase(a);
      for (let ps = a + 0.5; ps <= b; ps += 0.5) {
        const v = volumeAtPhase(ps);
        if (v > prev + 1e-9) up++;
        else if (v < prev - 1e-9) down++;
        prev = v;
      }
      return {up, down};
    };
    const s1 = mono(0, 180);
    const s2 = mono(180, 360);
    const s3 = mono(360, 540);
    const s4 = mono(540, 720);
    ok(s1.down === 0 && s1.up > 300, '做功冲程 0–180° 体积单调增大');
    ok(s2.up === 0 && s2.down > 300, '排气冲程 180–360° 体积单调减小');
    ok(s3.down === 0 && s3.up > 300, '进气冲程 360–540° 体积单调增大');
    ok(s4.up === 0 && s4.down > 300, '压缩冲程 540–720° 体积单调减小');
  }
  const pv = pvLoopSamples(1, 1);
  ok(pv.length === 721 && pv[0].psi === 0 && pv[720].psi === 720, '示功图逐 1° 采样 721 点（0–720°）');
  ok(pv[0].v === 1 && near(pv[180].v, E.cr), '示功图起于 1×VC，180° 处到 10.2×VC');
  ok(pv.every((pt) => pt.p > 0 && Number.isFinite(pt.p)), '示功图压力全部为正有限值');
  ok(near(Math.max(...pv.map((p) => p.p)), pressurePeak().bar, 0.2), '示功图峰值 = 全循环压力峰值', Math.max(...pv.map((p) => p.p)).toFixed(2));
  ok(pvLoopSamples(1, 1).every((pt, i) => pt.p === pvLoopSamples(2, 1)[i].p && pt.v === pvLoopSamples(2, 1)[i].v), '各缸示功图相同（仅相位不同）');

  // -------------------------------------------------------------------------
  section('8 气门正时曲线采样');
  const vt = valveTimingSamples(1);
  ok(vt.length === 721 && vt[0].psi === 0 && vt[720].psi === 720, '气门正时曲线逐 1° 采样 721 点');
  ok(vt.every((s) => s.pistonPct >= 0 && s.pistonPct <= 100), '活塞 % 全部落在 0–100');
  ok(near(vt[0].pistonPct, 100) && near(vt[180].pistonPct, 0), '活塞 % = 100（上止点）/ 0（下止点）');
  ok(near(Math.max(...vt.map((s) => s.liftIn)), VALVE.lift, 1e-9) && near(Math.max(...vt.map((s) => s.liftEx)), VALVE.lift, 1e-9), '进/排气门升程峰值 = 10.5 mm');
  ok(near(Math.max(...vt.map((s) => s.liftInN)), 1) && near(Math.max(...vt.map((s) => s.liftExN)), 1), '归一化升程峰值 = 1');
  ok(valveTimingSamples(4).length === 181 && near(valveTimingSamples(4)[45].psi, 180), '可指定采样步长（4° → 181 点）');

  // -------------------------------------------------------------------------
  section('9 气场颜色键（四冲程图例）');
  ok(chargeAtPhase(30) === 2 && chargeAtPhase(200) === 3 && chargeAtPhase(430) === 0 && chargeAtPhase(600) === 1, '气场键：燃烧→排气→进气→压缩 = 2/3/0/1');
  ok([30, 200, 430, 600].map(chargeKeyAtPhase).join(',') === 'combustion,exhaust,intake,compressed', '气场键名 = combustion / exhaust / intake / compressed');
  ok(CHARGE_LABELS.join(',') === '进气·混合气,压缩,做功燃烧,排气', 'HUD 图例文案 = 进气·混合气 / 压缩 / 做功燃烧 / 排气');
  ok(STROKE_HUD_ORDER.join(',') === 'intake,compression,power,exhaust' && STROKE_KEYS.join(',') === 'power,exhaust,intake,compression', '冲程时间顺序与面板显示顺序分开定义');
  ok(Object.entries(STROKE_CN).every(([k, v]) => ['做功', '排气', '进气', '压缩'].includes(v)), '冲程中文名 = 做功/排气/进气/压缩');

  // -------------------------------------------------------------------------
  section('10 影片时间轴与转速曲线');
  ok(near(rpmAt(0), 700) && near(rpmAt(12.1), 700) && near(rpmAt(13.5), 2400) && near(rpmAt(26), 2400), '转速 700 →（12.1 s 起 1.4 s 缓动）→ 2400');
  // 手算：五次缓动在区间中点恰好 0.5 → 12.8 s 时 rpm = 700 + 1700 × 0.5 = 1550。
  ok(near(rpmAt(12.8), 1550, 1e-6), '缓动中点 12.8 s 转速 = 1550 rpm', rpmAt(12.8).toFixed(3));
  {
    let bad = 0;
    let prev = -Infinity;
    for (let t = 0; t <= 26; t += 0.05) {
      const r = rpmAt(t);
      if (r < prev - 1e-9) bad++;
      prev = r;
    }
    ok(bad === 0, '转速曲线全程单调不降');
  }
  ok(thetaAt(0) === FILM_THETA0, '影片起始曲轴角 θ(0) = 12°');
  // 手算：700 rpm、回放 1/20 → 700/60×360/20 = 210°/s；2400 rpm → 720°/s。
  {
    const rate = (t) => (thetaAt(t + 0.001) - thetaAt(t - 0.001)) / 0.002;
    ok(near(rate(5), 210, 0.5), '回放 1/20：700 rpm → 屏上 210°/s', rate(5).toFixed(2));
    ok(near(rate(20), 720, 1), '回放 1/20：2400 rpm → 屏上 720°/s', rate(20).toFixed(2));
    let mono = true;
    for (let t = 0; t < 26; t += 0.01) if (thetaAt(t + 0.01) <= thetaAt(t)) mono = false;
    ok(mono, '曲轴角随时间单调递增');
    console.log(`  info   θ(26 s) = ${thetaAt(26).toFixed(1)}°（${(thetaAt(26) / 720).toFixed(2)} 个四冲程循环）`);
  }
  ok(near(advanceTheta(0, 700, 1), 210, 1e-9), '互动页推进式：700 rpm × 1 s × 1/20 = 210°', advanceTheta(0, 700, 1));
  ok(PLAYBACK === 1 / 20 && RPM.filmRamp[2] === 1.4, '回放 1/20、转速缓动 1.4 s');
  // 影片节拍
  ok(TOUR.length === 9 && TOUR[0].t === 0 && TOUR[8].t === 22.5, '巡览节拍 9 条（0 → 22.5 s）');
  ok(trackedCylinderAt(0) === 1 && trackedCylinderAt(6.8) === 1 && trackedCylinderAt(7) === 6 && trackedCylinderAt(22.4) === 6 && trackedCylinderAt(22.5) === 1, '跟踪气缸：0–6.9 s 缸 1；6.9–22.5 s 缸 6；之后缸 1');
  ok([0, 3.5, 9.7, 14.7, 17.3, 19.9, 25].map(camKeyAt).join(',') === 'open,cyl,valley,side,front,hero,hero', '镜头节拍：open → cyl → valley → side → front → hero');
  ok(FILM_DURATION === 26, '影片总长 26 s');

  // -------------------------------------------------------------------------
  section('11 一键遥测（HUD 数字同源）');
  {
    const s = telemetry(20);
    ok(Number.isFinite(s.theta) && s.theta === thetaAt(20), 'telemetry(t).theta = thetaAt(t)');
    ok(s.rpm === 2400 && s.cyl === 6, 't=20 s：转速 2400 rpm、跟踪气缸 6');
    ok(near(s.psi, phaseOf(s.theta, 6)) && near(s.pressure, pressureAtPhase(s.psi)), '压力 / 相位由同一 ψ 导出');
    ok(s.strokeCN === STROKE_CN[s.strokeKey] && s.crank === norm720(s.theta), '冲程中文名与曲轴角（0–720°）一致');
    ok(s.pistonPct >= 0 && s.pistonPct <= 100 && s.liftIn >= 0 && s.liftEx >= 0, '活塞 % 与气门升程在有效域内');
    ok(s.firing >= 1 && s.firing <= 8 && Number.isFinite(s.pinAngle), '点火缸与曲柄销角有效');
    ok(s.peakPressure === pressurePeak().bar, '遥测里的缸压峰值 = pressurePeak()');
  }
  // 互动页可传入自己的 θ / rpm / cyl（纯函数，不依赖影片时间）
  {
    const s = telemetry(0, {theta: 0, rpm: 800, cyl: 1});
    ok(s.theta === 0 && s.rpm === 800 && s.cyl === 1 && s.crank === 0, 'telemetry 支持实时 θ/rpm/cyl 覆盖');
    ok(s.strokeKey === 'power' && near(s.pressure, pressureAtPhase(0)) && s.firing === 1, 'θ=0：1 缸压缩上止点、点火、进入做功冲程');
  }

  // -------------------------------------------------------------------------
  section('12 θ=0 时 1 缸压缩上止点（关键约定）');
  ok(phaseOf(0, 1) === 0 && near(pistonPose(0, 1).disp, 0) && pistonPose(0, 1).vel === 0, 'ψ=0°、位移 0、速度为 0 → 上止点');
  ok(strokeKeyOf(0, 1) === 'power', '压缩终了瞬间 = 做功冲程起点（面板显示「做功」）');
  ok(valveLift(0, 1, 'in') === 0 && valveLift(0, 1, 'ex') === 0, '点火上止点两气门关闭（无重叠）');
  ok(near(cylinderPressure(0, 1), 0.95 * Math.pow(E.cr, 1.32)), '点火瞬间缸压 = 压缩终了压力 ≈ 20.38 bar');
  ok(afterTDCOf(607, 1) === 247, '相位 607° 折回正视图 247°（「247° 上止点后」）');
}

// ---------------------------------------------------------------------------
section('13 缸位布置');
ok(CYL.length === 8 && CYL.every((c) => (c.c % 2 === 1) === (c.bank === 'L')), '奇数缸左列、偶数缸右列');
ok(CYL[0].z === 179 && CYL[7].z === -179 && CYL.every((c, i) => i === 0 || CYL[i - 1].z > c.z), '1 缸在最前（z=179），逐缸向后到 8 缸（z=−179）');
ok(CYL.every((c) => c.pin === Math.floor((c.c - 1) / 2)), '同销两缸成对：1·2 / 3·4 / 5·6 / 7·8');
ok(near(Math.abs(CYL[0].z - CYL[1].z), 2 * E.rodOff), '同销两列活塞销错位 2×rodOff = 22 mm');
ok(CYL.map((c) => c.z).join(',') === '179,157,67,45,-45,-67,-157,-179', '缸位 z 表', CYL.map((c) => c.z).join(','));

// ---------------------------------------------------------------------------
section('14 输入校验');
throws(() => pistonPose(0, 0), '气缸号 0 抛 RangeError');
throws(() => pistonPose(0, 9), '气缸号 9 抛 RangeError');
throws(() => pistonPose(0, 1.5), '非整数气缸号抛 RangeError');
throws(() => crankPinAngle(0, 4), '曲柄销号 4 抛 RangeError');
throws(() => camPeakPhase(1, 'x'), '未知气门种类抛 RangeError');
throws(() => phaseOf(0, 0), 'phaseOf 非法气缸号抛 RangeError');

// ---------------------------------------------------------------------------
section('15 HUD 文案常量（数字同源）');
ok(HUDFMT.firingOrderText === '1-8-4-3-6-5-7-2' && HUDFMT.fireIntervalDeg === 90, '点火顺序文本与点火间隔');
ok(HUDFMT.timingGearText === '24 : 72' && HUDFMT.camSpeedText === '半速', '正时齿轮 24:72、凸轮轴半速');
ok(HUDFMT.playbackText === '1 / 20 速度' && HUDFMT.formula === 's = r·cos φ + √(L² − r² sin²φ)', '回放文案与滑块机构公式');
ok(HUDFMT.valveExWindow === '140–380°' && HUDFMT.valveInWindow === '340–580°' && HUDFMT.valveLiftMm === 10.5, '气门窗口/升程文案');
ok(FILM_THETA0 === 12 && TOUR.find((b) => b.rpm).rpm.join(',') === '700,2400,1.4', '影片起始角与转速节拍 700→2400');

// ---------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------');
console.log(` 通过 ${oks} 项，失败 ${fails} 项`);
if (fails) {
  console.log(' 结果：FAILED');
  process.exit(1);
}
console.log(' 结果：ALL CHECKS PASSED');
process.exit(0);
