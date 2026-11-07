export const DURATION=50;
export const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
export const ramp=(x,a,b)=>ease((x-a)/(b-a));
export const mix=(a,b,t)=>a+(b-a)*t;
export const shots=[
 {start:0,end:4,name:'IGNITION',title:'钢铁苏醒',lens:70},
 {start:4,end:8,name:'ARRIVAL',title:'长头卡车',lens:38},
 {start:8,end:19,name:'TRANSFORMATION',title:'机械重构',lens:36},
 {start:19,end:24,name:'REVEAL',title:'领袖登场',lens:30},
 {start:24,end:29,name:'REACTOR',title:'胸甲展开',lens:65},
 {start:29,end:34,name:'DEPLOYMENT',title:'前臂部署',lens:55},
 {start:34,end:38,name:'ARTICULATION',title:'分瓣联动',lens:65},
 {start:38,end:43,name:'DISASSEMBLY',title:'层级拆解',lens:34},
 {start:43,end:46,name:'REASSEMBLY',title:'精密重组',lens:38},
 {start:46,end:50,name:'OPTIMUS PRIME',title:'擎天柱',lens:32}
];
export const systems=[['chest','胸甲 / 动力核心'],['shoulders','肩甲 / 轮组'],['arms','前臂 / 手部'],['legs','腿甲 / 髋膝踝'],['back','背甲 / 排气系统']];
export function rigAt(p,extra={}){p=clamp(p);return {p,
 release:ramp(p,0,.16),cab:ramp(p,.09,.43),arms:ramp(p,.17,.63),engine:ramp(p,.23,.60),leg:ramp(p,.36,.85),head:ramp(p,.50,.82),lock:ramp(p,.78,1),
 chest:extra.chest??0,shoulders:extra.shoulders??0,armsOpen:extra.arms??0,legsOpen:extra.legs??0,back:extra.back??0,explode:extra.explode??0,blade:extra.blade??0,
 landing:extra.landing??0,headTurn:extra.headTurn??0,torsoTurn:extra.torsoTurn??0,pose:extra.pose??0,grip:extra.grip??0,roll:extra.roll??0
}}
export function stateAt(t){t=Math.max(0,Math.min(DURATION,t));let p=t<8?0:t<19?(t-8)/11:1;
 let chest=ramp(t,23.6,25.3)*(1-ramp(t,28.0,29.1));
 let arms=ramp(t,28.4,30.1)*(1-ramp(t,33.2,34.4));
 let legs=ramp(t,33.6,35.0)*(1-ramp(t,37.1,38.1));
 let explode=ramp(t,38,40.7)*(1-ramp(t,43.1,45.8));
 let shoulders=Math.max(ramp(t,34.1,35.8)*(1-ramp(t,37.2,38.2)),explode*.72);
 let back=ramp(t,35.0,36.1)*(1-ramp(t,37.4,38.2));
 let blade=ramp(t,30.2,31.0)*(1-ramp(t,33,33.9));
 let pose=ramp(t,19,20.5);let grip=ramp(t,29.5,31)*(1-ramp(t,33,34));
 let shot=shots.find(x=>t>=x.start&&t<x.end)||shots.at(-1);
 let landing=t>=19&&t<20.2?Math.max(0,Math.sin((t-19)*9))*Math.exp(-(t-19)*3.8):0;let headTurn=-.08*ramp(t,19,23)-.14*ramp(t,46,49);let torsoTurn=-.07*ramp(t,46,49);
 return {t,p,shot,rig:rigAt(p,{landing,headTurn,torsoTurn,chest,shoulders,arms,legs,back,explode,blade,pose,grip,roll:t<8?(8-t)*.4:0})};
}
