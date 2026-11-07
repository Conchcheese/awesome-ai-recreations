/* HY4 · 原创程序化音轨（48kHz / 16bit / 立体声 / 28s）
 * 全部由振荡器、包络与确定性噪声合成，没有采样电影配乐或第三方音频。
 * 声音事件与 camera.mjs 的镜头表对齐：0 车辆建立 / 4 变形 / 15 亮相 /
 * 19 头胸 / 22 下肢 / 24.5 拆解 / 26.5 重组 / 28 落幅。
 * 执行：node tools/audio.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SR = 48000, DUR = 28, N = SR * DUR;
const L = new Float64Array(N), Rr = new Float64Array(N);

/* 确定性伪随机噪声，保证每次生成的 WAV 完全一致 */
let seed = 20261106;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const TAU = Math.PI * 2;
const env = (t, a, d) => t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d);

/* 1 · 低频持续声床：两段失谐正弦 + 缓慢 LFO */
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const lfo = .72 + .28 * Math.sin(TAU * .13 * t);
  const bed = (Math.sin(TAU * 55 * t) * .55 + Math.sin(TAU * 82.4 * t + .4) * .28 +
               Math.sin(TAU * 110.1 * t) * .12) * .20 * lfo;
  L[i] += bed; Rr[i] += bed * .96;
}

/* 2 · 引擎/机械脉冲：0–15s，8Hz 方波经平滑 + 低通噪声 */
for (let i = 0; i < N; i++) {
  const t = i / SR;
  if (t > 15.4) break;
  const gate = t < 4 ? .85 : t < 15 ? 1 : Math.max(0, 1 - (t - 15) / .4);
  const phase = (t * 8.2) % 1;
  const pulse = Math.tanh(Math.sin(TAU * phase) * 5) * .085;
  const rumble = rnd() * .022;
  const v = (pulse + rumble) * gate;
  L[i] += v; Rr[i] += v * .88;
}
/* 一阶低通，去掉噪声的毛刺 */
let lpL = 0, lpR = 0;
for (let i = 0; i < N; i++) {
  lpL += (L[i] - lpL) * .32; lpR += (Rr[i] - lpR) * .32;
  L[i] = L[i] * .35 + lpL * .65; Rr[i] = Rr[i] * .35 + lpR * .65;
}

/* 3 · 变形扫频：4–15s，80→420Hz 的上行与回落 */
for (let i = 0; i < N; i++) {
  const t = i / SR;
  if (t < 4 || t > 15) continue;
  const u = (t - 4) / 11;
  const f = 80 + 340 * u * u;
  const amp = .055 * Math.sin(Math.PI * u);
  const v = Math.sin(TAU * f * t + .5) * amp;
  L[i] += v; Rr[i] += v * .82;
}

/* 4 · 人形段空气感泛音：15–28s */
for (let i = 0; i < N; i++) {
  const t = i / SR;
  if (t < 14.6) continue;
  const u = Math.min(1, (t - 14.6) / 1.4);
  const shimmer = (Math.sin(TAU * 220 * t) * .5 + Math.sin(TAU * 330 * t + .8) * .3 +
                   Math.sin(TAU * 440 * t + 1.7) * .2) * .032 * u;
  L[i] += shimmer; Rr[i] += shimmer * .92;
}

/* 5 · 事件声：金属落位（谐振 + 衰减噪声）与低频冲击 */
const hits = [
  { t: 4.0,  a: .34, f: 175 }, { t: 8.0,  a: .20, f: 240 },
  { t: 11.0, a: .22, f: 310 }, { t: 15.0, a: .44, f: 145 },
  { t: 19.0, a: .20, f: 390 }, { t: 22.0, a: .23, f: 260 },
  { t: 24.5, a: .26, f: 205 }, { t: 26.5, a: .34, f: 165 },
  { t: 27.7, a: .30, f: 128 }
];
for (const h of hits) {
  const start = Math.floor(h.t * SR);
  const len = Math.floor(SR * Math.min(1.6, DUR - h.t));
  for (let k = 0; k < len; k++) {
    const dt = k / SR;
    const e = env(dt, .004, .28);
    const ring = (Math.sin(TAU * h.f * dt) * .7 + Math.sin(TAU * h.f * 1.51 * dt) * .3) * e;
    const noise = rnd() * Math.exp(-dt / .055) * .30;
    const sub = Math.sin(TAU * 46 * dt) * Math.exp(-dt / .18) * .55;
    const v = (ring + noise + sub) * h.a * .55;
    const i = start + k;
    L[i] += v; Rr[i] += v * .93;
  }
}

/* 6 · 首尾淡入淡出 + 峰值归一化 */
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / .6) * Math.min(1, (DUR - t) / 1.3);
  L[i] *= fade; Rr[i] *= fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
}
const gain = .88 / (peak || 1);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * gain));
  const r = Math.max(-1, Math.min(1, Rr[i] * gain));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
mkdirSync(join(root, 'artifacts'), { recursive: true });
const out = join(root, 'artifacts/HY4-original-score.wav');
writeFileSync(out, buf);
console.log('写入 ' + out + ' · 48kHz 双声道 28.00s · 峰值 ' + (peak * gain).toFixed(3) + ' · 事件 ' + hits.length + ' 个');
