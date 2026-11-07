// HUD 框架：1920×1080 设计画布、面板、图表、罗盘、按钮、节拍大字、操作日志、背景装饰、提示条。
// 所有 DOM 都建在 .frame 内，随窗口等比缩放。
import {clamp, lerp, timecode, pad2, fmt} from './util.js';

/** 迷你 DOM 构造器 */
export function h(tag, cls, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  return el;
}

/** 转义文本（用于 innerHTML 模板） */
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

export function createHud(root) {
  // 只替换已有的 HUD，保留 canvas 等其它子节点
  root.querySelectorAll(':scope > .hud').forEach((n) => n.remove());
  const hudEl = h('div', 'hud');
  const frame = h('div', 'frame');

  const deco = h('div', 'deco');
  const callouts = h('div', 'callouts');
  const topbar = h('div', 'topbar');
  const beatEl = h('div', 'beat out');
  const footL = h('div', 'foot l');
  const footR = h('div', 'foot r');
  const toast = h('div', 'toast hide');

  frame.append(deco, callouts, topbar, beatEl, footL, footR, toast);
  hudEl.append(frame);
  root.append(hudEl);

  const viewport = {w: 1920, h: 1080, scale: 1, ox: 0, oy: 0};

  function resize() {
    const w = window.innerWidth || 1920;
    const hgt = window.innerHeight || 1080;
    const s = Math.min(w / 1920, hgt / 1080);
    viewport.w = w;
    viewport.h = hgt;
    viewport.scale = s;
    viewport.ox = (w - 1920 * s) / 2;
    viewport.oy = (hgt - 1080 * s) / 2;
    frame.style.transform = `translate(${viewport.ox}px, ${viewport.oy}px) scale(${s})`;
    return viewport;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---------------------------------------------------------- 顶栏 */
  const brand = h('div', 'brand');
  const logo = h('div', 'logo');
  const topmeta = h('div', 'topmeta');
  topbar.append(logo, brand, topmeta);

  const api = {
    root: hudEl, frame, deco, callouts, topbar, brand, logo, topmeta, beat: beatEl,
    footL, footR, toast, viewport, resize,
    h, esc,
    get frameTransform() { return viewport; },

    /** 顶栏品牌块 */
    setBrand({code = 'OC-8', icon = '', kicker = '', title = '', subtitle = ''}) {
      logo.innerHTML = '';
      if (icon) {
        const s = h('span', 'logo-icon');
        s.innerHTML = icon;
        logo.append(s);
      }
      const c = h('span', 'code', esc(code));
      logo.append(c);
      brand.innerHTML = '';
      if (kicker) brand.append(h('div', 'kicker', esc(kicker)));
      if (title) {
        const t = h('div', 'maintitle');
        t.innerHTML = title; // 允许少量 HTML（如 <span class="slash">/</span>）
        brand.append(t);
      }
      if (subtitle) brand.append(h('div', 'subtitle', esc(subtitle)));
    },

    /** 顶栏右侧数据组：items = [{k, v, mono?, status?:{text, ok?, live?}}] */
    setMeta(items) {
      topmeta.innerHTML = '';
      items.forEach((it) => {
        const col = h('div', 'metacol');
        col.append(h('div', 'k', esc(it.k)));
        const v = h('div', 'v' + (it.mono ? ' mono' : '') + (it.dim ? ' dimv' : ''));
        if (it.status) {
          const row = h('div', 'rowline');
          const dot = h('span', 'dot' + (it.status.ok ? ' ok' : '') + (it.status.live ? ' live' : ''));
          row.append(dot, h('span', null, esc(it.status.text)));
          v.append(row);
        } else {
          v.innerHTML = it.v; // 允许读数逐帧替换
          if (it.id) v.dataset.id = it.id;
        }
        col.append(v);
        topmeta.append(col);
      });
    },

    /** 面板：x/y/w/h 为 1920×1080 画布坐标 */
    addPanel({x, y, w, h: ht, n, title, right = '', body, cls = '', parent}) {
      const p = h('div', 'panel' + (cls ? ' ' + cls : ''));
      if (x != null) p.style.left = x + 'px';
      if (y != null) p.style.top = y + 'px';
      if (w != null) p.style.width = w + 'px';
      if (ht != null) p.style.height = ht + 'px';
      const head = h('div', 'ph');
      head.append(h('span', 'tick'), h('div', 't', esc(title)));
      if (right) {
        const r = h('div', 'badge');
        r.innerHTML = right;
        head.append(r);
      }
      head.append(h('div', 'n', esc(n)));
      p.append(head);
      const b = h('div', 'pbody');
      if (body) b.append(body);
      p.append(b);
      (parent || frame).append(p);
      return {el: p, body: b, head};
    },

    /** 在画布上放任意元素 */
    add(el, {x = 0, y = 0, w, h: ht} = {}) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      if (w) el.style.width = w + 'px';
      if (ht) el.style.height = ht + 'px';
      frame.append(el);
      return el;
    },

    /* -------------------------------------------------------- 背景装饰 */
    addDeco({labels = [], crosses = true, arcs = true} = {}) {
      const parts = [];
      if (arcs) {
        parts.push(`<svg class="deco-svg" viewBox="0 0 1920 1080" fill="none">
          <circle cx="1000" cy="620" r="548" stroke="rgba(30, 70, 130,0.10)" stroke-width="1" stroke-dasharray="2 7"/>
          <circle cx="1000" cy="620" r="742" stroke="rgba(30, 70, 130,0.055)" stroke-width="1"/>
          <path d="M 300 1080 A 900 900 0 0 1 1480 120" stroke="rgba(30, 70, 130,0.10)" stroke-width="1" stroke-dasharray="3 8"/>
          <path d="M 60 300 A 780 780 0 0 1 980 60" stroke="rgba(15, 82, 186,0.10)" stroke-width="1" stroke-dasharray="2 8"/>
          <line x1="290" y1="0" x2="290" y2="1080" stroke="rgba(30, 70, 130,0.05)" stroke-width="1"/>
          <line x1="1630" y1="0" x2="1630" y2="1080" stroke="rgba(30, 70, 130,0.05)" stroke-width="1"/>
          <circle cx="1462" cy="312" r="5" stroke="rgba(30, 70, 130,0.25)" stroke-width="1"/>
          <circle cx="452" cy="268" r="3.5" fill="rgba(15, 82, 186,0.22)"/>
        </svg>`);
      }
      if (crosses) {
        const row = [];
        for (let i = 0; i < 19; i++) {
          const x = 700 + i * 27;
          row.push(`<path d="M ${x - 5} 170 H ${x + 5} M ${x} 165 V 175" stroke="rgba(15, 82, 186,0.30)" stroke-width="1"/>`);
        }
        const row2 = [];
        for (let i = 0; i < 19; i++) {
          const x = 700 + i * 27;
          row2.push(`<path d="M ${x - 5} 191 H ${x + 5} M ${x} 186 V 196" stroke="rgba(30, 70, 130,0.16)" stroke-width="1"/>`);
        }
        parts.push(`<svg class="deco-svg" viewBox="0 0 1920 1080">${row.join('')}${row2.join('')}</svg>`);
      }
      deco.innerHTML = parts.join('');
      labels.forEach((l) => {
        const t = h('div', 'txt' + (l.dim ? ' dim' : ''));
        t.style.left = (l.x ?? 0) + 'px';
        t.style.top = (l.y ?? 0) + 'px';
        t.style.transform = l.rotate ? `rotate(${l.rotate}deg)` : '';
        t.textContent = l.text;
        deco.append(t);
      });
    },

    /* -------------------------------------------------------- 节拍大字 */
    setBeat({mode = '', title = '', sub = '', key = ''}) {
      const sig = key + '|' + title + '|' + sub;
      if (api._beatSig === sig) return;
      api._beatSig = sig;
      api._beatKey = key;
      api._beatTitle = title;
      beatEl.classList.remove('out', 'enter');
      beatEl.innerHTML = `<div class="mode">${esc(mode)}</div><h1>${title}</h1><div class="sub">${esc(sub)}</div>`;
      // 强制 reflow 后加 enter，让 CSS 动画在 live 模式播放（截图时由 .no-anim 关掉）
      void beatEl.offsetWidth;
      beatEl.classList.add('enter');
    },

    /* -------------------------------------------------------- 提示条 */
    showToast(html, remain = 0) {
      toast.innerHTML = html;
      toast.classList.remove('hide');
      clearTimeout(api._toastTimer);
      if (remain > 0) api._toastTimer = setTimeout(() => toast.classList.add('hide'), remain * 1000);
    },
    hideToast() { toast.classList.add('hide'); },

    setFoot({left = '', right = ''}) {
      footL.innerHTML = left;
      footR.innerHTML = right;
    },
  };

  return api;
}

