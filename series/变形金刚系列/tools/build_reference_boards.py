"""Build credited, reduced-resolution study boards from verified local samples.

Requires Pillow. Never downloads media or changes source manifests. The source
images retain their complete frame, including any visible owner marks.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from characters import sample_path

SERIES=Path(__file__).resolve().parents[1]
REPO=SERIES.parents[1]
DISPLAY_NOTES={
 'devastator-2009':'合体成员样例；非大力神整体',
 'scorponok-2007':'配套产品图；非该角色独立近景',
 'laserbeak-2011':'配套产品图；非该角色独立近景',
 'wheelie-2011':'配套产品图；非该角色独立近景',
 'brains-2011':'配套产品图；非该角色独立近景',
 'slug-2017':'2017 产品线；非出场年份证明',
 'scorn-2017':'2017 产品线；非出场年份证明',
}

def build(font_path):
 font=ImageFont.truetype(str(font_path),18)
 small=ImageFont.truetype(str(font_path),13)
 title=ImageFont.truetype(str(font_path),30)
 rows=json.loads((SERIES/'research/character-library.json').read_text())['characters']
 out=SERIES/'references/boards';out.mkdir(parents=True,exist_ok=True)
 assets=[];index=[]
 for year in sorted({r['year'] for r in rows}):
  group=[r for r in rows if r['year']==year];height=150+math.ceil(len(group)/4)*350+66
  image=Image.new('RGB',(1600,height),'#101821');draw=ImageDraw.Draw(image)
  draw.text((28,24),f'TRANSFORMATION STUDIES / {year}',font=title,fill='#e8dfcf')
  draw.text((28,72),'OFFICIAL PRODUCT SUPPLEMENTS / 非商用参考研究 / 非电影原始模型',font=font,fill='#cba878')
  draw.text((28,105),'完整画面缩略；角色、摄影及产品图版权归各自权利人。逐图来源与边界见同目录 sources.json。',font=small,fill='#adb8c1')
  sources=[]
  for i,row in enumerate(group):
   x=20+(i%4)*395;y=150+(i//4)*350
   data=json.loads((SERIES/row['sources']).read_text());sample=next(iter(data.get('sources',[])),None)
   draw.rectangle((x,y,x+376,y+266),fill='#f5f5f5')
   if sample:
    file=sample_path(SERIES,row,sample['file']);raw=file.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=sample['sha256']:raise ValueError('Changed sample: '+row['id'])
    photo=Image.open(file).convert('RGB');photo.thumbnail((376,266),Image.Resampling.LANCZOS)
    image.paste(photo,(x+(376-photo.width)//2,y+(266-photo.height)//2))
    sources.append({'characterId':row['id'],'manifest':str(Path('series/变形金刚系列')/row['sources']),'sha256':sample['sha256'],'url':sample['url'],'sourcePage':sample['sourcePage'],'owner':sample['owner'],'evidenceType':sample['evidenceType'],'fullFrame':True,'displayNote':DISPLAY_NOTES.get(row['id'],'Official product supplement; not a film frame')})
   else:draw.text((x+24,y+110),'片段 / 图证入口 · 待抽帧',font=font,fill='#354452')
   draw.text((x,y+277),row['title']+' / '+row['english'],font=font,fill='#e8dfcf')
   draw.text((x,y+305),row['id'],font=small,fill='#a4b2bc')
   if row['id'] in DISPLAY_NOTES:
    draw.text((x,y+326),DISPLAY_NOTES[row['id']],font=small,fill='#d5a36a')
  draw.text((28,height-48),'© TOMY / Hasbro / respective film licensors. Attribution is not a redistribution license. Code MIT excludes these images.',font=small,fill='#aab6c0')
  target=out/f'{year}.jpg';image.save(target,quality=86,optimize=True)
  entry={'path':target.relative_to(REPO).as_posix(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'kind':'reference-study','rights':'TOMY / Hasbro / respective film licensors; official product photographs, excluded from repository MIT.','usage':'noncommercial-reference-research','rightsStatus':'redistribution-permission-not-established','sources':sources}
  assets.append(entry);index.append({'year':year,'board':f'boards/{year}.jpg','characters':len(group),'samples':sources})
 (out.parent/'sources.json').write_text(json.dumps({'purpose':'noncommercial-reference-research','rightsStatus':'redistribution-permission-not-established','transformation':'Whole-frame reduced-resolution contact sheets; added labels only.','boards':index},ensure_ascii=False,indent=2)+'\n')
 manifest=SERIES/'publication.json';data=json.loads(manifest.read_text());data['sourceMediaPolicy']='Selected whole-frame, reduced-resolution official-product study boards are published with source attribution for noncommercial reference research. No redistribution permission is claimed. Full-resolution downloads, film frames and videos remain local-only.'
 data['assets']=[a for a in data['assets'] if a['kind']!='reference-study']+assets
 manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(assets)} boards / {sum(len(a["sources"]) for a in assets)} credited samples')

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--font',type=Path,required=True,help='Installed CJK font file');args=parser.parse_args();build(args.font)
