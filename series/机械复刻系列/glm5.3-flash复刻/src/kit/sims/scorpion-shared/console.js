// Telson SC-8 的控制台，按 1600 × 900 排布（照参考帧）：钴蓝 SC-8 徽块与标题、尾部负载条、
// 模拟编号/运行时间/状态/操作员；左列 01 步态、02 尾击、03 尾节链、04 腿部伺服；右列
// 05 钳握、06 装配体、07 显示、08 子系统；底部运行模式与 09 操作日志；再加标注引线与
// 操作员光标。update(s) 从当帧状态重画每个活的部分 —— 屏上没有一个写死的数字。
export const C = {ink: '#1a2430', mute: '#7d8fa3', faint: '#d8e1ea', line: '#e2e9f0', panel: 'rgba(250,252,254,.95)', or: '#1e5fd6', sky: '#3d8fe0', green: '#2a9d8f'};
export const ASSEMBLIES = ['hero', 'claw', 'tail', 'leg', 'head', 'shell'];
export const ASM_LABEL = {hero: '主视角', claw: '左钳', tail: '尾链', leg: '腿 R2', head: '传感头', shell: '背甲'};
export const DISPLAY = ['labels', 'exploded', 'turntable', 'gait'];
export const DISPLAY_LABEL = {labels: '标注', exploded: '拆解', turntable: '转台', gait: '触地连线'};

const SUBSYSTEMS = [
  ['01', '传感头', '2 × 26 毫米镜头 · IR 圈'],
  ['02', '钳驱动', '双螯 · 齿轮减速基座'],
  ['03', '背甲核心', '背甲 5 板 · 腹板 5 板'],
  ['04', '腿部伺服', '8 足 × 2 关节 · 16 伺服'],
  ['05', '尾部执行器', '尾节链 5 节 · 刚性甩击'],
  ['06', '毒针', '锥针 · 毒囊'],
];

