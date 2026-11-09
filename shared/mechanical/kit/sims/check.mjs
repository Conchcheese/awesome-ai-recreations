// Run a case's existing assertions with the dependencies installed in this kit.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { DEPS, fromDeps } from '../paths.mjs';

const entry = process.argv[2];
if (!entry) throw new Error('请提供案例的检查脚本路径');
const { outputFiles } = await fromDeps('esbuild').build({
  entryPoints: [path.resolve(entry)],
  nodePaths: [DEPS],
  platform: 'node',
  format: 'esm',
  bundle: true,
  write: false,
});
const run = spawnSync(process.execPath, ['--input-type=module'], {
  input: outputFiles[0].text,
  stdio: ['pipe', 'inherit', 'inherit'],
});
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