/* ================================================================ 图表 */
/**
 * 折线/面积图。返回 {el, draw({series, xRange, yRange, fill, dots, marks, xLabels, yLabels})}
 * series: [{pts:[[x,y],...], color, width?, dash?, area?, step?}]
 */
export function createChart({
  w = 300, h: ht = 96, pad = {l: 4, r: 26, t: 6, b: 14},
  xRange = [0, 1], yRange = [0, 100], grid = 2, gridColor = 'rgba(30, 70, 130,0.10)',
  font = '8px "JetBrains Mono", monospace', labelColor = 'rgba(17, 28, 46,0.42)',
} = {}) {
  const dpr = 2;
  const canvas = h('canvas', 'chart');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(ht * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = ht + 'px';
  const g = canvas.getContext('2d');

  function draw(opts = {}) {
    const xr = opts.xRange || xRange;
    const yr = opts.yRange || yRange;
    const series = opts.series || [];
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, ht);
    const px = (x) => pad.l + ((x - xr[0]) / (xr[1] - xr[0] || 1)) * (w - pad.l - pad.r);
    const py = (y) => ht - pad.b - ((y - yr[0]) / (yr[1] - yr[0] || 1)) * (ht - pad.t - pad.b);

    // 网格
    if (grid > 0) {
      g.strokeStyle = gridColor;
      g.lineWidth = 1;
      for (let i = 1; i <= grid; i++) {
        const y = pad.t + ((ht - pad.t - pad.b) * i) / (grid + 1);
        g.beginPath();
        g.moveTo(pad.l, Math.round(y) + 0.5);
        g.lineTo(w - pad.r, Math.round(y) + 0.5);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(pad.l, Math.round(ht - pad.b) + 0.5);
      g.lineTo(w - pad.r, Math.round(ht - pad.b) + 0.5);
      g.stroke();
    }

    // 曲线
    series.forEach((s) => {
      const pts = s.pts;
      if (!pts || pts.length < 2) return;
      g.save();
      g.strokeStyle = s.color || '#0f52ba';
      g.lineWidth = s.width ?? 1.4;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      if (s.dash) g.setLineDash(s.dash);
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const X = px(x), Y = py(y);
        if (i === 0) g.moveTo(X, Y);
        else if (s.step) {
          const [pxPrev] = pts[i - 1];
          g.lineTo(X, py(pts[i - 1][1]));
          g.lineTo(X, Y);
          void pxPrev;
        } else g.lineTo(X, Y);
      });
      if (s.area) {
        const last = pts[pts.length - 1], first = pts[0];
        g.lineTo(px(last[0]), py(yr[0]));
        g.lineTo(px(first[0]), py(yr[0]));
        g.closePath();
        g.fillStyle = s.area;
        g.fill();
      } else {
        g.stroke();
      }
      g.restore();
    });

    // 标记点
    (opts.dots || []).forEach((d) => {
      g.beginPath();
      g.fillStyle = d.color || '#0f52ba';
      g.arc(px(d.x), py(d.y), d.r ?? 2.2, 0, Math.PI * 2);
      g.fill();
      if (d.halo) {
        g.beginPath();
        g.strokeStyle = d.halo;
        g.lineWidth = 1;
        g.arc(px(d.x), py(d.y), (d.r ?? 2.2) + 3, 0, Math.PI * 2);
        g.stroke();
      }
    });

    // 垂直标记线
    (opts.marks || []).forEach((m) => {
      g.save();
      g.strokeStyle = m.color || 'rgba(15, 82, 186,0.35)';
      g.setLineDash(m.dash || [2, 3]);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(Math.round(px(m.x)) + 0.5, pad.t);
      g.lineTo(Math.round(px(m.x)) + 0.5, ht - pad.b);
      g.stroke();
      g.restore();
      if (m.label) {
        g.fillStyle = m.labelColor || 'rgba(17, 28, 46,0.5)';
        g.font = font;
        g.textAlign = m.align || 'left';
        g.fillText(m.label, px(m.x) + (m.dx ?? 3), pad.t + 7);
      }
    });

    // 轴标签
    g.font = font;
    g.fillStyle = labelColor;
    if (opts.xLabels) {
      opts.xLabels.forEach((lab) => {
        g.textAlign = lab.align || 'center';
        g.fillText(lab.text, px(lab.x), ht - 3);
      });
    }
    if (opts.yLabels) {
      g.textAlign = 'right';
      opts.yLabels.forEach((lab) => {
        g.fillText(lab.text, w - 2, py(lab.y) + 3);
      });
    }
  }

  return {el: canvas, draw, w, h: ht};
}

