import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,require,browserArgs} from './deps.mjs';
import {SHOTS,DURATION} from '../src/model.js';
const gray=process.argv.includes('--gray');
const dir=path.join(ROOT,'00-机械章鱼OC-8/stills');fs.mkdirSync(dir,{recursive:true});
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,args:browserArgs});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(path.join(ROOT,'00-机械章鱼OC-8/机械章鱼OC-8-影片页.html'));url.search='render=1'+(gray?'&gray=1':'');
 await page.goto(url.href);await page.waitForFunction(()=>window.__sim?.ready);await page.evaluate(()=>document.fonts.ready);
 const cards=[];const shots=gray?[{at:9,name:'整机'},{at:22,name:'开壳'},{at:28.6,name:'腕足'},{at:52,name:'拆解'}]:SHOTS.map(s=>({...s,at:s.sample}));
 for(let i=0;i<shots.length;i++){
  const shot=shots[i];await page.evaluate(t=>window.__sim.renderFrame(t),shot.at);
  const name=`${gray?'灰模-V2':'静帧-V2'}-${String(i+1).padStart(2,'0')}-${shot.name}.jpg`;
  await page.screenshot({path:path.join(dir,name),type:'jpeg',quality:92});
  cards.push({name:shot.name,t:shot.at,data:'data:image/jpeg;base64,'+fs.readFileSync(path.join(dir,name)).toString('base64')});console.log('✓ '+name);
 }
 if(!gray){
  for(const [name,t] of [['整机',9],['开壳',22],['腕足',28.6]]){
   await page.evaluate(t=>{window.__sim.renderFrame(t);document.querySelector('#hud').style.display='none';},t);
   await page.screenshot({path:path.join(dir,`光影-${name}.jpg`),type:'jpeg',quality:93});
  }
 }
 const sheet=await browser.newPage({viewport:{width:2000,height:1}});
 await sheet.setContent(`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#f4f0e7;color:#272f28;font-family:Arial,'PingFang SC',sans-serif}h1{font-size:35px;margin:0 0 22px}h1 span{font-size:20px;color:#777f71;margin-left:25px}.grid{display:grid;grid-template-columns:repeat(${gray?2:4},1fr);gap:14px}.card{border:1px solid #d2d5c8;border-radius:5px;overflow:hidden;background:#fcfaf4}img{display:block;width:100%}p{font-size:20px;margin:12px 14px}b{color:#f05c26;font:16px monospace;margin-right:8px}</style><h1>Pelagos OC-8 / ${gray?'灰模与机位检查':'动作完整版接触表'}<span>GPT-6.1 Sol · ${DURATION} s · 原创程序化实现</span></h1><div class="grid">${cards.map(c=>`<div class="card"><img src="${c.data}"><p><b>${c.t.toFixed(2)}s</b>${c.name}</p></div>`).join('')}</div>`);
 await sheet.screenshot({path:path.join(dir,gray?'灰模-V2-四帧接触表.jpg':'总览-V2-动作完整版接触表.jpg'),type:'jpeg',quality:91,fullPage:true});
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('截图完成，页面报错 0');
}finally{await browser.close();}
