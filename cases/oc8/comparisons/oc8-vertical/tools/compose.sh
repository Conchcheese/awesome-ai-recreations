#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="${COMPARE_TMP:-${TMPDIR:-/tmp}/oc8-compare}"
ORIG="${ORIGINAL_VIDEO:?请设置 ORIGINAL_VIDEO 为有使用权限的原视频路径}"
DEST="${COMPARE_DEST:-$SCRIPT_DIR/../artifacts}"
[[ -f "$ORIG" ]] || { echo "原视频不存在：$ORIG" >&2; exit 1; }
for item in glm.mp4 deepseek.mp4 hy.mp4 badges/b0.png badges/b1.png badges/b2.png badges/b3.png; do
  [[ -f "$TMP/$item" ]] || { echo "缺少输入：$TMP/$item" >&2; exit 1; }
done

# Reject diagnostic/partial clips instead of silently freezing their last frame.
python3 - "$TMP" "$ORIG" 1280 720 <<'PY_VALIDATE'
import json, subprocess, sys
from pathlib import Path
from fractions import Fraction
root, original, width, height = sys.argv[1:]
def probe(file):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', str(file)]))
for name in ['glm', 'deepseek', 'hy']:
    info = probe(Path(root) / (name + '.mp4'))
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    if (video['width'], video['height']) != (int(width), int(height)) or Fraction(video['r_frame_rate']) != 30 or abs(float(info['format']['duration']) - 25) > 0.1:
        raise SystemExit(name + ': 正式输入必须为指定尺寸、30 fps、25 秒；请重新完整录制')
info = probe(original)
if float(info['format']['duration']) < 24.95 or not any(s['codec_type'] == 'audio' for s in info['streams']):
    raise SystemExit('原视频需要至少 25 秒并包含可使用的音轨')
PY_VALIDATE

MP4="$DEST/机械章鱼OC-8-四模型纵向对比.mp4"
POSTER="$DEST/封面-纵向对比.jpg"

mkdir -p "$DEST"

FILTER="\
[0:v]fps=30,scale=1280:720:flags=lanczos,pad=1280:724:0:0:color=0x0b1220,setsar=1[v0];\
[1:v]fps=30,scale=1280:720:flags=lanczos,pad=1280:724:0:0:color=0x0b1220,setsar=1[v1];\
[2:v]fps=30,scale=1280:720:flags=lanczos,pad=1280:724:0:0:color=0x0b1220,setsar=1[v2];\
[3:v]fps=30,scale=1280:720:flags=lanczos,pad=1280:724:0:0:color=0x0b1220,setsar=1[v3];\
[v0][v1][v2][v3]vstack=inputs=4[st];\
[st][4:v]overlay=x=W-w-4:y=0:format=auto[o1];\
[o1][5:v]overlay=x=W-w-4:y=724:format=auto[o2];\
[o2][6:v]overlay=x=W-w-4:y=1448:format=auto[o3];\
[o3][7:v]overlay=x=W-w-4:y=2172:format=auto,format=yuv420p[vout];\
[3:a]afade=t=in:st=0:d=0.4,afade=t=out:st=24.3:d=0.7[aout]"

ffmpeg -hide_banner -loglevel warning -y \
  -i "$TMP/glm.mp4" \
  -i "$TMP/deepseek.mp4" \
  -i "$TMP/hy.mp4" \
  -i "$ORIG" \
  -loop 1 -framerate 30 -i "$TMP/badges/b0.png" \
  -loop 1 -framerate 30 -i "$TMP/badges/b1.png" \
  -loop 1 -framerate 30 -i "$TMP/badges/b2.png" \
  -loop 1 -framerate 30 -i "$TMP/badges/b3.png" \
  -filter_complex "$FILTER" \
  -map "[vout]" -map "[aout]" \
  -t 25 -r 30 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  "$MP4"

ffmpeg -hide_banner -loglevel error -y -ss 8 -i "$MP4" -frames:v 1 -q:v 3 "$POSTER"

echo "=== 成片规格 ==="
ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 "$MP4"
echo "→ $MP4"
echo "→ $POSTER"