/* ================================================================ 罗盘 */
export function createCompass({size = 104, title = ''} = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'compass');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.style.width = size + 'px';
  svg.style.height = size + 'px';
  const c = 60, r = 44;
  const mk = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  };
  svg.append(mk('circle', {cx: c, cy: c, r, class: 'ring2'}));
  svg.append(mk('circle', {cx: c, cy: c, r: r - 3, class: 'ring'}));
  // 刻度
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r0 = r - 3, r1 = r - (i % 6 === 0 ? 11 : 6);
    svg.append(mk('line', {
      x1: c + Math.sin(a) * r0, y1: c - Math.cos(a) * r0,
      x2: c + Math.sin(a) * r1, y2: c - Math.cos(a) * r1,
      class: 'tickline', opacity: i % 6 === 0 ? 0.9 : 0.5,
    }));
  }
  const needle = mk('line', {x1: c, y1: c, x2: c, y2: c - r + 12, class: 'needle'});
  const needle2 = mk('line', {x1: c, y1: c, x2: c, y2: c + 10, class: 'needle2'});
  svg.append(needle, needle2);
  svg.append(mk('circle', {cx: c, cy: c, r: 2.4, fill: '#0f52ba'}));

  const wrap = h('div', 'chartwrap');
  wrap.append(svg);
  if (title) {
    const t = h('div', 'hint');
    t.style.position = 'absolute';
    t.style.left = '0';
    t.style.bottom = '-2px';
    t.textContent = title;
    wrap.append(t);
  }

  return {
    el: wrap,
    update({pitch = 0, roll = 0, wobble = 0} = {}) {
      // 俯仰决定指针上下倾角，滚转决定左右
      const a = clamp(pitch / 90, -1, 1) * 0.9 + wobble;
      const b = clamp(roll / 90, -1, 1) * 0.5;
      const len = r - 12;
      const x = c + Math.sin(b) * len;
      const y = c - Math.cos(a) * len;
      needle.setAttribute('x2', x.toFixed(2));
      needle.setAttribute('y2', y.toFixed(2));
      needle2.setAttribute('x2', (c - Math.sin(b) * 10).toFixed(2));
      needle2.setAttribute('y2', (c + Math.cos(a) * 10).toFixed(2));
    },
  };
}

