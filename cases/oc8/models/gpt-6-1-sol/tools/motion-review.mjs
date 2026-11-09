import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,require,browserArgs} from './deps.mjs';
const groups=[
 ['喷进与八臂',[['倾转喷进',[.5,2,4,5.8]],['八臂交替',[6.8,8,9.6,11.3]]]],
 ['镜组与外壳',[['虹膜叶片',[14.7,15.2,15.7,16.2]],['开壳与闭合',[19.7,21.3,23.1,24.7]]]],
 ['腕足与推进器',[['R2分节与回装',[26.6,28.2,29.8,31.6]],['喷口叶瓣与尾流',[34.5,35,35.5,36.2]]]],
 ['姿态与双颚',[['悬停补偿',[39.8,40.4,41.2,42.1]],['腹侧与双颚',[44.8,45.25,45.85,46.5]]]],
 ['拆解与离站',[['总成分解复位',[49.7,51.8,54.5,56.8]],['收臂倾转离站',[58.2,60,62,63.8]]]],
];
const browser=await require('playwright').chromium.launch({headless:true,args:browserArgs});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const url=pathToFileURL(path.join(ROOT,'film.html'));url.search='render=1';
 await page.goto(url.href);await page.waitForFunction(()=>window.__sim?.ready);await page.evaluate(()=>document.fonts.ready);
 const sheet=await browser.newPage({viewport:{width:2400,height:1}});
 for(const [name,rows] of groups){
  let html='';
  for(const [label,times] of rows){
   const cells=[];
   for(const t of times){await page.evaluate(t=>window.__sim.renderFrame(t),t);const data=(await page.screenshot({type:'jpeg',quality:87})).toString('base64');cells.push(`<div><img src="data:image/jpeg;base64,${data}"><p>${t.toFixed(2)} s</p></div>`);}
   html+=`<h2>${label}</h2><div class="grid">${cells.join('')}</div>`;
  }
  await sheet.setContent(`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:22px;background:#f5f2e9;color:#273229;font-family:Arial,'PingFang SC',sans-serif}h1{font-size:34px;margin:0}h2{font-size:23px;margin:18px 0 10px;color:#d75e30}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}img{display:block;width:100%}p{margin:8px;font:17px monospace;color:#8a6044}</style><h1>GPT-6.1 Sol / V2 动作检查 · ${name}</h1>${html}`);
  await sheet.screenshot({path:path.join(ROOT,`stills/动作检查-V2-${name}.jpg`),type:'jpeg',quality:91,fullPage:true});console.log('✓ '+name);
 }
}finally{await browser.close();}
