// The Mellis HB-7 console, laid out at 1600 x 900: the cobalt HB-7 badge and the title, the
// flap-load strip, sim id / runtime / status / operator, the 01 扑翼, 02 电源 and 03 翼与足
// panels down the left, 04 飞行, 05 装配体, 06 显示 and 07 子系统 down the right, the mode
// line and the 08 飞行日志 along the bottom, plus the labels with leaders and the operator's
// pointer. update(s) redraws every live part from the frame's state — no number is typed in.
export const C = {ink: '#1a2430', mute: '#7d8fa3', faint: '#dfe7f0', line: '#dfe7f0', panel: 'rgba(250,252,254,.95)', or: '#1e5fd6', sky: '#3d8fe0', cyan: '#12aecb', green: '#2a9d8f'};
export const ASSEMBLIES = ['hero', 'optics', 'wings', 'thorax', 'abdomen', 'legs'];
export const ASM_LABEL = {hero: '主视角', optics: '光学', wings: '翼', thorax: '胸腔', abdomen: '腹部', legs: '足'};
export const DISPLAY = ['labels', 'exploded', 'tiptrace', 'turntable'];
export const DISPLAY_LABEL = {labels: '标注', exploded: '拆解', tiptrace: '翼尖轨迹', turntable: '转台'};
const SUBSYSTEMS = [
  ['01', '光学头', '2 × 4 毫米镜头 · 稳像'],
  ['02', '颈轴承', '3 自由度 · 阻尼环'],
  ['03', '胸驱动', '曲柄连杆 · 14/34 齿'],
  ['04', '翼根', '拍打 + 扭转双铰 · 钛'],
  ['05', '足舵机', '6 路 · 收拢悬置'],
  ['06', '腹部舱', '配重滑轨 · 电池 2 芯'],
];

