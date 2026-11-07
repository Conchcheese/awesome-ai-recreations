import fs from 'node:fs';
import path from 'node:path';
import {ROOT,DEPS,require} from './deps.mjs';
const mode=process.argv[2]||'all';
if(!['all','live','film'].includes(mode))throw new Error('用法：node tools/build.mjs [all|live|film]');
const dest=path.join(ROOT,'00-机械章鱼OC-8');fs.mkdirSync(dest,{recursive:true});
for(const item of mode==='all'?['live','film']:[mode]){
  const {outputFiles}=await require('esbuild').build({entryPoints:[path.join(ROOT,'src/main.js')],bundle:true,write:false,minify:true,format:'iife',target:'es2023',nodePaths:[DEPS],legalComments:'inline',define:{__MODE__:JSON.stringify(item)}});
  const license=fs.readFileSync(path.join(DEPS,'three/LICENSE'),'utf8');
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>机械章鱼 OC-8 · GPT-6.1 Sol · ${item==='live'?'互动':'影片'}页</title><!-- Three.js license\n${license}\n--><body><script>${outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
  const file=path.join(dest,`机械章鱼OC-8-${item==='live'?'互动':'影片'}页.html`);fs.writeFileSync(file,html);console.log(`${path.basename(file)} ${(Buffer.byteLength(html)/1024).toFixed(0)} KiB`);
}
