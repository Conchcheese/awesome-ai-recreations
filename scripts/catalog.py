#!/usr/bin/env python3
"""Read-only case discovery. No dependencies, API keys, or shell execution."""
import argparse
import json
from pathlib import Path
import shlex
import re
import unicodedata
import hashlib
import shutil

ROOT = Path(__file__).resolve().parents[1]


def safe_task_path(root, value):
    root = Path(root).resolve()
    path = Path(value)
    if path.is_absolute() or '..' in path.parts or re.match(r'^[A-Za-z]:', str(value)):
        raise ValueError('共同输入路径越界')
    cursor = root
    for part in path.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise ValueError('共同输入不得经过符号链接：' + str(value))
    if not cursor.resolve().is_relative_to(root):
        raise ValueError('共同输入路径越界')
    return cursor


def load_catalog(root=ROOT):
    root = Path(root)
    data = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
    if data.get('schema_version') == 2:
        index = json.loads(safe_task_path(root,'tasks/index.json').read_text(encoding='utf-8'))
        by_manifest = {c['task_manifest']: c for c in data['cases']}
        if set(by_manifest) - set(index['tasks']):
            raise ValueError('成果索引指向未登记的共同任务')
        for value in index['tasks']:
            task = json.loads(safe_task_path(root,value).read_text(encoding='utf-8'))
            case = by_manifest.get(value)
            if case is None:
                case = {k: task[k] for k in ['id', 'title', 'aliases', 'series']}
                case.update(task_manifest=value, variants=[], task_only=True)
                data['cases'].append(case)
            case['prompt'] = task['brief']
            case['recreation'] = {'references': [r['path'] for r in task['references']], 'notes': task['notes']}
            if all(r.get('source_url') for r in task['references']):
                case['recreation']['reference_manifest'] = value
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
    variant = next((v for v in case['variants'] if v['id'] == variant_id), None)
    if variant is None:
        raise ValueError(f'{case_id} 没有版本 {variant_id}')
    return case, variant


def recreation_plan(case):
    """Expose only inputs for a new recreation, separate from existing implementations."""
    plan = {
        'case_id': case['id'],
        'title': case['title'],
        'prompt': case['prompt'],
        'method': 'docs/精细复刻流程.md',
        'source_notes': 'docs/参考素材与许可.md',
        'resources': 'docs/共同输入与资源.md',
        'defaults': {'visual_goal': 'fidelity', 'provenance': 'independent'},
        'references': case['recreation']['references'],
        'notes': case['recreation']['notes'],
    }
    if case.get('task_manifest'):
        plan['task_manifest'] = case['task_manifest']
    if case['recreation'].get('reference_manifest'):
        plan['reference_manifest'] = case['recreation']['reference_manifest']
        plan['reference_distribution'] = '参考文件以本地实际可用情况为准；缺失时按来源清单获取并记录后再进行视觉测量。'
    return plan


