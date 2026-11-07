// HX-18 的控制台，按 1600×900 排：钴蓝徽章与标题、速度大读数与功率负载条、左列 01 步态
// （6 行触地图）、02 电源（功耗/电压/舵机温度）、03 关节角（6 腿 × 髋/股/胫/扭矩）、右列
// 04 运动、05 装配体、06 显示、07 子系统，底部运行模式与 08 操作日志，外加标注与光标。
// update(s) 每帧从当帧状态重画每一处——屏上没有写死的数字。
export const C = {ink: '#1a2430', mute: '#7d8fa3', faint: '#dfe7f0', line: '#dfe7f0', panel: 'rgba(250,252,254,.96)', or: '#1e5fd6', cyan: '#12aecb', green: '#2a9d8f'};
export const ASSEMBLIES = ['hero', 'hull', 'mast', 'batt', 'leg2', 'foot'];
export const ASM_LABEL = {hero: '整机', hull: '机身舱', mast: '传感头', batt: '电池舱', leg2: '右中腿', foot: '脚垫'};
export const DISPLAY = ['labels', 'exploded', 'gait', 'turntable'];
export const DISPLAY_LABEL = {labels: '标注', exploded: '拆解', gait: '触地连线', turntable: '转台'};
const SUBSYSTEMS = [
  ['01', '步态引擎', '三脚架 · 占空比 0.50'],
  ['02', '舵机总线', '18 × AX-12A · 1 M bps'],
  ['03', '电源', '3S 锂电 · 11.1 V'],
  ['04', '传感桅杆', '双超声 · 转台云台'],
  ['05', '触地传感', '6 路足端 · 力敏'],
  ['06', '结构', '六边形舱 · 铝合金腿'],
];

