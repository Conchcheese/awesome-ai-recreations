// Film page: plays the shot list on the same model used by the research page
// and by the offline renderer.

import { createStage } from './stage.js';
import { SHOTS, SOURCE_DURATION, FPS } from './shots.mjs';

const container = document.getElementById('view');
const stage = createStage(container, { film: true });
const { state } = stage;

const scrub = document.getElementById('scrub');
const label = document.getElementById('label');
const clock = document.getElementById('clock');
const playBtn = document.getElementById('play');

let playing = true;
playBtn.addEventListener('click', () => {
  playing = !playing;
  playBtn.textContent = playing ? '暂停' : '播放';
});
container.addEventListener('click', () => {
  playing = !playing;
  playBtn.textContent = playing ? '暂停' : '播放';
});

scrub.addEventListener('input', (ev) => {
  stage.setTime(parseFloat(ev.target.value));
});

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) stage.setTime((state.t + dt) % SOURCE_DURATION);
  stage.applyPose();
  stage.useFilmCamera(state.t);
  scrub.value = String(state.t);
  const shot = SHOTS.find((s) => state.t >= s.from && state.t < s.to) || SHOTS[0];
  label.textContent = `${shot.label} · ${shot.id}`;
  clock.textContent = `${state.t.toFixed(2)} / ${SOURCE_DURATION.toFixed(2)} s · ${FPS} fps`;
  stage.renderer.render(stage.scene, stage.camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.__bb = { stage, setTime: (t) => stage.setTime(t) };
