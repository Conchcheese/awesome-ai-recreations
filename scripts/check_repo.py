#!/usr/bin/env python3
"""Validate published inputs and case discovery without installing JS dependencies."""
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit
import unicodedata

from catalog import ROOT, load_catalog, normalize_name, safe_task_path
from check_transformer_publication import validate_publication


def local_path(root, value):
    """Reject absolute paths, traversal and symlink escapes, including missing files."""
    p = Path(value)
    if p.is_absolute() or '..' in p.parts or re.match(r'^[A-Za-z]:', value):
        raise ValueError(f'索引路径必须相对于仓库根目录：{value}')
    resolved = (root / p).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError(f'路径超出仓库：{value}')
    return resolved


def validate_catalog(data, root):
    errors = []
    if data.get('schema_version') not in (1, 2):
        errors.append('catalog schema_version 必须为 1 或 2')
    seen = set()
    names = {}
    for case in data.get('cases', []):
        case_id = case.get('id', '')
        if case_id in seen or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', case_id):
            errors.append(f'重复或无效案例 ID：{case_id}')
        seen.add(case_id)
        if not case.get('title') or (not case.get('variants') and not case.get('task_only')):
            errors.append(f'{case_id} 缺少 title 或 variants')
        if data.get('schema_version') == 2:
            errors.extend(validate_task(case, root))
        paths = [('prompt', case.get('prompt', ''))]
        aliases = case.get('aliases', [])
        if not isinstance(aliases, list) or not all(isinstance(a, str) and a.strip() for a in aliases):
            errors.append(f'{case_id} aliases 必须为名称列表')
            aliases = []
        for name in [case_id, case.get('title', ''), *aliases]:
            normalized = normalize_name(name)
            if normalized in names and names[normalized] != case_id:
                errors.append(f'案例名称冲突：{name}')
            names[normalized] = case_id
        recreation = case.get('recreation', {})
        if not isinstance(recreation, dict):
            recreation = {}
        refs = recreation.get('references', [])
        if not isinstance(refs, list) or not all(isinstance(r, str) and r for r in refs):
            errors.append(f'{case_id} 独立复刻参考必须为路径列表')
            refs = []
        if not refs or not recreation.get('notes'):
            errors.append(f'{case_id} 缺少独立复刻参考或范围说明')
        remote = {}
        manifest_path = recreation.get('reference_manifest')
        if manifest_path:
            paths.append((case_id + ':reference_manifest', manifest_path))
            try:
                manifest = json.loads(local_path(root, manifest_path).read_text(encoding='utf-8'))
                for row in manifest.get('references', []):
                    if not isinstance(row, dict):
                        raise ValueError('参考条目必须为对象')
                    value = row.get('path', '')
                    if not isinstance(value, str) or not value:
                        raise ValueError('参考路径不能为空')
                    local_path(root, value)
                    url = urlsplit(row.get('source_url', ''))
                    if url.scheme != 'https' or not url.netloc or not row.get('kind'):
                        errors.append(f'{case_id} 远程参考来源或类型无效')
                    if not re.fullmatch(r'[a-f0-9]{64}', row.get('sha256', '')):
                        errors.append(f'{case_id} 远程参考缺少历史摘要')
                    if value in remote:
                        errors.append(f'{case_id} 远程参考路径重复')
                    remote[value] = row
                if set(remote) != set(refs):
                    errors.append(f'{case_id} 参考路径与来源清单不一致')
            except (OSError, ValueError, TypeError) as error:
                errors.append(f'{case_id} 参考清单无效：{error}')
        if data.get('schema_version') == 2 and not manifest_path:
            try:
                task = json.loads(task_local_path(root, case['task_manifest']).read_text(encoding='utf-8'))
                remote = {r['path']: r for r in task['references'] if r.get('source_url')}
            except (OSError, ValueError, KeyError, TypeError) as error:
                errors.append(f'{case_id} 任务参考清单无效：{error}')
        for value in refs:
            if value not in remote:
                paths.append((case_id + ':recreation reference', value))
            else:
                try:
                    local_path(root, value)
                except ValueError as error:
                    errors.append(str(error))
            if Path(value).suffix.lower() not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                errors.append(f'{case_id} 独立复刻参考必须为明确的媒体文件：{value}')
        variants = set()
        for v in case.get('variants', []):
            key = f'{case_id}/{v.get("id", "")}'
            if v.get('id') in variants or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', v.get('id', '')):
                errors.append(f'重复或无效版本 ID：{key}')
            variants.add(v.get('id'))
            if v.get('provenance') not in ['independent', 'derived']:
                errors.append(f'{key} 来源属性无效')
            if v.get('visual_goal') not in ['fidelity', 'reinterpretation']:
                errors.append(f'{key} 视觉目标无效')
            if not v.get('model_label') or not v.get('notes'):
                errors.append(f'{key} 缺少模型标签或限制说明')
            for field in ['readme', 'live', 'film', 'source', 'spec', 'record', 'cwd']:
                paths.append((key + ':' + field, v.get(field, '')))
            if not v.get('references') or not v.get('build_outputs'):
                errors.append(f'{key} 缺少参考或构建产物路径')
            for value in v.get('references', []):
                paths.append((key + ':reference', value))
            for value in v.get('build_outputs', []):
                try:
                    local_path(root, value)  # Build outputs need not exist on a fresh clone.
                except ValueError as error:
                    errors.append(str(error))
            commands = v.get('commands', {})
            if not {'build', 'check'}.issubset(commands):
                errors.append(f'{key} 缺少 build/check 命令')
            for action, steps in commands.items():
                if not isinstance(steps, list) or not steps:
                    errors.append(f'{key}:{action} 命令必须为非空列表')
                    continue
                for step in steps:
                    if not isinstance(step, list) or len(step) < 2 or not all(isinstance(a, str) for a in step):
                        errors.append(f'{key}:{action} 参数必须是字符串数组')
                        continue
                    if step[0] not in ['node', 'python3']:
                        errors.append(f'{key}:{action} 未支持的命令入口')
                    cwd = root / v.get('cwd', '')
                    script = (cwd / step[1]).resolve()
                    if not script.is_relative_to(root.resolve()) or not script.is_file():
                        errors.append(f'{key}:{action} 脚本不存在或越界：{step[1]}')
        for label, value in paths:
            try:
                if not value or not local_path(root, value).exists():
                    errors.append(f'{label} 路径不存在：{value}')
            except ValueError as error:
                errors.append(str(error))
    if not seen:
        errors.append('catalog 至少需要一个案例')
    return errors


