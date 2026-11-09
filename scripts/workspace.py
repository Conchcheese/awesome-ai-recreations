#!/usr/bin/env python3
"""Locate local storage and attach a project's artifact path to its run directory."""
import argparse
from pathlib import Path
import os
import re

from catalog import ROOT, get_case, load_catalog
from task_inputs import safe_task_path

DIRECTORIES = ('cases', 'research', 'runtime', 'archive')


def local_variant(root, case, variant):
    return safe_task_path(root, Path('local/cases', case['id'], 'models', variant['id']).as_posix())


def run_paths(root, case, variant):
    project = Path('cases', case['id'], 'models', variant['id'])
    if Path(variant['readme']).parent != project:
        raise ValueError('成果说明须位于对应的案例版本目录')
    entry = safe_task_path(root, project.as_posix()) / 'artifacts'
    return entry, local_variant(root, case, variant) / 'runs'


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
        catalog = load_catalog()
        case, _ = get_case(catalog, args.case)
        try:
            _, variant = get_case(catalog, args.case, args.variant)
        except ValueError:
            if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.variant):
                raise
            local = local_variant(ROOT, case, {'id': args.variant})
            if not local.is_dir():
                raise
            if args.prepare:
                raise ValueError('本地专有工程已在中心目录；--prepare 用于已登记的 Git 工程')
            for title, kind in (('工程', 'project'), ('运行产物', 'runs'), ('本地交付', 'deliveries')):
                print(title + ' ' + str((local / kind).relative_to(ROOT)))
            return
        entry, destination = run_paths(ROOT, case, variant)
        if args.prepare:
            prepare_run(ROOT, case, variant)
        print('产物入口 ' + str(entry.relative_to(ROOT)))
        print('中心目录 ' + str(destination.relative_to(ROOT)))
        print('本地交付 ' + str((local_variant(ROOT, case, variant) / 'deliveries').relative_to(ROOT)))
        if variant.get('movie'):
            print('成片 ' + variant['movie'])
    except (OSError, ValueError, KeyError) as error:
        parser.error(str(error))


if __name__ == '__main__':
    main()
