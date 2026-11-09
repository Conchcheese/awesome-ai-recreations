// Render reference/result pairs and explicitly unregistered overlays for visual review.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,require,browserArgs} from './deps.mjs';
const dir=path.join(ROOT,'stills');
const refs=path.resolve(ROOT,'../../../../cases/oc8/task/references');
const pairs=[
 ['01','01-原作-00秒-主机位喷进.jpg','静帧-V2-01-倾转喷进 · 收臂巡航.jpg','原作 0.00 s / 本版 1.20 s'],
 ['02','03-原作-08秒-外套膜打开.jpg','静帧-V2-04-外套膜展开 · 泵核运行.jpg','原作 8.00 s / 本版 22.00 s'],
 ['03','04-原作-10秒-R2臂分离.jpg','静帧-V2-05-R2 腕 · 分节拆解与回装.jpg','原作 10.00 s / 本版 28.60 s'],
 ['04','08-原作-20秒-整机拆解.jpg','静帧-V2-09-整机分解 · 多级装配展开.jpg','原作 20.00 s / 本版 52.00 s'],
];
const image=file=>'data:image/jpeg;base64,'+fs.readFileSync(file).toString('base64');
const browser=await require('playwright').chromium.launch({headless:true,args:browserArgs});
try{
 const page=await browser.newPage({viewport:{width:2400,height:1}});
 for(const [id,ref,result,label] of pairs){
  const a=image(path.join(refs,ref)),b=image(path.join(dir,result));
  await page.setContent(`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f7f4ec;color:#263027;font-family:Arial,'PingFang SC',sans-serif}header{font-size:29px;padding:20px 26px;border-bottom:3px solid #ff6227}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px}img{display:block;width:100%}.label{font-size:20px;margin:10px 15px}</style><header>OC-8 · 原作 / GPT-6.1 Sol　<span style="font-size:20px">${label} · 相同动作阶段，镜头未配准</span></header><div class="grid"><div><img src="${a}"><p class="label">原作 @0x_fokki · 图片版权归原作者</p></div><div><img src="${b}"><p class="label">本版程序化复刻 · 保留差异供检查</p></div></div>`);
  await page.screenshot({path:path.join(dir,`对照-${id}.jpg`),type:'jpeg',quality:91,fullPage:true});
  await page.setViewportSize({width:1920,height:1080});
  await page.setContent(`<style>body{margin:0}img{position:absolute;inset:0;width:1920px;height:1080px}.note{position:absolute;left:350px;top:110px;background:#fff;padding:12px;font:18px Arial;color:#b44620}</style><img src="${a}"><img style="opacity:.5" src="${b}"><div class="note">50% 未配准叠图 / ${label} / 不作为量化误差评分</div>`);
  await page.screenshot({path:path.join(dir,`叠图-${id}.jpg`),type:'jpeg',quality:90});
  await page.setViewportSize({width:2400,height:1});console.log('✓ 对照 / 叠图 '+id);
 }
}finally{await browser.close();}
