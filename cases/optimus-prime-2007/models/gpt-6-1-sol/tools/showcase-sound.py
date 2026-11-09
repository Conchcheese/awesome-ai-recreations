"""Mix authored mechanical cues into the verified BGM showcase; retain video frames."""
from pathlib import Path
import hashlib,json,shutil,subprocess,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'artifacts/showcase';SR=48000

def produce():
 edit=json.loads((ART/'edit.json').read_text());marks={x['label']:x['seconds'] for x in json.loads((ART/'capture.json').read_text())['marks']};duration=edit['duration'];pcm=np.zeros((round(duration*SR),2));rng=np.random.default_rng(2007);events=[]
 def cue(t,kind,length=.6,pan=0):
  if not 0<=t<duration:return
  length=min(length,duration-t);x=np.arange(round(length*SR))/SR;n=rng.normal(0,1,len(x));smooth=np.convolve(n,np.ones(15)/15,'same')
  if kind=='lock':
   y=(np.sin(2*np.pi*62*x)*np.exp(-x*19)+.65*n*np.exp(-x*110)+sum(np.sin(2*np.pi*f*x)*np.exp(-x*decay)*gain for f,decay,gain in [(430,22,.4),(790,27,.3),(1370,36,.2),(2100,48,.1)]))*.5
  elif kind=='engine':y=(np.sin(2*np.pi*47*x)+.3*np.sin(2*np.pi*94*x)+smooth*.8)*.055*np.sin(np.pi*x/length)**.5
  elif kind=='ui':y=np.sin(2*np.pi*880*x)*np.exp(-x*90)*.022
  else:
   phase=2*np.pi*(125*x+190*x*x/length)
   motor=sum(np.sin(k*phase)/k for k in range(1,9))
   ratchet=(np.sin(2*np.pi*24*x)>.78).astype(float)
   metal=n-np.convolve(n,np.ones(9)/9,'same')
   y=(motor*.22+metal*ratchet*.20+smooth*.25)*np.sin(np.pi*x/length)**.65
  # Keep motor texture audible on small speakers, with a separate metallic stop.
  if kind!='ui':
   rms=float(np.sqrt(np.mean(y*y)));target={'servo':.15,'lock':.18,'engine':.10}.get(kind,.13);y*=target/max(rms,1e-8)
  i=round(t*SR);count=min(len(y),len(pcm)-i);pcm[i:i+count,0]+=y[:count]*np.sqrt((1-pan)/2);pcm[i:i+count,1]+=y[:count]*np.sqrt((1+pan)/2)
  events.append({'time':round(t,3),'kind':kind,'duration':round(length,3),'pan':pan,'evidence':'authored mechanical-design cue; not measured film audio'})
 offset=0
 for segment in edit['edits']:
  start,end=segment['sourceStart'],segment['sourceEnd'];web=segment['source']=='web-features.webm'
  def at(source,kind,length=.6,pan=0):
   if start<=source<end:cue(offset+source-start,kind,length,pan)
  if web:
   for source in [marks['transform'],marks['transform']+2.4,marks['systems']+.75,marks['systems']+3.4,marks['combination'],marks['disassembly'],marks['reassembly']]:
    at(source,'servo',1.2);at(source+1.4,'lock',.45)
   # Three simultaneous independent sliders: restrained motors, no impact at partial opening.
   for source in [marks['combination']+2.3,marks['combination']+3.5,marks['combination']+4.7]:at(source,'servo',.85)
   at(marks['inspection'],'ui',.1)
   at(marks['disassembly']+3.3,'servo',1.25)
  else:
   if start==0:at(0,'engine',3.7)
   for source in [4.1,5.4,6.6,7.8,9.1,10.1,13.7,16.1,20.2]:at(source,'servo',.65,-.25 if int(source)%2 else .25)
   for source in [10.9,14.5,16.9]:at(source,'lock',.55)
  offset+=segment['duration']-.36
 # Prevent individual transients from clipping before the final loudness pass.
 pcm=np.tanh(pcm);stem=ART/'mechanical-effects.wav'
 with wave.open(str(stem),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((pcm*32767).astype('<i2').tobytes())
 master=ART/'visual-master-bgm.mp4'
 if not master.exists():raise FileNotFoundError('Missing verified music-only visual master; run showcase.py and archive the master first.')
 master_sha=hashlib.sha256(master.read_bytes()).hexdigest()
 expected=edit.get('soundDesign',{}).get('masterSha256',edit['outputSha256'])
 if master_sha!=expected:raise ValueError('Stale music master: archive and recreate visual-master-bgm.mp4 after changing the edit')
 music=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(master),'-vn','-ac','2','-ar',str(SR),'-f','f32le','-']),dtype='<f4').reshape(-1,2)[:len(pcm)]
 if len(pcm)-len(music)>.1*SR:raise ValueError('Audio duration mismatch')
 if len(music)<len(pcm):music=np.pad(music,((0,len(pcm)-len(music)),(0,0)))
 # Musical pauses stay intact; active mechanisms take the foreground.
 block=2400;gain=np.full(len(pcm),.72);ratios=[]
 for i in range(0,len(pcm),block):
  end=min(i+block,len(pcm));s=float(np.sqrt(np.mean(pcm[i:end]**2)))
  if s>.025:
   gain[max(0,i-4800):min(len(pcm),end+9600)]=.16
   m=float(np.sqrt(np.mean(music[i:end]**2)))*.16
   ratios.append(20*np.log10(max(s,1e-8)/max(m,1e-8)))
 # 40ms smoothing avoids gain steps without smearing the mechanical transients.
 window=np.ones(1920)/1920;gain=np.convolve(np.pad(gain,(960,959),mode='edge'),window,'valid')
 mixed=music*gain[:,None]+pcm
 mix=ART/'foreground-mix.wav'
 with wave.open(str(mix),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((np.clip(mixed,-.98,.98)*32767).astype('<i2').tobytes())
 report={'version':2,'activeWindowMedianSfxOverMusicDb':float(np.median(ratios)),'activeWindows':len(ratios),'musicGainDuringMechanisms':.16,'mechanicalRmsTarget':.15,'note':'Measured pre-normalization stem balance; does not replace listening review.'}
 if report['activeWindowMedianSfxOverMusicDb']<6:raise ValueError('Mechanical effects remain masked')
 (ART/'sound-balance.json').write_text(json.dumps(report,indent=2)+'\n')
 edit['output']='擎天柱-动作机械音效加强版.mp4';target=ROOT/'artifacts'/edit['output'];temp=ART/'sound-final.mp4'
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(master),'-i',str(mix),'-map','0:v','-map','1:a','-af','loudnorm=I=-16:TP=-2.5:LRA=11,aresample=48000','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-ac','2','-t',str(duration),'-movflags','+faststart',str(temp)],check=True)
 temp.replace(target);edit['outputSha256']=hashlib.sha256(target.read_bytes()).hexdigest();edit['soundDesign']={'version':2,'balanceReport':'sound-balance.json','source':'layered procedural motors, gear chatter and metal stops; no film samples','cueTiming':'film edit source time and browser recording marks; UI lock timing estimated from 1.4s authored transitions, not sample-accurate observation','masterSha256':master_sha,'cueCount':len(events),'events':'mechanical-cues.json'}
 (ART/'mechanical-cues.json').write_text(json.dumps(events,ensure_ascii=False,indent=2)+'\n');(ART/'edit.json').write_text(json.dumps(edit,ensure_ascii=False,indent=2)+'\n');print('Mixed',len(events),'authored cues; video stream copied without re-encoding.')
if __name__=='__main__':produce()
