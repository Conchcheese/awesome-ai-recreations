import * as THREE from 'three';

export function createStage(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);
  renderer.setSize(1920,1080);
  renderer.setClearColor('#f8f6ef');
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  scene.fog=new THREE.Fog('#f8f6ef',9,20);
  const camera=new THREE.PerspectiveCamera(35,16/9,.05,50);
  scene.add(new THREE.HemisphereLight(0xfff9e9,0x7d8585,2.1));
  const key=new THREE.DirectionalLight(0xfff8e8,3.5);
  key.position.set(-3,6,4);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;
  key.shadow.normalBias=.018;key.shadow.bias=-.0001;key.shadow.radius=4;
  scene.add(key);
  const rim=new THREE.DirectionalLight(0xd6e5ed,2.5);rim.position.set(3,2,-4);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xffffff,1);fill.position.set(1,.3,4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#f4f0e7',roughness:.91}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.42;floor.receiveShadow=true;scene.add(floor);
  const lines=[];
  for(let ring=0;ring<4;ring++) {
    const r=1.05+ring*.48;
    for(let j=0;j<256;j++) {
      if((j+ring*7)%32>23)continue;
      const a=j/256*Math.PI*2,b=(j+1)/256*Math.PI*2;
      lines.push(r*Math.sin(a),-.416,r*Math.cos(a),r*Math.sin(b),-.416,r*Math.cos(b));
    }
  }
  for(let j=0;j<48;j++) {
    const a=j/48*Math.PI*2,r=j%4===0?2.7:2.5;
    lines.push(Math.sin(a)*2.4,-.415,Math.cos(a)*2.4,Math.sin(a)*r,-.415,Math.cos(a)*r);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  scene.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xbcb9af,transparent:true,opacity:.45})));
  function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();
  return {renderer,scene,camera,render(c){camera.position.fromArray(c.eye);camera.lookAt(...c.target);camera.fov=c.fov;camera.updateProjectionMatrix();renderer.render(scene,camera);}};
}
