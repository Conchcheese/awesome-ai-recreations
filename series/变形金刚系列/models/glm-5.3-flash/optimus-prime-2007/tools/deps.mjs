// 依赖解析：优先本案例 node_modules，回退到仓库 GLM kit（方法沿用 C-01，已署名）
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const own = createRequire(new URL('../package.json', import.meta.url));
const shared = createRequire(new URL('../../../../机械复刻系列/glm5.3-flash复刻/src/kit/package.json', import.meta.url));
export function dependency(name) {
  try { return own.resolve(name); } catch { return shared.resolve(name); }
}
export async function dep(name) {
  const m = await import(pathToFileURL(dependency(name)).href);
  return m.default ?? m;
}
export const root = fileURLToPath(new URL('../', import.meta.url));
