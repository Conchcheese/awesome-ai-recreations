/* HY4 · 程序化精细几何（492 个命名视觉分件 / 40 个可动装配）
 * 形态依据：Paramount 6/18/29/48/102s、ILM 80/88/100s、MPM-4 官方产品图（仅表面细节）。
 * 隐藏铰链、背面藏件与真实尺度均为 guess；不用生成图、不换模型、不隐藏实体。
 */
import * as THREE from 'three';
import { ASSEMBLIES } from './rig.mjs';
import { box, bevelBox, cyl, sphere, torus, shell, bolt, boltRow, pipe, makeMaterials } from './kit.js';

const P = Math.PI;

/* 每个 part() 生成一个带稳定 ID 的视觉分件；内部可含多个 mesh。 */
function makeAssembly(id, n, M, builder) {
  const g = new THREE.Group();
  g.name = id;
  const system = ASSEMBLIES.find((a) => a.id === id).system;
  g.userData = { assembly: id, system };
  let count = 0;
  const part = (label, ...meshes) => {
    count += 1;
    const p = new THREE.Group();
    p.name = `${id}-${String(count).padStart(2, '0')}`;
    p.userData = { id: p.name, assembly: id, system, label };
    for (const m of meshes) {
      m.userData.systemKey = system;
      p.add(m);
    }
    g.add(p);
    return p;
  };
  builder(part, M, id);
  if (count !== n) throw new Error(`${id} 分件数 ${count} != 契约 ${n}`);
  return g;
}

/* 镜像侧构造器按名字复用；轮组六个装配共用同一个构造流程。 */
const keyOf = (id) => id
  .replace(/^wheel_[fr]_[lr]\d?$/, 'wheel')
  .replace(/_l(\d?)$/, '_L')
  .replace(/_r(\d?)$/, '_R');

