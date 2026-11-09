#!/usr/bin/env python3
"""Discover cases and manage portable input packs using the standard library."""
import argparse
import json
from pathlib import Path
import re
import shlex
import unicodedata

from task_inputs import (
    ROOT, export_inputs, freeze_tasks, load_tasks, prepare_task, recreation_plan, require_lock,
    task_lock, verify_pack,
)


def load_catalog(root=ROOT):
    root = Path(root)
    data = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
    if data.get('schema_version') == 2:
        tasks = {case['task_manifest']: case for case in load_tasks(root)['cases']}
        published = set()
        for case in data['cases']:
            path = case['task_manifest']
            if path not in tasks:
                raise ValueError('成果索引指向未登记的共同任务')
            published.add(path)
            case.update({key: tasks[path][key] for key in ('prompt', 'recreation', 'task')})
        data['cases'].extend(case for path, case in tasks.items() if path not in published)
    return data


def normalize_name(value):
    return re.sub(r'[\s_-]+', '', unicodedata.normalize('NFKC', value).casefold())


def get_case(data, case_id, variant_id=None):
    query = normalize_name(case_id)
    matches = [c for c in data['cases'] if query in {
        normalize_name(n) for n in [c['id'], c['title'], *c.get('aliases', [])]
    }]
    if not matches:
        raise ValueError(f'没有案例 {case_id}；用 list 查看可用 ID')
    if len(matches) > 1:
        raise ValueError(f'案例名称不唯一：{case_id}；请使用案例 ID')
    case = matches[0]
    if variant_id is None:
        return case, None
    variant = next((v for v in case['variants'] if variant_id in (v['id'], *v.get('aliases', []))), None)
    if variant is None:
        raise ValueError(f'{case_id} 没有版本 {variant_id}')
    return case, variant


def main():
    parser = argparse.ArgumentParser(description='查询任务和成果，导出或校验共同输入包')
    sub = parser.add_subparsers(dest='action', required=True)
    listing = sub.add_parser('list', help='列出全部案例与实现版本')
    listing.add_argument('--tasks', action='store_true', help='只列共同任务，不读取成果索引')
    show = sub.add_parser('show', help='显示一个案例或特定版本')
    show.add_argument('case_id', help='案例 ID、名称或别名')
    show.add_argument('--variant')
    show.add_argument('--json', action='store_true', help='输出结构化信息')
    recreate = sub.add_parser('recreate', help='按名称定位新复刻任务，只展示允许的参考输入')
    recreate.add_argument('case_id', help='案例 ID、名称或别名，例如机械章鱼')
    recreate.add_argument('--json', action='store_true', help='输出结构化任务入口')
    recreate.add_argument('--export', type=Path, help='导出仅含共同输入的新目录，不覆盖已有目录')
    recreate.add_argument('--require-complete', action='store_true', help='缺少原始媒体时拒绝导出')
    verify = sub.add_parser('verify', help='核验完整输入包，不读取成果索引')
    verify.add_argument('pack', type=Path)
    verify.add_argument('--expect', help='比对发布者给出的 input_sha256')
    sub.add_parser('freeze', help='锁定新任务或已提升版本的共同输入')
    args = parser.parse_args()
    try:
        if args.action == 'verify':
            print('完整输入包 SHA-256：' + verify_pack(args.pack, args.expect))
            return
        if args.action == 'freeze':
            print(f'已锁定 {freeze_tasks()} 个共同任务')
            return
        tasks_only = args.action == 'recreate' or (args.action == 'list' and args.tasks)
        data = load_tasks() if tasks_only else load_catalog()
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.error(str(error))
    if args.action == 'list':
        for c in data['cases']:
            if args.tasks:
                print(f"{c['id']:12} {c['title']}  [输入 v{c['task']['input_version']}]")
                continue
            versions = ', '.join(v['id'] for v in c['variants']) or '共同任务就绪，尚无成果'
            print(f"{c['id']:12} {c['title']}  [{versions}]")
        return
    try:
        case, variant = get_case(data, args.case_id, getattr(args, 'variant', None))
    except ValueError as error:
        parser.error(str(error))
    if args.action == 'recreate':
        if args.require_complete and not args.export:
            parser.error('--require-complete 需与 --export 一起使用')
        if args.export:
            try:
                payload = export_inputs(case, args.export, require_complete=args.require_complete)
            except (ValueError, OSError, KeyError, TypeError) as error:
                parser.error(str(error))
            missing = len(payload['missing_media'])
            print(f'已导出 {len(payload["files"]) - missing} 个输入文件；缺少媒体 {missing} 个。入口：{args.export}/TASK.md')
            print('共同输入 SHA-256：' + payload['input_sha256'])
            return
        try:
            task, files, missing = prepare_task(case, ROOT)
            require_lock(task, files, ROOT)
        except (ValueError, OSError, KeyError, TypeError) as error:
            parser.error(str(error))
        plan = {**recreation_plan(case), **task_lock(task, files), 'missing_media': missing}
        if args.json:
            print(json.dumps(plan, ensure_ascii=False, indent=2))
            return
        print(f"{plan['title']} ({plan['case_id']}) · 新建复刻")
        print(f"共同输入 v{plan['input_version']} · SHA-256 {plan['input_sha256']}")
        print('默认：对齐参考、独立实现；用户另有要求时按要求执行。')
        for field in ['prompt', 'method', 'source_notes', 'resources']:
            print(f'{field}: {plan[field]}')
        print('允许的参考媒体（逐个打开，不读取同目录其他文件）：')
        for ref in plan['references']:
            print('  ' + ref + (' [待取材]' if ref in missing else ''))
        if plan.get('reference_manifest'):
            print('原始媒体来源清单：' + plan['reference_manifest'])
            print(plan['reference_distribution'])
        print('参考范围：' + plan['notes'])
        print('在包外的独立目录完成任务书要求，自行选用方法与工具并验证交付。')
        print('已有版本的代码/HTML/规格/截图不属于这些输入。重建或修改已有版本用 show。')
        return
    if not case['variants'] and not args.json:
        print('此案例只有共同任务，尚无已登记成果；请用 recreate 开始独立复刻。')
        return
    if args.json:
        print(json.dumps(variant or {k: v for k, v in case.items() if k != 'task'}, ensure_ascii=False, indent=2))
        return
    print(f"{case['title']} ({case['id']})\n复刻任务书：{case['prompt']}")
    print('以下命令从仓库根目录开始；首次安装见 docs/快速开始.md。')
    for v in [variant] if variant else case['variants']:
        print(f"\n[{v['id']}] {v['model_label']} | {v['provenance']} | {v['visual_goal']}")
        for field in ['readme', 'live', 'film', 'source', 'spec', 'record']:
            print(f"{field}: {v[field]}")
        for field in ['online_live', 'online_film', 'movie', 'score']:
            if v.get(field):
                print(f"{field}: {v[field]}")
        print('参考：' + ', '.join(v['references']))
        print('构建产物：' + ', '.join(v['build_outputs']))
        print('命令（每个代码块独立从仓库根目录执行）：')
        for action, steps in v['commands'].items():
            print(f'\n# {action}\n(cd {shlex.quote(v["cwd"])} && ' +
                  ' && '.join(shlex.join(step) for step in steps) + ')')
        print('说明：' + v['notes'])


if __name__ == '__main__':
    main()
