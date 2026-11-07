// 仿生沙虫 MK-X 控制台，1600×900 布局照章鱼 OC-8：左上钴蓝徽标与标题、钻掘负载条、
// 模拟编号/运行时间/状态/操作员；左列 01 钻进、02 功率、03 环段波；右列 04 深度剖面、
// 05 行进轨迹、06 装配体、07 显示、08 子系统；底部运行模式与 09 操作日志；标注引线与
// 巡览光标。update(s) 从每帧状态重画全部活动部分——屏上没有一个写死的数字。
export const C = {ink: '#1a2430', mute: '#7d8fa3', faint: '#dfe7f0', line: '#dfe7f0', panel: 'rgba(250,251,253,.95)', or: '#1e5fd6', sky: '#3d8fe0', green: '#2a9d8f', cyan: '#12aecb'};
export const ASSEMBLIES = ['hero', 'xray', 'head', 'rings', 'map', 'explode'];
export const ASM_LABEL = {hero: '主视角', xray: '沙下透视', head: '头段钻芯', rings: '环段波', map: '轨迹剖面', explode: '整机拆解'};
export const DISPLAY = ['labels', 'exploded', 'xray', 'turntable'];
export const DISPLAY_LABEL = {labels: '标注', exploded: '拆解', xray: '透视沙地', turntable: '转台'};
const SUBSYSTEMS = [
  ['01', '钻头驱动', '3 螺旋刃 · 液压马达'],
  ['02', '颚环', '8 颚瓣 · 24 针齿'],
  ['03', '环段液压', '14 节 · 蠕动波'],
  ['04', '排沙喷口', '尾部 · 弃沙输送'],
  ['05', '掩体定位', '缓弧路径 · 航向推算'],
  ['06', '深度控制', '剖面 · 埋深标尺'],
];

