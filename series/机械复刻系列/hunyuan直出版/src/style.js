// style.js —— 界面样式（内联字符串，构建时随 JS 一起打进单文件 HTML）。
// 设计画布固定 1920×1080，运行时整体缩放，保证标签物理字号 ≥ 34 px。
export const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#e7eff9}
body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif;
     color:#eaf3ff;-webkit-font-smoothing:antialiased;user-select:none}
#app{position:fixed;inset:0;overflow:hidden;background:#eaf2fc}
#scene{position:absolute;inset:0;width:100%;height:100%;display:block}
#hud{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;pointer-events:none;
     font-size:34px;letter-spacing:.02em}
#hud .pe{pointer-events:auto}

/* 顶部状态条 */
.bar-top{position:absolute;left:0;top:0;width:1920px;height:88px;display:flex;align-items:center;
  background:linear-gradient(90deg,rgba(7,20,41,.96),rgba(11,38,80,.90) 58%,rgba(7,20,41,.96));
  border-bottom:3px solid #0f52ba;box-shadow:0 8px 28px rgba(6,22,48,.28)}
.brand{width:530px;padding-left:34px;display:flex;align-items:center;gap:20px}
.brand .mark{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;font-size:30px;font-weight:800;
  color:#fff;background:linear-gradient(135deg,#4a86e8,#0f52ba 55%,#0a357a);box-shadow:0 0 22px rgba(74,134,232,.55)}
.brand .t1{font-size:36px;font-weight:800;line-height:1.05;letter-spacing:.06em}
.brand .t2{font-size:28px;color:#9fc0ef;line-height:1.35}
.shots{display:flex;align-items:center;gap:9px;flex:1;justify-content:center}
.shot-tick{width:62px;height:46px;border-radius:9px;background:rgba(120,170,240,.13);
  border:1px solid rgba(120,170,240,.30);display:grid;place-items:center;font-size:30px;color:#a9c8f2;font-variant-numeric:tabular-nums}
.shot-tick.on{background:#0f52ba;border-color:#8ab4ff;color:#fff;box-shadow:0 0 20px rgba(74,134,232,.8);font-weight:800}
.shot-tick.past{background:rgba(15,82,186,.42);color:#dbe9ff}
.status-r{width:430px;padding-right:34px;text-align:right}
.tc{font-size:40px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.04em;line-height:1}
.tc small{font-size:28px;color:#9fc0ef;font-weight:500}
.pill{display:inline-block;margin-top:3px;padding:1px 16px;border-radius:999px;font-size:28px;
  background:rgba(34,197,124,.16);border:1px solid rgba(58,222,150,.62);color:#7ff0bb}

/* 侧栏面板 */
.panel{position:absolute;background:rgba(8,24,50,.88);border:1px solid rgba(96,156,240,.44);
  border-radius:16px;box-shadow:0 12px 34px rgba(6,20,44,.30),inset 0 1px 0 rgba(180,215,255,.09);
  padding:14px 20px;overflow:hidden}
.panel:before{content:"";position:absolute;left:0;top:0;width:5px;height:100%;background:#0f52ba}
.panel h3{font-size:34px;font-weight:700;color:#cfe2ff;line-height:1;letter-spacing:.04em;
  display:flex;align-items:center;justify-content:space-between}
.panel h3 em{font-style:normal;font-size:28px;color:#7fa9e6;font-weight:500;white-space:nowrap}
.col-l{left:34px;width:376px}
.col-r{left:1510px;width:376px}
.hr{height:1px;background:linear-gradient(90deg,rgba(96,156,240,.55),rgba(96,156,240,0));margin:9px 0 8px}
.kv{display:flex;justify-content:space-between;align-items:baseline;font-size:30px;color:#a8c6ef;line-height:1.42}
.kv b{font-size:36px;color:#f2f8ff;font-weight:700;font-variant-numeric:tabular-nums}
.kv b span{font-size:26px;color:#8fb4e9;font-weight:500;margin-left:5px}
.big{font-size:78px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:#fff;
   text-shadow:0 0 26px rgba(74,134,232,.55)}
.big span{font-size:32px;color:#9fc0ef;font-weight:600;margin-left:8px}
.sub{font-size:28px;color:#8fb4e9;line-height:1.35;white-space:nowrap}
.chart{display:block;width:100%;height:104px;margin-top:4px}
.rows{margin-top:4px}
.row{display:flex;align-items:center;gap:8px;font-size:28px;color:#bcd5f7;line-height:1.10;white-space:nowrap}
.row .nm{width:94px;flex:none}
.row .track{height:11px;flex:1;border-radius:8px;background:rgba(120,170,240,.17);overflow:hidden}
.row .fill{height:100%;border-radius:8px;background:linear-gradient(90deg,#0f52ba,#4a86e8)}
.row .vl{width:56px;text-align:right;font-variant-numeric:tabular-nums;color:#eaf3ff}
.panel svg{display:block}
.ok{color:#7ff0bb}

/* 底部节拍条 */
.bar-bot{position:absolute;left:0;bottom:0;width:1920px;height:176px;
  background:linear-gradient(0deg,rgba(6,18,39,.97),rgba(8,26,56,.90) 72%,rgba(8,26,56,0));
  border-top:2px solid rgba(96,156,240,.35);padding:10px 34px 12px}
.beat-line{display:flex;align-items:baseline;gap:26px;height:76px}
.beat-no{font-size:62px;font-weight:800;color:#0f52ba;-webkit-text-stroke:1.5px #8ab4ff;line-height:1;
  text-shadow:0 0 24px rgba(74,134,232,.65);font-variant-numeric:tabular-nums}
.beat-name{font-size:64px;font-weight:800;color:#fff;line-height:1;letter-spacing:.05em;
  text-shadow:0 0 30px rgba(15,82,186,.75)}
.beat-note{font-size:32px;color:#a9c8f2;flex:1;white-space:nowrap}
.beat-pct{font-size:36px;color:#7fa9e6;font-variant-numeric:tabular-nums}
.timeline{position:relative;height:70px;margin-top:2px}
.tl-track{position:absolute;left:10px;right:0;top:46px;height:12px;border-radius:8px;background:rgba(120,170,240,.20);overflow:hidden}
.tl-fill{height:100%;width:0;border-radius:8px;background:linear-gradient(90deg,#0a357a,#0f52ba,#4a86e8);
  box-shadow:0 0 18px rgba(74,134,232,.8)}
.tl-seg{position:absolute;top:0;font-size:30px;color:#8fb4e9;transform:translateX(-50%);
  font-variant-numeric:tabular-nums;white-space:nowrap}
.tl-seg.on{color:#fff;font-weight:800;text-shadow:0 0 16px #4a86e8}
.tl-head{position:absolute;top:40px;width:4px;height:24px;background:#fff;border-radius:3px;
  box-shadow:0 0 14px #8ab4ff;transform:translateX(-2px)}

/* 3D 引线标注 */
#leads{position:absolute;inset:0;width:1920px;height:1080px;overflow:visible}
.lead-label{position:absolute;padding:6px 16px;border-radius:8px;font-size:34px;white-space:nowrap;
  background:rgba(8,24,50,.90);border:1px solid #4a86e8;color:#eaf3ff;
  box-shadow:0 0 20px rgba(15,82,186,.45);transform:translate(0,-50%)}

/* 控制按钮 */
.controls{position:absolute;left:50%;bottom:186px;transform:translateX(-50%);
  display:flex;flex-direction:row;gap:10px;align-items:center}
.btn{min-width:0;padding:6px 16px;border-radius:10px;font-size:28px;text-align:center;white-space:nowrap;
  background:rgba(8,24,50,.88);border:1px solid #4a86e8;color:#dcebff;cursor:pointer}
.btn:hover{background:#0f52ba;color:#fff}
.btn.on{background:#0f52ba;color:#fff;box-shadow:0 0 18px rgba(74,134,232,.7)}
.hidden{display:none !important}

/* 影片页：HUD 分层淡出。面板压到只剩轮廓（腕足从上面经过也不显脏），
   顶部时间码与底部节拍条保留可读，3D 引线标注留一半。 */
body[data-film="1"] .panel{opacity:.28}
body[data-film="1"] .bar-top{opacity:.72}
body[data-film="1"] .bar-bot{opacity:.60}
body[data-film="1"] #leads{opacity:.55}
body[data-film="1"] .lead-label{opacity:.72}
`;
