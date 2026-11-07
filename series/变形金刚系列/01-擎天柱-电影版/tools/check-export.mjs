// Real isolated export/archival test. Production asset files are read only.
import {root} from './deps.mjs';import path from 'node:path';import os from 'node:os';import fs from 'node:fs/promises';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'transformer-export-'));const hash=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const productionBefore=await hash(path.join(root,'artifacts/optimus-cinematic.glb'));
async function run(){const p=spawn(process.execPath,[path.join(temp,'tools/export.mjs')],{cwd:temp,stdio:['ignore','pipe','pipe']});let log='';p.stdout.on('data',x=>log+=x);p.stderr.on('data',x=>log+=x);const code=await new Promise((r,j)=>{p.once('error',j);p.once('close',r)});assert.equal(code,0,log)}
try{
 await fs.mkdir(path.join(temp,'tools'));await fs.mkdir(path.join(temp,'records'));
 for(const f of ['package.json','index.html','tools/export.mjs','tools/deps.mjs','tools/asset-lock.mjs'])await fs.copyFile(path.join(root,f),path.join(temp,f));
 await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'),'junction');
 const hashes=[];
 for(let i=0;i<2;i++){await run();const sha=await hash(path.join(temp,'artifacts/optimus-cinematic.glb'));const meta=JSON.parse(await fs.readFile(path.join(temp,'artifacts/animation-export.json'),'utf8'));assert.equal(meta.glbSha256,sha);assert.equal(meta.htmlSha256,await hash(path.join(temp,'index.html')));assert.equal(meta.cameraFrames.length,1201);assert.equal(meta.assemblies.length,172);for(const previous of [...hashes,sha])assert.equal(await hash(path.join(temp,`artifacts/exports/${previous}.glb`)),previous);hashes.push(sha);await assert.rejects(()=>fs.access(path.join(temp,'artifacts/asset.lock')))}
 assert.equal(await hash(path.join(root,'artifacts/optimus-cinematic.glb')),productionBefore);
 const report={result:'passed',isolatedExports:2,archiveDigestsVerified:true,priorGLBRetained:true,lockReleased:true,productionGLBUnchanged:true};await fs.writeFile(path.join(root,'artifacts/export-archive-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await fs.rm(temp,{recursive:true,force:true})}
