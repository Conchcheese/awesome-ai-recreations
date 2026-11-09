import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const own=createRequire(new URL('../package.json',import.meta.url));
const shared=createRequire(new URL('../../../../../shared/mechanical/kit/package.json',import.meta.url));
export function dependency(name){try{return own.resolve(name)}catch{return shared.resolve(name)}}
export async function dep(name){const m=await import(pathToFileURL(dependency(name)).href);return m.default??m}
export const root=fileURLToPath(new URL('..',import.meta.url));
