import * as T from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
export function createStage(renderer){
 const scene=new T.Scene();scene.name='industrial-film-stage';scene.background=new T.Color('#080d13');scene.fog=new T.FogExp2('#111a24',.014);
 let envTexture=null;
 const pmrem=new T.PMREMGenerator(renderer);
 if(typeof __ENV_HDR__!=='undefined'&&__ENV_HDR__){
  const raw=Uint8Array.from(atob(__ENV_HDR__),c=>c.charCodeAt(0));const result=new HDRLoader().parse(raw.buffer);
  envTexture=new T.DataTexture(result.data,result.width,result.height,T.RGBAFormat,result.type);envTexture.mapping=T.EquirectangularReflectionMapping;envTexture.needsUpdate=true;envTexture.colorSpace=T.LinearSRGBColorSpace;
  scene.environment=pmrem.fromEquirectangular(envTexture).texture;
 }else{const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.06).texture;room.dispose();}
 pmrem.dispose();scene.environmentIntensity=.48;scene.environmentRotation.y=2.5;
 RectAreaLightUniformsLib.init();
 const soft=new T.RectAreaLight('#e4e4dc',4.0,8,6);soft.position.set(-5,8,9);soft.lookAt(0,5,0);scene.add(soft);
 const strip=new T.RectAreaLight('#95b7d3',3.0,4,9);strip.position.set(7,6,-4);strip.lookAt(0,5,0);scene.add(strip);
 const ambient=new T.HemisphereLight('#9eafc4','#11151c',.45);scene.add(ambient);
 const key=new T.DirectionalLight('#f4d9b0',4.5);key.name='late-afternoon-key';key.position.set(-6,11,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-12,right:12,top:14,bottom:-10,near:.1,far:45});key.shadow.bias=-.0002;key.shadow.normalBias=.025;scene.add(key);
 const rim=new T.DirectionalLight('#91c7ff',3.2);rim.name='cold-rim';rim.position.set(5,8,-7);scene.add(rim);
 const fill=new T.DirectionalLight('#c0d4e0',.65);fill.position.set(8,3,10);scene.add(fill);
 const warm=new T.PointLight('#ffad53',45,35,2);warm.position.set(-9,5,-7);warm.name='warm-practical';scene.add(warm);
 const blue=new T.PointLight('#6894c9',30,35,2);blue.position.set(10,4,-10);scene.add(blue);
 const concrete=new T.MeshStandardMaterial({name:'damp-industrial-concrete',color:'#222a2f',metalness:.05,roughness:.68});
 const wallMat=new T.MeshStandardMaterial({name:'industrial-wall',color:'#26313a',metalness:.45,roughness:.57});
 const steel=new T.MeshStandardMaterial({name:'black-structural-steel',color:'#0d151d',metalness:.8,roughness:.45});
 const lampWarm=new T.MeshStandardMaterial({name:'amber-practical',color:'#ffcf95',emissive:'#ff9b46',emissiveIntensity:3});
 const lampCool=new T.MeshStandardMaterial({name:'cool-practical',color:'#a3c6db',emissive:'#608fb1',emissiveIntensity:2});
 const stage=new T.Group();stage.name='hangar-architecture';scene.add(stage);
 function box(name,w,h,d,x,y,z,mat){let m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;stage.add(m);return m;}
 const floor=new T.Mesh(new T.PlaneGeometry(160,160),concrete);floor.name='concrete-ground';floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=0;stage.add(floor);
 if(typeof document!=='undefined'){
  const c=document.createElement('canvas');c.width=c.height=1024;let ctx=c.getContext('2d');let pixels=ctx.createImageData(1024,1024);let seed=6423;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
  for(let i=0;i<pixels.data.length;i+=4){let v=85+rand()*50;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
  for(let i=0;i<90;i++){ctx.fillStyle=`rgba(15,20,24,${rand()*.25})`;ctx.beginPath();ctx.ellipse(rand()*1024,rand()*1024,20+rand()*110,8+rand()*30,rand()*6,0,7);ctx.fill();}
  let tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(18,18);tex.colorSpace=T.SRGBColorSpace;concrete.map=tex;concrete.roughnessMap=tex;concrete.bumpMap=tex;concrete.bumpScale=.05;concrete.needsUpdate=true;
 }
 // A full-depth industrial space, not a display plinth.
 for(let side of [-1,1])for(let i=0;i<7;i++){
  let z=8-i*7;box('hangar-column',.65,15,.8,side*14,7.5,z,steel);
  box('column-foot',1.1,.5,1.25,side*14,.25,z,wallMat);
  box('warm-wall-light',.12,2.8,.14,side*13.55,5.8,z,side<0?lampWarm:lampCool);
  box('ceiling-crossbeam',28.5,.35,.35,0,14.8,z,steel);
  if(i<6){box('wall-slab',.35,8,6.3,side*14.35,4,z-3.5,wallMat);box('wall-railing',.22,.13,7,side*13.9,7.4,z-3.5,steel);}
 }
 for(let i=0;i<8;i++)box('background-door-slat',26,.085,.16,0,1.1+i*1.6,-38,steel);
 for(let i=0;i<10;i++){box('floor-expansion-joint',.016,.008,110,-45+i*10,.008,-15,steel);box('floor-expansion-joint',120,.008,.016,0,.008,-45+i*10,steel);}
 const hazard=new T.MeshStandardMaterial({name:'faded-ochre-floor-paint',color:'#7f642b',roughness:.76,metalness:0});
 for(let s of [-1,1])for(let i=0;i<6;i++){const m=box('floor-guidance-line',.10,.012,2.3,s*5.9,.012,5-i*4,hazard);}
 // Thin steam sheets and dust are explicitly photographic atmosphere, never replacement geometry.
 const dustGeo=new T.BufferGeometry(),count=700,positions=new Float32Array(count*3);let seed=883;for(let i=0;i<count;i++){seed=(seed*1664525+1013904223)>>>0;positions[i*3]=(seed/4294967296-.5)*38;seed=(seed*1664525+1013904223)>>>0;positions[i*3+1]=(seed/4294967296)*15;seed=(seed*1664525+1013904223)>>>0;positions[i*3+2]=(seed/4294967296-.5)*40;}
 dustGeo.setAttribute('position',new T.BufferAttribute(positions,3));const dust=new T.Points(dustGeo,new T.PointsMaterial({color:'#b4a38b',size:.018,transparent:true,opacity:.32,depthWrite:false}));dust.name='suspended-dust';scene.add(dust);
 return {scene,stage,envTexture,setTime(t){dust.rotation.y=t*.0015},key};
}