const BUILDERS = {
  /* 驾驶室 / 胸腔框架 */
  cab: (p, M) => {
    p('深蓝驾驶室主壳', bevelBox(2.42, 1.92, 2.06, .14, M.bluePaint, 0, 0, 0));
    p('前立柱框', bevelBox(2.34, .16, .14, .04, M.brushed, 0, .88, 1.02));
    p('后立柱框', bevelBox(2.34, .16, .14, .04, M.brushed, 0, .88, -1.02));
    p('左侧加强梁', bevelBox(.13, 1.78, 2.0, .04, M.steel, -1.20, 0, 0));
    p('右侧加强梁', bevelBox(.13, 1.78, 2.0, .04, M.steel, 1.20, 0, 0));
    p('底部横梁', bevelBox(2.34, .18, 2.0, .05, M.darkSteel, 0, -.86, 0));
    p('内构左肋骨', cyl(.055, .055, 1.5, M.aluminium, -.62, 0, .30, 0, 0, .12));
    p('内构右肋骨', cyl(.055, .055, 1.5, M.aluminium, .62, 0, .30, 0, 0, -.12));
    p('内构中肋骨', cyl(.06, .06, 1.6, M.brushed, 0, 0, .28));
    p('顶部左横撑', box(.10, .10, 1.9, M.steel, -.85, .94, 0));
    p('顶部右横撑', box(.10, .10, 1.9, M.steel, .85, .94, 0));
    p('左侧铆钉列', boltRow(M.chrome, 6, [-1.27, .70, -.85], [-1.27, .70, .85], .028));
    p('右侧铆钉列', boltRow(M.chrome, 6, [1.27, .70, -.85], [1.27, .70, .85], .028));
    p('中央徽记座', cyl(.20, .20, .05, M.chrome, 0, -.28, 1.06, P / 2));
  },

  /* 车顶 / 肩胛上盖 */
  roof: (p, M) => {
    p('车顶主盖', bevelBox(2.56, .16, 2.02, .07, M.bluePaint, 0, 0, 0));
    p('左银色边条', box(.07, .09, 1.96, M.chrome, -1.24, .06, 0));
    p('右银色边条', box(.07, .09, 1.96, M.chrome, 1.24, .06, 0));
    p('左导流罩', shell(.52, 0, P, 0, P / 2, M.bluePaint, -.78, .12, -.28, 0, 0, 0, 1, .34, 1.5));
    p('右导流罩', shell(.52, 0, P, 0, P / 2, M.bluePaint, .78, .12, -.28, 0, 0, 0, 1, .34, 1.5));
    p('顶部标记灯左', box(.14, .07, .10, M.glowWarm, -.62, .12, .92));
    p('顶部标记灯中', box(.14, .07, .10, M.glowWarm, 0, .12, .92));
    p('顶部标记灯右', box(.14, .07, .10, M.glowWarm, .62, .12, .92));
  },

  /* 长头引擎盖 / 翻起后的胸甲 */
  hood: (p, M) => {
    p('红色引擎盖主体', bevelBox(2.36, .56, 2.54, .12, M.redPaint, 0, 0, 0));
    p('蓝橙火焰蒙皮', box(2.20, .018, 2.40, M.redFlame, 0, .292, 0));
    p('左侧板', bevelBox(.12, .50, 2.42, .05, M.bluePaint, -1.17, -.02, 0));
    p('右侧板', bevelBox(.12, .50, 2.42, .05, M.bluePaint, 1.17, -.02, 0));
    p('中央隆起脊', bevelBox(.34, .14, 2.30, .06, M.redPaint, 0, .34, 0));
    p('左进气口', box(.36, .04, .54, M.darkSteel, -.72, .30, -.62, 0, .18, 0));
    p('右进气口', box(.36, .04, .54, M.darkSteel, .72, .30, -.62, 0, -.18, 0));
    p('左进气栅条', boltRow(M.brushed, 5, [-.86, .325, -.84], [-.58, .325, -.40], .026));
    p('右进气栅条', boltRow(M.brushed, 5, [.58, .325, -.84], [.86, .325, -.40], .026));
    p('前缘铬条', box(2.30, .075, .075, M.chrome, 0, .22, 1.27));
    p('后缘铬条', box(2.30, .065, .065, M.chrome, 0, .22, -1.27));
    p('左边缘铆钉', boltRow(M.chrome, 7, [-1.10, .29, -1.10], [-1.10, .29, 1.10], .026));
    p('右边缘铆钉', boltRow(M.chrome, 7, [1.10, .29, -1.10], [1.10, .29, 1.10], .026));
    p('前沿铆钉', boltRow(M.chrome, 7, [-1.00, .29, 1.20], [1.00, .29, 1.20], .026));
    p('左侧下机械层', bevelBox(.42, .18, 1.9, .05, M.steel, -.88, -.34, 0));
    p('右侧下机械层', bevelBox(.42, .18, 1.9, .05, M.steel, .88, -.34, 0));
    p('前沿红色下甲', bevelBox(2.1, .20, .26, .05, M.redFlame, 0, -.28, 1.20));
    p('盖下铰链座', cyl(.11, .11, 2.0, M.darkSteel, 0, -.36, -.9, 0, 0, P / 2, 10));
  },

  /* 挡风玻璃 / 斜置胸窗 */
  chest_L: (p, M) => chestWindow(p, M, -1),
  chest_R: (p, M) => chestWindow(p, M, 1),

  /* 胸腔核心 */
  core: (p, M) => {
    p('核心机架', bevelBox(.86, 1.16, .52, .08, M.darkSteel, 0, 0, 0));
    p('上银肋', box(.92, .08, .44, M.aluminium, 0, .52, .04));
    p('中银肋', box(.92, .08, .44, M.brushed, 0, .12, .04));
    p('下银肋', box(.92, .08, .44, M.aluminium, 0, -.30, .04));
    p('底部银肋', box(.86, .09, .46, M.chrome, 0, -.54, .04));
    p('蓝色发光块上', box(.30, .13, .06, M.glow, 0, .34, .30));
    p('蓝色发光块中', box(.30, .13, .06, M.glow, 0, .02, .30));
    p('蓝色发光块下', box(.30, .13, .06, M.glow, 0, -.30, .30));
    p('左活塞', pipe([-.36, -.46, .18], [-.36, .46, .18], .045, M.chrome));
    p('右活塞', pipe([.36, -.46, .18], [.36, .46, .18], .045, M.chrome));
    p('左内活塞', pipe([-.20, -.40, .20], [-.20, .40, .20], .032, M.brass));
    p('右内活塞', pipe([.20, -.40, .20], [.20, .40, .20], .032, M.brass));
    p('左管线', pipe([-.44, -.48, -.12], [-.30, .48, -.12], .028, M.joint));
    p('右管线', pipe([.44, -.48, -.12], [.30, .48, -.12], .028, M.joint));
    p('核心环', torus(.26, .035, M.chrome, 0, .02, .32));
    p('顶部连接器', cyl(.14, .14, .12, M.brass, 0, .62, 0, P / 2, 0, 0, 12));
  },

  /* 头雕：重叠弧壳 + 长侧鳍 + 圆形耳轴 + 分片银面罩（ILM 88s / 61s） */
  head: (p, M) => {
    p('左蓝色弧盔壳', shell(.50, 0, P * .55, .12, P * .62, M.bluePaint, -.24, .12, 0, 0, 0, .18, 1, 1.15, 1));
    p('右蓝色弧盔壳', shell(.50, P * .45, P * .55, .12, P * .62, M.bluePaint, .24, .12, 0, 0, 0, -.18, 1, 1.15, 1));
    p('中央冠脊', bevelBox(.20, .58, .30, .07, M.bluePaint, 0, .46, -.02));
    p('冠脊前蓝片', bevelBox(.24, .30, .10, .04, M.bluePaint, 0, .40, .24));
    p('左长侧鳍', bevelBox(.09, .92, .16, .035, M.bluePaint, -.48, .50, -.10, 0, 0, -.24));
    p('右长侧鳍', bevelBox(.09, .92, .16, .035, M.bluePaint, .48, .50, -.10, 0, 0, .24));
    p('左鳍银尖', box(.10, .18, .17, M.chrome, -.59, 1.00, -.10, 0, 0, -.24));
    p('右鳍银尖', box(.10, .18, .17, M.chrome, .59, 1.00, -.10, 0, 0, .24));
    p('左耳部圆轴', torus(.15, .045, M.chrome, -.47, -.02, -.02, 0, P / 2, 0), cyl(.09, .09, .09, M.darkSteel, -.47, -.02, -.02, 0, 0, P / 2));
    p('右耳部圆轴', torus(.15, .045, M.chrome, .47, -.02, -.02, 0, P / 2, 0), cyl(.09, .09, .09, M.darkSteel, .47, -.02, -.02, 0, 0, P / 2));
    p('左眉骨', bevelBox(.27, .10, .16, .035, M.steel, -.20, .14, .30, 0, 0, -.16));
    p('右眉骨', bevelBox(.27, .10, .16, .035, M.steel, .20, .14, .30, 0, 0, .16));
    p('左蓝色眼', box(.16, .055, .05, M.glow, -.20, .055, .36));
    p('右蓝色眼', box(.16, .055, .05, M.glow, .20, .055, .36));
    p('银色鼻梁', bevelBox(.13, .38, .17, .045, M.aluminium, 0, -.13, .33));
    p('银色上面罩', bevelBox(.46, .14, .15, .05, M.chrome, 0, -.02, .31));
    p('银色分段面罩左', bevelBox(.22, .26, .13, .04, M.aluminium, -.19, -.28, .29, 0, 0, .10));
    p('银色分段面罩右', bevelBox(.22, .26, .13, .04, M.aluminium, .19, -.28, .29, 0, 0, -.10));
    p('银色下巴', bevelBox(.36, .14, .18, .05, M.chrome, 0, -.48, .26));
    p('金色内构左', box(.13, .22, .07, M.brass, -.30, -.18, .22));
    p('金色内构右', box(.13, .22, .07, M.brass, .30, -.18, .22));
    p('后脑壳', shell(.46, 0, P * 2, .10, P * .55, M.darkSteel, 0, .06, -.16, 0, 0, 0, 1, .9, .8));
    p('颈柱', cyl(.17, .20, .30, M.joint, 0, -.66, -.02));
  },

  /* 镀铬竖格栅 / 腹部层叠齿片 */
  grille: (p, M) => {
    p('格栅上框', box(2.06, .11, .13, M.chrome, 0, .82, 0));
    p('格栅下框', box(2.06, .11, .13, M.chrome, 0, -.82, 0));
    p('格栅左边框', box(.11, 1.72, .13, M.chrome, -1.0, 0, 0));
    p('格栅右边框', box(.11, 1.72, .13, M.chrome, 1.0, 0, 0));
    for (let i = 0; i < 16; i++) {
      const x = -.88 + i * (1.76 / 15);
      p(`竖向格栅条 ${i + 1}`, box(.045, 1.58, .09, i % 4 === 0 ? M.brushed : M.chrome, x, 0, .02));
    }
    for (let k = 0; k < 4; k++) {
      p(`横向格栅条 ${k + 1}`, box(1.94, .035, .075, M.brushed, 0, -.56 + k * .38, .05));
    }
    for (let k = 0; k < 6; k++) {
      p(`腹部层叠齿片 ${k + 1}`, bevelBox(1.72 - k * .10, .075, .10, .025, k % 2 ? M.steel : M.aluminium, 0, -.62 + k * .25, -.10, .18, 0, 0));
    }
    p('中央徽记底座', cyl(.19, .19, .055, M.chrome, 0, .18, .14, P / 2, 0, 0, 12));
    p('中央徽记环', torus(.15, .026, M.brass, 0, .18, .17));
    p('格栅底铆钉列', boltRow(M.chrome, 8, [-.90, -.88, .08], [.90, -.88, .08], .028));
    p('格栅顶铆钉列', boltRow(M.chrome, 8, [-.90, .88, .08], [.90, .88, .08], .028));
    p('格栅侧铆钉', boltRow(M.chrome, 5, [-1.06, -.68, .08], [-1.06, .68, .08], .028));
  },

  /* 腹部：窄腰 + 多层裸露机械 */
  abdomen: (p, M) => {
    for (let k = 0; k < 8; k++) {
      const w = 1.16 - Math.abs(k - 3.5) * .10;
      p(`腹部甲片 ${k + 1}`, bevelBox(w, .13, .34, .045, k % 3 === 0 ? M.brushed : M.darkSteel,
        0, -.58 + k * .165, .06 + (k % 2) * .06, .08, 0, 0));
    }
    for (let k = 0; k < 4; k++) {
      const x = -.40 + k * .27;
      p(`竖向管线 ${k + 1}`, pipe([x, -.66, .26], [x, .68, .26], .035, k % 2 ? M.joint : M.brass));
    }
    for (let k = 0; k < 4; k++) {
      const x = -.46 + k * .30;
      p(`腹部活塞 ${k + 1}`, cyl(.045, .045, .80, M.chrome, x, 0, -.20), cyl(.072, .072, .12, M.steel, x, .36, -.20));
    }
    p('金色连接件左', sphere(.10, M.brass, -.52, .42, .06));
    p('金色连接件右', sphere(.10, M.brass, .52, .42, .06));
    p('腰箍上', torus(.56, .045, M.steel, 0, .70, 0, P / 2));
    p('腰箍下', torus(.52, .045, M.steel, 0, -.68, 0, P / 2));
  },

  /* 肩：大曲面蓝甲 + 红色弧形翼片 + 球形关节 */
  shoulder_L: (p, M) => shoulder(p, M, -1),
  shoulder_R: (p, M) => shoulder(p, M, 1),

  arm_L: (p, M) => arm(p, M, -1),
  arm_R: (p, M) => arm(p, M, 1),
  hand_L: (p, M) => hand(p, M, -1),
  hand_R: (p, M) => hand(p, M, 1),

  /* 车架纵梁 / 骨盆 */
  chassis: (p, M) => {
    p('左主纵梁', bevelBox(.16, .26, 3.5, .045, M.darkSteel, -.82, 0, 0));
    p('右主纵梁', bevelBox(.16, .26, 3.5, .045, M.darkSteel, .82, 0, 0));
    for (let k = 0; k < 4; k++) p(`横梁 ${k + 1}`, box(1.72, .13, .15, M.steel, 0, 0, -1.45 + k * .96));
    p('左髋关节座', cyl(.24, .24, .26, M.chrome, -.72, -.16, .95, 0, 0, P / 2));
    p('右髋关节座', cyl(.24, .24, .26, M.chrome, .72, -.16, .95, 0, 0, P / 2));
    p('前连接板', bevelBox(1.90, .18, .20, .04, M.brushed, 0, .10, 1.68));
    p('车尾平板与后连接板', bevelBox(2.46, .10, 1.45, .04, M.brushed, 0, .10, -1.34));
    p('左纵梁铆钉', boltRow(M.chrome, 8, [-.92, .12, -1.55], [-.92, .12, 1.55], .026));
    p('右纵梁铆钉', boltRow(M.chrome, 8, [.92, .12, -1.55], [.92, .12, 1.55], .026));
  },

  hip: (p, M) => {
    p('骨盆主体', bevelBox(1.62, .52, .86, .10, M.darkSteel, 0, 0, 0));
    p('左蓝色髋甲', shell(.48, 0, P * .62, .18, P * .55, M.bluePaint, -.72, .06, .10, 0, 0, 0, 1, 1, 1.1));
    p('右蓝色髋甲', shell(.48, P * .38, P * .62, .18, P * .55, M.bluePaint, .72, .06, .10, 0, 0, 0, 1, 1, 1.1));
    p('左球形关节', sphere(.21, M.chrome, -.66, -.16, .02));
    p('右球形关节', sphere(.21, M.chrome, .66, -.16, .02));
    p('左髋环', torus(.24, .04, M.brushed, -.66, -.16, .02, 0, P / 2, 0));
    p('右髋环', torus(.24, .04, M.brushed, .66, -.16, .02, 0, P / 2, 0));
    p('前骨盆铆钉', boltRow(M.chrome, 5, [-.60, .18, .44], [.60, .18, .44], .03));
    p('左髋铆钉', boltRow(M.chrome, 3, [-.82, -.10, -.28], [-.82, -.10, .30], .03));
    p('右髋铆钉', boltRow(M.chrome, 3, [.82, -.10, -.28], [.82, -.10, .30], .03));
    p('中央腰轴', cyl(.18, .18, .62, M.steel, 0, .12, 0));
  },

  /* 保险杠 / 骨盆前甲 */
  bumper: (p, M) => {
    p('银色保险杠主体', bevelBox(2.72, .30, .26, .06, M.chrome, 0, 0, 0));
    p('左分段', bevelBox(.86, .24, .30, .05, M.brushed, -.90, -.02, .04));
    p('右分段', bevelBox(.86, .24, .30, .05, M.brushed, .90, -.02, .04));
    for (let k = 0; k < 10; k++) {
      p(`蓝色小灯 ${k + 1}`, cyl(.045, .045, .035, M.glowWarm, -1.22 + k * .27, .10, .16, P / 2, 0, 0, 10));
    }
    p('左护角', bevelBox(.20, .42, .34, .05, M.chrome, -1.36, -.02, 0));
    p('右护角', bevelBox(.20, .42, .34, .05, M.chrome, 1.36, -.02, 0));
    p('左铆钉列', boltRow(M.steel, 4, [-1.26, -.06, .16], [-.92, -.06, .16], .028));
    p('右铆钉列', boltRow(M.steel, 4, [.92, -.06, .16], [1.26, -.06, .16], .028));
    p('中央铆钉列', boltRow(M.steel, 4, [-.34, -.06, .16], [.34, -.06, .16], .028));
    p('左拖钩', torus(.10, .035, M.darkSteel, -.62, -.20, .10, P / 2));
    p('右拖钩', torus(.10, .035, M.darkSteel, .62, -.20, .10, P / 2));
    p('下缘护板', box(2.5, .07, .16, M.steel, 0, -.20, .02));
    p('中央牌照座', bevelBox(.52, .18, .05, .02, M.darkSteel, 0, .02, .16));
  },

  leg_L: (p, M) => leg(p, M, -1),
  leg_R: (p, M) => leg(p, M, 1),
  foot_L: (p, M) => foot(p, M, -1),
  foot_R: (p, M) => foot(p, M, 1),

  /* 六轮：胎 / 胎侧 / 轮毂 / 轮辐 / 中心盖 / 螺栓 */
  wheel: (p, M) => {
    p('橡胶轮胎', cyl(.62, .62, .34, M.rubber, 0, 0, 0, 0, 0, P / 2, 24));
    p('左胎侧', torus(.55, .085, M.rubber, 0, 0, .17, 0, 0, 0));
    p('右胎侧', torus(.55, .085, M.rubber, 0, 0, -.17, 0, 0, 0));
    p('镀铬轮毂', cyl(.36, .36, .36, M.chrome, 0, 0, 0, 0, 0, P / 2, 18));
    for (let k = 0; k < 6; k++) {
      const a = k * P / 3;
      p(`轮辐 ${k + 1}`, box(.10, .30, .045, M.brushed, Math.cos(a) * .19, Math.sin(a) * .19, .19, 0, 0, a - P / 2));
    }
    p('中心盖', cyl(.13, .13, .40, M.steel, 0, 0, 0, 0, 0, P / 2, 12));
    const hub = new THREE.Group();
    for (let k = 0; k < 8; k++) {
      const a = k * P / 4;
      hub.add(bolt(M.chrome, .028, Math.cos(a) * .26, Math.sin(a) * .26, .21, 0, 0, 0));
    }
    p('轮毂螺栓列', hub);
  },

  stack_L: (p, M) => stack(p, M, -1),
  stack_R: (p, M) => stack(p, M, 1),
  tank_L: (p, M) => tank(p, M, -1),
  tank_R: (p, M) => tank(p, M, 1),
  lamp_L: (p, M) => lamp(p, M, -1),
  lamp_R: (p, M) => lamp(p, M, 1),

  back: (p, M) => {
    p('背部主车板', bevelBox(2.34, 1.72, .20, .07, M.bluePaint, 0, 0, 0));
    p('左上分板', bevelBox(1.06, .72, .10, .04, M.redPaint, -.58, .42, .14));
    p('右上分板', bevelBox(1.06, .72, .10, .04, M.redPaint, .58, .42, .14));
    p('左下分板', bevelBox(1.06, .72, .10, .04, M.bluePaint, -.58, -.40, .14));
    p('右下分板', bevelBox(1.06, .72, .10, .04, M.bluePaint, .58, -.40, .14));
    p('左通风栅', boltRow(M.darkSteel, 7, [-.96, -.06, .21], [-.30, -.06, .21], .035));
    p('右通风栅', boltRow(M.darkSteel, 7, [.30, -.06, .21], [.96, -.06, .21], .035));
    p('左支撑', cyl(.07, .07, 1.5, M.steel, -1.02, 0, -.16));
    p('右支撑', cyl(.07, .07, 1.5, M.steel, 1.02, 0, -.16));
  },

  fender_f_L: (p, M) => fender(p, M, -1),
  fender_f_R: (p, M) => fender(p, M, 1)
};

