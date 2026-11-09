#!/usr/bin/env python3
"""Check the rendered film against what the production contract claims.

This verifies the actual media file, not the intentions: container
parameters, full decode, frame count, black frames, frozen frames and the
audio track. It says nothing about artistic quality, which still needs a
human listen and review.

Run:  python3 tools/video-check.py "artifacts/大黄蜂-2007-复刻短片.mp4" [--expect-frames 480]
"""

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path: Path):
    out = run(['ffprobe', '-v', 'error', '-print_format', 'json',
               '-show_format', '-show_streams', str(path)])
    if out.returncode != 0:
        raise SystemExit(f'ffprobe 失败: {out.stderr.strip()}')
    return json.loads(out.stdout)


def decode_gray(path: Path):
    """Decode the whole file to grayscale frames and measure them."""
    cmd = ['ffmpeg', '-v', 'error', '-i', str(path), '-vf', 'scale=320:-1',
           '-pix_fmt', 'gray', '-f', 'rawvideo', '-']
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        raise SystemExit(f'ffmpeg 解码失败: {proc.stderr.decode()[:400]}')
    raw = np.frombuffer(proc.stdout, dtype=np.uint8)
    # 16:9 -> height 180 at width 320
    h = 180
    n = raw.size // (320 * h)
    frames = raw[: n * 320 * h].reshape(n, h, 320).astype(np.float32)
    return frames


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('video', type=Path)
    ap.add_argument('--expect-frames', type=int, default=None)
    ap.add_argument('--report', type=Path, default=None)
    args = ap.parse_args()

    path = args.video
    if not path.exists():
        raise SystemExit(f'文件不存在: {path}')

    info = probe(path)
    streams = info['streams']
    video = [s for s in streams if s['codec_type'] == 'video']
    audio = [s for s in streams if s['codec_type'] == 'audio']
    if not video:
        raise SystemExit('没有视频流')
    v = video[0]
    duration = float(info['format'].get('duration', 0.0))
    fps = 0.0
    if 'r_frame_rate' in v and '/' in v['r_frame_rate']:
        n, d = v['r_frame_rate'].split('/')
        fps = float(n) / float(d) if float(d) else 0.0
    nb_frames = int(v.get('nb_frames', 0) or 0)

    errors = []
    warnings = []
    if not audio:
        errors.append('没有音频流')
    if nb_frames == 0:
        warnings.append('容器未记录帧数（以解码结果为准）')
    if args.expect_frames and nb_frames and nb_frames != args.expect_frames:
        errors.append(f'帧数不符: {nb_frames} != {args.expect_frames}')

    frames = decode_gray(path)
    decoded = frames.shape[0]
    if args.expect_frames and decoded != args.expect_frames:
        errors.append(f'解码帧数不符: {decoded} != {args.expect_frames}')

    # Black frames: mean brightness below a floor.
    means = frames.reshape(frames.shape[0], -1).mean(axis=1)
    black = [int(i) for i in np.where(means < 2.0)[0]]
    if black:
        errors.append(f'存在黑帧: {black[:20]}')

    # Frozen frames: near-identical to the previous frame.
    diffs = np.abs(np.diff(frames.reshape(frames.shape[0], -1), axis=0)).mean(axis=1)
    frozen = [int(i + 1) for i in np.where(diffs < 0.05)[0]]
    if len(frozen) > 12:
        warnings.append(f'疑似冻结帧 {len(frozen)} 处: {frozen[:20]}')

    levels = {
        'mean': float(means.mean()),
        'min': float(means.min()),
        'max': float(means.max()),
        'p01': float(np.percentile(means, 1)),
        'p99': float(np.percentile(means, 99)),
    }

    report = {
        'file': str(path),
        'bytes': path.stat().st_size,
        'container': info['format'].get('format_name'),
        'duration': duration,
        'fps': fps,
        'resolution': [int(v.get('width', 0)), int(v.get('height', 0))],
        'video_codec': v.get('codec_name'),
        'pixel_format': v.get('pix_fmt'),
        'nb_frames': nb_frames,
        'decoded_frames': decoded,
        'audio': [{
            'codec': a.get('codec_name'),
            'channels': a.get('channels'),
            'sample_rate': a.get('sample_rate'),
            'duration': a.get('duration'),
        } for a in audio],
        'levels': levels,
        'black_frames': black,
        'frozen_frames': frozen[:40],
        'errors': errors,
        'warnings': warnings,
    }

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        for e in errors:
            print(f'ERROR: {e}', file=sys.stderr)
        raise SystemExit(1)
    for w in warnings:
        print(f'WARNING: {w}', file=sys.stderr)
    print('媒体检查通过：仅验证文件完整性、帧数、黑帧与音轨存在，不代替人工试听与审片。')


if __name__ == '__main__':
    main()
