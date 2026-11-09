#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / "artifacts/大黄蜂-2007-Kimi-K3.1-Pro.mp4"
REPORT = ROOT / "artifacts/video-check.json"

def run(args):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(" ".join(args) + "\n" + result.stderr)
    return result

probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(VIDEO)]).stdout)
video = next(s for s in probe["streams"] if s["codec_type"] == "video")
audio = next(s for s in probe["streams"] if s["codec_type"] == "audio")
checks = {
    "h264": video["codec_name"] == "h264",
    "1280x720": (video["width"], video["height"]) == (1280, 720),
    "24fps": video["avg_frame_rate"] == "24/1",
    "480_frames": int(video["nb_frames"]) == 480,
    "20_seconds": abs(float(probe["format"]["duration"]) - 20.0) < 0.05,
    "aac_stereo_48khz": audio["codec_name"] == "aac" and audio["sample_rate"] == "48000" and audio["channels"] == 2,
}
decode = run(["ffmpeg", "-v", "error", "-i", str(VIDEO), "-f", "null", "-"])
checks["complete_decode"] = not decode.stderr.strip()
black = run(["ffmpeg", "-hide_banner", "-i", str(VIDEO), "-vf", "blackdetect=d=0.2:pix_th=0.02", "-an", "-f", "null", "-"])
black_events = [line.strip() for line in black.stderr.splitlines() if "black_start:" in line]
checks["no_detected_black_interval"] = not black_events
volume = run(["ffmpeg", "-hide_banner", "-i", str(VIDEO), "-vn", "-af", "volumedetect", "-f", "null", "-"])
volume_lines = [line.strip() for line in volume.stderr.splitlines() if "mean_volume:" in line or "max_volume:" in line]
contact = ROOT / "artifacts/大黄蜂-影片接触表.jpg"
select = "eq(n,0)+eq(n,72)+eq(n,144)+eq(n,216)+eq(n,288)+eq(n,360)+eq(n,432)+eq(n,468)"
run(["ffmpeg", "-y", "-v", "error", "-i", str(VIDEO), "-vf", f"select='{select}',scale=480:270,tile=4x2", "-frames:v", "1", "-q:v", "2", str(contact)])
report = {
    "file": str(VIDEO.relative_to(ROOT)),
    "sha256": hashlib.sha256(VIDEO.read_bytes()).hexdigest(),
    "bytes": VIDEO.stat().st_size,
    "checks": checks,
    "blackEvents": black_events,
    "volume": volume_lines,
    "contactSheet": str(contact.relative_to(ROOT)),
    "limits": "Automated media checks do not replace visual review, listening, collision or fidelity assessment."
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
if not all(checks.values()):
    raise SystemExit(1)
