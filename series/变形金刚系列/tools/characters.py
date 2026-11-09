"""Read, verify, fetch or instantiate character research; never imply a finished model."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from new_character import create

SERIES=Path(__file__).resolve().parents[1]

def read(path):return json.loads(path.read_text(encoding='utf-8'))
def normalize(value):return re.sub(r'[\s_-]+','',value.casefold())
def load():return read(SERIES/'research/character-library.json')
def resolve(query, data=None):
 matches=[x for x in (data or load())['characters'] if normalize(query) in {normalize(str(x[k])) for k in ['id','title','english']}]
 if len(matches)!=1:raise ValueError('角色不存在或版本不唯一，请使用角色ID；用 list 查看清单。')
 return matches[0]
def inside(root,value):
 p=Path(value)
 if p.is_absolute() or '..' in p.parts or '\\' in value:raise ValueError('路径越界')
 result=(root/p).resolve()
 if not result.is_relative_to(root.resolve()):raise ValueError('符号链接越界')
 return result

def sample_path(base, row, value):
    parts = Path(value).parts
    if len(parts) < 2 or parts[0] != 'local':
        raise ValueError('样例必须声明 local/ 下的相对路径')
    legacy = inside(inside(base, row['path']), value)
    stash = base.parents[1] / 'local/references/characters'
    canonical = inside(stash, str(Path(row['id'], *parts[1:])))
    if canonical.exists():
        return canonical
    if legacy.is_file():
        return legacy
    if row['path'].startswith('research/characters/'):
        previous = inside(base, row['path'].removeprefix('research/') + '/' + value)
        if previous.is_file():
            return previous
    return canonical


def validate_library(base=SERIES):
 errors=[];data=read(base/'research/character-library.json');ids=set()
 for row in data['characters']:
  slug=row.get('id','')
  if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',slug) or slug in ids:errors.append('重复或无效角色ID: '+slug)
  ids.add(slug)
  try:
   folder=inside(base,row['path']);sources=read(inside(base,row['sources']));structure=read(inside(base,row['structure']))
   if sources['character']['id']!=slug or sources['status']!='reference-draft':errors.append('角色来源身份/状态不一致: '+slug)
   if structure['status']!='planned-not-modeled':errors.append('计划结构不能冒充已实现模型: '+slug)
   nodes=structure['modules'];node_ids=[x['id'] for x in nodes]
   if len(node_ids)!=len(set(node_ids)) or len(nodes)<15:errors.append('候选模块重复或不足: '+slug)
   if row['sampleCount']!=len(sources['sources']):errors.append('素材数量不一致: '+slug)
   if row['status'] not in ['supplement-ready','clip-or-figure-linked']:errors.append('研究档案状态无效: '+slug)
   if not sources['sources'] and not sources.get('linkedExamples'):errors.append('研究档案缺少样例或片段/图证入口: '+slug)
   for example in sources.get('linkedExamples',[]):
    u=urlsplit(example.get('url',''))
    if u.scheme!='https' or not u.netloc or not example.get('type') or not example.get('publisher'):errors.append('片段/图证来源不完整: '+slug)
   for source in sources['sources']:
    u=urlsplit(source['url']);p=sample_path(base,row,source['file'])
    if u.scheme!='https' or u.hostname!='tf.takaratomy.co.jp' or not source['file'].startswith('local/'):errors.append('样例必须来自已登记官方域名并只保存local: '+slug)
    if not re.fullmatch('[a-f0-9]{64}',source.get('sha256','')):errors.append('样例缺少摘要: '+slug)
    if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()!=source['sha256']:errors.append('本地样例摘要不一致: '+slug)
   if not (folder/'README.md').is_file():errors.append('缺少角色说明: '+slug)
  except (OSError,ValueError,KeyError,TypeError) as e:errors.append(f'{slug}: {e}')
 return errors

def fetch(row):
 data=read(inside(SERIES,row['sources']));count=0
 if not data['sources']:raise ValueError('此角色仅有片段/图证入口，尚无已冻结直链图片；请按 sources.json 先抽帧登记。')
 for source in data['sources']:
  url=urlsplit(source['url'])
  if url.scheme!='https' or url.hostname!='tf.takaratomy.co.jp':raise ValueError('仅获取清单中已核验的官方域名素材')
  dest=sample_path(SERIES,row,source['file'])
  if dest.exists():
   if hashlib.sha256(dest.read_bytes()).hexdigest()!=source['sha256']:raise ValueError('本地文件与登记摘要不同，拒绝覆盖')
  else:
   with urlopen(Request(source['url'],headers={'User-Agent':'ReferenceCatalog/1.0'}),timeout=45) as response:
    if urlsplit(response.url).hostname!='tf.takaratomy.co.jp':raise ValueError('素材重定向到未登记域名')
    raw=response.read(20*1024*1024+1)
   if len(raw)>20*1024*1024 or hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('来源内容变化或超过限制，请重新核验，未保存')
   dest.parent.mkdir(parents=True,exist_ok=True);temp=dest.with_suffix(dest.suffix+'.part');temp.write_bytes(raw);temp.replace(dest)
  count+=1
 return count

def start(row, output_root=None, with_structure=False):
 source=read(inside(SERIES,row['sources']));target=create(row['id'],row['title'],source['targetEdition'],output_root)
 production=read(target/'production.json')
 production['provenance']='independent'
 production['rig']['requiredPorts']=[]
 production['rig']['ports']={}
 if with_structure:
  structure=read(inside(SERIES,row['structure']))
  production['rig']['requiredPorts']=structure.get('requiredSemanticPorts',[])
  shutil.copyfile(inside(SERIES,row['structure']),target/'records/计划拆分.json')
 production['inputCondition']='shared-research-candidate-included' if with_structure else 'sources-only-independent-design'
 (target/'production.json').write_text(json.dumps(production,ensure_ascii=False,indent=2)+'\n')
 shutil.copyfile(inside(SERIES,row['sources']),target/'references/sources.json')
 with (target/'README.md').open('a',encoding='utf-8') as f:f.write('\n来源于角色参考库；默认仅复制来源元数据，结构由执行者自行建立。显式携带的研究候选由 production.json 记录；不含既有实现几何。原片测量仍未完成。\n')
 return target

def main():
 p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='action',required=True)
 sub.add_parser('list');sub.add_parser('check')
 for cmd in ['show','fetch','start']:
  s=sub.add_parser(cmd);s.add_argument('character')
  if cmd=='start':s.add_argument('--with-structure',action='store_true',help='显式加入共享拆分候选，改变默认输入条件')
 args=p.parse_args()
 try:
  if args.action=='check':
   errors=validate_library()
   for e in errors:print('ERROR:',e)
   if errors:return 1
   print(f'{len(load()["characters"])}个研究档案检查通过；不计入成品案例。');return 0
  if args.action=='list':
   for x in load()['characters']:print(f'{x["id"]:27} {x["title"]} / {x["english"]} [{x["sampleCount"]} samples; {x["status"]}]')
   return 0
  row=resolve(args.character)
  if args.action=='show':print(json.dumps({'entry':row,'sources':read(inside(SERIES,row['sources'])),'structure':row['structure']},ensure_ascii=False,indent=2))
  elif args.action=='fetch':print(f'已核对/获取 {fetch(row)} 张样例，仅保存到 local。')
  else:print('已创建未实现草稿：'+str(start(row,with_structure=args.with_structure)))
 except (OSError,ValueError,KeyError) as e:p.exit(1,str(e)+'\n')
 return 0

if __name__=='__main__':raise SystemExit(main())