/* ---------- 对称构件 ---------- */
function chestWindow(p, M, s) {
  p('倾斜玻璃胸窗', bevelBox(.94, 1.16, .065, .035, M.glass, 0, 0, 0));
  p('银色上框', box(1.02, .085, .10, M.chrome, 0, .60, .01));
  p('银色下框', box(1.02, .085, .10, M.chrome, 0, -.60, .01));
  p('银色外框', box(.085, 1.24, .10, M.chrome, s * .50, 0, .01));
  p('银色内框', box(.085, 1.24, .10, M.brushed, -s * .50, 0, .01));
  p('红色外边框', bevelBox(.12, 1.30, .14, .03, M.redPaint, s * .56, 0, -.03));
  p('红色内边框', bevelBox(.10, 1.30, .14, .03, M.redPaint, -s * .56, 0, -.03));
  p('玻璃雨刷', box(.78, .025, .03, M.darkSteel, 0, -.40, .07, 0, 0, s * .22));
  p('玻璃反光条', box(.10, 1.02, .012, M.brushed, -s * .22, 0, .045, 0, 0, s * .12));
  p('窗框铰链', cyl(.065, .065, .18, M.steel, -s * .52, -.56, -.06, 0, 0, P / 2));
  p('窗框铆钉', boltRow(M.chrome, 4, [-.42, .65, .06], [.42, .65, .06], .026));
}

