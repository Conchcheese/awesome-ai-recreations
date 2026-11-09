#!/usr/bin/env python3
"""
render_film.py — command line entry point for the offline software rasterizer.

Reads the frozen scene contract (``manifest.json`` + ``frames.json``), renders
a PNG sequence (optionally in parallel across processes) and muxes it into an
MP4 with ffmpeg.

Examples
--------
    # single frame, quick iteration
    python3 tools/render/render_film.py --scene artifacts/scene --frame 0 \
        --out /tmp/frame0.png --ss 1

    # whole film -> PNG sequence + MP4
    python3 tools/render/render_film.py --scene artifacts/scene \
        --out-dir artifacts/frames --out-mp4 artifacts/film.mp4 --workers 8 --ss 1
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from typing import Dict, List, Optional, Sequence, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# import raster first: it pins the math library thread counts before numpy
# is loaded (see the note at the top of raster.py)
import raster  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402


# ---------------------------------------------------------------------------
# worker plumbing (module level so multiprocessing can pickle it)
# ---------------------------------------------------------------------------

_W: Dict[str, object] = {}


def _init_worker(scene_dir: str, opts_dict: Dict, width: int, height: int, ss: int) -> None:
    _W["scene"] = raster.load_scene(scene_dir)
    _W["frames"], _W["meta"] = raster.load_frames(scene_dir)
    _W["opts"] = raster.RenderOptions(**opts_dict)
    _W["size"] = (width, height, ss)


def _render_task(task: Tuple[int, str]) -> Tuple[int, str, float]:
    idx, path = task
    scene = _W["scene"]
    frames = _W["frames"]
    opts = _W["opts"]
    width, height, ss = _W["size"]  # type: ignore[misc]
    t0 = time.perf_counter()
    img = raster.render_frame(scene, frames[idx], width, height, ss, opts)  # type: ignore[arg-type]
    dt = time.perf_counter() - t0
    Image.fromarray(img, mode="RGB").save(path, format="PNG", optimize=False)
    return idx, path, dt


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def parse_frame_range(spec: Optional[str], count: int) -> List[int]:
    """Parse ``a:b`` (python slice semantics), ``n`` or ``None``.

    ``a:b`` is half open like a python slice; ``:b`` starts at 0 and ``a:``
    runs to the end.  A bare ``n`` selects the single frame ``n``.
    """
    if not spec:
        return list(range(count))
    spec = spec.strip()
    if ":" in spec:
        a_s, _, b_s = spec.partition(":")
        a = int(a_s) if a_s.strip() else 0
        b = int(b_s) if b_s.strip() else count
    else:
        a = int(spec)
        b = a + 1
    a = max(0, min(a, count))
    b = max(a, min(b, count))
    return list(range(a, b))


def find_audio(scene_dir: str, explicit: Optional[str]) -> Optional[str]:
    if explicit:
        return explicit if os.path.isfile(explicit) else None
    candidates = [
        os.path.join(scene_dir, "film.wav"),
        os.path.join(os.path.dirname(os.path.abspath(scene_dir)), "film.wav"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def encode_mp4(
    frame_dir: str,
    out_mp4: str,
    fps: int,
    audio: Optional[str] = None,
    pattern: str = "frame_%05d.png",
    start_number: int = 0,
) -> None:
    """Mux the PNG sequence (and optional wav) into an H.264 MP4."""
    cmd: List[str] = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-framerate",
        str(fps),
        "-start_number",
        str(int(start_number)),
        "-i",
        os.path.join(frame_dir, pattern),
    ]
    if audio:
        cmd += ["-i", audio, "-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += [
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-flags:v",
        "+bitexact",
        "-movflags",
        "+faststart",
        "-map_metadata",
        "-1",
        out_mp4,
    ]
    os.makedirs(os.path.dirname(os.path.abspath(out_mp4)) or ".", exist_ok=True)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed ({proc.returncode}):\n{proc.stderr.strip()}"
        )


def build_options(args: argparse.Namespace) -> Dict:
    return {
        "ss": int(args.ss),
        "tile_size": int(args.tile),
        "candidate_budget": int(args.budget),
        "bloom_threshold": float(args.bloom_threshold),
        "bloom_strength": float(args.bloom_strength),
        "bloom_clamp_mult": float(args.bloom_clamp),
        "vignette": float(args.vignette),
        "grain": float(args.grain),
        "grain_seed": int(args.grain_seed),
        "shadow_strength": float(args.shadow_strength),
        "shadow_resolution": int(args.shadow_resolution),
    }


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(
        description="Offline deterministic software rasterizer (numpy + PIL + ffmpeg)."
    )
    p.add_argument("--scene", required=True, help="directory holding manifest.json + frames.json")
    p.add_argument("--out", help="write a single frame to this PNG path")
    p.add_argument("--out-dir", help="write a PNG sequence into this directory")
    p.add_argument("--out-mp4", help="mux the sequence into this MP4")
    p.add_argument("--frame", type=int, default=None, help="render only this frame index")
    p.add_argument("--frames", default=None, help="frame range, python slice syntax, e.g. 12:48")
    p.add_argument("--width", type=int, default=None, help="override output width")
    p.add_argument("--height", type=int, default=None, help="override output height")
    p.add_argument("--workers", type=int, default=1, help="number of render processes")
    p.add_argument("--ss", type=int, default=1, choices=(1, 2), help="supersampling factor")
    p.add_argument("--audio", default=None, help="wav to mux (default: <scene>/../film.wav if present)")
    p.add_argument("--no-audio", action="store_true", help="never mux audio")
    p.add_argument("--fps", type=int, default=None, help="override the fps from frames.json")
    p.add_argument("--tile", type=int, default=32, help="rasterizer tile size in pixels")
    p.add_argument("--budget", type=int, default=1_200_000, help="max candidate fragments per batch")
    p.add_argument("--bloom-threshold", type=float, default=1.0)
    p.add_argument("--bloom-strength", type=float, default=0.6)
    p.add_argument("--bloom-clamp", type=float, default=8.0, help="firefly clamp (x threshold)")
    p.add_argument("--vignette", type=float, default=0.3)
    p.add_argument("--grain", type=float, default=0.012)
    p.add_argument("--grain-seed", type=int, default=20240101)
    p.add_argument("--shadow-strength", type=float, default=1.0)
    p.add_argument("--shadow-resolution", type=int, default=192)
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args(argv)

    if not os.path.isdir(args.scene):
        print(f"error: --scene directory not found: {args.scene}", file=sys.stderr)
        return 2
    if args.out is None and args.out_dir is None and args.out_mp4 is None:
        print("error: nothing to do, pass --out, --out-dir and/or --out-mp4", file=sys.stderr)
        return 2

    scene = raster.load_scene(args.scene)
    frames, meta = raster.load_frames(args.scene)
    if not frames:
        print("error: frames.json contains no frames", file=sys.stderr)
        return 2

    width = args.width if args.width is not None else meta["width"]
    height = args.height if args.height is not None else meta["height"]
    fps = args.fps if args.fps is not None else meta["fps"]

    if args.frame is not None:
        indices = [int(args.frame)]
        if indices[0] < 0 or indices[0] >= len(frames):
            print(f"error: --frame {args.frame} out of range (0..{len(frames) - 1})", file=sys.stderr)
            return 2
    else:
        indices = parse_frame_range(args.frames, len(frames))
    if not indices:
        print("error: empty frame range", file=sys.stderr)
        return 2

    out_dir = args.out_dir
    if out_dir is None and (args.out_mp4 or len(indices) > 1):
        out_dir = args.out_dir = "_render_frames"
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    opts_dict = build_options(args)
    opts = raster.RenderOptions(**opts_dict)

    tasks: List[Tuple[int, str]] = []
    for i in indices:
        if args.out and len(indices) == 1:
            path = os.path.abspath(args.out)
        else:
            path = os.path.join(out_dir, f"frame_{i:05d}.png")
        tasks.append((i, path))

    n_workers = max(1, int(args.workers))
    timings: List[Tuple[int, float]] = []
    t_start = time.perf_counter()

    if n_workers == 1:
        _init_worker(args.scene, opts_dict, width, height, int(args.ss))
        for task in tasks:
            idx, path, dt = _render_task(task)
            timings.append((idx, dt))
            if not args.quiet:
                print(f"frame {idx:5d}  {dt * 1000:8.1f} ms  -> {path}")
    else:
        import multiprocessing as mp

        ctx = mp.get_context("spawn")
        chunk = max(1, len(tasks) // (n_workers * 4))
        with ctx.Pool(
            processes=n_workers,
            initializer=_init_worker,
            initargs=(args.scene, opts_dict, width, height, int(args.ss)),
        ) as pool:
            for idx, path, dt in pool.imap_unordered(_render_task, tasks, chunksize=chunk):
                timings.append((idx, dt))
                if not args.quiet:
                    print(f"frame {idx:5d}  {dt * 1000:8.1f} ms  -> {path}")

    total = time.perf_counter() - t_start
    timings.sort()
    if timings:
        avg = sum(d for _, d in timings) / len(timings)
        print(
            f"[render] {len(timings)} frame(s) in {total:.2f}s "
            f"(avg {avg * 1000:.1f} ms/frame, {width}x{height} ss={args.ss}, workers={n_workers})"
        )

    if args.out_mp4:
        if out_dir is None:
            print("error: --out-mp4 needs --out-dir (or a sequence)", file=sys.stderr)
            return 2
        audio = None if args.no_audio else find_audio(args.scene, args.audio)
        if not args.no_audio and args.audio and not os.path.isfile(args.audio):
            print(f"warning: audio file not found, rendering without audio: {args.audio}", file=sys.stderr)
        encode_mp4(out_dir, args.out_mp4, fps, audio, start_number=min(indices))
        if not args.quiet:
            print(f"[mp4]   {args.out_mp4}  (audio: {audio or 'none'})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
