"""Edit the real webpage recording with same-model Cycles shots and credited BGM.

Run capture-showcase.mjs first. Requires FFmpeg, Pillow and an installed CJK font.
Inputs and all outputs remain in ignored local/artifacts directories.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from showcase_inputs import film_revision

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts/showcase'
FPS=25
TITLE='擎天柱-电影与网页功能演示-BGM.mp4'
CREDIT="'Titan' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au"

def run(args):
 return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def produce(font_path,music):
 ART.mkdir(parents=True,exist_ok=True)
 capture=json.loads((ART/'capture.json').read_text());marks={m['label']:m['seconds'] for m in capture['marks']}
 film=ROOT/'artifacts/擎天柱-2007-电影版-Cycles.mp4';web=ART/'web-features.webm'
 revision=film_revision(ROOT,film)
 if capture['htmlSha256']!=sha(ROOT/'index.html'):raise ValueError('Web recording is stale; recapture current HTML')
 if capture['errors']:raise ValueError('Recording contains page errors')
 if not (ART/'capture-complete.json').exists():raise ValueError('Incomplete browser recording')
 length=float(json.loads(run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(web)]).stdout)['format']['duration'])
 f=lambda size:ImageFont.truetype(str(font_path),size)
 chapters=[
  (film,0,4,'01 / ARRIVAL','长头卡车 · 低机位建立'),
  (film,4,13.5,'02 / TRANSFORMATION','同源装配 · 连续变形'),
  (web,marks['ready'],marks['combination'],'03 / LIVE INTERACTION','实录：旋转观察 / 双形态 / 独立展开'),
  (film,13.5,18.5,'04 / UNDER THE ARMOR','头胸特写 · 前臂部署'),
  (web,marks['combination'],marks['disassembly'],'05 / ASSEMBLY RESEARCH','实录：组合开合 / 节点选择 / 灰模与系统分色'),
  (film,20,23,'06 / LAYERS','分层拆解 · 空间与秩序'),
  (web,marks['disassembly'],min(marks['end'],length),'07 / REBUILD','实录：分层滑杆 / 重组 / 轨道相机'),
  (film,25,28,'08 / OPTIMUS PRIME','结构研究 · 非官方程序化重构'),
 ]
 normalized=[];edits=[]
 for i,(source,start,end,en,cn) in enumerate(chapters):
  duration=round((end-start)*FPS)/FPS
  if duration<=0 or start<0:raise ValueError('Invalid edit range')
  label=Image.new('RGBA',(1920,1080));d=ImageDraw.Draw(label)
  d.rounded_rectangle((530,20,1390,107),radius=4,fill=(7,13,20,215),outline=(185,146,98,100),width=1)
  d.text((960,36),en,font=f(22),fill='#d1ac7e',anchor='mt')
  d.text((960,68),cn,font=f(22),fill='#eee8dc',anchor='mt')
  overlay=ART/f'label-{i:02d}.png';label.save(overlay)
  target=ART/f'segment-{i:02d}.mp4'
  video_filter='fps=25,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080d14,setsar=1,setpts=PTS-STARTPTS'
  # Short title fades; real application controls remain untouched underneath.
  graph=f'[0:v]{video_filter}[base];[1:v]format=rgba,fade=t=in:st=0:d=0.2:alpha=1,fade=t=out:st=2.7:d=0.4:alpha=1[title];[base][title]overlay=0:0:shortest=1,format=yuv420p[v]'
  run(['ffmpeg','-y','-v','error','-filter_complex_threads','1','-ss',str(start),'-i',str(source),'-loop','1','-i',str(overlay),'-filter_complex',graph,'-map','[v]','-an','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','17','-threads','4',str(target)])
  normalized.append((target,duration));edits.append({'source':source.name,'sourceStart':start,'sourceEnd':end,'duration':duration,'title':cn});print(f'Encoded {i+1}/{len(chapters)}: {cn}',flush=True)
 # Final card: source render is dimmed so the attribution stays fully readable.
 still=ROOT/'stills/03-英雄亮相.jpg';card=Image.open(still).convert('RGB');card.thumbnail((1920,1080));bg=Image.new('RGB',(1920,1080),'#080d14');bg.paste(card,((1920-card.width)//2,(1080-card.height)//2));bg=bg.filter(ImageFilter.GaussianBlur(4)).convert('RGBA');bg=Image.alpha_composite(bg,Image.new('RGBA',bg.size,(5,10,17,205)));d=ImageDraw.Draw(bg)
 d.text((130,190),'TRANSFORMATION STUDIES / 2007',font=f(27),fill='#c9a77a')
 d.text((125,260),'OPTIMUS PRIME',font=f(108),fill='#eee8db')
 d.line((130,425,390,425),fill='#c5a06e',width=3)
 d.text((130,472),'从装甲之下，看见机械的秩序。',font=f(43),fill='#ddd8ce')
 d.text((130,565),'在线互动 · 装配研究 · 同源电影渲染',font=f(28),fill='#aab5bf')
 d.text((130,665),'github.com/topmindspace/awesome-ai-recreations',font=f(25),fill='#c9a77a')
 d.text((130,815),'MUSIC / '+CREDIT,font=f(23),fill='#c7cbd0')
 d.text((130,862),'Excerpt edited with fades · creativecommons.org/licenses/by/4.0/',font=f(22),fill='#9daab7')
 d.text((130,925),'非官方 · 非商用参考研究 · 角色与影视设计版权归各自权利人',font=f(23),fill='#a6b1ba')
 bg.convert('RGB').save(ART/'endcard.png')
 end=ART/'segment-end.mp4';run(['ffmpeg','-y','-v','error','-loop','1','-i',str(ART/'endcard.png'),'-t','4','-vf','fps=25,format=yuv420p','-c:v','libx264','-preset','fast','-crf','17','-threads','4',str(end)]);normalized.append((end,4))
 args=['ffmpeg','-y','-v','error','-filter_complex_threads','1']
 for file,_ in normalized:args+=['-i',str(file)]
 args+=['-ss','95','-i',str(music)]
 filters=[];current='0:v';total=normalized[0][1]
 for i,(_,duration) in enumerate(normalized[1:],1):
  offset=round(total-.36,3);label=f'x{i}';filters.append(f'[{current}][{i}:v]xfade=transition=fade:duration=0.36:offset={offset}[{label}]');current=label;total=round(total+duration-.36,3)
 total=round(total*FPS)/FPS
 filters.append(f'[{current}]fade=t=out:st={total-.48}:d=0.48,format=yuv420p[v]')
 n=len(normalized);filters.append(f'[{n}:a]atrim=duration={total},asetpts=PTS-STARTPTS,afade=t=in:d=1.2,afade=t=out:st={total-3}:d=3,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]')
 target=ROOT/'artifacts'/TITLE
 args+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-t',str(total),'-c:v','libx264','-preset','slow','-crf','17','-threads','4','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_trc','bt709','-color_primaries','bt709','-c:a','aac','-b:a','256k','-ac','2','-ar','48000','-movflags','+faststart','-metadata','title=Optimus Prime / Cinema and Interactive Study','-metadata','comment='+CREDIT,str(target)]
 run(args)
 report={'output':TITLE,'duration':total,'fps':FPS,'resolution':[1920,1080],'edits':edits,'transition':{'type':'crossfade','duration':.36},'captureHtmlSha256':capture['htmlSha256'],'filmRenderHtmlSha256':revision['renderHtmlSha256'],'filmSha256':revision['videoSha256'],'webSha256':sha(web),'outputSha256':sha(target),'music':{'title':'Titan','artist':'Scott Buckley','license':'CC BY 4.0','page':'https://www.scottbuckley.com.au/library/titan/','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','sourceStart':95,'sha256':sha(music),'changes':'Excerpt, fades, loudness normalization','credit':CREDIT}}
 (ART/'edit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 (target.with_suffix('.txt')).write_text('擎天柱 / 电影与网页功能演示\n'+CREDIT+'\nhttps://www.scottbuckley.com.au/library/titan/\nhttps://creativecommons.org/licenses/by/4.0/\nMusic excerpt edited with fades and loudness normalization.\n如上传YouTube，请将以上署名放入视频说明。\n非官方、非商用参考研究；角色与影视设计版权归各自权利人。\n')
 print(str(target),flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--font',type=Path,required=True);parser.add_argument('--music',type=Path,required=True);args=parser.parse_args();produce(args.font,args.music)