function shoulder(p, M, s) {
  p('蓝色大曲面肩甲', shell(.72, 0, P, .14, P * .42, M.bluePaint, s * .12, .16, 0, 0, 0, s * .12, 1, .60, 1.04));
  p('蓝甲第二层', shell(.60, 0, P, .34, P * .44, M.blueFlame, s * .18, .04, .06, 0, 0, s * .18, 1, .72, 1.04));
  p('红色弧形翼片', bevelBox(.24, 1.06, .82, .10, M.redFlame, s * .68, .10, -.06, 0, 0, s * .24));
  p('红色球形关节', sphere(.27, M.redPaint, s * .30, -.40, .02));
  p('银色肩轴', cyl(.15, .15, .56, M.chrome, s * .34, -.30, 0, 0, 0, P / 2));
  p('上分层甲片', bevelBox(.86, .14, .54, .045, M.bluePaint, s * .16, .64, -.08, 0, 0, s * .14));
  p('侧分层甲片', bevelBox(.16, .62, .48, .04, M.redPaint, s * .78, -.10, -.02));
  p('下分层甲片', bevelBox(.80, .12, .46, .035, M.brushed, s * .12, -.62, -.04));
  p('肩甲铆钉列', boltRow(M.chrome, 5, [-.36 + s * .14, .72, .30], [.36 + s * .14, .72, .30], .028));
  p('肩侧铆钉列', boltRow(M.chrome, 4, [s * .82, -.40, .22], [s * .82, .40, .22], .028));
  p('翼片铆钉列', boltRow(M.chrome, 4, [s * .70, -.38, .36], [s * .70, .38, .36], .028));
  p('肩内铆钉列', boltRow(M.brushed, 4, [-s * .20, -.50, .30], [s * .20, -.50, .30], .026));
  p('肩部蓝色边条', box(.90, .06, .10, M.bluePaint, s * .14, .74, .26));
}

