import fs from 'node:fs/promises';
import path from 'node:path';
import {dep,dependency,root} from './deps.mjs';
const {build}=await dep('esbuild');
import {acquireAssetLock} from './asset-lock.mjs';
const release=await acquireAssetLock(root,'build');
try{
const env=await fs.readFile(path.join(root,'assets/industrial_sunset_02_2k.hdr'));
const result=await build({entryPoints:[path.join(root,'src/main.mjs')],bundle:true,write:false,format:'iife',minify:true,legalComments:'inline',define:{__ENV_HDR__:JSON.stringify(env.toString('base64'))},alias:{'three/addons':path.resolve(path.dirname(dependency('three')),'../examples/jsm'),three:path.dirname(dependency('three'))+'/three.module.js'}});
const license=await fs.readFile(path.resolve(path.dirname(dependency('three')),'../LICENSE'),'utf8');
let html=await fs.readFile(path.join(root,'src/shell.html'),'utf8');
html=html.replace('</head>',()=>`<!-- Three.js runtime license:\n${license}\n--></head>`);
html=html.replace('/* APP */',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script'));
await fs.writeFile(path.join(root,'index.html'),html);
await fs.writeFile(path.join(root,'film.html'),html.replace('<body>','<body data-film="true">'));
console.log('已生成 index.html / film.html，Three.js 内联，运行不依赖网络');

}finally{await release()}
