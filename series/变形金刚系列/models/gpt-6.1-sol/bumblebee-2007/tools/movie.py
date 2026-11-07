"""Original score, mechanical events, deterministic encoding and media checks."""
import argparse, hashlib, json, re, subprocess, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'artifacts'
SR=48000
DURATION=22
MOVIE=OUT/'大黄蜂-2007-电影短片.mp4'

def run(args):
    result=subprocess.run(args,capture_output=True,text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:])
    return result.stdout

def save_wave(path,a):
    a=np.asarray(a)
    if a.ndim==1:a=np.column_stack((a,a))
    a=np.clip(a,-.98,.98)
    with wave.open(str(path),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((a*32767).astype('<i2').tobytes())

def audio():
    n=DURATION*SR;t=np.arange(n)/SR;rng=np.random.default_rng(1307)
    score=np.zeros((n,2));fx=np.zeros((n,2))
    # Newly synthesized D minor / Bb / F / C cue, no sampled or licensed music.
    chords=[(36,43,50,53,57),(34,41,46,50,53),(29,41,45,48,53),(36,43,48,52,55)]
    for k,chord in enumerate(chords):
        start=k*5.5;env=np.clip((t-start)/1.1,0,1)*np.clip((start+6.2-t)/1.5,0,1)
        for j,midi in enumerate(chord):
            f=440*2**((midi-69)/12)
            for channel in range(2):
                detune=1+(.0008 if channel else -.0008)
                a=sum(np.sin(2*np.pi*f*detune*h*t+channel*.19)/(h**1.7) for h in range(1,5))
                score[:,channel]+=.025*a*env*(.83+.17*np.sin(t*.8+j))
    # Low pulses build underneath the unfolding sequence.
    for at in np.arange(3.15,20.5,.75):
        q=t-at;e=np.exp(-np.maximum(q,0)*8)*(q>=0)
        hit=.1*e*np.sin(2*np.pi*(47*q+17*.08*(1-np.exp(-np.maximum(q,0)/.08))))
        score+=hit[:,None]
    # Air and servo design with event-dependent pitch and stereo placement.
    cues=[(3.125,1.0,'unlock',.25),(4.1,1.5,'servo',-.5),(5.25,1.7,'servo',.5),(6.65,1.5,'servo',-.3),(7.7,1.2,'servo',.3),(9.35,.8,'lock',0),(11.25,1.15,'servo',0),(12.5,.4,'lock',0),(16,.9,'lock',0)]
    for at,dur,kind,pan in cues:
        i=int(at*SR);count=min(int(dur*SR),n-i);q=np.arange(count)/SR
        noise=rng.normal(0,1,count);noise=np.convolve(noise,np.ones(7)/7,mode='same')
        env=np.sin(np.pi*np.clip(q/dur,0,1))**1.5
        if kind=='servo':
            phase=2*np.pi*(95*q+90*q*q/dur)
            s=(.1*np.sin(phase)+.035*np.sin(phase*4.03)+.055*noise)*env
            s+=(.025*np.sin(2*np.pi*31*q)**20)*env
        else:
            s=.19*np.sin(2*np.pi*(58*q-8*q*q))*np.exp(-q*12)+.17*noise*np.exp(-q*35)
            s+=.035*np.sin(2*np.pi*910*q)*np.exp(-q*18)
        for ch,gain in enumerate(((1-pan)/2,(1+pan)/2)):
            fx[i:i+count,ch]+=s*(.6+gain)
            # Short early reflection instead of a wash that masks the mechanisms.
            delay=int(.071*SR);end=min(n,i+delay+count);c=end-i-delay
            if c>0:fx[i+delay:end,ch]+=.17*s[:c]
    fade=np.clip(t/1.0,0,1)*np.clip((DURATION-t)/1.6,0,1)
    score*=fade[:,None];fx*=fade[:,None]
    mix=score+fx
    mix*=.8/max(.8,np.abs(mix).max())
    save_wave(OUT/'original-score.wav',score);save_wave(OUT/'mechanical-effects.wav',fx);save_wave(OUT/'mix.wav',mix)
    (OUT/'audio-cues.json').write_text(json.dumps({'author':'Codex procedural synthesis','source':'original NumPy synthesis; no film samples','cues':[dict(time=a,duration=b,type=c,pan=d) for a,b,c,d in cues]},indent=2)+'\n')

def validate_frames():
    c=json.loads((OUT/'render-config.json').read_text())
    settings={k:c[k] for k in ['engine','samples','width']}
    digest=hashlib.sha256((BASE/'src/scene.py').read_bytes()+json.dumps(settings).encode()).hexdigest()
    if digest!=c['fingerprint']:raise RuntimeError('Scene or settings changed after render; refusing stale frames')
    frames=(BASE/c['frames']).resolve()
    if not frames.is_relative_to(OUT.resolve()):raise RuntimeError('Frame path escaped artifacts')
    if c['count']!=round(c['duration']*c['fps']):raise RuntimeError('Frame count does not cover duration')
    expected=[frames/f'{i:05d}.png' for i in range(c['count'])]
    missing=[p.name for p in expected if not p.is_file()]
    if missing:raise RuntimeError(f'{len(missing)} missing frames, first: {missing[:5]}')
    # Recheck all image headers before encoding, catching interrupted PNG saves.
    for p in expected:
        with Image.open(p) as im:
            assert im.size==(c['width'],c['height']);im.verify()
    return c,frames

def encode():
    c,frames=validate_frames()
    audio()
    title=Image.new('RGBA',(c['width'],c['height']));d=ImageDraw.Draw(title);x=80;y=c['height']-126
    d.text((x,y),'2007 / AUTOBOT SCOUT',font=ImageFont.load_default(size=16),fill=(238,182,66,255))
    d.text((x,y+26),'BUMBLEBEE',font=ImageFont.load_default(size=38),fill=(240,242,245,255))
    d.text((x,y+76),'A PROCEDURAL CHARACTER STUDY',font=ImageFont.load_default(size=12),fill=(184,197,207,255))
    title.save(OUT/'title.png')
    run(['ffmpeg','-hide_banner','-y','-framerate',str(c['fps']),'-i',str(frames/'%05d.png'),'-loop','1','-i',str(OUT/'title.png'),'-i',str(OUT/'mix.wav'),'-filter_complex',"[0:v][1:v]overlay=enable='between(t,0.5,2.8)+between(t,18.5,22)':format=auto[v]",'-map','[v]','-map','2:a','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-af','loudnorm=I=-18:TP=-1.5:LRA=9','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart','-t',str(DURATION),'-metadata','title=BUMBLEBEE | 2007 | Independent procedural study','-metadata','comment=Original procedural geometry, music and sound design. Character rights remain with their owners.',str(MOVIE)])
    c['movie_sha256']=hashlib.sha256(MOVIE.read_bytes()).hexdigest();c['movie_bytes']=MOVIE.stat().st_size
    (OUT/'movie-manifest.json').write_text(json.dumps(c,indent=2)+'\n')

def check():
    p=json.loads(run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(MOVIE)]))
    v=next(x for x in p['streams'] if x['codec_type']=='video');a=next(x for x in p['streams'] if x['codec_type']=='audio')
    assert v['codec_name']=='h264' and v['r_frame_rate']=='24/1' and int(v['nb_read_frames'])==528
    assert a['channels']==2 and a['sample_rate']=='48000'
    assert abs(float(p['format']['duration'])-22)<.05
    r=subprocess.run(['ffmpeg','-v','error','-i',str(MOVIE),'-f','null','-'],capture_output=True,text=True,check=True)
    assert not r.stderr.strip(),r.stderr
    r=subprocess.run(['ffmpeg','-hide_banner','-i',str(MOVIE),'-vf','blackdetect=d=0.08:pix_th=0.08,freezedetect=n=-50dB:d=1','-af','ebur128=peak=true','-f','null','-'],capture_output=True,text=True,check=True)
    assert 'black_start:' not in r.stderr,'unexpected black frames'
    assert 'freeze_start:' not in r.stderr,'unexpected one-second freeze'
    (OUT/'media-analysis.log').write_text(r.stderr)
    summary=r.stderr.rsplit('Summary:',1)[-1]
    loudness=float(re.search(r'\bI:\s+(-?[\d.]+)\s+LUFS',summary)[1])
    peak=float(re.search(r'Peak:\s+(-?[\d.]+)\s+dBFS',summary)[1])
    assert -19.5<=loudness<=-16.5,(loudness,'unexpected loudness')
    assert peak<=-.2,(peak,'clipping risk')
    shots=[1,4.5,6.5,9.5,11,12.7,14.6,18,21]
    thumbs=[]
    for i,t in enumerate(shots):
        dest=OUT/f'decoded-{i}.png';run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(MOVIE),'-frames:v','1',str(dest)])
        im=Image.open(dest).convert('RGB');im.thumbnail((640,268));thumbs.append(im.copy())
    board=Image.new('RGB',(1920,3*300),(12,17,22));draw=ImageDraw.Draw(board)
    for i,im in enumerate(thumbs):
        x=(i%3)*640;y=(i//3)*300;board.paste(im,(x,y));draw.text((x+14,y+274),f'{shots[i]:04.1f}s / actual MP4 decoded frame',fill=(210,214,219))
    board.save(BASE/'stills/contact.jpg',quality=92)
    for i,name in [(0,'vehicle'),(4,'portrait'),(7,'hero')]:
        Image.open(OUT/f'decoded-{i}.png').convert('RGB').save(BASE/f'stills/{name}.jpg',quality=93)
    result={'width':v['width'],'height':v['height'],'fps':v['r_frame_rate'],'decoded_frames':int(v['nb_read_frames']),'duration':p['format']['duration'],'full_decode':True,'unexpected_black_frames':False,'one_second_freezes':False,'sample_rate':a['sample_rate'],'channels':a['channels'],'integrated_lufs':loudness,'true_peak_dbfs':peak}
    (OUT/'video-check.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['audio','encode','check']);a=p.parse_args();globals()[a.mode]()
