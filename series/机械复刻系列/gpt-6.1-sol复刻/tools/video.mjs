import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ROOT,require,browserArgs} from './deps.mjs';
import {SHOTS,DURATION} from '../src/model.js';
const FPS=Number(process.env.FPS||60),fullFrames=DURATION*FPS,frames=Number(process.env.FRAMES||fullFrames);
if(![30,60].includes(FPS)||!Number.isInteger(frames)||frames<1||frames>fullFrames)throw new Error(`FPS 选30或60，FRAMES 应为1..${fullFrames}整数；完整成片使用默认值`);
const dest=path.join(ROOT,'artifacts');fs.mkdirSync(dest,{recursive:true});
const silent=path.join(dest,frames===fullFrames?`oc8-v2-${DURATION}s-${FPS}fps-silent.mp4`:`diagnostic-v2-${frames}-frames.mp4`);
const browser=await require('playwright').chromium.launch({headless:true,args:browserArgs});
let ff;
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(path.join(ROOT,'00-机械章鱼OC-8/机械章鱼OC-8-影片页.html'));url.search='render=1';
 await page.goto(url.href);await page.waitForFunction(()=>window.__sim?.ready);await page.evaluate(()=>document.fonts.ready);
 ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(FPS),'-vcodec','mjpeg','-i','-','-an','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:['pipe','inherit','inherit']});
 const done=new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('close',code=>code===0?resolve():reject(new Error('ffmpeg 退出码 '+code)));});done.catch(()=>{});
 let writeError;ff.stdin.on('error',e=>writeError=e);
 const start=Date.now();
 for(let i=0;i<frames;i++){
  if(writeError)throw writeError;
  await page.evaluate(t=>window.__sim.renderFrame(t),i/FPS);
  if(errors.length)throw new Error(errors.join('\n'));
  const jpeg=await page.screenshot({type:'jpeg',quality:95,animations:'disabled'});
  if(!ff.stdin.write(jpeg))await new Promise((resolve,reject)=>{const ready=()=>{clean();resolve();},failed=e=>{clean();reject(e);},clean=()=>{ff.stdin.off('drain',ready);ff.stdin.off('error',failed);};ff.stdin.once('drain',ready);ff.stdin.once('error',failed);});
  if(i%30===0||i===frames-1)console.log(`${i+1}/${frames} frames · ${((Date.now()-start)/1000).toFixed(0)} s elapsed`);
 }
 ff.stdin.end();await done;
 if(frames!==fullFrames){console.log('诊断片：'+silent);}
 else{
  execFileSync(process.platform==='win32'?'python':'python3',[path.join(ROOT,'tools/score.py'),JSON.stringify({duration:DURATION,beats:SHOTS.map(s=>s.at),jetWindows:[[0,SHOTS[1].at],[SHOTS.find(s=>s.key==='siphon').at+1.8,SHOTS.find(s=>s.key==='hold').at],[SHOTS.find(s=>s.key==='depart').at,DURATION]]})],{stdio:'inherit'});
  const out=path.join(dest,`机械章鱼OC-8-GPT-6.1-Sol-动作完整版-${DURATION}s-1080p${FPS}.mp4`);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','warning','-y','-i',silent,'-i',path.join(dest,'oc8-v2-score.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-af','loudnorm=I=-18:TP=-1.5:LRA=7','-t',String(DURATION),'-movflags','+faststart',out],{stdio:'inherit'});
  const probe=execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',out]);fs.writeFileSync(path.join(dest,'video-v2-probe.json'),probe);
  const data=JSON.parse(probe);const v=data.streams.find(s=>s.codec_type==='video');
  if(v.width!==1920||v.height!==1080||Number(v.nb_frames)!==fullFrames||Math.abs(Number(data.format.duration)-DURATION)>.05||!data.streams.some(s=>s.codec_type==='audio'))throw new Error('成片规格不符');
  console.log(`✓ 1920×1080 / ${FPS} fps / ${fullFrames} 帧 / ${DURATION} s / H.264 + AAC`);console.log('成片：'+out);
 }
}finally{if(ff&&ff.exitCode===null&&!ff.killed)ff.kill('SIGTERM');await browser.close();}
