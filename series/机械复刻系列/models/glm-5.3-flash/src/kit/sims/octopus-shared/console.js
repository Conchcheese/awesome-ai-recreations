// The Pelagos OC-8 console, laid out at 1600 x 900 like the reference frames: the orange OC-8
// badge and the title, the jet-load strip, sim id / runtime / status / operator, the 01 JET,
// 02 POWER and 03 ARM CURL panels down the left, 04 DEPTH, 05 ASSEMBLIES, 06 DISPLAY and
// 07 SUBSYSTEMS down the right, the operating-mode line and the 08 OPERATION LOG along the
// bottom, plus the labels with leaders and the operator's pointer. update(s) redraws every
// live part from the frame's state — no number on screen is typed in.
export const C = {ink: '#22282c', mute: '#8794a0', faint: '#d2dcdf', line: '#e2e9ec', panel: 'rgba(250,252,253,.95)', or: '#2f9fe0', green: '#2a9d8f'};
export const ASSEMBLIES = ['hero', 'optics', 'mantle', 'arm2', 'siphon', 'beak'];
export const ASM_LABEL = {hero: '主视角', optics: '光学', mantle: '外套膜', arm2: 'R2 臂', siphon: '虹吸', beak: '喙'};
export const DISPLAY = ['labels', 'exploded', 'wake', 'turntable'];
export const DISPLAY_LABEL = {labels: '标注', exploded: '拆解', wake: '喷射尾流', turntable: '转台'};
const SUBSYSTEMS = [
  ['01', '光学阵列', '2 × 82 毫米镜头 · IR 圈'],
  ['02', '外套膜壳', '8 壳瓣 · 玻璃舷窗'],
  ['03', '泵核', '反应环 · 7 活塞'],
  ['04', '臂链', '202 节 · 480 轮'],
  ['05', '虹吸', '3 套筒 · 6 瓣喷口'],
  ['06', '喙', '双颚 · 齿舌环'],
];

