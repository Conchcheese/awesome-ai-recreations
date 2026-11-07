import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {PARAM} from './model.js';

const UP=new THREE.Vector3(0,1,0), Z=new THREE.Vector3(0,0,1);
const TAU=Math.PI*2;
const palette={
  shell:new THREE.MeshStandardMaterial({color:'#eeeae0',roughness:.43,metalness:.12}),
  steel:new THREE.MeshStandardMaterial({color:'#a9b1b1',roughness:.29,metalness:.83}),
  dark:new THREE.MeshStandardMaterial({color:'#202628',roughness:.56,metalness:.38}),
  rubber:new THREE.MeshStandardMaterial({color:'#101616',roughness:.77,metalness:.03}),
  orange:new THREE.MeshStandardMaterial({color:'#ff5920',roughness:.43,metalness:.18}),
  lens:new THREE.MeshPhysicalMaterial({color:'#10252b',roughness:.08,metalness:.72,clearcoat:1}),
};
const cylinder=new THREE.CylinderGeometry(1,1,1,20);
const sphere=new THREE.SphereGeometry(1,12,8);
const box=new THREE.BoxGeometry(1,1,1);
function piece(group,geometry,mat,pos=[0,0,0],scale=[1,1,1],quat=null){
  const mesh=new THREE.Mesh(geometry,mat);mesh.position.fromArray(pos);mesh.scale.fromArray(scale);if(quat)mesh.quaternion.copy(quat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function rod(group,a,b,r,mat){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),v=vb.clone().sub(va);return piece(group,cylinder,mat,va.add(vb).multiplyScalar(.5).toArray(),[r,v.length(),r],new THREE.Quaternion().setFromUnitVectors(UP,v.normalize()));}
function ring(group,r,tube,pos,mat,axis=UP){const geo=new THREE.TorusGeometry(r,tube,8,48);return piece(group,geo,mat,pos,[1,1,1],new THREE.Quaternion().setFromUnitVectors(Z,axis));}
function compress(group){
  const grouped=new Map();
  for(const child of [...group.children]){
    if(!child.isMesh||child.isInstancedMesh)continue;
    child.updateMatrix();const geo=child.geometry.clone();geo.applyMatrix4(child.matrix);
    const arr=grouped.get(child.material)||[];arr.push(geo);grouped.set(child.material,arr);group.remove(child);
  }
  for(const [mat,geos] of grouped){const merged=mergeGeometries(geos,false);const mesh=piece(group,merged,mat);mesh.frustumCulled=false;for(const geo of geos)geo.dispose();}
}
function petalGeometry(radius,center,span,hinge){
  const vertices=[],uv=[],indices=[];const nx=12,ny=16;
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
    const theta=y/ny*Math.PI/2,phi=center+(x/nx-.5)*span;
    vertices.push(radius*Math.sin(theta)*Math.cos(phi)-hinge[0],radius*Math.cos(theta),radius*Math.sin(theta)*Math.sin(phi)-hinge[2]);uv.push(x/nx,y/ny);
      const windowGap=y/ny>.40&&y/ny<.62&&Math.abs((x+.5)/nx-.5)<.14;
      if(x<nx&&y<ny&&!windowGap){const a=y*(nx+1)+x,b=a+nx+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
class Batches{
  constructor(root){this.meshes={};this.counts={};this.obj=new THREE.Object3D();this.q=new THREE.Quaternion();this.v=new THREE.Vector3();this.root=root;}
  define(name,geometry,material,capacity){const m=new THREE.InstancedMesh(geometry,material,capacity);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;m.count=0;this.root.add(m);this.meshes[name]=m;}
  start(){for(const key in this.meshes)this.counts[key]=0;}
  put(name,pos,scale,quat){const n=this.counts[name]++;const o=this.obj;o.position.copy(pos);o.scale.fromArray(scale);o.quaternion.copy(quat);o.updateMatrix();this.meshes[name].setMatrixAt(n,o.matrix);}
  finish(){for(const key in this.meshes){this.meshes[key].count=this.counts[key];this.meshes[key].instanceMatrix.needsUpdate=true;}}
}

export function createMachine(scene,{gray=false}={}){
  const root=new THREE.Group();scene.add(root);
  const body=new THREE.Group();root.add(body);
  const grayMat=new THREE.MeshStandardMaterial({color:'#bdbdb8',roughness:.75});
  const M=gray?Object.fromEntries(Object.keys(palette).map(k=>[k,grayMat])):palette;
  // Short, rounded lower head; the dome is not a tall cylindrical tower.
  piece(body,new THREE.SphereGeometry(.425,48,24,0,TAU,Math.PI/2,Math.PI/2),M.shell,[0,.57,0],[1,.88,1]);
  piece(body,cylinder,M.dark,[0,.285,0],[.34,.16,.34]);
  ring(body,.425,.016,[0,.57,0],M.steel);
  ring(body,.35,.019,[0,.23,0],M.dark);
  for(let i=0;i<8;i++){
    const a=i*TAU/8+Math.PI/8;
    const axis=new THREE.Vector3(Math.sin(a),0,Math.cos(a));
    const pos=axis.clone().multiplyScalar(.385);pos.y=.245;
    piece(body,cylinder,M.dark,pos.toArray(),[.095,.13,.095],new THREE.Quaternion().setFromUnitVectors(UP,axis));
    ring(body,.088,.012,pos.clone().addScaledVector(axis,.055).toArray(),M.steel,axis);
  }
  if(!gray){
    for(let j=0;j<48;j++){
      const a=j/48*TAU;piece(body,sphere,M.dark,[Math.sin(a)*.414,.515,Math.cos(a)*.414],[.007,.007,.007]);
    }
    for(let i=0;i<7;i++){
      const a=i/7*TAU;
      piece(body,cylinder,M.steel,[Math.sin(a)*.23,.45,Math.cos(a)*.23],[.034,.25,.034]);
      piece(body,cylinder,M.dark,[Math.sin(a)*.23,.43,Math.cos(a)*.23],[.044,.1,.044]);
      piece(body,box,M.orange,[Math.sin(a)*.23,.35,Math.cos(a)*.23],[.035,.02,.035]);
    }
  }
  compress(body);
  const pumps=[];
  if(!gray)for(let i=0;i<7;i++){
    const a=i/7*TAU,g=new THREE.Group();g.position.set(Math.sin(a)*.23,.46,Math.cos(a)*.23);root.add(g);
    piece(g,cylinder,M.steel,[0,.035,0],[.018,.13,.018]);piece(g,cylinder,M.orange,[0,.09,0],[.029,.015,.029]);compress(g);pumps.push(g);
  }

  const brain=new THREE.Group();root.add(brain);
  piece(brain,sphere,M.dark,[0,.68,0],[.30,.29,.30]);
  if(!gray){
    for(let k=0;k<62;k++){
      const points=[];const a=k*2.399963229728653;
      for(let j=0;j<=16;j++){
        const u=j/16,phi=a+u*.8+.22*Math.sin(u*4+k),theta=.35+(k%9)/8*1.9+u*.4;
        const r=.298+.011*Math.sin(u*13+k);
        points.push(new THREE.Vector3(Math.sin(theta)*Math.cos(phi)*r,.68+Math.cos(theta)*r,Math.sin(theta)*Math.sin(phi)*r));
      }
      piece(brain,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.007+(k%3)*.001,5,false),k%11===0?M.orange:M.rubber);
      const p=points[(k%2)?3:13];piece(brain,cylinder,M.steel,p.toArray(),[.01,.025,.01],new THREE.Quaternion().setFromUnitVectors(UP,p.clone().sub(new THREE.Vector3(0,.68,0)).normalize()));
    }
    for(let k=0;k<50;k++){
      const phi=k*2.399963,theta=Math.acos(1-2*(k+.5)/50);
      const normal=new THREE.Vector3(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
      const pos=normal.clone().multiplyScalar(.31).add(new THREE.Vector3(0,.68,0));
      piece(brain,box,k%9===0?M.orange:M.dark,pos.toArray(),[.037,.014,.068],new THREE.Quaternion().setFromUnitVectors(UP,normal));
      piece(brain,sphere,M.steel,pos.clone().addScaledVector(normal,.011).toArray(),[.005,.005,.005]);
    }
    for(let k=0;k<14;k++){const a=k/14*TAU;rod(brain,[Math.sin(a)*.19,.46,Math.cos(a)*.19],[Math.sin(a+.2)*.24,.83,Math.cos(a+.2)*.24],.008,M.steel);}
  }
  compress(brain);
  const petals=[];
  for(let i=0;i<8;i++){
    const a=i/8*TAU,hinge=[Math.cos(a)*.427,0,Math.sin(a)*.427];
    const pivot=new THREE.Group();pivot.position.set(hinge[0],.57,hinge[2]);root.add(pivot);
    const mat=M.shell.clone();mat.side=THREE.DoubleSide;
    piece(pivot,petalGeometry(.43,a,TAU/8-.014,hinge),mat);
    if(!gray){
      const inner=M.dark.clone();inner.side=THREE.BackSide;
      piece(pivot,petalGeometry(.418,a,TAU/8-.014,hinge),inner);
      for(let side of [-1,1])for(let j=1;j<=8;j++){
        const th=j/9*Math.PI/2,phi=a+side*(Math.PI/8-.037);
        const p=[.434*Math.sin(th)*Math.cos(phi)-hinge[0],.434*Math.cos(th),.434*Math.sin(th)*Math.sin(phi)-hinge[2]];
        piece(pivot,sphere,M.dark,p,[.005,.005,.005]);
      }
      const th=1.23,px=.435*Math.sin(th)*Math.cos(a)-hinge[0],py=.435*Math.cos(th),pz=.435*Math.sin(th)*Math.sin(a)-hinge[2];
      const q=new THREE.Quaternion().setFromUnitVectors(Z,new THREE.Vector3(Math.sin(th)*Math.cos(a),Math.cos(th),Math.sin(th)*Math.sin(a)));
      piece(pivot,box,M.orange,[px,py,pz],[.028,.062,.003],q);
      const th2=1.07;
      const q2=new THREE.Quaternion().setFromUnitVectors(Z,new THREE.Vector3(Math.sin(th2)*Math.cos(a),Math.cos(th2),Math.sin(th2)*Math.sin(a)));
      piece(pivot,box,M.dark,[.433*Math.sin(th2)*Math.cos(a)-hinge[0],.433*Math.cos(th2),.433*Math.sin(th2)*Math.sin(a)-hinge[2]],[.075,.022,.003],q2);
    }
    compress(pivot);petals.push({pivot,axis:new THREE.Vector3(-Math.sin(a),0,Math.cos(a)),a});
  }
  const cap=new THREE.Group();root.add(cap);piece(cap,cylinder,M.dark,[0,1.003,0],[.105,.025,.105]);ring(cap,.084,.004,[0,1.018,0],M.steel);compress(cap);

  const eyes=[];
  for(const sign of [-1,1]){
    const group=new THREE.Group();const axis=new THREE.Vector3(sign*.53,-.11,.84).normalize();const base=new THREE.Vector3(sign*.215,.455,.34);
    group.position.copy(base);group.quaternion.setFromUnitVectors(Z,axis);root.add(group);
    const q=new THREE.Quaternion().setFromUnitVectors(UP,Z);
    piece(group,cylinder,M.shell,[0,0,.015],[.15,.09,.15],q);
    piece(group,cylinder,M.dark,[0,0,.066],[.126,.024,.126],q);
    ring(group,.116,.006,[0,0,.084],M.orange,Z);
    ring(group,.136,.004,[0,0,.062],M.steel,Z);
    const carriage=new THREE.Group();group.add(carriage);
    piece(carriage,sphere,M.lens,[0,0,.075],[.106,.106,.022]);
    const leaves=[];
    if(!gray)for(let j=0;j<12;j++){
      const a=j/12*TAU;piece(group,sphere,M.steel,[Math.cos(a)*.137,Math.sin(a)*.137,.069],[.0035,.0035,.0035]);
      const plate=piece(carriage,box,M.dark,[Math.cos(a)*.068,Math.sin(a)*.068,.098],[.038,.066,.003]);plate.rotation.z=a+.45;leaves.push({plate,a});
    }
    compress(group);eyes.push({group,base,axis,carriage,leaves});
  }
  const nozzle=new THREE.Group();nozzle.position.set(0,.40,-.37);root.add(nozzle);
  for(let j=0;j<3;j++){piece(nozzle,cylinder,j%2?M.steel:M.dark,[0,.055+j*.055,0],[.11-j*.018,.095,.11-j*.018]);ring(nozzle,.11-j*.018,.007,[0,.1+j*.055,0],M.orange);}
  const rotor=new THREE.Group();nozzle.add(rotor);
  if(!gray)for(let j=0;j<12;j++){const a=j/12*TAU;const b=piece(rotor,box,M.steel,[Math.cos(a)*.048,.232,Math.sin(a)*.048],[.013,.012,.08]);b.rotation.y=-a+.5;}
  compress(rotor);
  const flaps=[];
  for(let j=0;j<6;j++){
    const a=j/6*TAU,g=new THREE.Group();g.position.set(Math.cos(a)*.075,.25,Math.sin(a)*.075);nozzle.add(g);
    piece(g,box,M.shell,[0,.035,0],[.049,.09,.013],new THREE.Quaternion().setFromAxisAngle(UP,-a));
    flaps.push({g,axis:new THREE.Vector3(-Math.sin(a),0,Math.cos(a))});
  }
  const wake=new THREE.InstancedMesh(sphere,new THREE.MeshBasicMaterial({color:'#8aaeb9',transparent:true,opacity:.33,depthWrite:false}),72);wake.frustumCulled=false;nozzle.add(wake);
  const bubble=new THREE.Object3D();
  compress(nozzle);
  const jaws=[];
  for(let sign of [-1,1]){
    const g=new THREE.Group();g.position.set(sign*.035,.16,.015);root.add(g);
    piece(g,new THREE.ConeGeometry(.10,.19,6),M.dark,[sign*.03,-.07,0],[1,1,.7]);
    for(let j=0;j<4;j++)piece(g,box,M.steel,[sign*.005,-.02-j*.033,.05],[.025,.013,.035]);compress(g);jaws.push({g,sign});
  }
  const radula=new THREE.Group();root.add(radula);
  piece(radula,cylinder,M.orange,[0,.125,.01],[.10,.025,.10]);
  for(let j=0;j<12;j++){const a=j/12*TAU;const tooth=piece(radula,box,M.orange,[Math.cos(a)*.10,.125,Math.sin(a)*.10+.01],[.024,.028,.028]);tooth.rotation.y=-a;}
  const tongue=piece(root,box,M.steel,[0,.06,.04],[.034,.14,.025]);compress(radula);

  const armParts=new THREE.Group();root.add(armParts);const batches=new Batches(armParts);const N=PARAM.arms*PARAM.links;
  batches.define('armor',cylinder,M.shell,N);
  batches.define('joint',cylinder,M.dark,N);
  batches.define('flange',cylinder,M.steel,N*2);
  if(!gray){
    batches.define('stripe',cylinder,M.orange,N);
    batches.define('bellows',cylinder,M.rubber,N*3);
    batches.define('tire',cylinder,M.rubber,N*2);
    batches.define('rim',cylinder,M.steel,N*2);
    batches.define('cap',cylinder,M.orange,N*2);
    batches.define('bolt',sphere,M.dark,N*6);
    batches.define('piston',cylinder,M.steel,N*2);
    batches.define('pistonBody',cylinder,M.dark,N*2);
    batches.define('panel',box,M.dark,N);
    batches.define('spoke',box,M.dark,N*2);
  }
  const p=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),dir=new THREE.Vector3(),side=new THREE.Vector3(),n=new THREE.Vector3(),q=new THREE.Quaternion(),wq=new THREE.Quaternion();
  const offsets=new THREE.Vector3(),pivot=new THREE.Vector3(0,.5,0),nozzleAxis=new THREE.Vector3(),spin=new THREE.Quaternion();
  function update(state){
    root.rotation.set(...state.motion.rotation);
    root.position.fromArray(state.motion.position).add(pivot).sub(pivot.clone().applyEuler(root.rotation));
    body.position.y=-state.expansion*.12;
    for(const {pivot,axis,a:angle} of petals){pivot.quaternion.setFromAxisAngle(axis,-state.shell);pivot.position.set(Math.cos(angle)*(.427+state.expansion*.22),.57+state.expansion*.22,Math.sin(angle)*(.427+state.expansion*.22));}
    brain.position.y=state.expansion*.46;
    for(let j=0;j<pumps.length;j++)pumps[j].position.y=.46+Math.sin(state.phase+j*TAU/7)*.028*Math.min(1,state.shell);
    cap.position.y=state.shell*.15+state.expansion*.63;
    for(const {group,base,axis,carriage,leaves} of eyes){
      group.position.copy(base).addScaledVector(axis,state.optics*.08+state.expansion*.16);
      carriage.position.z=state.optics*.12;
      for(const {plate,a} of leaves){const r=.042+.045*state.iris;plate.position.set(Math.cos(a)*r,Math.sin(a)*r,.098);plate.rotation.z=a+.45+(1-state.iris)*.9;}
    }
    nozzle.position.z=-.37-state.siphon*.20-state.expansion*.18;
    nozzleAxis.set(.16*state.siphon*Math.sin(state.t*2.5),-.35,-.94).normalize();nozzle.quaternion.setFromUnitVectors(UP,nozzleAxis);
    rotor.rotation.y=state.rotorAngle;
    for(const {g,axis} of flaps)g.quaternion.setFromAxisAngle(axis,-.12-state.nozzleOpen*.65);
    wake.visible=state.jet>.06;
    for(let k=0;k<72;k++){
      const age=(k/72+state.t*1.4)%1,a=k*2.399963;
      bubble.position.set(Math.sin(a)*(.015+age*.085),.35+age*(.55+state.pulse*.35),Math.cos(a)*(.015+age*.085));
      const r=(.003+age*.005)*state.jet;bubble.scale.set(r,r*2.4,r);bubble.updateMatrix();wake.setMatrixAt(k,bubble.matrix);
    }
    wake.instanceMatrix.needsUpdate=true;
    for(const {g,sign} of jaws){g.rotation.z=sign*(state.beak*.60+state.expansion*.18);g.position.y=.16-state.expansion*.26;}
    radula.rotation.y=state.t*4*state.beak;radula.position.y=-state.expansion*.26;
    tongue.position.y=.06-state.beak*.12-state.expansion*.26;
    batches.start();
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4+Math.PI/8;side.set(Math.cos(angle),0,-Math.sin(angle));wq.setFromUnitVectors(UP,side);
      offsets.set(Math.sin(angle),0,Math.cos(angle)).multiplyScalar(state.expansion*.28+(i===1?state.isolate*.31:0));
      for(let j=0;j<PARAM.links;j++){
        a.fromArray(state.arms[i][j]);b.fromArray(state.arms[i][j+1]);dir.copy(b).sub(a);const len=dir.length();dir.normalize();q.setFromUnitVectors(UP,dir);
        const r=.48*len+.008;
        const exploded=state.expansion*.012*j+(i===1?state.isolate*.018*j:0);
        p.copy(a).add(b).multiplyScalar(.5).add(offsets).addScaledVector(dir,exploded);n.crossVectors(side,dir).normalize();
        batches.put('joint',p,[r*.70,len*1.04,r*.70],q);
        batches.put('armor',p,[r,len*.72,r],q);
        for(let sign of [-1,1])batches.put('flange',p.clone().addScaledVector(dir,sign*len*.36),[r*1.04,.0035,r*1.04],q);
        if(gray)continue;
        batches.put('stripe',p.clone().addScaledVector(dir,-len*.21),[r*1.012,.0035,r*1.012],q);
        for(let k=0;k<3;k++)batches.put('bellows',p.clone().addScaledVector(dir,len*(.39+k*.055)),[r*.78,.0028,r*.78],q);
        // A pair of wheels on each joint, with steel rim and orange hub.
        for(let sign of [-1,1]){
          const center=p.clone().addScaledVector(side,sign*(r+.007)).addScaledVector(n,-r*.38).addScaledVector(dir,-len*.28);
          const wr=r*.40;
          batches.put('tire',center,[wr,.014,wr],wq);
          batches.put('rim',center.clone().addScaledVector(side,sign*.008),[wr*.72,.004,wr*.72],wq);
          batches.put('cap',center.clone().addScaledVector(side,sign*.011),[wr*.43,.005,wr*.43],wq);
          spin.copy(wq).multiply(new THREE.Quaternion().setFromAxisAngle(UP,state.phase*.6+j*.2));
          batches.put('spoke',center.clone().addScaledVector(side,sign*.014),[wr*.17,.002,wr*.75],spin);
          const pp=p.clone().addScaledVector(side,sign*r*.67).addScaledVector(n,r*.55);
          batches.put('pistonBody',pp,[r*.10,len*.53,r*.10],q);
          const stroke=.5+.5*Math.sin(state.phase*.55+i+j*.25);
          batches.put('piston',pp.clone().addScaledVector(dir,len*(.18+.1*stroke)),[r*.052,len*(.30+.16*stroke),r*.052],q);
        }
        for(let k=0;k<6;k++){
          const phi=k/6*TAU;
          const bp=p.clone().addScaledVector(side,Math.cos(phi)*r*1.01).addScaledVector(n,Math.sin(phi)*r*1.01).addScaledVector(dir,(k%2?1:-1)*len*.20);
          batches.put('bolt',bp,[.003,.003,.003],q);
        }
        batches.put('panel',p.clone().addScaledVector(n,r*.99),[r*.59,len*.25,.003],q);
      }
    }
    batches.finish();
  }
  return {root,update,batches,inspectMotion(){return {position:root.position.toArray(),rotation:root.rotation.toArray().slice(0,3),armMatrix:Array.from(batches.meshes.armor.instanceMatrix.array.slice(16*9,16*10)),iris:eyes[0].leaves[0]?.plate.rotation.z,opticTravel:eyes[0].carriage.position.z,nozzle:flaps[0].g.rotation.toArray().slice(0,3),jaw:jaws[0].g.rotation.z,wake:wake.visible};},counts:{arms:8,links:N,wheels:N*2,bolts:N*6},setVisible(v){root.visible=v;}};
}
