"""Deterministic original score. Metadata comes from model.js via video.mjs."""
from pathlib import Path
import math, random, struct, wave, json, sys
if len(sys.argv)!=2:
    raise SystemExit('通过 node tools/video.mjs 运行；时长与拍点来自 model.js。')
meta=json.loads(sys.argv[1])
DURATION=meta['duration'];BEATS=meta['beats'];JETS=meta['jetWindows']
if not isinstance(DURATION,int) or not 1<=DURATION<=300 or not BEATS or not all(isinstance(t,(int,float)) and 0<=t<DURATION for t in BEATS):
    raise SystemExit('无效的时长或拍点')
RATE=48000
OUT=Path(__file__).resolve().parents[1]/'artifacts/oc8-v2-score.wav'
OUT.parent.mkdir(parents=True,exist_ok=True)
rng=random.Random(6102);noise=0.;samples=bytearray()
CHORDS=[(55,82.4069,110,164.8138),(49,73.4162,98,146.8324),(43.6535,65.4064,87.3071,130.8128),(55,82.4069,110,164.8138)]
for i in range(RATE*DURATION):
    t=i/RATE;edge=max(0,min(1,t/1.2,(DURATION-t)/1.8))
    section=t/(DURATION/4);index=min(3,int(section));blend=min(1,max(0,(section-index)*DURATION/4-12)/3)
    def chord(ch):
        return sum(math.sin(2*math.pi*f*t+.07*math.sin(t*.3))*a for f,a in zip(ch,[.065,.032,.022,.010]))
    pad=chord(CHORDS[index])*(1-blend)+chord(CHORDS[min(3,index+1)])*blend
    noise=.96*noise+.04*rng.uniform(-1,1)
    jet=max([max(0,min(1,(t-a)/.6,(b-t)/.6)) for a,b in JETS]+[0])
    pulse=.014*math.sin(2*math.pi*42*t)*math.exp(-((t*1.8)%1)*11)*jet
    mechanical=0.
    for beat in BEATS:
        d=t-beat
        if 0<=d<1.0:
            mechanical+=.020*math.exp(-d*6)*math.sin(2*math.pi*(290*d-65*d*d))
            mechanical+=noise*.12*math.sin(math.pi*d)**2
    value=(pad+pulse+mechanical+jet*noise*.04)*edge
    pan=.06*math.sin(t*.4)
    samples.extend(struct.pack('<hh',int(max(-1,min(1,value*(1-pan)))*32767),int(max(-1,min(1,value*(1+pan)))*32767)))
with wave.open(str(OUT),'wb') as out:
    out.setnchannels(2);out.setsampwidth(2);out.setframerate(RATE);out.writeframes(samples)
print(f'原创音轨：48 kHz / stereo / {DURATION} s → artifacts/oc8-v2-score.wav')
