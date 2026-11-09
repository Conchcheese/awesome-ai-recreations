from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from edit import CUTS
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/captions';OUT.mkdir(exist_ok=True)
fonts=[Path('/System/Library/Fonts/Supplemental/Arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),Path('C:/Windows/Fonts/arial.ttf')]
font=next((p for p in fonts if p.exists()),None)
for width,height in [(1920,804),(1600,670),(1280,536)]:
 small=ImageFont.truetype(str(font),max(10,round(width/1920*13))) if font else ImageFont.load_default()
 bold=ImageFont.truetype(str(font),max(12,round(width/1920*16))) if font else ImageFont.load_default()
 for i,cut in enumerate(CUTS):
  image=Image.new('RGBA',(width,height));d=ImageDraw.Draw(image);x=round(width*.036);y=height-round(width*.029)
  d.text((x,y),f'{i+1:02d} / 10',font=small,fill=(198,176,145,205));d.text((x+round(width*.067),y-1),cut[4],font=bold,fill=(225,221,210,220))
  label='OPTIMUS PRIME / 2007';box=d.textbbox((0,0),label,font=small);d.text((width-x-box[2],round(width*.022)),label,font=small,fill=(180,185,183,160))
  image.save(OUT/f'{width}-{i:02d}.png')
print('Cinematic caption assets generated')