const CSS = `
#app{font-family:Inter,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,'PingFang SC','Microsoft YaHei',monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(30,95,214,.08)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};white-space:nowrap}
.big{font-size:34px;font-weight:700;letter-spacing:-.5px;line-height:1}
.big small{font-size:13px;font-weight:600;color:${C.mute};letter-spacing:0}
.bt{position:absolute;height:21px;padding:0 9px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fbfcfe;font:700 9.2px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap}
.chip{position:absolute;height:15px;padding:0 8px;display:flex;align-items:center;border-radius:3px;font:700 8.4px 'JetBrains Mono',monospace;letter-spacing:.8px;color:#fff;background:${C.green};white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:flex;align-items:center;gap:6px;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call span{display:block;font:500 7.8px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};

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
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };
  const row = (x, y, label, w = 52) => {
    add(`<div class="sm" style="position:absolute;left:${x}px;top:${y}px">${label}</div>`);
    return add(`<div class="mo" style="position:absolute;left:${x + w}px;top:${y - 3}px;font-size:11px;font-weight:600;text-align:right;width:58px"></div>`);
  };

  // ------------------------------------------------------------ 页眉
  add(`<div style="position:absolute;left:0;top:0;width:176px;height:89px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:24px;top:26px" width="52" height="38"><g fill="none" stroke="#fff" stroke-width="2.6"><ellipse cx="14" cy="19" rx="10" ry="13"/><path d="M24 19h16M30 12l10-6M30 26l10 6" stroke-linecap="round"/><circle cx="44" cy="19" r="2.6" fill="#fff" stroke="none"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:84px;top:36px;color:#fff;font-size:15px;font-weight:600;letter-spacing:3.4px">MK-X</div>`);
  add(`<div class="sm" style="position:absolute;left:200px;top:18px;letter-spacing:2.4px">分节蠕动钻掘机 · 桌面沙盘模拟器</div>`);
  add(`<div style="position:absolute;left:199px;top:33px;font-size:32px;font-weight:700;letter-spacing:-.6px;line-height:1">仿生沙虫 MK-X <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:200px;top:73px;font-size:10.6px;letter-spacing:2.2px;color:#5a6b80">钻沙行进 / 沙下剖面模拟器</div>`);
  // 钻掘负载条
  add(`<div class="sm" style="position:absolute;left:842px;top:22px">钻掘负载</div>`);
  const loadPct = add(`<div class="mo" style="position:absolute;left:1118px;top:20px;font-size:11px;font-weight:700;text-align:right;width:44px"></div>`);
  const loadBar = add(`<div style="position:absolute;left:842px;top:40px;width:320px;height:11px;display:flex;gap:2px"></div>`);
  for (let i = 0; i < 40; i++) loadBar.appendChild(el(`<div style="flex:1;background:#e3eaf3;border-radius:1px"></div>`));
  add(`<div class="sm" style="position:absolute;left:842px;top:60px;letter-spacing:1.4px">待机</div>`);
  add(`<div class="sm" style="position:absolute;left:968px;top:60px;letter-spacing:1.4px">钻进</div>`);
  add(`<div class="sm" style="position:absolute;left:1112px;top:60px;letter-spacing:1.4px">波峰</div>`);
  add(`<div class="sm" style="position:absolute;left:1300px;top:24px">模拟编号</div>`);
  add(`<div class="mo" style="position:absolute;left:1300px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px">SWX-0402</div>`);
  add(`<div class="sm" style="position:absolute;left:1412px;top:24px">运行时间</div>`);
  const runtime = add(`<div class="mo" style="position:absolute;left:1412px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px"></div>`);
  add(`<div style="position:absolute;left:1518px;top:22px;width:1px;height:52px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:24px">状态</div>`);
  const stDot = add(`<div style="position:absolute;left:1532px;top:44px;width:7px;height:7px;border-radius:50%;background:${C.or}"></div>`);
  const statusTx = add(`<div class="mo" style="position:absolute;left:1544px;top:40px;font-size:9.5px;font-weight:700;letter-spacing:.6px;white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:60px">操作员</div>`);
  add(`<div class="mo" style="position:absolute;left:1524px;top:76px;font-size:9.5px;font-weight:600;letter-spacing:.6px;white-space:nowrap">沙盘二号 · K.T.</div>`);
  // 十字标尺场
  {
    let h = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) h += `<path d="M${c * 22 + 4} ${r * 22}v7M${c * 22} ${r * 22 + 3.5}h7" stroke="${C.or}" stroke-width="1" opacity=".5"/>`;
    add(`<svg style="position:absolute;left:812px;top:96px" width="360" height="40">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 钻进
  panel(28, 126, 282, 226, '钻进', '01');
  const rpmBig = add(`<div class="big" style="position:absolute;left:42px;top:158px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:198px">钻速</div>`);
  const torqueBig = add(`<div class="big" style="position:absolute;left:186px;top:162px;font-size:26px;text-align:right;width:110px"></div>`);
  add(`<div class="sm" style="position:absolute;left:212px;top:198px">头部扭矩</div>`);
  const jetChart = add(`<svg style="position:absolute;left:42px;top:216px" width="254" height="86"></svg>`);
  const jetFoot = add(`<div class="sm" style="position:absolute;left:42px;top:326px"></div>`);

  // ------------------------------------------------------------ 02 功率
  panel(28, 366, 282, 178, '功率', '02');
  const powerBig = add(`<div class="big" style="position:absolute;left:42px;top:398px;font-size:28px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:432px">钻进功率</div>`);
  const cells = add(`<div style="position:absolute;left:150px;top:404px;width:146px;height:16px;display:flex;gap:2px"></div>`);
  for (let i = 0; i < 10; i++) cells.appendChild(el(`<div style="flex:1;background:#e3eaf3;border-radius:1px"></div>`));
  add(`<div class="sm" style="position:absolute;left:150px;top:424px">电量</div>`);
  const battPct = add(`<div class="mo" style="position:absolute;left:256px;top:398px;font-size:15px;font-weight:700;text-align:right;width:40px"></div>`);
  const stat = (x, label) => {
    add(`<div class="sm" style="position:absolute;left:${x}px;top:474px">${label}</div>`);
    return add(`<div class="mo" style="position:absolute;left:${x}px;top:488px;font-size:11px;font-weight:600;white-space:nowrap"></div>`);
  };
  const pSpeed = stat(42, '前进 m/s');
  const pCell = stat(132, '电芯 V');
  const pMotor = stat(222, '电机 °C');

  // ------------------------------------------------------------ 03 环段波
  panel(28, 558, 282, 258, '环段波', '03');
  add(`<div class="sm" style="position:absolute;left:42px;top:592px">14 节鼓胀 · 波向尾传</div>`);
  const waveChip = add(`<div class="chip" style="left:224px;top:588px">传播中</div>`);
  const ringBars = [];
  for (let i = 0; i < 14; i++) {
    const y = 614 + i * 14.4;
    add(`<div class="mo" style="position:absolute;left:42px;top:${y - 2}px;font-size:8px;font-weight:600;color:${C.mute}">环${String(i + 1).padStart(2, '0')}</div>`);
    add(`<div style="position:absolute;left:76px;top:${y + 2}px;width:168px;height:4px;background:#e9eef5;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:76px;top:${y + 2}px;height:4px;background:${C.sky};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;left:254px;top:${y - 2}px;font-size:8.4px;font-weight:600;width:42px;text-align:right"></div>`);
    ringBars.push({f, v});
  }

  // ------------------------------------------------------------ 04 深度剖面
  panel(1313, 126, 258, 208, '深度剖面', '04');
  const profSvg = add(`<svg style="position:absolute;left:1327px;top:150px" width="230" height="118"></svg>`);
  const dRows = ['埋深', '垂速', '俯仰'].map((n, i) => {
    const y = 274 + i * 18;
    add(`<div class="sm" style="position:absolute;left:1327px;top:${y}px">${n}</div>`);
    return add(`<div class="mo" style="position:absolute;right:${1600 - 1557}px;top:${y - 3}px;font-size:11px;font-weight:600"></div>`);
  });

  // ------------------------------------------------------------ 05 行进轨迹
  panel(1313, 348, 258, 110, '行进轨迹', '05');
  const trailSvg = add(`<svg style="position:absolute;left:1327px;top:374px" width="230" height="72"></svg>`);

  // ------------------------------------------------------------ 06 装配体 / 07 显示
  const btn = {};
  const btnRow = (keys, labels, x0, y) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round([...labels[k]].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e7f ? 9.8 : 6.2), 0) + 20);
      if (x + w > x0 + 232) {
        x = x0;
        yy += 29;
      }
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px;height:22px">${labels[k]}</div>`);
      x += w + 6;
    }
    return yy + 29;
  };
  panel(1313, 472, 258, 92, '装配体', '06');
  btnRow(ASSEMBLIES, ASM_LABEL, 1327, 508);
  panel(1313, 578, 258, 92, '显示', '07');
  btnRow(DISPLAY, DISPLAY_LABEL, 1327, 614);

  // ------------------------------------------------------------ 08 子系统
  panel(1313, 684, 258, 132, '子系统', '08');
  const subRows = SUBSYSTEMS.map(([n, name, sub], i) => {
    const y = 716 + i * 16.4;
    add(`<div class="pn" style="left:1327px;top:${y + 1}px;right:auto">${n}</div>`);
    add(`<div class="mo" style="position:absolute;left:1350px;top:${y - 2}px;font-size:8.8px;font-weight:700;letter-spacing:1px">${name}</div>`);
    add(`<div class="sm" style="position:absolute;left:1428px;top:${y - 1}px;font-size:7.2px;letter-spacing:1px">${sub}</div>`);
    return add(`<div class="chip" style="left:auto;right:${1600 - 1557}px;top:${y - 2}px;justify-content:center;height:12px;font-size:7.4px;padding:0 6px"></div>`);
  });

  // ------------------------------------------------------------ 运行模式 + 09 操作日志
  add(`<div class="sm" style="position:absolute;left:340px;top:744px">运行模式</div>`);
  const modeBig = add(`<div style="position:absolute;left:340px;top:758px;font-size:27px;font-weight:700;letter-spacing:-.4px;color:${C.or};line-height:1.05"></div>`);
  const modeSub = add(`<div class="sm" style="position:absolute;left:340px;top:800px;letter-spacing:2px"></div>`);
  panel(508, 734, 782, 126, '操作日志', '09');
  btn.play = add(`<div class="bt" style="left:524px;top:782px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:14px"></div>`);
  add(`<div class="sm" style="position:absolute;left:590px;top:778px">下潜</div>`);
  const opPhase = add(`<div class="mo" style="position:absolute;left:590px;width:560px;top:777px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:778px">离场</div>`);
  const TL = {x: 592, w: 556};
  add(`<div style="position:absolute;left:${TL.x}px;top:808px;width:${TL.w}px;height:3px;background:#e9eef5;border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:808px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:802px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const ticks = add(`<div style="position:absolute;inset:0"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:592px;top:824px;font-size:9.4px;color:${C.mute};letter-spacing:1px"></div>`);
  const opActions = add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:824px"></div>`);

  // ------------------------------------------------------------ 页脚
  add(`<div class="sm" style="position:absolute;left:27px;top:882px;letter-spacing:2.2px">沙盘模拟器 &nbsp;·&nbsp; 程序化模型 &nbsp;·&nbsp; 14 节环段 · 24 针齿 · 1 钻芯</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:882px;letter-spacing:2.2px">MK-X 仿生机械 · 桌面沙盘实验室 <span style="color:${C.or}">////////</span></div>`);

  // ------------------------------------------------------------ 标注与光标
  const callSvg = add(`<svg data-callouts style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div data-callouts style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#1a2430" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const fmt = (s) => `00:${String(Math.floor(s)).padStart(2, '0')}`;
  const fmtClock = (s) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const onBtn = (k, on) => {
    btn[k].style.background = on ? C.or : '#fbfcfe';
    btn[k].style.color = on ? '#fff' : C.ink;
    btn[k].style.borderColor = on ? C.or : C.faint;
  };

  let beatMarks = null;
  return {
    spots,
    btn,
    root: ui,
    timeline: (k) => [TL.x + k * TL.w, 809],
    TL,
    setBeats(beats, dur) {
      if (beatMarks) beatMarks.remove();
      beatMarks = el(`<div style="position:absolute;inset:0"></div>`);
      for (const t of beats) if (t > 0.4 && t < dur - 0.4) beatMarks.appendChild(el(`<div style="position:absolute;left:${TL.x + (t / dur) * TL.w}px;top:806px;width:1px;height:7px;background:${C.mute};opacity:.7"></div>`));
      ticks.appendChild(beatMarks);
    },
    update(s) {
      // 页眉
      const load = Math.min(1, s.load);
      const segs = loadBar.children;
      for (let i = 0; i < 40; i++) segs[i].style.background = i / 40 < load ? C.or : '#e3eaf3';
      loadPct.textContent = `${Math.round(load * 100)}%`;
      runtime.textContent = fmtClock(s.t);
      statusTx.textContent = s.status;
      stDot.style.background = s.status === '保持' ? C.green : C.or;
      // 01 钻进
      rpmBig.innerHTML = `${Math.round(s.rpm)}<small> rpm</small>`;
      torqueBig.innerHTML = `${Math.round(s.torque)}<small> N·m</small>`;
      {
        const W = 254;
        const H = 86;
        const N = s.chart.length;
        let p = '';
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * W;
          const y = H - 12 - (s.chart[i] / 100) * (H - 22);
          p += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        const lx = W - 1;
        const ly = H - 12 - (s.chart[N - 1] / 100) * (H - 22);
        jetChart.innerHTML = `<line x1="0" x2="${W}" y1="${H - 12}" y2="${H - 12}" stroke="${C.faint}" stroke-width="1"/>
          <line x1="0" x2="${W}" y1="${H - 12 - 93}" y2="${H - 12 - 93}" stroke="${C.faint}" stroke-width="1" stroke-dasharray="2 3"/>
          <text x="2" y="${H - 12 - 97}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">220 kPa</text>
          <text x="${W - 24}" y="${H - 2}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">此刻</text>
          <text x="0" y="${H - 2}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">-1.2 秒</text>
          <path d="${p}" fill="none" stroke="${C.or}" stroke-width="1.4"/>
          <circle cx="${lx}" cy="${ly.toFixed(1)}" r="2.6" fill="${C.or}"/>`;
      }
      jetFoot.innerHTML = `波频&nbsp;&nbsp;<b style="color:${C.ink}">${s.waveHz.toFixed(2)} HZ</b>&nbsp;&nbsp;&nbsp;&nbsp;${s.jawNote}`;
      // 02 功率
      powerBig.innerHTML = `${s.powerKw.toFixed(2)}<small> kW</small>`;
      battPct.textContent = `${s.battery.toFixed(0)}%`;
      {
        const nOn = Math.round((s.battery / 100) * 10);
        for (let i = 0; i < 10; i++) cells.children[i].style.background = i < nOn ? (i < 2 ? C.or : C.green) : '#e3eaf3';
      }
      pSpeed.textContent = s.speed.toFixed(3);
      pCell.textContent = s.cell.toFixed(2);
      pMotor.textContent = s.motor.toFixed(0);
      // 03 环段波
      for (let i = 0; i < 14; i++) {
        ringBars[i].f.style.width = `${(Math.min(1, s.rings[i] / 100) * 168).toFixed(1)}px`;
        ringBars[i].f.style.background = s.rings[i] > 60 ? C.or : C.sky;
        ringBars[i].v.textContent = `${Math.round(s.rings[i])}%`;
      }
      waveChip.style.background = s.waveHot ? C.or : C.green;
      waveChip.textContent = s.waveHot ? '波峰' : '传播中';
      // 04 深度剖面
      profSvg.innerHTML = s.profile;
      dRows[0].textContent = `${s.depth.toFixed(2)} m`;
      dRows[1].textContent = `${s.vs >= 0 ? '+' : ''}${s.vs.toFixed(2)} m/s`;
      dRows[2].textContent = `${s.pitch >= 0 ? '+' : ''}${s.pitch.toFixed(1)}°`;
      // 05 行进轨迹
      trailSvg.innerHTML = s.trail;
      // 06/07 按钮
      for (const k of ASSEMBLIES) onBtn(k, s.isolate === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      // 08 子系统
      for (let i = 0; i < 6; i++) {
        const [txt, hot] = s.subsystems[i];
        subRows[i].textContent = txt;
        subRows[i].style.background = hot ? C.or : C.green;
      }
      // 模式与日志
      modeBig.textContent = s.mode;
      modeSub.textContent = s.modeSub;
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      opPhase.textContent = s.phase;
      const kx = TL.x + s.prog * TL.w;
      tlFill.style.width = `${(s.prog * TL.w).toFixed(1)}px`;
      tlKnob.style.left = `${kx.toFixed(1)}px`;
      tlTime.textContent = `${fmt(s.t)} / ${fmt(s.dur)}`;
      opActions.textContent = `${s.actions} 次操作员操作`;
      // 标注引线
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.or}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.or}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
