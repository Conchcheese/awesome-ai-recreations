#!/usr/bin/env python3
"""HY4 · 解码接触表 / 分镜 / 原作定性对照
从实际编码后的 MP4 解码抽帧（不是复用渲染 PNG），并生成与原帧的并排/50%叠图。
执行：python3 tools/contact.py
"""
import json
import pathlib
import subprocess
import sys
from PIL import Image, ImageDraw, ImageEnhance

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / 'artifacts'
QA = ART / 'qa'
QA.mkdir(parents=True, exist_ok=True)
MP4 = ART / 'HY4-擎天柱-2007-电影版.mp4'
FRAMES = ART / 'frames'
REF = ROOT / 'references/local'


def decode(second: float, dest: pathlib.Path):
    subprocess.run([
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-ss', f'{second:.3f}', '-i', str(MP4), '-frames:v', '1', str(dest)
    ], check=True)
    return Image.open(dest).convert('RGB')


def label(draw, x, y, text):
    draw.text((x, y), text, fill=(198, 216, 238))


def contact_sheet():
    times = [0.5 + 2 * i for i in range(14)]
    tw, th, cols = 480, 201, 4
    rows = (len(times) + cols - 1) // cols
    board = Image.new('RGB', (cols * tw, rows * (th + 22)), (11, 17, 25))
    d = ImageDraw.Draw(board)
    tmp = QA / '_decode'
    if not tmp.is_dir():
        tmp.mkdir(parents=True)
    for i, t in enumerate(times):
        im = decode(t, tmp / f'{i:02d}.png').resize((tw, th))
        x, y = (i % cols) * tw, (i // cols) * (th + 22)
        board.paste(im, (x, y))
        label(d, x + 6, y + th + 4, f'{t:05.2f}s  ·  frame {round(t*24):04d}')
    out = QA / '成片解码接触表.jpg'
    board.save(out, quality=90)
    print('解码接触表', out.name, board.size)
    return out


def storyboard():
    reps = [48, 228, 408, 492, 558, 612, 654]
    tw, th, cols = 480, 201, 4
    rows = 2
    board = Image.new('RGB', (cols * tw, rows * (th + 22)), (11, 17, 25))
    d = ImageDraw.Draw(board)
    mf = json.loads((ART / 'render-manifest.json').read_text())
    for i, f in enumerate(reps):
        src = FRAMES / f'{f:04d}.png'
        im = Image.open(src).convert('RGB').resize((tw, th))
        x, y = (i % cols) * tw, (i // cols) * (th + 22)
        board.paste(im, (x, y))
        shot = mf['frames'][f]['shot']
        label(d, x + 6, y + th + 4, f'F{f:04d}  {shot}')
    out = QA / '成片分镜.jpg'
    board.save(out, quality=92)
    print('分镜', out.name, board.size)
    return out


def comparison():
    """官方 029s 头胸原帧 与 成片头胸特写：不同机位/投影/光照，只作定性并排与叠图。"""
    official = Image.open(REF / 'paramount-029s-head-chest.jpg').convert('RGB')
    ours = Image.open(FRAMES / '0492.png').convert('RGB')
    tw, th = 800, 450
    a = official.resize((tw, th))
    b = ours.resize((tw, th))
    board = Image.new('RGB', (tw * 2 + 12, th + 30), (11, 17, 25))
    d = ImageDraw.Draw(board)
    board.paste(a, (0, 0))
    board.paste(b, (tw + 12, 0))
    label(d, 6, th + 8, 'LEFT  Paramount 2007 / 029s 原帧（仰拍）')
    label(d, tw + 18, th + 8, 'RIGHT  HY4 成片 / 0492 头胸特写（非同机位）')
    out = QA / '原作对照-并排.jpg'
    board.save(out, quality=90)

    blend = Image.blend(a, b, 0.5)
    overlay = Image.new('RGB', (tw, th + 30), (11, 17, 25))
    overlay.paste(blend, (0, 0))
    label(ImageDraw.Draw(overlay), 6, th + 8, '50% 叠图 · 非注册叠图，不用于计算像素误差')
    out2 = QA / '原作对照-50叠图.jpg'
    overlay.save(out2, quality=90)
    print('并排 / 叠图', out.name, out2.name)
    return out, out2


if __name__ == '__main__':
    if not MP4.is_file():
        sys.exit('缺少成片：先运行 node tools/video.mjs')
    contact_sheet()
    storyboard()
    comparison()
