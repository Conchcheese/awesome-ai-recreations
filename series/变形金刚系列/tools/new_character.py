"""Create a new character research draft; never copy Optimus geometry or register a finished case."""
import argparse
import json
from pathlib import Path
import re
import shutil

SERIES = Path(__file__).resolve().parents[1]


def create(slug, title, edition, output_root=None, dry_run=False):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError('slug 仅允许小写字母、数字、单个连接符')
    if not title.strip() or not edition.strip():
        raise ValueError('角色名与具体电影/产品版本不能为空')
    base = Path(output_root) if output_root is not None else SERIES/'local'/'experiments'
    target = base/slug
    if target.exists() or target.is_symlink():
        raise FileExistsError(f'拒绝覆盖: {target}')
    if dry_run:
        return target
    base.mkdir(parents=True, exist_ok=True)
    target.mkdir()  # exclusive creation, including a concurrent caller
    try:
        for folder in ['references', 'records', 'src', 'stills']:
            (target/folder).mkdir()
        manifest = json.loads((SERIES/'templates/production.json').read_text())
        manifest['provenance'] = 'independent'
        manifest['rig']['requiredPorts'] = []
        manifest['rig']['ports'] = {}
        manifest['character'] = {'id': slug, 'title': title, 'edition': edition}
        (target/'production.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
        (target/'references/sources.json').write_text(json.dumps({'target': edition, 'sources': [], 'status': 'draft', 'unknown': ['尚未登记原始参考；不得用其他角色资产代替']}, ensure_ascii=False, indent=2)+'\n')
        (target/'records/assembly-catalog.json').write_text('{"assemblies": [], "parts": []}\n')
        (target/'brief.md').write_text((SERIES/'templates/character-brief.md').read_text())
        (target/'records/验收清单.md').write_text((SERIES/'templates/验收清单.md').read_text())
        (target/'src/character.mjs').write_text("// Draft interface only. Build this character from its own allowed references.\nexport function buildCharacter(){throw new Error('尚未建立角色几何和 rig');}\nexport function stateAt(t){throw new Error('尚未建立角色变形拓扑与时间线');}\n")
        (target/'README.md').write_text(f'# {title} · 研究草稿\n\n版本：{edition}。尚无可运行成品、动画或视频；未登记 catalog。\n\n先完成 brief.md 与 references/sources.json，再建立角色特有几何/机构。production.json 是待填写契约；不能靠改名复用擎天柱。\n\n默认 independent；从原始参考自行建立机构，若实际读取旧实现则改为 derived 并注明。\n')
    except Exception:
        shutil.rmtree(target)
        raise
    return target


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('slug')
    p.add_argument('--title', required=True)
    p.add_argument('--edition', required=True)
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()
    try:
        target = create(args.slug, args.title, args.edition, dry_run=args.dry_run)
    except (ValueError, OSError) as e:
        p.exit(1, f'{e}\n')
    print(('计划创建：' if args.dry_run else '已创建未实现草稿：')+str(target))


if __name__ == '__main__':
    main()
