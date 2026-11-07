"""Validate the actual encoded movie. Human visual/listening review remains separate."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from edit import DURATION, FPS, CUTS

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT/'artifacts'
VIDEO = ART/'擎天柱-2007-电影版-Cycles.mp4'


def command(args, **kwargs):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def check():
    errors = []
    report = {'result': 'running', 'file': VIDEO.name}
    probe = json.loads(command(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(VIDEO)]).stdout)
    v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    a = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    checks = {
        'resolution': (v['width'], v['height']) == (1920, 804),
        'frameRate': v['avg_frame_rate'] == '24/1',
        'frameCount': int(v['nb_read_frames']) == DURATION*FPS,
        'duration': abs(float(probe['format']['duration'])-DURATION) < .06,
        'h264': v['codec_name'] == 'h264',
        'pixelFormat': v['pix_fmt'] == 'yuv420p',
        'audio': a['codec_name'] == 'aac' and a['channels'] == 2 and a['sample_rate'] == '48000',
        'bt709': v.get('color_space') == 'bt709' and v.get('color_range') == 'tv',
    }
    render = json.loads((ART/'cycles-render.json').read_text())
    config = json.loads((ART/'cycles-frames/render-config.json').read_text())
    checks['currentWeb'] = render['htmlSha256'] == config['htmlSha256'] == sha(ROOT/'index.html')
    checks['currentGLB'] = config['glbSha256'] == sha(ART/'optimus-cinematic.glb')
    checks['currentExportMetadata'] = config['exportMetaSha256'] == sha(ART/'animation-export.json')
    checks['currentRenderer'] = config['sceneScriptSha256'] == sha(ROOT/'tools/blender_scene.py')
    checks['currentEdit'] = config['edit'] == [list(c) for c in CUTS]
    checks['captions'] = config['captionHashes'] == [sha(ART/'captions'/f'1920-{i:02d}.png') for i in range(len(CUTS))]
    # Decode the whole file; actual decoder errors fail this call.
    decode = command(['ffmpeg', '-hide_banner', '-v', 'info', '-i', str(VIDEO), '-vf', 'blackdetect=d=0.04:pix_th=0.02:pic_th=0.98', '-an', '-f', 'null', '-'])
    blacks = re.findall(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)', decode.stderr.decode())
    checks['noBlackIntervals'] = not blacks
    raw = command(['ffmpeg', '-v', 'error', '-i', str(VIDEO), '-vn', '-ac', '2', '-ar', '48000', '-f', 'f32le', '-']).stdout
    pcm = np.frombuffer(raw, dtype='<f4').reshape(-1, 2)
    peak = float(np.max(np.abs(pcm)))
    rms = float(np.sqrt(np.mean(pcm**2)))
    dc = float(np.max(np.abs(pcm.mean(axis=0))))
    checks['audioFinite'] = bool(np.isfinite(pcm).all())
    checks['audioNotClippedOrSilent'] = .001 < rms and peak < 1.0
    checks['audioDC'] = dc < .01
    loud = command(['ffmpeg', '-hide_banner', '-i', str(VIDEO), '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr.decode()
    integrated = re.findall(r'I:\s+(-?[\d.]+) LUFS', loud)
    true_peak = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', loud)
    lufs = float(integrated[-1]) if integrated else None
    tp = float(true_peak[-1]) if true_peak else None
    checks['loudness'] = lufs is not None and -19 <= lufs <= -13
    checks['truePeak'] = tp is not None and tp <= -1
    # Check freezes against raw source PNGs: final film grain cannot conceal duplicate source frames.
    hashes, pixel_hashes, duplicates = [], [], []
    repeat_run, longest_run = 1, 1
    for i in range(DURATION*FPS):
        frame_path = ART/'cycles-frames'/f'{i:04d}.png'
        digest = sha(frame_path)
        with Image.open(frame_path) as im:
            pixels = hashlib.sha256(im.convert('RGB').tobytes()).hexdigest()
        if pixel_hashes and pixels == pixel_hashes[-1]:
            duplicates.append(i)
            repeat_run += 1
        else:
            repeat_run = 1
        longest_run = max(longest_run, repeat_run)
        hashes.append(digest)
        pixel_hashes.append(pixels)
    checks['noLongIdenticalPixelRun'] = longest_run <= 8
    contact = Image.new('RGB', (1600, 830), '#10151a')
    draw = ImageDraw.Draw(contact)
    for i, c in enumerate(CUTS):
        sec = (c[0]+c[1])/2
        out = ART/f'decoded-shot-{i:02d}.png'
        command(['ffmpeg', '-v', 'error', '-y', '-ss', str(sec), '-i', str(VIDEO), '-frames:v', '1', str(out)])
        im = ImageOps.contain(Image.open(out).convert('RGB'), (520, 218))
        x, y = (i%3)*533, (i//3)*207
        # 3x4 contact, deliberately scale to fit a concise inspection sheet.
        im.thumbnail((520, 178))
        contact.paste(im, (x+(520-im.width)//2, y))
        draw.text((x+8, y+181), f'{sec:.2f}s / {c[4]}', fill='#e0cbaa')
    contact.save(ART/'decoded-contact.jpg', quality=92)
    for key, ok in checks.items():
        if not ok:
            errors.append(key)
    report.update(result='passed' if not errors else 'failed', checks=checks, errors=errors,
                  videoSha256=sha(VIDEO), video=v, audio=a, duration=float(probe['format']['duration']),
                  audioMeasurements={'peakLinear': peak, 'rmsLinear': rms, 'dcOffset': dc, 'integratedLUFS': lufs, 'truePeakDBFS': tp},
                  blackIntervals=blacks, duplicateSourceFrameIndices=duplicates, longestIdenticalPixelRun=longest_run,
                  sourceFrameHashes=hashes, sourcePixelHashes=pixel_hashes,
                  humanReview='逐镜头视觉评审与人工试听须另行记录；自动检查不评价真实感或电影感。',
                  endpoint='本片是有开场与英雄落幅的短片，不是无缝循环；首尾无需相同。')
    (ART/'video-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k: report[k] for k in ('result', 'checks', 'audioMeasurements', 'videoSha256')}, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    try:
        check()
    except (OSError, ValueError, StopIteration, subprocess.CalledProcessError) as e:
        print(f'视频检查无法完成: {e}', file=sys.stderr)
        raise SystemExit(1)