/* ================================================================ 横条组 */
export function createBars(defs) {
  const wrap = h('div', 'bars');
  const fills = [];
  const pcts = [];
  defs.forEach((d) => {
    const row = h('div', 'bar');
    row.append(h('div', 'lab2', esc(d.label)));
    const track = h('div', 'track');
    const fill = h('div', 'fill' + (d.dim ? ' dim' : ''));
    track.append(fill);
    row.append(track);
    const p = h('div', 'pct', '');
    row.append(p);
    wrap.append(row);
    fills.push(fill);
    pcts.push(p);
  });
  return {
    el: wrap,
    update(values) {
      values.forEach((v, i) => {
        if (!fills[i]) return;
        fills[i].style.width = clamp(v) * 100 + '%';
        const def = defs[i];
        pcts[i].textContent = def.showValue ? def.showValue(v) : Math.round(v * 100) + '%';
        if (def.status) pcts[i].style.color = def.status(v);
      });
    },
  };
}

/* ================================================================ 按钮组 */
export function createButtons(items, onChange, cls = '') {
  const wrap = h('div', 'btnrow' + (cls ? ' ' + cls : ''));
  const els = [];
  items.forEach((it) => {
    const b = h('button', 'btn' + (it.on ? ' on' : ''), esc(it.label));
    b.type = 'button';
    b.addEventListener('click', () => {
      if (it.toggle) {
        it.on = !it.on;
        b.classList.toggle('on', it.on);
      }
      onChange && onChange(it, b);
    });
    wrap.append(b);
    els.push(b);
  });
  return {
    el: wrap,
    set(idxOrKey) {
      items.forEach((it, i) => {
        const on = typeof idxOrKey === 'number' ? i === idxOrKey : it.key === idxOrKey;
        els[i].classList.toggle('on', !!on);
        it.on = !!on;
      });
    },
    items,
    els,
  };
}

