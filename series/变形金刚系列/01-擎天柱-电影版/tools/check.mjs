import {dep,dependency,root} from './deps.mjs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {build}=await dep('esbuild');
const out=path.join(root,'artifacts/model-check.mjs');
await build({entryPoints:[path.join(root,'tools/check-logic.mjs')],bundle:true,platform:'node',format:'esm',outfile:out,alias:{'three/addons':path.resolve(path.dirname(dependency('three')),'../examples/jsm'),three:path.dirname(dependency('three'))+'/three.module.js'}});
await import(pathToFileURL(out));