const CSS = `
#app{font-family:Inter,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,'PingFang SC','Microsoft YaHei',monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(70,100,150,.08)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};white-space:nowrap}
.big{font-size:32px;font-weight:700;letter-spacing:-.5px;line-height:1}
.big small{font-size:13px;font-weight:600;color:${C.mute};letter-spacing:0}
.bt{position:absolute;height:21px;padding:0 9px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fdfefe;font:700 9.2px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap}
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

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:176px;height:89px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:24px;top:28px" width="50" height="34"><g fill="#fff"><ellipse cx="11" cy="10" rx="8" ry="4.6" transform="rotate(-24 11 10)" opacity=".85"/><ellipse cx="15" cy="9" rx="8" ry="4.6" transform="rotate(22 15 9)" opacity=".6"/><rect x="18" y="14" width="15" height="10" rx="5"/><path d="M33 19h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="17" r="1.4" fill="${C.or}"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:84px;top:36px;color:#fff;font-size:15px;font-weight:600;letter-spacing:3.4px">HB-7</div>`);
  add(`<div class="sm" style="position:absolute;left:200px;top:18px;letter-spacing:2.4px">仿生扑翼机 · 微型飞行器</div>`);
  add(`<div style="position:absolute;left:199px;top:33px;font-size:32px;font-weight:700;letter-spacing:-.6px;line-height:1">Mellis HB-7 <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:200px;top:73px;font-size:10.6px;letter-spacing:2.2px;color:#5f6d80">扑翼微型飞行器 / 现场模拟器</div>`);
  // flap load strip
  add(`<div class="sm" style="position:absolute;left:842px;top:22px">扑翼负载</div>`);
  const loadPct = add(`<div class="mo" style="position:absolute;left:1118px;top:20px;font-size:11px;font-weight:700;text-align:right;width:44px"></div>`);
  const loadBar = add(`<div style="position:absolute;left:842px;top:40px;width:320px;height:11px;display:flex;gap:2px"></div>`);
  for (let i = 0; i < 40; i++) loadBar.appendChild(el(`<div style="flex:1;background:#e3eaf3;border-radius:1px"></div>`));
  add(`<div class="sm" style="position:absolute;left:842px;top:60px;letter-spacing:1.4px">悬停</div>`);
  add(`<div class="sm" style="position:absolute;left:968px;top:60px;letter-spacing:1.4px">机动</div>`);
  add(`<div class="sm" style="position:absolute;left:1112px;top:60px;letter-spacing:1.4px">峰值</div>`);
  add(`<div class="sm" style="position:absolute;left:1300px;top:24px">模拟编号</div>`);
  add(`<div class="mo" style="position:absolute;left:1300px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px">HB7-0412</div>`);
  add(`<div class="sm" style="position:absolute;left:1412px;top:24px">运行时间</div>`);
  const runtime = add(`<div class="mo" style="position:absolute;left:1412px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px"></div>`);
  add(`<div style="position:absolute;left:1518px;top:22px;width:1px;height:52px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:24px">状态</div>`);
  const stDot = add(`<div style="position:absolute;left:1532px;top:44px;width:7px;height:7px;border-radius:50%;background:${C.or}"></div>`);
  const statusTx = add(`<div class="mo" style="position:absolute;left:1544px;top:40px;font-size:9.5px;font-weight:700;letter-spacing:.6px;white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:60px">操作员</div>`);
  add(`<div class="mo" style="position:absolute;left:1524px;top:76px;font-size:9.5px;font-weight:600;letter-spacing:.6px;white-space:nowrap">二号悬停台 · L.C.</div>`);
  {
    let h = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) h += `<path d="M${c * 22 + 4} ${r * 22}v7M${c * 22} ${r * 22 + 3.5}h7" stroke="${C.or}" stroke-width="1" opacity=".45"/>`;
    add(`<svg style="position:absolute;left:812px;top:96px" width="360" height="40">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 扑翼
  panel(28, 126, 282, 212, '扑翼', '01');
  const freqBig = add(`<div class="big" style="position:absolute;left:42px;top:158px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:198px">扑翼频率 · 真实</div>`);
  const liftBig = add(`<div class="big" style="position:absolute;left:200px;top:158px;font-size:26px;text-align:right;width:96px"></div>`);
  add(`<div class="sm" style="position:absolute;left:212px;top:198px">单翼升力 · 模型估计</div>`);
  const liftChart = add(`<svg style="position:absolute;left:42px;top:216px" width="254" height="72"></svg>`);
  const jetFoot = add(`<div class="sm" style="position:absolute;left:42px;top:310px"></div>`);

  // ------------------------------------------------------------ 02 电源
  panel(28, 352, 282, 148, '电源', '02');
  const battPct = add(`<div class="big" style="position:absolute;left:42px;top:384px;font-size:28px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:418px">电量</div>`);
  const cells = add(`<div style="position:absolute;left:150px;top:390px;width:146px;height:16px;display:flex;gap:2px"></div>`);
  for (let i = 0; i < 10; i++) cells.appendChild(el(`<div style="flex:1;background:#e3eaf3;border-radius:1px"></div>`));
  const pDraw = row(42, 462, '功耗');
  const pCell = row(116, 462, '电芯');
  const pMotor = row(190, 462, '电机');

  // ------------------------------------------------------------ 03 翼与足
  panel(28, 514, 282, 300, '翼与足', '03');
  const WING_ROWS = ['拍打 左', '拍打 右', '扭转 左', '扭转 右'];
  const wingBars = WING_ROWS.map((name, i) => {
    const y = 552 + i * 21;
    add(`<div class="sm" style="position:absolute;left:42px;top:${y}px;letter-spacing:.8px">${name}</div>`);
    add(`<div style="position:absolute;left:100px;top:${y + 3}px;width:126px;height:5px;background:#e6ecf3;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:100px;top:${y + 3}px;height:5px;background:${C.or};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;left:232px;top:${y - 2}px;font-size:9.6px;font-weight:600;width:40px;text-align:right"></div>`);
    return {f, v};
  });
  const tipChart = add(`<svg style="position:absolute;left:206px;top:642px" width="88" height="84"></svg>`);
  add(`<div class="sm" style="position:absolute;left:206px;top:730px;letter-spacing:.8px">翼尖轨迹 · 拍打×扭转</div>`);
  const legBars = [];
  const LEG_NAMES = ['足 L1', '足 L2', '足 L3', '足 R1', '足 R2', '足 R3'];
  for (let i = 0; i < 6; i++) {
    const y = 644 + i * 14;
    add(`<div class="mo" style="position:absolute;left:42px;top:${y}px;font-size:8.6px;font-weight:600;color:${C.mute}">${LEG_NAMES[i]}</div>`);
    add(`<div style="position:absolute;left:86px;top:${y + 2}px;width:78px;height:4px;background:#e6ecf3;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:86px;top:${y + 2}px;height:4px;background:${C.sky};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;left:168px;top:${y}px;font-size:8.8px;font-weight:600;width:28px;text-align:right"></div>`);
    legBars.push({f, v});
  }
  add(`<div class="chip" style="left:42px;top:782px">足 6/6 收拢</div>`);

  // ------------------------------------------------------------ 04 飞行
  panel(1313, 126, 258, 208, '飞行', '04');
  const gauge = add(`<svg style="position:absolute;left:1327px;top:160px" width="70" height="70"></svg>`);
  const dRows = ['高度', '垂速', '俯仰', '横滚'].map((n, i) => {
    const y = 160 + i * 26;
    add(`<div class="sm" style="position:absolute;left:1418px;top:${y}px">${n}</div>`);
    return add(`<div class="mo" style="position:absolute;right:${1600 - 1557}px;top:${y - 3}px;font-size:11.5px;font-weight:600"></div>`);
  });
  add(`<div style="position:absolute;left:1327px;top:270px;width:230px;height:1px;background:${C.line}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1327px;top:284px;color:${C.ink};font-weight:700">保持&nbsp;&nbsp;悬停</div>`);
  add(`<div class="sm" style="position:absolute;left:1424px;top:284px">空速</div>`);
  const dSpeed = add(`<div class="mo" style="position:absolute;right:${1600 - 1557}px;top:281px;font-size:11.5px;font-weight:600"></div>`);

  // ------------------------------------------------------------ 05 装配体, 06 显示
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
  panel(1313, 560, 258, 256, '子系统', '07');
  const subRows = SUBSYSTEMS.map(([n, name, sub], i) => {
    const y = 596 + i * 36;
    add(`<div class="pn" style="left:1327px;top:${y + 1}px;right:auto">${n}</div>`);
    add(`<div class="mo" style="position:absolute;left:1352px;top:${y - 3}px;font-size:9.8px;font-weight:700;letter-spacing:1px">${name}</div>`);
    add(`<div class="sm" style="position:absolute;left:1352px;top:${y + 10}px;font-size:7.6px;letter-spacing:1.1px">${sub}</div>`);
    return add(`<div class="chip" style="left:auto;right:${1600 - 1557}px;top:${y - 1}px;justify-content:center"></div>`);
  });

  // ------------------------------------------------------------ mode + 08 飞行日志
  add(`<div class="sm" style="position:absolute;left:340px;top:744px">运行模式</div>`);
  const modeBig = add(`<div style="position:absolute;left:340px;top:758px;font-size:27px;font-weight:700;letter-spacing:-.4px;color:${C.or};line-height:1.05"></div>`);
  const modeSub = add(`<div class="sm" style="position:absolute;left:340px;top:800px;letter-spacing:2px"></div>`);
  panel(508, 734, 782, 126, '飞行日志', '08');
  btn.play = add(`<div class="bt" style="left:524px;top:782px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:14px"></div>`);
  add(`<div class="sm" style="position:absolute;left:590px;top:778px">起飞</div>`);
  const opPhase = add(`<div class="mo" style="position:absolute;left:590px;width:560px;top:777px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:778px">降落</div>`);
  const TL = {x: 592, w: 556};
  add(`<div style="position:absolute;left:${TL.x}px;top:808px;width:${TL.w}px;height:3px;background:#e6ecf3;border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:808px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:802px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const ticks = add(`<div style="position:absolute;inset:0"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:592px;top:824px;font-size:9.4px;color:${C.mute};letter-spacing:1px"></div>`);
  const opActions = add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:824px"></div>`);

  // ------------------------------------------------------------ footer
  add(`<div class="sm" style="position:absolute;left:27px;top:882px;letter-spacing:2.2px">现场模拟器 &nbsp;·&nbsp; 程序化模型 &nbsp;·&nbsp; 2 翼 · 6 足 · 2 光学</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:882px;letter-spacing:2.2px">MELLIS 机器人 · 传粉实验室 <span style="color:${C.or}">////////</span></div>`);

  // ------------------------------------------------------------ labels, the pointer
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
  const fmtClock = (s) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const onBtn = (k, on) => {
    btn[k].style.background = on ? C.or : '#fdfefe';
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
      const load = Math.min(1, s.load);
      const segs = loadBar.children;
      for (let i = 0; i < 40; i++) segs[i].style.background = i / 40 < load ? C.or : '#e3eaf3';
      loadPct.textContent = `${Math.round(load * 100)}%`;
      runtime.textContent = fmtClock(s.t);
      statusTx.textContent = s.status;
      stDot.style.background = s.status === '悬停' ? C.green : C.or;
      // 01 扑翼
      freqBig.innerHTML = `${s.freq.toFixed(0)}<small> Hz</small>`;
      liftBig.innerHTML = `${(s.lift * 1e3).toFixed(2)}<small> mN</small>`;
      {
        const W = 254;
        const H = 72;
        const N = s.chart.length;
        let p = '';
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * W;
          const y = H - 10 - (s.chart[i] / s.chartMax) * (H - 20);
          p += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        const mx = s.chartP * W;
        const my = H - 10 - (s.lift / s.chartMax) * (H - 20);
        liftChart.innerHTML = `<line x1="0" x2="${W}" y1="${H - 10}" y2="${H - 10}" stroke="${C.faint}" stroke-width="1"/>
          <text x="2" y="9" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">升力-相位 · 单翼</text>
          <text x="${W - 20}" y="${H - 1}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">下拍</text>
          <text x="0" y="${H - 1}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">换向</text>
          <path d="${p}" fill="none" stroke="${C.cyan}" stroke-width="1.4"/>
          <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="2.6" fill="${C.or}"/>`;
      }
      jetFoot.innerHTML = `屏上慢放&nbsp;&nbsp;<b style="color:${C.ink}">1/${s.slow}</b>&nbsp;&nbsp;·&nbsp;&nbsp;屏上频率 ${s.freqScreen.toFixed(1)} HZ`;
      // 02 电源
      battPct.innerHTML = `${s.battery.toFixed(0)}<small> %</small>`;
      {
        const nOn = Math.round((s.battery / 100) * 10);
        for (let i = 0; i < 10; i++) cells.children[i].style.background = i < nOn ? (i < 2 ? C.or : C.green) : '#e3eaf3';
      }
      pDraw.textContent = `${s.draw.toFixed(1)} W`;
      pCell.textContent = `${s.cell.toFixed(2)} V`;
      pMotor.textContent = `${s.motor.toFixed(0)} °C`;
      // 03 翼与足
      for (let i = 0; i < 4; i++) {
        wingBars[i].f.style.width = `${(Math.min(1, s.wingBars[i]) * 126).toFixed(1)}px`;
        wingBars[i].v.textContent = `${Math.round(s.wingBars[i] * 100)}%`;
      }
      {
        const W = 88;
        const H = 84;
        const N = s.tipPath.length;
        let p = '';
        for (let i = 0; i < N; i++) {
          const x = W / 2 + s.tipPath[i][0] * 38;
          const y = H / 2 - s.tipPath[i][1] * 38;
          p += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        const [tx, ty2] = s.tipNow;
        tipChart.innerHTML = `<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${C.faint}" stroke-width="1"/>
          <line x1="${W / 2}" x2="${W / 2}" y1="4" y2="${H - 4}" stroke="${C.faint}" stroke-width="1" stroke-dasharray="2 3"/>
          <path d="${p}" fill="none" stroke="${C.sky}" stroke-width="1.2"/>
          <circle cx="${(W / 2 + tx * 38).toFixed(1)}" cy="${(H / 2 - ty2 * 38).toFixed(1)}" r="2.4" fill="${C.or}"/>`;
      }
      for (let i = 0; i < 6; i++) {
        legBars[i].f.style.width = `${(Math.min(1, s.legs[i] / 100) * 78).toFixed(1)}px`;
        legBars[i].v.textContent = `${Math.round(s.legs[i])}%`;
      }
      // 04 飞行
      {
        const a = -Math.PI / 2 + Math.max(-1, Math.min(1, s.pitch / 6)) * 1.1;
        const c = {x: 35, y: 38, r: 26};
        gauge.innerHTML = `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="none" stroke="${C.faint}" stroke-width="1.5"/>
          <path d="M${c.x} ${c.y} L${c.x + 20 * Math.cos(a - 0.5)} ${c.y + 20 * Math.sin(a - 0.5)} M${c.x} ${c.y} L${c.x + 20 * Math.cos(a + 0.5)} ${c.y + 20 * Math.sin(a + 0.5)}" stroke="${C.or}" stroke-width="2"/>
          <circle cx="${c.x}" cy="${c.y}" r="2.4" fill="${C.ink}"/>
          <line x1="6" x2="64" y1="${c.y}" y2="${c.y}" stroke="${C.faint}" stroke-width="1" stroke-dasharray="2 3"/>`;
      }
      dRows[0].textContent = `${s.alt.toFixed(1)} mm`;
      dRows[1].textContent = `${s.vs >= 0 ? '+' : ''}${s.vs.toFixed(1)} mm/s`;
      dRows[2].textContent = `${s.pitch >= 0 ? '+' : ''}${s.pitch.toFixed(2)}°`;
      dRows[3].textContent = `${s.roll >= 0 ? '+' : ''}${s.roll.toFixed(2)}°`;
      dSpeed.textContent = `${s.speed.toFixed(2)} m/s`;
      // 05/06 buttons
      for (const k of ASSEMBLIES) onBtn(k, s.isolate === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      // 07 subsystems
      for (let i = 0; i < 6; i++) {
        const [txt, hot] = s.subsystems[i];
        subRows[i].textContent = txt;
        subRows[i].style.background = hot ? C.or : C.green;
      }
      // mode + log
      modeBig.textContent = s.mode;
      modeSub.textContent = s.modeSub;
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      opPhase.textContent = s.phase;
      const kx = TL.x + s.prog * TL.w;
      tlFill.style.width = `${(s.prog * TL.w).toFixed(1)}px`;
      tlKnob.style.left = `${kx.toFixed(1)}px`;
      tlTime.textContent = `${fmtClock(s.t).slice(3)} / ${fmtClock(s.dur).slice(3)}`;
      opActions.textContent = `${s.actions} 次操作员操作`;
      // labels
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
