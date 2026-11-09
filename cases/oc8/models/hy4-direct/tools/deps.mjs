// Dependency resolution only; no simulator code is shared with other implementations.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = process.env.RECREATION_DEPS
  ? [path.resolve(process.env.RECREATION_DEPS)]
  : [path.join(ROOT, 'node_modules'), path.resolve(ROOT, '../../../../shared/mechanical/kit/node_modules')];
export const DEPS = candidates.find((dir) => ['three', 'esbuild', 'playwright'].every(
  (name) => fs.existsSync(path.join(dir, name, 'package.json'))));
if (!DEPS) throw new Error('缺少 three/esbuild/playwright。请在 models/hy4-direct 运行 npm ci，或按 docs/快速开始.md 安装共享依赖；也可设置 RECREATION_DEPS。');
export const fromDeps = createRequire(path.join(DEPS, 'resolve.cjs'));
export const CHROMIUM_ARGS = [
  ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []),
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  '--force_high_performance_gpu', '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization', '--enable-webgl', '--hide-scrollbars',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
];
