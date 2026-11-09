// Read current page; only write diagnostic files, never production asset paths.
import {dep,root} from './deps.mjs';import {pathToFileURL} from 'node:url';import path from 'node:path';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const {chromium}=await dep('playwright');const dir=path.join(root,'artifacts/export-diagnostic');await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.platform==='darwin'?'chromium':undefined,args:['--allow-file-access-from-files',...(process.platform==='darwin'?['--use-angle=metal']:[])]});
try{const p=await browser.newPage({viewport:{width:960,height:540}});await p.goto(pathToFileURL(path.join(root,'index.html')).href+'?capture');await p.waitForFunction(()=>study?.ready,{}, {timeout:90000});for(let i=0;i<2;i++){const data=await p.evaluate(()=>study.exportGLB());await fs.writeFile(path.join(dir,`${i}.glb`),Buffer.from(data.base64,'base64'));console.log('Diagnostic export',i)}
const report=execFileSync('python3',[path.join(root,'tools/glb-digest.py'),path.join(dir,'0.glb'),path.join(dir,'1.glb')],{encoding:'utf8'});await fs.writeFile(path.join(dir,'comparison.json'),report);console.log(report);
}finally{await browser.close()}