const CSS = `
#app{font-family:Inter,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,'PingFang SC','Microsoft YaHei',monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(120,90,50,.08)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.big{font-size:34px;font-weight:700;letter-spacing:-.5px;line-height:1}
.big small{font-size:13px;font-weight:600;color:${C.mute};letter-spacing:0}
.bt{position:absolute;height:21px;padding:0 9px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fffdf9;font:700 9.2px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap}
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
  add(`<svg style="position:absolute;left:24px;top:28px" width="52" height="34"><g fill="#fff"><circle cx="12" cy="21" r="8"/><path d="M6 26q-4 6 -1 8M12 28q0 7 3 7M18 26q4 6 1 8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="20" cy="12" r="5.5" fill="none" stroke="#fff" stroke-width="2.4"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:84px;top:36px;color:#fff;font-size:15px;font-weight:600;letter-spacing:3.4px">OC-8</div>`);
  add(`<div class="sm" style="position:absolute;left:200px;top:18px;letter-spacing:2.4px">机器人头足类 · 八臂水下无人机</div>`);
  add(`<div style="position:absolute;left:199px;top:33px;font-size:32px;font-weight:700;letter-spacing:-.6px;line-height:1">Pelagos OC-8 <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:200px;top:73px;font-size:10.6px;letter-spacing:2.2px;color:#6d6357">软臂机械手 / 现场模拟器</div>`);
  // jet load strip
  add(`<div class="sm" style="position:absolute;left:842px;top:22px">喷射负载</div>`);
  const loadPct = add(`<div class="mo" style="position:absolute;left:1118px;top:20px;font-size:11px;font-weight:700;text-align:right;width:44px"></div>`);
  const loadBar = add(`<div style="position:absolute;left:842px;top:40px;width:320px;height:11px;display:flex;gap:2px"></div>`);
  for (let i = 0; i < 40; i++) loadBar.appendChild(el(`<div style="flex:1;background:#dfe7ea;border-radius:1px"></div>`));
  add(`<div class="sm" style="position:absolute;left:842px;top:60px;letter-spacing:1.4px">待机</div>`);
  add(`<div class="sm" style="position:absolute;left:968px;top:60px;letter-spacing:1.4px">巡航</div>`);
  add(`<div class="sm" style="position:absolute;left:1112px;top:60px;letter-spacing:1.4px">爆发</div>`);
  // sim id, runtime, status, operator
  add(`<div class="sm" style="position:absolute;left:1300px;top:24px">模拟编号</div>`);
  add(`<div class="mo" style="position:absolute;left:1300px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px">OC8-0731</div>`);
  add(`<div class="sm" style="position:absolute;left:1412px;top:24px">运行时间</div>`);
  const runtime = add(`<div class="mo" style="position:absolute;left:1412px;top:42px;font-size:12px;font-weight:600;letter-spacing:1.2px"></div>`);
  add(`<div style="position:absolute;left:1518px;top:22px;width:1px;height:52px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:24px">状态</div>`);
  const stDot = add(`<div style="position:absolute;left:1532px;top:44px;width:7px;height:7px;border-radius:50%;background:${C.or}"></div>`);
  const statusTx = add(`<div class="mo" style="position:absolute;left:1544px;top:40px;font-size:9.5px;font-weight:700;letter-spacing:.6px;white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:1530px;top:60px">操作员</div>`);
  add(`<div class="mo" style="position:absolute;left:1524px;top:76px;font-size:9.5px;font-weight:600;letter-spacing:.6px;white-space:nowrap">二号水槽 · M.S.</div>`);
  // crosshair field
  {
    let h = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) h += `<path d="M${c * 22 + 4} ${r * 22}v7M${c * 22} ${r * 22 + 3.5}h7" stroke="${C.or}" stroke-width="1" opacity=".5"/>`;
    add(`<svg style="position:absolute;left:812px;top:96px" width="360" height="40">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 JET
  panel(28, 126, 282, 226, '喷射', '01');
  const jetKpa = add(`<div class="big" style="position:absolute;left:42px;top:158px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:198px">外套膜压力</div>`);
  const jetN = add(`<div class="big" style="position:absolute;left:200px;top:158px;font-size:26px;text-align:right;width:96px"></div>`);
  add(`<div class="sm" style="position:absolute;left:212px;top:198px">推力</div>`);
  const jetChart = add(`<svg style="position:absolute;left:42px;top:216px" width="254" height="86"></svg>`);
  const jetFoot = add(`<div class="sm" style="position:absolute;left:42px;top:326px"></div>`);

  // ------------------------------------------------------------ 02 POWER
  panel(28, 366, 282, 178, '电源', '02');
  const battPct = add(`<div class="big" style="position:absolute;left:42px;top:398px;font-size:28px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:432px">电量</div>`);
  const cells = add(`<div style="position:absolute;left:150px;top:404px;width:146px;height:16px;display:flex;gap:2px"></div>`);
  for (let i = 0; i < 10; i++) cells.appendChild(el(`<div style="flex:1;background:#dfe7ea;border-radius:1px"></div>`));
  const pDraw = row(42, 486, '功耗');
  const pCell = row(116, 486, '电芯');
  const pMotor = row(190, 486, '电机');

  // ------------------------------------------------------------ 03 ARM CURL
  panel(28, 558, 282, 258, '臂弯曲', '03');
  add(`<div class="sm" style="position:absolute;left:42px;top:592px">每臂弯曲 · 顶端螺旋</div>`);
  add(`<div class="chip" style="left:238px;top:588px">弯曲中</div>`);
  const curlBars = [];
  for (let i = 0; i < 8; i++) {
    const y = 616 + i * 24;
    const name = i < 4 ? `R${i + 1}` : `L${i - 3}`;
    add(`<div class="mo" style="position:absolute;left:42px;top:${y}px;font-size:9.4px;font-weight:600;color:${C.mute}">${name}</div>`);
    add(`<div style="position:absolute;left:74px;top:${y + 3}px;width:172px;height:5px;background:#e6ecee;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:74px;top:${y + 3}px;height:5px;background:${C.or};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;left:256px;top:${y - 2}px;font-size:9.6px;font-weight:600;width:40px;text-align:right"></div>`);
    curlBars.push({f, v});
  }

  // ------------------------------------------------------------ 04 DEPTH
  panel(1313, 126, 258, 208, '深度', '04');
  const gauge = add(`<svg style="position:absolute;left:1327px;top:160px" width="70" height="70"></svg>`);
  const dRows = ['深度', '垂速', '俯仰', '横滚'].map((n, i) => {
    const y = 160 + i * 26;
    add(`<div class="sm" style="position:absolute;left:1418px;top:${y}px">${n}</div>`);
    return add(`<div class="mo" style="position:absolute;right:${1600 - 1557}px;top:${y - 3}px;font-size:11.5px;font-weight:600"></div>`);
  });
  add(`<div style="position:absolute;left:1327px;top:270px;width:230px;height:1px;background:${C.line}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1327px;top:284px;color:${C.ink};font-weight:700">保持&nbsp;&nbsp;站位</div>`);
  add(`<div class="sm" style="position:absolute;left:1424px;top:284px">速度</div>`);
  const dSpeed = add(`<div class="mo" style="position:absolute;right:${1600 - 1557}px;top:281px;font-size:11.5px;font-weight:600"></div>`);

  // ------------------------------------------------------------ 05 ASSEMBLIES, 06 DISPLAY
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

  // ------------------------------------------------------------ 07 SUBSYSTEMS
  panel(1313, 560, 258, 256, '子系统', '07');
  const subRows = SUBSYSTEMS.map(([n, name, sub], i) => {
    const y = 596 + i * 36;
    add(`<div class="pn" style="left:1327px;top:${y + 1}px;right:auto">${n}</div>`);
    add(`<div class="mo" style="position:absolute;left:1352px;top:${y - 3}px;font-size:9.8px;font-weight:700;letter-spacing:1px">${name}</div>`);
    add(`<div class="sm" style="position:absolute;left:1352px;top:${y + 10}px;font-size:7.6px;letter-spacing:1.1px">${sub}</div>`);
    return add(`<div class="chip" style="left:auto;right:${1600 - 1557}px;top:${y - 1}px;justify-content:center"></div>`);
  });

  // ------------------------------------------------------------ operating mode + 08 operation log
  add(`<div class="sm" style="position:absolute;left:340px;top:744px">运行模式</div>`);
  const modeBig = add(`<div style="position:absolute;left:340px;top:758px;font-size:27px;font-weight:700;letter-spacing:-.4px;color:${C.or};line-height:1.05"></div>`);
  const modeSub = add(`<div class="sm" style="position:absolute;left:340px;top:800px;letter-spacing:2px"></div>`);
  panel(508, 734, 782, 126, '操作日志', '08');
  btn.play = add(`<div class="bt" style="left:524px;top:782px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:14px"></div>`);
  add(`<div class="sm" style="position:absolute;left:590px;top:778px">下潜</div>`);
  const opPhase = add(`<div class="mo" style="position:absolute;left:590px;width:560px;top:777px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:778px">上浮</div>`);
  const TL = {x: 592, w: 556};
  add(`<div style="position:absolute;left:${TL.x}px;top:808px;width:${TL.w}px;height:3px;background:#e6ecee;border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:808px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:802px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  // beat ticks on the log timeline
  const ticks = add(`<div style="position:absolute;inset:0"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:592px;top:824px;font-size:9.4px;color:${C.mute};letter-spacing:1px"></div>`);
  const opActions = add(`<div class="sm" style="position:absolute;right:${1600 - 1274}px;top:824px">0 OPERATOR ACTIONS</div>`);

  // ------------------------------------------------------------ footer
  add(`<div class="sm" style="position:absolute;left:27px;top:882px;letter-spacing:2.2px">现场模拟器 &nbsp;·&nbsp; 程序化模型 &nbsp;·&nbsp; 8 臂 · 2 光学 · 1 虹吸</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:882px;letter-spacing:2.2px">PELAGOS 海洋机器人 · 深海实验室 <span style="color:${C.or}">////////</span></div>`);

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
  const fmt = (s) => `00:${String(Math.floor(s)).padStart(2, '0')}`;
  const fmtClock = (s) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const onBtn = (k, on) => {
    btn[k].style.background = on ? C.or : '#fffdf9';
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
      // header
      const load = Math.min(1, s.load);
      const segs = loadBar.children;
      for (let i = 0; i < 40; i++) segs[i].style.background = i / 40 < load ? C.or : '#dfe7ea';
      loadPct.textContent = `${Math.round(load * 100)}%`;
      runtime.textContent = fmtClock(s.t);
      statusTx.textContent = s.status;
      stDot.style.background = s.status === 'HOLDING' ? C.green : C.or;
      // 01 jet
      jetKpa.innerHTML = `${Math.round(s.pressure)}<small> kPa</small>`;
      jetN.innerHTML = `${s.thrust.toFixed(0)}<small> N</small>`;
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
          <text x="2" y="${H - 12 - 97}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">100 kPa</text>
          <text x="${W - 24}" y="${H - 2}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">此刻</text>
          <text x="0" y="${H - 2}" font-size="6.6" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">-1.2 秒</text>
          <path d="${p}" fill="none" stroke="${C.or}" stroke-width="1.4"/>
          <circle cx="${lx}" cy="${ly.toFixed(1)}" r="2.6" fill="${C.or}"/>`;
      }
      jetFoot.innerHTML = `脉冲&nbsp;&nbsp;<b style="color:${C.ink}">${s.pulseHz.toFixed(1)} HZ</b>&nbsp;&nbsp;&nbsp;&nbsp;${s.siphonNote}`;
      // 02 power
      battPct.innerHTML = `${s.battery.toFixed(0)}<small> %</small>`;
      {
        const nOn = Math.round((s.battery / 100) * 10);
        for (let i = 0; i < 10; i++) cells.children[i].style.background = i < nOn ? (i < 2 ? C.or : C.green) : '#dfe7ea';
      }
      pDraw.textContent = `${s.draw.toFixed(1)} W`;
      pCell.textContent = `${s.cell.toFixed(2)} V`;
      pMotor.textContent = `${s.motor.toFixed(0)} °C`;
      // 03 arm curl
      for (let i = 0; i < 8; i++) {
        curlBars[i].f.style.width = `${(Math.min(1, s.curl[i] / 100) * 172).toFixed(1)}px`;
        curlBars[i].v.textContent = `${Math.round(s.curl[i])}%`;
      }
      // 04 depth
      {
        const a = -Math.PI / 2 + Math.max(-1, Math.min(1, (12.6 - s.depth) / 0.6)) * 1.1;
        const c = {x: 35, y: 38, r: 26};
        gauge.innerHTML = `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="none" stroke="${C.faint}" stroke-width="1.5"/>
          <path d="M${c.x} ${c.y} L${c.x + 20 * Math.cos(a - 0.5)} ${c.y + 20 * Math.sin(a - 0.5)} M${c.x} ${c.y} L${c.x + 20 * Math.cos(a + 0.5)} ${c.y + 20 * Math.sin(a + 0.5)}" stroke="${C.or}" stroke-width="2"/>
          <circle cx="${c.x}" cy="${c.y}" r="2.4" fill="${C.ink}"/>
          <line x1="6" x2="64" y1="${c.y}" y2="${c.y}" stroke="${C.faint}" stroke-width="1" stroke-dasharray="2 3"/>`;
      }
      dRows[0].textContent = `${s.depth.toFixed(2)} M`;
      dRows[1].textContent = `${s.vs >= 0 ? '+' : ''}${s.vs.toFixed(2)} M/S`;
      dRows[2].textContent = `${s.pitch >= 0 ? '+' : ''}${s.pitch.toFixed(1)}°`;
      dRows[3].textContent = `${s.roll >= 0 ? '+' : ''}${s.roll.toFixed(1)}°`;
      dSpeed.textContent = `${s.speed.toFixed(2)} M/S`;
      // 05/06 buttons
      for (const k of ASSEMBLIES) onBtn(k, s.isolate === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      // 07 subsystems
      for (let i = 0; i < 6; i++) {
        const [txt, hot] = s.subsystems[i];
        subRows[i].textContent = txt;
        subRows[i].style.background = hot ? C.or : C.green;
      }
      // mode line + log
      modeBig.textContent = s.mode;
      modeSub.textContent = s.modeSub;
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      opPhase.textContent = s.phase;
      const kx = TL.x + s.prog * TL.w;
      tlFill.style.width = `${(s.prog * TL.w).toFixed(1)}px`;
      tlKnob.style.left = `${kx.toFixed(1)}px`;
      tlTime.textContent = `${fmt(s.t)} / ${fmt(s.dur)}`;
      opActions.textContent = `${s.actions} 次操作员操作`;
      // labels: an orange square, the name, the note, a thin leader to the part
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
