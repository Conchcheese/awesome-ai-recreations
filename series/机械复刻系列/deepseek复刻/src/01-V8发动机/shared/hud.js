// ============================================================================
// 01 · V8 发动机 — 控制台（HUD）
// 版式照原作 teardown v8 的 1600×900 布局 ×1.2（1920×1080 原生坐标），
// 组件与配色复用 kit 设计系统（宝石紫），所有读数由 shared/model.js 逐帧计算。
// ============================================================================
import {createChart, createButtons, h, esc, pauseIcon, playIcon} from '../../kit/hud.js';
import {
  E, CYL, HUDFMT, RPM, firingOrder, PIN_LABELS, PIN_PHASE,
  pvLoopSamples, valveTimingSamples, CHARGE_LABELS,
} from './model.js';

export const PLAYBACK_STEPS = [1 / 60, 1 / 40, 1 / 20, 1 / 10, 1 / 5, 1 / 2, 1];
export const playText = (p) => (p >= 1 ? '1× 速度' : `1 / ${Math.round(1 / p)} 速度`);

const C = {
  accent: 'var(--accent)',
  hi: 'var(--accent-hi)',
  deep: 'var(--accent-deep)',
  soft: 'var(--accent-soft)',
  fg: 'var(--fg)',
  dim: 'var(--dim)',
  mute: 'var(--mute)',
  line: 'var(--line)',
  in: '#AEB9C9',
  comp: '#5E6470',
  fire: '#7C3AED',
  exh: '#B3AEBB',
  piston: '#7C7590',
};

const D2R = Math.PI / 180;

/* ---------------------------------------------------------------- SVG 片段 */
const svg = (w, hgt, body) => `<svg width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}" fill="none">${body}</svg>`;

/** 曲柄滑块机构线稿 */
function sliderCrankSvg(afterTDC) {
  const cx = 62;
  const cy = 76;
  const r = 20;
  const Lr = 68;
  const a = afterTDC * D2R;
  const px = cx + r * Math.cos(a);
  const py = cy - r * Math.sin(a);
  const sx = cx + r * Math.cos(a) + Math.sqrt(Lr * Lr - (r * Math.sin(a)) ** 2);
  const ink = '#1b1428';
  let g = `<line x1="${cx}" y1="${cy}" x2="${(cx + Lr + r + 8).toFixed(1)}" y2="${cy}" stroke="${C.line}" stroke-dasharray="2 3"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${r + 16}" stroke="${C.line}"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${C.line}" stroke-dasharray="2 2"/>`;
  g += `<line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${C.accent}" stroke-width="2.2"/>`;
  g += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${sx.toFixed(1)}" y2="${cy}" stroke="${ink}" stroke-width="1.3"/>`;
  g += `<rect x="${(sx - 10).toFixed(1)}" y="${cy - 30}" width="20" height="60" fill="#fff" stroke="${ink}" stroke-width="1.7"/>`;
  g += `<line x1="${(cx + Lr - r + 14).toFixed(1)}" x2="266" y1="${cy - 32}" y2="${cy - 32}" stroke="${ink}"/>`;
  g += `<line x1="${(cx + Lr - r + 14).toFixed(1)}" x2="266" y1="${cy + 32}" y2="${cy + 32}" stroke="${ink}"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="3.6" fill="#fff" stroke="${ink}" stroke-width="1.6"/>`;
  g += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.6" fill="#fff" stroke="${ink}" stroke-width="1.6"/>`;
  g += `<circle cx="${sx.toFixed(1)}" cy="${cy}" r="3.2" fill="#fff" stroke="${ink}" stroke-width="1.5"/>`;
  g += `<text x="${(cx + px) / 2 + 3}" y="${(cy + py) / 2 - 4}" font-size="9.5" fill="${C.dim}">r</text>`;
  g += `<text x="${(px + sx) / 2 - 2}" y="${cy - 7}" font-size="9.5" fill="${C.dim}">L</text>`;
  // 行程标注
  g += `<line x1="${cx + Lr - r}" x2="${cx + Lr + r}" y1="116" y2="116" stroke="${ink}" stroke-width=".9"/>`;
  g += `<line x1="${cx + Lr - r}" x2="${cx + Lr - r}" y1="110" y2="122" stroke="${ink}" stroke-width=".9"/>`;
  g += `<line x1="${cx + Lr + r}" x2="${cx + Lr + r}" y1="110" y2="122" stroke="${ink}" stroke-width=".9"/>`;
  g += `<text x="${cx + Lr + r + 8}" y="120" font-size="9.5" letter-spacing="1.2" fill="${C.mute}">行程 ${HUDFMT.strokeMm} 毫米</text>`;
  return svg(268, 130, g);
}

