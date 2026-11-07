import * as T from 'three';
import {ease,mix} from './timeline.mjs';
export function shotCamera(s,portrait=false){
 const t=s.t,r=s.rig;let position,target,fov,focus;
 const shot=s.shot;const u=ease((t-shot.start)/(shot.end-shot.start));
 if(t<4){position=[mix(3.5,2.7,u),mix(1.45,1.7,u),mix(7.9,7.2,u)];target=[.0,1.45,3.0];fov=31;}
 else if(t<8){position=[mix(7.8,7.0,u),mix(2.2,2.7,u),mix(8.5,9.0,u)];target=[0,1.65,-.10];fov=34;}
 else if(t<19){const a=mix(.69,.35,u),d=mix(12.5,18.8,u);position=[Math.sin(a)*d,mix(3.4,5.0,u),Math.cos(a)*d];target=[0,mix(1.7,4.25,r.leg),mix(.1,0,r.leg)];fov=mix(36,39,u);}
 else if(t<24){const a=mix(.50,.15,u);position=[Math.sin(a)*17.0,mix(2.6,3.6,u),Math.cos(a)*17.0];target=[0,4.5,0];fov=mix(35,36,u);}
 else if(t<29){position=[mix(2.5,2.2,u),mix(8.1,6.8,u),mix(4.0,7.7,u)];target=[0,mix(8.05,6.4,u),.2];fov=mix(30,36,u);}
 else if(t<34){position=[mix(-6.8,-6.0,u),mix(4.8,4.9,u),mix(7.2,6.6,u)];target=[-.10,4.75,.65];fov=27;}
 else if(t<38){position=[mix(3.7,4.0,u),mix(1.8,2.6,u),mix(5.8,5.6,u)];target=[.75,2.05,.3];fov=32;}
 else if(t<43){const a=mix(.40,.85,u);position=[Math.sin(a)*19.5,mix(7.5,8.9,u),Math.cos(a)*19.5];target=[0,4.6,0];fov=40;}
 else if(t<46){const a=mix(.85,.50,u);position=[Math.sin(a)*19.2,mix(8.3,6.1,u),Math.cos(a)*19.2];target=[0,4.5,0];fov=40;}
 else{const a=mix(-.5,-.28,u);position=[Math.sin(a)*18.0,mix(2.9,3.4,u),Math.cos(a)*18.0];target=[0,4.4,0];fov=37;}
 if(portrait){let close=[0,24,29,34].some(v=>shot.start===v);const factor=close?1.2:1.38;let pos=new T.Vector3(...position),tar=new T.Vector3(...target);pos.sub(tar).multiplyScalar(factor).add(tar);position=pos.toArray();fov=43;}
 // Deliberately small, deterministic camera inertia; a stable read of the mechanism.
 let vibration=t>8&&t<19?.006:0;
 position[0]+=Math.sin(t*31.7)*vibration;position[1]+=Math.sin(t*23.1)*vibration*.6;
 const distance=new T.Vector3(...position).distanceTo(new T.Vector3(...target));focus=distance;
 return {position,target,fov,focus,shot:shot.name};
}
