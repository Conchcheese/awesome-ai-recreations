"""Load, freeze, export and verify the inputs of independent recreations."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
INDEX = 'cases/index.json'
OLD_INDEX = 'tasks/index.json'
LOCK = 'cases/inputs.lock.json'
OLD_LOCK = 'tasks/inputs.lock.json'
DEFAULTS = {'visual_goal': 'fidelity', 'provenance': 'independent'}
LEGACY = {
    'method': 'docs/精细复刻流程.md',
    'resources': 'docs/共同输入与资源.md',
    'source_notes': 'docs/参考素材与许可.md',
}
SHARED = {
    'method': 'cases/_shared/制作与验收.md',
    'resources': 'cases/_shared/执行边界.md',
    'source_notes': 'cases/_shared/原始参考.md',
}
MEDIA = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov'}
ORIGINAL = {'original-reference', 'original-frame', 'original-film-frame', 'original-vfx-frame'}
CASE_ID = r'[a-z0-9]+(?:-[a-z0-9]+)*'
MANIFEST_PATH = rf'(?:cases/{CASE_ID}/task|tasks/{CASE_ID})/input\.json'


def task_prefix(case_id, manifest):
    return f'tasks/{case_id}/' if manifest.startswith('tasks/') else f'cases/{case_id}/task/'


def shared_paths(task, manifest):
    if task.get('schema_version') != 2:
        return LEGACY
    if manifest.startswith('tasks/'):
        return {key: value.replace('cases/', 'tasks/', 1) for key, value in SHARED.items()}
    return SHARED


def index_path(root):
    return INDEX if safe_task_path(root, INDEX).exists() or not safe_task_path(root, OLD_INDEX).exists() else OLD_INDEX
START = """# 独立复刻输入包

从 inputs.json 的 task.prompt 开始，按该任务的需求、目标、验收和资源边界独立完成。
按 task.method 阅读通用方法，按 task.resources 确认工具和输入范围。
仅使用清单中的共同输入和约定允许的外部资源。链接指向的其他文件不自动成为输入。

