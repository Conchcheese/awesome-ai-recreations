/* HY4 · 影片编码与验收（真实 MP4，不是网页巡览）
 * 执行：node tools/video.mjs
 * 前置：node tools/render.mjs 生成的 672 帧 PNG、node tools/audio.mjs 生成的 WAV。
 * 检查：帧数/时长/分辨率/编解码、完整解码、黑帧、音量电平、首尾帧。
 */
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const art = join(root, 'artifacts');
const frames = join(art, 'frames');
const wav = join(art, 'HY4-original-score.wav');
const out = join(art, 'HY4-擎天柱-2007-电影版.mp4');
const FPS = 24, TOTAL = 672, W = 1920, H = 804;

const missing = [];
for (let i = 0; i < TOTAL; i++) {
  if (!existsSync(join(frames, String(i).padStart(4, '0') + '.png'))) missing.push(i);
}
if (missing.length) throw new Error(`缺帧 ${missing.length} 个，首个 ${missing[0]}`);
if (!existsSync(wav)) throw new Error('缺少原创音轨 WAV');
const manifest = JSON.parse(readFileSync(join(art, 'render-manifest.json'), 'utf8'));
if (manifest.pageErrors && manifest.pageErrors.length) throw new Error('渲染期存在页面错误');

const run = (bin, args, label) => {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(label + ' 失败：' + (r.stderr || '').slice(-1500));
  return (r.stdout || '') + (r.stderr || '');
};

console.log('编码中：672 帧 → H.264 / AAC / 1920×804 / 24fps / 28s');
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'warning',
  '-framerate', String(FPS), '-i', join(frames, '%04d.png'),
  '-i', wav,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-movflags', '+faststart', '-shortest',
  '-metadata', 'title=HY4 · 擎天柱 2007 电影版 · 程序化三维复刻',
  '-metadata', 'artist=HY4 / Tencent Hunyuan Hy',
  '-metadata', 'comment=同源模型逐帧 WebGL PBR 渲染；原创程序化音轨；原始影片素材仅本地研究，不随成片分发',
  out
], 'ffmpeg 编码');

const probe = run('ffprobe', ['-v', 'error', '-show_entries',
  'format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames,sample_rate,channels',
  '-of', 'json', out], 'ffprobe');
const info = JSON.parse(probe);
const v = info.streams.find((s) => s.codec_type === 'video');
const a = info.streams.find((s) => s.codec_type === 'audio');

const decode = run('ffmpeg', ['-v', 'error', '-i', out, '-f', 'null', '-'], '完整解码');
const black = run('ffmpeg', ['-hide_banner', '-i', out, '-vf', 'blackdetect=d=0.20:pix_th=0.06',
  '-an', '-f', 'null', '-', '-loglevel', 'info'], '黑帧检测');
const vol = run('ffmpeg', ['-hide_banner', '-i', out, '-af', 'volumedetect',
  '-f', 'null', '-', '-loglevel', 'info'], '音量检测');
const blackLines = black.split('\n').filter((l) => l.includes('black_start'));
const mean = (vol.match(/mean_volume:\s*([-\d.]+) dB/) || [])[1];
const peak = (vol.match(/max_volume:\s*([-\d.]+) dB/) || [])[1];

const report = {
  file: 'artifacts/HY4-擎天柱-2007-电影版.mp4',
  bytes: Number(info.format.size), sha256: createHash('sha256').update(readFileSync(out)).digest('hex'),
  duration: Number(info.format.duration), fps: FPS, frames: Number(v.nb_frames),
  resolution: [v.width, v.height], videoCodec: v.codec_name,
  audioCodec: a ? a.codec_name : null, sampleRate: Number(a.sample_rate), channels: a.channels,
  renderFrameDigest: manifest.digest, renderSeconds: manifest.seconds,
  fullDecode: decode.trim() === '' ? 'ok' : decode.trim().slice(0, 400),
  blackDetectIntervals: blackLines, meanVolumeDb: mean, peakVolumeDb: peak,
  music: '原创程序化合成（振荡器 + 包络 + 确定性噪声），无电影配乐采样',
  checkedAt: new Date().toISOString()
};

const errors = [];
if (v.width !== W || v.height !== H) errors.push('分辨率不符');
if (Number(v.nb_frames) !== TOTAL) errors.push('帧数不符：' + v.nb_frames);
if (Math.abs(Number(info.format.duration) - 28) > .05) errors.push('时长不符');
if (decode.trim() !== '') errors.push('完整解码有错误');
if (blackLines.length) errors.push('检测到黑帧');
if (!a || a.codec_name !== 'aac') errors.push('音轨缺失或非 AAC');
report.errors = errors;
writeFileSync(join(art, 'video-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`成片 ${out} · ${(report.bytes / 1024 / 1024).toFixed(2)} MB · ${report.duration}s · ${report.frames} 帧`);
console.log(`编码 ${report.videoCodec}/${report.audioCodec} · 电平 ${mean} / ${peak} dB · 黑帧 ${blackLines.length} · 解码 ${report.fullDecode}`);
if (errors.length) { console.error('验收未通过：' + errors.join('；')); process.exit(1); }
console.log('影片验收通过。');
