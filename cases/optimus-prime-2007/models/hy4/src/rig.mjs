/* HY4 · 装配契约（纯数据，无 Three.js 依赖）
 * 坐标：Y 向上，+Z 为车头 / 人形正面。truck / robot 是同一批实体的两组世界位姿。
 * 端点位姿经灰模截图校准：车辆端把肩/臂/手/内构折入车体，人形端按
 * 足 0–0.5 / 膝 2.0 / 髋 3.7 / 胸 5.0–6.7 / 肩 6.3 / 头 6.9–8.5 的层次排布。
 * 所有世界尺寸为程序化设定（guess），不是从影片测得的真实尺寸。
 */
export const ROOT = 'scene';
export const TIMELINE = { duration: 50, fps: 24, transform: [8, 19], movieDuration: 28 };

const T = (p, r = [0, 0, 0], s = 1) => ({ p, r, s });
const R = (p, r = [0, 0, 0], s = 1) => ({ p, r, s });

/* id, system, parent, 双端位姿, 变形错峰窗口, 中段避让弧, 视觉分件数 */
export const ASSEMBLIES = [
  { id: 'cab',        system: '躯干', parent: ROOT,   t: T([0,2.15,0.10]),            r: R([0,5.62,-0.10]),                delay: [.30,.86], arc: [0,.5,0],    n: 14 },
  { id: 'roof',       system: '躯干', parent: 'cab',  t: T([0,3.16,0.05]),            r: R([0,6.52,-0.38]),                delay: [.24,.80], arc: [0,.7,-.3],  n: 8  },
  { id: 'hood',       system: '胸甲', parent: 'cab',  t: T([0,1.78,2.70]),            r: R([0,5.70,0.52],[1.30,0,0],.72),  delay: [.06,.62], arc: [0,1.1,.5],  n: 18 },
  { id: 'chest_l',    system: '胸窗', parent: 'cab',  t: T([-0.63,2.86,1.30],[-.30,-.14,0]), r: R([-1.02,6.18,1.00],[-.26,-.40,-.19]), delay: [.12,.70], arc: [-.5,.7,.8], n: 11 },
  { id: 'chest_r',    system: '胸窗', parent: 'cab',  t: T([ 0.63,2.86,1.30],[-.30, .14,0]), r: R([ 1.02,6.18,1.00],[-.26, .40, .19]), delay: [.12,.70], arc: [ .5,.7,.8], n: 11 },
  { id: 'core',       system: '胸腔', parent: 'cab',  t: T([0,1.90,0.55],[0,0,0],.50), r: R([0,5.68,0.04],[0,0,0],.85),     delay: [.36,.90], arc: [0,.2,.1],   n: 16 },
  { id: 'head',       system: '头雕', parent: 'cab',  t: T([0,2.62,0.20],[0,0,0],.38), r: R([0,7.40,0.14],[0,0,0],1.0),     delay: [.50,.96], arc: [0,.5,.2],   n: 23 },
  { id: 'grille',     system: '腹部', parent: 'cab',  t: T([0,1.72,4.27]),            r: R([0,4.58,0.50],[.16,0,0],.58),   delay: [.00,.55], arc: [0,.8,1.0],  n: 35 },
  { id: 'abdomen',    system: '腹部', parent: 'cab',  t: T([0,1.45,-1.15],[0,0,0],.50), r: R([0,4.72,0.06],[0,0,0],.92),    delay: [.28,.84], arc: [0,.4,-.2],  n: 20 },
  { id: 'shoulder_l', system: '肩',   parent: 'cab',  t: T([-1.18,2.30,-0.35],[0,-1.50,0],.45), r: R([-1.62,6.28,0.02],[0,-.22,.14]), delay: [.20,.78], arc: [-.9,.5,.2], n: 13 },
  { id: 'shoulder_r', system: '肩',   parent: 'cab',  t: T([ 1.18,2.30,-0.35],[0, 1.50,0],.45), r: R([ 1.62,6.28,0.02],[0, .22,-.14]), delay: [.20,.78], arc: [ .9,.5,.2], n: 13 },
  { id: 'arm_l',      system: '臂',   parent: 'shoulder_l', t: T([-1.12,1.25,-1.45],[1.35,0,0],.42), r: R([-2.06,5.22,0.06],[0,0,.06]), delay: [.26,.84], arc: [-1.0,.1,.3], n: 18 },
  { id: 'arm_r',      system: '臂',   parent: 'shoulder_r', t: T([ 1.12,1.25,-1.45],[1.35,0,0],.42), r: R([ 2.06,5.22,0.06],[0,0,-.06]), delay: [.26,.84], arc: [ 1.0,.1,.3], n: 18 },
  { id: 'hand_l',     system: '手',   parent: 'arm_l', t: T([-1.05,0.92,-2.35],[0,0,0],.35), r: R([-2.10,3.96,0.18]),           delay: [.34,.90], arc: [-1.1,-.2,.4], n: 15 },
  { id: 'hand_r',     system: '手',   parent: 'arm_r', t: T([ 1.05,0.92,-2.35],[0,0,0],.35), r: R([ 2.10,3.96,0.18]),           delay: [.34,.90], arc: [ 1.1,-.2,.4], n: 15 },
  { id: 'chassis',    system: '骨盆', parent: ROOT,   t: T([0,1.06,-2.42]),           r: R([0,3.86,-0.50],[.35,0,0],.85),  delay: [.22,.80], arc: [0,.4,-.4],  n: 12 },
  { id: 'hip',        system: '骨盆', parent: 'chassis', t: T([0,1.02,-2.06],[0,0,0],.62), r: R([0,3.72,0.00]),               delay: [.30,.86], arc: [0,.2,-.2],  n: 11 },
  { id: 'bumper',     system: '骨盆', parent: 'chassis', t: T([0,0.86,4.46]),         r: R([0,3.60,0.50],[.12,0,0],.85),   delay: [.04,.58], arc: [0,.6,1.1],  n: 22 },
  { id: 'leg_l',      system: '腿',   parent: 'hip',  t: T([-0.78,1.10,-3.02],[1.30,0,0],.80), r: R([-0.76,2.12,0.02]),        delay: [.16,.82], arc: [-.6,-.3,-.6], n: 19 },
  { id: 'leg_r',      system: '腿',   parent: 'hip',  t: T([ 0.78,1.10,-3.02],[1.30,0,0],.80), r: R([ 0.76,2.12,0.02]),        delay: [.16,.82], arc: [ .6,-.3,-.6], n: 19 },
  { id: 'foot_l',     system: '足',   parent: 'leg_l', t: T([-0.80,0.60,-3.92],[0,0,0],.85), r: R([-0.78,0.20,0.30]),         delay: [.20,.86], arc: [-.5,-.4,-.5], n: 13 },
  { id: 'foot_r',     system: '足',   parent: 'leg_r', t: T([ 0.80,0.60,-3.92],[0,0,0],.85), r: R([ 0.78,0.20,0.30]),         delay: [.20,.86], arc: [ .5,-.4,-.5], n: 13 },
  { id: 'wheel_f_l',  system: '轮组', parent: 'chassis', t: T([-1.30,0.64,2.58],[0,0,Math.PI/2]), r: R([-1.16,4.02,-0.16],[0,0,.30]), delay: [.10,.72], arc: [-.7,.2,.4], n: 12 },
  { id: 'wheel_f_r',  system: '轮组', parent: 'chassis', t: T([ 1.30,0.64,2.58],[0,0,Math.PI/2]), r: R([ 1.16,4.02,-0.16],[0,0,-.30]), delay: [.10,.72], arc: [ .7,.2,.4], n: 12 },
  { id: 'wheel_r_l1', system: '轮组', parent: 'chassis', t: T([-1.30,0.64,-1.86],[0,0,Math.PI/2]), r: R([-1.04,5.20,-0.80],[0,.20,.20]), delay: [.14,.76], arc: [-.8,.3,-.6], n: 12 },
  { id: 'wheel_r_l2', system: '轮组', parent: 'chassis', t: T([-1.30,0.64,-3.10],[0,0,Math.PI/2]), r: R([-0.98,2.20,-0.66],[0,.20,.20]), delay: [.14,.76], arc: [-.8,-.2,-.6], n: 12 },
  { id: 'wheel_r_r1', system: '轮组', parent: 'chassis', t: T([ 1.30,0.64,-1.86],[0,0,Math.PI/2]), r: R([ 1.04,5.20,-0.80],[0,-.20,-.20]), delay: [.14,.76], arc: [ .8,.3,-.6], n: 12 },
  { id: 'wheel_r_r2', system: '轮组', parent: 'chassis', t: T([ 1.30,0.64,-3.10],[0,0,Math.PI/2]), r: R([ 0.98,2.20,-0.66],[0,-.20,-.20]), delay: [.14,.76], arc: [ .8,-.2,-.6], n: 12 },
  { id: 'stack_l',    system: '烟囱', parent: 'cab',  t: T([-0.96,3.10,0.76]),        r: R([-1.08,6.38,-0.86],[0,0,.12]),  delay: [.24,.82], arc: [-.7,.6,-.5], n: 8  },
  { id: 'stack_r',    system: '烟囱', parent: 'cab',  t: T([ 0.96,3.10,0.76]),        r: R([ 1.08,6.38,-0.86],[0,0,-.12]), delay: [.24,.82], arc: [ .7,.6,-.5], n: 8  },
  { id: 'tank_l',     system: '油箱', parent: 'chassis', t: T([-1.26,1.16,-0.62]),     r: R([-1.16,2.46,-0.46],[0,0,.10]),  delay: [.18,.80], arc: [-.6,0,-.3], n: 7  },
  { id: 'tank_r',     system: '油箱', parent: 'chassis', t: T([ 1.26,1.16,-0.62]),     r: R([ 1.16,2.46,-0.46],[0,0,-.10]), delay: [.18,.80], arc: [ .6,0,-.3], n: 7  },
  { id: 'lamp_l',     system: '灯',   parent: 'bumper', t: T([-0.96,1.66,4.30]),      r: R([-0.46,3.74,0.56],[0,0,0],.85), delay: [.06,.60], arc: [-.4,.4,.9],  n: 5  },
  { id: 'lamp_r',     system: '灯',   parent: 'bumper', t: T([ 0.96,1.66,4.30]),      r: R([ 0.46,3.74,0.56],[0,0,0],.85), delay: [.06,.60], arc: [ .4,.4,.9],  n: 5  },
  { id: 'back',       system: '背甲', parent: 'cab',  t: T([0,2.06,-0.86]),           r: R([0,5.60,-0.70]),                delay: [.32,.88], arc: [0,.4,-.7],   n: 9  },
  { id: 'fender_f_l', system: '轮拱', parent: 'chassis', t: T([-1.30,1.02,2.58]),     r: R([-1.50,4.10,-0.22],[0,0,.24]),  delay: [.12,.74], arc: [-.8,.3,.3], n: 6  },
  { id: 'fender_f_r', system: '轮拱', parent: 'chassis', t: T([ 1.30,1.02,2.58]),     r: R([ 1.50,4.10,-0.22],[0,0,-.24]), delay: [.12,.74], arc: [ .8,.3,.3], n: 6  }
];

export const PORTS = {
  head: 'head', torso: 'cab', left_hand: 'hand_l', right_hand: 'hand_r',
  left_foot: 'foot_l', right_foot: 'foot_r'
};

/* 视觉分件身份清单：每个装配下的分件按序编号，ID 稳定且唯一归属。 */
export const PARTS = [];
for (const a of ASSEMBLIES) {
  for (let i = 1; i <= a.n; i++) {
    PARTS.push({ id: `${a.id}-${String(i).padStart(2, '0')}`, assembly: a.id, system: a.system,
                 label: `${a.system} · ${a.id} 分件 ${i}` });
  }
}

export const ASSEMBLY_COUNT = ASSEMBLIES.length;
export const PART_COUNT = PARTS.length;
