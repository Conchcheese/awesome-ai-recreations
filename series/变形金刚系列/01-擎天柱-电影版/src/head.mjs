/**
 * 2007 movie head study, read from ILM 88s and Paramount 62s references.
 * Shapes and hidden attachments are hand-estimated, not original ILM topology.
 * The caller registers every piece and batches only static geometry afterwards.
 */
export function buildMovieHead(api){
 const {T,body,node,mesh,plate,box,cyl,ring,wire,rod,bearing,M}=api;
 const neck=node(body,'head-neck-gimbal','head',[0,1.45,-.04],[0,.22,0],'gimbal');
 const head=node(neck,'head-cranial-frame','head',[0,.57,0],[0,.38,0],'gimbal');
 head.scale.setScalar(.93);
 const TAU=Math.PI*2;
 const P=(x,y,z)=>new T.Vector3(x,y,z);
 function surface(name,rows,columns,position,thickness,mat,parent=head){
  const pos=[],uv=[],indices=[],n=(rows+1)*(columns+1);
  for(let back=0;back<2;back++)for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
   const u=i/columns,v=j/rows,p=position(u,v,back);
   pos.push(...p);uv.push(u,v);
  }
  for(let back=0;back<2;back++)for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
   let a=back*n+j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;
   if(back===0)indices.push(a,b,d,a,d,c);else indices.push(a,d,b,a,c,d);
  }
  const edge=[];for(let i=0;i<=columns;i++)edge.push(i);for(let j=1;j<=rows;j++)edge.push(j*(columns+1)+columns);for(let i=columns-1;i>=0;i--)edge.push(rows*(columns+1)+i);for(let j=rows-1;j>0;j--)edge.push(j*(columns+1));
  for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];indices.push(a,a+n,b+n,a,b+n,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  return mesh(parent,'head-'+name,g,mat);
 }
 function ellipsoidPatch(name,rx,ry,rz,theta0,theta1,phi0,phi1,offset,mat,parent=head){
  return surface(name,12,20,(u,v,b)=>{
   const th=theta1+(theta0-theta1)*v,ph=phi0+(phi1-phi0)*u,d=b?.026:0;
   return [(rx-d)*Math.sin(th)*Math.sin(ph)+offset[0],(ry-d)*Math.cos(th)+offset[1],(rz-d)*Math.sin(th)*Math.cos(ph)+offset[2]];
  },.026,mat,parent);
 }
 function ribbon(name,profile,width,thickness,mat,parent=head){
  // Continuous closed sweep through a curved YZ profile, with chamfer-like ridged top.
  const positions=[],uv=[],idx=[];const count=profile.length;
  for(let i=0;i<count;i++){
   const p=profile[i],prev=profile[Math.max(0,i-1)],next=profile[Math.min(count-1,i+1)];
   const dy=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dy,dz)||1;
   const ny=-dz/len,nz=dy/len,w=(p[2]??1)*width;
   const section=[[-w*.5,-thickness*.35],[0,thickness*.45],[w*.5,-thickness*.35],[w*.5,-thickness],[-w*.5,-thickness]];
   for(let k=0;k<section.length;k++){const[x,h]=section[k];positions.push(x,p[0]+ny*h,p[1]+nz*h);uv.push(k/4,i/(count-1));}
  }
  for(let i=0;i<count-1;i++)for(let k=0;k<5;k++){let a=i*5+k,b=i*5+(k+1)%5,c=a+5,d=b+5;idx.push(a,b,d,a,d,c);}
  for(let k=1;k<4;k++){idx.push(0,k+1,k);let b=(count-1)*5;idx.push(b,b+k,b+k+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return mesh(parent,'head-'+name,g,mat);
 }
 // Short, mechanically layered neck. The cranial skin is not a solid helmet block.
 cyl(neck,'head-neck-rotor',.19,.22,0,.04,0,M.dark,'y',.20,24);
 ring(neck,'head-neck-race',.17,.024,0,.14,0,M.bright,'y');
 for(let s of [-1,1]){
  rod(neck,'head-neck-tendon',[s*.11,-.01,.05],[s*.15,.28,-.02],.025,M.chrome);
  wire(neck,'head-neck-service-loop',[[s*.16,.0,-.08],[s*.21,.10,-.13],[s*.13,.34,-.14]],.018,M.black);
 }
 let inner=mesh(head,'head-inner-skull',new T.IcosahedronGeometry(.42,2),M.dark,[0,.01,-.04]);inner.scale.set(.94,1.18,.83);
 // Bilateral overlapping carapace bands retain the rounded forehead and side silhouette.
 for(let s of [-1,1]){
  const cranial=node(head,'head-cranial-shell-'+s,'head',[0,0,0],[s*.10,.12,-.05],'shell');
  const phi0=s<0?-1.48:.07,phi1=s<0?-.07:1.48;
  ellipsoidPatch('parietal-blue-'+s,.452,.490,.410,.11,.61,phi0,phi1,[0,.065,-.035],M.blue,cranial);
  ellipsoidPatch('temporal-blue-'+s,.465,.493,.421,.56,.98,phi0,phi1,[0,.060,-.027],M.blue,cranial);
  ellipsoidPatch('frontal-blue-'+s,.472,.488,.435,.93,1.26,phi0,phi1,[0,.065,-.013],M.blue,cranial);
  // Visible overlapping lip follows the curved lower edge, rather than a painted seam.
  const lip=[];for(let i=0;i<11;i++){let ph=phi0+(phi1-phi0)*i/10;lip.push([.477*Math.sin(1.25)*Math.sin(ph),.488*Math.cos(1.25)+.058,.438*Math.sin(1.25)*Math.cos(ph)-.013]);}
  wire(cranial,'head-brow-underlap',lip,.011,M.dark);
  // Side cheek/temple shells curve around a recessed mechanical ear pocket.
  const cheek=node(head,'head-cheek-carrier-'+s,'head',[0,0,0],[s*.11,-.03,.10],'hinge');
  ellipsoidPatch('temple-alloy-backing-'+s,.445,.445,.370,1.10,2.16,s<0?-1.47:1.00,s<0?-1.00:1.47,[0,-.005,-.055],M.steel,cheek);
  // Swept side fins: shallow fore-aft blades, not broad Batman-like ears.
  const fin=node(head,'head-long-side-fin-'+s,'head',[s*.431,-.015,-.250],[s*.075,.1,-.1],'hinge');
  plate(fin,'head-long-blue-fin',[[-.065,-.24],[.095,-.11],[.120,.40],[.030,.71],[-.030,.66],[-.075,.13]],.038,M.blue,[0,0,0],[0,Math.PI/2,0],.009);
  plate(fin,'head-fin-metal-spine',[[-.070,-.22],[-.017,.13],[.022,.67],[-.025,.73],[-.070,.18]],.016,M.steel,[s*.018,0,-.012],[0,Math.PI/2,0],.004);
  rod(fin,'head-fin-root-pin',[0,-.23,-.02],[0,.05,-.02],.025,M.dark);
  // The ear is a recessed, layered circular gearbox with a raised concentric bearing.
  const ear=node(head,'head-auditory-gearbox-'+s,'head',[s*.420,-.060,-.072],[s*.10,.0,-.05],'bearing');
  cyl(ear,'head-ear-black-socket',.169,.095,0,0,0,M.black,'x',.18,36);
  cyl(ear,'head-ear-bearing-casting',.148,.115,s*.016,0,0,M.steel,'x',.15,32);
  ring(ear,'head-ear-polished-rim',.123,.019,s*.083,0,0,M.bright,'x');
  cyl(ear,'head-ear-recess',.098,.130,s*.023,0,0,M.dark,'x',.098,32);
  cyl(ear,'head-ear-hub',.051,.149,s*.027,0,0,M.bright,'x',.049,24);
  ring(ear,'head-ear-hub-groove',.068,.009,s*.105,0,0,M.warm,'x');
  for(let i=0;i<16;i++){
   const a=i*TAU/16,r=.155;let tooth=box(ear,'head-ear-gear-tooth',.050,.021,.040,s*.019,Math.cos(a)*r,Math.sin(a)*r,M.dark,.003);tooth.rotation.x=a;
  }
  for(let i=0;i<6;i++){let a=i*TAU/6;cyl(ear,'head-ear-retaining-pin',.011,.153,s*.032,Math.cos(a)*.089,Math.sin(a)*.089,M.bright,'x',.011,8);}
  // Complex cheek stack follows the face inward in three discrete depth layers.
  plate(cheek,'head-zygoma-underframe',[[s*.16,.11],[s*.34,.15],[s*.39,-.16],[s*.28,-.32],[s*.16,-.20]],.075,M.dark,[0,0,.305],[0,s*.13,0],.012);
  plate(cheek,'head-cheek-alloy-sweep',[[s*.20,.11],[s*.35,.14],[s*.37,-.13],[s*.27,-.31],[s*.18,-.24]],.050,M.bright,[0,0,.350],[0,s*.18,0],.010);
  plate(cheek,'head-malar-blue-inlay',[[s*.17,.03],[s*.23,.07],[s*.27,-.09],[s*.22,-.26],[s*.15,-.21]],.040,M.blue,[0,0,.378],[0,s*.10,0],.007);
  for(let k=0;k<4;k++){
   const y=-.020-k*.066,x=s*(.29-k*.014),z=.340+k*.003;
   let slit=box(cheek,'head-cheek-louver-gap',.155,.014,.024,x,y,z,M.black,.003);slit.rotation.z=-s*.22;
   let lip=box(cheek,'head-cheek-louver-lip',.159,.012,.027,x,y+.016,z+.003,M.steel,.003);lip.rotation.z=-s*.22;
  }
  rod(cheek,'head-jaw-servo-link',[s*.39,-.17,.20],[s*.25,-.375,.25],.018,M.chrome);
  wire(cheek,'head-mastoid-copper-line',[[s*.35,-.10,.12],[s*.40,-.28,.08],[s*.27,-.38,.17]],.012,M.warm);
  wire(cheek,'head-mastoid-black-line',[[s*.40,.01,-.08],[s*.38,-.27,-.10],[s*.16,-.38,-.15]],.015,M.black);
  // Deep eye sockets remain dark behind narrow optical apertures.
  const eye=node(head,'head-optic-carrier-'+s,'head',[0,0,0],[s*.06,.015,.10],'sensor');
  plate(eye,'head-optic-dark-socket',[[s*.054,.152],[s*.294,.197],[s*.313,.101],[s*.088,.055]],.050,M.black,[0,-.028,.400],[0,s*.10,0],.009);
  plate(eye,'head-optic-lower-frame',[[s*.069,.070],[s*.296,.112],[s*.279,.066],[s*.083,.025]],.036,M.steel,[0,-.022,.432],[0,s*.09,0],.006);
  plate(eye,'head-narrow-blue-optic',[[s*.089,.108],[s*.274,.137],[s*.251,.111],[s*.099,.086]],.018,M.eye,[0,-.012,.448],[0,s*.07,0],.004);
  cyl(eye,'head-optic-micro-lens',.016,.012,s*.170,.100,.475,M.eye,'z',.016,16);
  // Blue overhanging brows and silver chevrons cast real shadows over the optics.
  plate(head,'head-frontal-brow',[[s*.045,.224],[s*.292,.292],[s*.348,.213],[s*.269,.167],[s*.082,.145]],.075,M.blue,[0,-.005,.358],[0,s*.12,0],.014);
  plate(head,'head-forehead-chevron',[[s*.025,.247],[s*.213,.261],[s*.278,.296],[s*.192,.205],[s*.061,.159]],.024,M.bright,[0,.005,.423],[0,s*.12,0],.005);
 }
 // Central blue crest bends continuously over the skull and ends in a narrow nose spear.
 const crest=node(head,'head-central-crown','head',[0,0,0],[0,.10,.08],'shell');
 ribbon('arched-blue-crown',[[.143,.421,.62],[.277,.419,.95],[.435,.321,1.03],[.555,.140,1.0],[.568,-.047,.84],[.465,-.281,.71],[.286,-.393,.58]],.175,.037,M.blue,crest);
 for(let s of [-1,1])wire(crest,'head-crown-reveal',[[s*.067,.265,.417],[s*.088,.434,.321],[s*.084,.552,.14],[s*.070,.566,-.045]],.008,M.dark);
 plate(head,'head-nasal-dark-cradle',[[-.060,.202],[.061,.202],[.074,-.144],[0,-.229],[-.073,-.144]],.057,M.dark,[0,0,.423],[0,0,0],.008);
 // A small faceted 3D nose, not a broad flat silver strip.
 {
  const vs=[-.045,.176,.458,.045,.176,.458,0,.132,.535,-.026,-.119,.475,.026,-.119,.475,0,-.195,.523,0,.176,.422,0,-.13,.423];
  const ids=[0,1,2,0,2,3,2,5,3,2,4,5,2,1,4,3,5,4,0,6,1,3,7,0,0,7,6,4,1,7,1,6,7,3,4,7];for(let i=0;i<ids.length;i+=3){const temp=ids[i+1];ids[i+1]=ids[i+2];ids[i+2]=temp;}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setIndex(ids);g.computeVertexNormals();let uv=[];for(let i=0;i<vs.length;i+=3)uv.push((vs[i]+.05)/.1,(vs[i+1]+.2)/.4);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));mesh(head,'head-blue-nasal-spear',g,M.blue);
 }
 // Independent faceplate cassette: a curved lamellar mask with actual recessed gaps.
 const jaw=node(head,'head-faceplate-cassette','head',[0,-.285,.315],[0,-.07,.14],'slide');
 plate(jaw,'head-faceplate-underframe',[[-.246,.142],[-.125,.197],[.129,.196],[.248,.130],[.190,-.142],[0,-.199],[-.188,-.144]],.076,M.dark,[0,0,.041],[0,0,0],.012);
 for(let k=0;k<5;k++){
  const y=.123-k*.052,width=.485-k*.032;
  surface('faceplate-lamella-'+k,2,16,(u,v,back)=>{
   const x=(u-.5)*width,yy=y+(v-.5)*.036;
   const zz=.112+.060*Math.cos((u-.5)*Math.PI)-(back?.030:0);
   return [x,yy,zz];
  },.030,k===0?M.bright:M.steel,jaw);
  const lip=[];for(let i=0;i<9;i++){const u=i/8;lip.push([(u-.5)*width,y+.020,.114+.060*Math.cos((u-.5)*Math.PI)]);}wire(jaw,'head-faceplate-upper-fold',lip,.0045,M.bright);
 }
 for(let s of [-1,1]){
  plate(jaw,'head-faceplate-side-latch',[[s*.183,.102],[s*.251,.127],[s*.220,-.102],[s*.142,-.168],[s*.145,-.113]],.046,M.bright,[0,0,.087],[0,s*.1,0],.007);
  plate(jaw,'head-blue-mandible',[[s*.10,-.126],[s*.219,-.083],[s*.201,-.208],[s*.060,-.254],[s*.025,-.209]],.072,M.blue,[0,0,.015],[0,s*.15,0],.010);
  cyl(jaw,'head-mandible-pin',.032,.027,s*.187,-.159,.095,M.steel,'z',.032,16);
 }
 plate(jaw,'head-chin-keel',[[-.091,-.160],[.092,-.160],[.081,-.228],[0,-.266],[-.080,-.229]],.072,M.blue,[0,0,.073],[0,0,0],.009);
 // Layered rear cranial shell and exposed small service connections, not an unmodelled back.
 for(let i=0;i<3;i++){
  const rear=node(head,'head-occipital-layer-'+i,'head',[0,0,0],[0,.03,-.07-i*.02],'shell');
  ellipsoidPatch('occipital-dark-band-'+i,.405-i*.012,.440,.365,1.03+i*.23,1.30+i*.23,1.38,4.90,[0,.03,-.015],i===1?M.blue:M.dark,rear);
  for(let s of [-1,1])wire(rear,'head-posterior-service-harness',[[s*.29,.15-i*.13,-.26],[s*.28,.03-i*.13,-.34],[s*.16,-.17-i*.06,-.30]],.012,i===1?M.warm:M.black);
 }
 return {neck,head,jaw};
}
