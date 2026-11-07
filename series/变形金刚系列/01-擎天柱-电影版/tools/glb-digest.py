"""Digest this uncompressed GLB's resolved data, independent of binary buffer placement.
Diagnostic only: production cache still requires raw SHA-256. Sparse/compressed/external assets fail closed.
"""
import copy
import hashlib
import json
from pathlib import Path
import struct
import sys
from io import BytesIO

SIZES={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
COMPONENTS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}

def digest(path):
 raw=Path(path).read_bytes()
 magic,version,length=struct.unpack_from('<III',raw)
 if magic!=0x46546c67 or version!=2 or length!=len(raw):raise ValueError('Not GLB 2')
 cursor=12;document=None;binary=None
 while cursor<len(raw):
  n,kind=struct.unpack_from('<II',raw,cursor);chunk=raw[cursor+8:cursor+8+n];cursor+=8+n
  if kind==0x4e4f534a:document=json.loads(chunk)
  elif kind==0x004e4942:binary=chunk
 if document is None or binary is None:raise ValueError('Missing JSON/BIN')
 if len(document.get('buffers',[]))!=1 or 'uri' in document['buffers'][0]:raise ValueError('Only embedded single buffer supported')
 if any(x in document.get('extensionsUsed',[]) for x in ['KHR_draco_mesh_compression','EXT_meshopt_compression']):raise ValueError('Compressed geometry unsupported')
 views=document['bufferViews'];canonical=copy.deepcopy(document);canonical.pop('buffers');canonical.pop('bufferViews')
 def view_bytes(index):
  v=views[index]
  if v.get('buffer',0)!=0:raise ValueError('External buffer')
  start=v.get('byteOffset',0);return binary[start:start+v['byteLength']]
 for original,resolved in zip(document.get('accessors',[]),canonical.get('accessors',[])):
  if 'sparse' in original or 'bufferView' not in original:raise ValueError('Sparse/missing accessor unsupported')
  v=views[original['bufferView']];data=view_bytes(original['bufferView']);width=SIZES[original['componentType']]*COMPONENTS[original['type']];stride=v.get('byteStride',width);offset=original.get('byteOffset',0)
  decoded=b''.join(data[offset+i*stride:offset+i*stride+width] for i in range(original['count']))
  if len(decoded)!=original['count']*width:raise ValueError('Truncated accessor')
  resolved.pop('bufferView');resolved.pop('byteOffset',None);resolved['dataSha256']=hashlib.sha256(decoded).hexdigest()
 for original,resolved in zip(document.get('images',[]),canonical.get('images',[])):
  if 'bufferView' not in original:raise ValueError('External image unsupported')
  from PIL import Image
  im=Image.open(BytesIO(view_bytes(original['bufferView']))).convert('RGBA');resolved.pop('bufferView');resolved['decodedDimensions']=list(im.size);resolved['decodedRGBA256']=hashlib.sha256(im.tobytes()).hexdigest()
 data=json.dumps(canonical,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
 return {'rawSha256':hashlib.sha256(raw).hexdigest(),'resolvedDataSha256':hashlib.sha256(data).hexdigest(),'nodes':len(document.get('nodes',[])),'meshes':len(document.get('meshes',[])),'accessors':len(document.get('accessors',[])),'images':len(document.get('images',[]))}

if __name__=='__main__':
 results=[digest(p) for p in sys.argv[1:]]
 print(json.dumps({'files':results,'resolvedEqual':len({r['resolvedDataSha256'] for r in results})==1},indent=2))
