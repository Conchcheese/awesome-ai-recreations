"""Enforce the explicit public asset inventory for the Transformers series."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

PREFIX='series/变形金刚系列/'
MEDIA={'.jpg','.jpeg','.png','.webp','.gif','.hdr','.pdf','.glb','.blend','.dmg','.mp4','.mov','.webm','.wav'}

def validate_publication(files,root):
 manifest=root/PREFIX/'publication.json'
 if not manifest.exists():return []
 errors=[]
 try:
  data=json.loads(manifest.read_text(encoding='utf-8'));assets={}
  scopes=[PREFIX]
  for task in root.glob('cases/*/task/input.json'):
   if json.loads(task.read_text(encoding='utf-8')).get('series')=='transformers':
    scopes.append(task.parent.parent.relative_to(root).as_posix()+'/models/')
  scopes=tuple(scopes)
  for item in data['assets']:
   p=Path(item['path'])
   if p.is_absolute() or '..' in p.parts or not str(p).startswith(scopes):raise ValueError('公开素材路径无效')
   if item['path'] in assets:errors.append('公开素材清单重复')
   if item['kind'] not in ['self-render','cc0-environment','reference-study']:errors.append('公开素材类型不允许: '+item['path'])
   if not item.get('rights'):errors.append('公开素材缺少权利说明: '+item['path'])
   if item['kind']=='reference-study':
    if not item['path'].startswith(PREFIX+'references/boards/') or p.suffix.lower() not in ['.jpg','.jpeg']:errors.append('研究板必须放在references/boards且使用JPEG')
    if item.get('usage')!='noncommercial-reference-research' or item.get('rightsStatus')!='redistribution-permission-not-established':errors.append('研究板缺少用途或未取得授权的明确说明')
    if not item.get('sources'):errors.append('研究板缺少逐图来源')
    for source in item.get('sources',[]):
     manifest_path=Path(source['manifest'])
     if manifest_path.is_absolute() or '..' in manifest_path.parts or not str(manifest_path).startswith(PREFIX+'research/characters/'):raise ValueError('研究板来源清单越界')
     if not (root/manifest_path).resolve().is_relative_to(root.resolve()):raise ValueError('研究板来源清单越界')
     if not source.get('owner') or source.get('fullFrame') is not True:errors.append('研究板缺少权利人或完整画面声明')
     if any(urlsplit(source[k]).scheme!='https' or not urlsplit(source[k]).netloc for k in ['url','sourcePage']):errors.append('研究板来源URL无效')
     originals=json.loads((root/manifest_path).read_text(encoding='utf-8')).get('sources',[])
     if not any(all(s.get(k)==source.get(k) for k in ['sha256','url','sourcePage','owner']) for s in originals):errors.append('研究板来源与角色清单不一致')
   assets[item['path']]=item
   if not (root/p).is_file() or not (root/p).resolve().is_relative_to(root.resolve()):errors.append('公开素材缺失或越界: '+item['path'])
  for value in assets:
   if value not in files:errors.append('公开素材未进入发布候选: '+value)
  for value in files:
   if not value.startswith(scopes) or Path(value).suffix.lower() not in MEDIA:continue
   file=root/value
   if not file.exists():continue
   item=assets.get(value)
   if item is None:errors.append('未登记的变形金刚媒体不得发布: '+value);continue
   raw=file.read_bytes()
   if hashlib.sha256(raw).hexdigest()!=item['sha256']:errors.append('公开素材摘要不一致: '+value)
   if file.suffix.lower() in ['.jpg','.jpeg'] and b'Exif\x00\x00' in raw:errors.append('公开静帧含EXIF，请清理后更新清单: '+value)
 except (OSError,ValueError,KeyError,TypeError) as e:errors.append('变形金刚发布清单无效: '+str(e))
 return errors
