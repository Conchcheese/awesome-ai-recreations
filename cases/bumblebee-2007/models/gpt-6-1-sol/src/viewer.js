import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const data=window.BUMBLEBEE, scene=new THREE.Scene();
scene.background=new THREE.Color('#111820');scene.fog=new THREE.FogExp2('#111820',.014);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.querySelector('#stage').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,180);camera.up.set(0,0,1);camera.position.set(7,-12,4.3);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,2.9);controls.minDistance=3;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.49;controls.enableDamping=true;
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
scene.environmentIntensity=.7;scene.add(new THREE.HemisphereLight(0xbad8ff,0x252523,.8));
for(const [pos,color,power] of [[[3,-6,9],0xffddaf,90],[[-5,1,5],0x78beff,70],[[3,4,7],0xff9839,110]]){
 const l=new THREE.DirectionalLight(color,power/30);l.position.set(...pos);scene.add(l);l.castShadow=true;l.shadow.mapSize.set(2048,2048);Object.assign(l.shadow.camera,{left:-7,right:7,top:8,bottom:-7,near:.1,far:30});l.shadow.bias=-.0005;
}
const floor=new THREE.Mesh(new THREE.BoxGeometry(100,100,.2),new THREE.MeshStandardMaterial({color:0x080e14,roughness:.33,metalness:.4,envMapIntensity:.3}));floor.position.z=-.13;floor.receiveShadow=true;scene.add(floor);
const walls=new THREE.MeshStandardMaterial({color:0x151e26,roughness:.68,metalness:.2});
const backwall=new THREE.Mesh(new THREE.BoxGeometry(55,.6,8),walls);backwall.position.set(0,8,4);backwall.receiveShadow=true;scene.add(backwall);
for(let i=-5;i<=5;i++){
 const p=new THREE.Mesh(new THREE.BoxGeometry(.5,.8,8),walls);p.position.set(i*3.7,7,4);scene.add(p);
 const strip=new THREE.Mesh(new THREE.BoxGeometry(.025,.03,5.7),new THREE.MeshBasicMaterial({color:0xf9a940}));strip.position.set(i*3.7+.3,6.56,3.5);scene.add(strip);
}
const bytes=Uint8Array.from(atob(data.glb),c=>c.charCodeAt(0));
const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes.buffer,'',resolve,reject));scene.add(gltf.scene);
const nodes=new Map(data.assemblies.map(a=>[a.id,gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(a.id))]));
for(const [id,node] of nodes)if(!node)throw new Error('GLTF assembly mapping failed: '+id);
const originals=new Map();gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;originals.set(o,o.material);}});
const ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
let time=18,playing=false,cinematic=false,explode=0,grey=false;
const slider=document.querySelector('#timeline'),stamp=document.querySelector('#stamp');
function pose(t){
 const raw=(t-3.1)/6.4;
 for(const a of data.assemblies){
  const o=nodes.get(a.id);if(!o)throw new Error('Missing assembly '+a.id);
  const q=ease((raw-a.delay*.55)/(1-a.delay*.55));
  o.position.fromArray(a.car).lerp(new THREE.Vector3(...a.robot),q);
  if(['door.','chest.','front_wheel.','forearm.'].some(x=>a.id.startsWith(x)))o.position.x+=(a.robot[0]<0?-1:1)*.32*Math.sin(Math.PI*q);
  o.rotation.set(...a.cr.map((v,i)=>v*(1-q)+a.rr[i]*q),'XYZ');
  if(raw>=1)o.position.z+=.012*Math.sin((t-9.5)*1.2)*(['head','torso','battle_mask'].includes(a.id)?1:.25);
  if(explode){o.position.x+=Math.sign(a.robot[0])*explode*.65;o.position.z+=(a.robot[2]-3)*explode*.25;o.position.y+=a.robot[1]*explode*.4;}
 }
 const m=nodes.get('battle_mask');if(raw>=1){const opening=1-ease((t-11.2)/1.3);m.position.z-=.35*opening;m.position.y+=.12*opening;m.rotation.x=.25*opening;nodes.get('head').rotation.z=.08*Math.sin((t-9.5)*.65);}
 stamp.textContent=`${t.toFixed(1).padStart(4,'0')} / 22.0s`;slider.value=t;
}
function filmCamera(t){
 let pos,target,lens;
 if(t<3.1){const u=t/3.1;pos=[5.3-u*.45,-7.7+u*.3,2.45-u*.2];target=[0,-.2,.8];lens=48;}
 else if(t<10){const u=ease((t-3.1)/6.9);pos=new THREE.Vector3(5,-7.5,2.25).lerp(new THREE.Vector3(8.7,-18.8,4.4),u).toArray();target=[0,0,.8+2.1*u];lens=47;}
 else if(t<13.5){const u=(t-10)/3.5;pos=[1.75-u*.5,-6.4+u*.3,5.5-u*.13];target=[0,-.12,5.04];lens=55;}
 else if(t<16){const u=(t-13.5)/2.5;pos=[3.8-u*.5,-5.2,3.25+u*.25];target=[1.02,-.05,3.44];lens=58;}
 else{const u=(t-16)/6,angle=.32-u*.6,radius=20.8-u*.8;pos=[Math.sin(angle)*radius,-Math.cos(angle)*radius,3.25+u*.3];target=[0,0,2.96];lens=45;}
 camera.position.fromArray(pos);camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(36/(2*lens*camera.aspect)));camera.updateProjectionMatrix();camera.lookAt(...target);controls.target.set(...target);
}
function setPlaying(value){playing=value;document.querySelector('#play').textContent=playing?'暂停':'播放';}
function play(){if(time>=22)time=0;setPlaying(!playing);}
document.querySelector('#play').onclick=play;
document.querySelector('#car').onclick=()=>{setPlaying(false);time=0;pose(time);controls.target.set(0,0,.9);camera.position.set(5,-7.7,2.45);};
document.querySelector('#robot').onclick=()=>{setPlaying(false);time=18;pose(time);controls.target.set(0,0,2.9);camera.position.set(7,-12,4.3);};
slider.oninput=()=>{time=Number(slider.value);setPlaying(false);pose(time);};
document.querySelector('#cinematic').onclick=e=>{cinematic=!cinematic;e.target.setAttribute('aria-pressed',cinematic);controls.enabled=!cinematic;if(cinematic){time=0;playing=true;document.querySelector('#play').textContent='暂停';}};
document.querySelector('#explode').oninput=e=>{explode=Number(e.target.value);pose(time);};
document.querySelector('#grey').onclick=e=>{grey=!grey;e.target.setAttribute('aria-pressed',grey);for(const [o,m] of originals)o.material=grey?new THREE.MeshStandardMaterial({color:0x87929a,roughness:.65}):m;};
const closeVideo=()=>{const v=document.querySelector('#rendered');v.pause();v.hidden=true;document.querySelector('#closevideo').hidden=true;};
document.querySelector('#closevideo').onclick=closeVideo;
document.querySelector('#movie').onclick=()=>{setPlaying(false);const v=document.querySelector('#rendered');v.src=new URL('artifacts/'+encodeURIComponent('大黄蜂-2007-电影短片.mp4'),location.href).href;v.hidden=false;document.querySelector('#closevideo').hidden=false;v.controls=true;v.play().catch(()=>{});};
document.querySelector('#rendered').onerror=()=>{document.querySelector('#message').textContent='本地成片尚未生成。请按 README 渲染与编码；实时巡览可直接使用。';closeVideo();};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='INPUT'){e.preventDefault();play();}if(e.code==='Escape')closeVideo();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.bumblebeeQA={ready:true,pose(t){time=t;pose(t);return this.snapshot();},snapshot(){return [...nodes].map(([id,o])=>[id,...o.position.toArray(),...o.rotation.toArray().slice(0,3),...o.scale.toArray()]);},count:originals.size};
pose(time);document.querySelector('#loading').remove();
if(location.pathname.endsWith('film.html')){cinematic=true;time=0;playing=true;controls.enabled=false;document.querySelector('#play').textContent='暂停';document.querySelector('#cinematic').setAttribute('aria-pressed','true');}
let last=performance.now();
renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.1);last=now;if(!document.querySelector('#rendered').hidden)return;if(playing){time+=dt;if(time>=22){time=22;setPlaying(false);}pose(time);}if(cinematic)filmCamera(time);else controls.update();renderer.render(scene,camera);});
