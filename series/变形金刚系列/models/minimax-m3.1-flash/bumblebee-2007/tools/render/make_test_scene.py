#!/usr/bin/env python3
"""
make_test_scene.py — build a synthetic scene in the frozen export format and
verify the renderer against it.

The generated scene follows the exact contract that ``tools/export.mjs`` emits
(``manifest.json`` + ``frames.json`` + ``m*.pos.f32`` / ``m*.nrm.f32`` /
``m*.idx.u32``), so the renderer cannot tell the difference between this and a
real export.

It also:
  * checks that every triangle is wound consistently with its vertex normals
    and that closed meshes have outward pointing normals (the "inverted
    normals" failure mode),
  * renders frame 0 through the real CLI (``render_film.py``),
  * measures per-frame timings, triangle counts and instance counts,
  * writes ``_selftest/selftest.json`` and a log file.

Usage
-----
    python3 tools/render/make_test_scene.py                # default self test
    python3 tools/render/make_test_scene.py --stress       # perf scene too
    python3 tools/render/make_test_scene.py --out-dir DIR  # elsewhere
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from typing import Dict, List, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# import raster first: it pins the math library thread counts before numpy
# is loaded (see the note at the top of raster.py)
import raster  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.join(HERE, "../../artifacts/_selftest")


# ---------------------------------------------------------------------------
# geometry builders
# ---------------------------------------------------------------------------


def make_cube(size: float = 1.0) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Axis aligned cube with outward normals and outward (CCW) winding."""
    h = size * 0.5
    faces = [
        # (origin, edge_u, edge_v) with u x v == outward normal
        ((h, -h, -h), (0.0, 2 * h, 0.0), (0.0, 0.0, 2 * h)),
        ((-h, -h, h), (0.0, 2 * h, 0.0), (0.0, 0.0, -2 * h)),
        ((-h, h, -h), (0.0, 0.0, 2 * h), (2 * h, 0.0, 0.0)),
        ((-h, -h, h), (0.0, 0.0, -2 * h), (2 * h, 0.0, 0.0)),
        ((-h, -h, h), (2 * h, 0.0, 0.0), (0.0, 2 * h, 0.0)),
        ((h, -h, -h), (-2 * h, 0.0, 0.0), (0.0, 2 * h, 0.0)),
    ]
    pos: List[np.ndarray] = []
    nrm: List[np.ndarray] = []
    idx: List[int] = []
    for origin, u, v in faces:
        o = np.array(origin, np.float64)
        uu = np.array(u, np.float64)
        vv = np.array(v, np.float64)
        n = np.cross(uu, vv)
        n = n / np.linalg.norm(n)
        base = len(pos)
        for corner in (o, o + uu, o + uu + vv, o + vv):
            pos.append(corner)
            nrm.append(n)
        idx += [base, base + 1, base + 2, base, base + 2, base + 3]
    return (
        np.asarray(pos, np.float32),
        np.asarray(nrm, np.float32),
        np.asarray(idx, np.int64).reshape(-1, 3),
    )


def make_sphere(radius: float = 1.0, segments: int = 32, rings: int = 16) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """UV sphere with outward normals and outward winding."""
    pos: List[np.ndarray] = []
    nrm: List[np.ndarray] = []
    idx: List[int] = []
    for i in range(rings + 1):
        theta = math.pi * i / rings
        st, ct = math.sin(theta), math.cos(theta)
        for j in range(segments):
            phi = 2.0 * math.pi * j / segments
            n = np.array([st * math.cos(phi), ct, st * math.sin(phi)], np.float64)
            pos.append(n * radius)
            nrm.append(n)
    for i in range(rings):
        for j in range(segments):
            a = i * segments + j
            b = i * segments + (j + 1) % segments
            c = (i + 1) * segments + (j + 1) % segments
            d = (i + 1) * segments + j
            idx += [a, b, c, a, c, d]
    return (
        np.asarray(pos, np.float32),
        np.asarray(nrm, np.float32),
        np.asarray(idx, np.int64).reshape(-1, 3),
    )


