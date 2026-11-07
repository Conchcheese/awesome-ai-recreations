import {createStage} from './stage.js';
import {createMachine} from './machine.js';
import {css,createHud} from './hud.js';
import {stateAt,SHOTS,DURATION} from './model.js';
const query=new URLSearchParams(location.search),gray=query.has('gray');
document.body.className=(__MODE__==='film'?'film ':'')+(gray?'gray':'');
const style=document.createElement('style');style.textContent=css;document.head.append(style);
document.body.innerHTML='<canvas id="scene"></canvas><div id="hud"></div>';
const stage=createStage(document.querySelector('#scene'));
const machine=createMachine(stage.scene,{gray});
const hudEl=document.querySelector('#hud');
let t=0,playing=!query.has('render'),raf=0,last=0,orbit={az:0,el:0,zoom:1},labels=true,panels=true;
const hud=createHud(hudEl,(cmd,value)=>{
 if(cmd==='play'){playing=!playing;last=0;if(playing)raf=requestAnimationFrame(loop);else cancelAnimationFrame(raf);hud.setPlaying(playing);return;}
 if(cmd==='view'){const shot=SHOTS.find(s=>s.key===value);orbit={az:0,el:0,zoom:1};renderFrame(shot?.sample||0);return;}
 if(cmd==='seek')renderFrame(value);
 if(cmd==='reset'){orbit={az:0,el:0,zoom:1};renderFrame(0);}
 if(cmd==='explode')renderFrame(SHOTS.find(s=>s.key==='explode').sample);
 if(cmd==='labels'){labels=!labels;renderFrame(t);}
 if(cmd==='hud'){panels=!panels;hudEl.querySelectorAll('.rail').forEach(el=>el.style.display=panels?'':'none');}
});
function resize(){const k=Math.min(innerWidth/1920,innerHeight/1080);hudEl.style.transform=`translate(${(innerWidth-1920*k)/2}px,${(innerHeight-1080*k)/2}px) scale(${k})`;}
addEventListener('resize',resize);resize();
function draw(time){
 const state=stateAt(time);machine.update(state);hud.update(state,SHOTS);if(!labels)hud.get('annotation').style.display='none';
 const camera=structuredClone(state.camera);
 if(orbit.az||orbit.el||orbit.zoom!==1){const p=camera.eye.map((v,i)=>v-camera.target[i]),d=Math.hypot(...p)*orbit.zoom,az=Math.atan2(p[0],p[2])+orbit.az,el=Math.max(-.4,Math.min(1.2,Math.asin(p[1]/Math.hypot(...p))+orbit.el));camera.eye=[camera.target[0]+Math.sin(az)*Math.cos(el)*d,camera.target[1]+Math.sin(el)*d,camera.target[2]+Math.cos(az)*Math.cos(el)*d];}
 stage.render(camera);return state;
}
function renderFrame(time){playing=false;cancelAnimationFrame(raf);raf=0;last=0;t=Math.max(0,Math.min(DURATION,time));hud.setPlaying(false);return draw(t);}
function loop(now){if(!playing)return;if(last)t=(t+Math.min(.05,(now-last)/1000))%DURATION;last=now;draw(t);raf=requestAnimationFrame(loop);}
if(__MODE__==='live'){
 let drag=null;const canvas=document.querySelector('#scene');
 canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drag)return;orbit.az+=(e.clientX-drag[0])*.005;orbit.el+=(e.clientY-drag[1])*.004;drag=[e.clientX,e.clientY];renderFrame(t);};
 canvas.onpointerup=()=>drag=null;
 canvas.onwheel=e=>{e.preventDefault();orbit.zoom=Math.max(.65,Math.min(1.7,orbit.zoom*Math.exp(e.deltaY*.001)));renderFrame(t);};
}
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();hud.get('play').click();}if(e.code==='ArrowRight')renderFrame(t+.5);if(e.code==='ArrowLeft')renderFrame(t-.5);});
draw(0);
window.__sim={ready:true,duration:DURATION,renderFrame,stateAt,inspectMotion:machine.inspectMotion,counts:machine.counts};
if(playing)raf=requestAnimationFrame(loop);
