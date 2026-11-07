"""Portable Blender launcher. Set BUMBLEBEE_BLENDER_BIN or put Blender on PATH."""
import argparse, os, shutil, subprocess
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['check','build','preflight','render']);p.add_argument('--width',type=int,default=1920);p.add_argument('--samples',type=int,default=12);p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=528);a=p.parse_args()
    blender=os.environ.get('BUMBLEBEE_BLENDER_BIN') or shutil.which('blender')
    if not blender or not Path(blender).is_file():p.error('Install Blender 4.5 and set BUMBLEBEE_BLENDER_BIN to the executable, or add blender to PATH.')
    subprocess.run([blender,'--background','--factory-startup','--python',str(BASE/'src/scene.py'),'--','--mode',a.mode,'--width',str(a.width),'--samples',str(a.samples),'--start',str(a.start),'--end',str(a.end)],check=True)
    if a.mode=='build':subprocess.run(['node',str(BASE/'tools/build.mjs')],cwd=BASE,check=True)
