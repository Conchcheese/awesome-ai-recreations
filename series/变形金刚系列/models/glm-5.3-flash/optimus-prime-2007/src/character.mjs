// 擎天柱 2007 真人电影版 · 程序化角色与确定性变形拓扑（独立实现）
// 几何/机构/材质从 references/sources.json 登记的 8 帧自建；世界尺寸均为 guess（见 spec.md）。
// 纯计算模块：不触碰 DOM；stateAt(t, explode) 完全由 t 与 explode 决定。

import * as THREE from 'three';

// ---------- 小工具 ----------
const TAU = Math.PI * 2;
const rad = (d) => d * Math.PI / 180;
const ease = (x) => { // 有界缓入缓出（工作流协议：曲线使用有界缓入缓出）
  const c = Math.min(1, Math.max(0, x));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
function lerp(a, b, k) { return a + (b - a) * k; }
function lerpV(a, b, k, out) {
  out[0] = lerp(a[0], b[0], k); out[1] = lerp(a[1], b[1], k); out[2] = lerp(a[2], b[2], k);
  return out;
}
// 通道关键帧插值：keys=[[t,[x,y,z]],...]，段内 ease
export function sampleChannel(keys, t) {
  // 始终返回副本：边界直接返回关键帧引用会让 explode 偏移污染静态轨道表
  if (t <= keys[0][0]) return [...keys[0][1]];
  if (t >= keys[keys.length - 1][0]) return [...keys[keys.length - 1][1]];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const k = ease((t - t0) / (t1 - t0));
      return lerpV(v0, v1, k, [0, 0, 0]);
    }
  }
  return keys[keys.length - 1][1];
}

// ---------- 程序化贴图 ----------
function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.min(255, Math.round(v * k));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
// 火焰拉花 v3：连体"火浪"带 + 向上立起的火舌 + 描线（程序化绘制，风格对齐 102s/080s 目视）
// flow='h'：流向沿 U（侧面/立面）；flow='v'：沿 V（顶面，映射车长方向）
export function flameTexture(base, outer, mid, pinstripe, flow = 'h', flip = false) {
  const [c, g] = canvas2d(1024, 512);
  const W = 1024, H = 512;
  const grad = g.createLinearGradient(0, 0, flow === 'h' ? 0 : W, flow === 'h' ? H : 0);
  grad.addColorStop(0, shade(base, 1.18)); grad.addColorStop(0.5, base); grad.addColorStop(1, shade(base, 0.62));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const T = (x, y) => (flow === 'h' ? [x, y] : [y, x]); // 流向坐标 → 画布坐标
  const wave = (x, amp, phase) => y0 + Math.sin(x / W * Math.PI * 3 + phase) * amp; // 火浪中线
  const y0 = H * 0.66;
  const dir = flip ? -1 : 1;
  const X = (fx) => (dir > 0 ? fx * W : W - fx * W);
  // 连体火浪带：上缘波浪、下缘回落，构成一整条填充带
  function band(topAmp, drop, color, phase) {
    g.fillStyle = color;
    g.beginPath();
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const fx = i / N;
      const [px, py] = T(X(fx), wave(fx * W, topAmp, phase) - topAmp * 0.4);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    for (let i = N; i >= 0; i--) {
      const fx = i / N;
      const [px, py] = T(X(fx), wave(fx * W, topAmp * 0.35, phase + 1.2) + drop);
      g.lineTo(px, py);
    }
    g.closePath(); g.fill();
  }
  band(64, 46, outer, 0.4);
  band(46, 30, mid, 1.7);
  band(20, 12, pinstripe, 2.6);
  // 立起的火舌：从火浪向上挑的细长泪滴
  function lick(fx, hgt, lean, color) {
    const bx = X(fx), by = wave(fx * W, 50, 0.4) - 10;
    g.fillStyle = color;
    g.beginPath();
    const [x0, yb] = T(bx, by), [x1, yt] = T(bx + lean * 0.35, by - hgt), [x2, ytp] = T(bx + lean, by - hgt * 0.86);
    g.moveTo(x0, yb);
    g.quadraticCurveTo(x1, yt, x2, ytp);
    g.quadraticCurveTo(...T(bx + lean * 0.75, by - hgt * 0.5), ...T(bx + 30, by + 8));
    g.closePath(); g.fill();
  }
  for (const [fx, h, ln] of [[0.12, 190, 60], [0.3, 130, 42], [0.5, 210, 70], [0.68, 150, 48], [0.86, 175, 58]]) lick(fx, h, ln * dir, outer);
  for (const [fx, h, ln] of [[0.2, 120, 38], [0.44, 150, 48], [0.62, 105, 34], [0.8, 135, 42]]) lick(fx, h, ln * dir, mid);
  for (const [fx, h, ln] of [[0.32, 80, 24], [0.56, 95, 28], [0.74, 70, 20]]) lick(fx, h, ln * dir, pinstripe);
  // 老化划痕
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
  for (let i = 0; i < 80; i++) {
    const x = (i * 137) % W, y = (i * 331) % H;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 22, y + 5); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
// 徽记：简化棱面机器人头像（示意派系徽标，非官方矢量复刻）
function emblemTexture() {
  const [c, g] = canvas2d(256, 256);
  g.fillStyle = '#c9cdd4'; g.beginPath();
  g.moveTo(128, 16); g.lineTo(228, 70); g.lineTo(228, 160); g.lineTo(128, 240); g.lineTo(28, 160); g.lineTo(28, 70);
  g.closePath(); g.fill();
  g.fillStyle = '#23262c';
  g.beginPath(); g.moveTo(128, 40); g.lineTo(206, 82); g.lineTo(206, 150); g.lineTo(128, 212); g.lineTo(50, 150); g.lineTo(50, 82);
  g.closePath(); g.fill();
  g.fillStyle = '#c9cdd4';
  g.beginPath(); g.moveTo(128, 66); g.lineTo(178, 92); g.lineTo(178, 132); g.lineTo(128, 178); g.lineTo(78, 132); g.lineTo(78, 92);
  g.closePath(); g.fill();
  g.fillStyle = '#23262c';
  g.fillRect(88, 100, 26, 22); g.fillRect(142, 100, 26, 22); g.fillRect(106, 136, 44, 16);
  g.fillRect(118, 60, 20, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// 沥青地面
export function asphaltTexture() {
  const [c, g] = canvas2d(512, 512);
  g.fillStyle = '#191c20'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = 18 + (i * 7919) % 26;
    g.fillStyle = `rgba(${v},${v + 2},${v + 5},0.5)`;
    g.fillRect((i * 509) % 512, (i * 7717) % 512, 2, 2);
  }
  g.strokeStyle = 'rgba(255,255,255,0.045)'; g.lineWidth = 2;
  g.strokeRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 14);
  return tex;
}

// ---------- 材质库 ----------
export function makeMaterials() {
  const M = (opts) => new THREE.MeshStandardMaterial(opts);
  const hasDOM = typeof document !== 'undefined'; // Node 侧检查/目录生成无 DOM，退化纯色
  return {
    paintRed: M(hasDOM
      ? { map: flameTexture('#8f1a1e', '#d96a1e', '#b33420', '#f2e9dc', 'h'), metalness: 0.6, roughness: 0.38, envMapIntensity: 0.7 }
      : { color: 0x8f1a1e, metalness: 0.6, roughness: 0.38 }),
    paintRedTop: M(hasDOM
      ? { map: flameTexture('#8f1a1e', '#d96a1e', '#b33420', '#f2e9dc', 'v'), metalness: 0.6, roughness: 0.38, envMapIntensity: 0.7 }
      : { color: 0x8f1a1e, metalness: 0.6, roughness: 0.38 }),
    paintBlue: M(hasDOM
      ? { map: flameTexture('#1f2f6e', '#b33420', '#8a2a1e', '#dfe6f2', 'h', true), metalness: 0.6, roughness: 0.36, envMapIntensity: 0.7 }
      : { color: 0x1f2f6e, metalness: 0.6, roughness: 0.36 }),
    paintRedPlain: M({ color: 0x7e1518, metalness: 0.6, roughness: 0.4, envMapIntensity: 0.7 }),
    paintBluePlain: M({ color: 0x1e2c66, metalness: 0.6, roughness: 0.38, envMapIntensity: 0.7 }),
    chrome: M({ color: 0xd6dade, metalness: 1.0, roughness: 0.12, envMapIntensity: 1.25 }),
    steel: M({ color: 0x43474e, metalness: 0.85, roughness: 0.5, envMapIntensity: 0.7 }),
    dark: M({ color: 0x23262b, metalness: 0.6, roughness: 0.62, envMapIntensity: 0.5 }),
    gold: M({ color: 0x8a6b3a, metalness: 0.9, roughness: 0.38, envMapIntensity: 0.9 }),
    silver: M({ color: 0xc4c9d0, metalness: 0.85, roughness: 0.24, envMapIntensity: 1.1 }),
    glass: M({ color: 0x0e1a24, metalness: 0.1, roughness: 0.06, envMapIntensity: 1.4 }),
    rubber: M({ color: 0x17181a, metalness: 0.0, roughness: 0.92 }),
    glow: M({ color: 0xaee2ff, emissive: 0x66ccff, emissiveIntensity: 3.2, metalness: 0, roughness: 0.4 }),
    markerBlue: M({ color: 0x2a52d4, emissive: 0x1a3fb0, emissiveIntensity: 1.1, roughness: 0.4 }),
    markerAmber: M({ color: 0xd99a2b, emissive: 0x8a5c12, emissiveIntensity: 0.9, roughness: 0.4 }),
    emblem: M(hasDOM
      ? { map: emblemTexture(), metalness: 0.5, roughness: 0.4 }
      : { color: 0xc9cdd4, metalness: 0.5, roughness: 0.4 }),
  };
}
// 灰模覆盖材质（浅/深/玻璃三分，保证灰模下仍有层次）
export function makeOverrideMats() {
  return {
    gray: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.1, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3c4046, metalness: 0.1, roughness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x6f7d8a, metalness: 0.1, roughness: 0.4, transparent: true, opacity: 0.55 }),
  };
}
export const SYSTEM_TINT = {
  'paint-red': 0xd94a3a, 'paint-blue': 0x4a6fd4, chrome: 0xcfd6dd, steel: 0x8a93a0,
  dark: 0x555c66, gold: 0xd4a94a, silver: 0xc4cad2, glass: 0x7fa8c8, rubber: 0x666e78,
  glow: 0x7fd4ff, light: 0xffd27f,
};

