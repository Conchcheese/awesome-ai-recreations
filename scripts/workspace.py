#!/usr/bin/env python3
"""Locate local storage and attach a project's artifact path to its run directory."""
import argparse
from pathlib import Path
import os

from catalog import ROOT, get_case, load_catalog
from task_inputs import safe_task_path

DIRECTORIES = ('input-packs', 'projects', 'references', 'runs', 'deliveries', 'runtime', 'archive')


def run_paths(root, case, variant):
    readme = Path(variant['readme'])
    project = readme.parent
    if project.parts[:1] != ('series',) or len(project.parts) < 3:
        raise ValueError('成果说明必须位于 series/ 的项目目录')
    if project.parts[2] == 'models' and len(project.parts) > 3:
        key = Path(*project.parts[3:])
    else:
        key = Path(variant['id'], case['id'])
    run = Path('local/runs', case['series'], key)
    return safe_task_path(root, project.as_posix()) / 'artifacts', safe_task_path(root, run.as_posix())


def prepare_run(root, case, variant):
    entry, destination = run_paths(root, case, variant)
    if entry.is_symlink():
        if entry.resolve() != destination:
            raise ValueError('项目 artifacts/ 已指向其他位置')
        destination.mkdir(parents=True, exist_ok=True)
        return destination
    if entry.exists():
        if not entry.is_dir() or destination.exists():
            raise ValueError('发现已有产物，拒绝覆盖或自动合并')
        destination.parent.mkdir(parents=True, exist_ok=True)
        entry.rename(destination)
        try:
            entry.symlink_to(os.path.relpath(destination, entry.parent), target_is_directory=True)
        except OSError:
            destination.rename(entry)
            raise
    else:
        destination.mkdir(parents=True, exist_ok=True)
        entry.symlink_to(os.path.relpath(destination, entry.parent), target_is_directory=True)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('case', nargs='?', help='案例 ID 或别名')
    parser.add_argument('--variant', help='成果版本 ID')
    parser.add_argument('--prepare', action='store_true', help='建立项目到中心产物目录的本地链接')
    args = parser.parse_args()
    try:
        if not args.case:
            if args.variant or args.prepare:
                parser.error('--variant / --prepare 需要案例')
            for folder in DIRECTORIES:
                print('local/' + folder + '/')
            return
        if not args.variant:
            parser.error('查询成果的产物位置需要 --variant')
        case, variant = get_case(load_catalog(), args.case, args.variant)
        entry, destination = run_paths(ROOT, case, variant)
        if args.prepare:
            prepare_run(ROOT, case, variant)
        print('产物入口 ' + str(entry.relative_to(ROOT)))
        print('中心目录 ' + str(destination.relative_to(ROOT)))
        if variant.get('movie'):
            print('成片 ' + variant['movie'])
    except (OSError, ValueError, KeyError) as error:
        parser.error(str(error))


if __name__ == '__main__':
    main()
