// 00 机械章鱼 OC-8 · 中文 HUD：顶栏 / 喷射负载 / 01–03 左列 / 04–07 右列 / 08 操作日志 / 节拍大字。
// 版式照原作 1920×1080；所有读数由共享 model.js 与每帧 state 传入，HUD 只做格式化。
import {createChart, createCompass, createBars, createButtons, createOpsPanel, pill, h, esc} from '../../../../../../shared/mechanical/hy-derived-kit/hud.js';
import {timecode, clamp, fmt, fmtSigned} from '../../../../../../shared/mechanical/hy-derived-kit/util.js';
import {BEATS, PULSE_HZ, DURATION} from './model.js';

const OCTO_ICON = `<svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
  <circle cx="22" cy="15" r="8.2" fill="currentColor"/>
  <path d="M13.8 22.5c-2.6 5.4-3.4 9.6-1.2 12.4M18.6 24c-1 5.6-.4 9.8 1.9 12.2M22.2 24.4c0 5.8.9 9.8 3.2 12M26.2 23.4c1.6 5 3.4 8.6 6 10.8M30.6 21c2.4 4 3.6 7.2 3.2 10.2"
    stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
  <circle cx="18.4" cy="13.2" r="1.7" fill="#0f52ba"/>
  <circle cx="25.6" cy="13.2" r="1.7" fill="#0f52ba"/>
</svg>`;

const SUBSYS = [
  ['01', '光学阵列', '2 × 82 mm 镜头 · 红外环'],
  ['02', '外套膜', '8 瓣 · 玻璃舷窗'],
  ['03', '泵核', '反应环 · 7 活塞'],
  ['04', '臂链', '202 节 · 480 轮'],
  ['05', '虹吸', '3 套筒 · 6 瓣喷口'],
  ['06', '喙', '双颚 · 齿舌环'],
];

const pad = (n) => String(Math.floor(n)).padStart(2, '0');
const sign = (v, d) => (v >= 0 ? '+' : '') + v.toFixed(d);

