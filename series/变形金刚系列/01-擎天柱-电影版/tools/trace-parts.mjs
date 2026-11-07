import {root,dep,dependency} from './deps.mjs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {build}=await dep('esbuild');
const outfile=path.join(root,'artifacts/trace-parts-bundle.mjs');
await build({entryPoints:[path.join(root,'tools/trace-logic.mjs')],bundle:true,platform:'node',format:'esm',outfile,alias:{'three/addons':path.resolve(path.dirname(dependency('three')),'../examples/jsm'),three:path.dirname(dependency('three'))+'/three.module.js'}});
const {trace}=await import(pathToFileURL(outfile));await trace(root);