def make_box(w: float, h: float, d: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    pos, nrm, idx = make_cube(1.0)
    pos = pos * np.array([w, h, d], np.float32)
    return pos, nrm, idx


# ---------------------------------------------------------------------------
# scene writing (frozen format)
# ---------------------------------------------------------------------------


def mat_trs(
    tx: float, ty: float, tz: float, sx: float = 1.0, sy: float = 1.0, sz: float = 1.0, rot_y: float = 0.0
) -> List[float]:
    """Translation/rotation/scale matrix flattened in **column major** order."""
    m = np.eye(4, dtype=np.float64)
    c, s = math.cos(rot_y), math.sin(rot_y)
    m[0, 0] = c * sx
    m[0, 2] = -s * sx
    m[2, 0] = s * sz
    m[2, 2] = c * sz
    m[0, 3] = tx
    m[1, 3] = ty
    m[2, 3] = tz
    return m.flatten(order="F").tolist()


def write_scene(
    scene_dir: str,
    meshes: List[Tuple[str, np.ndarray, np.ndarray, np.ndarray]],
    materials: Dict,
    frames: List[Dict],
    meta: Dict,
) -> None:
    os.makedirs(scene_dir, exist_ok=True)
    manifest_meshes = []
    for i, (name, pos, nrm, idx) in enumerate(meshes):
        p_name = f"m{i:03d}.pos.f32"
        n_name = f"m{i:03d}.nrm.f32"
        i_name = f"m{i:03d}.idx.u32"
        pos.astype("<f4").tofile(os.path.join(scene_dir, p_name))
        nrm.astype("<f4").tofile(os.path.join(scene_dir, n_name))
        idx.astype("<u4").tofile(os.path.join(scene_dir, i_name))
        manifest_meshes.append(
            {
                "id": i,
                "name": name,
                "positions": p_name,
                "normals": n_name,
                "indices": i_name,
                "vertexCount": int(pos.shape[0]),
                "indexCount": int(idx.size),
            }
        )
    manifest = {"meshes": manifest_meshes, "materials": materials}
    with open(os.path.join(scene_dir, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    doc = dict(meta)
    doc["frames"] = frames
    with open(os.path.join(scene_dir, "frames.json"), "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2)


# ---------------------------------------------------------------------------
# geometry sanity checks
# ---------------------------------------------------------------------------


def _cross3(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Row-wise cross product (numpy 2.x removed the 2-D np.cross)."""
    return np.stack(
        [
            a[:, 1] * b[:, 2] - a[:, 2] * b[:, 1],
            a[:, 2] * b[:, 0] - a[:, 0] * b[:, 2],
            a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0],
        ],
        axis=1,
    )


def check_mesh(name: str, pos: np.ndarray, nrm: np.ndarray, idx: np.ndarray) -> Dict:
    """Verify winding matches the normals and normals point away from the centre."""
    tri = pos[idx]
    geo = _cross3(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    avg_n = nrm[idx].mean(axis=1)
    dots = np.einsum("ij,ij->i", geo, avg_n)
    mag = np.linalg.norm(geo, axis=1)
    # degenerate triangles (e.g. the pole fans of a UV sphere) carry no winding
    solid = mag > max(1e-12, 1e-9 * float(mag.max()))
    centroid = pos.mean(axis=0)
    outward = np.einsum("ij,ij->i", nrm, pos - centroid)
    return {
        "name": name,
        "triangles": int(idx.shape[0]),
        "vertices": int(pos.shape[0]),
        "degenerate_triangles": int((~solid).sum()),
        "winding_dot_min": float(dots[solid].min()) if solid.any() else 0.0,
        "winding_dot_max": float(dots[solid].max()) if solid.any() else 0.0,
        "winding_consistent": bool(solid.any() and (dots[solid] > 0).all()),
        "normals_outward_min": float(outward.min()),
        "normals_outward": bool((outward > 0).all()),
    }


# ---------------------------------------------------------------------------
# scenes
# ---------------------------------------------------------------------------


def build_basic_scene(scene_dir: str, n_frames: int = 8) -> Dict:
    cube_pos, cube_nrm, cube_idx = make_cube(1.0)
    sph_pos, sph_nrm, sph_idx = make_sphere(0.9, 32, 16)
    box_pos, box_nrm, box_idx = make_box(0.22, 0.22, 0.22)

    materials = {
        "yellow-paint": {
            "baseColor": [0.85, 0.55, 0.04],
            "metallic": 0.9,
            "roughness": 0.28,
            "emissive": [0.0, 0.0, 0.0],
            "emissiveStrength": 0.0,
            "doubleSided": False,
        },
        "chrome": {
            "baseColor": [0.82, 0.84, 0.88],
            "metallic": 1.0,
            "roughness": 0.2,
            "emissive": [0.0, 0.0, 0.0],
            "emissiveStrength": 0.0,
            "doubleSided": False,
        },
        "blue-emissive": {
            "baseColor": [0.1, 0.2, 0.35],
            "metallic": 0.2,
            "roughness": 0.4,
            "emissive": [0.12, 0.55, 1.0],
            "emissiveStrength": 3.0,
            "doubleSided": False,
        },
    }

    frames = []
    for i in range(n_frames):
        t = i / max(1, n_frames - 1)
        ang = -0.35 + 0.7 * t
        eye = [4.2 + 0.6 * math.sin(ang), 1.7, 5.2 - 1.4 * t]
        frames.append(
            {
                "t": round(i * (1.0 / 24.0), 6),
                "camera": {
                    "eye": eye,
                    "target": [0.0, 0.75, 0.0],
                    "up": [0.0, 1.0, 0.0],
                    "fov": 38.0,
                    "near": 0.05,
                    "far": 400.0,
                },
                "instances": [
                    {"mesh": 0, "m": mat_trs(-1.15, 0.8, 0.0, 1.6, 1.6, 1.6, 0.35), "mat": "yellow-paint"},
                    {"mesh": 1, "m": mat_trs(1.35, 0.9, 0.25, 1.0, 1.0, 1.0, 0.0), "mat": "chrome"},
                    {"mesh": 2, "m": mat_trs(0.1, 0.32, 1.75, 1.0, 1.0, 1.0, 0.0), "mat": "blue-emissive"},
                ],
                "exposure": 1.0,
                "lights": {
                    "key": {"dir": [-0.5, -0.8, -0.35], "color": [1.0, 0.96, 0.9], "intensity": 3.0},
                    "fill": {"dir": [0.7, -0.25, 0.6], "color": [0.42, 0.52, 0.68], "intensity": 0.9},
                    "rim": {"dir": [0.1, -0.35, 0.9], "color": [0.85, 0.9, 1.0], "intensity": 2.2},
                },
                "ambient": {
                    "sky": [0.1, 0.13, 0.18],
                    "ground": [0.05, 0.045, 0.04],
                    "strength": 1.0,
                },
                "ground": {
                    "enabled": True,
                    "color": [0.055, 0.06, 0.07],
                    "grid": 0.5,
                    "roughness": 0.32,
                    "metallic": 0.0,
                },
                "background": {
                    "top": [0.02, 0.026, 0.036],
                    "bottom": [0.006, 0.008, 0.012],
                    "horizonGlow": 0.25,
                },
            }
        )

    write_scene(
        scene_dir,
        [
            ("cube", cube_pos, cube_nrm, cube_idx),
            ("sphere", sph_pos, sph_nrm, sph_idx),
            ("emissive-box", box_pos, box_nrm, box_idx),
        ],
        materials,
        frames,
        {"fps": 24, "count": n_frames, "width": 1280, "height": 720},
    )

    return {
        "meshes": [
            check_mesh("cube", cube_pos, cube_nrm, cube_idx),
            check_mesh("sphere", sph_pos, sph_nrm, sph_idx),
            check_mesh("emissive-box", box_pos, box_nrm, box_idx),
        ],
        "triangles": int(cube_idx.shape[0] + sph_idx.shape[0] + box_idx.shape[0]),
        "instances_per_frame": 3,
    }


def build_cube_scene(scene_dir: str) -> Dict:
    """Single cube seen from a 3/4 angle so all the faces can be judged."""
    cube_pos, cube_nrm, cube_idx = make_cube(1.0)
    materials = {
        "yellow-paint": {
            "baseColor": [0.85, 0.55, 0.04],
            "metallic": 0.9,
            "roughness": 0.28,
            "emissive": [0.0, 0.0, 0.0],
            "emissiveStrength": 0.0,
            "doubleSided": False,
        }
    }
    frames = [
        {
            "t": 0.0,
            "camera": {
                "eye": [2.3, 2.1, 2.7],
                "target": [0.0, 0.7, 0.0],
                "up": [0.0, 1.0, 0.0],
                "fov": 40.0,
                "near": 0.05,
                "far": 400.0,
            },
            "instances": [
                {"mesh": 0, "m": mat_trs(0.0, 0.7, 0.0, 1.4, 1.4, 1.4, 0.6), "mat": "yellow-paint"}
            ],
            "exposure": 1.0,
            "lights": {
                "key": {"dir": [-0.5, -0.8, -0.35], "color": [1.0, 0.96, 0.9], "intensity": 3.0},
                "fill": {"dir": [0.7, -0.25, 0.6], "color": [0.42, 0.52, 0.68], "intensity": 0.9},
                "rim": {"dir": [0.1, -0.35, 0.9], "color": [0.85, 0.9, 1.0], "intensity": 2.2},
            },
            "ambient": {
                "sky": [0.1, 0.13, 0.18],
                "ground": [0.05, 0.045, 0.04],
                "strength": 1.0,
            },
            "ground": {
                "enabled": True,
                "color": [0.055, 0.06, 0.07],
                "grid": 0.5,
                "roughness": 0.32,
                "metallic": 0.0,
            },
            "background": {
                "top": [0.02, 0.026, 0.036],
                "bottom": [0.006, 0.008, 0.012],
                "horizonGlow": 0.25,
            },
        }
    ]
    write_scene(
        scene_dir,
        [("cube", cube_pos, cube_nrm, cube_idx)],
        materials,
        frames,
        {"fps": 24, "count": 1, "width": 900, "height": 700},
    )
    return {"meshes": [check_mesh("cube", cube_pos, cube_nrm, cube_idx)]}


def build_stress_scene(scene_dir: str, n_instances: int = 60, n_frames: int = 2) -> Dict:
    """Heavier scene: many instances, tens of thousands of triangles."""
    parts = []
    tri_total = 0
    for k in range(4):
        p, n, i = make_sphere(0.42 + 0.06 * k, 22, 12)
        parts.append((f"part{k}", p, n, i))
        tri_total += i.shape[0]

    materials = {
        "yellow-paint": {
            "baseColor": [0.85, 0.55, 0.04],
            "metallic": 0.9,
            "roughness": 0.28,
            "emissive": [0.0, 0.0, 0.0],
            "emissiveStrength": 0.0,
            "doubleSided": False,
        },
        "chrome": {
            "baseColor": [0.82, 0.84, 0.88],
            "metallic": 1.0,
            "roughness": 0.14,
            "emissive": [0.0, 0.0, 0.0],
            "emissiveStrength": 0.0,
            "doubleSided": False,
        },
    }

    instances = []
    for i in range(n_instances):
        ang = 2.0 * math.pi * i / n_instances
        rad = 1.6 + 0.55 * (i % 6)
        instances.append(
            {
                "mesh": i % 4,
                "m": mat_trs(
                    math.cos(ang) * rad,
                    0.45 + 0.12 * (i % 5),
                    math.sin(ang) * rad,
                    1.0,
                    1.0,
                    1.0,
                    ang,
                ),
                "mat": "yellow-paint" if i % 2 == 0 else "chrome",
            }
        )

    frames = []
    for i in range(n_frames):
        frames.append(
            {
                "t": round(i * (1.0 / 24.0), 6),
                "camera": {
                    "eye": [0.0, 2.4, 9.5],
                    "target": [0.0, 0.6, 0.0],
                    "up": [0.0, 1.0, 0.0],
                    "fov": 42.0,
                    "near": 0.05,
                    "far": 400.0,
                },
                "instances": instances,
                "exposure": 1.0,
                "lights": {
                    "key": {"dir": [-0.5, -0.8, -0.35], "color": [1.0, 0.96, 0.9], "intensity": 3.0},
                    "fill": {"dir": [0.7, -0.25, 0.6], "color": [0.42, 0.52, 0.68], "intensity": 0.9},
                    "rim": {"dir": [0.1, -0.35, 0.9], "color": [0.85, 0.9, 1.0], "intensity": 2.2},
                },
                "ambient": {
                    "sky": [0.1, 0.13, 0.18],
                    "ground": [0.05, 0.045, 0.04],
                    "strength": 1.0,
                },
                "ground": {
                    "enabled": True,
                    "color": [0.055, 0.06, 0.07],
                    "grid": 1.0,
                    "roughness": 0.32,
                    "metallic": 0.0,
                },
                "background": {
                    "top": [0.02, 0.026, 0.036],
                    "bottom": [0.006, 0.008, 0.012],
                    "horizonGlow": 0.25,
                },
            }
        )

    write_scene(
        scene_dir,
        parts,
        materials,
        frames,
        {"fps": 24, "count": n_frames, "width": 1280, "height": 720},
    )
    return {
        "meshes": [check_mesh(n, p, nm, i) for (n, p, nm, i) in parts],
        "triangles_per_frame": tri_total * n_instances,
        "instances_per_frame": n_instances,
    }


# ---------------------------------------------------------------------------
# image statistics
# ---------------------------------------------------------------------------


def image_stats(path: str) -> Dict:
    img = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    hist = np.histogram(lum, bins=16, range=(0.0, 255.0))[0]
    return {
        "path": os.path.basename(path),
        "size": [int(img.shape[1]), int(img.shape[0])],
        "min": float(lum.min()),
        "max": float(lum.max()),
        "mean": float(lum.mean()),
        "std": float(lum.std()),
        "distinct_luma_levels": int(np.unique(lum.astype(np.uint8)).size),
        "near_black_fraction": float((lum < 4.0).mean()),
        "near_white_fraction": float((lum > 250.0).mean()),
        "histogram_16": [int(v) for v in hist],
    }


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def run_cli(scene_dir: str, out_png: str, extra: List[str]) -> Tuple[int, float, str]:
    cmd = [
        sys.executable,
        os.path.join(HERE, "render_film.py"),
        "--scene",
        scene_dir,
        "--out",
        out_png,
        "--frame",
        "0",
    ] + extra
    t0 = time.perf_counter()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    dt = time.perf_counter() - t0
    return proc.returncode, dt, (proc.stdout + proc.stderr).strip()


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Build a synthetic scene and self-test the renderer.")
    p.add_argument("--out-dir", default=DEFAULT_OUT)
    p.add_argument("--stress", action="store_true", help="also build + time the heavy scene")
    p.add_argument("--keep-png", type=int, default=2, help="how many PNGs to keep in the output dir")
    p.add_argument(
        "--real-scene",
        default=None,
        help="also validate against a real exported scene directory (e.g. artifacts/scene)",
    )
    p.add_argument("--ss", type=int, default=1)
    args = p.parse_args(argv)

    out_dir = os.path.abspath(args.out_dir)
    os.makedirs(out_dir, exist_ok=True)
    log_lines: List[str] = []

    def log(msg: str) -> None:
        print(msg, flush=True)
        log_lines.append(msg)

    report: Dict = {
        "scene_dir": os.path.join(out_dir, "scene"),
        "machine": {
            "python": sys.version.split()[0],
            "numpy": np.__version__,
            "platform": sys.platform,
        },
    }

    # ---- build the basic scene --------------------------------------
    scene_dir = os.path.join(out_dir, "scene")
    info = build_basic_scene(scene_dir)
    report["basic"] = info
    log(f"[scene] wrote {scene_dir}")
    for m in info["meshes"]:
        log(
            f"[check] {m['name']:>14}: tris={m['triangles']:5d} "
            f"winding_ok={m['winding_consistent']} normals_outward={m['normals_outward']}"
        )

    # ---- render frame 0 through the CLI -----------------------------
    png = os.path.join(out_dir, "frame0.png")
    rc, dt, out = run_cli(scene_dir, png, ["--ss", str(args.ss)])
    log(f"[cli] render_film.py rc={rc} ({dt:.2f}s)")
    if out:
        for line in out.splitlines():
            log(f"      {line}")
    if rc != 0:
        report["error"] = "render_film.py failed"
        _finish(out_dir, report, log_lines)
        return 1

    report["basic_render"] = {"seconds": round(dt, 4), "ss": args.ss}
    report["basic_image"] = image_stats(png)

    # ---- dedicated cube check (is the cube a solid hexahedron?) -------
    cube_dir = os.path.join(out_dir, "cube_scene")
    cinfo = build_cube_scene(cube_dir)
    report["cube_check"] = cinfo
    cube_png = os.path.join(out_dir, "cube_check.png")
    rc, dt, out = run_cli(cube_dir, cube_png, ["--ss", str(args.ss)])
    log(f"[cli] cube check rc={rc} ({dt:.2f}s) -> {cube_png}")
    if rc == 0:
        report["cube_check_image"] = image_stats(cube_png)
        log(
            "[check] cube winding_ok=%s normals_outward=%s"
            % (
                cinfo["meshes"][0]["winding_consistent"],
                cinfo["meshes"][0]["normals_outward"],
            )
        )

    # ---- in-process timing + determinism ----------------------------
    scene = raster.load_scene(scene_dir)
    frames, meta = raster.load_frames(scene_dir)
    frame = frames[0]
    opts = raster.RenderOptions()
    timings = []
    for _ in range(3):
        t0 = time.perf_counter()
        img = raster.render_frame(scene, frame, meta["width"], meta["height"], args.ss, opts)
        timings.append((time.perf_counter() - t0) * 1000.0)
    tri_per_frame = int(sum(scene.mesh_by_id(i.mesh).triangle_count for i in frame.instances))
    report["basic_timing_ms"] = {
        "runs": [round(t, 2) for t in timings],
        "best": round(min(timings), 2),
        "median": round(sorted(timings)[len(timings) // 2], 2),
    }
    report["basic_stats"] = {
        "triangles": tri_per_frame,
        "instances": len(frame.instances),
        "resolution": [meta["width"], meta["height"]],
        "ss": args.ss,
    }
    log(
        f"[time]  basic {meta['width']}x{meta['height']} ss={args.ss}: "
        f"{min(timings):.1f} ms best / {sorted(timings)[len(timings) // 2]:.1f} ms median "
        f"({tri_per_frame} tris, {len(frame.instances)} instances)"
    )

    # determinism: render twice and compare bytes
    img2 = raster.render_frame(scene, frame, meta["width"], meta["height"], args.ss, opts)
    report["deterministic"] = bool(np.array_equal(img, img2))
    log(f"[determinism] identical re-render: {report['deterministic']}")

    # ---- stress scene -----------------------------------------------
    if args.stress:
        stress_dir = os.path.join(out_dir, "stress_scene")
        sinfo = build_stress_scene(stress_dir)
        report["stress"] = sinfo
        log(
            f"[stress] {sinfo['instances_per_frame']} instances, "
            f"{sinfo['triangles_per_frame']} triangles/frame"
        )
        sscene = raster.load_scene(stress_dir)
        sframes, smeta = raster.load_frames(stress_dir)
        for ss in (1, 2):
            t0 = time.perf_counter()
            simg = raster.render_frame(sscene, sframes[0], smeta["width"], smeta["height"], ss, opts)
            dt_ms = (time.perf_counter() - t0) * 1000.0
            report.setdefault("stress_timing_ms", {})[f"ss{ss}"] = round(dt_ms, 2)
            log(f"[stress] {smeta['width']}x{smeta['height']} ss={ss}: {dt_ms:.1f} ms/frame")
            if ss == 1:
                sp = os.path.join(out_dir, "stress_frame0.png")
                Image.fromarray(simg, mode="RGB").save(sp)
                report["stress_image"] = image_stats(sp)

    # ---- validate against a real exported scene (optional) -------------
    if args.real_scene:
        rs = os.path.abspath(args.real_scene)
        try:
            rscene = raster.load_scene(rs)
            rframes, rmeta = raster.load_frames(rs)
        except Exception as exc:  # pragma: no cover - depends on external data
            log(f"[real]  skipped, could not load {rs}: {exc}")
        else:
            rf = rframes[0]
            rpng = os.path.join(out_dir, "real_frame0.png")
            rc, dt, out = run_cli(rs, rpng, ["--ss", str(args.ss)])
            log(f"[real]  {rs}: rc={rc} ({dt:.2f}s) -> {rpng}")
            if rc == 0:
                tri = int(sum(rscene.mesh_by_id(i.mesh).triangle_count for i in rf.instances))
                t0 = time.perf_counter()
                raster.render_frame(rscene, rf, rmeta["width"], rmeta["height"], args.ss, opts)
                dt_ms = (time.perf_counter() - t0) * 1000.0
                report["real_scene"] = {
                    "dir": rs,
                    "meshes": len(rscene.meshes),
                    "materials": len(rscene.materials),
                    "frames": len(rframes),
                    "instances_per_frame": len(rf.instances),
                    "triangles_per_frame": tri,
                    "resolution": [rmeta["width"], rmeta["height"]],
                    "seconds_per_frame": round(dt_ms / 1000.0, 3),
                    "image": image_stats(rpng),
                }
                log(
                    f"[real]  {len(rscene.meshes)} meshes / {len(rscene.materials)} materials / "
                    f"{len(rf.instances)} instances / {tri} tris per frame / "
                    f"{dt_ms:.0f} ms per frame"
                )

    keep_names = {"frame0.png", "cube_check.png"}
    if args.real_scene:
        keep_names.add("real_frame0.png")
    _cleanup_pngs(out_dir, max(args.keep_png, len(keep_names)), keep_names)
    _finish(out_dir, report, log_lines)
    log(f"[done]  report -> {os.path.join(out_dir, 'selftest.json')}")
    return 0


def _cleanup_pngs(out_dir: str, keep: int, keep_names: set) -> None:
    """Keep at most ``keep`` PNGs; the ones in ``keep_names`` are kept first."""
    pngs = sorted(
        [f for f in os.listdir(out_dir) if f.lower().endswith(".png")],
        key=lambda f: os.path.getmtime(os.path.join(out_dir, f)),
    )
    budget = max(0, keep - len([p for p in pngs if p in keep_names]))
    for name in pngs:
        if name in keep_names:
            continue
        if budget <= 0:
            os.remove(os.path.join(out_dir, name))
        else:
            budget -= 1


def _finish(out_dir: str, report: Dict, log_lines: List[str]) -> None:
    with open(os.path.join(out_dir, "selftest.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    with open(os.path.join(out_dir, "selftest.log"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(log_lines) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