function arm(p, M, s) {
  p('上臂主甲', bevelBox(.52, 1.06, .56, .10, M.bluePaint, 0, .52, 0));
  p('上臂外侧甲', bevelBox(.14, .92, .48, .04, M.redPaint, s * .30, .50, 0));
  p('上臂内骨架', cyl(.13, .13, 1.02, M.steel, 0, .48, 0));
  p('肘关节球', sphere(.22, M.chrome, 0, -.02, 0));
  p('肘关节环', torus(.23, .05, M.darkSteel, 0, -.02, 0, 0, P / 2, 0));
  p('前臂红甲', bevelBox(.58, .96, .56, .09, M.redFlame, 0, -.60, .02));
  p('前臂蓝侧甲左', bevelBox(.13, .88, .50, .04, M.bluePaint, -.33, -.60, 0));
  p('前臂蓝侧甲右', bevelBox(.13, .88, .50, .04, M.bluePaint, .33, -.60, 0));
  p('前臂银骨架', box(.30, .90, .34, M.brushed, 0, -.60, -.06));
  p('左液压杆', pipe([-.22, .42, .30], [-.22, -.96, .30], .045, M.chrome));
  p('右液压杆', pipe([.22, .42, .30], [.22, -.96, .30], .045, M.chrome));
  p('中央液压杆', pipe([0, .30, -.30], [0, -1.0, -.30], .055, M.brass));
  p('左管线', pipe([-.30, .20, -.22], [-.26, -1.0, -.22], .028, M.joint));
  p('右管线', pipe([.30, .20, -.22], [.26, -1.0, -.22], .028, M.joint));
  p('上臂铆钉列', boltRow(M.chrome, 4, [-.18, .18, .30], [-.18, .92, .30], .026));
  p('前臂铆钉列', boltRow(M.chrome, 4, [-.18, -.96, .30], [-.18, -.22, .30], .026));
  p('腕环上', torus(.25, .045, M.steel, 0, -1.10, 0, P / 2));
  p('腕环下', torus(.23, .04, M.brushed, 0, -1.18, 0, P / 2));
}

