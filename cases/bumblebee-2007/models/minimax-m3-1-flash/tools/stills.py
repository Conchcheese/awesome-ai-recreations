#!/usr/bin/env python3
"""Select the published stills from the rendered frame sequence.

The stills are the frames that actually carry the story: the vehicle read,
the mid transformation, the robot reveal and the three detail beats. Names
are descriptive so the series index reads without opening the images.
"""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

PICKS = [
    (12, '01-车辆形态.png'),
    (126, '02-变形中段.png'),
    (264, '03-人形亮相.png'),
    (312, '04-头胸特写.png'),
    (372, '05-前臂与手.png'),
    (420, '06-下肢承重.png'),
    (472, '07-最终落幅.png'),
]


def main():
    root = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--frames', default=str(root / 'artifacts' / 'frames'))
    ap.add_argument('--out', default=str(root / 'stills'))
    ap.add_argument('--report', default=str(root / 'artifacts' / 'stills.json'))
    args = ap.parse_args()

    frames = Path(args.frames)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    entries = []
    for index, name in PICKS:
        src = frames / f'frame_{index:05d}.png'
        if not src.exists():
            raise SystemExit(f'缺少帧: {src}')
        dst = out / name
        shutil.copyfile(src, dst)
        entries.append({
            'file': name,
            'frame': index,
            'time': round(index / 24, 3),
            'sha256': hashlib.sha256(dst.read_bytes()).hexdigest(),
            'bytes': dst.stat().st_size,
        })
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n')
    for e in entries:
        print(f"{e['file']}  frame {e['frame']}  t={e['time']:.2f}s")


if __name__ == '__main__':
    main()
