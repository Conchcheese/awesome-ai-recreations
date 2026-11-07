import {chromium} from 'playwright';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const movie=process.argv.includes('--movie');
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir(path.join(base,'artifacts/qa'),{recursive:true});
try{
 await page.goto(pathToFileURL(path.join(base,'index.html')).href);await page.waitForFunction(()=>window.bumblebeeQA?.ready,{timeout:60000});
 const before=await page.evaluate(()=>window.bumblebeeQA.pose(6.3));
 await page.evaluate(()=>window.bumblebeeQA.pose(18));
 const after=await page.evaluate(()=>window.bumblebeeQA.pose(6.3));assert.deepEqual(before,after);
 await page.getByRole('button',{name:'车辆',exact:true}).click();assert.equal(await page.locator('#timeline').inputValue(),'0');
 await page.waitForTimeout(250);await page.screenshot({path:path.join(base,'artifacts/qa/vehicle.png')});
 await page.getByRole('button',{name:'人形',exact:true}).click();assert.equal(await page.locator('#timeline').inputValue(),'18');
 await page.getByRole('button',{name:'灰模',exact:true}).click();assert.equal(await page.locator('#grey').getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'灰模',exact:true}).click();
 await page.locator('#explode').focus();await page.locator('#explode').press('End');assert.equal(await page.locator('#explode').inputValue(),'1');
 await page.waitForTimeout(250);await page.screenshot({path:path.join(base,'artifacts/qa/exploded.png')});
 await page.locator('#explode').press('Home');await page.getByRole('button',{name:'人形',exact:true}).click();
 await page.waitForTimeout(250);await page.screenshot({path:path.join(base,'artifacts/qa/hero.png')});
 await page.locator('#timeline').focus();await page.locator('#timeline').press('End');
 await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(150);
 const restarted=Number(await page.locator('#timeline').inputValue());assert.ok(restarted<1,'replay should restart the completed timeline');
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 const count=await page.evaluate(()=>window.bumblebeeQA.count);assert.ok(count>=600);
 let playback=null;
 if(movie){
  await page.getByRole('button',{name:'播放本地成片',exact:true}).click();
  playback=await page.evaluate(()=>new Promise((resolve,reject)=>{const v=document.querySelector('video');const timeout=setTimeout(()=>reject(new Error('full playback timeout')),45000);v.muted=true;v.addEventListener('ended',()=>{clearTimeout(timeout);resolve({ended:true,currentTime:v.currentTime,duration:v.duration,decodedFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedFrames:v.getVideoPlaybackQuality().droppedVideoFrames});},{once:true});v.addEventListener('error',()=>reject(new Error('video error '+v.error?.message)),{once:true});}));
 }
 assert.deepEqual(errors,[]);
 const result={offline_file_url:true,ready:true,meshCount:count,reentrantPose:true,vehicleControl:true,robotControl:true,greyControl:true,explosionControl:true,replayControl:true,errors,playback};
 await writeFile(path.join(base,movie?'artifacts/playback-check.json':'artifacts/browser-check.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await browser.close();}