function hand(p, M, s) {
  p('掌块', bevelBox(.52, .40, .34, .07, M.darkSteel, 0, 0, 0));
  p('掌背银甲', bevelBox(.46, .30, .10, .035, M.brushed, 0, .06, .18));
  p('拇指根', bevelBox(.16, .24, .16, .04, M.aluminium, s * .30, -.06, .08));
  p('拇指尖', bevelBox(.14, .20, .14, .035, M.chrome, s * .38, -.24, .14));
  for (let k = 0; k < 4; k++) {
    const x = -.20 + k * .13;
    p(`指 ${k + 1} 根节`, bevelBox(.11, .26, .15, .03, M.aluminium, x, -.36, .04));
    p(`指 ${k + 1} 端节`, bevelBox(.10, .20, .14, .03, M.chrome, x, -.58, .08));
  }
  p('指节销左', cyl(.035, .035, .50, M.joint, -.24, -.42, .02, 0, 0, P / 2));
  p('指节销右', cyl(.035, .035, .50, M.joint, .24, -.42, .02, 0, 0, P / 2));
  p('腕部连接环', torus(.22, .045, M.steel, 0, .24, 0, P / 2));
}

function leg(p, M, s) {
  p('蓝色大腿主甲', bevelBox(.66, 1.28, .66, .11, M.bluePaint, 0, .82, .02));
  p('大腿外侧银甲', bevelBox(.14, 1.10, .56, .04, M.brushed, s * .38, .80, 0));
  p('大腿银色纹片', bevelBox(.30, .80, .045, .02, M.chrome, 0, .84, .36));
  p('大腿内骨架', cyl(.15, .15, 1.22, M.steel, 0, .78, -.10));
  p('膝关节球', sphere(.24, M.chrome, 0, .04, .02));
  p('膝关节环', torus(.26, .055, M.darkSteel, 0, .04, .02, 0, P / 2, 0));
  p('膝甲', bevelBox(.62, .34, .28, .07, M.bluePaint, 0, .02, .30));
  p('小腿红色主甲', bevelBox(.68, 1.16, .58, .10, M.redFlame, 0, -.72, .02));
  p('小腿蓝侧甲', bevelBox(.14, 1.04, .50, .04, M.bluePaint, s * .38, -.72, 0));
  p('小腿银骨架', box(.32, 1.08, .34, M.brushed, 0, -.72, -.08));
  p('小腿后甲', bevelBox(.56, .92, .14, .04, M.bluePaint, 0, -.72, -.34));
  p('左液压杆', pipe([-.24, .32, .26], [-.24, -1.16, .26], .045, M.chrome));
  p('右液压杆', pipe([.24, .32, .26], [.24, -1.16, .26], .045, M.chrome));
  p('中央液压杆', pipe([0, .22, -.28], [0, -1.20, -.28], .05, M.brass));
  p('轮侧甲片', bevelBox(.20, .70, .42, .05, M.bluePaint, -s * .46, -.62, -.10));
  p('大腿铆钉列', boltRow(M.chrome, 4, [-.20, .34, .36], [-.20, 1.32, .36], .026));
  p('小腿铆钉列', boltRow(M.chrome, 4, [-.20, -1.20, .32], [-.20, -.24, .32], .026));
  p('膝侧铆钉列', boltRow(M.chrome, 3, [s * .34, -.10, .20], [s * .34, .20, .20], .026));
  p('踝环', torus(.25, .05, M.steel, 0, -1.34, 0, P / 2));
}

