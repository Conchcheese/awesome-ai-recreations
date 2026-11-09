// 3D → 屏幕标注：引线 + 文字标签（技术模拟器风格）。
// 用法：const ann = createAnnotations({hud, studio}); ann.add({getWorld,text,sub,side}); ann.update();
import {h} from './hud.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createAnnotations({hud, studio, width = 1920, height = 1080}) {
  const container = hud.callouts;
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  container.append(svg);

  const items = [];

  function add({
    getWorld, text = '', sub = '', side = 'right', dist = 92, dy = 0,
    className = '', lineColor = 'rgba(15, 82, 186,0.5)', dotColor = '#0f52ba',
    visible = () => true, elbow = 26,
  }) {
    const el = h('div', 'callout ' + side + (className ? ' ' + className : ''));
    el.innerHTML = `${text}${sub ? `<span class="s">${sub}</span>` : ''}`;
    container.append(el);

    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('class', 'callout-line');
    line.setAttribute('stroke', lineColor);
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'callout-dot');
    dot.setAttribute('r', '2.6');
    dot.setAttribute('fill', '#fff');
    dot.setAttribute('stroke', dotColor);
    svg.append(line, dot);

    const item = {
      el, line, dot, getWorld, visible,
      side, dist, dy, elbow,
      setVisible(v) { item.forceHidden = !v; },
      set(text2, sub2) {
        el.innerHTML = `${text2}${sub2 ? `<span class="s">${sub2}</span>` : ''}`;
      },
    };
    items.push(item);
    return item;
  }

  function update() {
    const {scale, ox, oy, w, h: hh} = hud.viewport;
    const W = width, H = height;
    items.forEach((it) => {
      const world = it.getWorld ? it.getWorld() : null;
      const vis = !it.forceHidden && (it.visible ? it.visible() : true) && world;
      if (!vis) {
        it.el.classList.add('hide');
        it.line.style.opacity = 0;
        it.dot.style.opacity = 0;
        return;
      }
      const p = studio.project(world);
      // 窗口像素 → 设计画布坐标
      const fx = (p.x - ox) / scale;
      const fy = (p.y - oy) / scale;
      const behind = p.z > 1 || fx < -80 || fx > W + 80 || fy < -80 || fy > H + 80;
      if (behind) {
        it.el.classList.add('hide');
        it.line.style.opacity = 0;
        it.dot.style.opacity = 0;
        return;
      }
      it.el.classList.remove('hide');
      it.line.style.opacity = 1;
      it.dot.style.opacity = 1;
      void w; void hh;

      // 侧别从元素 class 里取
      const cls = it.el.className;
      const isLeft = /\bleft\b/.test(cls);
      const dir = isLeft ? -1 : 1;
      const distPx = it.dist ?? 92;
      const elbowX = fx + dir * it.elbow;
      const labelX = fx + dir * distPx;
      const labelY = fy + it.dy;

      if (isLeft) {
        it.el.style.left = labelX + 'px';
        it.el.style.top = labelY + 'px';
        it.el.style.transform = `translate(-100%, -50%)`;
      } else {
        it.el.style.left = labelX + 'px';
        it.el.style.top = labelY + 'px';
        it.el.style.transform = `translate(0, -50%)`;
      }

      const midY = fy + (labelY - fy) * 0.45;
      const d = isLeft
        ? `M ${fx} ${fy} L ${elbowX} ${fy} L ${fx + dir * (distPx - 10)} ${midY} L ${labelX + 6} ${labelY}`
        : `M ${fx} ${fy} L ${elbowX} ${fy} L ${fx + dir * (distPx - 10)} ${midY} L ${labelX - 6} ${labelY}`;
      it.line.setAttribute('d', d);
      it.dot.setAttribute('cx', fx.toFixed(1));
      it.dot.setAttribute('cy', fy.toFixed(1));
      it.line.style.display = '';
      it.dot.style.display = '';
    });
  }

  return {add, update, items, container};
}
