import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {OutlinePass} from 'three/addons/postprocessing/OutlinePass.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {makeModel} from './model.mjs';
import {createStage} from './stage.mjs';
import {shotCamera} from './camera.mjs';
import {stateAt,rigAt,mix,ease,DURATION,systems,shots} from './timeline.mjs';
const $=id=>document.getElementById(id);const params=new URLSearchParams(location.search);const capture=params.has('capture');let film=!!document.body.dataset.film||params.has('film');if(film)document.body.dataset.film='true';
try{
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(capture?1:Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.outputColorSpace=T.SRGBColorSpace;$('scene').appendChild(renderer.domElement);
 const stage=createStage(renderer),scene=stage.scene,model=makeModel();scene.add(model.root);
 const camera=new T.PerspectiveCamera(39,innerWidth/innerHeight,.10,180);camera.name='cinema-camera';scene.add(camera);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=4;controls.maxDistance=45;controls.maxPolarAngle=Math.PI*.49;
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const ssao=new SSAOPass(scene,camera,Math.round(innerWidth*.65),Math.round(innerHeight*.65),16);ssao.kernelRadius=.17;ssao.minDistance=.001;ssao.maxDistance=.085;composer.addPass(ssao);
 const outline=new OutlinePass(new T.Vector2(innerWidth,innerHeight),scene,camera);outline.edgeStrength=2.5;outline.edgeGlow=.1;outline.edgeThickness=1;outline.visibleEdgeColor.set('#d3ab72');outline.hiddenEdgeColor.set('#4b4439');composer.addPass(outline);
 const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.18,.52,1.8);composer.addPass(bloom);
 const bokeh=new BokehPass(scene,camera,{focus:18,aperture:.000025,maxblur:.006});composer.addPass(bokeh);
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0},film:{value:film?1:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float time;uniform float film;varying vec2 vUv;float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+floor(time*24.)*.13)*43758.5453);}void main(){vec2 d=vUv-.5;vec3 c=texture2D(tDiffuse,vUv).rgb;float vig=1.-.24*dot(d*1.35,d*1.35);c*=vig;c.b*=1.02;c.r*=1.01;float grain=(hash(gl_FragCoord.xy)-.5)*.004;c+=grain*(.25+.75*film);gl_FragColor=vec4(c,1.);}`});composer.addPass(new OutputPass());composer.addPass(grade);
 let t=film?0:21,playing=film&&!capture,manual=!film,autoCamera=film,view='three',last=performance.now(),gray=false,colored=false,joints=false;
 let manualP=1,extra={chest:0,shoulders:0,arms:0,legs:0,back:0,explode:0,blade:0,pose:1,grip:0},transition=null,selected=null;
 function cloneExtras(){return {...extra,p:manualP}}
 function viewCamera(p=manualP){const portrait=innerWidth<innerHeight;const h=mix(1.7,4.5,p);let d=(portrait?mix(18,24,p):mix(15,18,p))*(1+.3*extra.explode);const positions={front:[0,h+.4,d],side:[Math.min(d,12.5),h+1,0],back:[0,h+1,-d],three:[d*.56,h+2.1,d*.84]};camera.position.fromArray(positions[view]);controls.target.set(0,h,0);camera.fov=view==='side'?2*Math.atan(Math.tan(T.MathUtils.degToRad(39/2))*d/Math.min(d,12.5))*180/Math.PI:39;camera.clearViewOffset();if(!portrait)camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.025,0,innerWidth,innerHeight);camera.updateProjectionMatrix();camera.lookAt(controls.target);controls.update();}
 function cinematic(s){const c=shotCamera(s,innerWidth<innerHeight);camera.position.fromArray(c.position);controls.target.fromArray(c.target);camera.fov=c.fov;camera.clearViewOffset();camera.updateProjectionMatrix();camera.lookAt(controls.target);bokeh.uniforms.focus.value=c.focus;bokeh.uniforms.aperture.value=s.shot.start>=24&&s.shot.start<38?.00011:.000028;return c;}
 function updateText(s){const shot=s.shot;$('time').textContent=`${t.toFixed(2).padStart(5,'0')} / 50.00`;$('timeline').value=t;
  $('chapter').textContent=manual?'ASSEMBLY / STRUCTURE STUDY':shot.name;
  let name=manual?(manualP<.05?'长头卡车':extra.explode>.1?'分层拆解与装配':extra.chest>.1?'胸甲与核心展开':extra.arms>.1?'前臂工具与指节':extra.shoulders>.1?'肩甲分瓣与轮组':extra.legs>.1?'髋膝踝与腿甲':extra.back>.1?'背甲与排气系统':'装甲之下，机械成形。'):shot.title;
  $('stage').textContent=name;$('description').textContent=manual?'可选择独立装配 · 局部展开含本轮展示设计':'电影造型研究 · 隐藏机构与路径为近似推演';
  $('film-index').textContent=String(shots.indexOf(shot)+1).padStart(2,'0')+' / 10';$('film-title').textContent=shot.name;
 }
 function renderAt(seconds){t=Math.max(0,Math.min(DURATION,seconds));const s=stateAt(t);const r=manual?rigAt(manualP,extra):s.rig;model.apply(r);stage.setTime(t);if(autoCamera)cinematic(s);grade.uniforms.time.value=t;grade.uniforms.film.value=film?1:0;updateText(s);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);renderer.shadowMap.needsUpdate=true;composer.render();if(capture)composer.render();return {t,p:r.p,shot:s.shot.name,assemblies:model.assemblies.length,parts:model.pieces.length,drawCalls:renderer.info.render.calls};}
 function updatePlay(){$('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';$('cinema').classList.toggle('active',autoCamera)}
 function setManual(values,instant=false){manual=true;playing=false;autoCamera=false;const target={...cloneExtras(),...values};if(instant||capture){manualP=target.p;Object.assign(extra,target);transition=null;model.apply(rigAt(manualP,extra));viewCamera();renderAt(t)}else transition={start:performance.now(),from:cloneExtras(),to:target,duration:1400};updatePlay();}
 function mode(name,instant=false){
  let values={p:1,chest:0,shoulders:0,arms:0,legs:0,back:0,explode:0,blade:0,pose:1,grip:0};
  if(name==='truck')values.p=0;
  else if(name==='explode'){values.explode=1;values.shoulders=.7;}
  else if(name==='arms'){values.arms=1;values.blade=1;values.grip=1;}
  else if(['chest','shoulders','legs','back'].includes(name))values[name]=1;
  document.querySelectorAll('[data-channel]').forEach(input=>input.value=values[input.dataset.channel]??0);
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===name));$('layers').value=values.explode;setManual(values,instant);
 }
 $('play').onclick=()=>{if(t>=DURATION)t=0;manual=false;transition=null;autoCamera=true;playing=!playing;updatePlay();renderAt(t)};
 $('cinema').onclick=()=>{manual=false;transition=null;autoCamera=true;t=0;playing=true;updatePlay();renderAt(t)};
 $('timeline').oninput=e=>{manual=false;playing=false;autoCamera=true;transition=null;renderAt(+e.target.value);updatePlay()};
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
 $('research').onclick=()=>{const visible=document.querySelector('.panel').hidden;document.querySelector('.panel').hidden=!visible;$('research').classList.toggle('active',visible);$('research').setAttribute('aria-expanded',String(visible));autoCamera=false;playing=false;updatePlay();renderAt(t)};
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;autoCamera=false;viewCamera(manual?manualP:stateAt(t).p);renderAt(t)});
 const channelNames={chest:'胸甲开合',shoulders:'肩甲开合',arms:'前臂护甲',legs:'腿甲开合',back:'背甲开合',grip:'指节握合',blade:'能量工具'};
 function editSystem(key,value){if(!(key in channelNames))throw Error('Unknown system channel');const reposition=manualP!==1||autoCamera;manual=true;manualP=1;autoCamera=false;playing=false;transition=null;extra[key]=Math.max(0,Math.min(1,value));if(reposition)viewCamera();const input=document.querySelector('[data-channel="'+key+'"]');if(input)input.value=extra[key];updatePlay();return renderAt(t);}
 for(let[key,name]of Object.entries(channelNames)){let label=document.createElement('label');label.textContent=name;let input=document.createElement('input');input.type='range';input.min='0';input.max='1';input.step='.01';input.value='0';input.dataset.channel=key;input.setAttribute('aria-label',name);input.oninput=()=>editSystem(key,+input.value);label.appendChild(input);$('channel-controls').appendChild(label);}
 $('layers').oninput=e=>setManual({p:1,explode:+e.target.value},true);
 $('gray').onclick=()=>{gray=!gray;model.setGray(gray);$('gray').classList.toggle('active',gray);renderAt(t)};
 $('colors').onclick=()=>{colored=!colored;model.setHighlight(colored?'colors':'all');$('colors').classList.toggle('active',colored);renderAt(t)};
 $('joints').onclick=()=>{joints=!joints;model.setJoints(joints);$('joints').classList.toggle('active',joints);renderAt(t)};
 function select(id){selected=id;let a=model.assemblies.find(x=>x.id===id);outline.selectedObjects=a?[a.group]:[];$('selected-name').textContent=id||'选择一个装配节点';$('selected-info').textContent=a?`${a.system} / ${a.role} / ${model.pieces.filter(p=>p.assembly===a.id).length} 分件`:'';renderAt(t);}
 const allSystems=[...new Set(model.assemblies.map(a=>a.system))];const labelMap=Object.fromEntries(systems);
 for(let system of allSystems){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=(labelMap[system]||{bodywork:'车身 / 发动机盖',hands:'手掌 / 指节',core:'核心 / 脊柱',engine:'发动机 / 格栅',pelvis:'髋部 / 承力架',head:'头部 / 面甲',wheels:'轮胎 / 轮毂',tools:'前臂工具',actuators:'液压 / 活塞'}[system]||system)+` (${model.assemblies.filter(a=>a.system===system).length})`;details.append(summary);
  const wrap=document.createElement('div');wrap.className='nodes';for(let a of model.assemblies.filter(a=>a.system===system)){let b=document.createElement('button');b.textContent=a.id;b.onclick=()=>select(a.id);wrap.append(b)}details.append(wrap);$('tree').append(details);}
 let down=null;renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(down.x-e.clientX,down.y-e.clientY)>5)return;const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);let hit=ray.intersectObjects(model.meshes,false).find(h=>!h.object.material.transparent||h.object.material.opacity>.01);if(hit){select(model.pick(hit.object));document.querySelector('.panel').hidden=false;$('research').setAttribute('aria-expanded','true');}});
 controls.addEventListener('start',()=>{autoCamera=false;updatePlay()});controls.addEventListener('change',()=>{if(!autoCamera)composer.render()});
 window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();$('play').click()}});
 window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);ssao.setSize(Math.round(innerWidth*.65),Math.round(innerHeight*.65));camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(!autoCamera)viewCamera();renderAt(t)});
 async function exportGLB(){
  playing=false;manual=false;autoCamera=false;const nodes=model.assemblies.map(a=>a.group);nodes.push(model.root);
  const samples=1201,times=new Float32Array(samples),positions=nodes.map(()=>[]),quats=nodes.map(()=>[]),cameraFrames=[];
  for(let i=0;i<samples;i++){const time=i/24;times[i]=time;const s=stateAt(time);model.apply(s.rig);for(let j=0;j<nodes.length;j++){positions[j].push(...nodes[j].position.toArray());quats[j].push(...nodes[j].quaternion.toArray());}cameraFrames.push({t:time,...shotCamera(s,false)});}
  const tracks=[];nodes.forEach((n,i)=>{tracks.push(new T.VectorKeyframeTrack(n.uuid+'.position',times,positions[i]));tracks.push(new T.QuaternionKeyframeTrack(n.uuid+'.quaternion',times,quats[i]));});const clip=new T.AnimationClip('cinematic-assembly',50,tracks);
  model.apply(stateAt(0).rig);const exporter=new GLTFExporter();const savedUserData=[];model.root.traverse(o=>{savedUserData.push([o,o.userData]);const a=o.userData.assembly;o.userData=a?{assemblyId:a.id,system:a.system,role:a.role}:{partIds:o.userData.partIds||[]};});let glb;try{glb=await exporter.parseAsync(model.root,{binary:true,animations:[clip],onlyVisible:true,maxTextureSize:1024});}finally{for(let[o,d]of savedUserData)o.userData=d;}
  return {base64:await new Promise(resolve=>{let reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(new Blob([glb]))}),cameraFrames,assemblies:model.describe(),parts:model.pieces};
 }
 window.study={ready:true,renderAt:(seconds)=>{manual=false;transition=null;playing=false;autoCamera=true;return renderAt(seconds)},setMode:(name)=>{mode(name,true);return {mode:name}},setSystem:editSystem,setProgress:(p)=>{setManual({p},true);return renderAt(t)},setCamera:(v)=>{view=v;autoCamera=false;viewCamera(manual?manualP:stateAt(t).p);return renderAt(t)},setFilm:(v)=>{film=v;if(v)document.body.dataset.film='true';else delete document.body.dataset.film;return renderAt(t)},setGray:(v)=>{gray=v;model.setGray(v);return renderAt(t)},select,exportGLB,
  snapshot:()=>model.snapshot(),cameraSnapshot:()=>({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()}),catalog:()=>model.describe(),pieces:()=>model.pieces,bounds:()=>{let b=new T.Box3().setFromObject(model.root);return [...b.min.toArray(),...b.max.toArray()]},stats:()=>({assemblies:model.assemblies.length,parts:model.pieces.length,renderMeshes:model.meshes.length,triangles:model.meshes.reduce((n,m)=>n+(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3,0)}),cameraAt:(time,portrait=false)=>shotCamera(stateAt(time),portrait)};
 if(!autoCamera)viewCamera();renderAt(params.has('t')?+params.get('t'):t);updatePlay();$('loading').hidden=true;
 function frame(now){let dt=Math.min(.08,(now-last)/1000);last=now;
  if(transition){let u=ease((now-transition.start)/transition.duration);for(let[k,v]of Object.entries(transition.to)){let value=mix(transition.from[k]??0,v,u);if(k==='p')manualP=value;else extra[k]=value;}if(u>=1)transition=null;viewCamera();renderAt(t);}
  else if(playing){t+=dt;if(t>=DURATION){t=DURATION;playing=false;updatePlay()}renderAt(t)}
  if(!capture)requestAnimationFrame(frame);
 }if(!capture)requestAnimationFrame(frame);
}catch(e){$('loading').hidden=true;$('error').textContent='三维初始化失败：'+e.message;console.error(e);}
