"""Validate the staged tree without ignored files, local media or dependencies."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ['scripts/check_transformer_contract.py',
            'series/变形金刚系列/01-擎天柱-电影版/production.json', '--require-ready']


def git(cwd, *args):
    return subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True)


def check():
    with tempfile.TemporaryDirectory(prefix='recreation-publish-') as directory:
        target = Path(directory)
        git(ROOT, 'checkout-index', '--all', '--prefix', str(target) + '/')
        git(target, '-c', 'init.defaultBranch=main', 'init', '-q')
        # Preserve forced additions too, so the checks can detect ignored paths in the original index.
        git(target, 'add', '--force', '--all')
        commands = {
            'repository': ['scripts/check_repo.py'],
            'unitTests': ['-m', 'unittest', 'discover', '-s', 'tests', '-v'],
            'characterLibrary': ['series/变形金刚系列/tools/characters.py', 'check'],
            'productionContract': CONTRACT,
        }
        report = {'source': 'Git index (staged snapshot)', 'checks': {}}
        for name, args in commands.items():
            result = subprocess.run([sys.executable, *args], cwd=target, capture_output=True, text=True)
            report['checks'][name] = result.returncode == 0
            if result.returncode:
                print((result.stdout + result.stderr)[-5000:], file=sys.stderr)
        strict = subprocess.run([sys.executable, *CONTRACT, '--require-local-media'], cwd=target,
                                capture_output=True, text=True)
        report['strictMediaGateRejectsMissingSources'] = strict.returncode != 0
        report['fileCount'] = git(target, 'ls-files', '-z').stdout.count(b'\0')
        passed = all(report['checks'].values()) and report['strictMediaGateRejectsMissingSources']
        report['result'] = 'passed' if passed else 'failed'
        return report


if __name__ == '__main__':
    try:
        result = check()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(result['result'] != 'passed')
    except (OSError, subprocess.CalledProcessError) as error:
        print('暂存快照检查失败：' + str(error), file=sys.stderr)
        raise SystemExit(1)
