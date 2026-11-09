"""Check the actual local showcase MP4; generate a decoded-frame contact sheet."""
from pathlib import Path
import hashlib
import io
import json
import re
import subprocess
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts/showcase'
def run(args):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def check():
 edit=json.loads((ART/'edit.json').read_text());movie=ROOT/'artifacts'/edit['output']
 probe=json.loads(run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(movie)]).stdout)
 v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
 checks={'resolution':(v['width'],v['height'])==(1920,1080),'fps':v['avg_frame_rate']=='25/1','frames':int(v['nb_read_frames'])==round(edit['duration']*25),'duration':abs(float(probe['format']['duration'])-edit['duration'])<.05,'videoCodec':v['codec_name']=='h264' and v['pix_fmt']=='yuv420p','bt709':v.get('color_space')=='bt709' and v.get('color_range')=='tv','audioCodec':a['codec_name']=='aac' and a['sample_rate']=='48000' and a['channels']==2,'outputHash':sha(movie)==edit['outputSha256'],'currentHtml':sha(ROOT/'index.html')==edit['captureHtmlSha256'],'filmHash':sha(ROOT/'artifacts/擎天柱-2007-电影版-Cycles.mp4')==edit['filmSha256'],'webHash':sha(ART/'web-features.webm')==edit['webSha256']}
 decoded=run(['ffmpeg','-hide_banner','-v','info','-i',str(movie),'-vf','blackdetect=d=0.08:pix_th=0.02:pic_th=0.98,freezedetect=n=-55dB:d=5','-an','-f','null','-']).stderr.decode()
 blacks=[list(map(float,m)) for m in re.findall(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)',decoded)]
 checks['noUnexpectedBlack']=all(start>edit['duration']-.5 for start,end,duration in blacks)
 freezes=re.findall(r'freeze_(?:start|duration|end): [\d.]+',decoded)
 checks['noLongFreeze']=not freezes
 pcm=np.frombuffer(run(['ffmpeg','-v','error','-i',str(movie),'-vn','-f','f32le','-ac','2','-ar','48000','-']).stdout,dtype='<f4')
 peak=float(np.max(np.abs(pcm)));rms=float(np.sqrt(np.mean(pcm.astype(np.float64)**2)))
 loud=run(['ffmpeg','-hide_banner','-i',str(movie),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr.decode();match=re.search(r'\{\s*"input_i".*?\}',loud,re.S);loudness=json.loads(match.group())
 checks['audibleAndNotClipped']=.01<rms<.5 and peak<.99
 checks['loudness']=-18<float(loudness['input_i'])<-14 and float(loudness['input_tp'])<=-.8
 duration=edit['duration'];times=[.8,5,10,14,18,23,28,33,38,44,49,54,60,65,69,71.5]
 contact=Image.new('RGB',(1920,4*300),'#101820');draw=ImageDraw.Draw(contact)
 for i,t in enumerate(times):
  raw=run(['ffmpeg','-v','error','-ss',str(min(t,duration-.2)),'-i',str(movie),'-frames:v','1','-f','image2pipe','-vcodec','png','-']).stdout
  image=Image.open(io.BytesIO(raw)).convert('RGB');image.thumbnail((480,270),Image.Resampling.LANCZOS);x=(i%4)*480;y=(i//4)*300;contact.paste(image,(x,y));draw.text((x+8,y+279),f'{t:05.2f}s',fill='#d7b78c')
 contact.save(ART/'contact.jpg',quality=90)
 report={'result':'passed' if all(checks.values()) else 'failed','checks':checks,'video':{'duration':float(probe['format']['duration']),'frames':int(v['nb_read_frames']),'bytes':int(probe['format']['size']),'sha256':sha(movie)},'audio':{'peak':peak,'rms':rms,'integratedLufs':float(loudness['input_i']),'truePeakDbtp':float(loudness['input_tp']),'lra':float(loudness['input_lra'])},'blackIntervals':blacks,'freezeEvents':freezes,'note':'Full decode and numerical checks; contact sheet requires visual review. Listening and artistic approval are separate.'}
 (ART/'video-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
 if not all(checks.values()):raise SystemExit(1)

if __name__=='__main__':check()
