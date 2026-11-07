// console.js —— HY4 独立直出版中文控制台。
// 版式为本版自主设计：顶部状态条 / 左侧竖列仪表 / 右侧罗盘与八臂雷达 / 底部贯穿式节拍大字。
// 刻意不使用既有实现的左右白底卡片阵列。每个数字都来自 model.js 的 stateAt(t)。
import {DURATION, PULSE_HZ, SHOTS, jetPulse, trace, structure, armLoad} from './model.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
const $ = (root, id) => root.querySelector('#' + id);
const f1 = (x) => Number(x).toFixed(1);
const f2 = (x) => Number(x).toFixed(2);
const pad = (n) => String(n).padStart(2, '0');

const FOCUS = {
  jet:     [['siphon', '虹吸主喷口'], ['hub', '中央轮毂']],
  optics:  [['optics', '82 mm 光学阵列'], ['brain', '线缆脑核']],
  mantle:  [['mantle', '八瓣外套膜'], ['brain', '泵核 / 脑核']],
  arm:     [['hub', 'R2 腕根节点'], ['optics', '前部光学']],
  siphon:  [['siphon', '三层伸缩套筒'], ['hub', '轮毂']],
  hub:     [['hub', '中央轮毂'], ['mantle', '外套膜']],
  beak:    [['beak', '双颚 + 齿舌环'], ['optics', '光学阵列']],
  all:     [['mantle', '外套膜'], ['optics', '光学'], ['siphon', '虹吸'],
            ['beak', '喙'], ['brain', '泵核'], ['hub', '轮毂']],
};

const SUBSYS = ['光学', '外套膜', '泵核', '臂链', '虹吸', '颚部'];

