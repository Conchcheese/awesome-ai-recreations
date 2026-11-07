import {makeModel} from '../src/model.mjs';
import {rigAt} from '../src/timeline.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export async function trace(root){
 const model=makeModel();const samples=[0,.25,.5,.75,1];const poses=samples.map(p=>{model.apply(rigAt(p));return model.snapshot()});
 const designAssignments={core:'中轴/发动机内构（本轮推断）',engine:'车头格栅/保险杠/发动机舱',chest:'驾驶室双窗/门板/车顶',head:'驾驶室上部收纳（本轮推断）',shoulders:'外甲/挡泥板（本轮分配）',arms:'引擎盖和前部侧甲（本轮分配）',hands:'引擎盖下方折叠收纳（本轮推断）',legs:'后部底盘和折叠下肢（本轮推断）',pelvis:'底盘连接与骨盆（本轮推断）',back:'驾驶室后甲/排气管',wheels:'前后轮组',bodywork:'前轮拱/车体外甲',tools:'前臂工具轨道（展示设计）',actuators:'装甲/骨架间的推断连接'};
 const refs={head:['ilm-088s-head-material.jpg','paramount-029s-head-chest.jpg'],chest:['paramount-029s-head-chest.jpg','paramount-018s-transform-chest.jpg'],engine:['paramount-006s-truck-front.jpg','paramount-102s-truck-side.jpg'],wheels:['paramount-102s-truck-side.jpg'],arms:['ilm-080s-shoulder-material.jpg'],shoulders:['ilm-080s-shoulder-material.jpg'],core:['paramount-048s-abdomen.jpg'],back:['ilm-080s-shoulder-material.jpg']};
 const report={schemaVersion:1,units:'scene / all world dimensions guess',meaning:'每个稳定装配ID在同一rig的车辆、人形与中段世界矩阵。车辆区域是本轮设计分配，不等同电影真实拓扑。surfaceReferences仅为外观线索，不证明该节点内部结构。',matrixConvention:'Three.js column-major world matrix; x right/y up/z forward',samples,assemblies:model.assemblies.map((a,i)=>({id:a.id,parent:a.group.parent.name,system:a.system,vehicleDesignAssignment:designAssignments[a.system]||'未定，需核对',surfaceReferences:(refs[a.system]||[]).map(f=>'../references/local/'+f),geometryEvidence:'procedural approximation / inferred construction',transformEvidence:a.system==='tools'?'designed':'inferred',inspectionEvidence:'designed deployment / not asserted as film mechanism',samples:samples.map((p,j)=>({p,matrix:poses[j][i].matrix}))}))};
 report.sourceHashes={};for(const file of ['src/model.mjs','src/head.mjs','src/timeline.mjs'])report.sourceHashes[file]=createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
 await fs.writeFile(path.join(root,'artifacts/part-trace.json'),JSON.stringify(report,null,2)+'\n');console.log(`已追踪 ${report.assemblies.length} 个装配 × ${samples.length} 个双端/中段姿态`);
}
