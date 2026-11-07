"""Validate the staged Git snapshot without local media, dependencies or caches. No network."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]

def check():
 target=Path(tempfile.mkdtemp(prefix='recreation-publish-'));report={'source':'Git index (staged snapshot)','checks':{}}
 try:
  subprocess.run(['git','checkout-index','--all','--prefix',str(target)+'/'],cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  subprocess.run(['git','-c','init.defaultBranch=main','init','-q',str(target)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  commands={'repository':['scripts/check_repo.py'],'unitTests':['-m','unittest','discover','-s','tests','-v'],'characterLibrary':['series/变形金刚系列/tools/characters.py','check'],'productionContract':['scripts/check_transformer_contract.py','series/变形金刚系列/01-擎天柱-电影版/production.json','--require-ready']}
  for name,args in commands.items():
   result=subprocess.run([sys.executable,*args],cwd=target,capture_output=True,text=True);report['checks'][name]=result.returncode==0
   if result.returncode:print((result.stdout+result.stderr)[-5000:],file=sys.stderr)
  args=commands['productionContract']+['--require-local-media'];strict=subprocess.run([sys.executable,*args],cwd=target,capture_output=True,text=True);report['strictMediaGateRejectsMissingSources']=strict.returncode!=0
  files=[p for p in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=target).decode().split('\0') if p];report['fileCount']=len(files);report['excludedDirectoryLeaks']=[p for p in files if any(x in Path(p).parts for x in ['local','private','artifacts','node_modules','__pycache__'])]
  report['result']='passed' if all(report['checks'].values()) and report['strictMediaGateRejectsMissingSources'] and not report['excludedDirectoryLeaks'] else 'failed';return report
 finally:shutil.rmtree(target)

if __name__=='__main__':
 try:
  result=check();print(json.dumps(result,ensure_ascii=False,indent=2));raise SystemExit(result['result']!='passed')
 except (OSError,subprocess.CalledProcessError) as e:print('暂存快照检查失败：'+str(e),file=sys.stderr);raise SystemExit(1)
