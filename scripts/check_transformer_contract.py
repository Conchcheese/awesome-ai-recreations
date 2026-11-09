"""Validate transferable production data, not physical plausibility or visual fidelity."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
from urllib.parse import urlparse

from task_inputs import ROOT, safe_task_path


def safe_path(base, value):
    if not isinstance(value, str) or not value or '\\' in value or ':' in value:
        raise ValueError('路径必须是非空相对路径')
    p = Path(value)
    if p.is_absolute() or '..' in p.parts:
        raise ValueError('路径不可越过案例目录')
    out = (base / p).resolve()
    if not out.is_relative_to(base.resolve()):
        raise ValueError('路径不可通过符号链接越界')
    return out


def reference_media_path(reference_dir, value, root=ROOT):
    """Resolve version-specific media stored outside the published project."""
    legacy = safe_path(reference_dir, value)
    prefix = root / 'series/变形金刚系列'
    resolved = reference_dir.resolve()
    parts = Path(value).parts
    if not resolved.is_relative_to(prefix) or len(parts) < 2 or parts[0] != 'local':
        return legacy
    project = resolved.relative_to(prefix).parts
    if len(project) == 4 and project[0] == 'models' and project[-1] == 'references':
        key = project[1:3]
    elif project == ('01-擎天柱-电影版', 'references'):
        key = ('cinematic-v2', 'optimus-prime-2007')
    else:
        return legacy
    stash = Path('local/references/versions/transformers', *key, *parts[1:])
    canonical = safe_task_path(root, stash.as_posix())
    return legacy if legacy.is_file() and not canonical.exists() else canonical


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate(data, base, require_ready=False, require_local_media=False):
    errors = []
    if data.get('schemaVersion') != 1:
        errors.append('schemaVersion 必须为 1')
    status = data.get('status')
    if status not in ('draft', 'study'):
        errors.append('status 必须为 draft 或 study')
    if require_ready and status != 'study':
        errors.append('案例仍是 draft，不能按已实现案例验收')
    char = data.get('character', {})
    for key in ('id', 'title', 'edition'):
        if not isinstance(char.get(key), str) or not char[key].strip():
            errors.append(f'character.{key} 不能为空')
    if data.get('provenance') not in ('independent', 'derived'):
        errors.append('provenance 必须声明 independent / derived')
    if data.get('visualGoal') not in ('fidelity', 'reinterpretation'):
        errors.append('visualGoal 必须声明 fidelity / reinterpretation')
    paths = data.get('paths', {})
    for key in ('references', 'assemblies', 'source', 'web', 'film'):
        try:
            p = safe_path(base, paths.get(key))
            if status == 'study' and not p.exists():
                errors.append(f'缺少 {key}: {paths.get(key)}')
        except ValueError as e:
            errors.append(f'{key}: {e}')
    rig = data.get('rig', {})
    ports = rig.get('ports', {})
    required = rig.get('requiredPorts', [])
    if not isinstance(ports, dict) or not isinstance(required, list):
        errors.append('ports 必须是映射，requiredPorts 必须是列表')
        ports, required = {}, []
    if status == 'study':
        try:
            ref_path = safe_path(base, paths.get('references'))
            refs = json.loads(ref_path.read_text())
            errors.extend(validate_references(refs, ref_path.parent, require_local_media))
        except (ValueError, OSError, TypeError) as e:
            errors.append(f'原始参考无法读取: {e}')
        if not required:
            errors.append('study 需要显式声明语义接口 requiredPorts')
        for key in required:
            if not isinstance(ports.get(key), str) or not ports[key]:
                errors.append(f'缺少语义接口: {key}')
        try:
            graph = json.loads(safe_path(base, paths.get('assemblies')).read_text())
            errors.extend(validate_graph(graph, rig.get('rootId'), ports))
        except (ValueError, OSError, TypeError) as e:
            errors.append(f'装配图无法读取: {e}')
        errors.extend(validate_timeline(data.get('timeline', {})))
    return errors


def validate_references(refs, reference_dir, require_local_media=False):
    errors = []
    rows = refs.get('selectedFrames', refs.get('sources', []))
    if not isinstance(rows, list) or not rows:
        return ['study 至少需要一个有来源和哈希的原始参考']
    for row in rows:
        if not isinstance(row, dict):
            errors.append('原始参考必须为对象')
            continue
        url = row.get('sourceUrl', row.get('url', ''))
        if not isinstance(url, str) or urlparse(url).scheme not in ('http', 'https') or not urlparse(url).netloc:
            errors.append('原始参考缺少有效来源 URL')
        digest = row.get('sha256', '')
        if not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest):
            errors.append('原始参考缺少 SHA-256')
        try:
            p = reference_media_path(reference_dir, row.get('file'))
            if not p.is_file() and refs.get('mediaDistribution') == 'local-only' and not require_local_media:
                continue
            if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest() != digest:
                errors.append(f'原始参考不存在或哈希不一致: {row.get("file")}')
        except (ValueError, OSError) as e:
            errors.append(f'原始参考路径: {e}')
    return errors


def validate_graph(graph, root, ports):
    errors = []
    nodes, pieces = graph.get('assemblies', []), graph.get('parts', [])
    if not nodes or not pieces:
        return ['装配图必须含 assemblies 与 parts']
    ids = [n.get('id') for n in nodes]
    part_ids = [p.get('id') for p in pieces]
    if any(not isinstance(x, str) or not x for x in ids + part_ids):
        return ['装配/零件 ID 必须为非空字符串']
    if len(ids) != len(set(ids)):
        errors.append('装配 ID 重复')
    if len(part_ids) != len(set(part_ids)):
        errors.append('零件 ID 重复')
    parents = {n['id']: n.get('parent') for n in nodes}
    if not root or root in parents:
        errors.append('rootId 必须是图外场景根节点')
    owned = {}
    for n in nodes:
        parent = n.get('parent')
        if parent != root and parent not in parents:
            errors.append(f'未知父装配: {n["id"]}')
        seen, cursor = set(), n['id']
        while cursor in parents:
            if cursor in seen:
                errors.append(f'装配父子环: {n["id"]}')
                break
            seen.add(cursor)
            cursor = parents[cursor]
        for p in n.get('parts', []):
            if p in owned:
                errors.append(f'零件被多个装配拥有: {p}')
            owned[p] = n['id']
    for p in pieces:
        if p.get('assembly') not in parents or owned.get(p['id']) != p.get('assembly'):
            errors.append(f'零件归属不一致: {p["id"]}')
    if set(owned) != set(part_ids):
        errors.append('装配清单与零件清单不一致')
    for name, node in ports.items():
        if node not in parents:
            errors.append(f'语义接口指向未知装配: {name} -> {node}')
    return errors


def validate_timeline(t):
    errors = []
    duration, fps = t.get('sourceDuration'), t.get('fps')
    if not finite(duration) or duration <= 0 or not isinstance(fps, int) or isinstance(fps, bool) or fps <= 0:
        return ['sourceDuration / fps 必须为正数 / 正整数']
    transform = t.get('transform', [])
    if len(transform) != 2 or not all(finite(x) for x in transform) or not 0 <= transform[0] < transform[1] <= duration:
        return ['transform 必须为有效的完整变形源时间区间']
    cursor, coverage = 0, []
    for cut in t.get('edit', []):
        a, b, c, d = [cut.get(k) for k in ('in', 'out', 'sourceIn', 'sourceOut')]
        if not all(finite(x) for x in (a, b, c, d)):
            errors.append('剪辑时间必须为有限数')
            continue
        if abs(a-cursor) > 1e-7 or b <= a:
            errors.append('剪辑必须从 0 连续覆盖且每段时长为正')
        if not 0 <= c < d <= duration:
            errors.append('源时间越界或倒序')
        if abs(a*fps-round(a*fps)) > 1e-7 or abs(b*fps-round(b*fps)) > 1e-7:
            errors.append('剪辑边界必须落在整帧')
        if cut.get('purpose') == 'transformation':
            coverage.append((c, d))
        cursor = b
    if not coverage or not any(c <= transform[0] and d >= transform[1] for c, d in coverage):
        errors.append('至少一个连续镜头必须覆盖完整变形，不能用切镜遮掩中段')
    if not finite(t.get('movieDuration')) or abs(cursor-t.get('movieDuration', -1)) > 1e-7:
        errors.append('剪辑总时长不一致')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--require-ready', action='store_true')
    parser.add_argument('--require-local-media', action='store_true', help='视觉复刻开工前强制要求已获取本地原始媒体')
    args = parser.parse_args()
    try:
        errors = validate(json.loads(args.manifest.read_text()), args.manifest.parent, args.require_ready, args.require_local_media)
    except (OSError, ValueError, TypeError) as e:
        errors = [str(e)]
    for e in errors:
        print(f'ERROR: {e}')
    if errors:
        raise SystemExit(1)
    print('契约检查通过；仅验证数据完整性，不证明视觉还原、碰撞或物理可制造。')


if __name__ == '__main__':
    main()
