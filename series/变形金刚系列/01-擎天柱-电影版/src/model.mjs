import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeMaterials} from './materials.mjs';
import {buildMovieHead} from './head.mjs';
import {mix,ease,rigAt} from './timeline.mjs';
export function makeModel(){
 const {M,textureFiles}=makeMaterials();const root=new T.Group();root.name='optimus-2007';const assemblies=[],pieces=[],meshes=[],wheels=[],digits=[],petals=[],grilles=[],legRigs=[],rearAxles=[],armRigs=[],backs=[],windows=[],struts=[];
 let pieceId=0;const geoCache=new Map();
 function node(parent,id,system,xyz=[0,0,0],explode=[0,0,0],role='hinge'){
  const g=new T.Group();g.name=id;g.position.fromArray(xyz);parent.add(g);
  const rec={id,system,role,parent:parent.name,group:g,restPosition:g.position.clone(),restRotation:g.rotation.clone(),explode:new T.Vector3(...explode)};assemblies.push(rec);g.userData.assembly=rec;return g;
 }
 function mesh(parent,name,geometry,mat,xyz=[0,0,0],rot=[0,0,0]){const m=new T.Mesh(geometry,mat);m.name=name+'-'+(++pieceId);m.position.fromArray(xyz);m.rotation.set(rot[0]||0,rot[1]||0,rot[2]||0);m.castShadow=true;m.receiveShadow=true;m.userData.originalMaterial=mat;parent.add(m);meshes.push(m);pieces.push({id:m.name,assembly:parent.name,material:mat.name});return m;}
 function box(g,name,w,h,d,x,y,z,mat=M.steel,bevel=.035){const key=['b',w,h,d,bevel].join();let geo=geoCache.get(key);if(!geo){geo=bevel?new RoundedBoxGeometry(w,h,d,2,Math.min(bevel,w/4,h/4,d/4)):new T.BoxGeometry(w,h,d);geoCache.set(key,geo)}return mesh(g,name,geo,mat,[x,y,z]);}
 function cyl(g,name,r,l,x,y,z,mat=M.steel,axis='y',r2=r,n=20){const key=['c',r,l,r2,n].join();let geo=geoCache.get(key);if(!geo){geo=new T.CylinderGeometry(r,r2,l,n);geoCache.set(key,geo)}return mesh(g,name,geo,mat,[x,y,z],axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0]);}
 function ring(g,name,r,t,x,y,z,mat=M.steel,axis='z'){const geo=new T.TorusGeometry(r,t,8,32);return mesh(g,name,geo,mat,[x,y,z],axis==='y'?[Math.PI/2,0,0]:axis==='x'?[0,Math.PI/2,0]:[0,0,0]);}
 function plate(g,name,points,depth,mat,xyz=[0,0,0],rot=[0,0,0],bevel=.025){
  const shape=new T.Shape(points.map(v=>new T.Vector2(...v)));const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1,curveSegments:4});geo.translate(0,0,-depth/2);geo.computeBoundingBox();
  const min=geo.boundingBox.min,max=geo.boundingBox.max,uv=geo.attributes.uv,pos=geo.attributes.position;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)-min.x)/(max.x-min.x),(pos.getY(i)-min.y)/(max.y-min.y));return mesh(g,name,geo,mat,xyz,rot);
 }
 function shell(g,name,w,h,bulge,mat,xyz=[0,0,0]){
  const nx=20,ny=20,ps=[],uv=[],ix=[];
  for(let back=0;back<2;back++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
   let u=i/nx,v=j/ny;let x=(u-.5)*w*(.75+.25*Math.sin(v*Math.PI));let y=(v-.5)*h;
   let z=bulge*Math.pow(Math.sin(u*Math.PI),.75)*Math.pow(Math.sin(v*Math.PI),.6)-(back?.095:0);
   ps.push(x,y,z);uv.push(u,v);
  }
  let off=(nx+1)*(ny+1);for(let b=0;b<2;b++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let a=b*off+j*(nx+1)+i,c=a+nx+1;if(b===0)ix.push(a,a+1,c+1,a,c+1,c);else ix.push(a,c+1,a+1,a,c,c+1);}
  const edge=[];for(let i=0;i<=nx;i++)edge.push(i);for(let j=1;j<=ny;j++)edge.push(j*(nx+1)+nx);for(let i=nx-1;i>=0;i--)edge.push(ny*(nx+1)+i);for(let j=ny-1;j>0;j--)edge.push(j*(nx+1));for(let k=0;k<edge.length;k++){let a=edge[k],b=edge[(k+1)%edge.length];ix.push(a,a+off,b+off,a,b+off,b);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(ps,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();return mesh(g,name,geo,mat,xyz);
 }
 function wire(g,name,pts,r=.027,mat=M.black){const curve=new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v)));return mesh(g,name,new T.TubeGeometry(curve,Math.max(12,pts.length*5),r,7,false),mat);}
 function rod(g,name,a,b,r,mat=M.bright){let av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);let m=cyl(g,name,r,d.length(),0,0,0,mat);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
 function bolt(g,x,y,z,r=.035,mat=M.bright){cyl(g,'hex-fastener',r,.026,x,y,z,mat,'z',r,6);cyl(g,'fastener-socket',r*.37,.028,x,y,z+.016,M.dark,'z',r*.37,6);}
 function ribs(g,w,n,x,y,z,mat=M.steel,pitch=.08){for(let i=0;i<n;i++)box(g,'cooling-fin',w,.025,.04,x,y+(i-(n-1)/2)*pitch,z,mat,.006);}
 function bearing(g,name,r,x,y,z,axis='z'){
  cyl(g,name+'-housing',r,.19,x,y,z,M.dark,axis);ring(g,name+'-race',r*.78,.035,x,y,z+(axis==='z'?.11:0),M.bright,axis);cyl(g,name+'-hub',r*.43,.23,x,y,z,M.warm,axis);
  if(axis==='z')for(let i=0;i<8;i++){let a=i*Math.PI/4;bolt(g,x+Math.cos(a)*r*.62,y+Math.sin(a)*r*.62,z+.14,.023);}
 }
 function piston(g,id,a,b,r=.075){let dir=new T.Vector3(...b).sub(new T.Vector3(...a)),length=dir.length();const p=node(g,id,'actuators',a,[0,0,.15],'telescopic');p.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());p.userData.assembly.restRotation.copy(p.rotation);
  cyl(p,'hydraulic-body',r,length*.56,0,length*.28,0,M.dark);cyl(p,'chrome-piston',r*.5,length*.63,0,length*.7,0,M.chrome);for(let y of [length*.04,length*.50])cyl(p,'hydraulic-collar',r*1.2,.055,0,y,0,M.bright);ring(p,'actuator-seal',r*.72,.014,0,length*.56,0,M.black,'y');struts.push(p);return p;
 }
 function wheel(g,id,x,y,z,r=.49,dual=false){const carrier=node(g,id,'wheels',[x,y,z],[Math.sign(x)*.22,0,-.2],'axle');wheels.push(carrier);
  for(let off of dual?[-.13,.13]:[0]){
   cyl(carrier,'tire',r,.225,off,0,0,M.rubber,'x',r,48);
   cyl(carrier,'rim',r*.66,.239,off,0,0,M.chrome,'x',r*.66,32);cyl(carrier,'recess',r*.49,.25,off,0,0,M.dark,'x');cyl(carrier,'wheel-hub',r*.19,.27,off,0,0,M.bright,'x');
   for(let i=0;i<10;i++){let a=i*Math.PI/5;cyl(carrier,'rim-perforation',.048,.257,off,Math.cos(a)*r*.42,Math.sin(a)*r*.42,M.black,'x',.048,12);cyl(carrier,'wheel-lug',.024,.28,off,Math.cos(a)*r*.27,Math.sin(a)*r*.27,M.bright,'x',.024,6)}
   for(let i=0;i<42;i++){let a=i*Math.PI/21;let m=box(carrier,'tread-block',.224,.027,.051,off,Math.cos(a)*r,Math.sin(a)*r,M.black,.003);m.rotation.x=a;}
   for(let offY of [-.065,.065])ring(carrier,'tire-sidewall',r*.87,.009,off+offY,0,0,M.dark,'x');
  }return carrier;
 }
 const body=node(root,'thorax-frame','core',[0,6.20,0],[0,0,0],'root');
 // Open load-bearing torso: longitudinal rails, crossmembers, sockets, separate machinery.
 for(let s of [-1,1]){
  rod(body,'thorax-spine-rail',[s*.50,-1.65,-.25],[s*.67,1.15,-.25],.12,M.dark);
  rod(body,'pectoral-strut',[s*.12,.1,.18],[s*1.33,1,.14],.105,M.steel);
  rod(body,'cross-brace',[s*.58,-.2,-.35],[-s*.46,.65,-.35],.06,M.bright);
  piston(body,'thorax-actuator-'+s,[s*.33,-1.0,.12],[s*.63,.65,.18],.09);
  wire(body,'copper-busbar',[[s*.32,1.1,-.16],[s*.48,.4,.12],[s*.25,-.6,.31],[s*.42,-1.5,.10]],.036,M.copper);
  for(let k=0;k<3;k++)wire(body,'braided-cable',[[s*(.36+k*.1),.8,-.3],[s*(.72+k*.08),.1,-.25],[s*(.50+k*.07),-1.2,.06]],.025,M.black);
 }
 for(let y of [-1.35,-.9,-.45,0,.45,.9]){box(body,'vertebra-crossmember',1.20,.13,.50,0,y,-.28,M.dark,.035);bearing(body,'spinal-lock',.13,0,y,.04);}
 const heart=node(body,'reactor-cartridge','core',[0,.03,.28],[0,0,.80],'slide');
 bearing(heart,'core-ring',.39,0,0,.06);cyl(heart,'inspection-optic',.085,.08,0,0,.21,M.core,'z',.085,24);cyl(heart,'mechanical-rotor',.23,.055,0,0,.13,M.dark,'z',.23,32);ring(heart,'rotor-inner-race',.17,.023,0,0,.22,M.steel);ring(heart,'core-trim',.29,.018,0,0,.26,M.warm);
 for(let i=0;i<12;i++){let a=i*Math.PI/6;const blade=box(heart,'core-impeller',.055,.17,.055,Math.cos(a)*.31,Math.sin(a)*.31,.27,M.steel,.008);blade.rotation.z=-a+.3;}
 // Segmented abdomen carries exposed radiators and gold/silver diagonal links.
 const belly=node(body,'abdominal-cradle','core',[0,-.88,.16],[0,-.1,.50],'hinge');
 for(let i=0;i<4;i++){let y=.34-i*.26;plate(belly,'abdominal-shield',[[-.52,.08],[-.31,-.13],[.31,-.13],[.52,.08],[.25,.16],[-.25,.16]],.13,i%2?M.bright:M.dark,[0,y,.24]);
  for(let s of [-1,1])rod(belly,'diagonal-servo',[s*.18,y+.09,.35],[s*.49,y-.08,.22],.046,M.warm);
 }
 // Split cab chest: original movie windows are angled panels, with red lower doors.
 for(let s of [-1,1]){
  const door=node(body,'chest-door-'+s,'chest',[s*.72,.66,.46],[s*.34,.03,.85]);windows.push({s,door});
  const outline=[[-.56,-.79],[-.59,.73],[.45,.79],[.64,.55],[.50,-.69],[.22,-.92]];
  plate(door,'cab-door-window-carrier',[[-.56,.04],[-.59,.73],[.45,.79],[.64,.55],[.51,.04]],.16,M.flame,[0,-.1,0]);
  for(let k=0;k<2;k++){const leaf=node(door,`chest-door-lamella-${s}-${k}`,'chest',[0,-.30-k*.39,.025],[s*.08,0,.24]);plate(leaf,'cab-lower-door-petal',k===0?[[-.50,.20],[.49,.19],[.51,-.04],[.20,-.23],[-.39,-.17]]:[[-.40,.17],[.39,.16],[.34,-.18],[-.12,-.29],[-.45,-.05]],.12,M.flame);leaf.rotation.z=-s*(.04+k*.05);leaf.userData.assembly.restRotation.copy(leaf.rotation);petals.push({g:leaf,type:'chest-lamella',s,k});}
  for(let a of [-1,1])rod(door,'door-internal-spar',[a*.43,-.87,-.13],[a*.49,.65,-.13],.035,M.dark);
  for(let y of [-.65,-.2,.35]){bearing(door,'door-hinge-pin',.065,-s*.47,y,-.12);box(door,'door-inner-rib',.77,.035,.09,0,y,-.17,M.steel,.009);}

  plate(door,'window-seal',[[-.50,.10],[-.47,.65],[.42,.67],[.49,.13]],.075,M.black,[0,.01,.13]);
  const frame=node(door,'window-frame-'+s,'chest',[0,.02,.18],[s*.14,.15,.16]);
  plate(frame,'window-glass',[[-.43,.15],[-.40,.59],[.35,.60],[.41,.17]],.038,M.glass,[0,0,.02],[],.008);
  for(let [x,y,w,h] of [[0,.63,.86,.034],[0,.13,.90,.045],[-.46,.38,.034,.54],[.44,.38,.034,.54]])box(frame,'window-chrome-surround',w,h,.045,x,y,.06,M.chrome,.006);
  rod(frame,'window-divider',[-.12,.15,.09],[-.12,.6,.09],.015,M.dark);
  let w=box(frame,'windshield-wiper',.38,.023,.034,.03,.21,.10,M.black,.006);w.rotation.z=-s*.12;
  box(door,'door-handle',.19,.045,.055,s*.25,-.35,.15,M.chrome,.007);
  for(let y of [-.61,-.49])box(door,'door-panel-seam',.53,.014,.01,0,y,.11,M.dark,.002);
  bolt(door,-.46,-.5,.16);bolt(door,.40,-.55,.16);
  const top=node(door,'roof-flap-'+s,'chest',[0,.82,-.03],[s*.08,.25,-.04]);plate(top,'roof-split-panel',[[-.57,-.16],[-.47,.23],[.43,.24],[.60,-.11]],.1,M.flameBlue,[0,0,0],[Math.PI/2,0,0]);petals.push({g:top,type:'roof',s});
  const lower=node(door,'chest-underwing-'+s,'chest',[s*.26,-.81,-.03],[s*.20,-.15,.22]);plate(lower,'chest-shingle',[[-.31,.18],[.32,.20],[.38,-.22],[-.20,-.34]],.09,M.blue,[0,0,0]);petals.push({g:lower,type:'chest',s});
 }
 // Three narrow hood panels bridge the two arm-derived hood halves in vehicle mode.
 const hoodKeel=node(body,'hood-keel','bodywork',[0,-.02,2.63],[0,.12,-.28],'slide');
 for(let k=0;k<3;k++)box(hoodKeel,'hood-center-petal',.46,.12,.72,0,0,(k-1)*.73,k===1?M.blue:M.flame,.035);
 // Engine grille: a long nose in vehicle mode; nested machinery beneath the sternum in robot mode.
 const engine=node(body,'engine-nose-cradle','engine',[0,-.57,.43],[0,-.25,.65],'slide');
 box(engine,'engine-block',.82,.63,.75,0,0,-.17,M.dark,.07);
 for(let s of [-1,1]){
  const grill=node(engine,'radiator-half-'+s,'engine',[s*.41,0,.37],[s*.26,.03,.25]);grilles.push({s,g:grill});
  box(grill,'radiator-backing',.79,.95,.09,0,0,0,M.black,.018);
  for(let i=0;i<8;i++)box(grill,'radiator-slats',.036,.87,.05,(i-3.5)*.093,0,.075,M.chrome,.005);
  for(let x of [-.40,.40])box(grill,'radiator-side-trim',.055,1.0,.09,x,0,.06,M.chrome,.012);
  for(let y of [-.49,.49])box(grill,'radiator-horizontal-trim',.85,.055,.09,0,y,.06,M.chrome,.012);
  for(let k=0;k<3;k++)box(grill,'radiator-cross-rib',.74,.019,.015,0,(k-1)*.25,.11,M.bright,.003);
  const lamp=node(engine,'projector-pod-'+s,'engine',[s*1.03,-.22,.22],[s*.30,-.12,.05]);
  cyl(lamp,'headlamp-housing',.19,.23,0,0,0,M.chrome,'z',.21,32);cyl(lamp,'projector-black',.15,.25,0,0,.045,M.black,'z',.15,24);cyl(lamp,'projector-lens',.118,.025,0,0,.19,M.lamp,'z',.118,32);
  const bumper=node(engine,'split-bumper-'+s,'engine',[s*.68,-.69,.22],[s*.25,-.18,.05]);box(bumper,'bumper-chrome',1.30,.26,.23,0,0,0,M.chrome,.025);for(let i=0;i<7;i++)bolt(bumper,-.49+i*.16,0,.14,.023);petals.push({g:bumper,type:'bumper',s});
 }
 // Back pack is built in plates over an open truss, with independent exhausts and tail frames.
 const back=node(body,'dorsal-chassis','back',[0,.10,-.55],[0,.1,-.65]);
 for(let s of [-1,1]){
  const wing=node(back,'dorsal-panel-'+s,'back',[s*.62,.18,-.05],[s*.42,.25,-.35]);
  plate(wing,'sleeper-back-armor',[[-.56,-.93],[-.56,.91],[.45,1.02],[.61,.63],[.53,-.86]],.14,M.blue);
  box(wing,'back-vent',.64,.67,.08,0,-.23,-.14,M.dark,.02);ribs(wing,.58,9,0,-.23,-.20,M.steel,.065);backs.push({s,g:wing});
  const stack=node(body,'exhaust-stack-'+s,'back',[s*1.44,.73,-.49],[s*.25,.2,-.35]);
  cyl(stack,'exhaust-pipe',.092,1.85,0,.25,0,M.chrome);cyl(stack,'exhaust-dark-outlet',.062,.015,0,1.185,0,M.black);cyl(stack,'heat-shield',.142,.80,0,-.22,0,M.steel);
  for(let k=0;k<9;k++)ring(stack,'heat-shield-collar',.148,.008,0,-.58+k*.09,0,M.dark,'y');
  for(let k=0;k<5;k++)wire(stack,'exhaust-return-pipe',[[0,-.75,0],[.10,-.85,-.15],[.14,-1.0,-.28]],.025,M.dark);
  backs.push({s,g:stack,stack:true});
 }
 // Hip carriage and double-rear-axle leg modules.
 const pelvis=node(body,'pelvic-frame','pelvis',[0,-1.57,-.12],[0,-.18,.05]);
 box(pelvis,'pelvis-crossbeam',1.35,.34,.60,0,0,0,M.dark,.07);bearing(pelvis,'pelvis-center',.25,0,0,.33);
 for(let s of [-1,1]){
  plate(pelvis,'hip-flame-trim',[[-.44,.23],[.43,.16],[.30,-.30],[-.32,-.20]],.12,M.blue,[s*.57,.04,.43],[0,0,-s*.18]);
  const hip=node(pelvis,'hip-gimbal-'+s,'legs',[s*.54,-.12,0],[s*.48,-.1,0]);
  bearing(hip,'hip-ball',.29,0,0,.09);cyl(hip,'hip-axle',.24,.68,0,0,0,M.dark,'x');
  const thigh=node(hip,'thigh-femur-'+s,'legs',[0,-.08,0],[s*.08,-.15,.12]);
  rod(thigh,'thigh-load-rod',[0,-.15,0],[0,-1.48,0],.19,M.dark);
  for(let a of [-1,1])piston(thigh,`femur-actuator-${s}-${a}`,[a*.23,-.20,.18],[a*.25,-1.37,.08],.075);
  const femurCover=node(thigh,'thigh-cover-'+s,'legs',[0,-.76,.25],[s*.15,.05,.44]);for(let a of [-1,1]){rod(femurCover,'exposed-femur-strut',[a*.18,.57,.03],[a*.24,-.57,.03],.095,M.bright);for(let k=0;k<3;k++)plate(femurCover,'femur-articulated-shield',[[-.13,.15],[.12,.12],[.16,-.12],[-.09,-.17]],.08,k%2?M.steel:M.dark,[a*.18,.38-k*.37,.12],[0,a*.2,0]);}
  for(let k=0;k<3;k++){plate(thigh,'femur-outer-casing',[[-.16,.18],[.18,.20],[.24,-.10],[-.12,-.21]],.14,k%2?M.dark:M.blue,[s*.32,-.35-k*.35,.06],[0,s*.7,s*.2]);}
  for(let k=0;k<3;k++)rod(thigh,'femur-gold-tendon',[s*.37,-.20-k*.04,-.1],[s*.39,-1.34,-.18],.025,M.warm);
  petals.push({g:femurCover,type:'thigh',s});
  const knee=node(thigh,'knee-gimbal-'+s,'legs',[0,-1.65,0],[0,-.06,.08]);bearing(knee,'knee-bearing',.30,0,0,.14);cyl(knee,'knee-axle',.21,.84,0,0,0,M.chrome,'x');
  const kneeGuard=node(knee,'knee-guard-'+s,'legs',[0,-.08,.42],[0,.08,.35]);plate(kneeGuard,'blue-knee-shield',[[-.45,.20],[.44,.20],[.39,-.28],[0,-.43],[-.41,-.27]],.16,M.blue);petals.push({g:kneeGuard,type:'knee',s});
  const shin=node(knee,'tibia-structure-'+s,'legs',[0,-.30,-.01],[s*.05,-.15,0]);
  rod(shin,'tibia-bone',[0,-.03,0],[0,-1.98,0],.19,M.dark);
  for(let a of [-1,1]){rod(shin,'shin-steel-rail',[a*.27,-.03,-.15],[a*.32,-1.94,-.12],.075,M.bright);piston(shin,`tibia-piston-${s}-${a}`,[a*.22,-.22,.12],[a*.26,-1.83,.18],.065);}
  for(let k=0;k<7;k++){box(shin,'tibia-cross-rib',.64,.095,.43,0,-.17-k*.25,-.08,M.steel,.02);}
  const armor=node(shin,'shin-armor-'+s,'legs',[0,-1.01,.30],[0,-.04,.65]);
  for(let a of [-1,1]){const lam=node(armor,`tibia-fender-petal-${s}-${a}`,'legs',[a*.30,0,.09],[a*.10,0,.15]);shell(lam,'split-shin-fire-shell',.36,2.06,.13,M.flameBlue);petals.push({g:lam,type:'shin-lamella',s:a});}
  rod(armor,'exposed-front-tibia',[0,.78,.31],[0,-.87,.31],.10,M.steel);
  for(let a of [-1,1]){plate(armor,'tibia-machined-prong',[[a*-.03,.90],[a*.13,.72],[a*.17,-.71],[a*.07,-1.01],[a*-.06,-.72]],.11,M.steel,[a*.16,0,.47],[0,a*.18,0]);}
  for(let k=0;k<5;k++){let y=.58-k*.28;plate(armor,'tibia-mechanical-shingle',[[-.19,.07],[.17,.08],[.22,-.08],[-.14,-.11]],.12,k%2?M.bright:M.dark,[0,y,.40],[0,k%2?.12:-.12,0]);bolt(armor,0,y,.49,.023);}

  for(let a of [-1,1]){const side=node(shin,`calf-shingle-${s}-${a}`,'legs',[a*.38,-1.0,-.03],[a*.40,0,.12]);plate(side,'calf-armor-petal',[[-.14,.87],[.19,.70],[.22,-.81],[-.16,-.97]],.12,M.blue,[0,0,0],[0,a*.9,0]);petals.push({g:side,type:'calf',s:a});}
  petals.push({g:armor,type:'shin',s});
  const ankle=node(shin,'ankle-gimbal-'+s,'legs',[0,-2.12,.03],[0,-.1,.05]);cyl(ankle,'ankle-axle',.18,.75,0,0,0,M.chrome,'x');
  const foot=node(ankle,'foot-chassis-'+s,'legs',[0,-.16,.27],[0,-.1,.22]);
  box(foot,'foot-load-plate',.92,.23,1.18,0,-.01,.24,M.dark,.045);
  plate(foot,'instep-flame-cover',[[-.42,-.32],[-.47,.31],[.19,.48],[.44,.25],[.41,-.36]],.13,M.flameBlue,[0,.16,.25],[-Math.PI/2,0,0]);
  for(let a of [-1,0,1]){const toe=node(foot,`toe-claw-${s}-${a}`,'legs',[a*.29,-.02,.83],[a*.05,-.03,.16]);plate(toe,'toe-steel-claw',[[-.12,.20],[-.15,-.15],[.1,-.27],[.15,.20]],.24,M.bright,[0,.02,.09],[-Math.PI/2,0,0]);petals.push({g:toe,type:'toe',s:a});}
  for(let [idx,z]of [-2.7,-3.7].entries()){const rw=wheel(body,`rear-axle-${s}-${idx}`,s*1.14,-1.22,z,.42,true);rearAxles.push({s,idx,g:rw,z});}
  legRigs.push({s,hip,thigh,knee,shin,ankle,foot});
 }
 // Shoulder, elbow, wrist, fingers: mechanically separated subassemblies.
 for(let s of [-1,1]){
  const shoulder=node(body,'shoulder-carrier-'+s,'arms',[s*1.8,.78,-.03],[s*.70,.05,0]);
  const upper=node(shoulder,'upper-arm-gimbal-'+s,'arms',[0,0,0],[s*.12,0,.1]);bearing(upper,'shoulder-bearing',.37,0,-.05,.08);cyl(upper,'shoulder-axle',.27,.82,0,-.1,0,M.dark,'x');
  const fender=node(upper,'shoulder-fender-'+s,'shoulders',[s*.20,.25,.10],[s*.22,.25,.2]);
  const fcap=shell(fender,'curved-shoulder-flame-armor',1.35,1.34,.34,M.flameBlue,[0,0,.15]);fcap.rotation.set(0,-s*.18,-s*.18);
  for(let a of [-1,1]){const sh=node(upper,`shoulder-shingle-${s}-${a}`,'shoulders',[a*.32,-.28,-.02],[a*.22,.05,.25]);plate(sh,'shoulder-red-underpanel',[[-.26,.37],[.32,.29],[.23,-.46],[-.18,-.40]],.11,M.red,[0,0,.31]);petals.push({g:sh,type:'shoulder',s:a});}
  petals.push({g:fender,type:'fender',s});
  rod(upper,'humerus-shaft',[0,-.22,-.05],[0,-1.12,-.05],.23,M.dark);
  for(let k=0;k<4;k++){plate(upper,'humerus-interlocking-armor',[[-.22,.14],[.14,.20],[.25,-.02],[.13,-.17],[-.19,-.13]],.10,k%2?M.steel:M.dark,[s*(.1+(k%2)*.1),-.35-k*.19,.24],[.12,s*.2,s*(.2+k*.06)]);bolt(upper,s*.20,-.35-k*.19,.33,.025);}
  for(let k=0;k<22;k++){let a=k*Math.PI/11;let gear=box(upper,'shoulder-drive-tooth',.055,.075,.055,Math.cos(a)*.31,-.1+Math.sin(a)*.31,.20,M.steel,.005);gear.rotation.z=-a;}

  for(let a of [-1,1])piston(upper,`humerus-piston-${s}-${a}`,[a*.22,-.28,.05],[a*.25,-1.0,.03],.075);
  wire(upper,'arm-power-line',[[s*.28,-.14,-.18],[s*.47,-.62,-.26],[s*.27,-1.12,-.2]],.04,M.black);
  const elbow=node(upper,'elbow-gimbal-'+s,'arms',[0,-1.17,0],[s*.08,-.15,.1]);bearing(elbow,'elbow-bearing',.25,0,0,.14);cyl(elbow,'elbow-pin',.17,.87,0,0,0,M.chrome,'x');
  const forearm=node(elbow,'forearm-frame-'+s,'arms',[0,-.08,.03],[s*.08,-.15,.08]);
  box(forearm,'forearm-load-frame',.55,1.12,.46,0,-.59,-.02,M.dark,.04);
  for(let k=0;k<3;k++){plate(forearm,'forearm-caliper-block',[[-.24,.08],[.18,.11],[.29,-.03],[.13,-.13],[-.25,-.08]],.14,k%2?M.steel:M.dark,[0,-.30-k*.28,.25],[0,s*.18,0]);bearing(forearm,'caliper-lock',.055,s*.08,-.30-k*.28,.36);}
  for(let k=0;k<3;k++)wire(forearm,'braided-forearm-loom',[[s*(.18+k*.035),.04,-.2],[s*(.39+k*.03),-.31,-.26],[s*(.39+k*.03),-.84,-.23],[s*.18,-1.15,-.12]],.018+k*.002,k===2?M.copper:M.black);

  for(let a of [-1,1])rod(forearm,'forearm-servo-rail',[a*.20,-.11,.1],[a*.22,-1.04,.15],.055,M.chrome);
  for(let k=0;k<4;k++){bearing(forearm,'forearm-linkage',.095,-s*.29,-.23-k*.23,.19);}
  const foreCover=node(forearm,'forearm-top-armor-'+s,'arms',[0,-.59,.31],[0,.0,.52]);for(let k=0;k<3;k++){const lam=node(foreCover,`forearm-lamella-${s}-${k}`,'arms',[(k-1)*.305,0,.05+(k===1?.10:0)],[0,0,.14]);let skin=shell(lam,'forearm-lamellar-shell',.315,1.35,.06,M.flame);let uv=skin.geometry.attributes.uv;for(let u=0;u<uv.count;u++)uv.setX(u,(uv.getX(u)+k)/3);petals.push({g:lam,type:'arm-lamella',s:k-1,k});}petals.push({g:foreCover,type:'forearm',s});
  for(let a of [-1,1]){const side=node(forearm,`forearm-shingle-${s}-${a}`,'arms',[a*.33,-.61,-.05],[a*.29,0,.13]);plate(side,'forearm-blue-sideplate',[[-.12,.52],[.16,.42],[.20,-.51],[-.12,-.60]],.12,M.blue,[0,0,0],[0,a*.8,0]);petals.push({g:side,type:'forearm-side',s:a});}
  const hoodSkin=node(forearm,'hood-side-skin-'+s,'arms',[s*.46,-.59,-.03],[s*.15,0,.16]);plate(hoodSkin,'hood-side-armor',[[-.35,.64],[.35,.64],[.39,-.49],[.24,-.70],[-.33,-.61]],.095,M.flame,[0,0,0],[0,s*Math.PI/2,0]);petals.push({g:hoodSkin,type:'hood-skin',s});
  const wrist=node(forearm,'wrist-universal-'+s,'arms',[0,-1.2,0],[0,-.2,.1]);bearing(wrist,'wrist-race',.23,0,0,.12);
  const palm=node(wrist,'palm-'+s,'hands',[0,-.29,.03],[s*.06,-.15,.07]);box(palm,'palm-casting',.58,.43,.29,0,0,0,M.dark,.06);
  for(let a of [-1,1])rod(palm,'metacarpal-rail',[a*.19,.15,.18],[a*.22,-.15,.17],.045,M.bright);
  for(let f=0;f<5;f++){
   let thumb=f===4;let base=node(palm,`finger-${s}-${f}-base`,'hands',[thumb?-s*.36:(f-1.5)*.15,thumb?.0:-.22,thumb?.02:.02],[0,-.035,0]);base.rotation.z=thumb?-s*.65:0;base.userData.assembly.restRotation.copy(base.rotation);
   let joints=[];let par=base;
   for(let k=0;k<(thumb?2:3);k++){let length=(thumb?.18:.20)*(k===2?.85:1);let j=node(par,`finger-${s}-${f}-joint-${k}`,'hands',[0,k===0?0:-.205,0],[0,-.02,0]);cyl(j,'finger-knuckle',.075,.135,0,0,0,M.bright,'x',.075,12);box(j,'finger-link',.12,length,.13,0,-length/2,.01,M.dark,.025);box(j,'finger-steel-ridge',.068,length*.72,.035,0,-length/2,.09,M.steel,.008);box(j,'finger-dorsal',.135,length*.62,.045,0,-length/2,-.073,M.dark,.009);joints.push(j);par=j;}
   digits.push({s,f,joints,base});
  }
  const blade=node(forearm,'wrist-blade-track-'+s,'tools',[s*.20,-.80,-.04],[0,-.1,.18],'slide');
  plate(blade,'blade-titanium-spine',[[-.08,.15],[-.14,-1.42],[.12,-1.84],[.20,-1.35],[.15,.15]],.12,M.dark,[0,.04,0]);
  plate(blade,'blade-energon-edge',[[-.11,.07],[-.15,-1.40],[.14,-1.94],[.27,-1.34],[.19,.08]],.045,M.energy,[0,.04,.08]);
  armRigs.push({s,shoulder,upper,elbow,forearm,wrist,palm,blade});
 }
 // Forward truck wheels migrate to shoulder/back locations in the approximate movie-inspired rig.
 const frontAxles=[];
 for(let s of [-1,1]){const axle=wheel(body,'front-axle-'+s,s*1.17,-1.30,2.5,.51);const fender=node(axle,'front-wheel-fender-'+s,'bodywork',[0,0,0],[s*.1,.08,0]);const shape=new T.Shape();shape.absarc(0,0,.64,0,Math.PI,false);shape.lineTo(-.54,0);shape.absarc(0,0,.54,Math.PI,0,true);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.47,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,steps:1});geo.translate(0,0,-.235);mesh(fender,'front-blue-wheel-arch',geo,M.blue,[0,0,0],[0,Math.PI/2,0]);frontAxles.push({s,g:axle,fender});}
 // Movie head is a dedicated curved-shell asset, not a faceted placeholder.
 const {neck,head,jaw}=buildMovieHead({T,body,node,mesh,plate,box,cyl,ring,wire,rod,bolt,bearing,shell,M});
 // Store rest pose only once, before deterministic animation starts.
 for(let a of assemblies){a.restPosition.copy(a.group.position);a.restRotation.copy(a.group.rotation);}
 const axes=[];for(let g of [neck,...armRigs.map(a=>a.elbow),...armRigs.map(a=>a.shoulder),...legRigs.map(a=>a.knee),...legRigs.map(a=>a.hip)]){let ax=new T.AxesHelper(.44);ax.visible=false;g.add(ax);axes.push(ax);}
 // Merge only static visual pieces inside each movable assembly. Parts remain catalogued;
 // articulated panels, fingers and actuators retain independent transform nodes.
 const visibleMeshes=[];
 for(let a of assemblies){const buckets=new Map();for(let m of a.group.children.filter(x=>x.isMesh)){m.updateMatrix();let key=m.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(m)}
  for(let list of buckets.values()){
   if(list.length===1){visibleMeshes.push(list[0]);continue}
   const gs=list.map(m=>{let g=m.geometry.clone();g.applyMatrix4(m.matrix);if(g.index)g=g.toNonIndexed();return g});
   const merged=mergeGeometries(gs,false);if(!merged){visibleMeshes.push(...list);continue}
   const m=new T.Mesh(merged,list[0].material);m.name=a.id+' / '+list[0].material.name;m.castShadow=m.receiveShadow=true;m.userData.originalMaterial=m.material;m.userData.partIds=list.map(x=>x.name);a.group.add(m);list.forEach(x=>a.group.remove(x));visibleMeshes.push(m);gs.forEach(g=>g.dispose());
  }
 }
 const systemColors={core:'#e0bf72',engine:'#d9a763',chest:'#ba4539',arms:'#569dc1',hands:'#a0c0ca',shoulders:'#826bc4',legs:'#729d90',back:'#b395aa',head:'#d4c0a0',wheels:'#77838e',tools:'#ff853d',actuators:'#b6b3a0',pelvis:'#778da8',bodywork:'#5c72a3'};
 let gray=false,highlight='all';const colors={};for(let[k,c]of Object.entries(systemColors))colors[k]=new T.MeshStandardMaterial({color:c,roughness:.4,metalness:.45});
 function setMaterials(){for(let m of visibleMeshes){let a=m.parent.userData.assembly;let system=a?.system||'core';m.material=m.userData.originalMaterial===M.energy?M.energy:gray?M.gray:highlight==='colors'?colors[system]:highlight!=='all'&&highlight!==system?M.dark:m.userData.originalMaterial;}}
 function apply(r){
  for(let a of assemblies){a.group.position.copy(a.restPosition);a.group.rotation.copy(a.restRotation);}
  // Tractor to robot: serial release, cab split, arm extension, engine migration, spine rise, legs, head, lock.
  body.position.set(0,mix(1.82,6.20,r.leg)-.18*r.landing,0);body.rotation.y=r.torsoTurn;pelvis.position.y=-1.57+.30*(1-r.leg);
  for(let {s,door}of windows){door.position.set(s*mix(.61,.72,r.cab),.66,mix(.72,.46,r.cab));door.rotation.set(mix(0,.09,r.cab)+r.chest*.12,s*(.06+.29*r.cab+.72*r.chest),s*(.18*r.cab-.18*r.chest));door.position.x+=s*r.chest*.22;}
  hoodKeel.position.set(0,mix(-.02,.28,r.engine),mix(2.63,-.82,r.engine));hoodKeel.rotation.x=r.engine*Math.PI/2;
  engine.position.set(0,mix(-.57,-.48,r.engine),mix(3.65,-.18,r.engine));engine.rotation.x=-.10*r.engine;
  for(let {s,g}of grilles){g.rotation.y=s*(1.50*r.engine+.16*r.chest);g.position.x=s*(.41-.03*r.engine);}
  heart.rotation.z=r.chest*.18;heart.position.z+=r.chest*.30;
  back.rotation.x=-.08*r.lock;
  for(let {s,g,stack}of backs){if(stack){g.position.x=s*mix(1.28,1.44,r.cab);g.rotation.z=-s*.10*(r.back+r.explode)}else{g.rotation.y=s*(.22*r.cab+.75*r.back);g.position.x=s*(.62+.25*r.back)}}
  for(let {s,hip,thigh,knee,shin,ankle,foot}of legRigs){hip.position.x=s*mix(.48,.82,r.lock);hip.position.y=-.12+.25*(1-r.leg);hip.rotation.set((1-r.leg)*Math.PI/2,(1-r.leg)*Math.PI,s*.085*r.lock);knee.rotation.x=-.05*r.lock-.15*r.landing;ankle.rotation.x=-.03*r.lock+.12*r.landing;foot.rotation.x=(1-r.leg)*Math.PI/2;foot.rotation.y=s*.10*r.lock;}
  for(let {s,shoulder,upper,elbow,forearm,wrist,palm,blade}of armRigs){
   shoulder.position.set(s*mix(.68,1.92,r.release),mix(-.18,.78,r.arms),mix(1.05,-.03,r.arms));upper.rotation.set(mix(-Math.PI/2,0,r.arms),0,s*(.10*r.lock+.35*r.armsOpen));
   elbow.rotation.x=-.20*r.lock-.48*r.armsOpen;wrist.rotation.x=(1-r.arms)*2.5;wrist.rotation.y=s*.10*r.lock;
   blade.position.y+=mix(.85,-.35,r.blade);blade.rotation.x=Math.PI*(1-r.blade);blade.rotation.z=s*.08;
  }
  for(let {s,g,fender}of frontAxles){fender.rotation.x=-r.roll;g.position.set(s*mix(1.17,1.48,r.cab),mix(-1.30,.69,r.arms),mix(2.5,-.51,r.engine));g.rotation.x=r.roll;g.rotation.y=s*.25*r.cab;}
  for(let {s,idx,g,z}of rearAxles){g.position.set(s*mix(1.14,.84,r.leg),mix(-1.39,-1.5-idx*.55,r.leg),mix(z,-.46,r.leg));g.rotation.y=s*.18*r.lock;}
  M.energy.opacity=.85*r.blade;M.energy.emissiveIntensity=.7*r.blade;M.lamp.emissiveIntensity=mix(1.5,.015,r.engine);M.core.emissiveIntensity=.08+r.chest*.6;
  // Rear wheels stay attached; ten physical tires, six axle stations in the tractor.
  wheels.filter(w=>!w.name.startsWith('front')).forEach(w=>w.rotation.x=r.roll);
  neck.position.y=mix(.45,1.45,r.head);neck.rotation.x=(1-r.head)*Math.PI;head.rotation.y=r.headTurn;
  jaw.position.y-=r.chest*.04;
  for(let d of digits){for(let [i,j]of d.joints.entries())j.rotation.x=-mix(.20,.95,r.grip)*(d.f===4?.6:1)*(i===2?1.1:1);}
  for(let {g,type,s}of petals){const e=(type==='roof'||type==='chest'||type==='chest-lamella')?r.chest:((type.startsWith('forearm')||type==='arm-lamella'||type==='hood-skin')?r.armsOpen:(['fender','shoulder'].includes(type)?r.shoulders:r.legsOpen));
   if(type==='fender'){g.rotation.z=-s*(.22+e*.62);g.rotation.y=-s*.18*e;g.position.x+=s*e*.24;}
   else if(type==='shoulder'){g.rotation.y=s*e*.84;g.rotation.z=s*e*.25;}
   else if(type==='forearm'){g.rotation.x=-e*.54;g.position.z+=e*.24;}
   else if(type==='arm-lamella'){g.rotation.y=s*e*.58;g.position.x+=s*e*.13;g.rotation.z=s*e*.08;}
   else if(type==='chest-lamella'){g.rotation.y=s*e*(.26+.18*(g.name.endsWith('1')?1:0));g.position.z+=e*.08;}
   else if(type==='shin-lamella'){g.rotation.y=s*e*.62;g.position.x+=s*e*.16;}
   else if(type==='hood-skin'){g.rotation.y=s*e*.55;g.position.x+=s*e*.14;}
   else if(type==='forearm-side'){g.rotation.y=s*(.8+e*.8);g.position.x+=s*.12*e;}
   else if(type==='roof'){g.rotation.x=-e*.9;g.position.y+=e*.15;}
   else if(type==='chest'){g.rotation.z=-s*e*.5;g.position.z+=e*.1;}
   else if(type==='bumper'){g.rotation.y=s*r.engine*1.3;g.rotation.z=-s*r.engine*.1;}
   else if(type==='shin'){g.rotation.x=e*.5;g.position.z+=e*.28;}
   else if(type==='calf'){g.rotation.y=s*(.9+e*.8);g.position.x+=s*e*.2;}
   else if(type==='thigh'){g.rotation.y=s*e*.45;g.position.z+=e*.20;}
   else if(type==='knee'){g.rotation.x=-e*.60;}
   else if(type==='toe'){g.rotation.y=s*e*.36;}
  }
  // Bounded assembly explosion is an explicit study mode, never a stand-in for transformation.
  if(r.explode>0)for(let a of assemblies)a.group.position.addScaledVector(a.explode,r.explode);
  root.position.set(0,0,r.p<.02?r.roll*.28:0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
  const bbox=new T.Box3().setFromObject(root);body.position.y+=.012-bbox.min.y;root.updateMatrixWorld(true);
 }
 function snapshot(){root.updateMatrixWorld(true);return assemblies.map(a=>({id:a.id,system:a.system,matrix:a.group.matrixWorld.toArray()}));}
 function pick(object){let o=object;while(o&&!o.userData.assembly)o=o.parent;return o?.userData.assembly?.id??null;}
 apply(rigAt(1));
 return {root,assemblies,pieces,meshes:visibleMeshes,textureFiles,materials:M,wheels,apply,snapshot,pick,
  setGray(v){gray=v;setMaterials()},setHighlight(s){highlight=s;setMaterials()},setJoints(v){axes.forEach(a=>a.visible=v)},
  describe:()=>assemblies.map(a=>({id:a.id,parent:a.parent,system:a.system,role:a.role,explode:a.explode.toArray(),parts:pieces.filter(x=>x.assembly===a.id).map(x=>x.id)}))
 };
}