const CSS = `
#app{font-family:Inter,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,'PingFang SC','Microsoft YaHei',monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(70,100,140,.08)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};white-space:nowrap}
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

  // ------------------------------------------------------------ 页眉
  add(`<div style="position:absolute;left:0;top:0;width:176px;height:89px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:22px;top:26px" width="58" height="38"><g fill="#fff"><ellipse cx="16" cy="22" rx="9" ry="6"/><circle cx="27" cy="17" r="4.6"/><path d="M31 15q9 -6 12 2q-5 -1 -7 2" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M10 27l-5 6M16 28l-2 7M22 27l3 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M23 13q-2 -6 4 -8" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:86px;top:36px;color:#fff;font-size:15px;font-weight:600;letter-spacing:3.4px">SC-8</div>`);
  add(`<div class="sm" style="position:absolute;left:200px;top:18px;letter-spacing:2.4px">节肢地面单元 · 机器人蝎</div>`);
  add(`<div style="position:absolute;left:199px;top:33px;font-size:32px;font-weight:700;letter-spacing:-.6px;line-height:1">机械蝎子 Telson SC-8 <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:200px;top:73px;font-size:10.6px;letter-spacing:2.2px;color:#5c6c7e">桌面步行机械 / 现场模拟器</div>`);
  // 尾部负载条
  add(`<div class="sm" style="position:absolute;left:842px;top:22px">尾部负载</div>`);
  const loadPct = add(`<div class="mo" style="position:absolute;left:1118px;top:20px;font-size:11px;font-weight:700;text-align:right;width:44px"></div>`);
  const loadBar = add(`<div style="position:absolute;left:842px;top:40px;width:320px;height:11px;display:flex;gap:2px"></div>`);
  for (let i = 0; i < 40; i++) loadBar.appendChild(el(`<div style="flex:1;background:#e2e9f0;border-radius:1px"></div>`));
  add(`<div class="sm" style="position:absolute;left:842px;top:60px;letter-spacing:1.4px">静息</div>`);
  add(`<div class="sm" style="position:absolute;left:968px;top:60px;letter-spacing:1.4px">拱起</div>`);
  add(`<div class="sm" style="position:absolute;left:1112px;top:60px;letter-spacing:1.4px">甩击</div>`);
  // 模拟编号 / 运行时间 / 状态 / 操作员
  add(`<div class="sm" style="position:absolute;left:1300px;top:24px">模拟编号</div>`);
  add(`<div class="mo" style="position:absolute;left:1300px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px">SC8-0731</div>`);
  add(`<div class="sm" style="position:absolute;left:1412px;top:24px">运行时间</div>`);
  const runtime = add(`<div class="mo" style="position:absolute;left:1412px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px"></div>`);
  add(`<div style="position:absolute;left:1518px;top:22px;width:1px;height:52px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:24px">状态</div>`);
  const stDot = add(`<div style="position:absolute;left:1532px;top:44px;width:7px;height:7px;border-radius:50%;background:${C.or}"></div>`);
  const statusTx = add(`<div class="mo" style="position:absolute;left:1544px;top:40px;font-size:9.5px;font-weight:700;letter-spacing:.6px;white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:60px">操作员</div>`);
  add(`<div class="mo" style="position:absolute;left:1524px;top:76px;font-size:9.5px;font-weight:600;letter-spacing:.6px;white-space:nowrap">甲板 2 · 模拟员</div>`);
  // 十字基准场
  {
    let h = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) h += `<path d="M${c * 22 + 4} ${r * 22}v7M${c * 22} ${r * 22 + 3.5}h7" stroke="${C.or}" stroke-width="1" opacity=".5"/>`;
    add(`<svg style="position:absolute;left:812px;top:96px" width="360" height="40">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 步态
  panel(28, 126, 282, 196, '步态', '01');
  const gaitHz = add(`<div class="big" style="position:absolute;left:42px;top:156px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:196px">步频</div>`);
  const stanceN = add(`<div class="big" style="position:absolute;left:200px;top:156px;font-size:26px;text-align:right;width:96px"></div>`);
  add(`<div class="sm" style="position:absolute;left:212px;top:196px">支撑足数</div>`);
  const gaitChart = add(`<svg style="position:absolute;left:42px;top:212px" width="254" height="76"></svg>`);
  const gaitFoot = add(`<div class="sm" style="position:absolute;left:42px;top:296px"></div>`);
  const gaitRects = [];
  {
    const ROWS = 8;
    const COLS = 44;
    const rh = 76 / ROWS;
    let h = '';
    for (let r = 0; r < ROWS; r++) {
      gaitRects.push([]);
      for (let c = 0; c < COLS; c++) h += `<rect x="${c * (254 / COLS)}" y="${r * rh + 1}" width="${254 / COLS - 1}" height="${rh - 3}" rx="1"/>`;
    }
    gaitChart.innerHTML = h;
    const rects = gaitChart.querySelectorAll('rect');
    rects.forEach((rc) => {
      const r = Math.floor(rc.y.baseVal.value / rh);
      gaitRects[r].push(rc);
    });
  }

  // ------------------------------------------------------------ 02 尾击
  panel(28, 336, 282, 192, '尾击', '02');
  const tipSpeed = add(`<div class="big" style="position:absolute;left:42px;top:366px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:406px">毒针尖端速度</div>`);
  const gauge = add(`<svg style="position:absolute;left:196px;top:356px" width="100" height="62"></svg>`);
  const rStrike = row(42, 432, '打击角');
  const rTorque = row(42, 454, '力矩');
  const rPower = row(42, 476, '功耗');
  const tailState = add(`<div class="chip" style="left:212px;top:470px">锁定</div>`);

  // ------------------------------------------------------------ 03 尾节链
  panel(28, 542, 282, 118, '尾节链', '03');
  const tailRows = [];
  for (let i = 0; i < 5; i++) {
    const y = 576 + i * 16;
    add(`<div class="mo" style="position:absolute;left:42px;top:${y}px;font-size:9px;font-weight:600;color:${C.mute}">θ${i + 1}</div>`);
    add(`<div style="position:absolute;left:66px;top:${y + 3}px;width:150px;height:4px;background:#e6edf4;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:66px;top:${y + 3}px;width:3px;height:4px;background:${C.or};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;left:226px;top:${y - 2}px;font-size:9.4px;font-weight:600;width:52px;text-align:right"></div>`);
    tailRows.push({f, v, i});
  }
  add(`<div class="sm" style="position:absolute;left:240px;top:560px;transform:translateX(-50%)">刚体甩击</div>`);

  // ------------------------------------------------------------ 04 腿部伺服
  panel(28, 674, 282, 142, '腿部伺服', '04');
  add(`<div class="sm" style="position:absolute;left:42px;top:704px">每腿负载 · 峰值力矩</div>`);
  add(`<div class="chip" style="left:222px;top:700px">在线 8/8</div>`);
  const loadBars = [];
  for (let i = 0; i < 8; i++) {
    const col = i < 4 ? 0 : 1;
    const r = i % 4;
    const x = 42 + col * 132;
    const y = 722 + r * 22;
    add(`<div class="mo" style="position:absolute;left:${x}px;top:${y}px;font-size:9px;font-weight:600;color:${C.mute}">${i < 4 ? `L${i + 1}` : `R${i - 3}`}</div>`);
    add(`<div style="position:absolute;left:${x + 22}px;top:${y + 3}px;width:72px;height:4px;background:#e6edf4;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:${x + 22}px;top:${y + 3}px;height:4px;background:${C.sky};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;left:${x + 100}px;top:${y - 2}px;font-size:9px;font-weight:600;width:30px;text-align:right"></div>`);
    loadBars.push({f, v});
  }

  // ------------------------------------------------------------ 05 钳握
  panel(1313, 126, 258, 196, '钳握', '05');
  const clawSpeed = add(`<div class="big" style="position:absolute;left:1327px;top:156px"></div>`);
  add(`<div class="sm" style="position:absolute;left:1327px;top:196px">钳指速度</div>`);
  const clawChart = add(`<svg style="position:absolute;left:1327px;top:210px" width="230" height="52"></svg>`);
  const clawBars = [];
  for (let i = 0; i < 2; i++) {
    const y = 272 + i * 19;
    add(`<div class="sm" style="position:absolute;left:1327px;top:${y}px">${i ? '钳 R' : '钳 L'}</div>`);
    add(`<div style="position:absolute;left:1368px;top:${y + 3}px;width:120px;height:5px;background:#e6edf4;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:1368px;top:${y + 3}px;height:5px;background:${C.or};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;left:1496px;top:${y - 2}px;font-size:9.4px;font-weight:600;width:40px;text-align:right"></div>`);
    clawBars.push({f, v});
  }
  const clawMode = row(1327, 312, '模式', 40);

  // ------------------------------------------------------------ 06 装配体, 07 显示
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
  panel(1313, 336, 258, 92, '装配体', '06');
  btnRow(ASSEMBLIES, ASM_LABEL, 1327, 372);
  panel(1313, 442, 258, 92, '显示', '07');
  btnRow(DISPLAY, DISPLAY_LABEL, 1327, 478);

  // ------------------------------------------------------------ 08 子系统
  panel(1313, 548, 258, 268, '子系统', '08');
  const subRows = SUBSYSTEMS.map(([n, name, sub], i) => {
    const y = 584 + i * 38;
    add(`<div class="pn" style="left:1327px;top:${y + 1}px;right:auto">${n}</div>`);
    add(`<div class="mo" style="position:absolute;left:1352px;top:${y - 3}px;font-size:9.8px;font-weight:700;letter-spacing:1px">${name}</div>`);
    add(`<div class="sm" style="position:absolute;left:1352px;top:${y + 10}px;font-size:7.6px;letter-spacing:1.1px">${sub}</div>`);
    return add(`<div class="chip" style="left:auto;right:${1600 - 1557}px;top:${y - 1}px;justify-content:center"></div>`);
  });

  // ------------------------------------------------------------ 运行模式 + 09 操作日志
  add(`<div class="sm" style="position:absolute;left:340px;top:744px">运行模式</div>`);
  const modeBig = add(`<div style="position:absolute;left:340px;top:758px;font-size:27px;font-weight:700;letter-spacing:-.4px;color:${C.or};line-height:1.05"></div>`);
  const modeSub = add(`<div class="sm" style="position:absolute;left:340px;top:800px;letter-spacing:2px"></div>`);
  panel(508, 734, 782, 126, '操作日志', '09');
  btn.play = add(`<div class="bt" style="left:524px;top:782px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:14px"></div>`);
  add(`<div class="sm" style="position:absolute;left:590px;top:778px">展开</div>`);
  const opPhase = add(`<div class="mo" style="position:absolute;left:590px;width:560px;top:777px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:778px">收回</div>`);
  const TL = {x: 592, w: 556};
  add(`<div style="position:absolute;left:${TL.x}px;top:808px;width:${TL.w}px;height:3px;background:#e6edf4;border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:808px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:802px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const ticks = add(`<div style="position:absolute;inset:0"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:592px;top:824px;font-size:9.4px;color:${C.mute};letter-spacing:1px"></div>`);
  const opActions = add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:824px"></div>`);

  // ------------------------------------------------------------ 页脚
  add(`<div class="sm" style="position:absolute;left:27px;top:882px;letter-spacing:2.2px">现场模拟器 &nbsp;·&nbsp; 程序化模型 &nbsp;·&nbsp; 8 足 · 2 钳 · 尾节链 ×5</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:882px;letter-spacing:2.2px">TELSON DYNAMICS · 沙漠实验室 <span style="color:${C.or}">////////</span></div>`);

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
      // 页眉
      const load = Math.min(1, s.load);
      const segs = loadBar.children;
      for (let i = 0; i < 40; i++) segs[i].style.background = i / 40 < load ? C.or : '#e2e9f0';
      loadPct.textContent = `${Math.round(load * 100)}%`;
      runtime.textContent = fmtClock(s.t);
      statusTx.textContent = s.status;
      stDot.style.background = s.status === '+警戒' ? C.green : C.or;
      // 01 步态
      gaitHz.innerHTML = `${s.gaitHz.toFixed(2)}<small> Hz</small>`;
      stanceN.innerHTML = `${s.stanceN}<small> 足</small>`;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 44; c++) gaitRects[r][c].setAttribute('fill', s.gaitRows[r][c] ? C.or : '#e9eef5');
      gaitFoot.innerHTML = `阵型&nbsp;&nbsp;<b style="color:${C.ink}">${s.pattern}</b>&nbsp;&nbsp;&nbsp;&nbsp;占空比 ${s.duty.toFixed(2)}`;
      // 02 尾击
      tipSpeed.innerHTML = `${s.tipSpeed.toFixed(2)}<small> m/s</small>`;
      {
        const c = {x: 30, y: 34, r: 24};
        const a = Math.PI - (Math.max(0, Math.min(150, s.strikeDeg)) / 150) * Math.PI; // 150° 表盘
        gauge.innerHTML = `<path d="M ${c.x - c.r} ${c.y} A ${c.r} ${c.r} 0 0 1 ${c.x + c.r} ${c.y}" fill="none" stroke="${C.faint}" stroke-width="4"/>
          <path d="M ${c.x - c.r} ${c.y} A ${c.r} ${c.r} 0 0 1 ${c.x + c.r * Math.cos(a)} ${c.y - c.r * Math.sin(a)}" fill="none" stroke="${C.or}" stroke-width="4" stroke-linecap="round"/>
          <circle cx="${c.x}" cy="${c.y}" r="2.6" fill="${C.ink}"/>
          <text x="${c.x - 14}" y="${c.y - 6}" font-size="9" font-weight="700" fill="${C.ink}" font-family="JetBrains Mono">${Math.round(s.strikeDeg)}°</text>`;
      }
      rStrike.textContent = `${s.strikeDeg.toFixed(1)}°`;
      rTorque.textContent = `${s.torque.toFixed(2)} N·m`;
      rPower.textContent = `${s.power.toFixed(1)} W`;
      tailState.textContent = s.tailState;
      tailState.style.background = s.tailState === '甩击中' ? C.or : s.tailState === '拱起' ? C.sky : C.green;
      // 03 尾节链
      for (let i = 0; i < 5; i++) {
        const d = s.tailDeg[i];
        const mid = 66 + ((Math.max(-135, Math.min(135, d)) + 135) / 270) * 150;
        tailRows[i].f.style.left = `${mid.toFixed(1)}px`;
        tailRows[i].v.textContent = `${d.toFixed(1)}°`;
      }
      // 04 腿部伺服
      for (let i = 0; i < 8; i++) {
        loadBars[i].f.style.width = `${(Math.min(100, s.loads[i]) / 100 * 72).toFixed(1)}px`;
        loadBars[i].v.textContent = `${Math.round(s.loads[i])}%`;
      }
      // 05 钳握
      clawSpeed.innerHTML = `${s.clawSpeed.toFixed(2)}<small> m/s</small>`;
      {
        const W = 230;
        const H = 52;
        const N = s.clawChart.length;
        let p = '';
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * W;
          const y = H - 6 - Math.min(1, s.clawChart[i] / 1.8) * (H - 14);
          p += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        clawChart.innerHTML = `<line x1="0" x2="${W}" y1="${H - 6}" y2="${H - 6}" stroke="${C.faint}" stroke-width="1"/>
          <text x="${W - 26}" y="${H - 12}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">咬合峰</text>
          <path d="${p}" fill="none" stroke="${C.or}" stroke-width="1.4"/>
          <circle cx="${(W - 1).toFixed(1)}" cy="${(H - 6 - Math.min(1, s.clawChart[N - 1] / 1.8) * (H - 14)).toFixed(1)}" r="2.6" fill="${C.or}"/>`;
      }
      for (let i = 0; i < 2; i++) {
        clawBars[i].f.style.width = `${(Math.min(60, s.clawOpen) / 60 * 120).toFixed(1)}px`;
        clawBars[i].v.textContent = `${s.clawOpen.toFixed(0)}°`;
      }
      clawMode.textContent = s.clawMode;
      // 06/07 按钮
      for (const k of ASSEMBLIES) onBtn(k, s.isolate === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      // 08 子系统
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
