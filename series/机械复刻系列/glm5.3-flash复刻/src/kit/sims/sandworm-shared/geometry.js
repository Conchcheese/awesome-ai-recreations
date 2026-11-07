// 仿生沙虫 MK-X 整机装配：头段（口缘 + 24 针齿 + 8 颚瓣 + 旋转钻芯）、14 节环段体（蒙皮逐帧
// 重算，蠕动波沿身传播、棱环纹理随皮肤后滑）、环带与螺栓、尾段排沙喷口、喷沙粒子流。
// update(state) 是唯一动部件的入口，所有角度与尺寸都来自 model.js。
// state: {p, y, spin, explode, drillA, jaw, sprayK, t}
import * as THREE from 'three';
import {G, ringRadius, ringTaper, SKIN_SLIDE} from './model.js';

const V3 = THREE.Vector3;

export function buildMaterials() {
  return {
    hull: new THREE.MeshPhysicalMaterial({color: '#1d4477', roughness: 0.52, metalness: 0.15, clearcoat: 0.3, clearcoatRoughness: 0.4}),
    hullLight: new THREE.MeshPhysicalMaterial({color: '#a8d4f2', roughness: 0.5, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.4}),
    accent: new THREE.MeshPhysicalMaterial({color: '#1e5fd6', roughness: 0.42, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    cyan: new THREE.MeshStandardMaterial({color: '#0e5d70', emissive: '#39d6ee', emissiveIntensity: 0.45, roughness: 0.45, metalness: 0.2}),
    steel: new THREE.MeshStandardMaterial({color: '#c9ccd1', roughness: 0.42, metalness: 0.85}),
    dark: new THREE.MeshPhysicalMaterial({color: '#16233a', roughness: 0.42, metalness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    throat: new THREE.MeshStandardMaterial({color: '#0b1526', roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide}),
    spray: new THREE.MeshBasicMaterial({color: '#eef4fb', transparent: true, opacity: 0.5, depthWrite: false}),
  };
}

export const RING_LOCAL_X = (i) => -i * G.PITCH; // 环段体局部坐标：环 0 在原点，向 −x 排
const BODY_SPAN = (G.RING_N - 1) * G.PITCH;
const TAIL_X = RING_LOCAL_X(G.RING_N - 1) - 0.05;

export function buildWorm(M) {
  const root = new THREE.Group();
  const all = [];
  const collect = (g) => g.traverse((o) => o.isMesh && all.push(o));

  // ------------------------------------------------------------ 头段
  const head = new THREE.Group();
  root.add(head);
  // 头锥：从环 0 半径展到口缘
  const conePts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    conePts.push(new THREE.Vector2(G.R_BODY * 1.02 + (G.HEAD_R - G.R_BODY * 0.9) * Math.pow(u, 1.6) - 0.02 * u * u, 0.02 + u * 0.3));
  }
  const headCone = new THREE.Mesh(new THREE.LatheGeometry(conePts, 48).rotateZ(-Math.PI / 2), M.hull);
  headCone.castShadow = true;
  headCone.receiveShadow = true;
  head.add(headCone);
  // 口缘环
  const lip = new THREE.Mesh(new THREE.TorusGeometry(G.HEAD_R * 0.94, 0.026, 10, 48).rotateY(Math.PI / 2), M.accent);
  lip.position.x = 0.315;
  lip.castShadow = true;
  head.add(lip);
  // 咽喉：向内收的暗腔
  const throatPts = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    throatPts.push(new THREE.Vector2(G.HEAD_R * 0.88 * (1 - 0.8 * u * u), 0.3 - u * 0.26));
  }
  const throat = new THREE.Mesh(new THREE.LatheGeometry(throatPts, 40).rotateZ(-Math.PI / 2), M.throat);
  head.add(throat);
  // 24 根针齿：喉壁长出、向前汇聚到轴心附近（frame：2021 剧照的针齿"胡须"）
  const teeth = new THREE.InstancedMesh(new THREE.ConeGeometry(0.0095, 0.22, 5), M.hullLight, G.MAW_TEETH);
  teeth.castShadow = true;
  teeth.frustumCulled = false;
  head.add(teeth);
  // 8 片颚瓣：口缘周向装甲板，波峰抵达头部时外张
  const jaws = [];
  {
    const span = (Math.PI * 2) / G.JAWS;
    const plate = new THREE.BoxGeometry(0.13, 0.018, 0.052);
    for (let i = 0; i < G.JAWS; i++) {
      const az = i * span;
      const petal = new THREE.Mesh(plate, M.hullLight);
      petal.castShadow = true;
      petal.position.x = 0.04; // 板沿 +x 铺开
      const pivot = new THREE.Group();
      pivot.position.set(0.28, Math.cos(az) * G.HEAD_R * 0.82, Math.sin(az) * G.HEAD_R * 0.82);
      pivot.add(petal);
      head.add(pivot);
      jaws.push({pivot, az});
    }
  }
  // 钻芯：中心锥 + 3 条螺旋刃，随钻速转（前伸出口缘，特写里读得到）
  const drill = new THREE.Group();
  head.add(drill);
  const core = new THREE.Mesh(new THREE.ConeGeometry(G.DRILL_R, 0.36, 20).rotateZ(-Math.PI / 2), M.steel);
  core.position.x = 0.18;
  core.castShadow = true;
  drill.add(core);
  const bladeGeo = (() => {
    const g = new THREE.BoxGeometry(0.34, 0.014, 0.06, 12, 1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const a = (x + 0.17) * 5.2; // 螺旋扭转
      const y = pos.getY(i), z = pos.getZ(i);
      pos.setY(i, y * Math.cos(a) - z * Math.sin(a) + G.DRILL_R * 0.4);
      pos.setZ(i, y * Math.sin(a) + z * Math.cos(a));
    }
    g.computeVertexNormals();
    return g;
  })();
  for (let i = 0; i < G.DRILL_BLADES; i++) {
    const blade = new THREE.Mesh(bladeGeo, M.accent);
    blade.rotation.x = (i / G.DRILL_BLADES) * Math.PI * 2;
    blade.position.x = 0.18;
    blade.castShadow = true;
    drill.add(blade);
  }
  const drillRing = new THREE.Mesh(new THREE.TorusGeometry(G.DRILL_R * 0.72, 0.013, 6, 24).rotateY(Math.PI / 2), M.cyan);
  drillRing.position.x = 0.02;
  drill.add(drillRing);

  // ------------------------------------------------------------ 环段体：蒙皮逐帧重算
  const STATIONS = 4 * G.RING_N + 1; // 每环 4 个轴向站点
  const RADIAL = 44;
  const skinGeo = new THREE.BufferGeometry();
  {
    const nVert = STATIONS * RADIAL;
    skinGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nVert * 3), 3));
    skinGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nVert * 3), 3));
    const idx = [];
    for (let i = 0; i < STATIONS - 1; i++)
      for (let j = 0; j < RADIAL; j++) {
        const a = i * RADIAL + j;
        const b = i * RADIAL + ((j + 1) % RADIAL);
        const c = (i + 1) * RADIAL + j;
        const d = (i + 1) * RADIAL + ((j + 1) % RADIAL);
        idx.push(a, c, b, b, c, d);
      }
    skinGeo.setIndex(idx);
  }
  const skin = new THREE.Mesh(skinGeo, M.hull);
  skin.castShadow = true;
  skin.receiveShadow = true;
  root.add(skin);
  const X0 = 0.04; // 蒙皮起点（环 0 稍前）
  const stationX = (k) => X0 - (k / (STATIONS - 1)) * (BODY_SPAN + 0.1);
  // 环带（accent/冰蓝细环）+ 每环 6 颗螺栓
  const bands = [];
  for (let i = 0; i < G.RING_N; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 40).rotateY(Math.PI / 2), i % 2 ? M.hullLight : M.accent);
    band.position.x = RING_LOCAL_X(i);
    band.castShadow = true;
    root.add(band);
    bands.push(band);
  }
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.015, 8, 6), M.steel, G.RING_N * G.BAND_BOLTS);
  bolts.frustumCulled = false;
  bolts.castShadow = true;
  root.add(bolts);

  // ------------------------------------------------------------ 尾段：排沙喷口
  const tail = new THREE.Group();
  root.add(tail);
  {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      pts.push(new THREE.Vector2(G.R_BODY * ringTaper(G.RING_N - 1) * (1 - 0.72 * u), TAIL_X - u * G.TAIL_LEN));
    }
    const tailCone = new THREE.Mesh(new THREE.LatheGeometry(pts, 40).rotateZ(-Math.PI / 2), M.hull);
    tailCone.castShadow = true;
    tailCone.receiveShadow = true;
    tail.add(tailCone);
    const nozRing = new THREE.Mesh(new THREE.TorusGeometry(G.NOZZLE_R * 1.12, 0.016, 8, 32).rotateY(Math.PI / 2), M.accent);
    nozRing.position.x = TAIL_X - G.TAIL_LEN + 0.02;
    tail.add(nozRing);
    const nozCore = new THREE.Mesh(new THREE.CylinderGeometry(G.NOZZLE_R, G.NOZZLE_R * 0.8, 0.06, 24).rotateZ(Math.PI / 2), M.dark);
    nozCore.position.x = TAIL_X - G.TAIL_LEN + 0.03;
    tail.add(nozCore);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(G.NOZZLE_R * 0.8, 0.009, 6, 24).rotateY(Math.PI / 2), M.cyan);
    glowRing.position.x = TAIL_X - G.TAIL_LEN + 0.055;
    tail.add(glowRing);
  }
  // 喷沙粒子流：闭式 t
  const spray = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), M.spray, G.SPRAY_N);
  spray.frustumCulled = false;
  spray.visible = false;
  root.add(spray);
  collect(root);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new V3();
  const sc = new V3();
  const HINGE = new V3();

  // 蒙皮半径：相邻环余弦插值 + 随皮肤后滑的棱环纹理
  const radiusAtStation = (k, p, t) => {
    const fi = (X0 - stationX(k)) / G.PITCH; // 以环距为单位的弧长坐标
    const i0 = Math.max(0, Math.min(G.RING_N - 1, Math.floor(fi)));
    const i1 = Math.min(G.RING_N - 1, i0 + 1);
    const u = Math.min(1, Math.max(0, fi - i0));
    const w = u * u * (3 - 2 * u);
    const r = ringRadius(i0, p) * (1 - w) + ringRadius(i1, p) * w;
    const groove = 0.006 * Math.cos(Math.PI * 2 * (fi + SKIN_SLIDE * t));
    return Math.max(0.07, r + groove);
  };

  /** 唯一的更新入口 */
  const update = ({p = 0, y = -G.DEPTH_CRUISE, spin = 0, explode = 0, drillA = 0, jaw = 0, sprayK = 0, t = 0} = {}) => {
    root.position.y = y;
    root.rotation.y = spin;
    // 蒙皮
    {
      const pos = skinGeo.attributes.position.array;
      let n = 0;
      for (let k = 0; k < STATIONS; k++) {
        const x = stationX(k);
        const r = radiusAtStation(k, p, t);
        for (let j = 0; j < RADIAL; j++) {
          const a = (j / RADIAL) * Math.PI * 2;
          pos[n++] = x;
          pos[n++] = Math.cos(a) * r;
          pos[n++] = Math.sin(a) * r;
        }
      }
      skinGeo.attributes.position.needsUpdate = true;
      skinGeo.computeVertexNormals();
      skinGeo.computeBoundingSphere();
    }
    // 环带缩放到当节半径
    for (let i = 0; i < G.RING_N; i++) bands[i].scale.set(1, ringRadius(i, p), ringRadius(i, p));
    // 螺栓贴着各环的环带（在环带正上方，随环半径缩放）
    {
      let bi = 0;
      for (let i = 0; i < G.RING_N; i++) {
        const r = ringRadius(i, p);
        const bx = RING_LOCAL_X(i);
        for (let j = 0; j < G.BAND_BOLTS; j++) {
          const a = (j / G.BAND_BOLTS) * Math.PI * 2 + i * 0.3;
          m4.compose(v.set(bx, Math.cos(a) * (r + 0.014), Math.sin(a) * (r + 0.014)), q, sc.set(1, 1, 1));
          bolts.setMatrixAt(bi++, m4);
        }
      }
      bolts.instanceMatrix.needsUpdate = true;
    }
    // 针齿：喉壁 (x0.15, r0.20) 汇聚到轴心前 (x0.37, r0.035)
    const UP = new V3(0, 1, 0);
    for (let i = 0; i < G.MAW_TEETH; i++) {
      const a = (i / G.MAW_TEETH) * Math.PI * 2;
      const jitter = 0.82 + 0.18 * Math.sin(i * 2.4);
      const r0 = 0.2 * jitter;
      v.set(0.37 - 0.15, 0.035 * Math.cos(a) - r0 * Math.cos(a), 0.035 * Math.sin(a) - r0 * Math.sin(a)).normalize();
      q.setFromUnitVectors(UP, v);
      m4.compose(new V3(0.15, r0 * Math.cos(a), r0 * Math.sin(a)), q, sc.set(1, 1, 1));
      teeth.setMatrixAt(i, m4);
    }
    teeth.instanceMatrix.needsUpdate = true;
    // 颚瓣：绕口缘切向轴外张
    for (const {pivot, az} of jaws) {
      HINGE.set(0, -Math.sin(az), Math.cos(az));
      pivot.setRotationFromAxisAngle(HINGE, jaw);
    }
    // 钻芯转
    drill.rotation.x = drillA;
    // 拆解偏移（整机已在沙面上方，部件再各自散开）
    head.position.set(0.42 * explode, 0.5 * explode, 0);
    drill.position.set(0.95 * explode, 0.72 * explode, 0);
    skin.position.set(0, 1.18 * explode, 0);
    bolts.position.set(0, 1.18 * explode, 0);
    for (const b of bands) b.position.y = 1.18 * explode;
    tail.position.set(-0.5 * explode, 0.3 * explode, 0);
    // 喷沙：闭式 t
    spray.visible = sprayK > 0.04;
    if (spray.visible) {
      const tipX = TAIL_X - G.TAIL_LEN - 0.03;
      for (let i = 0; i < G.SPRAY_N; i++) {
        const u = (i / G.SPRAY_N + t * 0.85) % 1;
        const spread = 0.02 + u * 0.12;
        const ang = i * 2.39996;
        m4.compose(
          v.set(tipX - (0.05 + u * 0.8) * (0.4 + 0.6 * sprayK), Math.sin(ang) * spread * u * 2.4 + 0.025 * u, Math.cos(ang) * spread * u * 2.4),
          q,
          sc.set(1, 1, 1).multiplyScalar(0.013 * (1 - u * 0.7) * (0.5 + sprayK)),
        );
        spray.setMatrixAt(i, m4);
      }
      spray.instanceMatrix.needsUpdate = true;
      M.spray.opacity = 0.22 + 0.3 * sprayK;
    }
  };
  update();
  return {root, update, M, all, head, drill, skin, tail, bands, bolts, spray, jaws};
}