const CSS = `
#app{font-family:Inter,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,'PingFang SC','Microsoft YaHei',monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(90,120,160,.10)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.big{font-size:34px;font-weight:700;letter-spacing:-.5px;line-height:1}
.big small{font-size:13px;font-weight:600;color:${C.mute};letter-spacing:0}
.bt{position:absolute;height:21px;padding:0 9px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fdfeff;font:700 9.2px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap}
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

  // ------------------------------------------------------------ 头部
  add(`<div style="position:absolute;left:0;top:0;width:176px;height:89px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:22px;top:26px" width="56" height="38"><g stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"><path d="M14 14 h28 l8 6 v6 h-44 v-6 z" fill="#fff" stroke="none" opacity=".9"/><path d="M12 26 l-8 7 M20 28 l-5 8 M34 28 l5 8 M42 26 l8 7" stroke-width="2.2"/><circle cx="28" cy="19" r="3.4" fill="#fff" stroke="none"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:86px;top:36px;color:#fff;font-size:15px;font-weight:600;letter-spacing:3.4px">HX-18</div>`);
  add(`<div class="sm" style="position:absolute;left:200px;top:18px;letter-spacing:2.4px">十八关节 · 三脚架步态步行机器人</div>`);
  add(`<div style="position:absolute;left:199px;top:33px;font-size:32px;font-weight:700;letter-spacing:-.6px;line-height:1">六足机器人 HX-18 <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:200px;top:73px;font-size:10.6px;letter-spacing:2.2px;color:#5d7188">18 × AX-12A · 桌面实验平台</div>`);
  // 速度大读数 + 功率负载条
  add(`<div class="sm" style="position:absolute;left:842px;top:20px">步行速度</div>`);
  const speedBig = add(`<div class="big" style="position:absolute;left:842px;top:33px"></div>`);
  add(`<div class="sm" style="position:absolute;left:1000px;top:22px">功率负载</div>`);
  const loadPct = add(`<div class="mo" style="position:absolute;left:1118px;top:20px;font-size:11px;font-weight:700;text-align:right;width:44px"></div>`);
  const loadBar = add(`<div style="position:absolute;left:1000px;top:40px;width:162px;height:11px;display:flex;gap:2px"></div>`);
  for (let i = 0; i < 20; i++) loadBar.appendChild(el(`<div style="flex:1;background:#e3eaf3;border-radius:1px"></div>`));
  add(`<div class="sm" style="position:absolute;left:842px;top:66px;letter-spacing:1.4px">待机</div>`);
  add(`<div class="sm" style="position:absolute;left:1000px;top:66px;letter-spacing:1.4px">巡航</div>`);
  add(`<div class="sm" style="position:absolute;left:1112px;top:66px;letter-spacing:1.4px">峰值</div>`);
  // 模拟编号 / 运行时间 / 状态 / 操作员
  add(`<div class="sm" style="position:absolute;left:1300px;top:24px">模拟编号</div>`);
  add(`<div class="mo" style="position:absolute;left:1300px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px">HX18-1102</div>`);
  add(`<div class="sm" style="position:absolute;left:1412px;top:24px">运行时间</div>`);
  const runtime = add(`<div class="mo" style="position:absolute;left:1412px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px"></div>`);
  add(`<div style="position:absolute;left:1518px;top:22px;width:1px;height:52px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:24px">状态</div>`);
  const stDot = add(`<div style="position:absolute;left:1532px;top:44px;width:7px;height:7px;border-radius:50%;background:${C.or}"></div>`);
  const statusTx = add(`<div class="mo" style="position:absolute;left:1544px;top:40px;font-size:9.5px;font-weight:700;letter-spacing:.6px;white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:60px">操作员</div>`);
  add(`<div class="mo" style="position:absolute;left:1524px;top:76px;font-size:9.5px;font-weight:600;letter-spacing:.6px;white-space:nowrap">地砖试验场 · K.L.</div>`);
  {
    let h = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) h += `<path d="M${c * 22 + 4} ${r * 22}v7M${c * 22} ${r * 22 + 3.5}h7" stroke="${C.or}" stroke-width="1" opacity=".5"/>`;
    add(`<svg style="position:absolute;left:812px;top:96px" width="360" height="40">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 步态
  panel(28, 126, 282, 240, '步态', '01');
  const hzBig = add(`<div class="big" style="position:absolute;left:42px;top:156px;font-size:28px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:192px">步频（整周期）</div>`);
  const stBig = add(`<div class="big" style="position:absolute;left:200px;top:156px;font-size:28px;text-align:right;width:96px"></div>`);
  add(`<div class="sm" style="position:absolute;left:212px;top:192px">触地 / 6 足</div>`);
  const gaitSvg = add(`<svg style="position:absolute;left:42px;top:210px" width="254" height="120"></svg>`);
  const gaitFoot = add(`<div class="sm" style="position:absolute;left:42px;top:342px"></div>`);

  // ------------------------------------------------------------ 02 电源
  panel(28, 380, 282, 178, '电源', '02');
  const wBig = add(`<div class="big" style="position:absolute;left:42px;top:412px;font-size:28px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:446px">整机功耗</div>`);
  const vBig = add(`<div class="big" style="position:absolute;left:200px;top:412px;font-size:28px;text-align:right;width:96px"></div>`);
  add(`<div class="sm" style="position:absolute;left:212px;top:446px">母线电压</div>`);
  const tempChart = add(`<svg style="position:absolute;left:42px;top:462px" width="254" height="62"></svg>`);
  const tempFoot = add(`<div class="sm" style="position:absolute;left:42px;top:532px"></div>`);

  // ------------------------------------------------------------ 03 关节角
  panel(28, 572, 282, 254, '关节角 · 扭矩', '03');
  add(`<div class="sm" style="position:absolute;left:42px;top:604px">6 腿 × 3 关节 · 度 / 牛·米</div>`);
  add(`<div class="chip" style="left:238px;top:600px">18 舵机</div>`);
  {
    const cols = ['腿', '髋', '股', '胫', 'τ'];
    const xs = [42, 84, 128, 172, 224];
    cols.forEach((c, j) => add(`<div class="sm" style="position:absolute;left:${xs[j]}px;top:620px;letter-spacing:.6px">${c}</div>`));
  }
  const jCells = [];
  for (let i = 0; i < 6; i++) {
    const y = 640 + i * 30;
    const cells = [];
    const xs = [42, 84, 128, 172, 224];
    const ws = [0, 40, 40, 40, 44];
    xs.forEach((x, j) => {
      if (j === 0) {
        add(`<div class="mo" style="position:absolute;left:${x}px;top:${y}px;font-size:10px;font-weight:700;color:${C.mute}">${['L1', 'L2', 'L3', 'R1', 'R2', 'R3'][i]}</div>`);
        cells.push(null);
      } else cells.push(add(`<div class="mo" style="position:absolute;left:${x}px;top:${y - 2}px;font-size:10.4px;font-weight:600;width:${ws[j]}px;text-align:right"></div>`));
    });
    jCells.push(cells);
  }

  // ------------------------------------------------------------ 04 运动
  panel(1313, 126, 258, 208, '运动', '04');
  const spdBig = add(`<div class="big" style="position:absolute;left:1327px;top:158px;font-size:28px"></div>`);
  add(`<div class="sm" style="position:absolute;left:1327px;top:192px">机身速度（世界系）</div>`);
  const dRows = ['步频', '步幅', '俯仰', '横滚'].map((n, i) => {
    const y = 218 + i * 26;
    add(`<div class="sm" style="position:absolute;left:1327px;top:${y}px">${n}</div>`);
    return add(`<div class="mo" style="position:absolute;right:${1600 - 1557}px;top:${y - 3}px;font-size:11.5px;font-weight:600"></div>`);
  });

  // ------------------------------------------------------------ 05 装配体 / 06 显示
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
  panel(1313, 348, 258, 92, '装配体', '05');
  btnRow(ASSEMBLIES, ASM_LABEL, 1327, 384);
  panel(1313, 454, 258, 92, '显示', '06');
  btnRow(DISPLAY, DISPLAY_LABEL, 1327, 490);

  // ------------------------------------------------------------ 07 子系统
  panel(1313, 560, 258, 266, '子系统', '07');
  const subRows = SUBSYSTEMS.map(([n, name, sub], i) => {
    const y = 596 + i * 38;
    add(`<div class="pn" style="left:1327px;top:${y + 1}px;right:auto">${n}</div>`);
    add(`<div class="mo" style="position:absolute;left:1352px;top:${y - 3}px;font-size:9.8px;font-weight:700;letter-spacing:1px">${name}</div>`);
    add(`<div class="sm" style="position:absolute;left:1352px;top:${y + 10}px;font-size:7.6px;letter-spacing:1.1px">${sub}</div>`);
    return add(`<div class="chip" style="left:auto;right:${1600 - 1557}px;top:${y - 1}px;justify-content:center"></div>`);
  });

  // ------------------------------------------------------------ 运行模式 + 08 操作日志
  add(`<div class="sm" style="position:absolute;left:340px;top:744px">运行模式</div>`);
  const modeBig = add(`<div style="position:absolute;left:340px;top:758px;font-size:27px;font-weight:700;letter-spacing:-.4px;color:${C.or};line-height:1.05"></div>`);
  const modeSub = add(`<div class="sm" style="position:absolute;left:340px;top:800px;letter-spacing:2px"></div>`);
  panel(508, 734, 782, 126, '操作日志', '08');
  btn.play = add(`<div class="bt" style="left:524px;top:782px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:14px"></div>`);
  add(`<div class="sm" style="position:absolute;left:590px;top:778px">起步</div>`);
  const opPhase = add(`<div class="mo" style="position:absolute;left:590px;width:560px;top:777px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:778px">离场</div>`);
  const TL = {x: 592, w: 556};
  add(`<div style="position:absolute;left:${TL.x}px;top:808px;width:${TL.w}px;height:3px;background:#e3eaf3;border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:808px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:802px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const ticks = add(`<div style="position:absolute;inset:0"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:592px;top:824px;font-size:9.4px;color:${C.mute};letter-spacing:1px"></div>`);
  const opActions = add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:824px"></div>`);

  // ------------------------------------------------------------ 页脚
  add(`<div class="sm" style="position:absolute;left:27px;top:882px;letter-spacing:2.2px">地砖试验场 &nbsp;·&nbsp; 程序化模型 &nbsp;·&nbsp; 6 足 · 18 关节 · 3 自由度/腿</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:882px;letter-spacing:2.2px">HX-18 六足平台 · 步行机械实验室 <span style="color:${C.or}">////////</span></div>`);

  // ------------------------------------------------------------ 标注、光标
  const callSvg = add(`<svg data-callouts style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div data-callouts style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
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
    btn[k].style.background = on ? C.or : '#fdfeff';
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
      // 头部
      speedBig.innerHTML = `${s.speed.toFixed(2)}<small> m/s</small>`;
      const load = Math.min(1, s.load);
      const segs = loadBar.children;
      for (let i = 0; i < 20; i++) segs[i].style.background = i / 20 < load ? C.or : '#e3eaf3';
      loadPct.textContent = `${Math.round(load * 100)}%`;
      runtime.textContent = fmtClock(s.t);
      statusTx.textContent = s.status;
      stDot.style.background = s.status === '停机检修' ? C.green : C.or;
      // 01 步态
      hzBig.innerHTML = `${s.gaitHz.toFixed(2)}<small> Hz</small>`;
      stBig.innerHTML = `${s.stanceN}<small> 足</small>`;
      {
        const W = 254;
        const H = 120;
        const rows = s.gaitRows;
        const cols = rows[0].length;
        const rh = 14;
        let g = '';
        for (let r = 0; r < 6; r++) {
          const y = r * (rh + 5);
          g += `<text x="0" y="${y + rh - 3}" font-size="7.4" fill="${C.mute}" font-family="JetBrains Mono">${['L1', 'L2', 'L3', 'R1', 'R2', 'R3'][r]}</text>`;
          for (let c = 0; c < cols; c++) {
            if (rows[r][c]) g += `<rect x="${18 + (c / (cols - 1)) * (W - 18)}" y="${y}" width="${(W - 18) / (cols - 1) + 0.6}" height="${rh}" fill="${C.or}" opacity="0.85" rx="1.5"/>`;
          }
        }
        gaitSvg.innerHTML = g;
      }
      gaitFoot.innerHTML = `步幅&nbsp;&nbsp;<b style="color:${C.ink}">${s.stride2.toFixed(3)} m</b>&nbsp;&nbsp;&nbsp;&nbsp;占空比 ${s.duty.toFixed(2)}`;
      // 02 电源
      wBig.innerHTML = `${s.power.toFixed(1)}<small> W</small>`;
      vBig.innerHTML = `${s.volt.toFixed(2)}<small> V</small>`;
      {
        const W = 254;
        const H = 62;
        const N = s.tempChart.length;
        let p = '';
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * W;
          const y = H - 8 - ((s.tempChart[i] - 24) / 14) * (H - 16);
          p += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        const lx = W - 1;
        const ly = H - 8 - ((s.tempChart[N - 1] - 24) / 14) * (H - 16);
        tempChart.innerHTML = `<line x1="0" x2="${W}" y1="${H - 8}" y2="${H - 8}" stroke="${C.faint}" stroke-width="1"/>
          <text x="2" y="10" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">38 °C</text>
          <text x="${W - 24}" y="${H - 12}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">此刻</text>
          <text x="0" y="${H - 12}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">-40 秒</text>
          <path d="${p}" fill="none" stroke="${C.cyan}" stroke-width="1.4"/>
          <circle cx="${lx}" cy="${ly.toFixed(1)}" r="2.6" fill="${C.cyan}"/>`;
      }
      tempFoot.innerHTML = `舵机均温&nbsp;&nbsp;<b style="color:${C.ink}">${s.temp.toFixed(1)} °C</b>&nbsp;&nbsp;&nbsp;&nbsp;一阶滞后 τ=30 s`;
      // 03 关节
      for (let i = 0; i < 6; i++) {
        const [h, f, t] = s.joints[i];
        const cell = jCells[i];
        cell[1].textContent = `${h >= 0 ? '+' : ''}${h.toFixed(1)}°`;
        cell[2].textContent = `${f >= 0 ? '+' : ''}${f.toFixed(1)}°`;
        cell[3].textContent = `${t.toFixed(0)}°`;
        cell[4].textContent = `${s.torques[i].toFixed(2)}`;
        const hot = s.hotLeg === i;
        for (let j = 1; j < 5; j++) cell[j].style.color = hot ? C.or : C.ink;
      }
      // 04 运动
      spdBig.innerHTML = `${s.speed.toFixed(2)}<small> m/s</small>`;
      dRows[0].textContent = `${s.gaitHz.toFixed(2)} Hz`;
      dRows[1].textContent = `${s.stride2.toFixed(3)} m`;
      dRows[2].textContent = `${s.pitch >= 0 ? '+' : ''}${s.pitch.toFixed(1)}°`;
      dRows[3].textContent = `${s.roll >= 0 ? '+' : ''}${s.roll.toFixed(1)}°`;
      // 05/06 按钮
      for (const k of ASSEMBLIES) onBtn(k, s.isolate === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      // 07 子系统
      for (let i = 0; i < 6; i++) {
        const [txt, hot] = s.subsystems[i];
        subRows[i].textContent = txt;
        subRows[i].style.background = hot ? C.or : C.green;
      }
      // 模式 + 日志
      modeBig.textContent = s.mode;
      modeSub.textContent = s.modeSub;
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      opPhase.textContent = s.phase;
      const kx = TL.x + s.prog * TL.w;
      tlFill.style.width = `${(s.prog * TL.w).toFixed(1)}px`;
      tlKnob.style.left = `${kx.toFixed(1)}px`;
      tlTime.textContent = `${fmt(s.t)} / ${fmt(s.dur)}`;
      opActions.textContent = `${s.actions} 次操作员操作`;
      // 标注
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
