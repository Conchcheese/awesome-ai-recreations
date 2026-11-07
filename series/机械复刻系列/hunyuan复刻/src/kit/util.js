// 通用数学 / 缓动 / 小工具。全部纯函数，无副作用。

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, v) => clamp((v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, invlerp(a, b, v));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const pulse = (x) => Math.sin(clamp(x) * Math.PI); // 0→1→0

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOutQuint = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

// 帧率无关阻尼
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

// 最短角度差 / 角度插值（弧度）
export const shortAngle = (a, b) => {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return d;
};
export const lerpAngle = (a, b, t) => a + shortAngle(a, b) * t;

// 确定性伪随机（装饰与细节用，保证逐帧可复现）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 数字格式化
export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
export const fmtSigned = (v, d = 1) => (v >= 0 ? '+' : '') + fmt(v, d);
export const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
export const timecode = (sec) => {
  const s = Math.max(0, sec);
  return `${pad2(s / 60)}:${pad2(s % 60)}`;
};
export const pct = (v, d = 0) => `${fmt(v * 100, d)}%`;

// 采样一条“关键点曲线”：points = [[t0,v0],[t1,v1],...]（t 递增），段内 smoothstep
export function curve(points, t) {
  if (t <= points[0][0]) return points[0][1];
  const n = points.length;
  if (t >= points[n - 1][0]) return points[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    if (t >= t0 && t <= t1) {
      if (t1 - t0 < 1e-9) return v1;
      return lerp(v0, v1, smoothstep(t0, t1, t));
    }
  }
  return points[n - 1][1];
}

// 线性采样（段内线性，适合物理量）
export function curveLinear(points, t) {
  if (t <= points[0][0]) return points[0][1];
  const n = points.length;
  if (t >= points[n - 1][0]) return points[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    if (t >= t0 && t <= t1) return lerp(v0, v1, (t - t0) / (t1 - t0 || 1));
  }
  return points[n - 1][1];
}

// 数组快照（摄像机位姿用）
export const v3 = (a) => [a[0], a[1], a[2]];

export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}
