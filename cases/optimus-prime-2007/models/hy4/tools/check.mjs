/* HY4 · 数据契约、状态机、几何、页面与影片门禁
 * 覆盖：装配图/零件身份、确定性重入、端点静止、连续变形覆盖、几何与契约一致、
 * 离线自包含、HY4 署名、真实 MP4 规格。
 * 不证明视觉还原、碰撞或物理可制造。执行：NODE_PATH=<同系列 node_modules> node tools/check.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const errors = [], passed = [];
const check = (label, cond) => (cond ? passed : errors).push(label);

const { ROOT, TIMELINE, ASSEMBLIES, PARTS, PORTS } = await import(join(root, 'src/rig.mjs'));
const { stateAt } = await import(join(root, 'src/state.mjs'));
const { SHOTS, EDIT, cameraAt, FRAME_COUNT } = await import(join(root, 'src/camera.mjs'));
const prod = json('production.json');
const catalog = json('records/assembly-catalog.json');
const refs = json('references/sources.json');

/* ---------- 装配图 ---------- */
const ids = ASSEMBLIES.map((a) => a.id);
const partIds = PARTS.map((p) => p.id);
const catalogIds = catalog.parts.map((p) => p.id);
const idSet = new Set(ids);
check('装配 ID 唯一且 root 在图外', ids.length === idSet.size && !idSet.has(ROOT));
check('零件 ID 唯一且与装配图一致', new Set(partIds).size === partIds.length &&
  partIds.length === catalogIds.length && catalogIds.every((x) => partIds.includes(x)));
check('父亲合法且无父子环', ASSEMBLIES.every((a) => {
  const seen = new Set(); let cur = a.parent;
  while (cur !== ROOT) {
    if (seen.has(cur) || !idSet.has(cur)) return false;
    seen.add(cur); cur = ASSEMBLIES.find((x) => x.id === cur).parent;
  }
  return true;
}));
check('语义接口指向已登记装配', Object.values(PORTS).every((v) => idSet.has(v)) &&
  Object.keys(PORTS).join(',') === prod.rig.requiredPorts.join(','));
check('双端位姿全部为有限数且 delay 合法', ASSEMBLIES.every((a) =>
  [a.t, a.r].every((q) => q.p.concat(q.r, q.s).every(Number.isFinite)) &&
  a.arc.every(Number.isFinite) && a.delay[0] >= 0 && a.delay[1] <= 1 && a.delay[0] < a.delay[1]));
check('零件唯一归属且装配清单列出全部ID', catalog.assemblies.length === ids.length &&
  catalog.parts.every((p) => idSet.has(p.assembly)) &&
  catalog.assemblies.every((a) => a.parts.length === ASSEMBLIES.find((x) => x.id === a.id).n));

/* ---------- 状态机 ---------- */
const snap = (t, e = 0) => JSON.stringify(stateAt(t, { explode: e }).assemblies);
check('stateAt(t) 同输入同结果', [0, 8, 10.75, 13.5, 16.25, 19, 50].every((t) => snap(t) === snap(t)));
const a = snap(10.75), b = snap(16.25);
check('重入确定性 t1 → t2 → t1', a === snap(10.75));
check('中段与两个端点均不同', a !== snap(0) && a !== snap(50) && a !== b);
check('车辆端点区间静止（0 / 7.9s）', snap(0) === snap(7.9));
check('人形端点区间静止（19 / 50s）', snap(19) === snap(50));
check('拆解为确定性纯函数', snap(13.5, .7) === snap(13.5, .7) && snap(13.5, .7) !== a);
check('装配数与身份在任意时刻恒定', [0, 8, 13.5, 19, 50].every((t) => {
  const rows = stateAt(t).assemblies;
  return rows.length === ASSEMBLIES.length && rows.every((r, i) => r.id === ids[i] && r.finite);
}));
let maxStep = 0;
for (let t = TIMELINE.transform[0]; t < TIMELINE.transform[1]; t += .2) {
  const p1 = stateAt(t).assemblies, p2 = stateAt(t + .2).assemblies;
  for (let i = 0; i < p1.length; i++)
    maxStep = Math.max(maxStep, Math.hypot(...p1[i].pos.map((v, k) => v - p2[i].pos[k])));
}
check('0.2s 步长无位置跳变（<1.2）', maxStep < 1.2);

/* ---------- 镜头与时间线 ---------- */
check('7 镜头连续覆盖且总时长一致', SHOTS.length === 7 &&
  SHOTS.every((s, i) => i === 0 || Math.abs(SHOTS[i - 1].out - s.in) < 1e-9) &&
  Math.abs(SHOTS[SHOTS.length - 1].out - TIMELINE.movieDuration) < 1e-9);
check('连续镜头完整覆盖 8–19s 变形', SHOTS.some((s) => s.purpose === 'transformation' &&
  s.sourceIn <= TIMELINE.transform[0] && s.sourceOut >= TIMELINE.transform[1]));
check('剪辑边界落在整帧', EDIT.every((e) => Math.abs(e.in * TIMELINE.fps - Math.round(e.in * TIMELINE.fps)) < 1e-9 &&
  Math.abs(e.out * TIMELINE.fps - Math.round(e.out * TIMELINE.fps)) < 1e-9));