分发前运行 catalog.py verify，确认原始参考齐全且文件摘要匹配。
缺失媒体见 missing_media，按任务清单的原始来源、路径和 SHA-256 补齐。
将成果写在包外的独立输出目录，记录实际模型、工具、人工介入、输入差异、验证及限制。
"""


def safe_task_path(root, value):
    root = Path(root).resolve()
    path = Path(value)
    if path.as_posix() != value or path.is_absolute() or '..' in path.parts or '\\' in str(value) or ':' in str(value):
        raise ValueError('共同输入路径越界')
    cursor = root
    for part in path.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise ValueError('共同输入不得经过符号链接：' + str(value))
    return cursor


def source_file(root, value):
    """Resolve a task media path from the central local stash or a legacy checkout."""
    logical = safe_task_path(root, value)
    parts = Path(value).parts
    if len(parts) > 5 and parts[0] == 'cases' and parts[2:5] == ('task', 'references', 'local'):
        tail = parts[5:]
    elif len(parts) > 4 and parts[0] == 'tasks' and parts[2:4] == ('references', 'local'):
        tail = parts[4:]
    else:
        return logical
    canonical = safe_task_path(root, Path('local/cases', parts[1], 'references/task', *tail).as_posix())
    previous = safe_task_path(root, Path('local/references/tasks', parts[1], *tail).as_posix())
    for path in (canonical, logical, previous):
        if path.exists():
            return path
    return canonical


def read_json(root, path):
    return json.loads(safe_task_path(root, path).read_text(encoding='utf-8'))


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def file_sha256(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def digest_inventory(files):
    canonical = json.dumps(files, sort_keys=True, separators=(',', ':'))
    return sha256(canonical.encode('utf-8'))


def load_tasks(root=ROOT):
    """Read task manifests without loading the results index or implementation files."""
    manifests = read_json(root, index_path(root))['tasks']
    if not isinstance(manifests, list) or len(manifests) != len(set(manifests)):
        raise ValueError('任务索引必须是无重复路径列表')
    cases = []
    for manifest in manifests:
        if not re.fullmatch(MANIFEST_PATH, manifest):
            raise ValueError('任务索引只能指向案例的 task/input.json')
        task = read_json(root, manifest)
        case = {key: task[key] for key in ('id', 'title', 'aliases', 'series')}
        refs = task['references']
        case.update(task_manifest=manifest, task=task, prompt=task['brief'], variants=[], task_only=True,
                    recreation={'references': [row['path'] for row in refs], 'notes': task['notes']})
        if any(row.get('source_url') for row in refs):
            case['recreation']['reference_manifest'] = manifest
        cases.append(case)
    return {'schema_version': 2, 'cases': cases}


def prepare_task(case, root):
    manifest = case['task_manifest']
    base = task_prefix(case["id"], manifest)
    if manifest != base + 'input.json' or manifest not in read_json(root, index_path(root))['tasks']:
        raise ValueError('任务清单必须登记在案例的 task/input.json')
    raw = safe_task_path(root, manifest).read_bytes()
    task = json.loads(raw)
    if any(task[key] != case[key] for key in ('id', 'title', 'aliases', 'series')):
        raise ValueError('任务身份与索引不一致')
    version = task.get('input_version')
    if task.get('status') != 'ready' or type(version) is not int or version < 1:
        raise ValueError('登记任务必须就绪并有正整数输入版本')
    schema = task.get('schema_version', 1)
    if schema not in (1, 2) or task.get('defaults') != DEFAULTS:
        raise ValueError('任务结构或默认执行条件无效')
    if task['brief'] != base + 'brief.md' or case['prompt'] != task['brief']:
        raise ValueError('任务书必须独立存放')
    shared = shared_paths(task, manifest)
    if any(task.get(key) != value for key, value in shared.items()):
        raise ValueError('共同方法或资源入口不一致')
    refs = task['references']
    recreation = case['recreation']
    if not refs or [r['path'] for r in refs] != recreation['references'] or task['notes'] != recreation['notes']:
        raise ValueError('原始参考或范围与任务清单不一致')
    if {'variants', 'commands', 'source', 'spec', 'record', 'build_outputs'}.intersection(task):
        raise ValueError('共同输入不得包含成果字段')

    files = {'TASK.md': sha256(START.encode('utf-8')), manifest: sha256(raw)}
    for value in (task['brief'], *shared.values(), 'templates/spec.md'):
        files[value] = file_sha256(safe_task_path(root, value))
    missing = []
    for row in refs:
        value, digest = row['path'], row.get('sha256', '')
        file = source_file(root, value)
        if not value.startswith(base + 'references/') or value in files or file.suffix.lower() not in MEDIA:
            raise ValueError('原始参考必须是任务参考目录内不重复的媒体文件')
        if row.get('kind') not in ORIGINAL or not re.fullmatch('[a-f0-9]{64}', digest):
            raise ValueError('原始媒体类型或摘要无效')
        if row.get('source_url'):
            url = urlsplit(row['source_url'])
            if url.scheme != 'https' or not url.hostname or url.username or url.password:
                raise ValueError('原始媒体来源必须为不含凭据的 HTTPS 地址')
        timestamp = row.get('source_timestamp_seconds')
        if timestamp is not None and (type(timestamp) not in (int, float) or not 0 <= timestamp < 86400):
            raise ValueError('原始媒体时间点无效')
        if file.is_file():
            if file_sha256(file) != digest:
                raise ValueError('共同原始媒体摘要漂移：' + value)
        elif file.exists() or not row.get('source_url'):
            raise ValueError('原始媒体路径无效或缺少获取来源：' + value)
        else:
            missing.append(value)
        files[value] = digest
    return task, files, missing


def task_lock(task, files):
    return {'input_version': task['input_version'], 'input_sha256': digest_inventory(files)}


def require_lock(task, files, root):
    if task.get('schema_version') == 2 and read_json(root, OLD_LOCK if index_path(root) == OLD_INDEX else LOCK).get(task['id']) != task_lock(task, files):
        raise ValueError('输入与锁定摘要不一致；更新输入须提升 input_version 并重新 freeze')


def check_versions(old, new):
    for case_id, row in new.items():
        previous = old.get(case_id)
        if previous and (row['input_version'] < previous['input_version'] or
                         (row['input_version'] == previous['input_version'] and row != previous)):
            raise ValueError(f'{case_id} 已发布输入发生变化；请提升 input_version')


def freeze_tasks(root=ROOT):
    path = safe_task_path(root, LOCK)
    old = read_json(root, LOCK) if path.exists() else {}
    new = {}
    for case in load_tasks(root)['cases']:
        task, files, _ = prepare_task(case, root)
        if task.get('schema_version') == 2:
            new[task['id']] = task_lock(task, files)
    check_versions(old, new)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(json.dumps(new, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
            stream.close()
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    return len(new)


def recreation_plan(case):
    task = case.get('task', {})
    common = shared_paths(task, case.get('task_manifest', ''))
    plan = {
        'case_id': case['id'],
        'title': case['title'],
        'prompt': case['prompt'],
        **common,
        'defaults': DEFAULTS,
        'references': case['recreation']['references'],
        'notes': case['recreation']['notes'],
    }
    if case.get('task_manifest'):
        plan.update(task_manifest=case['task_manifest'], input_version=task.get('input_version'))
    if case['recreation'].get('reference_manifest'):
        plan['reference_manifest'] = case['recreation']['reference_manifest']
        plan['reference_distribution'] = '缺失时按来源清单获取原始媒体，核对 SHA-256 后再交给执行者。'
    return plan


def export_inputs(case, destination, root=ROOT, require_complete=False):
    safe_task_path(root, case['prompt'])
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise ValueError('输入包目录已存在，拒绝覆盖')
    task, files, missing = prepare_task(case, root)
    require_lock(task, files, root)
    if require_complete and missing:
        raise ValueError('缺少原始媒体：' + '、'.join(missing))
    payload = {'task': recreation_plan(case), **task_lock(task, files),
               'files': [{'path': path, 'sha256': digest} for path, digest in sorted(files.items())],
               'missing_media': missing}
    destination.mkdir(parents=True)
    try:
        (destination / 'TASK.md').write_text(START, encoding='utf-8')
        for value in files.keys() - {'TASK.md'} - set(missing):
            target = destination / value
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_file(root, value), target)
            if file_sha256(target) != files[value]:
                raise ValueError('导出期间输入发生变化：' + value)
        (destination / 'inputs.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n',
                                                 encoding='utf-8')
    except Exception:
        shutil.rmtree(destination)
        raise
    return payload


def verify_pack(root, expected=None):
    root = Path(root)
    payload = read_json(root, 'inputs.json')
    rows = payload['files']
    files = {row['path']: row['sha256'] for row in rows}
    digest = digest_inventory(files)
    if (len(files) != len(rows) or digest != payload['input_sha256'] or
            (expected is not None and digest != expected)):
        raise ValueError('输入包清单摘要不一致')
    # inputs.json itself is transport metadata. Regenerate its task entry from the hashed manifest.
    manifest = payload['task']['task_manifest']
    if manifest not in files or not re.fullmatch(MANIFEST_PATH, manifest):
        raise ValueError('输入包任务清单路径不合法')
    task = read_json(root, manifest)
    case = {**task, 'task': task, 'task_manifest': manifest, 'prompt': task['brief'],
            'recreation': {'references': [row['path'] for row in task['references']], 'notes': task['notes']}}
    if any(row.get('source_url') for row in task['references']):
        case['recreation']['reference_manifest'] = manifest
    if (manifest != task_prefix(task["id"], manifest) + "input.json" or
            payload['input_version'] != task['input_version'] or payload['task'] != recreation_plan(case)):
        raise ValueError('输入包入口与任务清单不一致')
    plan = payload['task']
    shared = {plan[key] for key in ('method', 'resources', 'source_notes')}
    references = {row['path']: row['sha256'] for row in task['references']}
    allowed = {'TASK.md', manifest, task['brief'], 'templates/spec.md', *shared, *references}
    if files.keys() != allowed or any(files[path] != hashed for path, hashed in references.items()):
        raise ValueError('输入包文件与任务白名单不一致')
    for value, hashed in files.items():
        path = safe_task_path(root, value)
        if not path.is_file() or file_sha256(path) != hashed:
            raise ValueError('输入文件缺失或摘要不匹配：' + value)
    if payload['missing_media']:
        raise ValueError('此包以缺媒体状态导出；请补齐源目录后重新导出完整包')
    for path in root.rglob('*'):
        if path.is_symlink() or (not path.is_dir() and path.relative_to(root).as_posix() not in files.keys() | {'inputs.json'}):
            raise ValueError('输入包含未登记文件：' + path.relative_to(root).as_posix())
    return digest
