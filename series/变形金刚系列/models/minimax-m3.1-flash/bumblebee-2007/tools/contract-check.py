#!/usr/bin/env python3
"""Run the repository transformer contract checker against this case.

The repository checker lives outside the case directory, so the case ships a
small wrapper that keeps the catalog command entry self contained.
"""

import subprocess
import sys
from pathlib import Path

CASE = Path(__file__).resolve().parents[1]


def find_repo():
    """Walk up until the repository checker is found, so the case can live at
    any depth inside the series."""
    for parent in CASE.parents:
        if (parent / 'scripts' / 'check_transformer_contract.py').is_file():
            return parent
    raise SystemExit('找不到仓库根目录（未找到 scripts/check_transformer_contract.py）')


REPO = find_repo()
CHECKER = REPO / 'scripts' / 'check_transformer_contract.py'


def main():
    if not CHECKER.exists():
        raise SystemExit(f'找不到仓库契约检查器: {CHECKER}')
    cmd = [sys.executable, str(CHECKER), str(CASE / 'production.json'), '--require-ready']
    result = subprocess.run(cmd)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
