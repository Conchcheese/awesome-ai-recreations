/* HY4 · 材质与几何工具（Three.js 依赖）
 * 材质分区依据 ILM 80/88s 近景观察；PBR 参数是实现推断，不是原作扫描数据。
 * 火焰纹、磨损、划痕均为程序化 CanvasTexture，无外部贴图与来源不明模型。
 */
import * as THREE from 'three';

const geoCache = new Map();
const cached = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
};

/* ---------- 程序化贴图 ---------- */
function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/* 不同 seed 得到不同走向的火焰飘带，避免全机重复同一条纹。 */
export function flameTexture(seed = 1, mode = 'red') {
  const [c, g] = canvas2d(512, 256);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const base = mode === 'blue' ? '#122a72' : '#9c1220';
  const dark = mode === 'blue' ? '#091a4d' : '#5e0b16';
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,.16)');
  grad.addColorStop(.5, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,.30)');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  /* 蓝色/橙色飘带，从一侧向另一侧渐收成火舌 */
  for (let k = 0; k < 7; k++) {
    const y0 = 24 + k * 33 + rnd() * 12;
    const len = 210 + rnd() * 280;
    const amp = 12 + rnd() * 20;
    g.beginPath();
    g.moveTo(-20, y0);
    g.bezierCurveTo(len * .28, y0 - amp, len * .55, y0 + amp, len, y0 + (rnd() - .5) * 26);
    g.bezierCurveTo(len * .62, y0 + amp * 1.5, len * .30, y0 + amp * .7, -20, y0 + 12 + rnd() * 10);
    g.closePath();
    g.fillStyle = mode === 'blue' ? '#e8462f' : '#2b53b8';
    g.fill();
    g.lineWidth = 2.2;
    g.strokeStyle = mode === 'blue' ? '#f6a13a' : '#f08a34';
    g.stroke();
  }
  /* 细划痕与掉漆，尺度不一，避免模板感 */
  for (let k = 0; k < 90; k++) {
    const x = rnd() * 512, y = rnd() * 256, w = 3 + rnd() * 26;
    g.strokeStyle = rnd() > .55 ? 'rgba(220,225,235,.16)' : 'rgba(20,18,22,.20)';
    g.lineWidth = .5 + rnd() * 1.1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + (rnd() - .5) * 5); g.stroke();
  }
  g.fillStyle = dark;
  for (let k = 0; k < 26; k++) g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 4, 1 + rnd() * 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function wearTexture(seed = 3) {
  const [c, g] = canvas2d(256, 256);
  let s = seed * 7919 + 104729;
  const rnd = () => { s = (s * 7919 + 104729) % 233280; return s / 233280; };
  g.fillStyle = '#a8a8a8'; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 520; k++) {
    const v = 120 + Math.floor(rnd() * 110);
    g.fillStyle = `rgba(${v},${v},${v},.34)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 9, 1 + rnd() * 3);
  }
  for (let k = 0; k < 60; k++) {
    g.strokeStyle = `rgba(${rnd() > .5 ? 230 : 60},${rnd() > .5 ? 230 : 60},230,.16)`;
    g.lineWidth = .6 + rnd();
    const x = rnd() * 256, y = rnd() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + rnd() * 50, y + (rnd() - .5) * 8); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ---------- 材质库 ---------- */
export function makeMaterials() {
  const wear = wearTexture(7);
  const mk = (o) => new THREE.MeshPhysicalMaterial({ roughnessMap: wear, envMapIntensity: 1.5, ...o });
  return {
    redPaint:   mk({ color: 0xb0111f, metalness: .52, roughness: .24, clearcoat: 1, clearcoatRoughness: .07 }),
    bluePaint:  mk({ color: 0x132a75, metalness: .54, roughness: .22, clearcoat: 1, clearcoatRoughness: .07 }),
    redFlame:   mk({ color: 0xffffff, map: flameTexture(2, 'red'), metalness: .48, roughness: .26, clearcoat: 1, clearcoatRoughness: .08 }),
    blueFlame:  mk({ color: 0xffffff, map: flameTexture(5, 'blue'), metalness: .48, roughness: .25, clearcoat: 1, clearcoatRoughness: .08 }),
    chrome:     mk({ color: 0xdfe4ea, metalness: 1, roughness: .085 }),
    aluminium:  mk({ color: 0x9fa7b2, metalness: .93, roughness: .31 }),
    brushed:    mk({ color: 0x88919c, metalness: .88, roughness: .43 }),
    steel:      mk({ color: 0x565f6b, metalness: .86, roughness: .40 }),
    darkSteel:  mk({ color: 0x242a33, metalness: .78, roughness: .49 }),
    joint:      mk({ color: 0x14171d, metalness: .55, roughness: .62 }),
    rubber:     mk({ color: 0x121418, metalness: .04, roughness: .93 }),
    brass:      mk({ color: 0xb08a48, metalness: .92, roughness: .34 }),
    glass:      new THREE.MeshPhysicalMaterial({ color: 0x24374a, metalness: .22, roughness: .09,
                  transparent: true, opacity: .62, envMapIntensity: 2.4, clearcoat: 1, clearcoatRoughness: .04,
                  side: THREE.DoubleSide }),
    glow:       new THREE.MeshBasicMaterial({ color: 0x7fe4ff }),
    glowWarm:   new THREE.MeshBasicMaterial({ color: 0xffc27a }),
    lamp:       new THREE.MeshBasicMaterial({ color: 0xfff3d2 }),
    grey:       new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: .05, roughness: .82 }),
    ground:     new THREE.MeshStandardMaterial({ color: 0x1a2029, metalness: .16, roughness: .72 }),
    wall:       new THREE.MeshStandardMaterial({ color: 0x232b35, metalness: .28, roughness: .58 })
  };
}

/* ---------- 几何工厂 ---------- */
export function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(cached(`b:${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function bevelBox(w, h, d, r, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const key = `v:${w},${h},${d},${r}`;
  const geo = cached(key, () => {
    const rr = Math.min(r, w / 2 - .001, h / 2 - .001);
    const sh = new THREE.Shape();
    const a = w / 2 - rr, b = h / 2 - rr;
    sh.moveTo(-a, -b - rr);
    sh.lineTo(a, -b - rr); sh.quadraticCurveTo(a + rr, -b - rr, a + rr, -b);
    sh.lineTo(a + rr, b); sh.quadraticCurveTo(a + rr, b + rr, a, b + rr);
    sh.lineTo(-a, b + rr); sh.quadraticCurveTo(-a - rr, b + rr, -a - rr, b);
    sh.lineTo(-a - rr, -b); sh.quadraticCurveTo(-a - rr, -b - rr, -a, -b - rr);
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(.002, d - 2 * rr), bevelEnabled: true,
      bevelThickness: rr, bevelSize: rr, bevelSegments: 2, curveSegments: 3, steps: 1 });
    g.translate(0, 0, -(d - 2 * rr) / 2);
    g.computeVertexNormals();
    return g;
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 16) {
  const m = new THREE.Mesh(cached(`c:${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function sphere(r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 18) {
  const m = new THREE.Mesh(cached(`s:${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2))), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function torus(r, tube, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(cached(`t:${r},${tube}`, () => new THREE.TorusGeometry(r, tube, 8, 28)), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

/* 大曲面甲片：球壳切片，非平板 */
export function shell(r, phiStart, phiLen, thetaStart, thetaLen, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const key = `sh:${r},${phiStart},${phiLen},${thetaStart},${thetaLen}`;
  const m = new THREE.Mesh(cached(key, () => new THREE.SphereGeometry(r, 22, 14, phiStart, phiLen, thetaStart, thetaLen)), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function bolt(mat, r = .035, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.Group();
  g.add(cyl(r, r, .022, mat, x, y, z, rx, ry, rz, 8));
  g.add(box(r * 1.15, .008, .008, mat, x, y, z + .013, rx, ry, rz + .35));
  return g;
}

export function pipe(a, b, r, mat, seg = 10) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const m = new THREE.Mesh(cached(`p:${r},${seg}`, () => new THREE.CylinderGeometry(r, r, 1, seg)), mat);
  m.scale.y = len;
  m.position.copy(va.clone().add(vb).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

export function boltRow(mat, count, from, to, r = .032) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? .5 : i / (count - 1);
    g.add(bolt(mat, r, from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u));
  }
  return g;
}

/* 环境贴图：程序化 equirectangular，模拟摄影棚顶光 + 冷天光 + 暖轮廓光。 */
export function environmentTexture() {
  const [c, g] = canvas2d(1024, 512);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#38465c'); sky.addColorStop(.34, '#64778e');
  sky.addColorStop(.50, '#8e8a86'); sky.addColorStop(.53, '#3a3d44'); sky.addColorStop(1, '#14181e');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  const horizon = g.createLinearGradient(0, 200, 0, 300);
  horizon.addColorStop(0, 'rgba(255,186,120,0)'); horizon.addColorStop(.5, 'rgba(255,176,104,.30)');
  horizon.addColorStop(1, 'rgba(255,176,104,0)');
  g.fillStyle = horizon; g.fillRect(0, 200, 1024, 100);
  const soft = (x, y, w, h, color, blur) => {
    g.save(); g.filter = `blur(${blur}px)`; g.fillStyle = color;
    g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill(); g.restore();
  };
  soft(170, 120, 120, 62, 'rgba(226,240,255,.95)', 26);   // 主光板
  soft(620, 96, 92, 46, 'rgba(255,255,255,.80)', 22);     // 顶光
  soft(880, 210, 76, 58, 'rgba(255,176,96,.85)', 30);     // 暖轮廓
  soft(430, 226, 150, 30, 'rgba(150,195,255,.42)', 34);   // 冷补光
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