function foot(p, M, s) {
  p('脚掌主块', bevelBox(.82, .28, 1.08, .07, M.darkSteel, 0, .04, -.02));
  p('脚背银甲', bevelBox(.70, .16, .70, .05, M.brushed, 0, .20, -.14));
  for (let k = 0; k < 5; k++) {
    p(`分趾 ${k + 1}`, bevelBox(.14, .16, .40, .035, k % 2 ? M.chrome : M.aluminium, -.30 + k * .15, -.02, .60, 0, 0, 0));
  }
  p('左踝环', torus(.22, .05, M.steel, -.28, .18, -.30, 0, P / 2, 0));
  p('右踝环', torus(.22, .05, M.steel, .28, .18, -.30, 0, P / 2, 0));
  p('接地板前', box(.78, .06, .34, M.joint, 0, -.12, .38));
  p('接地板后', box(.78, .06, .34, M.joint, 0, -.12, -.36));
  p('脚侧铆钉列', boltRow(M.chrome, 4, [s * .42, .06, -.36], [s * .42, .06, .36], .026));
  p('脚跟块', bevelBox(.66, .28, .24, .05, M.bluePaint, 0, .08, -.50));
}

function stack(p, M, s) {
  p('烟囱主管', cyl(.15, .17, 1.60, M.chrome, 0, 0, 0, 0, 0, 0, 16));
  for (let k = 0; k < 4; k++) p(`环箍 ${k + 1}`, torus(.165, .028, M.steel, 0, -.54 + k * .36, 0, P / 2));
  p('顶帽', cyl(.19, .15, .12, M.darkSteel, 0, .84, 0, 0, 0, 0, 16));
  p('底座', cyl(.22, .22, .18, M.brushed, 0, -.84, 0, 0, 0, 0, 16));
  p('侧连接件', box(.20, .30, .14, M.steel, s * .20, -.30, 0));
}

