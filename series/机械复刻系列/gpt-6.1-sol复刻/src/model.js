// V2 action study: metres, seconds, radians. Every animated value comes from t.
export const DURATION=64;
export const PARAM=Object.freeze({arms:8,links:22,armLength:1.36,radius:.43,frequency:1.8});
export const SHOTS=[
 {key:'hero',at:0,sample:1.2,name:'倾转喷进 · 收臂巡航',code:'JET IN / STREAMLINE',az:.62,el:.25,d:4.15,target:[0,.46,0]},
 {key:'swim',at:6,sample:9,name:'八臂游动 · 舒展与卷曲',code:'EIGHT-ARM LOCOMOTION',az:.32,el:.40,d:4.45,target:[0,.46,0]},
 {key:'optics',at:13,sample:15.8,name:'光学镜组 · 虹膜开合',code:'OPTICS / IRIS ACTUATION',az:.16,el:.24,d:2.95,target:[0,.53,.08]},
 {key:'mantle',at:18,sample:22,name:'外套膜展开 · 泵核运行',code:'MANTLE / PUMP CYCLE',az:.57,el:.57,d:3.75,target:[0,.57,0]},
 {key:'arm',at:25,sample:28.6,name:'R2 腕 · 分节拆解与回装',code:'ARM R2 / JOINT TEARDOWN',az:1.14,el:.38,d:3.65,target:[.20,.48,.06]},
 {key:'siphon',at:32,sample:35.8,name:'虹吸推进 · 叶瓣与尾流',code:'SIPHON / VECTORED JET',az:2.72,el:.26,d:3.0,target:[0,.42,-.36]},
 {key:'hold',at:38,sample:41,name:'悬停保持 · 俯仰与横滚',code:'ATTITUDE / STATION KEEP',az:.72,el:.38,d:4.30,target:[0,.46,0]},
 {key:'beak',at:43,sample:46,name:'双颚活动 · 齿舌与传动',code:'BEAK / RADULA DRIVE',az:.32,el:.08,d:4.35,target:[0,.62,.05]},
 {key:'explode',at:48,sample:52,name:'整机分解 · 多级装配展开',code:'FULL SYSTEM TEARDOWN',az:.55,el:.45,d:4.60,target:[0,.65,0]},
 {key:'restore',at:54,sample:56.5,name:'总成复位 · 动作检查',code:'REASSEMBLY / VERIFY',az:.25,el:.38,d:4.20,target:[0,.46,0]},
 {key:'depart',at:58,sample:61.5,name:'收臂加速 · 倾转离站',code:'STREAMLINE / DEPART',az:.62,el:.25,d:4.40,target:[0,.46,0]},
];
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const ease=x=>{x=clamp(x);return x*x*x*(x*(6*x-15)+10);};
export const lerp=(a,b,k)=>a+(b-a)*k;
export const gate=(t,a,b,c,d)=>ease((t-a)/(b-a))*(1-ease((t-c)/(d-c)));
const weights=Array.from({length:22},(_,j)=>j<8?lerp(.12,.09,j/7):lerp(.04,.016,(j-8)/13));
const totalWeight=weights.reduce((a,b)=>a+b,0);
export const linkLength=j=>weights[j]/totalWeight*PARAM.armLength;
export function motionAt(t){
 const incoming=1-ease((t-1.8)/3.7),depart=ease((t-58.2)/2.5);
 const streamline=clamp(incoming+depart);
 const swim=gate(t,5.5,6.6,11.8,13.0),hover=gate(t,38.3,39.5,42,43);
 const underside=gate(t,43,44.5,47.5,48.2);
 const roll=incoming*1.03-depart*1.03+hover*.24*Math.sin((t-39)*2.0);
 const pitch=-underside*.92+hover*.19*Math.sin((t-39)*1.6)+.035*Math.sin(t*.65);
 const yaw=.05*Math.sin(t*.42)+hover*.38*Math.sin((t-39)*1.35);
 const position=[-.42*incoming+.78*ease((t-59)/5),.10+.42*streamline+.22*underside+.022*Math.sin(t*1.3),.055*Math.sin(t*.7)];
 const curls=Array.from({length:8},(_,i)=>clamp(.48+.055*Math.sin(t*.65+i*.8)+swim*.31*Math.sin((t-6)*Math.PI*2/3.2-i*Math.PI/4),.1,.9));
 return {incoming,depart,streamline,swim,hover,underside,position,rotation:[pitch,yaw,roll],curls};
}
export function armChain(i,t,curl,streamline=0){
 const theta=i*Math.PI/4+Math.PI/8;
 const phase=(t-6)*Math.PI*2/3.2-i*Math.PI/4;
 const points=[];
 let x=Math.sin(theta)*.385,y=.245,z=Math.cos(theta)*.385,distance=0;
 for(let j=0;j<=PARAM.links;j++){
  points.push([x,y,z]);if(j===PARAM.links)break;
  const step=linkLength(j),u=(distance+step*.5)/PARAM.armLength;
  const bend=-.16+(1.25+5.2*curl)*Math.pow(u,1.9);
  const twist=.13*Math.sin(phase+u*4)*Math.sin(Math.PI*u)*(1-streamline);
  const radial=lerp(Math.cos(bend),.10+.12*(1-u),streamline);
  const vertical=lerp(Math.sin(bend),-1,streamline);
  let dx=Math.sin(theta)*radial+Math.cos(theta)*twist;
  let dz=Math.cos(theta)*radial-Math.sin(theta)*twist;
  const norm=Math.hypot(dx,vertical,dz);x+=dx/norm*step;y+=vertical/norm*step;z+=dz/norm*step;distance+=step;
 }
 return points;
}
export function cameraAt(t){
 const index=Math.max(0,SHOTS.findLastIndex(s=>t>=s.at));
 const b=SHOTS[index],a=SHOTS[Math.max(0,index-1)],transition=Math.max(1.7,Math.abs(b.az-a.az)*1.3),k=index?ease((t-b.at)/transition):1;
 const az=lerp(a.az,b.az,k),el=lerp(a.el,b.el,k),d=lerp(a.d,b.d,k);
 const pose=motionAt(t),target=b.target.map((v,j)=>lerp(a.target[j],v,k));
 target[0]+=pose.position[0]*.45;target[1]+=pose.position[1]*.8;
 return {eye:[target[0]+Math.sin(az)*Math.cos(el)*d,target[1]+Math.sin(el)*d,target[2]+Math.cos(az)*Math.cos(el)*d],target,fov:35};
}
export function pressureAt(t){
 const pulse=Math.pow((Math.sin(t*PARAM.frequency*Math.PI*2)+1)/2,5);
 const jet=clamp(motionAt(t).streamline+.85*gate(t,33.8,34.7,36.7,37.8));
 return 20+56*pulse*jet;
}
export function stateAt(input){
 const t=clamp(input,0,DURATION),motion=motionAt(t);
 const phase=t*PARAM.frequency*Math.PI*2,pulse=Math.pow((Math.sin(phase)+1)/2,5);
 const expansion=gate(t,49.5,51.5,54.1,56.8);
 const shell=gate(t,19.5,21.3,23.1,24.8)*1.12+expansion*.92;
 const isolate=gate(t,26.5,28.0,29.8,31.7);
 const optics=gate(t,14.4,15.2,16.8,17.8);
 const iris=.7+optics*.3*Math.sin((t-14.4)*Math.PI*2/1.15);
 const siphon=gate(t,33.8,34.7,36.7,37.8);
 const nozzleOpen=siphon*(.6+.4*Math.sin((t-34.7)*Math.PI*2/1.1));
 const beakWindow=gate(t,44.5,45.0,47.2,47.9);
 const beak=beakWindow*(.55+.45*Math.sin((t-45)*Math.PI*2/1.25));
 const jet=clamp(motion.streamline+siphon*.85);
 const thrust=6+166*pulse*jet;
 const index=Math.max(0,SHOTS.findLastIndex(s=>t>=s.at));
 return {t,index,phase,pulse,shell,expansion,isolate,optics,iris,siphon,nozzleOpen,beak,jet,
  pumpStroke:(.5+.5*Math.sin(phase))*clamp(shell),rotorAngle:t*8+12*clamp(t-33.8,0,4),
  curl:motion.curls.reduce((a,b)=>a+b)/8,motion,camera:cameraAt(t),
  arms:motion.curls.map((curl,i)=>armChain(i,t,curl,motion.streamline)),
  telemetry:{pressure:pressureAt(t),thrust,battery:87-t*.07,power:19+thrust*.14,depth:12.35+.1*Math.sin(t*.5),pitch:motion.rotation[0]*180/Math.PI,roll:motion.rotation[2]*180/Math.PI,speed:.08+thrust*.014},
 };
}
