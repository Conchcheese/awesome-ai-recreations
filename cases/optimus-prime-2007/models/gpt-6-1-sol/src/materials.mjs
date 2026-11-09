import * as T from 'three';
const random=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
export function makeMaterials(){
 const textureFiles=[];
 function maps(kind,color,seed,flame=false){
  if(typeof document==='undefined')return {};
  const size=1024,rand=random(seed),c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,size,size);
  const base=ctx.getImageData(0,0,size,size);
  for(let i=0;i<base.data.length;i+=4){let noise=(rand()-.5)*(kind==='paint'?9:19);for(let j=0;j<3;j++)base.data[i+j]=Math.max(0,Math.min(255,base.data[i+j]+noise));}ctx.putImageData(base,0,0);
  if(flame){
   ctx.save();ctx.translate(0,size);ctx.scale(1,-1);
   for(let i=0;i<6;i++){let x=65+i*178+rand()*18,tip=430+rand()*480;ctx.beginPath();ctx.moveTo(x-100,0);ctx.bezierCurveTo(x+135,tip*.20,x-95,tip*.45,x+45,tip*.84);ctx.bezierCurveTo(x+8,tip*.96,x+100,tip*.96,x+132,tip+20);ctx.bezierCurveTo(x+28,tip*.82,x+2,tip*.62,x+40,tip*.50);ctx.bezierCurveTo(x+116,tip*.36,x+198,tip*.20,x+125,0);ctx.closePath();ctx.fillStyle=flame==='blue'?'#a51a22':'#163c88';ctx.strokeStyle='#bd873c';ctx.lineWidth=3.5;ctx.stroke();ctx.fill();}
   ctx.restore();
  }
  // Fine chips at actual panel UV edges; no giant generic grunge overlay.
  for(let i=0;i<950;i++){let side=Math.floor(rand()*4),x=rand()*size,y=rand()*size,edge=rand()*13;
   if(side===0)x=edge;if(side===1)x=size-edge;if(side===2)y=edge;if(side===3)y=size-edge;
   ctx.fillStyle=`rgba(171,181,185,${.12+rand()*.5})`;ctx.fillRect(x,y,1+rand()*7,1+rand()*2);
  }
  for(let i=0;i<350;i++){let x=rand()*size,y=rand()*size;ctx.strokeStyle=`rgba(210,221,224,${rand()*.12})`;ctx.lineWidth=.3+rand();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*35,y+rand()*3);ctx.stroke();}
  for(let i=0;i<90;i++){let x=rand()*size,y=rand()*size;ctx.strokeStyle=`rgba(151,161,164,${.12+rand()*.25})`;ctx.lineWidth=.7+rand()*1.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+4+rand()*44,y+rand()*12);ctx.stroke();}
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;textureFiles.push({name:`${kind}-${seed}-color`,canvas:c,texture:tex});
  const rc=document.createElement('canvas');rc.width=rc.height=size;const rx=rc.getContext('2d');rx.fillStyle=kind==='paint'?'#949494':'#b4b4b4';rx.fillRect(0,0,size,size);
  for(let i=0;i<2200;i++){let x=rand()*size,y=rand()*size;let v=90+rand()*100;rx.strokeStyle=`rgba(${v},${v},${v},.25)`;rx.lineWidth=.3+rand()*2;rx.beginPath();rx.moveTo(x,y);rx.lineTo(x+rand()*90,y+(kind==='paint'?rand()*5:0));rx.stroke();}
  const rough=new T.CanvasTexture(rc);textureFiles.push({name:`${kind}-${seed}-roughness`,canvas:rc,texture:rough});
  const nc=document.createElement('canvas');nc.width=nc.height=512;const nx=nc.getContext('2d');let data=nx.createImageData(512,512);
  for(let i=0;i<data.data.length;i+=4){data.data[i]=128+(rand()-.5)*14;data.data[i+1]=128+(rand()-.5)*14;data.data[i+2]=255;data.data[i+3]=255;}nx.putImageData(data,0,0);
  const normal=new T.CanvasTexture(nc);normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.repeat.set(3,3);textureFiles.push({name:`${kind}-${seed}-normal`,canvas:nc,texture:normal});
  return {map:tex,roughnessMap:rough,normalMap:normal,normalScale:new T.Vector2(.18,.18)};
 }
 const paint=(name,c,s,flame=false)=>new T.MeshPhysicalMaterial({name,color:'#ffffff',...maps('paint',c,s,flame),metalness:.80,roughness:.46,clearcoat:.65,clearcoatRoughness:.28});
 const metal=(name,c,s,r=.34)=>new T.MeshPhysicalMaterial({name,color:'#ffffff',...maps('metal',c,s),metalness:.88,roughness:r,clearcoat:.10});
 const M={red:paint('scratched-red-clearcoat','#9d1520',117),blue:paint('scratched-cobalt-clearcoat','#112a61',221),flame:paint('red-enamel-blue-flames','#a1191d',313,true),steel:metal('machined-steel','#76818b',41),bright:metal('brushed-alloy','#b4bdc0',59,.27),dark:metal('oiled-gunmetal','#27323c',67,.49),chrome:metal('polished-chrome','#d6e1e5',79,.14),warm:metal('heat-discolored-titanium','#9b7653',83,.39),copper:metal('aged-copper','#7f5031',97,.48)};
 M.flameBlue=paint('cobalt-enamel-red-flames','#132c66',414,'blue');
 M.black=new T.MeshStandardMaterial({name:'carbon-black-composite',color:'#070b10',metalness:.3,roughness:.64});M.rubber=new T.MeshStandardMaterial({name:'tire-rubber',color:'#0c1012',roughness:.94,metalness:0});
 M.glass=new T.MeshPhysicalMaterial({name:'laminated-smoked-glass',color:'#314751',metalness:.12,roughness:.10,clearcoat:1,transmission:.15,thickness:.14,ior:1.48});
 M.eye=new T.MeshStandardMaterial({name:'blue-optical-emitter',color:'#478dc4',emissive:'#008aff',emissiveIntensity:1.3,roughness:.16});
 M.lamp=new T.MeshStandardMaterial({name:'warm-projector-lens',color:'#fff7d7',emissive:'#ffd38b',emissiveIntensity:2.7,roughness:.18,metalness:.3});
 M.core=new T.MeshStandardMaterial({name:'reactor-lens',color:'#5290b0',emissive:'#117bb5',emissiveIntensity:.2,metalness:.5,roughness:.24});
 M.energy=new T.MeshPhysicalMaterial({name:'energon-orange-edge',color:'#ff8529',emissive:'#ff4808',emissiveIntensity:.7,metalness:.4,roughness:.24,transparent:true,opacity:.85,transmission:.18,thickness:.2});
 M.gray=new T.MeshStandardMaterial({name:'clay',color:'#8d969d',roughness:.62,metalness:.05});
 return {M,textureFiles};
}