export function buildConsole(hud, {mode = 'live', onAssembly, onDisplay, onSeek, onToggle} = {}) {
  /* ---------------------------------------------------------------- 顶栏 */
  hud.setBrand({
    code: 'OC-8',
    icon: OCTO_ICON,
    kicker: '机器人头足类 · 八臂水下无人机',
    title: 'Pelagos OC-8 <span class="slash">/</span>',
    subtitle: '软臂机械手 / 现场模拟器',
  });

  hud.setMeta([
    {k: '模拟编号', v: 'OC8-0731', mono: true},
    {k: '运行时间', v: '00:00', mono: true, id: 'clock'},
    {k: '状态', v: '', status: {text: '喷射中', ok: true, live: true}},
    {k: '操作员', v: '二号水槽 · M.S.', dim: true},
  ]);
  const clockEl = hud.topmeta.querySelector('[data-id="clock"]');
  const statusV = hud.topmeta.querySelector('.metacol:nth-child(3) .rowline span:last-child');
  const statusDot = hud.topmeta.querySelector('.metacol:nth-child(3) .dot');

  /* ---------------------------------------------------------------- 喷射负载 */
  {
    const jl = h('div', 'jetload');
    const segs = [];
    for (let i = 0; i < 40; i++) segs.push('<i class="seg"></i>');
    jl.innerHTML = `<div class="jl-head"><span>喷射负载</span><b data-id="loadpct">100%</b></div>
      <div class="segs">${segs.join('')}</div>
      <div class="jl-foot"><span>待机</span><span>巡航</span><span>爆发</span></div>`;
    hud.add(jl, {x: 690, y: 14, w: 430});
    jl.querySelectorAll('.seg').forEach((s) => (s.style.cssText = 'flex:1;background:rgba(15,82,186,.10);border-radius:1px'));
    hud._jl = jl;
    hud._loadpct = jl.querySelector('[data-id="loadpct"]');
    hud._segs = [...jl.querySelectorAll('.seg')];
  }

  /* ---------------------------------------------------------------- 01 喷射 */
  const jetChart = createChart({
    w: 294, h: 112, pad: {l: 4, r: 36, t: 8, b: 16},
    xRange: [-1.2, 0], yRange: [0, 100], grid: 2,
  });
  const p1 = hud.addPanel({x: 24, y: 118, w: 322, h: 292, n: '01', title: '喷射'});
  {
    const body = p1.body;
    body.insertAdjacentHTML('beforeend', `
      <div class="readout">
        <div><div class="big"><span data-id="kpa">93</span><span class="u">kPa</span></div><div class="lab" style="margin-top:7px">外套膜压力</div></div>
        <div class="rightstat"><div class="v"><span data-id="n">211</span><span class="u">N</span></div><div class="lab" style="margin-top:7px">推力</div></div>
      </div>
      <div style="margin-top:8px" data-id="chartbox"></div>
      <div class="chartfoot" style="margin-top:2px"><span>脉冲 <b data-id="hz">1.8</b> Hz</span><span class="accent" data-id="siphon">虹吸待机</span></div>`);
    body.querySelector('[data-id="chartbox"]').appendChild(jetChart.el);
  }
  const q = (id) => p1.body.querySelector(`[data-id="${id}"]`);

  /* ---------------------------------------------------------------- 02 电源 */
  const p2 = hud.addPanel({x: 24, y: 430, w: 322, h: 210, n: '02', title: '电源'});
  {
    const cells = [];
    for (let i = 0; i < 13; i++) cells.push('<i></i>');
    p2.body.insertAdjacentHTML('beforeend', `
      <div class="readout" style="margin-top:2px">
        <div><div class="big"><span data-id="batt">87</span><span class="u">%</span></div><div class="lab" style="margin-top:7px">电量</div></div>
        <div class="rightstat" style="padding-bottom:2px"><div class="lab">电芯 <b style="color:var(--fg)" data-id="cell">3.72</b> V</div></div>
      </div>
      <div class="cells" data-id="cells">${cells.join('')}</div>
      <div class="kvrow" style="margin-top:16px">
        <div class="kv"><div class="k">功耗</div><div class="v"><span data-id="draw">18.1</span><span class="u">W</span></div></div>
        <div class="kv"><div class="k">电芯</div><div class="v"><span data-id="cell2">3.72</span><span class="u">V</span></div></div>
        <div class="kv"><div class="k">电机</div><div class="v"><span data-id="motor">25</span><span class="u">°C</span></div></div>
      </div>`);
    p2._cells = [...p2.body.querySelectorAll('.cells i')];
  }

  /* ---------------------------------------------------------------- 03 臂弯曲 */
  const curlBars = createBars(Array.from({length: 8}, (_, i) => ({label: i < 4 ? `R${i + 1}` : `L${i - 3}`})));
  const p3 = hud.addPanel({x: 24, y: 646, w: 322, h: 302, n: '03', title: '臂弯曲', right: pill('弯曲中', 'hot')});
  {
    p3.body.insertAdjacentHTML('beforeend', `<div class="lab" style="letter-spacing:.14em;margin:2px 0 6px">每臂弯曲 · 顶端螺旋</div>`);
    p3.body.appendChild(curlBars.el);
  }
  const curlBadge = p3.head.querySelector('.badge');

  /* ---------------------------------------------------------------- 04 深度 */
  const comp = createCompass({size: 104});
  const p4 = hud.addPanel({x: 1548, y: 118, w: 348, h: 262, n: '04', title: '深度'});
  {
    p4.body.insertAdjacentHTML('beforeend', `
      <div class="depthgrid">
        <div class="compassbox" data-id="comp"></div>
        <div class="depthrows">
          <div class="depthrow"><span class="k">深度</span><span class="v"><span data-id="depth">12.40</span><span class="u">m</span></span></div>
          <div class="depthrow"><span class="k">垂速</span><span class="v"><span data-id="vs">+0.00</span><span class="u">m/s</span></span></div>
          <div class="depthrow"><span class="k">俯仰</span><span class="v"><span data-id="pitch">-1.5</span><span class="u">°</span></span></div>
          <div class="depthrow"><span class="k">横滚</span><span class="v"><span data-id="roll">-0.9</span><span class="u">°</span></span></div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="depthfoot"><span>保持 <b data-id="hold">关</b> · 站位</span><span>速度 <b data-id="speed">0.08</b><span class="u">m/s</span></span></div>`);
    p4.body.querySelector('[data-id="comp"]').appendChild(comp.el);
  }

  /* ---------------------------------------------------------------- 05 装配体 */
  const ASM = [
    {key: 'hero', label: '主视角'},
    {key: 'optics', label: '光学'},
    {key: 'mantle', label: '外套膜'},
    {key: 'arm2', label: 'R2 臂'},
    {key: 'siphon', label: '虹吸'},
    {key: 'beak', label: '喙'},
  ];
  const asmBtns = createButtons(ASM, (it) => onAssembly && onAssembly(it.key), 'asm');
  const p5 = hud.addPanel({x: 1548, y: 400, w: 348, h: 122, n: '05', title: '装配体', body: asmBtns.el});
  void p5;

  /* ---------------------------------------------------------------- 06 显示 */
  const DISP = [
    {key: 'labels', label: '标注', toggle: true, on: true},
    {key: 'exploded', label: '拆解', toggle: true},
    {key: 'wake', label: '喷射尾流', toggle: true},
    {key: 'turntable', label: '转台', toggle: true},
  ];
  const dispBtns = createButtons(DISP, (it) => onDisplay && onDisplay(it.key, it.on), 'disp');
  const p6 = hud.addPanel({x: 1548, y: 536, w: 348, h: 140, n: '06', title: '显示', body: dispBtns.el});
  void p6;

  /* ---------------------------------------------------------------- 07 子系统 */
  const p7 = hud.addPanel({x: 1548, y: 676, w: 348, h: 352, n: '07', title: '子系统'});
  {
    p7.body.insertAdjacentHTML('beforeend', `<div class="subsys">${SUBSYS.map(([n, nm, spec], i) => `
      <div class="subrow">
        <span class="n">${n}</span>
        <div><span class="nm">${nm}</span><span class="spec">${spec}</span></div>
        <span class="pill ok" data-id="sp${i}">正常</span>
      </div>`).join('')}</div>`);
  }
  const subPills = SUBSYS.map((_, i) => p7.body.querySelector(`[data-id="sp${i}"]`));

  /* ---------------------------------------------------------------- 08 操作日志 */
  const ops = createOpsPanel({
    duration: DURATION,
    beats: BEATS.map((b) => ({t: b.t, major: b.key === 'jet' || b.key === 'mantle' || b.key === 'teardown'})),
    onSeek: (t) => onSeek && onSeek(t),
    onToggle: () => onToggle && onToggle(),
  });
  hud.frame.append(ops.el);
  if (mode === 'film') ops.playButton.style.display = 'none';

  /* ---------------------------------------------------------------- 装饰 / 页脚 */
  hud.addDeco({
    labels: [
      {text: '型号 OC-8 · 修订 B', x: 452, y: 150},
      {text: '隔离 · 主视角', x: 1360, y: 150, dim: true},
    ],
  });
  hud.setFoot({
    left: '现场模拟器 · 程序化模型 · 8 臂 · 2 光学 · 1 虹吸',
    right: 'PELAGOS 海洋机器人 · 深海实验室 ///////',
  });

  const jl = hud._jl;
  const loadPct = hud._loadpct;
  const segs = hud._segs;

  let lastSiphonFlow = null;
  let lastBadge = '';

  function update(d) {
    const {t, beat, tm, pressure, thrustN, load, chart, curls, siphonFlowing, playing, actions, isolate, display, subs, status, auto} = d;

    clockEl.textContent = timecode(t);
    if (d.statusText) statusV.textContent = d.statusText;
    else if (beat) statusV.textContent = beat.status;
    if (statusDot) statusDot.classList.toggle('ok', beat && beat.key === 'hold');
    if (d.auto != null) statusDot.classList.toggle('live', !!d.auto);

    // 喷射负载
    loadPct.textContent = `${Math.round(clamp(load) * 100)}%`;
    for (let i = 0; i < segs.length; i++) {
      const on = i / segs.length < clamp(load);
      segs[i].style.background = on
        ? (i / segs.length > 0.62 ? 'linear-gradient(180deg,#bfd7fa,#4a86e8)' : 'linear-gradient(180deg,#4a86e8,#0f52ba)')
        : 'rgba(15,82,186,.10)';
    }

    // 01 喷射
    q('kpa').textContent = String(Math.round(pressure));
    q('n').textContent = String(Math.round(thrustN));
    q('hz').textContent = PULSE_HZ.toFixed(1);
    if (siphonFlowing !== lastSiphonFlow) {
      lastSiphonFlow = siphonFlowing;
      q('siphon').textContent = siphonFlowing ? '虹吸喷流' : '虹吸待机';
    }
    jetChart.draw({
      series: [{pts: chart.map((v, i) => [-1.2 + (i / (chart.length - 1)) * 1.2, v]), color: '#0f52ba', width: 1.4, area: 'rgba(15,82,186,0.06)'}],
      dots: [{x: 0, y: chart[chart.length - 1], color: '#0f52ba', halo: 'rgba(15,82,186,.28)'}],
      marks: [{x: 0, color: 'rgba(15,82,186,.30)'}],
      yLabels: [{y: 50, text: '50'}, {y: 100, text: '100 kPa'}],
      xLabels: [{x: -1.2, text: '-1.2 秒', align: 'left'}, {x: 0, text: '现在', align: 'right'}],
    });

    // 02 电源
    p2.body.querySelector('[data-id="batt"]').textContent = String(Math.round(tm.battery));
    p2.body.querySelector('[data-id="cell"]').textContent = tm.cell.toFixed(2);
    p2.body.querySelector('[data-id="cell2"]').textContent = tm.cell.toFixed(2);
    p2.body.querySelector('[data-id="draw"]').textContent = tm.draw.toFixed(1);
    p2.body.querySelector('[data-id="motor"]').textContent = String(Math.round(tm.motor));
    const lit = Math.round((tm.battery / 100) * 13);
    p2._cells.forEach((c, i) => {
      c.className = i < lit ? (i < 3 ? 'on low' : 'on') : '';
    });

    // 03 臂弯曲
    curlBars.update(curls.map((v) => clamp(v)));
    const badgeText = beat && beat.key === 'teardown' ? '拆解中' : beat && beat.key === 'arm' ? '分离中' : '弯曲中';
    if (badgeText !== lastBadge) {
      lastBadge = badgeText;
      curlBadge.innerHTML = pill(badgeText, beat && beat.key === 'teardown' ? 'hot' : 'ok');
    }

    // 04 深度
    p4.body.querySelector('[data-id="depth"]').textContent = tm.depth.toFixed(2);
    p4.body.querySelector('[data-id="vs"]').textContent = sign(tm.vs, 2);
    p4.body.querySelector('[data-id="pitch"]').textContent = sign(tm.pitch, 1);
    p4.body.querySelector('[data-id="roll"]').textContent = sign(tm.roll, 1);
    p4.body.querySelector('[data-id="speed"]').textContent = tm.speed.toFixed(2);
    p4.body.querySelector('[data-id="hold"]').textContent = beat && beat.key === 'hold' ? '开' : '关';
    comp.update({pitch: tm.pitch, roll: tm.roll, wobble: Math.sin(t * 0.7) * 0.03});

    // 05 / 06
    asmBtns.set(ASM.findIndex((b) => b.key === (isolate || 'hero')));
    for (const it of DISP) it.on = !!display[it.key];
    DISP.forEach((it, i) => {
      const on = !!display[it.key];
      dispBtns.els[i].classList.toggle('on', on);
      it.on = on;
    });

    // 07 子系统
    subs.forEach((s, i) => {
      if (!s) return;
      subPills[i].className = `pill ${s.kind}`;
      subPills[i].textContent = s.text;
    });

    // 08 操作日志 / 节拍大字
    ops.set({t, playing, event: d.opsEvent || '', count: `${actions} 次操作员操作`});
    hud.setBeat({mode: '运行模式', title: beat.mode, sub: beat.sub, key: beat.key});
  }

  return {update, ops, asmBtns, dispBtns, DISP};
}