export function createConsole(layer, {mode = 'live', onCommand = () => {}} = {}) {
  const S = structure();
  layer.innerHTML = `
    <div class="bar-top">
      <div class="brand">
        <div class="mark">OC</div>
        <div><div class="t1">PELAGOS OC-8</div><div class="t2">机械章鱼 · 水下推进实验平台</div></div>
      </div>
      <div class="shots" id="shots"></div>
      <div class="status-r">
        <div class="tc" id="tc">00:00.00 <small>/ 00:25.00</small></div>
        <div class="pill" id="pill">系统正常 · 直出版</div>
      </div>
    </div>

    <div class="panel col-l" style="top:100px;height:396px">
      <h3>喷射压力 <em>kPa</em></h3><div class="hr"></div>
      <div class="big" id="pVal">0.0<span>kPa</span></div>
      <div class="sub" id="pLine">推力 0 N · 相位 0.00</div>
      <svg class="chart" id="gauge" viewBox="0 0 330 170" style="height:106px"></svg>
      <svg class="chart" id="spark" viewBox="0 0 330 74" style="height:74px"></svg>
    </div>

    <div class="panel col-l" style="top:508px;height:388px">
      <h3>电源与姿态 <em>实时遥测</em></h3><div class="hr"></div>
      <div class="kv"><span>电池电量</span><b id="vBat">0<span>%</span></b></div>
      <div class="kv"><span>单体电压</span><b id="vCell">0<span>V</span></b></div>
      <div class="kv"><span>舱内温度</span><b id="vTemp">0<span>°C</span></b></div>
      <div class="kv"><span>下潜深度</span><b id="vDepth">0<span>m</span></b></div>
      <div class="kv"><span>巡航速度</span><b id="vSpeed">0<span>m/s</span></b></div>
      <div class="sub ok" id="vNote" style="margin-top:8px">供能正常 · 8 腕链路在线</div>
    </div>

    <div class="panel col-r" style="top:100px;height:236px">
      <h3>航向罗盘 <em>俯仰 / 横滚</em></h3><div class="hr"></div>
      <svg class="chart" id="compass" viewBox="0 0 330 132" style="height:118px"></svg>
      <div class="sub" id="vAtt" style="margin-top:2px">俯仰 0° · 横滚 0°</div>
    </div>

    <div class="panel col-r" style="top:344px;height:232px">
      <h3>八臂负载 <em>雷达 0–100%</em></h3><div class="hr"></div>
      <svg class="chart" id="radar" viewBox="0 0 330 168" style="height:150px"></svg>
    </div>

    <div class="panel col-r" style="top:582px;height:322px">
      <h3>子系统状态 <em>6 组</em></h3><div class="hr"></div>
      <div class="rows" id="subs"></div>
      <div class="sub" id="struct" style="margin-top:8px"></div>
    </div>

    <div class="bar-bot">
      <div class="beat-line">
        <div class="beat-no" id="bNo">01</div>
        <div class="beat-name" id="bName">喷射进场</div>
        <div class="beat-note" id="bNote">八腕收拢 · 主喷口全开</div>
        <div class="beat-pct" id="bPct">0 %</div>
      </div>
      <div class="timeline" id="timeline"><div class="tl-track"><div class="tl-fill" id="tlFill"></div></div>
        <div class="tl-head" id="tlHead"></div></div>
    </div>

    <svg id="leads"></svg>
    <div class="controls pe" id="controls">
      <div class="btn" data-cmd="play" id="btnPlay">暂停巡览</div>
      <div class="btn" data-cmd="assembly" id="btnAsm">装配体分解</div>
      <div class="btn" data-cmd="display" id="btnDisp">隐藏界面</div>
      <div class="btn" data-cmd="reset" id="btnRst">回到起点</div>
    </div>
  `;

  // ---- 顶部 10 拍刻度 ----
  const shots = $(layer, 'shots');
  const ticks = SHOTS.map((s, i) => {
    const d = document.createElement('div');
    d.className = 'shot-tick'; d.textContent = pad(i + 1);
    d.title = s.name; shots.append(d); return d;
  });

  // ---- 时间轴 10 段 ----
  const timeline = $(layer, 'timeline');
  const segs = SHOTS.map((s, i) => {
    const d = document.createElement('div');
    d.className = 'tl-seg'; d.textContent = pad(i + 1);
    d.style.left = (44 + (1840 * s.at) / DURATION) + 'px';
    timeline.append(d); return d;
  });

  // ---- 子系统行 ----
  const subsEl = $(layer, 'subs');
  const subs = SUBSYS.map((name) => {
    const r = document.createElement('div');
    r.className = 'row';
    r.innerHTML = `<span class="nm">${name}</span><span class="track"><span class="fill" style="display:block;width:0"></span></span><span class="vl">0%</span>`;
    subsEl.append(r);
    return {fill: r.querySelector('.fill'), val: r.querySelector('.vl')};
  });
  $(layer, 'struct').innerHTML = `<div style="font-size:25px">${S.links} 节 / ${S.wheels} 轮 / ${S.rivets} 钉</div>`;

  // ---- 压力表半圆刻度（圆心在 y=160，整条弧落在 viewBox 内）----
  const gauge = $(layer, 'gauge');
  const ARC = 'M 18 160 A 147 147 0 0 1 312 160';
  const gBg = svg('path', {d: ARC, fill: 'none', stroke: 'rgba(120,170,240,.20)',
    'stroke-width': 14, 'stroke-linecap': 'round'});
  gauge.append(gBg);
  const gVal = svg('path', {d: ARC, fill: 'none', stroke: '#4a86e8',
    'stroke-width': 14, 'stroke-linecap': 'round'});
  gauge.append(gVal);
  const G_LEN = gBg.getTotalLength ? gBg.getTotalLength() : Math.PI * 147;
  gVal.setAttribute('stroke-dasharray', G_LEN);
  gVal.setAttribute('stroke-dashoffset', G_LEN);
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI - (k / 10) * Math.PI;
    const x1 = 165 + Math.cos(a) * 132, y1 = 160 - Math.sin(a) * 132;
    const x2 = 165 + Math.cos(a) * 121, y2 = 160 - Math.sin(a) * 121;
    gauge.append(svg('line', {x1, y1, x2, y2, stroke: k % 5 === 0 ? '#8ab4ff' : 'rgba(140,185,245,.42)', 'stroke-width': k % 5 === 0 ? 3 : 2}));
  }
  const gTxt = svg('text', {x: 165, y: 150, 'text-anchor': 'middle', fill: '#cfe2ff', 'font-size': 26});
  gTxt.textContent = '0 — 76 kPa'; gauge.append(gTxt);

  // ---- 压力曲线 ----
  const spark = $(layer, 'spark');
  spark.append(svg('rect', {x: 0, y: 0, width: 330, height: 74, fill: 'rgba(15,82,186,.10)', rx: 6}));
  for (let k = 1; k < 4; k++) spark.append(svg('line', {x1: 0, y1: k * 18.5, x2: 330, y2: k * 18.5,
    stroke: 'rgba(120,170,240,.18)', 'stroke-width': 1}));
  const sparkPath = svg('path', {d: '', fill: 'none', stroke: '#8ab4ff', 'stroke-width': 3,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round'});
  const sparkArea = svg('path', {d: '', fill: 'rgba(74,134,232,.20)', stroke: 'none'});
  spark.append(sparkArea, sparkPath);

  // ---- 罗盘 ----
  const compass = $(layer, 'compass');
  compass.append(svg('circle', {cx: 165, cy: 66, r: 56, fill: 'rgba(15,82,186,.10)',
    stroke: 'rgba(120,170,240,.55)', 'stroke-width': 2}));
  compass.append(svg('circle', {cx: 165, cy: 66, r: 44, fill: 'none',
    stroke: 'rgba(120,170,240,.30)', 'stroke-width': 1, 'stroke-dasharray': '3 6'}));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const r0 = k % 6 === 0 ? 48 : 52;
    compass.append(svg('line', {
      x1: 165 + Math.sin(a) * r0, y1: 66 - Math.cos(a) * r0,
      x2: 165 + Math.sin(a) * 56, y2: 66 - Math.cos(a) * 56,
      stroke: k % 6 === 0 ? '#8ab4ff' : 'rgba(140,185,245,.45)', 'stroke-width': k % 6 === 0 ? 3 : 1.5,
    }));
  }
  const cRing = svg('g', {}); compass.append(cRing);
  const cNeedle = svg('path', {d: 'M 165 20 L 171 66 L 165 78 L 159 66 Z', fill: '#4a86e8', stroke: '#cfe2ff', 'stroke-width': 1.5});
  cRing.append(cNeedle);
  compass.append(svg('circle', {cx: 165, cy: 66, r: 5, fill: '#0f52ba', stroke: '#cfe2ff', 'stroke-width': 2}));
  const cTxt = svg('text', {x: 165, y: 122, 'text-anchor': 'middle', fill: '#9fc0ef', 'font-size': 24});
  compass.append(cTxt);

  // ---- 八臂雷达 ----
  const radar = $(layer, 'radar');
  const CX = 165, CY = 78, RR = 52;
  for (let k = 1; k <= 4; k++) radar.append(svg('circle', {cx: CX, cy: CY, r: (RR * k) / 4,
    fill: 'none', stroke: 'rgba(120,170,240,.22)', 'stroke-width': 1.5}));
  const spokes = [];
  for (let i = 0; i < S.arms; i++) {
    const a = (i / S.arms) * Math.PI * 2 - Math.PI / 2;
    const x = CX + Math.cos(a) * RR, y = CY + Math.sin(a) * RR;
    radar.append(svg('line', {x1: CX, y1: CY, x2: x, y2: y, stroke: 'rgba(120,170,240,.28)', 'stroke-width': 1.5}));
    const t = svg('text', {x: CX + Math.cos(a) * (RR + 14), y: CY + Math.sin(a) * (RR + 14) + 8,
      'text-anchor': 'middle', fill: '#9fc0ef', 'font-size': 22});
    t.textContent = 'R' + (i + 1); radar.append(t);
    spokes.push({a, dot: svg('circle', {cx: CX, cy: CY, r: 3.5, fill: '#8ab4ff'})});
  }
  const radarPoly = svg('polygon', {points: '', fill: 'rgba(15,82,186,.36)', stroke: '#8ab4ff', 'stroke-width': 2.5});
  radar.append(radarPoly);
  spokes.forEach((s) => radar.append(s.dot));

  // ---- 3D 引线 ----
  const leads = $(layer, 'leads');
  const leadItems = Array.from({length: 6}, () => {
    const line = svg('line', {stroke: 'rgba(74,134,232,.85)', 'stroke-width': 2, 'stroke-dasharray': '6 4'});
    const dot = svg('circle', {r: 5, fill: '#8ab4ff', stroke: '#0f52ba', 'stroke-width': 2});
    leads.append(line, dot);
    const box = document.createElement('div');
    box.className = 'lead-label hidden'; layer.append(box);
    return {line, dot, box};
  });

  // ---- 控制按钮 ----
  const controls = $(layer, 'controls');
  if (mode === 'film') controls.classList.add('hidden');
  controls.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (b) onCommand(b.dataset.cmd, b);
  });

  let hudVisible = true;
  function setHudVisible(v) { hudVisible = v; layer.style.opacity = v ? '1' : '0'; }
  function setPlaying(v) { const b = $(layer, 'btnPlay'); if (b) b.textContent = v ? '暂停巡览' : '继续巡览'; }

  function update(st, points = {}) {
    const T = st.telemetry, sh = st.shot, s = sh.shot, i = sh.index;
    ticks.forEach((d, k) => { d.className = 'shot-tick' + (k === i ? ' on' : k < i ? ' past' : ''); });
    segs.forEach((d, k) => { d.className = 'tl-seg' + (k === i ? ' on' : ''); });

    const mm = Math.floor(st.t / 60), ss = Math.floor(st.t % 60), cs = Math.floor((st.t % 1) * 100);
    $(layer, 'tc').innerHTML = `${pad(mm)}:${pad(ss)}.${pad(cs)} <small>/ 00:25.00</small>`;
    $(layer, 'pill').textContent = T.explode > 0.15 ? '拆解展示 · 直出版' : '系统正常 · 直出版';

    $(layer, 'pVal').innerHTML = `${f1(T.pressure)}<span>kPa</span>`;
    gVal.setAttribute('stroke-dashoffset', G_LEN * (1 - Math.min(1, T.pressure / 76)));
    $(layer, 'pLine').textContent = `推力 ${Math.round(T.thrust)} N · 功率 ${f1(T.power)} W`;
    const tr = trace(jetPulse, st.t, 56, 2.2);
    let d = '', pts = [];
    for (let k = 0; k < tr.length; k++) {
      const x = (k / (tr.length - 1)) * 330, y = 68 - tr[k] * 58;
      pts.push([x, y]); d += (k ? 'L' : 'M') + f1(x) + ' ' + f1(y);
    }
    sparkPath.setAttribute('d', d);
    sparkArea.setAttribute('d', d + `L330 74 L0 74 Z`);

    $(layer, 'vBat').innerHTML = `${f1(T.battery)}<span>%</span>`;
    $(layer, 'vCell').innerHTML = `${f2(T.cell)}<span>V</span>`;
    $(layer, 'vTemp').innerHTML = `${f1(T.temp)}<span>°C</span>`;
    $(layer, 'vDepth').innerHTML = `${f2(T.depth)}<span>m</span>`;
    $(layer, 'vSpeed').innerHTML = `${f2(T.speed)}<span>m/s</span>`;
    $(layer, 'vNote').textContent = T.explode > 0.15 ? '总成分离中 · 液压锁定' : `供能正常 · 喷射 ${f1(PULSE_HZ)} Hz`;

    cRing.setAttribute('transform', `rotate(${f1(T.roll * 4)} 165 66)`);
    $(layer, 'vAtt').textContent = `俯仰 ${f1(T.pitch)}° · 横滚 ${f1(T.roll)}°`;
    cTxt.textContent = `航向 ${f1(st.turret * 57.3)}° · 相位 ${f2(T.phase)}`;

    let poly = '';
    spokes.forEach((sp, k) => {
      const load = armLoad(k, st.t);
      const r = 12 + load * (RR - 12);
      const x = CX + Math.cos(sp.a) * r, y = CY + Math.sin(sp.a) * r;
      poly += `${f1(x)},${f1(y)} `;
      sp.dot.setAttribute('cx', f1(x)); sp.dot.setAttribute('cy', f1(y));
    });
    radarPoly.setAttribute('points', poly.trim());

    subs.forEach((r, k) => {
      const load = armLoad(k, st.t) * 0.55 + 0.45 + 0.05 * Math.sin(st.t + k);
      const v = Math.min(1, Math.max(0, load));
      r.fill.style.width = (v * 100).toFixed(0) + '%';
      r.val.textContent = Math.round(v * 100) + '%';
    });

    $(layer, 'bNo').textContent = pad(i + 1);
    $(layer, 'bName').textContent = s.name;
    $(layer, 'bNote').textContent = s.note;
    $(layer, 'bPct').textContent = Math.round((st.t / DURATION) * 100) + ' %';
    const w = (st.t / DURATION) * 1852;
    $(layer, 'tlFill').style.width = w + 'px';
    $(layer, 'tlHead').style.left = (44 + w) + 'px';

    // 引线：只标当前拍的焦点总成，避免遮挡机器
    const labels = FOCUS[s.focus] || FOCUS.hub;
    const vis = [];
    for (const item of labels) {
      const p = points[item[0]];
      if (p && p.visible) vis.push({item, p});
    }
    vis.sort((a, b) => a.p.y - b.p.y);
    let prevY = -1e9;
    vis.forEach((v, k) => {
      const it = leadItems[k], p = v.p;
      // 标注按纵向强制拉开，避免拆解拍里六条引线叠成一团
      const lx = Math.min(1500, p.x + 58);
      const ly = Math.min(1010, Math.max(prevY + 54, Math.max(130, p.y - 18)));
      prevY = ly;
      it.box.classList.remove('hidden');
      it.box.style.left = lx + 'px'; it.box.style.top = ly + 'px';
      it.box.textContent = v.item[1];
      it.line.setAttribute('opacity', 1); it.dot.setAttribute('opacity', 1);
      it.line.setAttribute('x1', p.x); it.line.setAttribute('y1', p.y);
      it.line.setAttribute('x2', lx); it.line.setAttribute('y2', ly);
      it.dot.setAttribute('cx', p.x); it.dot.setAttribute('cy', p.y);
    });
    for (let k = vis.length; k < leadItems.length; k++) {
      const it = leadItems[k];
      it.box.classList.add('hidden');
      it.line.setAttribute('opacity', 0); it.dot.setAttribute('opacity', 0);
    }
  }

  return {update, setHudVisible, setPlaying, get hudVisible() { return hudVisible; }};
}