def task_local_path(root, value):
    return safe_task_path(root, value)


def validate_task(case, root):
    import hashlib
    errors = []
    try:
        cid = case['id']; base = f'tasks/{cid}/'
        manifest = case['task_manifest']
        if manifest != base+'input.json':raise ValueError('任务清单必须位于独立 tasks/<id>/input.json')
        index = json.loads(task_local_path(root, 'tasks/index.json').read_text())['tasks']
        if len(index) != len(set(index)) or manifest not in index:raise ValueError('任务索引遗漏或重复')
        task = json.loads(task_local_path(root, manifest).read_text())
        if task['id'] != cid or task['title'] != case['title'] or task['aliases'] != case['aliases'] or task['series'] != case['series']:raise ValueError('任务身份与成果索引不一致')
        if task.get('status') != 'ready' or not isinstance(task.get('input_version'), int) or task['input_version'] < 1:raise ValueError('登记任务必须就绪并有输入版本')
        if task.get('defaults') != {'visual_goal':'fidelity','provenance':'independent'}:raise ValueError('默认任务必须为独立还原')
        if task['brief'] != base+'brief.md' or case['prompt'] != task['brief']:raise ValueError('任务书必须独立存放')
        task_local_path(root, task['brief']).read_text(encoding='utf-8')
        for key, expected in [('method','docs/精细复刻流程.md'),('resources','docs/共同输入与资源.md'),('source_notes','docs/参考素材与许可.md')]:
            if task.get(key) != expected:raise ValueError('共同方法或资源入口不一致')
            task_local_path(root, expected).read_text(encoding='utf-8')
        refs=task['references']
        if not refs or [r['path'] for r in refs] != case['recreation']['references']:raise ValueError('原始媒体与任务清单不一致')
        if task['notes'] != case['recreation']['notes']:raise ValueError('参考范围不一致')
        seen=set()
        for row in refs:
            value=row['path'];file=task_local_path(root,value)
            if not value.startswith(base+'references/') or value in seen:raise ValueError('原始媒体必须位于任务参考目录且不重复')
            seen.add(value)
            if not re.fullmatch('[a-f0-9]{64}',row.get('sha256','')):raise ValueError('原始媒体缺少摘要')
            if row.get('kind') not in ['original-reference','original-frame','original-film-frame','original-vfx-frame']:raise ValueError('仅允许登记原始参考，不能登记成果')
            if row.get('source_url'):
                url=urlsplit(row['source_url'])
                if url.scheme!='https' or not url.netloc:raise ValueError('原始媒体来源必须为 HTTPS 地址')
            timestamp=row.get('source_timestamp_seconds')
            if timestamp is not None and (isinstance(timestamp,bool) or not isinstance(timestamp,(int,float)) or not 0<=timestamp<86400):raise ValueError('原始媒体时间点无效')
            if file.exists():
                if hashlib.sha256(file.read_bytes()).hexdigest()!=row['sha256']:raise ValueError('共同原始媒体摘要漂移')
            elif not row.get('source_url'):raise ValueError('缺少原始媒体且没有获取来源')
        forbidden={'variants','commands','source','spec','record','build_outputs'}
        if forbidden.intersection(task):raise ValueError('共同输入不得包含成果字段')
    except (KeyError, OSError, ValueError, TypeError) as error:
        errors.append(f"{case.get('id')}: 共同任务无效：{error}")
    return errors


