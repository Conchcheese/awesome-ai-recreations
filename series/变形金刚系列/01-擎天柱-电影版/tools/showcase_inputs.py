"""Resolve a frozen movie revision using public data, without local render logs."""
import hashlib
import json
from pathlib import Path

def film_revision(root, film):
    root=Path(root)
    record=json.loads((root/'records/验证摘要.json').read_text(encoding='utf-8'))['film']
    digest=hashlib.sha256(Path(film).read_bytes()).hexdigest()
    if digest!=record['videoSha256']:
        raise ValueError('Movie differs from the frozen published revision; use the verified Release film or explicitly register the new render before editing.')
    html=record['renderHtmlSha256']
    if len(html)!=64 or any(c not in '0123456789abcdef' for c in html):
        raise ValueError('Invalid frozen render HTML digest')
    return {'videoSha256':digest,'renderHtmlSha256':html}