/* ================================================================ 状态胶囊 */
export function pill(text, kind = '') {
  return `<span class="pill ${kind}">${esc(text)}</span>`;
}

/* ================================================================ 操作日志（下潜/上浮时间轴） */
export function createOpsPanel({duration = 25, beats = [], onSeek, onToggle, left = '下潜', right = '上浮'} = {}) {
  const el = h('div', 'ops');
  const head = h('div', 'ph2');
  head.innerHTML = `<span class="tick"></span><span>操作日志</span><span class="n">08</span>`;
  const play = h('button', 'ops-play');
  play.type = 'button';
  play.innerHTML = pauseIcon();
  const main = h('div', 'ops-main');
  const ends = h('div', 'ops-ends', `<span>${esc(left)}</span><span>${esc(right)}</span>`);
  const track = h('div', 'ops-track');
  const line = h('div', 'ops-line');
  const fill = h('div', 'ops-fill');
  const dot = h('div', 'ops-dot');
  line.append(fill);
  track.append(line, dot);
  // 刻度：按节拍
  beats.forEach((b) => {
    const tick = h('div', 'ops-tick' + (b.major ? ' major' : ''));
    tick.style.left = (b.t / duration) * 100 + '%';
    track.append(tick);
  });
  const event = h('div', 'ops-event', '');
  track.append(event);
  const meta = h('div', 'ops-meta');
  const tEl = h('span', 't', '00:00 / 00:25');
  const countEl = h('span', '', '');
  meta.append(tEl, countEl);
  main.append(ends, track, meta);
  el.append(head, play, main);

  play.addEventListener('click', () => onToggle && onToggle());
  let dragging = false;
  const seek = (e) => {
    const r = track.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width);
    onSeek && onSeek(x * duration);
  };
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture?.(e.pointerId);
    seek(e);
  });
  track.addEventListener('pointermove', (e) => { if (dragging) seek(e); });
  track.addEventListener('pointerup', () => { dragging = false; });
  track.addEventListener('pointercancel', () => { dragging = false; });

  return {
    el,
    playButton: play,
    set({t = 0, playing = true, event: ev = '', count = ''} = {}) {
      const k = clamp(t / duration);
      fill.style.width = k * 100 + '%';
      dot.style.left = k * 100 + '%';
      tEl.textContent = `${timecode(t)} / ${timecode(duration)}`;
      if (ev) event.textContent = ev;
      if (count !== '') countEl.textContent = count;
      play.innerHTML = playing ? pauseIcon() : playIcon();
    },
  };
}

export function pauseIcon() {
  return '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.4" y="2.6" width="3.1" height="10.8" rx="0.6"/><rect x="9.5" y="2.6" width="3.1" height="10.8" rx="0.6"/></svg>';
}
export function playIcon() {
  return '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.6 2.9 12.8 8l-8.2 5.1z"/></svg>';
}

/** 把一组 3D 标注数据渲染进 callouts 容器（需配合 annotate.js 使用） */
export function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export {timecode, pad2, fmt};
