// The SB-10 console: an engineering sheet laid over the full-bleed dune (warm paper
// panels, sepia ink) with a burnt-orange accent that matches the foot traces. Fixed 1600 x 900 CSS layout;
// update(state) redraws every live part from the frame's state (the linkage panel is the hero leg's real pose, the
// contact chart the real stance of all 20 feet, the crank dial the real throws), so a captured frame depends only on t.
import {HOLY, PATH, FOOT_MIN, FOOT_MAX} from './jansen.js';
import {S} from './beast.js';

// 支撑相与步幅从脚轨迹算出（不写死）：阈值 0.6 与触地判定一致
const STANCE = (() => {
  let n = 0;
  let minX = 1e9;
  let maxX = -1e9;
  for (const p of PATH) {
    if (p[1] - FOOT_MIN < 0.6) {
      n++;
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
    }
  }
  return {deg: n / 2, strideMM: (maxX - minX) * S * 1000};
})();

// 蓝色系色板：accent=钴蓝（正在工作的部件/激活态），red=天蓝（连杆线），dark=深海蓝。见 ../../风格指南.md
export const C = {ink: '#1a2430', mute: '#7d8fa3', faint: '#ccd8e4', line: 'rgba(100,125,150,.5)', paper: 'rgba(248,250,252,.9)', accent: '#1e5fd6', red: '#3d8fe0', dark: '#24344d'};
export const VIEW_KEYS = ['cine', 'leg', 'front', 'side', 'top'];
export const TOGGLES = ['iso', 'trace'];
// the order the hero leg's labels appear in, and what each one is
export const LABELS = [
  ['a', '枢轴偏移 · X'],
  ['l', '枢轴偏移 · Y'],
  ['m', '曲柄'],
  ['j', '上驱动杆'],
  ['k', '下驱动杆'],
  ['b', '上摇杆'],
  ['c', '下摇杆'],
  ['d', '上三角架'],
  ['e', '上三角架'],
  ['f', '连接杆'],
  ['g', '下三角架'],
  ['h', '胫杆'],
  ['i', '胫撑'],
];
const TABLE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'];
const CSS = `
#app{font-family:Inter,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.paper};border:1px solid ${C.line};backdrop-filter:blur(3px)}
.hd{font-size:9px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;white-space:nowrap}
.hd i{font-style:normal;color:${C.accent};margin-right:7px;letter-spacing:0}
.lb{font-size:8px;font-weight:600;letter-spacing:1.3px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.vl{font-size:10.5px;font-weight:600;letter-spacing:.4px;white-space:nowrap}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.vb{position:absolute;height:19px;padding:0 9px;display:flex;align-items:center;font-size:8.5px;font-weight:700;letter-spacing:1.4px;border:1px solid ${C.line};background:rgba(242,246,250,.92);color:${C.dark}}
.call{position:absolute;white-space:nowrap;background:rgba(242,246,250,.88);border:1px solid ${C.line};padding:4px 7px 4px}
.call b{display:block;font-size:8.5px;font-weight:700;letter-spacing:1.4px}
.call span{display:block;font-size:7.5px;letter-spacing:1.1px;color:${C.mute};margin-top:2px}
.tag{position:absolute;display:flex;align-items:center;gap:5px;white-space:nowrap;transform:translate(-50%,-50%)}
.tag b{width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font:700 10px 'JetBrains Mono',monospace;color:#eef3f8;background:${C.dark};box-shadow:0 0 0 1.5px rgba(238,243,248,.9)}
.tag span{font:600 8.5px 'JetBrains Mono',monospace;color:${C.dark};background:rgba(242,246,250,.88);padding:1px 4px;border:1px solid ${C.line}}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
.ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:1.6px solid ${C.accent};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const SPECS = [
  ['类型', '风力步行机'],
  ['腿', '20 条 · 10 曲柄相位 × 2'],
  ['连杆', '詹森 · 每腿 11 杆'],
  ['长度', '3.1 m'],
  ['高度', '2.3 m（至帆尖）'],
  ['骨架', 'PVC 导管 Ø 28 mm'],
  ['驱动', '10 帆 → 1 根曲轴'],
];
export const WIND_MAX = 16;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };

  // ------------------------------------------------------------ top bar: the sheet's header, views and toggles
  add(`<div style="position:absolute;left:12px;right:12px;top:8px;height:24px;border-bottom:1px solid ${C.line}"></div>`);
  add(`<div class="lb" style="left:18px;top:14px;position:absolute;color:${C.dark}">◇ 海滩运动学实验室 · 风能部</div>`);
  add(`<div class="lb mono" style="position:absolute;left:0;right:0;top:14px;text-align:center;color:${C.dark};letter-spacing:2px">◆ SB-10-001 ◆</div>`);
  const btn = {};
  {
    let x = 1588;
    const right = (key, txt, w) => {
      x -= w;
      btn[key] = add(`<div class="vb" style="left:${x}px;top:10px;width:${w}px;justify-content:center">${txt}</div>`);
      x -= 4;
    };
    right('pause', '❚❚ 暂停', 84);
    x -= 10;
    right('trace', '足迹', 78);
    right('iso', '隔离腿', 88);
    x -= 10;
    const VIEW_LABEL = {cine: '电影', leg: '腿', front: '正面', side: '侧面', top: '顶部'};
    for (const k of [...VIEW_KEYS].reverse()) right(k, VIEW_LABEL[k], [...VIEW_LABEL[k]].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e7f ? 9.8 : 7), 0) + 22);
    add(`<div class="lb" style="position:absolute;left:${x - 34}px;top:15px">视角</div>`);
  }
  add(`<div class="lb" style="position:absolute;right:16px;top:36px;letter-spacing:1px;font-size:7.5px">拖动旋转 · 1-5 视角 · I 隔离 · T 足迹 · 空格暂停</div>`);

  // ------------------------------------------------------------ title block, specs and live readings, top left
  add(`<div style="position:absolute;left:34px;top:50px;font-size:31px;font-weight:500;letter-spacing:.6px;line-height:1">海滩兽 Strandbeest <span style="color:${C.accent}">SB-10</span></div>`);
  add(`<div class="lb" style="position:absolute;left:35px;top:88px;color:${C.dark};font-size:8.5px;letter-spacing:1.6px">风力步行机 · 詹森连杆 · Theo Jansen 1990</div>`);
  add(`<div style="position:absolute;left:35px;top:110px;display:grid;grid-template-columns:96px auto;row-gap:6px">${SPECS.map(([k, v]) => `<span class="lb">${k}:</span><span class="vl">${v}</span>`).join('')}
    <span style="grid-column:1/3;height:1px;background:${C.line};margin:3px 0"></span>
    <span class="lb">风速:</span><span class="vl mono" data-k="wind"></span>
    <span class="lb">曲轴:</span><span class="vl mono" data-k="rpm"></span>
    <span class="lb">地速:</span><span class="vl mono" data-k="speed"></span>
    <span class="lb">触沙脚数:</span><span class="vl mono" data-k="feet"></span></div>`);

  // ------------------------------------------------------------ the holy numbers, left
  const HN = {x: 34, y: 368, w: 262, h: 352};
  add(`<div class="pn" style="left:${HN.x}px;top:${HN.y}px;width:${HN.w}px;height:${HN.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${HN.x + 12}px;top:${HN.y + 11}px"><i>›››</i>十一个神圣数字</div>`);
  add(`<div class="lb" style="position:absolute;left:${HN.x + 12}px;top:${HN.y + 26}px;font-size:7px">连杆长度 · Jansen 1990 · 单位 ≈ 厘米</div>`);
  const rows = {};
  TABLE.forEach((k, i) => {
    const y = HN.y + 46 + i * 21 + (i >= 11 ? 10 : 0);
    rows[k] = add(`<div style="position:absolute;left:${HN.x + 12}px;top:${y}px;width:${HN.w - 24}px;height:19px;display:flex;align-items:center;gap:9px">
      <span class="mono" data-r="dot" style="width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font-size:9.5px;font-weight:700;border:1px solid ${C.line}">${k}</span>
      <span class="mono" data-r="val" style="font-size:11px;font-weight:600;width:38px;text-align:right">${HOLY[k].toFixed(1)}</span>
      <span style="flex:1;height:5px;background:rgba(100,125,150,.14);position:relative"><span data-r="bar" style="position:absolute;left:0;top:0;bottom:0;width:${((HOLY[k] / 66) * 100).toFixed(1)}%;background:${C.faint}"></span></span></div>`);
  });
  add(`<div style="position:absolute;left:${HN.x + 12}px;top:${HN.y + 46 + 11 * 21 + 1}px;width:${HN.w - 24}px;height:0;border-top:1px dashed ${C.line}"></div>`);
  add(`<div class="lb" style="position:absolute;left:${HN.x + 12}px;top:${HN.y + HN.h - 18}px;font-size:7px">l, m · 曲柄与轴偏移</div>`);

  // ------------------------------------------------------------ leg linkage, top right
  const LP = {x: 1300, y: 52, w: 272, h: 398};
  add(`<div class="pn" style="left:${LP.x}px;top:${LP.y}px;width:${LP.w}px;height:${LP.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${LP.x + 12}px;top:${LP.y + 11}px"><i>›››</i>腿连杆 · 01F 腿</div>`);
  const link = add(`<svg style="position:absolute;left:${LP.x + 12}px;top:${LP.y + 30}px" width="248" height="290"></svg>`);
  add(`<div style="position:absolute;left:${LP.x + 12}px;top:${LP.y + 326}px;width:${LP.w - 24}px;display:grid;grid-template-columns:1fr 1fr;row-gap:5px">
    <span class="lb">支撑相</span><span class="vl mono" style="text-align:right">360° 中 ${STANCE.deg.toFixed(0)}°</span>
    <span class="lb">步幅</span><span class="vl mono" style="text-align:right">${STANCE.strideMM.toFixed(0)} mm</span>
    <span class="lb">抬脚高度</span><span class="vl mono" style="text-align:right">${((FOOT_MAX - FOOT_MIN) * S * 1000).toFixed(0)} mm</span>
    <span class="lb">曲轴角</span><span class="vl mono" style="text-align:right" data-k="crank"></span></div>`);

  // ------------------------------------------------------------ wind and drive, right
  const WP = {x: 1300, y: 462, w: 272, h: 258};
  add(`<div class="pn" style="left:${WP.x}px;top:${WP.y}px;width:${WP.w}px;height:${WP.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${WP.x + 12}px;top:${WP.y + 11}px"><i>›››</i>风 · 传动链</div>`);
  const SL = {x: WP.x + 16, y: WP.y + 54, w: WP.w - 32};
  add(`<div class="lb" style="position:absolute;left:${SL.x}px;top:${SL.y - 18}px">风速</div>`);
  const windVal = add(`<div class="vl mono" style="position:absolute;right:${1600 - (SL.x + SL.w)}px;top:${SL.y - 20}px;color:${C.accent}"></div>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y}px;width:${SL.w}px;height:3px;background:rgba(100,125,150,.22)"></div>`);
  const fill = add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y}px;height:3px;background:${C.accent}"></div>`);
  const knob = add(`<div style="position:absolute;top:${SL.y - 6.5}px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#eef3f8;border:1.6px solid ${C.dark}"></div>`);
  add(`<svg style="position:absolute;left:${SL.x}px;top:${SL.y + 8}px" width="${SL.w}" height="14">${[0, 4, 8, 12, 16].map((v) => `<line x1="${(v / WIND_MAX) * SL.w}" x2="${(v / WIND_MAX) * SL.w}" y1="0" y2="4" stroke="${C.dark}" stroke-width=".8"/><text x="${Math.min(SL.w - 8, Math.max(4, (v / WIND_MAX) * SL.w))}" y="12" font-size="6.5" text-anchor="middle" fill="${C.mute}">${v}${v === 16 ? ' m/s' : ''}</text>`).join('')}</svg>`);
  const windHist = add(`<svg style="position:absolute;left:${SL.x}px;top:${SL.y + 34}px" width="${SL.w}" height="58"></svg>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y + 102}px;width:${SL.w}px;display:grid;grid-template-columns:1fr auto;row-gap:5px">
    <span class="lb">帆负载</span><span class="vl mono" data-k="load"></span>
    <span class="lb">曲轴转速</span><span class="vl mono" data-k="rpm2"></span>
    <span class="lb">步 / 分</span><span class="vl mono" data-k="steps"></span>
    <span class="lb">已走距离</span><span class="vl mono" data-k="dist"></span></div>`);

  // ------------------------------------------------------------ bottom strip: contact chart, crankshaft, ride
  const BY = 734;
  const BH = 154;
  add(`<div class="pn" style="left:34px;top:${BY}px;width:960px;height:${BH}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:46px;top:${BY + 11}px"><i>›››</i>脚触地 · 20 腿 · 最近 3 秒</div>`);
  add(`<div class="lb" style="position:absolute;left:760px;top:${BY + 12}px"><span style="display:inline-block;width:14px;height:6px;background:${C.dark};vertical-align:middle;margin-right:6px"></span>触沙 <span style="display:inline-block;width:14px;height:6px;background:${C.accent};vertical-align:middle;margin:0 6px 0 14px"></span>01F 腿</div>`);
  const gait = add(`<svg style="position:absolute;left:46px;top:${BY + 30}px" width="936" height="116"></svg>`);

  add(`<div class="pn" style="left:1002px;top:${BY}px;width:276px;height:${BH}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:1014px;top:${BY + 11}px"><i>›››</i>曲轴 · 10 曲柄</div>`);
  const crank = add(`<svg style="position:absolute;left:1012px;top:${BY + 26}px" width="124" height="124"></svg>`);
  add(`<div style="position:absolute;left:1142px;top:${BY + 34}px;width:126px;display:flex;flex-direction:column;gap:6px">
    <div><div class="lb">相位步进</div><div class="vl mono">36.0°</div></div>
    <div><div class="lb">曲柄半径</div><div class="vl mono">m = 15.0</div></div>
    <div><div class="lb">曲柄 01 在</div><div class="vl mono" data-k="throw"></div></div>
    <div><div class="lb">波动方向</div><div class="vl mono">头 → 尾</div></div></div>`);

  add(`<div class="pn" style="left:1286px;top:${BY}px;width:286px;height:${BH}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:1298px;top:${BY + 11}px"><i>›››</i>车身高 · 抬脚</div>`);
  const ride = add(`<svg style="position:absolute;left:1296px;top:${BY + 28}px" width="268" height="96"></svg>`);
  add(`<div style="position:absolute;left:1298px;top:${BY + 128}px;width:262px;display:flex;justify-content:space-between">
    <span class="lb"><b style="color:${C.accent}">—</b> 01F 脚 <b class="mono" style="color:${C.ink}" data-k="lift"></b></span>
    <span class="lb"><b style="color:${C.ink}">—</b> 机身 <b class="mono" style="color:${C.ink}" data-k="body"></b></span></div>`);

  // ------------------------------------------------------------ overlays: callouts, leg labels, the pointer
  const callG = add(`<div data-callouts style="position:absolute;inset:0"></div>`);
  const callSvg = add(`<svg data-callouts style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const tags = add(`<div data-callouts style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="24" height="24" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111a24" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);

  const K = {};
  for (const n of ui.querySelectorAll('[data-k]')) K[n.dataset.k] = n;
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const knobAt = (w) => [SL.x + (w / WIND_MAX) * SL.w, SL.y + 1.5];
  // the screen areas the panels cover, so a callout never lands under one
  const PANELS = [[1300, 52, 1572, 720], [34, 368, 296, 720], [34, BY, 1572, 888], [30, 44, 330, 340], [1000, 6, 1592, 44]];
  const covered = (x, y) => PANELS.some(([a, b, c, d]) => x > a - 8 && x < c + 8 && y > b - 8 && y < d + 8);

  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  // the linkage panel's frame: Jansen units to panel px, walking to the right like the 3D view of leg 01F
  const LS = 2.4;
  const LX = (u) => 54 - u * LS;
  const LY = (v) => 58 - v * LS;
  const pathD = PATH.filter((_, i) => i % 6 === 0)
    .map(([u, v], i) => `${i ? 'L' : 'M'}${LX(u).toFixed(1)} ${LY(v).toFixed(1)}`)
    .join(' ');
  const LINKS2 = [['A', 'B', 'j'], ['A', 'C', 'k'], ['P', 'B', 'b'], ['P', 'C', 'c'], ['P', 'D', 'd'], ['B', 'D', 'e'], ['D', 'E', 'f'], ['C', 'E', 'g'], ['E', 'F', 'h'], ['C', 'F', 'i'], ['O', 'A', 'm']];

  return {
    spots,
    btn,
    root: ui,
    covered,
    knobAt,
    update(s) {
      // live readings
      K.wind.textContent = `${s.wind.toFixed(1)} m/s`;
      K.rpm.textContent = `${s.rpm.toFixed(1)} rpm`;
      K.speed.textContent = `${s.speed.toFixed(2)} m/s`;
      K.feet.textContent = `${s.feetDown} / 20`;
      K.crank.textContent = `${((((s.crankDeg % 360) + 360) % 360)).toFixed(0).padStart(3, '0')}°`;
      K.load.textContent = `${(s.wind * s.wind * 0.61 * 0.9 * 10 * 0.001).toFixed(2)} kN`;
      K.rpm2.textContent = `${s.rpm.toFixed(1)} rpm`;
      K.steps.textContent = `${(s.rpm * 20).toFixed(0)}`;
      K.dist.textContent = `${s.dist.toFixed(1)} m`;
      K.throw.textContent = `${((((s.crankDeg % 360) + 360) % 360)).toFixed(0).padStart(3, '0')}°`;
      K.lift.textContent = `${s.liftMM.toFixed(0)} mm`;
      K.body.textContent = `±${s.bodyMM.toFixed(1)} mm`;

      // the holy numbers: revealed rows inked, the newest one lit
      for (const k of TABLE) {
        const r = rows[k];
        const st = s.rows[k] || 0; // 0 idle, 1 shown, 2 lit
        const dot = r.querySelector('[data-r=dot]');
        const bar = r.querySelector('[data-r=bar]');
        dot.style.background = st === 2 ? C.accent : st === 1 ? C.dark : 'transparent';
        dot.style.color = st ? '#eef3f8' : C.dark;
        dot.style.borderColor = st ? 'transparent' : C.line;
        bar.style.background = st === 2 ? C.accent : st === 1 ? C.dark : C.faint;
        r.querySelector('[data-r=val]').style.color = st === 2 ? C.accent : C.ink;
      }

      // the linkage panel: the hero leg's live pose, its foot's path, the stance arc, letters on the bars
      {
        const J = s.leg;
        const P2 = (k) => `${LX(J[k][0]).toFixed(1)} ${LY(J[k][1]).toFixed(1)}`;
        let h = `<line x1="0" x2="248" y1="${LY(-91.83 - 2.75)}" y2="${LY(-91.83 - 2.75)}" stroke="${C.dark}" stroke-width=".8"/>`;
        for (let i = 0; i < 31; i++) h += `<line x1="${i * 8}" y1="${LY(-94.6) + 2}" x2="${i * 8 + 5}" y2="${LY(-94.6) + 7}" stroke="${C.faint}" stroke-width=".6"/>`;
        h += `<path d="${pathD} Z" fill="none" stroke="${C.accent}" stroke-width="1.3" stroke-dasharray="3 2" opacity=".85"/>`;
        // dimension lines for a and l
        h += `<g stroke="${C.mute}" stroke-width=".6" fill="none"><path d="M${LX(0)} ${LY(14)} V${LY(4)} M${LX(-38)} ${LY(14)} V${LY(-4)}"/><path d="M${LX(0)} ${LY(11)} H${LX(-38)}" stroke-dasharray="2 2"/><path d="M${LX(-46)} ${LY(0)} H${LX(-40)} M${LX(-46)} ${LY(-7.8)} H${LX(-40)} M${LX(-44)} ${LY(0)} V${LY(-7.8)}"/></g>`;
        h += `<text x="${LX(-19)}" y="${LY(13)}" font-size="8" text-anchor="middle" fill="${C.mute}" font-family="JetBrains Mono">a</text><text x="${LX(-49)}" y="${LY(-4.5)}" font-size="8" text-anchor="middle" fill="${C.mute}" font-family="JetBrains Mono">l</text>`;
        h += `<circle cx="${LX(0)}" cy="${LY(0)}" r="${15 * LS}" fill="none" stroke="${C.faint}" stroke-width=".7" stroke-dasharray="2 2"/>`;
        for (const [a, b, k] of LINKS2) {
          const lit = s.rows[k] === 2;
          h += `<line x1="${LX(J[a][0]).toFixed(1)}" y1="${LY(J[a][1]).toFixed(1)}" x2="${LX(J[b][0]).toFixed(1)}" y2="${LY(J[b][1]).toFixed(1)}" stroke="${lit ? C.accent : k === 'm' ? C.dark : C.ink}" stroke-width="${lit ? 3 : k === 'm' ? 2.6 : 2}" stroke-linecap="round"/>`;
        }
        for (const k of ['O', 'P', 'A', 'B', 'C', 'D', 'E']) h += `<circle cx="${LX(J[k][0]).toFixed(1)}" cy="${LY(J[k][1]).toFixed(1)}" r="${k === 'O' || k === 'P' ? 3.6 : 2.8}" fill="${k === 'O' || k === 'P' ? C.dark : '#f2f6fa'}" stroke="${C.red}" stroke-width="1.4"/>`;
        h += `<path d="M${LX(-8)} ${LY(-3)} l-6 6 h12z" fill="none" stroke="${C.dark}" stroke-width=".8"/><path d="M${LX(-38) - 6} ${LY(-7.8) + 9} h12" stroke="${C.dark}" stroke-width=".8"/>`;
        h += `<ellipse cx="${LX(J.F[0]).toFixed(1)}" cy="${(LY(J.F[1]) + 2).toFixed(1)}" rx="6" ry="3" fill="${C.dark}"/>`;
        h += `<circle cx="${LX(J.F[0]).toFixed(1)}" cy="${LY(J.F[1]).toFixed(1)}" r="4.5" fill="none" stroke="${C.accent}" stroke-width="1.6"/>`;
        for (const [a, b, k] of LINKS2) {
          const mx = (LX(J[a][0]) + LX(J[b][0])) / 2;
          const my = (LY(J[a][1]) + LY(J[b][1])) / 2;
          const lit = s.rows[k] === 2;
          h += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5.6" fill="${lit ? C.accent : '#f2f6fa'}" stroke="${lit ? C.accent : C.line}" stroke-width=".8"/><text x="${mx.toFixed(1)}" y="${(my + 2.6).toFixed(1)}" font-size="7.5" font-weight="700" text-anchor="middle" fill="${lit ? '#eef3f8' : C.dark}" font-family="JetBrains Mono">${k}</text>`;
        }
        h += `<text x="244" y="${LY(-91.83) - 6}" font-size="6.5" text-anchor="end" fill="${C.mute}">行走 →</text>`;
        link.innerHTML = h;
      }

      // wind: the slider, the last 12 s of wind
      {
        const [kx] = knobAt(s.wind);
        knob.style.left = `${kx.toFixed(1)}px`;
        knob.style.transform = `scale(${s.drag ? 1.18 : 1})`;
        knob.style.borderColor = s.drag ? C.accent : C.dark;
        fill.style.width = `${(kx - SL.x).toFixed(1)}px`;
        windVal.textContent = `${s.wind.toFixed(1)} m/s`;
        const W = SL.w;
        let p = '';
        s.windHist.forEach((w, i) => (p += `${i ? 'L' : 'M'}${((i / (s.windHist.length - 1)) * W).toFixed(1)} ${(54 - (w / WIND_MAX) * 50).toFixed(1)}`));
        windHist.innerHTML = `<rect x="0" y="0" width="${W}" height="56" fill="rgba(100,125,150,.08)"/>${[4, 8, 12].map((v) => `<line x1="0" x2="${W}" y1="${54 - (v / WIND_MAX) * 50}" y2="${54 - (v / WIND_MAX) * 50}" stroke="${C.faint}" stroke-width=".5" stroke-dasharray="2 3"/>`).join('')}<path d="${p} L${W} 56 L0 56 Z" fill="rgba(30,95,214,.12)"/><path d="${p}" fill="none" stroke="${C.accent}" stroke-width="1.4"/><text x="2" y="9" font-size="6.5" fill="${C.mute}">最近 12 秒</text>`;
      }

      // contact chart: a row per leg, ink where the foot is on the sand; the wave runs down the rows
      {
        const W = 936;
        const x0 = 46;
        const rowH = 5.2;
        let h = '';
        s.gait.forEach((row, r) => {
          const y = 4 + r * rowH + (r >= 10 ? 4 : 0);
          const hero = r === 0;
          h += `<text x="0" y="${y + 4.4}" font-size="5.6" fill="${C.mute}" font-family="JetBrains Mono">${String((r % 10) + 1).padStart(2, '0')}${r < 10 ? 'F' : 'B'}</text>`;
          for (const [a, b] of row) h += `<rect x="${(x0 + a * (W - x0)).toFixed(1)}" y="${y}" width="${Math.max(0.8, (b - a) * (W - x0)).toFixed(1)}" height="${rowH - 1.4}" fill="${hero ? C.accent : C.dark}" opacity="${hero ? 1 : 0.78}"/>`;
        });
        h += `<line x1="${W}" x2="${W}" y1="0" y2="112" stroke="${C.accent}" stroke-width="1"/><text x="${W - 3}" y="114" font-size="6" text-anchor="end" fill="${C.mute}">此刻</text>`;
        gait.innerHTML = h;
      }

      // crankshaft dial: the ten throws at their real angles, throw 01 lit
      {
        const cx = 62;
        const cy = 62;
        let h = `<circle cx="${cx}" cy="${cy}" r="54" fill="none" stroke="${C.line}" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="8" fill="${C.dark}"/>`;
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          const r1 = i % 6 ? 51 : 47;
          h += `<line x1="${cx + Math.cos(a) * 54}" y1="${cy + Math.sin(a) * 54}" x2="${cx + Math.cos(a) * r1}" y2="${cy + Math.sin(a) * r1}" stroke="${C.mute}" stroke-width=".5"/>`;
        }
        s.throws.forEach((a, i) => {
          const x = cx + Math.cos(-a) * 38;
          const y = cy + Math.sin(-a) * 38;
          const lit = i === 0;
          h += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${lit ? C.accent : C.dark}" stroke-width="${lit ? 2.2 : 1.1}" opacity="${lit ? 1 : 0.55}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${lit ? 6.5 : 5.5}" fill="${lit ? C.accent : '#f2f6fa'}" stroke="${lit ? C.accent : C.dark}" stroke-width=".8"/><text x="${x.toFixed(1)}" y="${(y + 2.3).toFixed(1)}" font-size="6.2" font-weight="700" text-anchor="middle" fill="${lit ? '#eef3f8' : C.dark}" font-family="JetBrains Mono">${i + 1}</text>`;
        });
        crank.innerHTML = h;
      }

      // ride: the foot's lift against the body's height over the last 4 s, on the same scale
      {
        const W = 268;
        const Y = (mm) => 82 - (mm / 300) * 74;
        let pf = '';
        let pb = '';
        s.liftHist.forEach((v, i) => (pf += `${i ? 'L' : 'M'}${((i / (s.liftHist.length - 1)) * W).toFixed(1)} ${Y(v).toFixed(1)}`));
        s.bodyHist.forEach((v, i) => (pb += `${i ? 'L' : 'M'}${((i / (s.bodyHist.length - 1)) * W).toFixed(1)} ${(Y(150) - v * 0.6).toFixed(1)}`));
        ride.innerHTML = `${[0, 100, 200, 300].map((v) => `<line x1="18" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.faint}" stroke-width=".5" stroke-dasharray="2 3"/><text x="0" y="${Y(v) + 2}" font-size="6" fill="${C.mute}" font-family="JetBrains Mono">${v}</text>`).join('')}<path d="${pf}" fill="none" stroke="${C.accent}" stroke-width="1.5" transform="translate(18 0) scale(${(W - 18) / W} 1)"/><path d="${pb}" fill="none" stroke="${C.ink}" stroke-width="1.5" transform="translate(18 0) scale(${(W - 18) / W} 1)"/><text x="${W}" y="${Y(150) - 5}" font-size="6" text-anchor="end" fill="${C.mute}">机身基准</text>`;
      }

      // views and toggles
      for (const k of VIEW_KEYS) {
        const v = s.viewOn[k] || 0;
        btn[k].style.background = v > 0.5 ? C.dark : 'rgba(242,246,250,.92)';
        btn[k].style.color = v > 0.5 ? '#f2f6fa' : C.dark;
      }
      for (const k of TOGGLES) {
        const on = s[k] > 0.5;
        btn[k].style.background = on ? C.accent : 'rgba(242,246,250,.92)';
        btn[k].style.color = on ? '#eef3f8' : C.dark;
        btn[k].style.borderColor = on ? C.accent : C.line;
      }

      // callouts over the beast, and the hero leg's letters
      let ch = '';
      let lh = '';
      for (const c of s.callouts) {
        if (c.o < 0.02) continue;
        const [ax, ay] = c.at;
        const lx = ax + c.dx;
        const ly = ay + c.dy;
        lh += `<g opacity="${c.o.toFixed(2)}"><polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${(lx + (c.dx < 0 ? -26 : 26)).toFixed(1)},${ly.toFixed(1)}" fill="none" stroke="${C.dark}" stroke-width=".8"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.2" fill="${C.accent}"/></g>`;
        ch += `<div class="call" style="left:${(lx + (c.dx < 0 ? -30 : 30)).toFixed(1)}px;top:${(ly - 8).toFixed(1)}px;opacity:${c.o.toFixed(2)};transform:translateX(${c.dx < 0 ? '-100%' : '0'});text-align:${c.dx < 0 ? 'right' : 'left'}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      for (const d of s.dims) {
        if (d.o < 0.02) continue;
        lh += `<line x1="${d.a[0].toFixed(1)}" y1="${d.a[1].toFixed(1)}" x2="${d.b[0].toFixed(1)}" y2="${d.b[1].toFixed(1)}" stroke="${C.dark}" stroke-width="1" stroke-dasharray="4 3" opacity="${d.o.toFixed(2)}"/>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      let th = '';
      for (const g of s.tags) {
        if (g.o < 0.02) continue;
        th += `<div class="tag" style="left:${g.at[0].toFixed(1)}px;top:${g.at[1].toFixed(1)}px;opacity:${g.o.toFixed(2)}"><b style="${g.lit ? `background:${C.accent}` : ''};transform:scale(${(0.7 + 0.3 * Math.min(1, g.o * 1.5)).toFixed(2)})">${g.k}</b>${g.lit ? `<span>${HOLY[g.k].toFixed(1)}</span>` : ''}</div>`;
      }
      tags.innerHTML = th;
      pointer(s.cursor);
    },
    pointer,
  };
}
