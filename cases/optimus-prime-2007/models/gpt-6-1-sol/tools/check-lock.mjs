import {acquireAssetLock} from './asset-lock.mjs';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'transformer-lock-'));
try{const release=await acquireAssetLock(root,'test-render');await assert.rejects(()=>acquireAssetLock(root,'test-export'),/占用/);await release();const again=await acquireAssetLock(root,'test-build');await again();await assert.rejects(()=>fs.access(path.join(root,'artifacts/asset.lock')));console.log('资产互斥、释放与重新获取检查通过')}finally{await fs.rm(root,{recursive:true,force:true})}
