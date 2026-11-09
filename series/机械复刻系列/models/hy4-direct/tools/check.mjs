// check.mjs —— 纯数学层硬断言：结构量、物理量、节拍、确定性、来源纯净度。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as M from '../src/model.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
let pass = 0, fail = 0;
const ok = (cond, name, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

console.log('== 结构量（手算复核）==');
const S = M.structure();
ok(S.arms === 8, '八条腕足', String(S.arms));
ok(S.linksPerArm === 25, '每腕 25 节', String(S.linksPerArm));
ok(S.links === 8 * 25 + 2 && S.links === 202, '总节数 = 8×25+2 = 202', String(S.links));
ok(S.wheelsPerArm === 50 + 6 + 4 && S.wheelsPerArm === 60, '每腕滚轮 = 50 关节 + 6 根 + 4 尖 = 60', String(S.wheelsPerArm));
ok(S.wheels === 8 * 60 && S.wheels === 480, '总滚轮 = 480', String(S.wheels));
ok(S.rivets === 8 * 25 * 6 && S.rivets === 1200, '总铆钉 = 1200', String(S.rivets));
ok(S.hydraulics === 8 * 25, '液压微缸 = 200', String(S.hydraulics));
ok(near(S.armLength, 1.0), '单臂长 = 1.0 m', `${S.armLength} m`);
ok(S.petals === 8 && S.optics === 2 && S.siphonSleeves === 3 && S.nozzleFlaps === 6 && S.reactorPistons === 7,
   '外套膜 8 瓣 / 双光学 / 3 套筒 / 6 喷瓣 / 7 活塞');

console.log('== 节拍与时长 ==');
ok(M.DURATION === 25, '片长 25 s');
ok(M.PULSE_HZ === 1.8, '喷射频率 1.8 Hz（原作 0 s HUD）');
ok(M.SHOTS.length === 10, '共 10 拍', String(M.SHOTS.length));
ok(M.SHOTS[0].at === 0, '首拍 0 s');
ok(M.SHOTS[1].at === 3.5 && M.SHOTS[2].at === 7.5 && M.SHOTS[3].at === 10 &&
   M.SHOTS[4].at === 12.5 && M.SHOTS[5].at === 14.5 && M.SHOTS[6].at === 16 &&
   M.SHOTS[7].at === 18.5 && M.SHOTS[8].at === 20 && M.SHOTS[9].at === 24,
   '拍点对齐原作关键帧：0 / 3.5 / 7.5 / 10 / 12.5 / 14.5 / 16 / 18.5 / 20 / 24 s');
ok(M.SHOTS.every((s) => /[一-龥]/.test(s.name) && /[一-龥]/.test(s.note)), '拍名与备注全中文');
let mono = true;
for (let k = 1; k < M.SHOTS.length; k++) if (M.SHOTS[k].at <= M.SHOTS[k - 1].at) mono = false;
ok(mono, '拍点严格递增');

console.log('== 唯一输入 / 确定性 ==');
const a = JSON.stringify(M.stateAt(10.37));
const b = JSON.stringify(M.stateAt(10.37));
ok(a === b, '同一 t 的 stateAt 完全一致');
ok(JSON.stringify(M.stateAt(10.37)) !== JSON.stringify(M.stateAt(10.38)), '不同 t 状态不同');
ok(near(M.jetPhase(0), 0) && near(M.jetPhase(1 / 1.8), 0), '喷射相位以 1/1.8 s 为周期');
ok(M.armChain2D(0, 3).pts.length === M.LINKS + 1, '腕链点数 = 节数 + 1');
let bounds = true;
for (let i = 0; i < 8; i++) for (let j = 0; j < 25; j++) {
  const v = M.hydraulicStroke(i, j, 7.3);
  if (!(v >= 0 && v <= 1)) bounds = false;
}
ok(bounds, '液压行程全部落在 0..1');
let curlOk = true;
for (let t = 0; t < 25; t += 0.25) for (let i = 0; i < 8; i++) {
  const c = M.armCurl(i, t); if (!(c >= 0 && c <= 1)) curlOk = false;
}
ok(curlOk, '全时间轴腕足卷曲量有界');

console.log('== 遥测（原作 0 s 读数）==');
const T = M.telemetry(0);
ok(T.pressure > 11 && T.pressure <= 76.001, '压力 ≤ 76 kPa', T.pressure.toFixed(1));
ok(T.thrust > 24 && T.thrust <= 172.001, '推力 ≤ 172 N', T.thrust.toFixed(1));
ok(near(T.battery, 87 - 0.7 * M.jetPulse(0), 1e-9), '电量由 t 推导、非写死');
let telOk = true;
for (let t = 0; t <= 25; t += 0.1) {
  const x = M.telemetry(t);
  if (!Number.isFinite(x.pressure + x.thrust + x.power + x.depth + x.speed)) telOk = false;
  if (x.battery < 80 || x.battery > 90) telOk = false;
}
ok(telOk, '全时间轴遥测有限且电量合理');

console.log('== 拆解 / 机位 ==');
ok(near(M.explode(15), 0), '拆解前为 0');
ok(M.explode(22) > 0.95, '22 s 拆解到位', M.explode(22).toFixed(3));
ok(M.explode(24.8) < 0.05, '离站时归位', M.explode(24.8).toFixed(3));
let camOk = true;
for (let t = 0; t <= 25; t += 0.05) {
  const c = M.cameraAt(t);
  if (![...c.eye, ...c.look, c.fov].every(Number.isFinite)) camOk = false;
}
ok(camOk, '全时间轴机位有限连续');
ok(Object.keys(M.VIEWS).length === M.SHOTS.length, '每拍有独立机位');

// ---- 运镜质量：按 30 fps 逐帧检查，防「定格—闪现—定格」与穿模 ----
const FPS = 30;
let prev = null, maxStep = 0, maxStepT = 0, still = 0, minDist = Infinity, minDistT = 0, minEyeR = Infinity;
for (let i = 0; i <= 25 * FPS; i++) {
  const t = i / FPS, c = M.cameraAt(t);
  const r = Math.hypot(c.eye[0], c.eye[1] - 0.45, c.eye[2]); // 到机器中心 (0,0.45,0)
  if (r < minEyeR) minEyeR = r;
  if (c.dist < minDist) { minDist = c.dist; minDistT = t; }
  if (prev) {
    const d = Math.hypot(c.eye[0] - prev.eye[0], c.eye[1] - prev.eye[1], c.eye[2] - prev.eye[2]);
    if (d > maxStep) { maxStep = d; maxStepT = t; }
    if (d < 1e-5) still++;
  }
  prev = c;
}
ok(still === 0, '相机无静止帧（全程连续运动）', `静止 ${still} 帧`);
ok(maxStep <= 0.10, '单帧位移 ≤ 0.10 m（30 fps）', `${maxStep.toFixed(3)} m @ ${maxStepT.toFixed(2)} s`);
ok(minDist >= 0.9, '相机到注视点 ≥ 0.9 m（不贴脸）', `${minDist.toFixed(2)} m @ ${minDistT.toFixed(2)} s`);
ok(minEyeR >= 0.62, '相机到机器中心 ≥ 0.62 m（不穿模）', `${minEyeR.toFixed(2)} m`);
const meanStep = (() => {
  let s = 0, n = 0, p = null;
  for (let i = 0; i <= 25 * FPS; i++) {
    const c = M.cameraAt(i / FPS);
    if (p) { s += Math.hypot(c.eye[0] - p.eye[0], c.eye[1] - p.eye[1], c.eye[2] - p.eye[2]); n++; }
    p = c;
  }
  return s / n;
})();
ok(meanStep > 0.004, '平均每帧仍在缓慢移动（有微漂移）', `${(meanStep * 1000).toFixed(1)} mm/帧`);

console.log('== 来源纯净度（不读既有实现）==');
const srcFiles = ['model.js', 'stage.js', 'geometry.js', 'console.js', 'main.js', 'style.js'];
let clean = true;
for (const f of srcFiles) {
  const txt = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
  if (/deepseek复刻|glm5\.3|hunyuan复刻|src\/kit|Math\.random|new Date|Date\.now|performance\.now/.test(txt)) {
    console.log(`    ! ${f} 含禁用引用或真实时钟`); clean = false;
  }
}
ok(clean, '六个源文件零既有实现引用、零随机、零真实时钟（main.js 播放器除外见下）');
const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
ok(!/deepseek复刻|glm5\.3|hunyuan复刻|src\/kit/.test(main), 'main.js 零既有实现引用');
ok(!/Math\.random/.test(main), 'main.js 零随机');

console.log(`\n===== ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
