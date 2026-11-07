// three.js 几何工具：倒角盒、齿轮、螺栓圈、车削体、管路、合并等。
// 所有函数返回 three 对象，不依赖场景。
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export {THREE};

/** 圆角盒（比 BoxGeometry 更有工业感） */
export function rbox(w, h, d, r = Math.min(w, h, d) * 0.12, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.49));
}

/** 圆柱（默认沿 Y 轴，radiusTop/Bottom 可做锥筒） */
export function cyl(rt, rb = rt, h = 0.1, seg = 24, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}

/** 倒角圆柱：上下各加一圈小倒角，观感更“机加工” */
export function bevelCyl(r, h, bevel = Math.min(r * 0.12, h * 0.18), seg = 28) {
  const pts = [];
  const b = Math.min(bevel, h * 0.45);
  pts.push(new THREE.Vector2(0, -h / 2));
  pts.push(new THREE.Vector2(r - b, -h / 2));
  pts.push(new THREE.Vector2(r, -h / 2 + b));
  pts.push(new THREE.Vector2(r, h / 2 - b));
  pts.push(new THREE.Vector2(r - b, h / 2));
  pts.push(new THREE.Vector2(0, h / 2));
  return new THREE.LatheGeometry(pts, seg);
}

/** 车削体：传入 [[r,y], ...] 的轮廓 */
export function lathe(profile, seg = 40) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.00001), y)),
    seg,
  );
}

/** 垫圈 / 环 */
export function ring(rOuter, rInner, h = 0.004, seg = 32) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rInner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, {depth: h, bevelEnabled: false, curveSegments: seg});
  g.translate(0, 0, -h / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** 齿轮（直齿/斜齿由 twist 控制），沿 Y 轴，中心在原点 */
export function gear({radius = 0.06, teeth = 24, thickness = 0.012, toothH = 0.008, toothW = 0.55, hole = 0.02, twist = 0, hub = 0}) {
  const shape = new THREE.Shape();
  const rTip = radius + toothH;
  const rRoot = radius;
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const p = [
      [rRoot, a0],
      [rTip, a0 + step * (0.5 - toothW / 2) * 0.9],
      [rTip, a0 + step * (0.5 + toothW / 2) * 0.9],
    ];
    p.forEach(([r, a], k) => {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  if (hub > 0) {
    shape.holes.push(ringPath(hub));
  } else if (hole > 0) {
    shape.holes.push(ringPath(hole));
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelSize: Math.min(toothH * 0.18, 0.0008),
    bevelThickness: 0.0006, bevelSegments: 1, curveSegments: 6,
  });
  g.translate(0, 0, -thickness / 2);
  if (twist) {
    // 简易斜齿：按 z 扭转顶点
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const a = (z / Math.max(thickness, 1e-6)) * twist;
      const x = pos.getX(i), y = pos.getY(i);
      pos.setXY(i, x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
    }
  }
  g.rotateX(-Math.PI / 2);
  return g;
}

function ringPath(r) {
  const p = new THREE.Path();
  p.absarc(0, 0, r, 0, Math.PI * 2, true);
  return p;
}

/** 沿曲线管道（线缆、软管） */
export function tube(points, radius = 0.006, seg = 64, radSeg = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, 'centripetal',
  );
  return new THREE.TubeGeometry(curve, seg, radius, radSeg, closed);
}

/** 弹簧（螺旋线） */
export function spring({radius = 0.014, height = 0.05, turns = 7, wire = 0.0018, seg = 24}) {
  const pts = [];
  const n = turns * seg;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    pts.push([Math.cos(a) * radius, t * height, Math.sin(a) * radius]);
  }
  return tube(pts, wire, n, 5);
}

/** 沿 Y 轴的一圈螺栓（返回 Group，螺栓头略微凸出表面） */
export function boltRing({count = 12, radius = 0.2, y = 0, size = 0.004, mat, axis = 'y'}) {
  const g = new THREE.Group();
  const geo = bevelCyl(size, size * 0.9, size * 0.25, 10);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const m = new THREE.Mesh(geo, mat);
    if (axis === 'y') {
      m.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    } else {
      m.position.set(Math.cos(a) * radius, Math.sin(a) * radius, y);
    }
    g.add(m);
  }
  return g;
}

/** 小螺栓（单个），沿 Y 轴 */
export function bolt(size, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(bevelCyl(size, size * 0.9, size * 0.22, 8), mat);
  m.position.set(x, y, z);
  return m;
}

/** 合并同材质几何：transform 数组 [{geo, pos:[x,y,z], rot:[rx,ry,rz], scale}] */
export function merge(geos) {
  const clean = geos.filter(Boolean).map((g) => g.clone());
  if (!clean.length) return null;
  return mergeGeometries(clean, false);
}

/** 复制并施加变换 */
export function place(geo, {pos = [0, 0, 0], rot = [0, 0, 0], scale = 1} = {}) {
  const g = geo.clone();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
  m.compose(
    new THREE.Vector3(...pos), q,
    new THREE.Vector3(...(Array.isArray(scale) ? scale : [scale, scale, scale])),
  );
  g.applyMatrix4(m);
  return g;
}

/** 圆盘上的十字/加号装饰点（以 InstancedMesh 批量） */
export function crossMarks(count, radiusRange, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.12); shape.lineTo(-0.12, -0.12); shape.lineTo(-0.12, -0.5);
  shape.lineTo(0.12, -0.5); shape.lineTo(0.12, -0.12); shape.lineTo(0.5, -0.12);
  shape.lineTo(0.5, 0.12); shape.lineTo(0.12, 0.12); shape.lineTo(0.12, 0.5);
  shape.lineTo(-0.12, 0.5); shape.lineTo(-0.12, 0.12); shape.lineTo(-0.5, 0.12);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i * 2.39996) % (Math.PI * 2);
    const r = radiusRange[0] + (i / count) * (radiusRange[1] - radiusRange[0]);
    m.makeTranslation(Math.cos(a) * r, 0.001, Math.sin(a) * r);
    mesh.setMatrixAt(i, m);
  }
  return mesh;
}

/** 十六进制色 + 透明度 → rgba 字符串（HUD 用） */
export function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
