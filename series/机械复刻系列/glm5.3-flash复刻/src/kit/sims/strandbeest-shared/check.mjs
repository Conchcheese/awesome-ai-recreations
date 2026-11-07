// check.mjs — 海滩兽 Strandbeest 模型数字断言。运行：node kit/sims/strandbeest-shared/check.mjs（kit 内，依赖 three 由 beast.js 引入）。
import {HOLY, solveLeg, solveMirror, PATH, FOOT_MIN, FOOT_MAX, footLift, LINKS} from './jansen.js';
import {S, STRIDE, CFG, phaseOf, legAt} from './beast.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};

// ------------------------------------------------------------ 手算检验
console.log('hand-check: 十一个神圣数字与腿数');
console.log(`  HOLY = ${Object.values(HOLY).join(', ')}（Jansen 1990）`);
console.log(`  10 个曲柄相位 × 左右镜像 = ${CFG.stations * 2} 条腿；相位步进 ${360 / CFG.stations}°`);

// 1. 连杆长度与关节距离一致（circle-intersection 的前提）
for (let k = 0; k < 720; k += 45) {
  const th = (k / 720) * Math.PI * 2;
  const J = solveLeg(th);
  for (const [p0, p1, key] of LINKS) {
    const d = Math.hypot(J[p0][0] - J[p1][0], J[p0][1] - J[p1][1]);
    if (Math.abs(d - HOLY[key]) > 1e-6) {
      ok(false, `连杆 ${key} 长度 = ${HOLY[key]}`, `θ=${k}° 时 ${d.toFixed(4)}`);
      break;
    }
  }
}
ok(true, '每根连杆在任意曲轴角都保持神圣数字长度（圆交点解算正确）');

// 2. 脚轨迹：支撑相窗口与抬升（阈值 0.6 与 contact chart/feetDown 一致）
{
  let flat = 0;
  for (let k = 0; k < 720; k++) if (footLift((k / 720) * Math.PI * 2) < 0.6) flat++;
  ok(Math.abs(flat / 2 - 137.5) < 1, '支撑相 = 137.5°（阈值 0.6，与接触表判定一致；经典文献值 155° 对应更宽的脚垫判定）', `${flat / 2}°`);
  const liftMax = FOOT_MAX - FOOT_MIN;
  ok(liftMax > 20 && liftMax < 25, '脚抬升总量 20–25 单位（×S×1000 ≈ 270 mm 量级）', liftMax.toFixed(1));
}

// 3. 步幅两个口径：console 标 672 mm = 支撑段脚水平位移；STRIDE = 无滑移机身每转前进量（film 的 speed = rps·|STRIDE|·S）
{
  let minX = 1e9, maxX = -1e9;
  for (let k = 0; k < 720; k++) {
    const p = PATH[k];
    if (p[1] - FOOT_MIN < 0.6) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
    }
  }
  const span = (maxX - minX) * S;
  ok(Math.abs(span - 0.624) < 0.01, '支撑段脚水平位移 ≈ 624 mm（console 已改为读模型，原写死 672 mm 不符）', `${(span * 1000).toFixed(0)} mm`);
  ok(Math.abs(STRIDE * S) > 1.5 && Math.abs(STRIDE * S) < 1.8, '机身每转前进量 ≈ 1.6 m（无滑移积分）', `${(STRIDE * S).toFixed(3)} m`);
}

// 4. 镜像腿：π − th 再取反 x；连杆长度在镜像上同样成立
{
  const th = 0.7;
  const M = solveMirror(th);
  ok(M.F[0] > 0 && solveLeg(th).F[0] < 0, '正腿朝 −x、镜像腿朝 +x', `${solveLeg(th).F[0].toFixed(1)} / ${M.F[0].toFixed(1)}`);
  let mirrorOK = true;
  for (const [p0, p1, key] of LINKS) {
    const d = Math.hypot(M[p0][0] - M[p1][0], M[p0][1] - M[p1][1]);
    if (Math.abs(d - HOLY[key]) > 1e-6) mirrorOK = false;
  }
  ok(mirrorOK, '镜像腿连杆长度同样成立');
}

// 5. 相位波：相邻站位差 36°，头 → 尾
{
  const d0 = phaseOf(0);
  const d1 = phaseOf(1);
  ok(Math.abs((d1 - d0) + Math.PI / 5) < 1e-9, '相邻站位相位差 −36°（相位沿站号线性）', `${((d1 - d0) * 180 / Math.PI).toFixed(1)}°`);
  const J0 = legAt(0, 0, 0).F;
  ok(Number.isFinite(J0[0]), 'legAt(0,0,0) 可解');
}

// 6. 比例尺：S = 0.012 m/单位；曲轴上 10 站跨距（console 的 3.1 m 是含腿展的整机长度）
{
  const span = (CFG.stations - 1) * CFG.spacing * S;
  ok(Math.abs(span - 2.808) < 0.01, '曲轴站位跨距 = 9 × 26 × S ≈ 2.81 m', `${span.toFixed(2)} m（整机 3.1 m 含腿展）`);
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
