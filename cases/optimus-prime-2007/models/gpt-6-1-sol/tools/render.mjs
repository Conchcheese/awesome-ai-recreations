import {root} from './deps.mjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const at=p=>path.join(root,p);
const sha=async p=>createHash('sha256').update(await fs.readFile(at(p))).digest('hex');
const json=async p=>JSON.parse(await fs.readFile(at(p),'utf8'));
const candidate=process.env.OPTIMUS_BLENDER_BIN||(process.platform==='darwin'?at('local/runtime/Blender.app/Contents/MacOS/Blender'):'blender');
async function run(cmd,args){const p=spawn(cmd,args,{stdio:'inherit'});const code=await new Promise((resolve,reject)=>{p.once('error',reject);p.once('close',resolve)});if(code!==0)throw Error(`${cmd} exited ${code}`);}
import {acquireAssetLock} from './asset-lock.mjs';
const release=await acquireAssetLock(root,'render');
try{
const htmlSha=await sha('index.html');
const meta=await json('artifacts/animation-export.json');
if(meta.htmlSha256!==htmlSha)throw Error('GLB 与当前网页不同，请先运行 node tools/export.mjs');
const qa=await json('artifacts/qa/report.json');
if(!['passed','passed_with_raster_limit'].includes(qa.result)||qa.htmlSha256!==htmlSha)throw Error('当前网页尚无有效浏览器验收，请先运行 node tools/qa.mjs');
await fs.mkdir(at('artifacts/exports'),{recursive:true});
await fs.copyFile(at('artifacts/optimus-cinematic.glb'),at(`artifacts/exports/${await sha('artifacts/optimus-cinematic.glb')}.glb`));
if(!process.argv.includes('--encode-only')){
 await run('python3',[at('tools/captions.py')]);
 await run(candidate,['--background','--factory-startup','--python',at('tools/blender_scene.py'),'--','--engine','CYCLES','--width','1920','--height','804','--samples','8','--movie','--save']);
}
const config=await json('artifacts/cycles-frames/render-config.json');
const report=await json('artifacts/cycles-render.json');
if(config.htmlSha256!==htmlSha||config.glbSha256!==await sha('artifacts/optimus-cinematic.glb')||config.exportMetaSha256!==await sha('artifacts/animation-export.json')||config.sceneScriptSha256!==await sha('tools/blender_scene.py'))throw Error('帧缓存与当前源资产不同，禁止编码');
if(report.result!=='complete'||report.frames!==672||report.htmlSha256!==htmlSha)throw Error('渲染未完整完成');
const frames=(await fs.readdir(at('artifacts/cycles-frames'))).filter(x=>/^\d{4}\.png$/.test(x)).sort();
if(frames.length!==672||frames.some((x,i)=>x!==`${String(i).padStart(4,'0')}.png`))throw Error('必须有连续的 0000–0671 共 672 帧');
for(const f of frames)if((await fs.stat(at(`artifacts/cycles-frames/${f}`))).size<5000)throw Error(`帧损坏：${f}`);
await run('python3',[at('tools/audio.py')]);
const out=at('artifacts/擎天柱-2007-电影版-Cycles.mp4');
await run('ffmpeg',['-hide_banner','-loglevel','warning','-y','-framerate','24','-i',at('artifacts/cycles-frames/%04d.png'),'-i',at('artifacts/original-cinematic-score.wav'),'-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p,noise=alls=1:allf=t','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-af','loudnorm=I=-16:TP=-2:LRA=9,alimiter=limit=0.89:level=false','-ar','48000','-movflags','+faststart','-shortest',out]);
console.log('电影剪辑已输出',path.basename(out));
await run('python3',[at('tools/video-check.py')]);

}finally{await release()}