function tank(p, M, s) {
  p('银色油箱', cyl(.30, .30, 1.20, M.aluminium, 0, 0, 0, 0, 0, P / 2, 18));
  p('左束带', torus(.305, .032, M.darkSteel, 0, 0, .38, 0, 0, 0));
  p('右束带', torus(.305, .032, M.darkSteel, 0, 0, -.38, 0, 0, 0));
  p('左端盖', sphere(.30, M.chrome, 0, 0, .60, 1, 1, .3));
  p('右端盖', sphere(.30, M.chrome, 0, 0, -.60, 1, 1, .3));
  p('加油阀', cyl(.075, .075, .10, M.brass, .22, .26, 0));
  p('安装支架', bevelBox(.18, .30, .80, .04, M.steel, 0, -.30, 0));
}

function lamp(p, M, s) {
  p('方形灯壳', bevelBox(.44, .34, .22, .04, M.darkSteel, 0, 0, 0));
  p('灯透镜', box(.36, .26, .03, M.lamp, 0, 0, .12));
  p('镀铬灯框', box(.46, .36, .04, M.chrome, 0, 0, .105));
  p('灯支架', cyl(.05, .05, .28, M.steel, 0, -.26, -.06));
  p('侧向小灯', cyl(.055, .055, .04, M.glowWarm, s * .26, 0, .13, P / 2, 0, 0, 10));
}

function fender(p, M, s) {
  p('弧形轮拱', shell(.70, 0, P, .16, P * .36, M.bluePaint, 0, .06, 0, 0, 0, 0, 1, .45, .50));
  p('轮拱前边条', box(.10, .12, .80, M.chrome, s * .68, -.08, .32));
  p('轮拱后边条', box(.10, .12, .80, M.chrome, s * .68, -.08, -.32));
  p('轮拱铆钉前', boltRow(M.chrome, 3, [s * .70, .30, -.26], [s * .70, .30, .26], .026));
  p('轮拱铆钉后', boltRow(M.chrome, 3, [s * .70, -.30, -.26], [s * .70, -.30, .26], .026));
  p('轮拱下沿', box(.14, .06, 1.02, M.darkSteel, s * .62, -.34, 0));
}

/* ---------- 构建入口 ---------- */
export function buildModel() {
  const M = makeMaterials();
  const root = new THREE.Group();
  root.name = 'scene';
  const groups = {};
  let meshCount = 0, partCount = 0;
  for (const a of ASSEMBLIES) {
    const builder = BUILDERS[keyOf(a.id)];
    if (!builder) throw new Error(`缺少构造器: ${a.id} -> ${keyOf(a.id)}`);
    const g = makeAssembly(a.id, a.n, M, builder);
    groups[a.id] = g;
    root.add(g);
    g.traverse((o) => { if (o.isMesh) meshCount += 1; });
    partCount += a.n;
  }
  return { root, groups, materials: M, meshCount, partCount, assemblyCount: ASSEMBLIES.length };
}

/* 灰模 / 系统分色：只替换材质，不改变几何与位姿 */
const SYSTEM_HUES = {
  '躯干': 0x3f6fa8, '胸甲': 0xb5443c, '胸窗': 0x4f89b8, '胸腔': 0x6ba3c9,
  '头雕': 0x8a6fc0, '腹部': 0xc09a52, '肩': 0x4a86b8, '臂': 0x9c5a4a,
  '手': 0x8a8f96, '骨盆': 0x5f7f9a, '腿': 0x4e6fa8, '足': 0x7a8490,
  '轮组': 0x33383e, '烟囱': 0x9aa3ad, '油箱': 0x8e979f, '灯': 0xd8c187,
  '背甲': 0x4a5a80, '轮拱': 0x3f5f9a
};
export function applyMaterialMode(model, mode) {
  if (!model._modeMats) {
    model._modeMats = { grey: model.materials.grey, systems: {} };
    for (const [k, c] of Object.entries(SYSTEM_HUES)) {
      model._modeMats.systems[k] = new THREE.MeshStandardMaterial({ color: c, metalness: .25, roughness: .62 });
    }
  }
  model.root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.origMat) o.userData.origMat = o.material;
    if (mode === 'grey') o.material = model._modeMats.grey;
    else if (mode === 'systems') o.material = model._modeMats.systems[o.userData.systemKey] || o.userData.origMat;
    else o.material = o.userData.origMat;
  });
}