// ---------- 几何基元 ----------
function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = m.receiveShadow = true;
  return m;
}
// 车轮：轮胎+轮毂+螺栓+轴盖
function buildWheel(mats) {
  const g = new THREE.Group();
  g.add(cyl(0.55, 0.55, 0.34, mats.rubber, 0, 0, 0, 0, 0, Math.PI / 2, 28));
  g.add(cyl(0.34, 0.34, 0.37, mats.chrome, 0, 0, 0, 0, 0, Math.PI / 2, 24));
  g.add(cyl(0.09, 0.09, 0.44, mats.silver, 0, 0, 0, 0, 0, Math.PI / 2, 16));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.add(cyl(0.022, 0.022, 0.40, mats.steel, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0, 0, 0, Math.PI / 2, 8));
  }
  return g;
}

// ---------- 模型构建 ----------
const ASM = []; // {id, system, explode:[dx,dy,dz]}
function asm(id, parent, system, explode = [0, 0, 0]) {
  const g = new THREE.Group();
  g.name = id;
  parent.add(g);
  ASM.push({ id, system, explode });
  return g;
}

export function buildModel() {
  ASM.length = 0;
  const mats = makeMaterials();
  const root = new THREE.Group();
  root.name = 'scene';
  const parts = [];
  const track = (m) => { m.userData.system = ''; parts.push(m); return m; };
  const P = (...a) => track(box(...a));
  const C = (...a) => track(cyl(...a));
  const mark = (sys) => (m) => { m.userData.system = sys; return m; };

  // ===== 车架 → 人形层叠脊柱（spec §3）=====
  const mSteel = mark('steel'), mDark = mark('dark');
  const frameHood = asm('frame_hood', root, 'steel', [0, 0.5, 0]);
  frameHood.add(P(1.30, 0.20, 2.15, mats.steel));
  frameHood.add(mSteel(P(0.9, 0.14, 0.3, mats.dark, 0, 0.16, 0.7)));
  frameHood.add(mSteel(P(0.9, 0.14, 0.3, mats.dark, 0, -0.16, -0.7)));
  const frameCab = asm('frame_cab', root, 'steel', [0, 0.3, -0.4]);
  frameCab.add(P(1.30, 0.20, 2.10, mats.steel));
  frameCab.add(mDark(P(1.0, 0.26, 0.4, mats.dark, 0, 0, 0.5)));
  const frameRear = asm('frame_rear', root, 'steel', [0, -0.3, -0.8]);
  frameRear.add(P(1.30, 0.20, 2.80, mats.steel));
  frameRear.add(mDark(P(1.0, 0.24, 0.35, mats.dark, 0, 0, 1.0)));
  const crossbar = asm('crossbar', root, 'dark', [0, -0.6, -1.0]);
  crossbar.add(P(1.6, 0.16, 0.30, mats.dark));

  // ===== 车轮 ×6（全程同 6 轮，identity 保留）=====
  for (const [id, x, z] of [['wheel_fl', -1.02, 2.55], ['wheel_fr', 1.02, 2.55], ['wheel_rl', -0.98, -1.55], ['wheel_rr', 0.98, -1.55], ['wheel_rl2', -0.98, -2.95], ['wheel_rr2', 0.98, -2.95]]) {
    const w = asm(id, root, 'rubber', [x > 0 ? 0.9 : -0.9, 0, 0]);
    const g = buildWheel(mats);
    g.traverse((m) => { if (m.isMesh) { m.userData.system = 'rubber'; parts.push(m); } });
    w.add(g);
  }

  // ===== 侧油箱 → 胫前圆筒 =====
  for (const s of [-1, 1]) {
    const t = asm(s < 0 ? 'tank_l' : 'tank_r', root, 'chrome', [s * 0.7, -0.2, 0.6]);
    t.add(P(0.72, 0.72, 1.35, mats.chrome, 0, 0, 0, Math.PI / 2, 0, 0));
    t.add(P(0.66, 0.66, 0.08, mats.steel, 0, 0, 0.68, Math.PI / 2, 0, 0));
    t.add(P(0.66, 0.66, 0.08, mats.steel, 0, 0, -0.68, Math.PI / 2, 0, 0));
    for (const zz of [-0.42, 0.05, 0.42]) t.add(P(0.05, 0.80, 0.10, mats.steel, 0, 0, zz));
    t.add(P(0.10, 0.10, 0.5, mats.chrome, 0, -0.42, -0.3));
  }

  // ===== 窄引擎盖（长头车引擎盖在翼子板之间）+ 隐藏式胸甲板 =====
  const hoodTop = asm('hood_top', root, 'paint-red', [0, 0, 0.8]);
  hoodTop.add(P(1.30, 0.10, 2.55, mats.paintRedTop));
  hoodTop.add(P(1.34, 0.05, 0.14, mats.chrome, 0, 0.06, 1.24));
  const hoodRear = asm('hood_rear', root, 'paint-red', [0, -0.3, 0.9]);
  hoodRear.add(P(1.30, 0.80, 1.20, mats.paintRed));
  hoodRear.add(P(1.34, 0.10, 1.24, mats.chrome, 0, -0.43, 0));
  const hoodFront = asm('hood_front', root, 'paint-red', [0, 0.4, 1.2]);
  hoodFront.add(P(1.30, 0.80, 0.75, mats.paintRed));
  hoodFront.add(P(1.34, 0.16, 0.79, mats.paintBluePlain, 0, 0.30, 0));
  // 胸甲板：车态平藏于驾驶室/卧铺体内，人形成为 2.2m 宽躯干前面板
  const chestPlate = asm('chest_plate', root, 'paint-red', [0, 0, 1.5]);
  chestPlate.add(P(2.20, 2.55, 0.10, mats.paintRed));
  chestPlate.add(P(2.24, 0.10, 0.14, mats.chrome, 0, 1.20, 0));
  chestPlate.add(P(2.24, 0.10, 0.14, mats.chrome, 0, -1.20, 0));

  // 格栅 → 胸内衬板（018s 胸腔开启证据）
  const grille = asm('grille', root, 'chrome', [0, 0, 1.6]);
  grille.add(P(1.16, 1.10, 0.10, mats.chrome));
  for (let i = 0; i < 13; i++) grille.add(P(0.045, 1.00, 0.05, mats.steel, -0.52 + i * 0.0867, 0, 0.06));
  grille.add(P(1.24, 0.10, 0.16, mats.chrome, 0, 0.56, 0.02));
  grille.add(P(1.24, 0.10, 0.16, mats.chrome, 0, -0.56, 0.02));
  grille.add(P(0.34, 0.20, 0.06, mats.silver, 0, 0.30, 0.10));

  // 保险杠 → 骨盆前护甲（designed）
  const bumper = asm('bumper', root, 'chrome', [0, -0.3, 1.8]);
  bumper.add(P(2.44, 0.42, 0.30, mats.chrome));
  for (let i = 0; i < 10; i++) bumper.add(P(0.05, 0.05, 0.05, mats.markerBlue, -0.99 + i * 0.22, -0.10, -0.16));
  bumper.add(P(0.5, 0.20, 0.04, mats.steel, 0, 0.02, -0.17));

  // 前灯 → 领口灯
  for (const s of [-1, 1]) {
    const hl = asm(s < 0 ? 'headlight_l' : 'headlight_r', root, 'light', [s * 0.5, 0.4, 1.2]);
    hl.add(P(0.34, 0.22, 0.12, mats.chrome));
    hl.add(P(0.28, 0.15, 0.06, mats.glass, 0, 0, 0.06));
    hl.add(P(0.38, 0.26, 0.08, mats.steel, 0, 0, -0.08));
  }

  // 前翼子板 → 全臂外侧红甲（029s 红前臂；来源身份 inferred）
  for (const s of [-1, 1]) {
    const f = asm(s < 0 ? 'fender_l' : 'fender_r', root, 'paint-red', [s * 1.3, 0, 0]);
    f.add(P(0.62, 0.95, 1.70, mats.paintRed));
    f.add(P(0.66, 0.12, 1.74, mats.paintRedPlain, 0, 0.50, 0));
    f.add(P(0.50, 0.34, 0.6, mats.dark, 0, -0.42, 0.25));
    f.add(P(0.56, 0.14, 1.2, mats.steel, 0, -0.52, 0));
  }

  // ===== 驾驶室 → 胸体（029s）=====
  const cab = asm('cab', root, 'paint-red', [0, 0, 1.1]);
  cab.add(P(2.30, 1.10, 1.10, mats.paintRed));
  cab.add(P(2.32, 0.16, 1.12, mats.paintBluePlain, 0, -0.60, 0));
  cab.add(P(0.06, 0.58, 0.52, mats.glass, -1.16, 0.05, 0.02));
  cab.add(P(0.06, 0.58, 0.52, mats.glass, 1.16, 0.05, 0.02));
  cab.add(P(0.06, 0.75, 0.08, mats.chrome, -1.13, 0.05, 0.35));
  cab.add(P(0.06, 0.75, 0.08, mats.chrome, 1.13, 0.05, 0.35));
  cab.add(P(0.5, 0.06, 0.06, mats.chrome, -0.72, -0.28, 0.58));
  cab.add(P(0.5, 0.06, 0.06, mats.chrome, 0.72, -0.28, 0.58));

  // 挡风玻璃 ×2 → 开书胸窗（018s/029s observed）
  for (const s of [-1, 1]) {
    const w = asm(s < 0 ? 'windshield_l' : 'windshield_r', cab, 'glass', [s * 0.8, 0.2, 0.9]);
    w.add(P(1.12, 0.78, 0.05, mats.glass));
    w.add(P(1.20, 0.08, 0.09, mats.paintRedPlain, 0, 0.425, 0));
    w.add(P(1.20, 0.08, 0.09, mats.paintRedPlain, 0, -0.425, 0));
    w.add(P(0.08, 0.85, 0.09, mats.paintRedPlain, s < 0 ? -0.565 : 0.565, 0, 0));
    w.add(P(0.08, 0.85, 0.09, mats.paintRedPlain, s < 0 ? 0.565 : -0.565, 0, 0));
  }

  // 胸腔内构（018s：暗衬板/红缆/弹簧执行器）——两端藏于体内
  const guts = asm('chest_guts', root, 'dark', [0, 0, 1.5]);
  guts.add(P(0.92, 0.72, 0.60, mats.dark));
  guts.add(P(0.86, 0.18, 0.10, mats.steel, 0, 0.10, 0.32));
  guts.add(P(0.10, 0.10, 0.55, mats.paintRedPlain, -0.30, -0.18, 0.05));
  guts.add(P(0.10, 0.10, 0.55, mats.paintRedPlain, 0.30, -0.18, 0.05));
  guts.add(P(0.07, 0.5, 0.07, mats.gold, -0.18, 0, 0.28));
  guts.add(P(0.07, 0.5, 0.07, mats.gold, 0.18, 0, 0.28));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++)
    guts.add(P(0.13 - i * 0.02, 0.045, 0.045, mats.silver, s * 0.36, 0.05, 0.10 + i * 0.07, Math.PI / 2, 0, 0));

  // 驾驶室顶 → 上背板
  const cabRoof = asm('cab_roof', root, 'paint-red', [0, 0.4, -1.0]);
  cabRoof.add(P(2.30, 0.08, 1.10, mats.paintRed));
  for (let i = 0; i < 5; i++) cabRoof.add(P(0.056, 0.056, 0.05, mats.markerAmber, -0.6 + i * 0.3, 0.06, 0.5));
  // 遮阳罩 → 额甲（designed）
  const visor = asm('sun_visor', root, 'chrome', [0, 0.5, 0.8]);
  visor.add(P(2.20, 0.06, 0.44, mats.chrome, 0, 0, 0, 0.18, 0, 0));
  // 后视镜 → 肩上天线
  for (const s of [-1, 1]) {
    const m = asm(s < 0 ? 'mirror_l' : 'mirror_r', root, 'chrome', [s * 0.6, 0.5, 0]);
    m.add(P(0.03, 0.24, 0.03, mats.chrome, 0, 0.12, 0));
    m.add(P(0.05, 0.20, 0.16, mats.chrome, 0, 0.32, 0.02));
    m.add(P(0.02, 0.15, 0.11, mats.glass, 0, 0.32, 0.11));
  }

  // ===== 卧铺 → 腿外侧板 / 背包 / 后腰 / 髋侧 =====
  for (const s of [-1, 1]) {
    const sp = asm(s < 0 ? 'sleeper_side_l' : 'sleeper_side_r', root, 'paint-blue', [s * 0.9, 0, 0]);
    sp.add(P(0.06, 1.00, 2.00, mats.paintBlue));
    sp.add(P(0.08, 0.16, 2.02, mats.chrome, 0, 0.56, 0));
    sp.add(P(0.08, 0.12, 0.5, mats.glass, 0, 0.18, -0.55));
  }
  const sleeperRoof = asm('sleeper_roof', root, 'paint-blue', [0, 0.5, -1.3]);
  sleeperRoof.add(P(2.30, 0.06, 2.00, mats.paintBlue));
  sleeperRoof.add(P(2.34, 0.10, 0.16, mats.chrome, 0, 0.05, 0.95));
  const sleeperRear = asm('sleeper_rear', root, 'paint-blue', [0, -0.2, -1.5]);
  sleeperRear.add(P(2.30, 1.00, 0.06, mats.paintBlue));
  sleeperRear.add(P(1.4, 0.30, 0.10, mats.dark, 0, -0.15, -0.04));
  for (const s of [-1, 1]) {
    const f = asm(s < 0 ? 'fairing_l' : 'fairing_r', root, 'paint-blue', [s * 0.5, -0.3, 0.3]);
    f.add(P(0.10, 0.85, 0.75, mats.paintBlue));
  }

  // ===== 烟囱 ×2（029s/048s/088s：头侧后方）=====
  for (const s of [-1, 1]) {
    const st = asm(s < 0 ? 'stack_l' : 'stack_r', root, 'chrome', [s * 0.6, 0.6, -0.5]);
    st.add(C(0.11, 0.11, 2.15, mats.chrome, 0, 0, 0, 0, 0, 0, 20));
    for (let i = 0; i < 3; i++) st.add(C(0.125, 0.125, 0.06, mats.steel, 0, -0.6 + i * 0.55, 0, 0, 0, 0, 20));
    st.add(C(0.13, 0.10, 0.16, mats.chrome, 0, 1.12, 0, 0, 0, 0, 20));
  }

  // ===== 挡泥板/工具箱/尾梁 =====
  for (const s of [-1, 1]) {
    const mf = asm(s < 0 ? 'mudflap_l' : 'mudflap_r', root, 'rubber', [s * 0.4, -0.4, -0.6]);
    mf.add(P(0.42, 0.55, 0.05, mats.rubber));
    mf.add(P(0.44, 0.08, 0.08, mats.steel, 0, 0.30, 0));
    const tb = asm(s < 0 ? 'toolbox_l' : 'toolbox_r', root, 'steel', [s * 0.6, -0.2, 0]);
    tb.add(P(0.42, 0.34, 0.90, mats.steel));
    tb.add(P(0.44, 0.05, 0.92, mats.dark, 0, 0.18, 0));
  }
  const rearcross = asm('rear_cross', root, 'dark', [0, -0.5, -0.8]);
  rearcross.add(P(1.6, 0.18, 0.28, mats.dark));

  // ===== 人形专属结构（车态藏于车底/体内）=====
  const pelvis = asm('pelvis', root, 'dark', [0, -0.6, 0.4]);
  pelvis.add(P(0.95, 0.55, 0.60, mats.dark));
  pelvis.add(P(0.70, 0.30, 0.16, mats.steel, 0, 0.10, 0.30));
  const waist = asm('waist', root, 'steel', [0, 0.3, 0.3]);
  waist.add(C(0.28, 0.32, 0.42, mats.steel, 0, 0, 0, 0, 0, 0, 18));
  waist.add(P(0.62, 0.10, 0.50, mats.dark, 0, 0.12, 0));
  // 腹节（048s 金铜竖条 + 层叠甲）
  const abdomen = asm('abdomen', root, 'gold', [0, 0, 1.0]);
  abdomen.add(P(0.75, 0.60, 0.55, mats.dark));
  for (let i = 0; i < 6; i++) abdomen.add(P(0.09, 0.56, 0.07, mats.gold, -0.30 + i * 0.12, 0.04, 0.30));
  for (let i = 0; i < 3; i++) abdomen.add(P(0.80 - i * 0.10, 0.11, 0.45, mats.steel, 0, -0.20 - i * 0.13, 0.10 - i * 0.03));
  // 锁骨 + 徽记
  const collar = asm('collar', root, 'steel', [0, 0.4, 0.5]);
  collar.add(P(0.92, 0.24, 0.55, mats.steel));
  collar.add(C(0.09, 0.09, 0.5, mats.dark, -0.38, 0, 0.1, 0, 0, Math.PI / 2, 12));
  collar.add(C(0.09, 0.09, 0.5, mats.dark, 0.38, 0, 0.1, 0, 0, Math.PI / 2, 12));
  const emblem = asm('emblem', root, 'silver', [0, 0, 1.7]);
  emblem.add(P(0.30, 0.26, 0.04, mats.dark));
  emblem.add(P(0.26, 0.22, 0.045, mats.emblem, 0, 0, 0.01));
  // 肩甲 ×2（080s：大曲面蓝甲+嵌轮毂）
  for (const s of [-1, 1]) {
    const pa = asm(s < 0 ? 'pauldron_l' : 'pauldron_r', root, 'paint-blue', [s * 1.1, 0.5, 0]);
    pa.add(P(0.80, 0.85, 0.95, mats.paintBlue, 0, 0, 0, 0, 0, s * 0.10));
    pa.add(P(0.84, 0.14, 0.99, mats.steel, 0, -0.44, 0, 0, 0, s * 0.10));
    pa.add(C(0.34, 0.34, 0.20, mats.chrome, s * 0.36, 0.08, 0, 0, 0, Math.PI / 2, 24));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      pa.add(C(0.024, 0.024, 0.26, mats.steel, s * 0.42, 0.08 + Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0, 0, Math.PI / 2, 8));
    }
  }
  // 上臂/肘/腕/手
  for (const s of [-1, 1]) {
    const ua = asm(s < 0 ? 'upperarm_l' : 'upperarm_r', root, 'steel', [s * 0.6, 0.2, 0]);
    ua.add(C(0.09, 0.09, 0.55, mats.silver, 0, 0, 0, 0, 0, 0, 14));
    ua.add(C(0.045, 0.045, 0.42, mats.chrome, s * 0.10, -0.05, 0.08, 0.2, 0, 0, 10));
    ua.add(C(0.045, 0.045, 0.38, mats.chrome, s * 0.16, -0.10, -0.05, 0.25, 0, 0, 10));
    const el = asm(s < 0 ? 'elbow_l' : 'elbow_r', root, 'dark', [s * 0.5, -0.2, 0.3]);
    el.add(C(0.16, 0.16, 0.30, mats.dark, 0, 0, 0, 0, 0, Math.PI / 2, 18));
    el.add(C(0.07, 0.07, 0.34, mats.chrome, 0, 0.12, 0, 0, 0, Math.PI / 2, 12));
    const wr = asm(s < 0 ? 'wrist_l' : 'wrist_r', root, 'steel', [s * 0.5, -0.2, 0.2]);
    wr.add(C(0.11, 0.11, 0.16, mats.steel, 0, 0, 0, 0, 0, Math.PI / 2, 14));
    const h = asm(s < 0 ? 'hand_l' : 'hand_r', root, 'silver', [s * 0.9, -0.5, 0.3]);
    h.add(P(0.20, 0.24, 0.11, mats.silver));
    h.add(P(0.19, 0.06, 0.13, mats.dark, 0, 0.15, 0));
    for (let i = 0; i < 4; i++) {
      h.add(P(0.042, 0.13, 0.05, mats.silver, -0.07 + i * 0.047, -0.20, 0.01, 0.5, 0, 0));
      h.add(P(0.038, 0.09, 0.045, mats.dark, -0.07 + i * 0.047, -0.29, 0.045, 0.8, 0, 0));
    }
    h.add(P(0.05, 0.11, 0.05, mats.silver, s * 0.12, -0.06, 0.03, 0, 0, s * 0.5));
  }
  // 大腿/膝/小腿/踝/足
  for (const s of [-1, 1]) {
    const th = asm(s < 0 ? 'thigh_l' : 'thigh_r', root, 'paint-blue', [s * 0.6, 0, 0.2]);
    th.add(P(0.50, 0.95, 0.62, mats.paintBlue));
    th.add(P(0.52, 0.16, 0.64, mats.steel, 0, 0.42, 0));
    th.add(P(0.30, 0.5, 0.10, mats.dark, 0, -0.05, 0.30));
    const kn = asm(s < 0 ? 'knee_l' : 'knee_r', root, 'silver', [s * 0.5, -0.3, 0.4]);
    kn.add(C(0.19, 0.19, 0.34, mats.silver, 0, 0, 0, 0, 0, Math.PI / 2, 18));
    kn.add(P(0.34, 0.22, 0.16, mats.steel, 0, -0.14, 0.14));
    const sh = asm(s < 0 ? 'shin_l' : 'shin_r', root, 'paint-blue', [s * 0.7, -0.2, 0.2]);
    sh.add(P(0.46, 0.88, 0.55, mats.paintBlue));
    sh.add(P(0.34, 0.60, 0.10, mats.silver, 0, 0.02, 0.26));
    sh.add(P(0.40, 0.12, 0.50, mats.dark, 0, 0.46, 0));
    const an = asm(s < 0 ? 'ankle_l' : 'ankle_r', root, 'steel', [s * 0.4, -0.3, 0]);
    an.add(C(0.13, 0.13, 0.24, mats.steel, 0, 0, 0, 0, 0, Math.PI / 2, 14));
    const ft = asm(s < 0 ? 'foot_l' : 'foot_r', root, 'dark', [s * 0.7, -0.5, 0.6]);
    ft.add(P(0.54, 0.18, 0.64, mats.dark, 0, 0, 0.05));
    ft.add(P(0.48, 0.10, 0.20, mats.silver, 0, 0.03, 0.30));
    ft.add(P(0.50, 0.24, 0.16, mats.steel, 0, 0.12, -0.24));
    const bp = asm(s < 0 ? 'backpiston_l' : 'backpiston_r', root, 'chrome', [s * 0.4, 0.3, -0.7]);
    bp.add(C(0.05, 0.05, 0.7, mats.chrome, 0, 0, 0, 0.35, 0, 0, 10));
    bp.add(C(0.075, 0.075, 0.3, mats.steel, 0, -0.26, -0.09, 0.35, 0, 0, 10));
  }

  // ===== 头雕（029s/088s observed）=====
  const head = asm('head', root, 'paint-blue', [0, 0.7, 0.5]);
  head.add(P(0.46, 0.34, 0.40, mats.paintBluePlain, 0, 0.08, -0.02));
  head.add(C(0.22, 0.26, 0.10, mats.paintBluePlain, 0, 0.27, -0.04, 0, 0, 0, 20));
  head.add(P(0.06, 0.30, 0.30, mats.paintBluePlain, 0, 0.36, -0.10, -0.25, 0, 0));
  head.add(P(0.16, 0.20, 0.30, mats.paintBluePlain, -0.21, 0.10, -0.08, 0, -0.35, 0));
  head.add(P(0.16, 0.20, 0.30, mats.paintBluePlain, 0.21, 0.10, -0.08, 0, 0.35, 0));
  head.add(C(0.09, 0.09, 0.05, mats.chrome, -0.245, 0.05, 0.02, 0, Math.PI / 2, 0, 18));
  head.add(C(0.09, 0.09, 0.05, mats.chrome, 0.245, 0.05, 0.02, 0, Math.PI / 2, 0, 18));
  head.add(C(0.045, 0.045, 0.03, mats.steel, -0.27, 0.05, 0.02, 0, Math.PI / 2, 0, 12));
  head.add(C(0.045, 0.045, 0.03, mats.steel, 0.27, 0.05, 0.02, 0, Math.PI / 2, 0, 12));
  head.add(P(0.30, 0.20, 0.12, mats.silver, 0, -0.09, 0.13));
  head.add(P(0.30, 0.06, 0.10, mats.dark, 0, -0.20, 0.10));
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++)
    head.add(P(0.016, 0.14, 0.03, mats.dark, s * (0.075 + i * 0.026), -0.09, 0.185));
  head.add(P(0.26, 0.055, 0.05, mats.glow, 0, 0.045, 0.17));
  head.add(P(0.34, 0.05, 0.20, mats.paintBluePlain, 0, 0.115, 0.10));
  head.add(P(0.30, 0.10, 0.16, mats.steel, 0, -0.02, 0.02));
  const neck = asm('neck', root, 'steel', [0, 0.3, 0.2]);
  neck.add(C(0.09, 0.11, 0.22, mats.steel, 0, 0, 0, 0, 0, 0, 14));
  neck.add(C(0.045, 0.045, 0.20, mats.chrome, 0.10, 0.02, -0.06, 0.3, 0, 0, 8));

  // ---------- 注册表校验 ----------
  const registry = ASM.map((a) => ({ ...a }));
  const ids = registry.map((a) => a.id);
  const uniq = new Set(ids);
  if (uniq.size !== ids.length) throw new Error('装配 ID 重复');
  const ports = {
    head: 'head', torso: 'cab', left_hand: 'hand_l', right_hand: 'hand_r',
    left_foot: 'foot_l', right_foot: 'foot_r',
  };
  for (const p of Object.values(ports)) if (!uniq.has(p)) throw new Error(`端口缺失: ${p}`);
  const tireCount = ids.filter((i) => i.startsWith('wheel_')).length;
  if (tireCount !== 6) throw new Error(`车轮数应为 6，实际 ${tireCount}`);
  const partCount = parts.length;
  if (partCount < 120) throw new Error(`视觉分件过少: ${partCount}`);
  setExplodeDirs(registry); // 拆解方向表随构建注入

  return { root, registry, ports, mats, partCount };
}