check('production.json 的 edit 与镜头表一致', JSON.stringify(prod.timeline.edit) === JSON.stringify(EDIT));
check('672 帧 / 24fps / 28s', FRAME_COUNT === 672 && TIMELINE.fps === 24 && TIMELINE.movieDuration === 28);
check('相机在全部帧均为有限数', Array.from({ length: FRAME_COUNT }, (_, i) => cameraAt(i / 24))
  .every((s) => s.cam.concat(s.target, s.fov, s.explode).every(Number.isFinite)));
check('production.json 为 study / independent / fidelity',
  prod.status === 'study' && prod.provenance === 'independent' && prod.visualGoal === 'fidelity');
check('模型署名 hy4 / HY4', prod.model.slug === 'hy4' && /HY4/.test(prod.model.label));

/* ---------- 几何（Node 内实际构建，无浏览器） ---------- */
const depDir = resolve(root, '../gpt-6-1-sol/node_modules');
const require = createRequire(join(depDir, 'esbuild/package.json'));
const esbuild = require('esbuild');
const built = esbuild.buildSync({
  entryPoints: [join(root, 'src/geometry.js')], bundle: true, write: false,
  format: 'esm', platform: 'node', target: 'es2020', nodePaths: [depDir]
});
const tmp = join(root, 'artifacts/_geometry-check.mjs');
mkdirSync(join(root, 'artifacts'), { recursive: true });
writeFileSync(tmp, built.outputFiles[0].text);
const noop = () => {};
const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (() => ({ addColorStop: noop }))), set: (o, k, v) => { o[k] = v; return true; } });
globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) };
const { buildModel } = await import(tmp + '?t=' + Date.now());
const model = buildModel();
check('几何装配/分件数与契约一致', model.assemblyCount === ids.length && model.partCount === PARTS.length &&
  ASSEMBLIES.every((x) => model.groups[x.id].children.length === x.n));
check('命名分件 ID 与装配图一致', Object.values(model.groups).every((g) =>
  g.children.every((p) => p.userData.id === p.name && p.userData.assembly === g.name)));
check('渲染 Mesh 数显著多于视觉分件', model.meshCount > model.partCount * 1.5);

/* ---------- 参考与页面 ---------- */
check('原始参考 8 帧精选 + 7 份补充素材且哈希格式正确', refs.selectedFrames.length === 15 &&
  refs.selectedFrames.every((r) => /^[a-f0-9]{64}$/.test(r.sha256) && r.file.startsWith('local/') && /^https:/.test(r.sourceUrl)));
for (const name of ['index.html', 'film.html']) {
  const html = read(name);
  check(name + ' 自包含且标注 HY4',
    html.includes('HY4') && html.includes('Tencent Hunyuan Hy') && html.includes('擎天柱') &&
    html.includes('stateAt') && html.includes('WebGLRenderer') &&
    !/src\s*=\s*["']https?:/i.test(html) && !/@import\s+url\(\s*["']?https?:/i.test(html));
}
check('film.html 自动巡览 / index.html 手动，且仅此一处不同',
  read('film.html').includes('HY4_AUTOPLAY = true') && read('index.html').includes('HY4_AUTOPLAY = false') &&
  read('film.html').replace('HY4_AUTOPLAY = true', 'HY4_AUTOPLAY = false') === read('index.html'));
check('brief / README 标注 HY4', /HY4/.test(read('brief.md')) && /HY4/.test(read('README.md')));
check('源码无作者机器绝对路径', ['src/rig.mjs', 'src/state.mjs', 'src/camera.mjs', 'src/kit.js',
  'src/geometry.js', 'src/scene.js', 'src/main.js', 'tools/build.mjs']
  .every((f) => !/\/Users\/|\/home\//.test(read(f))));

/* ---------- 真实影片 ---------- */
const vcPath = join(root, 'artifacts/video-check.json');
if (existsSync(vcPath)) {
  const vc = json('artifacts/video-check.json');
  check('真实 MP4：1920×804 / 24fps / 672 帧 / 28s / H.264+AAC',
    vc.resolution[0] === 1920 && vc.resolution[1] === 804 && vc.frames === 672 &&
    Math.abs(vc.duration - 28) < .05 && vc.videoCodec === 'h264' && vc.audioCodec === 'aac');
  check('完整解码 / 无黑帧 / 有电平', vc.fullDecode === 'ok' && vc.blackDetectIntervals.length === 0 &&
    vc.meanVolumeDb !== undefined && vc.peakVolumeDb !== undefined);
  check('影片验收无错误', vc.errors.length === 0);
} else {
  errors.push('缺少 artifacts/video-check.json：尚未执行 node tools/video.mjs');
}
check('成片文件真实存在', existsSync(join(root, 'artifacts/HY4-擎天柱-2007-电影版.mp4')));
check('原创音轨存在', existsSync(join(root, 'artifacts/HY4-original-score.wav')));

for (const p of passed) console.log('  ✓ ' + p);
for (const e of errors) console.log('  ✗ ' + e);
console.log(`检查 ${passed.length + errors.length} 项，通过 ${passed.length} 项，失败 ${errors.length} 项；最大 0.2s 位移 ${maxStep.toFixed(3)}；${model.partCount} 分件 / ${model.meshCount} Mesh`);
console.log('注意：数据完整性检查不证明视觉还原、碰撞或物理可制造。');
if (errors.length) process.exit(1);
