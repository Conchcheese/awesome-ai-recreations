// 沙面：9×6 m 程序化沙丘板（固定正弦叠加，无随机），逐帧在 CPU 上叠加虫体 features：
// 行进沙脊（沿身各节的鼓胀顶着沙面隆起）、头部隆包、尾部弃沙堆。透视模式下整板变透明，
// 露出沙下的虫体。全部是 t 的纯函数。
import * as THREE from 'three';
import {G, ringArc, ringRadius, bulge, ringPhase, pathAt} from './model.js';

const SEG_X = 116;
const SEG_Z = 76;

export function buildSand(M) {
  const geo = new THREE.PlaneGeometry(G.SAND_W, G.SAND_D, SEG_X, SEG_Z).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({color: '#b9c9e0', roughness: 0.97, metalness: 0, transparent: true, opacity: 0.78});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.position.y = 0;
  const base = new Float32Array(geo.attributes.position.count); // 沙丘基底（setup 时算好）
  {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // 固定种子"噪声"：三组不可通约正弦 + 一道纵向主沙丘
      base[i] =
        0.05 * Math.sin(0.9 * x + 1.3) * Math.cos(0.7 * z) +
        0.028 * Math.sin(1.9 * x - 1.1 * z + 2.1) +
        0.02 * Math.sin(3.1 * z + 0.7) * Math.cos(2.3 * x + 0.4) +
        0.06 * Math.exp(-((z - 1.6 - 0.35 * Math.sin(0.5 * x)) ** 2) / 1.2); // 远处一道主丘
    }
  }
  const worm = new Float32Array(geo.attributes.position.count); // 虫体特征叠加层

  /** 每帧重算虫体特征：state = {p, s, depth, t, lift, deposit} */
  const updateWormFeatures = ({p, s, depth, t, lift, deposit}) => {
    worm.fill(0);
    const pos = geo.attributes.position;
    const arr = pos.array;
    // 各节的地面投影与隆起量（虫顶离沙面越近、鼓胀越大，沙脊越高，封顶 12 cm）
    const R2 = [];
    for (let i = 0; i < G.RING_N; i++) {
      const a = pathAt(s - ringArc(i));
      const r = ringRadius(i, p);
      const b = bulge(ringPhase(i, p));
      const rise = Math.min(0.16, Math.max(0, r - depth * 0.45) * (0.3 + 0.9 * b)) * Math.max(0, 1 - lift);
      R2.push([a.x, a.z, rise]);
    }
    // 头部隆包（钻头推沙，比环脊更高更窄）
    const hp = pathAt(s + 0.1);
    const headRise = Math.min(0.18, Math.max(0, G.HEAD_R - depth * 0.45) * 1.1) * Math.max(0, 1 - lift);
    // 尾部弃沙堆（在虫身后方的路径上，随行进常驻）
    const dp = pathAt(s + G.TAIL_LEN + 0.35);
    const spoil = deposit;
    // 虫尾之后的浅沟
    const fp = pathAt(s + G.TAIL_LEN + 0.02);
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = arr[n], z = arr[n + 2];
      let h = 0;
      for (let k = 0; k < G.RING_N; k++) {
        const dx = x - R2[k][0], dz = z - R2[k][1];
        const d2 = dx * dx + dz * dz;
        if (d2 < 1.1) h += R2[k][2] * Math.exp(-d2 / 0.16);
      }
      if (headRise > 0.001) {
        const dx = x - hp.x, dz = z - hp.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.8) h += headRise * Math.exp(-d2 / 0.09);
      }
      if (spoil > 0.001) {
        const dx = x - dp.x, dz = z - dp.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.9) h += spoil * Math.exp(-d2 / 0.2);
      }
      if (lift < 0.5) {
        const dx = x - fp.x, dz = z - fp.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.25) h -= 0.035 * Math.exp(-d2 / 0.045) * (1 - lift);
      }
      worm[i] = h;
      n += 3;
    }
  };

  /** 应用高度（基底 + 虫体特征）并法线重算 */
  const apply = (t) => {
    const pos = geo.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3 + 1] = base[i] + worm[i] + 0.004 * Math.sin(2.1 * arr[i * 3] + t * 0.8) * Math.sin(1.7 * arr[i * 3 + 2] + t * 0.6);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  /** 沙面之下无物时的快速应用（拆解等虫体离场节拍仍保留基底活动） */
  const setXray = (k) => {
    mat.opacity = 0.78 - 0.71 * k;
    mat.depthWrite = k < 0.5;
  };
  return {mesh, updateWormFeatures, apply, setXray, mat};
}