// ---------- 确定性动画表 ----------
// 每装配：p/r 通道关键帧 [t,[x,y,z]]。t=0 卡车、t=1 人形（相位表见 spec §3）。
const V = (x, y, z) => [x, y, z];

export const TRACKS = {
  frame_hood: { p: [[0, V(0, 0.78, 2.475)], [0.30, V(0, 1.5, 2.2)], [0.48, V(0, 2.4, 0.6)], [1, V(0, 2.62, -0.15)]], r: [[0, V(0, 0, 0)], [0.48, V(0, 0, 0)], [1, V(rad(90), 0, 0)]] },
  frame_cab: { p: [[0, V(0, 0.78, 0.35)], [0.28, V(0, 1.2, 0.3)], [1, V(0, 1.35, -0.55)]], r: [[0, V(0, 0, 0)], [0.34, V(0, 0, 0)], [1, V(rad(90), 0, 0)]] },
  frame_rear: { p: [[0, V(0, 0.78, -2.10)], [0.16, V(0, 0.9, -2.1)], [0.34, V(0, 1.1, -1.4)], [1, V(0, 1.42, -0.95)]], r: [[0, V(0, 0, 0)], [0.34, V(0, 0, 0)], [1, V(rad(90), 0, 0)]] },
  crossbar: { p: [[0, V(0, 0.60, -3.60)], [0.2, V(0, 0.7, -3.2)], [1, V(0, 0.42, -0.55)]], r: [] },

  wheel_fl: { p: [[0, V(-1.02, 0.55, 2.55)], [0.18, V(-0.9, 0.55, 2.4)], [0.30, V(-0.62, 0.55, 0.6)], [1, V(-0.62, 0.55, -0.28)]], r: [] },
  wheel_fr: { p: [[0, V(1.02, 0.55, 2.55)], [0.18, V(0.9, 0.55, 2.4)], [0.30, V(0.62, 0.55, 0.6)], [1, V(0.62, 0.55, -0.28)]], r: [] },
  wheel_rl: { p: [[0, V(-0.98, 0.55, -1.55)], [0.22, V(-0.8, 0.55, -1.2)], [0.40, V(-0.7, 1.0, 0)], [1, V(-0.70, 1.62, 0.05)]], r: [] },
  wheel_rr: { p: [[0, V(0.98, 0.55, -1.55)], [0.22, V(0.8, 0.55, -1.2)], [0.40, V(0.7, 1.0, 0)], [1, V(0.70, 1.62, 0.05)]], r: [] },
  wheel_rl2: { p: [[0, V(-0.98, 0.55, -2.95)], [0.26, V(-0.85, 0.55, -2.4)], [0.44, V(-0.72, 0.9, -0.3)], [1, V(-0.70, 0.92, 0.02)]], r: [] },
  wheel_rr2: { p: [[0, V(0.98, 0.55, -2.95)], [0.26, V(0.85, 0.55, -2.4)], [0.44, V(0.72, 0.9, -0.3)], [1, V(0.70, 0.92, 0.02)]], r: [] },

  tank_l: { p: [[0, V(-0.92, 0.78, -0.88)], [0.34, V(-0.9, 0.9, -0.4)], [0.52, V(-0.6, 1.1, 0.3)], [1, V(-0.42, 1.15, 0.42)]], r: [[0, V(0, 0, 0)], [0.52, V(0, 0, 0)], [1, V(0, 0, rad(90))]] },
  tank_r: { p: [[0, V(0.92, 0.78, -0.88)], [0.34, V(0.9, 0.9, -0.4)], [0.52, V(0.6, 1.1, 0.3)], [1, V(0.42, 1.15, 0.42)]], r: [[0, V(0, 0, 0)], [0.52, V(0, 0, 0)], [1, V(0, 0, rad(90))]] },

  hood_top: { p: [[0, V(0, 1.97, 2.00)], [0.42, V(0, 2.1, 1.7)], [0.60, V(0, 2.6, 0.4)], [1, V(0, 3.30, -0.35)]], r: [[0, V(0, 0, 0)], [0.60, V(0, 0, 0)], [1, V(rad(90), 0, 0)]] },
  chest_plate: { p: [[0, V(0, 2.20, -1.00)], [0.40, V(0, 2.5, -0.5)], [0.58, V(0, 3.0, 0.2)], [1, V(0, 3.35, 0.44)]], r: [[0, V(rad(90), 0, 0)], [0.58, V(rad(90), 0, 0)], [1, V(0, 0, 0)]] },
  hood_rear: { p: [[0, V(0, 1.60, 2.00)], [0.40, V(0, 1.7, 1.6)], [0.62, V(0, 1.85, 0.6)], [1, V(0, 1.82, 0.16)]], r: [[0, V(0, 0, 0)], [0.62, V(0, 0, 0)], [1, V(rad(-14), 0, 0)]] },
  hood_front: { p: [[0, V(0, 1.60, 2.92)], [0.44, V(0, 2.3, 2.2)], [0.66, V(0, 3.4, 0.2)], [1, V(0, 3.85, -0.30)]], r: [[0, V(0, 0, 0)], [0.66, V(0, 0, 0)], [1, V(rad(90), 0, 0)]] },
  grille: { p: [[0, V(0, 1.46, 3.34)], [0.46, V(0, 2.0, 2.6)], [0.62, V(0, 2.9, 1.0)], [1, V(0, 3.32, 0.05)]], r: [] },
  bumper: { p: [[0, V(0, 0.62, 3.72)], [0.30, V(0, 0.8, 3.0)], [0.52, V(0, 1.5, 1.0)], [1, V(0, 1.95, 0.42)]], r: [[0, V(0, 0, 0)], [0.52, V(0, 0, 0)], [1, V(rad(-12), 0, 0)]] },
  headlight_l: { p: [[0, V(-0.72, 1.62, 3.30)], [0.5, V(-0.6, 2.4, 1.6)], [1, V(-0.30, 3.86, 0.40)]], r: [] },
  headlight_r: { p: [[0, V(0.72, 1.62, 3.30)], [0.5, V(0.6, 2.4, 1.6)], [1, V(0.30, 3.86, 0.40)]], r: [] },

  fender_l: { p: [[0, V(-1.00, 1.42, 2.55)], [0.36, V(-1.15, 1.5, 2.0)], [0.56, V(-1.25, 2.4, 0.6)], [0.74, V(-1.26, 2.95, 0.1)], [1, V(-1.22, 3.05, 0.02)]], r: [[0, V(0, 0, 0)], [0.74, V(0, 0, 0)], [1, V(rad(90), 0, rad(-6))]] },
  fender_r: { p: [[0, V(1.00, 1.42, 2.55)], [0.36, V(1.15, 1.5, 2.0)], [0.56, V(1.25, 2.4, 0.6)], [0.74, V(1.26, 2.95, 0.1)], [1, V(1.22, 3.05, 0.02)]], r: [[0, V(0, 0, 0)], [0.74, V(0, 0, 0)], [1, V(rad(90), 0, rad(6))]] },

  cab: { p: [[0, V(0, 2.38, 0)], [0.24, V(0, 2.6, -0.2)], [0.44, V(0, 3.1, -0.2)], [1, V(0, 3.45, 0.10)]], r: [[0, V(0, 0, 0)], [0.24, V(0, 0, 0)], [0.40, V(rad(-16), 0, 0)], [0.52, V(0, 0, 0)], [1, V(0, 0, 0)]] },
  windshield_l: { p: [[0, V(-0.39, 0.34, 0.56)], [0.40, V(-0.45, 0.38, 0.60)], [0.58, V(-0.50, 0.26, 0.64)], [1, V(-0.57, 0.17, 0.55)]], r: [[0, V(rad(-12), 0, 0)], [0.58, V(rad(-12), 0, 0)], [1, V(rad(-8), rad(38), 0)]] },
  windshield_r: { p: [[0, V(0.39, 0.34, 0.56)], [0.40, V(0.45, 0.38, 0.60)], [0.58, V(0.50, 0.26, 0.64)], [1, V(0.57, 0.17, 0.55)]], r: [[0, V(rad(-12), 0, 0)], [0.58, V(rad(-12), 0, 0)], [1, V(rad(-8), rad(-38), 0)]] },
  chest_guts: { p: [[0, V(0, 2.30, 0)], [0.30, V(0, 2.4, 0)], [0.52, V(0, 2.9, 0.1)], [1, V(0, 3.30, 0.02)]], r: [] },
  cab_roof: { p: [[0, V(0, 2.97, 0)], [0.36, V(0, 3.3, -0.3)], [0.56, V(0, 3.6, -0.8)], [1, V(0, 3.45, -0.52)]], r: [[0, V(0, 0, 0)], [0.56, V(0, 0, 0)], [1, V(rad(-90), 0, 0)]] },
  sun_visor: { p: [[0, V(0, 2.99, 0.50)], [0.5, V(0, 3.4, 0.3)], [0.72, V(0, 3.9, 0.36)], [1, V(0, 4.10, 0.38)]], r: [[0, V(0.18, 0, 0)], [1, V(-0.12, 0, 0)]] },
  mirror_l: { p: [[0, V(-1.18, 2.75, 0.35)], [0.6, V(-1.4, 3.2, 0.1)], [1, V(-1.15, 4.12, -0.05)]], r: [] },
  mirror_r: { p: [[0, V(1.18, 2.75, 0.35)], [0.6, V(1.4, 3.2, 0.1)], [1, V(1.15, 4.12, -0.05)]], r: [] },

  sleeper_side_l: { p: [[0, V(-1.15, 2.45, -1.55)], [0.12, V(-1.2, 2.2, -1.4)], [0.30, V(-0.85, 1.6, -0.8)], [1, V(-0.70, 1.55, 0)]], r: [[0, V(0, 0, 0)], [0.30, V(0, 0, 0)], [1, V(rad(90), 0, 0)]] },
  sleeper_side_r: { p: [[0, V(1.15, 2.45, -1.55)], [0.12, V(1.2, 2.2, -1.4)], [0.30, V(0.85, 1.6, -0.8)], [1, V(0.70, 1.55, 0)]], r: [[0, V(0, 0, 0)], [0.30, V(0, 0, 0)], [1, V(rad(90), 0, 0)]] },
  sleeper_roof: { p: [[0, V(0, 2.97, -1.55)], [0.40, V(0, 3.3, -1.3)], [0.60, V(0, 3.5, -0.9)], [1, V(0, 3.35, -0.72)]], r: [[0, V(0, 0, 0)], [0.60, V(0, 0, 0)], [1, V(rad(-90), 0, 0)]] },
  sleeper_rear: { p: [[0, V(0, 2.45, -2.57)], [0.36, V(0, 2.5, -2.2)], [0.58, V(0, 2.5, -1.3)], [1, V(0, 2.45, -0.60)]], r: [[0, V(0, 0, 0)], [0.58, V(0, 0, 0)], [1, V(rad(-90), 0, 0)]] },
  fairing_l: { p: [[0, V(-1.11, 2.02, -0.30)], [0.3, V(-1.05, 1.9, -0.1)], [1, V(-0.66, 2.18, 0.02)]], r: [] },
  fairing_r: { p: [[0, V(1.11, 2.02, -0.30)], [0.3, V(1.05, 1.9, -0.1)], [1, V(0.66, 2.18, 0.02)]], r: [] },

  stack_l: { p: [[0, V(-0.82, 2.27, -0.62)], [0.60, V(-0.95, 2.9, -0.8)], [0.78, V(-0.62, 3.8, -0.5)], [1, V(-0.44, 4.02, -0.30)]], r: [] },
  stack_r: { p: [[0, V(0.82, 2.27, -0.62)], [0.60, V(0.95, 2.9, -0.8)], [0.78, V(0.62, 3.8, -0.5)], [1, V(0.44, 4.02, -0.30)]], r: [] },

  mudflap_l: { p: [[0, V(-0.75, 0.42, -3.45)], [0.24, V(-0.6, 0.4, -2.6)], [1, V(-0.44, 0.30, -0.42)]], r: [[0, V(0, 0, 0)], [1, V(rad(-90), 0, 0)]] },
  mudflap_r: { p: [[0, V(0.75, 0.42, -3.45)], [0.24, V(0.6, 0.4, -2.6)], [1, V(0.44, 0.30, -0.42)]], r: [[0, V(0, 0, 0)], [1, V(rad(-90), 0, 0)]] },
  toolbox_l: { p: [[0, V(-0.68, 0.95, -0.95)], [0.32, V(-0.75, 1.2, -0.6)], [1, V(-0.62, 2.15, 0)]], r: [] },
  toolbox_r: { p: [[0, V(0.68, 0.95, -0.95)], [0.32, V(0.75, 1.2, -0.6)], [1, V(0.62, 2.15, 0)]], r: [] },
  rear_cross: { p: [[0, V(0, 0.62, -3.62)], [0.22, V(0, 0.7, -3.0)], [1, V(0, 0.35, -0.30)]], r: [] },

  pelvis: { p: [[0, V(0, 1.05, 0.30)], [0.30, V(0, 1.3, 0.3)], [0.50, V(0, 1.7, 0.1)], [1, V(0, 2.05, -0.05)]], r: [] },
  waist: { p: [[0, V(0, 1.15, 0.35)], [0.5, V(0, 1.8, 0.2)], [1, V(0, 2.42, 0)]], r: [] },
  abdomen: { p: [[0, V(0, 1.45, 2.00)], [0.44, V(0, 1.9, 1.6)], [0.62, V(0, 2.4, 0.75)], [1, V(0, 2.72, 0.34)]], r: [] },
  collar: { p: [[0, V(0, 2.62, 0.05)], [0.55, V(0, 3.1, 0.1)], [1, V(0, 3.92, 0.10)]], r: [] },
  emblem: { p: [[0, V(0, 2.62, 0.35)], [0.56, V(0, 3.0, 0.6)], [0.66, V(0, 3.3, 0.68)], [1, V(0, 3.42, 0.60)]], r: [] },
  pauldron_l: { p: [[0, V(-0.66, 2.50, -1.30)], [0.30, V(-0.90, 2.70, -1.0)], [0.52, V(-1.05, 3.4, -0.3)], [0.68, V(-1.0, 3.74, 0)], [1, V(-0.95, 3.78, -0.05)]], r: [[0, V(0, 0, 0)], [0.52, V(0, 0, rad(-70))], [0.68, V(0, 0, rad(-10))], [1, V(0, 0, 0)]] },
  pauldron_r: { p: [[0, V(0.66, 2.50, -1.30)], [0.30, V(0.90, 2.70, -1.0)], [0.52, V(1.05, 3.4, -0.3)], [0.68, V(1.0, 3.74, 0)], [1, V(0.95, 3.78, -0.05)]], r: [[0, V(0, 0, 0)], [0.52, V(0, 0, rad(70))], [0.68, V(0, 0, rad(10))], [1, V(0, 0, 0)]] },
  upperarm_l: { p: [[0, V(-1.05, 2.30, 0.10)], [0.50, V(-1.15, 2.6, 0.1)], [0.68, V(-0.90, 3.1, 0)], [1, V(-0.80, 3.30, 0)]], r: [[0, V(0, 0, 0)], [1, V(0, 0, rad(14))]] },
  upperarm_r: { p: [[0, V(1.05, 2.30, 0.10)], [0.50, V(1.15, 2.6, 0.1)], [0.68, V(0.90, 3.1, 0)], [1, V(0.80, 3.30, 0)]], r: [[0, V(0, 0, 0)], [1, V(0, 0, rad(-14))]] },
  elbow_l: { p: [[0, V(-1.05, 1.95, 0.10)], [0.54, V(-1.2, 2.3, 0.1)], [0.72, V(-1.0, 2.8, 0)], [1, V(-0.92, 2.95, -0.02)]], r: [] },
  elbow_r: { p: [[0, V(1.05, 1.95, 0.10)], [0.54, V(1.2, 2.3, 0.1)], [0.72, V(1.0, 2.8, 0)], [1, V(0.92, 2.95, -0.02)]], r: [] },
  wrist_l: { p: [[0, V(-1.08, 1.72, 0.10)], [0.58, V(-1.2, 2.0, 0.1)], [0.76, V(-1.06, 2.5, 0)], [1, V(-1.12, 2.68, 0.05)]], r: [] },
  wrist_r: { p: [[0, V(1.08, 1.72, 0.10)], [0.58, V(1.2, 2.0, 0.1)], [0.76, V(1.06, 2.5, 0)], [1, V(1.12, 2.68, 0.05)]], r: [] },
  hand_l: { p: [[0, V(-1.10, 1.45, 0.10)], [0.60, V(-1.22, 1.8, 0.1)], [0.78, V(-1.10, 2.3, 0.03)], [1, V(-1.12, 2.40, 0.06)]], r: [[0, V(0, 0, 0)], [0.78, V(0, 0, rad(80))], [1, V(0, 0, rad(94))]] },
  hand_r: { p: [[0, V(1.10, 1.45, 0.10)], [0.60, V(1.22, 1.8, 0.1)], [0.78, V(1.10, 2.3, 0.03)], [1, V(1.12, 2.40, 0.06)]], r: [[0, V(0, 0, 0)], [0.78, V(0, 0, rad(-80))], [1, V(0, 0, rad(-94))]] },
  thigh_l: { p: [[0, V(-0.40, 0.95, -1.00)], [0.14, V(-0.42, 1.0, -0.9)], [0.32, V(-0.46, 1.5, -0.2)], [1, V(-0.52, 1.78, 0.02)]], r: [] },
  thigh_r: { p: [[0, V(0.40, 0.95, -1.00)], [0.14, V(0.42, 1.0, -0.9)], [0.32, V(0.46, 1.5, -0.2)], [1, V(0.52, 1.78, 0.02)]], r: [] },
  knee_l: { p: [[0, V(-0.40, 0.70, -1.00)], [0.18, V(-0.44, 0.9, -0.7)], [0.36, V(-0.46, 1.2, -0.1)], [1, V(-0.52, 1.30, 0.02)]], r: [] },
  knee_r: { p: [[0, V(0.40, 0.70, -1.00)], [0.18, V(0.44, 0.9, -0.7)], [0.36, V(0.46, 1.2, -0.1)], [1, V(0.52, 1.30, 0.02)]], r: [] },
  shin_l: { p: [[0, V(-0.40, 0.62, -2.20)], [0.20, V(-0.44, 0.7, -1.6)], [0.38, V(-0.46, 0.9, -0.4)], [1, V(-0.52, 0.98, 0)]], r: [] },
  shin_r: { p: [[0, V(0.40, 0.62, -2.20)], [0.20, V(0.44, 0.7, -1.6)], [0.38, V(0.46, 0.9, -0.4)], [1, V(0.52, 0.98, 0)]], r: [] },
  ankle_l: { p: [[0, V(-0.40, 0.35, -3.00)], [0.24, V(-0.44, 0.4, -2.2)], [0.42, V(-0.44, 0.45, -0.6)], [1, V(-0.52, 0.34, 0)]], r: [] },
  ankle_r: { p: [[0, V(0.40, 0.35, -3.00)], [0.24, V(0.44, 0.4, -2.2)], [0.42, V(0.44, 0.45, -0.6)], [1, V(0.52, 0.34, 0)]], r: [] },
  foot_l: { p: [[0, V(-0.40, 0.18, -3.05)], [0.26, V(-0.44, 0.22, -2.3)], [0.44, V(-0.45, 0.25, -0.7)], [1, V(-0.52, 0.08, 0.15)]], r: [] },
  foot_r: { p: [[0, V(0.40, 0.18, -3.05)], [0.26, V(0.44, 0.22, -2.3)], [0.44, V(0.45, 0.25, -0.7)], [1, V(0.52, 0.08, 0.15)]], r: [] },
  backpiston_l: { p: [[0, V(-0.55, 2.6, -0.7)], [0.5, V(-0.6, 3.0, -0.8)], [1, V(-0.40, 3.55, -0.62)]], r: [] },
  backpiston_r: { p: [[0, V(0.55, 2.6, -0.7)], [0.5, V(0.6, 3.0, -0.8)], [1, V(0.40, 3.55, -0.62)]], r: [] },

  head: { p: [[0, V(0, 2.55, 0.05)], [0.66, V(0, 2.6, 0.05)], [0.74, V(0, 3.5, 0.08)], [0.86, V(0, 4.85, 0.08)], [0.92, V(0, 4.83, 0.08)], [1, V(0, 4.85, 0.08)]], r: [[0, V(0, 0, 0)], [0.92, V(0, 0, 0)], [0.96, V(0, rad(10), 0)], [1, V(0, 0, 0)]] },
  neck: { p: [[0, V(0, 2.72, 0.05)], [0.7, V(0, 2.8, 0.05)], [0.86, V(0, 4.48, 0.05)], [1, V(0, 4.48, 0.05)]], r: [] },
};