def markdown_errors(file, root):
    # Inline links only; historical prose and upstream snapshot have separate provenance.
    text = file.read_text(encoding='utf-8')
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    errors = []
    for match in re.finditer(r'!?\[[^\]\n]*\]\(([^\n]+?)\)', text):
        target = match[1].strip().strip('<>')
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or not (parsed.path or parsed.fragment):
            continue
        dest = (file.parent / unquote(parsed.path)).resolve() if parsed.path else file.resolve()
        if not dest.is_relative_to(root.resolve()) or not dest.exists():
            errors.append(f'{file.relative_to(root)} 本地链接不存在或越界：{target}')
        elif parsed.fragment and dest.suffix == '.md':
            fragment = unquote(parsed.fragment)
            if fragment not in markdown_anchors(dest.read_text(encoding='utf-8')):
                errors.append(f'{file.relative_to(root)} Markdown 标题锚点不存在：{target}')
    return errors


def markdown_anchors(text):
    """GitHub-style slugs for the ATX headings used by this repository."""
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    anchors, counts = set(), {}
    for heading in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', text, re.M):
        heading = re.sub(r'<[^>]+>', '', heading).lower()
        slug = ''.join(c for c in heading if c in '-_' or c.isspace() or
                       unicodedata.category(c)[0] in 'LNM').replace(' ', '-')
        index = counts.get(slug, 0)
        counts[slug] = index + 1
        anchors.add(slug if not index else f'{slug}-{index}')
    anchors.update(re.findall(r'(?:id|name)=["\']([^"\']+)["\']', text))
    return anchors


def publication_errors(files, root):
    errors = []
    sensitive_names = {'.env', '.npmrc', '.pypirc', 'credentials.json', 'id_rsa', 'id_ed25519'}
    for relative in files:
        file = root / relative
        if not file.is_file():
            continue
        if file.name in sensitive_names or (file.name.startswith('.env.') and file.name != '.env.example') or file.suffix in {'.pem', '.key', '.p12'}:
            errors.append(f'疑似敏感配置文件：{relative}')
        if any(p in {'local', 'private', 'artifacts', 'node_modules', '__pycache__'} for p in file.relative_to(root).parts):
            errors.append(f'发布候选含本地/生成目录：{relative}')
        if file.stat().st_size > 50 * 1024 * 1024:
            errors.append(f'超过 50 MiB，请移至外部分发：{relative}')
        if 'upstream-teardown' in file.parts:
            continue
        if file.suffix in {'.md', '.mjs', '.js', '.sh', '.json', '.py', '.yml', '.html'}:
            content = file.read_text(encoding='utf-8')
            # Build pattern in parts so this check does not flag its own source.
            if re.search(r'/(?:' + 'Users' + r'|home)/[^/\s]+/', content):
                errors.append(f'作者机器绝对路径残留：{relative}')
            patterns = [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
                        r'\bgh[pousr]_[A-Za-z0-9]{30,}',
                        r'\bgithub_pat_[A-Za-z0-9_]{40,}',
                        r'\bsk-proj-[A-Za-z0-9_-]{40,}']
            if any(re.search(pattern, content) for pattern in patterns):
                # Report file only. Never echo the matched credential into logs.
                errors.append(f'疑似密钥内容，请人工核查：{relative}')
    return errors


def main():
    try:
        data = load_catalog()
        files = subprocess.check_output(
            ['git', '-c', 'core.quotepath=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
            cwd=ROOT).decode().split('\0')
        files = sorted(set(f for f in files if f))
        errors = validate_catalog(data, ROOT) + publication_errors(files, ROOT) + validate_publication(files, ROOT)
        docs = [ROOT / f for f in files if f.endswith('.md') and
                'upstream-teardown/' not in f and
                not f.endswith('01-机械章鱼OC-8-teardown机器模拟器.md')]
        for file in docs:
            if file.is_file():
                errors.extend(markdown_errors(file, ROOT))
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f'仓库检查无法完成：{error}')
        return 1
    for error in errors:
        print('✗ ' + error)
    print(f"{sum(bool(c['variants']) for c in data['cases'])} 个已有案例 / {sum(len(c['variants']) for c in data['cases'])} 个案例版本；"
          f'{len(docs)} 份维护文档；{len(errors)} 个问题')
    return int(bool(errors))


if __name__ == '__main__':
    raise SystemExit(main())
