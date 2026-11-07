"""Original hybrid score and physically timed mechanical effects. No sampled film audio."""
from pathlib import Path
import wave,numpy as np
from edit import movie_at,DURATION
ROOT=Path(__file__).resolve().parents[1];SR=48000;N=int(DURATION*SR);rng=np.random.default_rng(20076301);audio=np.zeros((N,2),dtype=float)
def put(start,sound,pan=0):
 i=max(0,int(start*SR));end=min(N,i+len(sound))
 if end<=i:return
 audio[i:end,0]+=sound[:end-i]*np.sqrt((1-pan)/2);audio[i:end,1]+=sound[:end-i]*np.sqrt((1+pan)/2)
def noise(length,window):
 r=rng.normal(0,1,int(length*SR));return np.convolve(r,np.ones(window)/window,'same')
def impact(at,strength=.12,pan=0):
 x=np.arange(int(1.1*SR))/SR;s=np.sin(2*np.pi*(44*x+15*x*np.exp(-x*5)))*np.exp(-x*8)*strength
 s+=noise(1.1,4)*np.exp(-x*53)*strength*.8
 for f,k in [(197,.12),(431,.07),(1060,.028)]:s+=np.sin(2*np.pi*f*x)*np.exp(-x*11)*strength*k
 put(at,s,pan)
def servo(at,length=.65,pan=0,level=.035):
 x=np.arange(int(length*SR))/SR;env=np.sin(np.pi*x/length)**1.7
 s=(np.sin(2*np.pi*(95*x+155*x*x/length))+.5*np.sin(2*np.pi*233*x))*level+noise(length,19)*level*4
 put(at,s*env,pan)
def air_rise(at,length,pan=0,level=.012):
 x=np.arange(int(length*SR))/SR;white=rng.normal(0,1,len(x));high=white-np.convolve(white,np.ones(17)/17,'same')
 env=np.sin(np.pi*x/length)**1.7*(.3+.7*x/length)
 put(at,(high*.30+noise(length,95)*2.2)*env*level,pan)
# Slow harmonic movement, D minor with a low brass-like industrial envelope.
for start,root,length in [(0,36.708,6),(4,29.135,7),(10.5,36.708,5.2),(15,43.654,5),(19,32.703,5.5),(23,36.708,5)]:
 x=np.arange(int(length*SR))/SR;env=np.minimum(x/.7,1)*np.minimum((length-x)/.7,1)
 chord=np.zeros_like(x)
 for ratio,phase,amp in [(1,0,.019),(2,.3,.018),(3,1.0,.009),(4,.6,.006),(5.946,.4,.004)]:chord+=np.sin(2*np.pi*root*ratio*x+phase)*amp
 chord=np.tanh(chord*3)*.34;put(start,chord*env,-.22);put(start+.009,chord*env,.22)
# Tactile restrained pulses, with space left for component detail.
for i in range(32):
 at=4+i*.625
 if at>27:break
 x=np.arange(int(.25*SR))/SR;put(at,np.sin(2*np.pi*(55*x+6*(1-np.exp(-x*18))))*np.exp(-x*22)*(.045 if i%4 else .09))
# Sparse midrange ostinato survives small speakers; details retain quiet intervals.
for section,end in [(4.0,10.2),(20.0,24.7)]:
 for i,at in enumerate(np.arange(section,end,.3125)):
  frequency=[146.832,220.0,174.614,130.813][i%4];x=np.arange(int(.46*SR))/SR
  env=(1-np.exp(-x*85))*np.exp(-x*12)
  note=(np.sin(2*np.pi*frequency*x)+.24*np.sin(2*np.pi*frequency*2*x)+.09*np.sin(2*np.pi*frequency*4*x))*.014
  put(float(at),note*env,(-.32 if i%2 else .32))
# Air and a short brass-like swell lead into the two major lock/reveal beats.
for at,length in [(8.7,2.3),(23.35,1.65)]:
 air_rise(at,length,-.45,.025);air_rise(at+.018,length,.45,.020)
 x=np.arange(int(length*SR))/SR;fundamental=73.416
 brass=sum(np.sin(2*np.pi*fundamental*h*x+.1*h)/h**1.4 for h in range(1,9))
 put(at,np.tanh(brass*1.5)*np.sin(np.pi*x/length)**2*.031)
# Engine and air pressure establish the truck before transformation.
x=np.arange(4*SR)/SR;engine=(np.sin(2*np.pi*47*x)+.4*np.sin(2*np.pi*94.8*x))*.045+noise(4,90)*.14;put(0,engine*np.sin(np.pi*x/4)**.6)
# Timing comes from the same authored rig phases, retimed into the 28-second edit.
for i,p in enumerate([.07,.14,.24,.35,.45,.56,.67,.78,.89,1]):
 at=4+p*7;servo(max(0,at-.60),.65,(-1 if i%2 else 1)*.55,.026);impact(at,.10 if i<9 else .19,(-1 if i%2 else 1)*.4)
impact(11,.24);servo(13.6,.8,-.2,.025);impact(14.5,.065)
servo(16,.65,.45,.035);x=np.arange(int(.95*SR))/SR;put(16.9,np.sin(2*np.pi*(210*x+190*x*x))*np.sin(np.pi*x/.95)**2*.024,.45);impact(17,.11,.5)
for at,pan in [(18.6,-.4),(19.15,.4),(20.2,-.6),(20.8,.6),(21.4,-.3),(22,.3)]:servo(at,.40,pan,.019);impact(at+.28,.05,pan)
# Reassembly comes in converging layers and lands on the final hero beat.
for i in range(7):servo(23+i*.22,.38,(i%2-.5)*.7,.021);impact(23.25+i*.22,.07,(i%2-.5)*.6)
impact(25,.24)
x=np.arange(3*SR)/SR;put(25,(np.sin(2*np.pi*36.708*x)*.08+np.sin(2*np.pi*73.416*x)*.03+np.sin(2*np.pi*110.124*x)*.02)*np.exp(-x*.8))
# Gentle, click-free edges; intensity normalization happens during final encode.
t=np.arange(N)/SR;audio*=np.minimum(t/.08,1)[:,None]*np.minimum((DURATION-t)/.65,1)[:,None];audio=np.tanh(audio*2)*.82
out=ROOT/'artifacts/original-cinematic-score.wav'
with wave.open(str(out),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((audio*32767).astype('<i2').tobytes())
print('28 seconds / 48 kHz stereo / original score and mechanical sound design')
