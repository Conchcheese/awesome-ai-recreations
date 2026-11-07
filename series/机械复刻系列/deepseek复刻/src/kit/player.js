// 页面运行时：接管 rAF 循环，暴露 window.__sim 给逐帧截图/录片使用。
// sim 需要提供：{duration, frame(t), onResize?, onKey?}
import {clamp} from './util.js';

export function startSim(sim, {mode = 'live'} = {}) {
  const duration = sim.duration ?? 25;
  let t = 0;
  let paused = mode === 'film';
  let ready = false;

  function draw() {
    sim.frame(t);
    ready = true;
  }

  window.__sim = {
    mode,
    duration,
    get ready() { return ready; },
    get time() { return t; },
    renderFrame(time) {
      paused = true;
      // 截图/录片：关掉全部 CSS 动画，保证同一 t 永远同一帧
      document.documentElement.classList.add('no-anim');
      t = clamp(Number(time) || 0, 0, duration);
      draw();
    },
    play() { paused = false; },
    pause() { paused = true; },
    // 只改时间、不改变播放状态（互动页点操作日志跳转时用）
    setTime(time) {
      t = clamp(Number(time) || 0, 0, duration);
      draw();
    },
    get paused() { return paused; },
    sim,
  };

  // 调试快捷键：H 隐藏 HUD，空格 暂停/播放
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      const hud = document.querySelector('.hud');
      if (hud) hud.classList.toggle('hidden');
    }
    if (e.code === 'Space') {
      paused = !paused;
      e.preventDefault();
    }
    sim.onKey && sim.onKey(e);
  });

  window.addEventListener('resize', () => {
    sim.onResize && sim.onResize();
    draw();
  });

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) {
      t += dt;
      if (t > duration) t = mode === 'film' ? 0 : duration;
    }
    if (!ready) draw();
    else if (!paused) draw();
    requestAnimationFrame(tick);
  }

  // 字体就绪后再渲一帧，保证截图中文不闪
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => draw());
  }
  draw();
  requestAnimationFrame(tick);
  return window.__sim;
}