/** 十字曲轴正视图 */
function crossPlaneSvg(theta, trackedPin, firingPin) {
  const cx = 120;
  const cy = 74;
  const R = 40;
  const ink = '#1b1428';
  let g = `<circle cx="${cx}" cy="${cy}" r="44" stroke="${C.line}"/>`;
  // 两列（R / L bank）示意矩形
  for (const sgn of [-1, 1]) {
    const a = (-90 + sgn * 45) * D2R;
    const bx = cx + Math.cos(a) * 74;
    const by = cy + Math.sin(a) * 74;
    g += `<line x1="${cx}" y1="${cy}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${C.soft}" stroke-dasharray="3 3"/>`;
    g += `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${sgn * 45})"><rect x="-10" y="-12" width="20" height="16" fill="#fff" stroke="${ink}" stroke-width="1.4"/><line x1="-6" x2="6" y1="-1" y2="-1" stroke="${ink}" stroke-width="1.2"/></g>`;
  }
  PIN_PHASE.forEach((ph, p) => {
    const a = (theta + ph) * D2R;
    const x = cx + Math.sin(a) * R;
    const y = cy - Math.cos(a) * R;
    const lit = p === trackedPin;
    const fire = p === firingPin && !lit;
    g += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${ink}" stroke-width=".9"/>`;
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="${lit ? C.accent : '#fff'}" stroke="${lit ? C.accent : fire ? C.hi : ink}" stroke-width="${lit || fire ? 2 : 1.3}"/>`;
    g += `<text x="${x.toFixed(1)}" y="${(y + 3.2).toFixed(1)}" font-size="7.6" text-anchor="middle" font-weight="${lit ? 700 : 600}" fill="${lit ? '#fff' : ink}">${PIN_LABELS[p]}</text>`;
  });
  g += `<circle cx="${cx}" cy="${cy}" r="6.4" fill="#fff" stroke="${ink}" stroke-width="1.3"/>`;
  g += `<line x1="${cx - 4}" x2="${cx + 4}" y1="${cy - 4}" y2="${cy + 4}" stroke="${ink}"/>`;
  g += `<line x1="${cx - 4}" x2="${cx + 4}" y1="${cy + 4}" y2="${cy - 4}" stroke="${ink}"/>`;
  g += `<text x="${cx - 14}" y="${cy - 30}" font-size="8.4" fill="${C.mute}">90°</text>`;
  return svg(268, 138, g);
}

/* ---------------------------------------------------------------- 主入口 */
export function createV8Hud({hud, on = {}}) {
  hud.topbar.style.display = 'none';
  hud.addDeco({
    arcs: false,
    crosses: false,
    labels: [
      {text: 'V8 · 90° · CROSS-PLANE', x: 372, y: 148},
      {text: '5.8 L · DOHC 2V', x: 1372, y: 148, dim: true},
    ],
  });
  // 原作式的大弧线（一条巨大的淡弧 + 一条虚线圆），只作背景
  const decoNS = 'http://www.w3.org/2000/svg';
  const decoSvg = document.createElementNS(decoNS, 'svg');
  decoSvg.setAttribute('viewBox', '0 0 1920 1080');
  decoSvg.setAttribute('width', '1920');
  decoSvg.setAttribute('height', '1080');
  decoSvg.innerHTML = `<path d="M 380 1180 A 980 980 0 0 1 1740 -120" stroke="rgba(124,58,237,0.055)" stroke-width="1.2" fill="none"/>
    <circle cx="1180" cy="620" r="470" stroke="rgba(74,45,132,0.075)" stroke-width="1" stroke-dasharray="2 8" fill="none"/>
    <circle cx="1600" cy="210" r="3.2" fill="rgba(124,58,237,0.18)"/>
    <path d="M 332 690 h 12 M 338 684 v 12 M 1560 800 h 12 M 1566 794 v 12" stroke="rgba(74,45,132,0.18)" stroke-width="1"/>`;
  hud.deco.append(decoSvg);
  hud.setFoot({left: '', right: ''});

  const root = hud.frame;
  const add = (html, style = '') => {
    const el = h('div', '', html);
    el.style.cssText = style;
    root.append(el);
    return el;
  };

  /* -------------------------------------------------- 标题块 */
  add(`<div class="v8-bar"></div>`, 'position:absolute;left:42px;top:38px;width:52px;height:4px;background:var(--accent);border-radius:1px');
  add(
    `<h1 class="v8-title">V8 发动机 <span class="slash">·</span> 四冲程</h1>`,
    'position:absolute;left:42px;top:50px',
  );
  add(`<div class="v8-sub">${esc(`90° 十字曲轴 · 点火顺序 ${HUDFMT.firingOrderText} · ${HUDFMT.displacementL} L`)}</div>`, 'position:absolute;left:43px;top:92px');

  /* -------------------------------------------------- 转速表 */
  add(`<div class="v8-rpm" id="v8rpm">700</div>`, 'position:absolute;left:38px;top:112px');
  add(`<div class="v8-rpm-max">${RPM.max}</div>`, 'position:absolute;left:338px;top:164px;transform:translateX(-100%)');
  add(`<div class="v8-bracket"></div>`, 'position:absolute;left:42px;top:198px;width:296px;height:8px');
  add(`<div class="v8-track"><div class="v8-fill" id="v8rpmfill" style="width:6%"></div></div>`, 'position:absolute;left:42px;top:210px;width:296px');
  add(`<div class="v8-min">0</div>`, 'position:absolute;left:42px;top:224px');
  add(`<div class="v8-unit">转速 R/MIN</div>`, 'position:absolute;left:338px;top:224px;transform:translateX(-100%)');
  add(`<div class="v8-hr" style="left:42px;top:246px;width:296px"></div>`, 'position:absolute');
  add(`<div class="v8-crank">曲轴</div>`, 'position:absolute;left:42px;top:254px');

  /* -------------------------------------------------- 顶部图例 + 巡览条 */
  const legend = add(
    CHARGE_LABELS.map(
      (n, i) =>
        `<span class="v8-leg"><i style="background:${[C.in, C.comp, C.fire, C.exh][i]}"></i>${esc(n)}</span>`,
    ).join(''),
    'position:absolute;left:50%;top:35px;transform:translateX(-50%);display:flex;gap:22px;align-items:center;white-space:nowrap',
  );
  legend.classList.add('v8-legend');
  const chip = add(
    `<span class="v8-chip"><i></i><b id="v8chiptext">自动巡览 · 点击接管</b></span>`,
    'position:absolute;left:50%;top:66px;transform:translateX(-50%)',
  );
  chip.style.pointerEvents = 'auto';
  chip.style.cursor = 'pointer';
  chip.addEventListener('click', () => on.resumeTour && on.resumeTour());

  /* -------------------------------------------------- 左：曲柄滑块机构 */
  const p1 = hud.addPanel({x: 42, y: 329, w: 296, h: 250, n: '01', title: '曲柄滑块机构', right: '<span class="v8-badge" id="v8ang">247° 上止点后</span>'});
  const scEl = h('div', 'v8-svg');
  p1.body.append(scEl);
  const scFoot = h('div', 'v8-formula');
  scFoot.innerHTML = `<div>s = r·cos φ + √(L² − r² sin²φ)</div><div>r <b>${HUDFMT.rCm}</b> cm &nbsp;·&nbsp; L <b>${HUDFMT.rodCm}</b> cm</div>`;
  p1.body.append(scFoot);

  /* -------------------------------------------------- 左：十字曲轴 */
  const p2 = hud.addPanel({x: 42, y: 588, w: 296, h: 230, n: '02', title: '十字曲轴', right: '<span class="v8-badge">正视图</span>'});
  const cpEl = h('div', 'v8-svg');
  p2.body.append(cpEl);
  const cpFoot = h('div', 'v8-hint2', `曲柄销互成 90° · 两列夹角 ±45°<br><span>右列 / 左列 · 点火顺序 ${HUDFMT.firingOrderText}</span>`);
  p2.body.append(cpFoot);

  /* -------------------------------------------------- 左下：播放控制 */
  const trans = h('div', 'panel v8-transpanel');
  hud.add(trans, {x: 42, y: 929, w: 311, h: 133});
  trans.innerHTML = `<div class="v8-tbtnrow">
      <button class="btn v8-pause" id="v8pause" type="button"><i class="v8-pico">${pauseIcon()}</i><span>暂停</span></button>
      <button class="btn" id="v8back" type="button">−15°</button>
      <button class="btn" id="v8fwd" type="button">+15°</button>
    </div>
    <div class="v8-trow"><span class="v8-tlab">发动机转速</span><span class="v8-tval" id="v8rpmv">700 RPM</span></div>
    <input class="v8range" id="v8rpmrange" type="range" min="0" max="8000" step="50" value="700">
    <div class="v8-trow"><span class="v8-tlab">回放</span><span class="v8-tval" id="v8playv">1 / 20 速度</span></div>
    <input class="v8range" id="v8playrange" type="range" min="0" max="${PLAYBACK_STEPS.length - 1}" step="1" value="2">`;
  const pauseBtn = trans.querySelector('#v8pause');
  const rpmRange = trans.querySelector('#v8rpmrange');
  const playRange = trans.querySelector('#v8playrange');
  pauseBtn.addEventListener('click', () => on.togglePause && on.togglePause());
  trans.querySelector('#v8back').addEventListener('click', () => on.stepDeg && on.stepDeg(-15));
  trans.querySelector('#v8fwd').addEventListener('click', () => on.stepDeg && on.stepDeg(15));
  let rpmDrag = false;
  rpmRange.addEventListener('pointerdown', () => (rpmDrag = true));
  rpmRange.addEventListener('pointerup', () => (rpmDrag = false));
  rpmRange.addEventListener('input', () => on.setRpm && on.setRpm(Number(rpmRange.value)));
  playRange.addEventListener('input', () => on.setPlay && on.setPlay(Number(playRange.value)));

  /* -------------------------------------------------- 右上：气缸 */
  const p3 = hud.addPanel({x: 1582, y: 43, w: 294, h: 251, n: '03', title: '气缸 1', right: '<span class="v8-badge" id="v8cylAng">607° 曲轴角</span>'});
  p3.body.innerHTML = `<div class="v8-stroke" id="v8stroke">压缩</div>
    <div class="v8-strokes" id="v8strokes"></div>
    <div class="v8-hr"></div>
    <div class="v8-pressrow"><div class="v8-press" id="v8press">1.3</div><div class="v8-pressu">bar<br><span>缸内压力</span></div></div>
    <div class="v8-track sm"><div class="v8-fill" id="v8pressfill" style="width:2%"></div></div>`;
  const strokeEl = p3.body.querySelector('#v8stroke');
  const strokesEl = p3.body.querySelector('#v8strokes');
  const strokeRows = ['intake', 'compression', 'power', 'exhaust'].map((k) => {
    const row = h('div', 'v8-stroke-row');
    row.innerHTML = `<i></i><span>${esc({intake: '进气', compression: '压缩', power: '做功', exhaust: '排气'}[k])}</span>`;
    strokesEl.append(row);
    return {k, row};
  });
  const pressEl = p3.body.querySelector('#v8press');
  const pressFill = p3.body.querySelector('#v8pressfill');

  /* -------------------------------------------------- 右中：气门正时 */
  const p4 = hud.addPanel({x: 1582, y: 302, w: 294, h: 221, n: '04', title: '气门正时', right: '<span class="v8-badge">拖动查看</span>'});
  p4.body.innerHTML = `<div class="v8-vt-legend" id="v8vtlegend"></div>
    <div class="v8-vt-seg"><span>做功</span><span>排气</span><span>进气</span><span>压缩</span></div>
    <div id="v8vtchart"></div>
    <div class="v8-axis"><span>点火后曲轴角（°）</span><span class="v8-vt-state" id="v8vtstate">—</span></div>`;
  const vtLegend = p4.body.querySelector('#v8vtlegend');
  const vtChart = createChart({w: 266, h: 120, pad: {l: 15, r: 6, t: 7, b: 14}, xRange: [0, 720], yRange: [0, 100], grid: 2, font: '7.5px "JetBrains Mono", monospace'});
  p4.body.querySelector('#v8vtchart').append(vtChart.el);
  const vts = valveTimingSamples(4);
  const vtSeries = [
    {pts: vts.map((s) => [s.psi, s.pistonPct]), color: C.piston, width: 1.2},
    {pts: vts.map((s) => [s.psi, s.liftInN * 100]), color: C.in, width: 1.5},
    {pts: vts.map((s) => [s.psi, s.liftExN * 100]), color: C.comp, width: 1.5},
  ];

  /* -------------------------------------------------- 右下：示功图 */
  const p5 = hud.addPanel({x: 1582, y: 532, w: 294, h: 180, n: '05', title: '示功图', right: '<span class="v8-badge" id="v8idcyl">缸 1</span>'});
  p5.body.innerHTML = `<div id="v8idchart"></div>
    <div class="v8-axis"><span>bar</span><span>容积 ×VC（√ 标度）· 1 → ${E.cr}</span></div>`;
  const pvX = (v) => Math.sqrt(Math.max(0, v - 1)); // 容积 √ 标度：点火尖峰+膨胀段铺满面板
  const idChart = createChart({w: 266, h: 118, pad: {l: 15, r: 8, t: 9, b: 16}, xRange: [0, pvX(E.cr)], yRange: [0, 52], grid: 2, font: '7.5px "JetBrains Mono", monospace'});
  p5.body.querySelector('#v8idchart').append(idChart.el);
  const pv = pvLoopSamples(1, 3);
  const idLoop = {pts: pv.map((s) => [pvX(s.v), s.p]), color: '#4C1D95', width: 1.7};
  // 膨胀段下方的淡紫填充（点火尖峰 → 膨胀）
  const idFill = {pts: pv.filter((p) => p.psi <= 200).map((p) => [pvX(p.v), p.p]), area: 'rgba(124,58,237,0.10)'};

  /* -------------------------------------------------- 右下：视角 / 剖切 / 图层 */
  const ctrl = h('div', 'panel v8-ctrlpanel');
  hud.add(ctrl, {x: 1555, y: 864, w: 322, h: 198});
  const group = (label, keys, labels) => {
    const g = h('div', 'v8-group');
    g.append(h('div', 'v8-glab', esc(label)));
    const btns = createButtons(keys.map((k) => ({key: k, label: labels[k], on: false})), (item) => on[(label === '视角' ? 'setView' : label === '剖切' ? 'setCut' : 'toggleOverlay')]?.(item.key));
    g.append(btns.el);
    ctrl.append(g);
    return btns;
  };
  const CAM_KEYS = ['hero', 'front', 'side', 'valley', 'cyl'];
  const CAM_LABELS = {hero: '主机位', front: '正面', side: '侧面', valley: '气门室', cyl: '气缸'};
  const CUT_KEYS = ['glass', 'section', 'solid'];
  const CUT_LABELS = {glass: '玻璃', section: '剖面', solid: '实体'};
  const OV_KEYS = ['callouts', 'charge', 'arrows', 'isolate', 'refract', 'charts'];
  const OV_LABELS = {callouts: '标注', charge: '混合气', arrows: '箭头', isolate: '隔离', refract: '折射', charts: '图表'};
  const btnsView = group('视角', CAM_KEYS, CAM_LABELS);
  const btnsCut = group('剖切', CUT_KEYS, CUT_LABELS);
  const btnsOv = group('图层', OV_KEYS, OV_LABELS);

  /* -------------------------------------------------- 底部中央：点火顺序 */
  const foWrap = add('', 'position:absolute;left:50%;top:936px;transform:translateX(-50%);width:620px;text-align:center;pointer-events:none');
  foWrap.innerHTML = `<div class="v8-fo-h"><b>点火顺序</b><span>— 点击跟踪气缸</span></div>
    <svg id="v8fosvg" width="560" height="42" viewBox="0 0 560 42" style="display:block;margin:1px auto 0;pointer-events:auto"></svg>
    <div class="v8-fo-n">曲轴每转 90° 完成一次做功冲程</div>
    <div class="v8-fo-hint">拖拽环绕 · 滚轮缩放 · H 隐藏界面</div>`;
  const foSvg = foWrap.querySelector('#v8fosvg');
  const NS = 'http://www.w3.org/2000/svg';
  const foNodes = firingOrder.map((c, i) => {
    const x = 26 + i * 72;
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', 21);
    circle.setAttribute('r', 13);
    circle.setAttribute('fill', '#fff');
    circle.setAttribute('stroke', 'var(--line)');
    circle.setAttribute('stroke-width', '1.2');
    circle.style.cursor = 'pointer';
    circle.style.pointerEvents = 'auto';
    circle.addEventListener('click', () => on.setCyl && on.setCyl(c));
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', 25);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '11');
    text.setAttribute('font-weight', '600');
    text.setAttribute('fill', 'var(--fg)');
    text.style.pointerEvents = 'none';
    text.textContent = String(c);
    if (i) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', x - 59);
      line.setAttribute('x2', x - 27);
      line.setAttribute('y1', 21);
      line.setAttribute('y2', 21);
      line.setAttribute('stroke', 'var(--line)');
      foSvg.append(line);
    }
    foSvg.append(circle, text);
    return {c, circle, text};
  });
  const foRing = document.createElementNS(NS, 'circle');
  foRing.setAttribute('cy', 21);
  foRing.setAttribute('r', 17);
  foRing.setAttribute('fill', 'none');
  foRing.setAttribute('stroke', 'var(--accent)');
  foRing.setAttribute('stroke-width', '1.2');
  foSvg.append(foRing);

  /* -------------------------------------------------- 每帧刷新 */
  const setText = (el, v) => {
    if (el._v !== v) {
      el._v = v;
      el.textContent = v;
    }
  };

  function update(s, ui) {
    // 转速表
    setText(document.getElementById('v8rpm'), String(Math.round(s.rpm)));
    document.getElementById('v8rpmfill').style.width = `${(Math.min(1, s.rpm / RPM.max) * 296).toFixed(1)}px`;
    setText(document.getElementById('v8rpmv'), `${Math.round(s.rpm)} RPM`);
    setText(document.getElementById('v8playv'), ui.playText);
    pauseBtn.innerHTML = ui.paused ? `<i class="v8-pico">${playIcon()}</i><span>播放</span>` : `<i class="v8-pico">${pauseIcon()}</i><span>暂停</span>`;
    btnsView.set(CAM_KEYS.indexOf(ui.view));
    btnsCut.set(CUT_KEYS.indexOf(ui.cut));
    OV_KEYS.forEach((k, i) => btnsOv.els[i].classList.toggle('on', !!ui.overlays[k]));
    if (!rpmDrag && document.activeElement !== rpmRange) rpmRange.value = String(Math.round(s.rpm / 50) * 50);
    playRange.value = String(ui.playIndex);
    document.getElementById('v8chiptext').textContent = ui.auto ? '自动巡览 · 点击接管' : '▶ 继续巡览';
    chip.firstElementChild && chip.firstElementChild.classList.toggle('on', !!ui.auto);

    // 曲柄滑块
    setText(document.getElementById('v8ang'), `${Math.round(s.afterTDC)}° 上止点后`);
    scEl.innerHTML = sliderCrankSvg(s.afterTDC);
    // 十字曲轴
    const pinOf = (cylNo) => CYL[cylNo - 1].pin;
    cpEl.innerHTML = crossPlaneSvg(s.theta, pinOf(s.cyl), pinOf(s.firing));
    // 气缸面板
    p3.head.querySelector('.t').textContent = `气缸 ${s.cyl}`;
    setText(document.getElementById('v8cylAng'), `${Math.round(s.psi)}° 曲轴角`);
    setText(strokeEl, s.strokeCN);
    strokeEl.classList.toggle('on', s.strokeKey === 'power');
    strokeRows.forEach(({k, row}) => {
      const on = k === s.strokeKey;
      row.classList.toggle('on', on);
      row.querySelector('i').style.background = on ? C.accent : 'var(--line)';
      row.querySelector('span').style.color = on ? 'var(--fg)' : 'var(--mute)';
    });
    setText(pressEl, s.pressure < 10 ? s.pressure.toFixed(1) : String(Math.round(s.pressure)));
    pressFill.style.width = `${Math.min(1, s.pressure / 60) * 100}%`;
    // 气门正时
    vtLegend.innerHTML = `<span><i style="background:${C.piston}"></i>活塞 <b>${Math.round(s.pistonPct)}</b> %</span>
      <span><i style="background:${C.in}"></i>进 <b>${s.liftIn.toFixed(2)}</b></span>
      <span><i style="background:${C.comp}"></i>排 <b>${s.liftEx.toFixed(2)}</b></span>`;
    const vtState = s.liftIn > 0.25 && s.liftEx > 0.25 ? '气门重叠' : s.liftEx > 0.25 ? `排气门 ${s.liftEx.toFixed(1)} mm` : s.liftIn > 0.25 ? `进气门 ${s.liftIn.toFixed(1)} mm` : s.psi < 8 || s.psi > 712 ? '点火上止点' : s.psi > 540 ? '压缩冲程' : '两气门关闭';
    const vtStateEl = document.getElementById('v8vtstate');
    if (vtStateEl) setText(vtStateEl, vtState);
    const segIdx = Math.floor(s.psi / 180);
    const segEls = p4.body.querySelectorAll('.v8-vt-seg span');
    segEls.forEach((el, i) => el.classList.toggle('on', i === segIdx));
    vtChart.draw({
      series: [
        ...vtSeries,
        {pts: [[segIdx * 180, 0], [segIdx * 180, 100], [segIdx * 180 + 180, 100], [segIdx * 180 + 180, 0]], area: 'rgba(124,58,237,0.075)'},
      ],
      marks: [{x: s.psi, color: 'rgba(124,58,237,0.55)', dash: [2, 3]}],
      dots: [
        {x: s.psi, y: s.pistonPct, color: C.piston, r: 2.2},
        {x: s.psi, y: s.liftInN * 100, color: C.in, r: 2.2, halo: 'rgba(167,139,250,.35)'},
        {x: s.psi, y: s.liftExN * 100, color: C.comp, r: 2.2},
      ],
      xLabels: [{x: 0, text: '0', align: 'left'}, {x: 180, text: '180'}, {x: 360, text: '360'}, {x: 540, text: '540'}, {x: 720, text: '720', align: 'right'}],
      yLabels: [{y: 0, text: '0'}, {y: 50, text: '50'}, {y: 100, text: '100'}],
    });
    // 示功图
    setText(document.getElementById('v8idcyl'), `缸 ${s.cyl}`);
    idChart.draw({
      series: [idFill, idLoop],
      dots: [{x: pvX(s.volume), y: s.pressure, color: '#7C3AED', r: 2.8, halo: 'rgba(124,58,237,.28)'}],
      xLabels: [
        {x: pvX(1), text: '上止点', align: 'left'},
        {x: pvX(2), text: '2'}, {x: pvX(4.1), text: '4'},
        {x: pvX(E.cr), text: `下止点 ${E.cr}`, align: 'right'},
      ],
      yLabels: [{y: 0, text: '0'}, {y: 25, text: '25'}, {y: 50, text: '50'}],
      marks: [{x: pvX(1.05), color: 'rgba(124,58,237,.25)', dash: [2, 3], label: '点火', labelColor: 'rgba(27,20,40,.45)'}],
    });
    // 点火顺序
    foNodes.forEach(({c, circle, text}) => {
      const tracked = c === s.cyl;
      const firing = c === s.firing;
      circle.setAttribute('fill', tracked ? 'var(--accent)' : firing ? 'rgba(124,58,237,.16)' : '#fff');
      circle.setAttribute('stroke', tracked || firing ? 'var(--accent)' : 'var(--line)');
      circle.setAttribute('stroke-width', tracked ? '1.8' : firing ? '1.6' : '1.2');
      text.setAttribute('fill', tracked ? '#fff' : 'var(--fg)');
      if (tracked) {
        foRing.setAttribute('cx', circle.getAttribute('cx'));
        foRing.style.display = '';
      }
    });
    if (!foNodes.some((n) => n.c === s.cyl)) foRing.style.display = 'none';
    // 图表图层
    p4.el.style.visibility = ui.showCharts ? '' : 'hidden';
    p5.el.style.visibility = ui.showCharts ? '' : 'hidden';
  }

  return {
    update,
    root,
    refs: {
      viewBtns: btnsView.els,
      cutBtns: btnsCut.els,
      ovBtns: btnsOv.els,
      firingNodes: foNodes.map((n) => n.circle),
      rpmRange,
      playRange,
      pauseBtn,
      chip,
    },
    playTextOf: playText,
  };
}
