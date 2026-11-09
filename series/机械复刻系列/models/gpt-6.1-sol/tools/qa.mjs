import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ROOT,require,browserArgs} from './deps.mjs';
import {DURATION} from '../src/model.js';
const browser=await require('playwright').chromium.launch({headless:true,args:browserArgs});
let passed=0;
function check(condition,label){assert(condition,label);console.log('✓ '+label);passed++;}
try{
 for(const mode of ['互动','影片']){
  const file=path.join(ROOT,`../../gpt-6.1-sol复刻/00-机械章鱼OC-8/机械章鱼OC-8-${mode}页.html`),source=fs.readFileSync(file,'utf8');
  check(Buffer.byteLength(source)<1024*1024,mode+'页 < 1 MiB');
  check(!/<(?:script|img|link)[^>]+(?:src|href)=["']https?:/i.test(source),mode+'页无外部资源标签');
  const ctx=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await ctx.route(/^https?:/,r=>r.abort());
  const page=await ctx.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const url=pathToFileURL(file);url.search='render=1';await page.goto(url.href);await page.waitForFunction(()=>window.__sim?.ready);await page.evaluate(()=>document.fonts.ready);
  for(let i=0;i<=DURATION*2;i++)await page.evaluate(t=>window.__sim.renderFrame(t),i*.5);
  check(errors.length===0,mode+`页 ${DURATION*2+1} 帧零报错`);
  const first=await page.evaluate(()=>window.__sim.renderFrame(22));const a=await page.screenshot({animations:'disabled'});const canvasA=await page.evaluate(()=>document.querySelector('#scene').toDataURL());
  await page.evaluate(()=>window.__sim.renderFrame(52));const last=await page.evaluate(()=>window.__sim.renderFrame(22));const b=await page.screenshot({animations:'disabled'});const canvasB=await page.evaluate(()=>document.querySelector('#scene').toDataURL());
  check(JSON.stringify(first)===JSON.stringify(last),mode+'页状态重入一致');
  check(canvasA===canvasB,mode+'页3D画布像素回放严格一致');
  const diff=a.equals(b)?{count:0,max:0}:await page.evaluate(async pair=>{
    const decode=async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return x.getImageData(0,0,c.width,c.height).data;};
    const [a,b]=await Promise.all(pair.map(decode));let count=0,max=0;for(let i=0;i<a.length;i+=4){let different=false;for(let j=0;j<3;j++){const d=Math.abs(a[i+j]-b[i+j]);if(d)different=true;max=Math.max(max,d);}if(different)count++;}return {count,max};
  },[a.toString('base64'),b.toString('base64')]);
  if(diff.count>20||diff.max>4){fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true});fs.writeFileSync(path.join(ROOT,'artifacts/qa-before.png'),a);fs.writeFileSync(path.join(ROOT,'artifacts/qa-replay.png'),b);}
  check(diff.count<=20&&diff.max<=4,mode+`页DOM回放抗锯齿差异在20像素/4级内（${diff.count}/${diff.max}）`);
  const inspect=async t=>page.evaluate(time=>{window.__sim.renderFrame(time);return window.__sim.inspectMotion();},t);
  const jet=await inspect(1),spread=await inspect(9),depart=await inspect(62);
  check(Math.abs(jet.rotation[2]-spread.rotation[2])>.7&&depart.rotation[2]<-.8,mode+'页整机倾转进入与离站实际驱动');
  const a1=await inspect(7),a2=await inspect(8.6);
  check(a1.armMatrix.some((v,i)=>Math.abs(v-a2.armMatrix[i])>.04),mode+'页腕节实例矩阵实际变化');
  const i1=await inspect(15.2),i2=await inspect(15.7);
  check(Math.abs(i1.iris-i2.iris)>.10,mode+'页虹膜叶片实际开合');
  const n1=await inspect(35.0),n2=await inspect(35.5);
  check(n1.nozzle.some((v,i)=>Math.abs(v-n2.nozzle[i])>.08)&&n1.wake,mode+'页喷口叶瓣活动且尾流可见');
  const j1=await inspect(45.25),j2=await inspect(45.85);
  check(Math.abs(j1.jaw-j2.jaw)>.2,mode+'页双颚实际活动');
  await page.evaluate(()=>window.__sim.renderFrame(22));
  let peakOverflow=0;
  for(const t of [1.2,2.36,35.8,46,62]){await page.evaluate(t=>window.__sim.renderFrame(t),t);peakOverflow+=await page.evaluate(()=>[...document.querySelectorAll('.panel')].filter(el=>el.getBoundingClientRect().bottom>1048||el.scrollWidth>el.clientWidth+1).length);}
  check(peakOverflow===0,mode+'页高推力与翻身时刻面板安全区');
  await page.evaluate(()=>window.__sim.renderFrame(22));
  const info=await page.evaluate(()=>({title:document.title,counts:window.__sim.counts,overflow:[...document.querySelectorAll('.panel')].filter(el=>{const r=el.getBoundingClientRect();return r.bottom>1048||el.scrollWidth>el.clientWidth+1;}).length}));
  check(info.title.includes('GPT-6.1 Sol'),mode+'页署名正确');check(info.counts.links===176&&info.counts.wheels===352,mode+'页结构计数正确');check(info.overflow===0,mode+'页面板不出安全区/不横向溢出');
  if(mode==='互动'){
   for(const view of ['optics','mantle','arm','siphon','beak','hero'])await page.locator(`[data-view="${view}"]`).click();
   for(const cmd of ['explode','labels','labels','reset'])await page.locator(`[data-cmd="${cmd}"]`).click();
   await page.mouse.move(950,550);await page.mouse.down();await page.mouse.move(1050,580,{steps:6});await page.mouse.up();await page.mouse.wheel(0,80);
   check(errors.length===0,'互动页按钮、拖拽和缩放无报错');
  }
  check(requests.length===0,mode+'页全过程零网络');await ctx.close();
 }
 console.log(`${passed} 项浏览器 QA 通过`);
}finally{await browser.close();}
