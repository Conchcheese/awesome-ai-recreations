import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function acquireAssetLock(root,operation){
 const folder=path.join(root,'artifacts');await fs.mkdir(folder,{recursive:true});const file=path.join(folder,'asset.lock');let handle;
 try{handle=await fs.open(file,'wx')}catch(e){if(e.code==='EEXIST')throw Error('生产资产正被构建/导出/渲染占用。等待该任务结束；异常中断后先确认原进程已结束，再处理 artifacts/asset.lock。');throw e}
 const token=randomUUID();try{await handle.writeFile(JSON.stringify({operation,pid:process.pid,token,started:new Date().toISOString()}))}catch(e){await handle.close();await fs.unlink(file);throw e}
 return async()=>{await handle.close();const saved=JSON.parse(await fs.readFile(file,'utf8'));if(saved.token!==token)throw Error('资产锁所有者改变，拒绝移除');await fs.unlink(file)};
}
