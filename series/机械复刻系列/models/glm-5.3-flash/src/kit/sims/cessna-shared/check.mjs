// check.mjs — 塞斯纳 337 主起落架模型数字断言。运行：node check.mjs（与 gear.js 同目录）。
import {G, AXIS, LEG0, J, E0, TIP0, tipAt, GROUND} from './gear.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};
const D2R = Math.PI / 180;

// ------------------------------------------------------------ 手算检验（文章的核心手算）
console.log('hand-check: 齿条行程与齿轮转角');
console.log(`  分度圆直径 = 齿数 × 模数 = 32 × 4 mm = ${32 * 4} mm`);
console.log(`  半周长 = π·128/2 = ${((Math.PI * 128) / 2).toFixed(1)} mm  → 齿条行程 ${G.stroke * 1000} mm`);
console.log(`  齿条走 ${G.stroke * 1000} mm → 齿轮转 ${(G.stroke * 1000 / (Math.PI * 128) * 360).toFixed(1)}°（应恰为 180°）`);

// 1. 参数一致性
ok(Math.abs(G.pinionR - 0.064) < 1e-9, '齿轮分度圆半径 64 mm（128 mm 直径）', `${G.pinionR * 1000} mm`);
ok(Math.abs(G.stroke - 0.201) < 5e-4, '齿条行程 201 mm', `${(G.stroke * 1000).toFixed(1)} mm`);
{
  const exact = (Math.PI * G.pinionR); // 半周长 = π·r
  ok(Math.abs(G.stroke - exact) < 0.0006, '行程 = 齿轮半周长（半圈）', `π·64 = ${(exact * 1000).toFixed(1)} mm`);
}

// 2. 半圈转角下轮端轨迹：th 从 0 到 π，轮心从跑道位收到机身侧
{
  const down = tipAt(0);
  const up = tipAt(Math.PI);
  ok(down.y < -0.5, '收起前轮心在下方（跑道位）', `y ${down.y.toFixed(3)} m`);
  ok(Math.abs(up.y - down.y) < 0.6 && up.y > down.y - 0.01, '收起后轮心升到机身附近', `y ${up.y.toFixed(3)} m`);
  ok(Math.abs(GROUND + (TIP0.y - G.wheelR)) < 1e-9, 'GROUND = -(TIP0.y - wheelR)（轮胎贴地）');
}

// 3. 侧管轴与腿的几何
ok(Math.abs(AXIS.length() - 1) < 1e-9, '侧管轴为单位向量');
ok(Math.abs(LEG0.length() - 1) < 1e-9, '腿向为单位向量');
ok(E0.distanceTo(J) - G.tubeLen < 1e-9, 'E0 距关节 = 管长', `${(E0.distanceTo(J) * 1000).toFixed(0)} mm`);
ok(TIP0.distanceTo(E0) - G.legLen < 1e-9, '轮心距 E0 = 腿长', `${(TIP0.distanceTo(E0) * 1000).toFixed(0)} mm`);

// 4. 旋转不改变与轴的距离（万向节只传递转动：两侧对称）
{
  const axis = AXIS.clone().normalize();
  const d0 = TIP0.clone().sub(J).applyAxisAngle(axis, 0).length();
  const d1 = TIP0.clone().sub(J).applyAxisAngle(axis, Math.PI * 0.5).length();
  ok(Math.abs(d0 - d1) < 1e-9, '绕侧管轴旋转保持半径（纯转动）', d0.toFixed(3));
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