// ---------- 状态计算（纯函数）----------
export function compileTracks(tracks = TRACKS) {
  const out = new Map();
  for (const [id, ch] of Object.entries(tracks)) {
    out.set(id, {
      p: [...ch.p].sort((a, b) => a[0] - b[0]),
      r: [...(ch.r || [])].sort((a, b) => a[0] - b[0]),
    });
  }
  return out;
}
const _compiled = compileTracks();
const _zero = [[0, [0, 0, 0]]];

// explode 方向随注册表注入；stateAt 只依赖 (t, explode, compiled)
let _explodeDir = new Map();
export function setExplodeDirs(registry) {
  _explodeDir = new Map(registry.map((a) => [a.id, a.explode]));
}
export function stateAt(t, explode = 0, compiled = _compiled, explodeDir = _explodeDir) {
  const tt = Math.min(1, Math.max(0, t));
  const table = [];
  for (const [id, ch] of compiled) {
    const p = sampleChannel(ch.p, tt);
    const r = sampleChannel(ch.r.length ? ch.r : _zero, tt);
    if (explode > 0) {
      const e = explodeDir.get(id);
      if (e) { p[0] += e[0] * explode; p[1] += e[1] * explode; p[2] += e[2] * explode; }
    }
    table.push({ id, p: [p[0], p[1], p[2]], r: [r[0], r[1], r[2]] });
  }
  return table;
}
// 把姿态表应用到模型（全树按 name 匹配； windshield 等子装配用父装配局部坐标）
export function applyState(model, t, explode = 0) {
  const table = stateAt(t, explode);
  const byId = new Map(table.map((x) => [x.id, x]));
  model.root.traverse((o) => {
    if (!o.isGroup || !o.name) return;
    const s = byId.get(o.name);
    if (!s) return;
    o.position.set(s.p[0], s.p[1], s.p[2]);
    o.rotation.set(s.r[0], s.r[1], s.r[2]);
  });
  return table;
}