def export_inputs(case, destination, root=ROOT):
    """Copy only explicitly allowed inputs; never recurse into implementation folders."""
    root = Path(root).resolve()
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise ValueError('输入包目录已存在，拒绝覆盖')
    if case.get('task_manifest'):
        from check_repo import validate_task
        errors = validate_task(case, root)
        if errors:
            raise ValueError('; '.join(errors))
    plan = recreation_plan(case)
    paths = [plan[k] for k in ['prompt', 'method', 'source_notes', 'resources']]
    paths += ['docs/对照复刻约定.md', 'docs/通用基础与约定.md', 'templates/spec.md']
    if plan.get('task_manifest'):
        paths.append(plan['task_manifest'])
    if plan.get('reference_manifest'):
        paths.append(plan['reference_manifest'])
    paths += plan['references']
    available_remotely = set()
    if plan.get('task_manifest'):
        task = json.loads((root/plan['task_manifest']).read_text(encoding='utf-8'))
        available_remotely = {row['path'] for row in task['references'] if row.get('source_url')}
    elif plan.get('reference_manifest'):
        available_remotely = set(plan['references'])
    files, missing = [], []
    for value in dict.fromkeys(paths):
        relative = Path(value)
        source = root / relative
        if relative.is_absolute() or '..' in relative.parts or not source.resolve().is_relative_to(root):
            raise ValueError('输入路径越界')
        if source.is_dir():
            raise ValueError('输入必须是明确文件，不能递归复制目录')
        if not source.is_file():
            if value in available_remotely:
                missing.append(value)
                continue
            raise ValueError('缺少输入文件: ' + value)
        files.append((value, source))
    destination.mkdir(parents=True)
    try:
        inventory = []
        for value, source in files:
            target = destination / value
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            inventory.append({'path': value, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
        payload = {'task': plan, 'files': inventory, 'missing_media': missing,
                   'boundary': 'Only these files are shared inputs. Links do not grant access to unexported results or code.'}
        (destination/'inputs.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        (destination/'TASK.md').write_text('# 独立复刻输入包\n\n先读 inputs.json 中的任务、资源约定和允许文件，所有路径相对本目录。\n只使用包内文件与资源约定允许的第三方资源，自行决定结构、算法、参数和工具。未导出的已有实现、过程、规格及截图不是输入；不要沿链接获取它们。\n若 missing_media 非空，按清单原始来源获取并记录后再进行视觉复刻；不得用结果图补缺。\n输出写到独立目录，记录实际执行条件和未知项。\n', encoding='utf-8')
    except Exception:
        shutil.rmtree(destination)
        raise
    return payload


def main():
    parser = argparse.ArgumentParser(description='查询复刻任务、案例路径和重建命令；只展示信息，不执行任务')
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('list', help='列出全部案例与实现版本')
    show = sub.add_parser('show', help='显示一个案例或特定版本')
    show.add_argument('case_id', help='案例 ID、名称或别名')
    show.add_argument('--variant')
    show.add_argument('--json', action='store_true', help='输出结构化信息')
    recreate = sub.add_parser('recreate', help='按名称定位新复刻任务，只展示允许的参考输入')
    recreate.add_argument('case_id', help='案例 ID、名称或别名，例如机械章鱼')
    recreate.add_argument('--json', action='store_true', help='输出结构化任务入口')
    recreate.add_argument('--export', type=Path, help='导出仅含共同输入的新目录，不覆盖已有目录')
    args = parser.parse_args()
    data = load_catalog()
    if args.action == 'list':
        for c in data['cases']:
            versions = ', '.join(v['id'] for v in c['variants']) or '共同任务就绪，尚无成果'
            print(f"{c['id']:12} {c['title']}  [{versions}]")
        return
    try:
        case, variant = get_case(data, args.case_id, getattr(args, 'variant', None))
    except ValueError as error:
        parser.error(str(error))
    if args.action == 'recreate':
        if args.export:
            try:
                payload = export_inputs(case, args.export)
            except (ValueError, OSError) as error:
                parser.error(str(error))
            print(f'已导出 {len(payload["files"])} 个输入文件；缺少媒体 {len(payload["missing_media"])} 个。入口：{args.export}/TASK.md')
            return
        plan = recreation_plan(case)
        if args.json:
            print(json.dumps(plan, ensure_ascii=False, indent=2))
            return
        print(f"{plan['title']} ({plan['case_id']}) · 新建复刻")
        print('默认：对齐参考、独立实现；用户另有要求时按要求执行。')
        for field in ['prompt', 'method', 'source_notes', 'resources']:
            print(f'{field}: {plan[field]}')
        print('允许的参考媒体（逐个打开，不读取同目录其他文件）：')
        for ref in plan['references']:
            print('  ' + ref)
        if plan.get('reference_manifest'):
            print('原始媒体来源清单：' + plan['reference_manifest'])
            print(plan['reference_distribution'])
        print('参考范围：' + plan['notes'])
        print('另建目录，按任务书完成灰模、动作、材质与验证，持续执行到可运行交付。')
        print('已有版本的代码/HTML/规格/截图不属于这些输入。重建或修改已有版本用 show。')
        return
    if not case['variants'] and not args.json:
        print('此案例只有共同任务，尚无已登记成果；请用 recreate 开始独立复刻。')
        return
    if args.json:
        print(json.dumps(variant or case, ensure_ascii=False, indent=2))
        return
    print(f"{case['title']} ({case['id']})\n复刻任务书：{case['prompt']}")
    print('以下命令从仓库根目录开始；首次安装见 docs/快速开始.md。')
    for v in [variant] if variant else case['variants']:
        print(f"\n[{v['id']}] {v['model_label']} | {v['provenance']} | {v['visual_goal']}")
        for field in ['readme', 'live', 'film', 'source', 'spec', 'record']:
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
