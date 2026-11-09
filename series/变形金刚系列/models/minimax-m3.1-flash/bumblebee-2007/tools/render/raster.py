"""
raster.py — deterministic offline software rasterizer (pure numpy).

No GPU, no Blender, no browser.  Consumes the frozen scene contract produced
by ``tools/export.mjs``:

    artifacts/scene/manifest.json   meshes + materials
    artifacts/scene/frames.json     camera / instances / lights per frame

and renders an sRGB uint8 image.

Design notes
------------
* Geometry is transformed, clipped against the near plane, projected and then
  rasterized in **screen tiles** (32x32 by default).  A triangle only ever
  produces candidates inside the tiles it overlaps, and each (triangle, tile)
  pair is capped at ``tile_size**2`` candidate pixels.
* Depth is resolved with a packed 64-bit scatter-max:
  ``packed = (depth_bits << 32) | fragment_id`` where ``depth_bits`` is the
  IEEE754 bit pattern of ``1/w`` (monotonic for positive floats).  The largest
  packed value per pixel therefore wins, which is exactly "nearest fragment",
  with a deterministic tie-break on the fragment id.  ``np.maximum.at`` keeps
  this O(n) with no sort.
* Shading is Cook-Torrance / GGX with a metallic-roughness workflow, three
  directional lights, hemispherical ambient and Fresnel edge lift.
* The ground is an analytic infinite plane (ray/plane) with a soft contact
  shadow derived from the projected world-space AABB of every instance.
* Post: threshold + separable box blur (x3) bloom, ACES filmic tonemap,
  vignette, fixed-seed film grain, sRGB transfer.

Everything is deterministic: identical inputs produce byte-identical frames.
"""

from __future__ import annotations

import os as _os

# --- thread pinning -------------------------------------------------------
# This must happen *before* numpy is imported, because the math libraries
# read these variables when they are loaded.  The renderer is dominated by
# element-wise numpy work rather than BLAS kernels; on hosts with a broken or
# misconfigured OpenMP runtime the default multi-threaded math libraries are
# pathologically slow and wildly variable in timing, and they also
# oversubscribe the CPU once render_film.py fans out over worker processes.
# Pinning to one thread is both faster and far more reproducible.  An
# explicit value from the environment always wins.
for _thread_var in (
    "OPENBLAS_NUM_THREADS",
    "OMP_NUM_THREADS",
    "MKL_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
    "NUMEXPR_NUM_THREADS",
):
    _os.environ.setdefault(_thread_var, "1")

import json
import math
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

__all__ = [
    "Material",
    "Mesh",
    "Scene",
    "Camera",
    "Light",
    "Ambient",
    "GroundSpec",
    "Background",
    "Instance",
    "Frame",
    "RenderOptions",
    "MaterialTable",
    "load_scene",
    "load_frames",
    "render_frame",
]

_F32 = np.float32
_U32 = np.uint32
_U64 = np.uint64
_I32 = np.int32

_ACES_A = 2.51
_ACES_B = 0.03
_ACES_C = 2.43
_ACES_D = 0.59
_ACES_E = 0.14

_LUMA = np.array([0.2126, 0.7152, 0.0722], _F32)


# ---------------------------------------------------------------------------
# scene data model
# ---------------------------------------------------------------------------


@dataclass
class Material:
    name: str
    base_color: np.ndarray
    metallic: float
    roughness: float
    emissive: np.ndarray
    emissive_strength: float
    double_sided: bool = False


@dataclass
class Mesh:
    id: int
    name: str
    positions: np.ndarray  # (V,3) float32
    normals: np.ndarray  # (V,3) float32
    indices: np.ndarray  # (T,3) int32
    _triangles: Optional[np.ndarray] = None
    _tri_normals: Optional[np.ndarray] = None
    _aabb_corners: Optional[np.ndarray] = None

    @property
    def triangles(self) -> np.ndarray:
        """(T,3,3) float32 triangle corners."""
        if self._triangles is None:
            self._triangles = self.positions[self.indices]
        return self._triangles

    @property
    def tri_normals(self) -> np.ndarray:
        """(T,3,3) float32 per-corner normals."""
        if self._tri_normals is None:
            self._tri_normals = self.normals[self.indices]
        return self._tri_normals

    @property
    def aabb_corners(self) -> np.ndarray:
        """(8,3) float32 corners of the local axis aligned bounding box."""
        if self._aabb_corners is None:
            lo = self.positions.min(axis=0)
            hi = self.positions.max(axis=0)
            c = np.array(
                [
                    [lo[0], lo[1], lo[2]],
                    [hi[0], lo[1], lo[2]],
                    [hi[0], hi[1], lo[2]],
                    [lo[0], hi[1], lo[2]],
                    [lo[0], lo[1], hi[2]],
                    [hi[0], lo[1], hi[2]],
                    [hi[0], hi[1], hi[2]],
                    [lo[0], hi[1], hi[2]],
                ],
                _F32,
            )
            self._aabb_corners = c
        return self._aabb_corners

    @property
    def triangle_count(self) -> int:
        return int(self.indices.shape[0])


@dataclass
class Scene:
    meshes: List[Mesh]
    materials: Dict[str, Material]
    _by_id: Dict[int, Mesh] = field(default_factory=dict, repr=False)
    _mat_index: Dict[str, int] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        self._by_id = {m.id: m for m in self.meshes}
        self._mat_index = {name: i for i, name in enumerate(self.materials)}

    def mesh_by_id(self, mesh_id: int) -> Mesh:
        m = self._by_id.get(int(mesh_id))
        if m is None:
            raise KeyError(f"mesh id {mesh_id} not present in manifest")
        return m

    def material_index(self, name: str) -> int:
        idx = self._mat_index.get(name)
        if idx is None:
            raise KeyError(f"material {name!r} not present in manifest")
        return idx

    @property
    def triangle_count(self) -> int:
        return sum(m.triangle_count for m in self.meshes)


@dataclass
class Camera:
    eye: np.ndarray
    target: np.ndarray
    up: np.ndarray
    fov: float
    near: float
    far: float


@dataclass
class Light:
    name: str
    dir: np.ndarray  # propagation direction (light -> scene)
    color: np.ndarray
    intensity: float

    @property
    def to_light(self) -> np.ndarray:
        d = np.asarray(self.dir, _F32)
        n = float(np.linalg.norm(d))
        if n < 1e-8:
            return np.array([0.0, 1.0, 0.0], _F32)
        return (-d / n).astype(_F32)


@dataclass
class Ambient:
    sky: np.ndarray
    ground: np.ndarray
    strength: float


@dataclass
class GroundSpec:
    enabled: bool
    color: np.ndarray
    grid: float
    roughness: float
    metallic: float


@dataclass
class Background:
    top: np.ndarray
    bottom: np.ndarray
    horizon_glow: float


@dataclass
class Instance:
    mesh: int
    matrix: np.ndarray  # (4,4) row-major; built from the column-major json array
    mat: str


@dataclass
class Frame:
    t: float
    camera: Camera
    instances: List[Instance]
    exposure: float
    lights: List[Light]
    ambient: Ambient
    ground: GroundSpec
    background: Background


@dataclass
class RenderOptions:
    """Tunables that do not come from the frozen scene contract."""

    ss: int = 1
    tile_size: int = 32
    candidate_budget: int = 1_200_000
    bloom_threshold: float = 1.0
    bloom_strength: float = 0.6
    bloom_downscale: int = 4
    bloom_passes: int = 3
    bloom_clamp_mult: float = 8.0
    vignette: float = 0.3
    grain: float = 0.012
    grain_seed: int = 20240101
    shadow_strength: float = 1.0
    shadow_resolution: int = 256
    cull_far: bool = True


@dataclass
class MaterialTable:
    """Flat per-material arrays for fast per-pixel lookup."""

    albedo: np.ndarray  # (M,3)
    metallic: np.ndarray  # (M,)
    roughness: np.ndarray  # (M,)
    emissive: np.ndarray  # (M,3)
    emissive_strength: np.ndarray  # (M,)
    index: Dict[str, int] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# loading
# ---------------------------------------------------------------------------


def _read_vec3(seq, default=(0.0, 0.0, 0.0)) -> np.ndarray:
    if seq is None:
        return np.array(default, _F32)
    return np.asarray(list(seq), _F32).reshape(3)


def load_scene(scene_dir: str) -> Scene:
    """Load ``manifest.json`` and all referenced mesh buffers."""
    manifest_path = os.path.join(scene_dir, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)

    meshes: List[Mesh] = []
    for spec in manifest.get("meshes", []):
        vcount = int(spec["vertexCount"])
        icount = int(spec["indexCount"])
        pos = np.fromfile(os.path.join(scene_dir, spec["positions"]), dtype="<f4")
        nrm = np.fromfile(os.path.join(scene_dir, spec["normals"]), dtype="<f4")
        idx = np.fromfile(os.path.join(scene_dir, spec["indices"]), dtype="<u4")
        if pos.size < vcount * 3:
            raise ValueError(f"{spec['positions']}: expected {vcount * 3} floats, got {pos.size}")
        if nrm.size < vcount * 3:
            raise ValueError(f"{spec['normals']}: expected {vcount * 3} floats, got {nrm.size}")
        if idx.size < icount:
            raise ValueError(f"{spec['indices']}: expected {icount} uint32, got {idx.size}")
        meshes.append(
            Mesh(
                id=int(spec["id"]),
                name=str(spec.get("name", spec["id"])),
                positions=pos[: vcount * 3].reshape(vcount, 3).astype(_F32, copy=True),
                normals=nrm[: vcount * 3].reshape(vcount, 3).astype(_F32, copy=True),
                indices=idx[:icount].reshape(-1, 3).astype(np.int64, copy=True),
            )
        )

    materials: Dict[str, Material] = {}
    for name, spec in manifest.get("materials", {}).items():
        materials[name] = Material(
            name=name,
            base_color=_read_vec3(spec.get("baseColor"), (0.8, 0.8, 0.8)),
            metallic=float(spec.get("metallic", 0.0)),
            roughness=float(spec.get("roughness", 0.5)),
            emissive=_read_vec3(spec.get("emissive"), (0.0, 0.0, 0.0)),
            emissive_strength=float(spec.get("emissiveStrength", 0.0)),
            double_sided=bool(spec.get("doubleSided", False)),
        )

    return Scene(meshes=meshes, materials=materials)


def load_frames(scene_dir: str) -> Tuple[List[Frame], Dict]:
    """Load ``frames.json``; returns ``(frames, meta)``."""
    with open(os.path.join(scene_dir, "frames.json"), "r", encoding="utf-8") as fh:
        doc = json.load(fh)

    raw_frames = doc.get("frames", [])
    frames: List[Frame] = []
    for spec in raw_frames:
        cam = spec["camera"]
        camera = Camera(
            eye=_read_vec3(cam.get("eye")),
            target=_read_vec3(cam.get("target")),
            up=_read_vec3(cam.get("up"), (0.0, 1.0, 0.0)),
            fov=float(cam.get("fov", 45.0)),
            near=float(cam.get("near", 0.05)),
            far=float(cam.get("far", 1000.0)),
        )
        instances: List[Instance] = []
        for inst in spec.get("instances", []):
            m = np.asarray(inst["m"], dtype=_F32).reshape(4, 4, order="F")
            instances.append(Instance(mesh=int(inst["mesh"]), matrix=m, mat=str(inst["mat"])))
        lights: List[Light] = []
        for lname, lspec in (spec.get("lights") or {}).items():
            lights.append(
                Light(
                    name=lname,
                    dir=_read_vec3(lspec.get("dir"), (0.0, -1.0, 0.0)),
                    color=_read_vec3(lspec.get("color"), (1.0, 1.0, 1.0)),
                    intensity=float(lspec.get("intensity", 1.0)),
                )
            )
        amb = spec.get("ambient") or {}
        ambient = Ambient(
            sky=_read_vec3(amb.get("sky"), (0.1, 0.1, 0.12)),
            ground=_read_vec3(amb.get("ground"), (0.05, 0.05, 0.05)),
            strength=float(amb.get("strength", 1.0)),
        )
        gnd = spec.get("ground") or {}
        ground = GroundSpec(
            enabled=bool(gnd.get("enabled", False)),
            color=_read_vec3(gnd.get("color"), (0.05, 0.05, 0.05)),
            grid=float(gnd.get("grid", 0.0)),
            roughness=float(gnd.get("roughness", 0.5)),
            metallic=float(gnd.get("metallic", 0.0)),
        )
        bg = spec.get("background") or {}
        background = Background(
            top=_read_vec3(bg.get("top"), (0.02, 0.02, 0.03)),
            bottom=_read_vec3(bg.get("bottom"), (0.0, 0.0, 0.0)),
            horizon_glow=float(bg.get("horizonGlow", 0.0)),
        )
        frames.append(
            Frame(
                t=float(spec.get("t", 0.0)),
                camera=camera,
                instances=instances,
                exposure=float(spec.get("exposure", 1.0)),
                lights=lights,
                ambient=ambient,
                ground=ground,
                background=background,
            )
        )

    meta = {
        "fps": int(doc.get("fps", 24)),
        "count": int(doc.get("count", len(frames))),
        "width": int(doc.get("width", 1280)),
        "height": int(doc.get("height", 720)),
    }
    return frames, meta


# ---------------------------------------------------------------------------
# small math helpers
# ---------------------------------------------------------------------------


def _camera_basis(cam: Camera):
    """Return (eye, right, up, forward) with a robust up-vector fallback."""
    eye = np.asarray(cam.eye, _F32).reshape(3)
    fwd = np.asarray(cam.target, _F32).reshape(3) - eye
    n = float(np.linalg.norm(fwd))
    if n < 1e-8:
        fwd = np.array([0.0, 0.0, -1.0], _F32)
    else:
        fwd = (fwd / n).astype(_F32)

    up = np.asarray(cam.up, _F32).reshape(3)
    if float(np.linalg.norm(up)) < 1e-8:
        up = np.array([0.0, 1.0, 0.0], _F32)

    right = np.cross(fwd, up)
    rn = float(np.linalg.norm(right))
    if rn < 1e-6:
        # up is parallel to the view direction -> pick any perpendicular axis
        alt = np.array([0.0, 1.0, 0.0], _F32) if abs(float(fwd[1])) < 0.9 else np.array([1.0, 0.0, 0.0], _F32)
        right = np.cross(fwd, alt)
        rn = float(np.linalg.norm(right))
        if rn < 1e-8:  # pragma: no cover - fwd is unit length, cannot happen
            right = np.array([1.0, 0.0, 0.0], _F32)
            rn = 1.0
    right = (right / rn).astype(_F32)
    upv = np.cross(right, fwd)
    upv = (upv / max(float(np.linalg.norm(upv)), 1e-8)).astype(_F32)
    return eye, right, upv, fwd.astype(_F32)


def _normal_matrix(m: np.ndarray) -> np.ndarray:
    """Inverse transpose of the upper-left 3x3, with a safe fallback."""
    m3 = m[:3, :3].astype(np.float64)
    try:
        det = float(np.linalg.det(m3))
        if abs(det) > 1e-12:
            return np.linalg.inv(m3).T
    except np.linalg.LinAlgError:
        pass
    return m3


def _resize_bilinear(a: np.ndarray, w: int, h: int) -> np.ndarray:
    """Bilinear resize of an (H,W,C) float32 array."""
    H, W, C = a.shape
    if H == h and W == w:
        return a
    ys = (np.arange(h, dtype=np.float64) + 0.5) * (H / h) - 0.5
    xs = (np.arange(w, dtype=np.float64) + 0.5) * (W / w) - 0.5
    y0 = np.floor(ys).astype(np.int64)
    x0 = np.floor(xs).astype(np.int64)
    fy = (ys - y0).astype(_F32)[:, None, None]
    fx = (xs - x0).astype(_F32)[None, :, None]
    y0c = np.clip(y0, 0, H - 1)
    x0c = np.clip(x0, 0, W - 1)
    y1c = np.clip(y0 + 1, 0, H - 1)
    x1c = np.clip(x0 + 1, 0, W - 1)
    a00 = a[np.ix_(y0c, x0c)]
    a01 = a[np.ix_(y0c, x1c)]
    a10 = a[np.ix_(y1c, x0c)]
    a11 = a[np.ix_(y1c, x1c)]
    top = a00 * (1.0 - fx) + a01 * fx
    bot = a10 * (1.0 - fx) + a11 * fx
    return (top * (1.0 - fy) + bot * fy).astype(_F32, copy=False)


def _box_blur_1d(a: np.ndarray, radius: int, axis: int) -> np.ndarray:
    """Separable box blur via a cumulative sum (O(1) per pixel)."""
    if radius < 1:
        return a
    a = np.moveaxis(a, axis, 0)
    n = a.shape[0]
    pad = np.concatenate(
        [np.repeat(a[:1], radius, axis=0), a, np.repeat(a[-1:], radius, axis=0)], axis=0
    )
    cs = np.zeros((pad.shape[0] + 1,) + pad.shape[1:], _F32)
    np.cumsum(pad, axis=0, out=cs[1:])
    out = (cs[radius * 2 + 1 : radius * 2 + 1 + n] - cs[:n]) / np.float32(2 * radius + 1)
    return np.moveaxis(out.astype(_F32, copy=False), 0, axis)


def _box_blur(a: np.ndarray, radius: int) -> np.ndarray:
    """2D box blur (separable)."""
    if radius < 1:
        return a
    out = _box_blur_1d(a, radius, 0)
    out = _box_blur_1d(out, radius, 1)
    return out


def _box_downsample(a: np.ndarray, factor: int) -> np.ndarray:
    """Area-average downsample by an integer factor.

    A bilinear (or point) downsample would alias a single very bright pixel
    into one texel, which then upsamples into a visible square blob.  Averaging
    the whole footprint spreads that energy smoothly instead.
    """
    if factor <= 1:
        return a
    h, w, c = a.shape
    hh = (h // factor) * factor
    ww = (w // factor) * factor
    if hh == 0 or ww == 0:
        return a
    return a[:hh, :ww].reshape(hh // factor, factor, ww // factor, factor, c).mean(axis=(1, 3))


# ---------------------------------------------------------------------------
# near plane clipping
# ---------------------------------------------------------------------------


def _clip_near(data: np.ndarray, near: float) -> Tuple[np.ndarray, np.ndarray]:
    """Clip triangles against the near plane (view space z <= -near).

    ``data`` is (T,3,C) with ``C >= 3``; columns 0..2 are view-space xyz and the
    remaining columns are per-vertex attributes that are interpolated linearly
    during clipping.  Returns ``(clipped, source)`` where ``clipped`` is
    (T',3,C) float32 and ``source`` maps every output triangle back to the
    input triangle it came from (a triangle straddling the near plane yields
    two output triangles).
    """
    if data.shape[0] == 0:
        return np.zeros((0, 3, data.shape[2]), _F32), np.zeros(0, np.int64)

    d = -data[:, :, 2].astype(np.float64) - near  # >= 0 in front of the near plane
    front = d >= 0.0
    cnt = front.sum(axis=1)
    pieces: List[np.ndarray] = []
    srcs: List[np.ndarray] = []

    m3 = cnt == 3
    if m3.any():
        pieces.append(data[m3])
        srcs.append(np.flatnonzero(m3))

    m1 = cnt == 1
    if m1.any():
        sub = data[m1]
        ds = d[m1]
        fr = front[m1]
        idx = np.arange(sub.shape[0])
        p = fr.argmax(axis=1)
        q = (p + 1) % 3
        r = (p + 2) % 3
        vp, vq, vr = sub[idx, p], sub[idx, q], sub[idx, r]
        dp, dq, dr = ds[idx, p], ds[idx, q], ds[idx, r]
        den_q = dp - dq
        den_r = dp - dr
        den_q = np.where(np.abs(den_q) < 1e-12, 1.0, den_q)
        den_r = np.where(np.abs(den_r) < 1e-12, 1.0, den_r)
        ipq = vp + (dp / den_q)[:, None] * (vq - vp)
        ipr = vp + (dp / den_r)[:, None] * (vr - vp)
        pieces.append(np.stack([vp, ipq, ipr], axis=1))
        srcs.append(np.flatnonzero(m1))

    m2 = cnt == 2
    if m2.any():
        sub = data[m2]
        ds = d[m2]
        fr = front[m2]
        idx = np.arange(sub.shape[0])
        b = (~fr).argmax(axis=1)
        p = (b + 1) % 3
        q = (b + 2) % 3
        vp, vq, vb = sub[idx, p], sub[idx, q], sub[idx, b]
        dp, dq, db = ds[idx, p], ds[idx, q], ds[idx, b]
        den1 = dp - db
        den2 = dq - db
        den1 = np.where(np.abs(den1) < 1e-12, 1.0, den1)
        den2 = np.where(np.abs(den2) < 1e-12, 1.0, den2)
        ipb = vp + (dp / den1)[:, None] * (vb - vp)
        iqb = vq + (dq / den2)[:, None] * (vb - vq)
        t1 = np.stack([vp, vq, iqb], axis=1)
        t2 = np.stack([vp, iqb, ipb], axis=1)
        pieces.append(np.concatenate([t1, t2], axis=0))
        srcs.append(np.repeat(np.flatnonzero(m2), 2))

    if not pieces:
        return np.zeros((0, 3, data.shape[2]), _F32), np.zeros(0, np.int64)
    return (
        np.concatenate(pieces, axis=0).astype(_F32, copy=False),
        np.concatenate(srcs).astype(np.int64, copy=False),
    )


# ---------------------------------------------------------------------------
# rasterizer
# ---------------------------------------------------------------------------


class _GBuffer:
    """Flat (pixel indexed) G-buffer."""

    def __init__(self, w: int, h: int):
        n = w * h
        self.width = w
        self.height = h
        self.packed = np.zeros(n, _U64)  # (depth_bits << 32) | fragment_id
        self.normal = np.zeros((n, 3), _F32)
        self.position = np.zeros((n, 3), _F32)
        self.material = np.full(n, -1, _I32)

    def has_geometry(self) -> np.ndarray:
        return self.packed != 0


def _rasterize(
    tri_screen: np.ndarray,
    tri_iw: np.ndarray,
    tri_nrm: np.ndarray,
    tri_pos: np.ndarray,
    tri_mat: np.ndarray,
    gbuf: _GBuffer,
    width: int,
    height: int,
    opts: RenderOptions,
) -> int:
    """Rasterize screen-space triangles into ``gbuf``.

    ``tri_screen`` (T,3,2) float64, ``tri_iw`` (T,3) float32 (1/w per corner),
    ``tri_nrm``/``tri_pos`` (T,3,3) float32 per-corner attributes.
    Returns the number of candidate fragments produced.
    """
    ntri = tri_screen.shape[0]
    if ntri == 0:
        return 0

    tile = max(8, int(opts.tile_size))
    tiles_x = (width + tile - 1) // tile
    tiles_y = (height + tile - 1) // tile

    # screen bounding box per triangle
    sx = tri_screen[:, :, 0]
    sy = tri_screen[:, :, 1]
    # guard against inf / nan projections (a vertex very close to the near plane)
    sx = np.nan_to_num(sx, nan=0.0, posinf=1e6, neginf=-1e6)
    sy = np.nan_to_num(sy, nan=0.0, posinf=1e6, neginf=-1e6)
    x0 = np.floor(sx.min(axis=1)).astype(np.int64)
    x1 = np.ceil(sx.max(axis=1)).astype(np.int64)
    y0 = np.floor(sy.min(axis=1)).astype(np.int64)
    y1 = np.ceil(sy.max(axis=1)).astype(np.int64)
    np.clip(x0, 0, width - 1, out=x0)
    np.clip(x1, 0, width - 1, out=x1)
    np.clip(y0, 0, height - 1, out=y0)
    np.clip(y1, 0, height - 1, out=y1)
    visible = (x0 <= x1) & (y0 <= y1)
    if not visible.any():
        return 0
    idx_vis = np.flatnonzero(visible)

    tx0 = (x0[idx_vis] // tile).astype(np.int64)
    tx1 = (x1[idx_vis] // tile).astype(np.int64)
    ty0 = (y0[idx_vis] // tile).astype(np.int64)
    ty1 = (y1[idx_vis] // tile).astype(np.int64)
    ntx = tx1 - tx0 + 1
    nty = ty1 - ty0 + 1
    npair = ntx * nty

    # ragged (triangle, tile) pairs
    total_pairs = int(npair.sum())
    tri_ids = np.repeat(idx_vis, npair)
    starts = np.cumsum(npair) - npair
    k = np.arange(total_pairs, dtype=np.int64) - starts[tri_ids]
    di = k % ntx[tri_ids]
    dj = k // ntx[tri_ids]
    tile_x = tx0[tri_ids] + di
    tile_y = ty0[tri_ids] + dj
    tile_id = tile_y * tiles_x + tile_x

    # group pairs by tile for locality + coherent early-z rejection
    order = np.argsort(tile_id, kind="stable")
    tri_ids = tri_ids[order]
    tile_x = tile_x[order]
    tile_y = tile_y[order]

    # clipped per-pair bounding box (pixels)
    px0 = np.maximum(x0[tri_ids], tile_x * tile)
    px1 = np.minimum(x1[tri_ids], tile_x * tile + tile - 1)
    py0 = np.maximum(y0[tri_ids], tile_y * tile)
    py1 = np.minimum(y1[tri_ids], tile_y * tile + tile - 1)
    pw = (px1 - px0 + 1).astype(np.int64)
    ph = (py1 - py0 + 1).astype(np.int64)
    area = pw * ph

    cum = np.cumsum(area)
    total_fragments = int(cum[-1]) if cum.size else 0
    if total_fragments == 0:
        return 0

    budget = max(1, int(opts.candidate_budget))
    # chunk boundaries so that each batch stays inside the memory budget
    chunk_bounds = [0]
    acc = 0
    for i in range(area.size):
        acc += int(area[i])
        if acc >= budget:
            chunk_bounds.append(i + 1)
            acc = 0
    if chunk_bounds[-1] != area.size:
        chunk_bounds.append(area.size)

    frag_counter = 0
    produced = 0
    for c in range(len(chunk_bounds) - 1):
        lo, hi = chunk_bounds[c], chunk_bounds[c + 1]
        counts = area[lo:hi]
        total = int(counts.sum())
        if total == 0:
            continue
        pair_off = np.cumsum(counts) - counts
        pair_idx = np.repeat(np.arange(hi - lo, dtype=np.int64), counts)
        local = np.arange(total, dtype=np.int64) - pair_off[pair_idx]
        w_c = pw[lo:hi][pair_idx]
        h_c = ph[lo:hi][pair_idx]
        lx = local % w_c
        ly = local // w_c
        px = px0[lo:hi][pair_idx] + lx
        py = py0[lo:hi][pair_idx] + ly
        tri = tri_ids[lo:hi][pair_idx]
        produced += total

        # sample at pixel centres (the sub-pixel grid of an ss=N render is the
        # centre of each Nth pixel), otherwise the image is offset by half a
        # pixel relative to the projection
        fpx = px + 0.5
        fpy = py + 0.5

        # edge functions in float64 (screen coords are float64 for precision)
        ax = tri_screen[tri, 0, 0]
        ay = tri_screen[tri, 0, 1]
        bx = tri_screen[tri, 1, 0]
        by = tri_screen[tri, 1, 1]
        cx = tri_screen[tri, 2, 0]
        cy = tri_screen[tri, 2, 1]
        area2 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        e0 = (cx - bx) * (fpy - by) - (cy - by) * (fpx - bx)
        e1 = (ax - cx) * (fpy - cy) - (ay - cy) * (fpx - cx)
        e2 = (bx - ax) * (fpy - ay) - (by - ay) * (fpx - ax)

        ok = np.abs(area2) > 1e-12
        inside = (
            ((e0 >= 0) & (e1 >= 0) & (e2 >= 0)) | ((e0 <= 0) & (e1 <= 0) & (e2 <= 0))
        ) & ok
        if not inside.any():
            continue

        # keep only the fragments inside the triangle, then derive barycentrics
        px = px[inside]
        py = py[inside]
        tri = tri[inside]
        # NB: area2/e0/e1/e2 are indexed by *candidate*, not by triangle
        inv_area2 = 1.0 / area2[inside]
        l0 = (e0[inside] * inv_area2).astype(_F32)
        l1 = (e1[inside] * inv_area2).astype(_F32)
        l2 = (e2[inside] * inv_area2).astype(_F32)
        del e0, e1, e2, inv_area2, inside

        # perspective correct weights
        iw = tri_iw[tri]
        pw0 = l0 * iw[:, 0]
        pw1 = l1 * iw[:, 1]
        pw2 = l2 * iw[:, 2]
        inv_depth = pw0 + pw1 + pw2
        good = inv_depth > 0.0
        if not good.all():
            px, py, tri = px[good], py[good], tri[good]
            pw0, pw1, pw2 = pw0[good], pw1[good], pw2[good]
            inv_depth = inv_depth[good]
        if px.size == 0:
            continue

        flat = py * width + px
        depth_bits = inv_depth.astype(_F32).view(_U32)

        # early-z: reject fragments already covered by a nearer one
        cur = (gbuf.packed[flat] >> _U64(32)).astype(_U32)
        keep = depth_bits > cur
        if not keep.all():
            px, py, flat, tri = px[keep], py[keep], flat[keep], tri[keep]
            pw0, pw1, pw2 = pw0[keep], pw1[keep], pw2[keep]
            inv_depth = inv_depth[keep]
            depth_bits = depth_bits[keep]
        if px.size == 0:
            continue

        frag_ids = np.arange(frag_counter, frag_counter + px.size, dtype=_U64)
        frag_counter += px.size
        packed = (depth_bits.astype(_U64) << _U64(32)) | frag_ids
        np.maximum.at(gbuf.packed, flat, packed)

        # winners of this batch (unique per pixel thanks to unique frag ids)
        won = gbuf.packed[flat] == packed
        if not won.any():
            continue
        widx = np.flatnonzero(won)
        wflat = flat[widx]
        wt = tri[widx]
        inv_d = inv_depth[widx]
        a0 = pw0[widx]
        a1 = pw1[widx]
        a2 = pw2[widx]
        n = (
            a0[:, None] * tri_nrm[wt, 0]
            + a1[:, None] * tri_nrm[wt, 1]
            + a2[:, None] * tri_nrm[wt, 2]
        ) / inv_d[:, None]
        p = (
            a0[:, None] * tri_pos[wt, 0]
            + a1[:, None] * tri_pos[wt, 1]
            + a2[:, None] * tri_pos[wt, 2]
        ) / inv_d[:, None]
        gbuf.normal[wflat] = n
        gbuf.position[wflat] = p
        gbuf.material[wflat] = tri_mat[wt]

    return produced


# ---------------------------------------------------------------------------
# contact shadow
# ---------------------------------------------------------------------------


class _ShadowField:
    """Soft contact shadow built from projected instance bounding boxes."""

    def __init__(self, boxes: Sequence[Tuple[np.ndarray, np.ndarray]], light_dir: np.ndarray, opts: RenderOptions):
        self.valid = False
        self.grid = None
        if not boxes:
            return
        d = np.asarray(light_dir, _F32).reshape(3)
        n = float(np.linalg.norm(d))
        if n < 1e-8 or d[1] >= -1e-4:
            return  # light does not point downwards -> no ground shadow
        d = (d / n).astype(_F32)

        rects = []
        for lo, hi in boxes:
            corners = np.array(
                [
                    [lo[0], lo[1], lo[2]],
                    [hi[0], lo[1], lo[2]],
                    [hi[0], hi[1], lo[2]],
                    [lo[0], hi[1], lo[2]],
                    [lo[0], lo[1], hi[2]],
                    [hi[0], lo[1], hi[2]],
                    [hi[0], hi[1], hi[2]],
                    [lo[0], hi[1], hi[2]],
                ],
                _F32,
            )
            s = -corners[:, 1] / d[1]
            px = corners[:, 0] + s * d[0]
            pz = corners[:, 2] + s * d[2]
            rects.append(
                (
                    float(px.min()),
                    float(px.max()),
                    float(pz.min()),
                    float(pz.max()),
                    max(0.0, float(lo[1])),
                )
            )

        gx0 = min(r[0] for r in rects)
        gx1 = max(r[1] for r in rects)
        gz0 = min(r[2] for r in rects)
        gz1 = max(r[3] for r in rects)
        ex = max(gx1 - gx0, 1e-3)
        ez = max(gz1 - gz0, 1e-3)
        res = max(16, int(opts.shadow_resolution))
        nx = res
        nz = max(8, int(round(res * ez / ex)))
        cx = ex / nx
        cz = ez / nz
        grid = np.zeros(nx * nz, _F32)

        for (rx0, rx1, rz0, rz1, ymin) in rects:
            # soften + fade with the height of the caster above the ground
            grow = 1.0 + 0.25 * ymin
            ccx = 0.5 * (rx0 + rx1)
            ccz = 0.5 * (rz0 + rz1)
            rad_x = max(0.5 * (rx1 - rx0) * grow, 1e-3)
            rad_z = max(0.5 * (rz1 - rz0) * grow, 1e-3)
            inten = math.exp(-0.55 * ymin) * float(opts.shadow_strength)
            if inten <= 1e-3:
                continue
            ix0 = int(np.clip(np.floor((ccx - rad_x - gx0) / cx), 0, nx - 1))
            ix1 = int(np.clip(np.ceil((ccx + rad_x - gx0) / cx), 0, nx - 1))
            iz0 = int(np.clip(np.floor((ccz - rad_z - gz0) / cz), 0, nz - 1))
            iz1 = int(np.clip(np.ceil((ccz + rad_z - gz0) / cz), 0, nz - 1))
            if ix1 < ix0 or iz1 < iz0:
                continue
            gxs = (np.arange(ix0, ix1 + 1, dtype=np.float64) + 0.5) * cx + gx0
            gzs = (np.arange(iz0, iz1 + 1, dtype=np.float64) + 0.5) * cz + gz0
            u = ((gxs - ccx) / rad_x)[:, None]
            v = ((gzs - ccz) / rad_z)[None, :]
            r2 = u * u + v * v
            cov = np.where(r2 < 1.0, (1.0 - r2) ** 2, 0.0) * inten
            idx = (
                np.arange(iz0, iz1 + 1, dtype=np.int64)[:, None] * nx
                + np.arange(ix0, ix1 + 1, dtype=np.int64)[None, :]
            )
            grid += np.bincount(
                idx.ravel(), weights=cov.ravel().astype(np.float64), minlength=nx * nz
            ).astype(_F32)

        self.valid = True
        # smooth the accumulated field: bilinear interpolation of a piecewise
        # constant grid would otherwise show the cell boundaries as facets
        g2 = grid.reshape(nz, nx, 1)
        g2 = _box_blur(g2, 1)
        g2 = _box_blur(g2, 1)
        self.grid = g2.reshape(nz, nx)
        self.gx0 = gx0
        self.gz0 = gz0
        self.cx = cx
        self.cz = cz
        self.nx = nx
        self.nz = nz

    def sample(self, px: np.ndarray, pz: np.ndarray) -> np.ndarray:
        """Shadow factor in (0,1]; 1 == fully lit."""
        if not self.valid:
            return np.ones(px.shape, _F32)
        fx = (px - self.gx0) / self.cx - 0.5
        fz = (pz - self.gz0) / self.cz - 0.5
        x0 = np.floor(fx).astype(np.int64)
        z0 = np.floor(fz).astype(np.int64)
        tx = (fx - x0).astype(_F32)
        tz = (fz - z0).astype(_F32)
        x0c = np.clip(x0, 0, self.nx - 1)
        x1c = np.clip(x0 + 1, 0, self.nx - 1)
        z0c = np.clip(z0, 0, self.nz - 1)
        z1c = np.clip(z0 + 1, 0, self.nz - 1)
        g = self.grid.ravel()
        nx = self.nx
        a = g[z0c * nx + x0c]
        b = g[z0c * nx + x1c]
        c = g[z1c * nx + x0c]
        d = g[z1c * nx + x1c]
        top = a * (1.0 - tx) + b * tx
        bot = c * (1.0 - tx) + d * tx
        dens = top * (1.0 - tz) + bot * tz
        return np.exp(-2.2 * dens).astype(_F32)


# ---------------------------------------------------------------------------
# shading
# ---------------------------------------------------------------------------


def _material_table(scene: Scene, frame: Frame) -> MaterialTable:
    names = list(scene.materials.keys())
    m = len(names)
    albedo = np.zeros((m, 3), _F32)
    metallic = np.zeros(m, _F32)
    roughness = np.full(m, 0.5, _F32)
    emissive = np.zeros((m, 3), _F32)
    estr = np.zeros(m, _F32)
    for i, name in enumerate(names):
        mat = scene.materials[name]
        albedo[i] = mat.base_color
        metallic[i] = mat.metallic
        roughness[i] = mat.roughness
        emissive[i] = mat.emissive
        estr[i] = mat.emissive_strength
    if m == 0:
        # a scene without materials still needs one slot for the shading arrays
        names = ["__default__"]
        albedo = np.array([[0.8, 0.8, 0.8]], _F32)
        metallic = np.zeros(1, _F32)
        roughness = np.full(1, 0.5, _F32)
        emissive = np.zeros((1, 3), _F32)
        estr = np.zeros(1, _F32)
        m = 1
    return MaterialTable(albedo, metallic, roughness, emissive, estr, {n: i for i, n in enumerate(names)})


def _shade(
    n: np.ndarray,
    pos: np.ndarray,
    view: np.ndarray,
    midx: np.ndarray,
    table: MaterialTable,
    lights: List[Light],
    ambient: Ambient,
    shadow: np.ndarray,
    shadow_light: int,
) -> np.ndarray:
    """Cook-Torrance / GGX shading for a flat list of pixels."""
    count = n.shape[0]
    if count == 0:
        return np.zeros((0, 3), _F32)

    n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-8)
    ndv = np.einsum("ij,ij->i", n, view)
    flip = ndv < 0.0
    n[flip] *= -1.0
    ndv = np.clip(np.abs(ndv), 1e-4, None)

    base = table.albedo[midx]
    metal = table.metallic[midx]
    rough = np.clip(table.roughness[midx], 0.045, 1.0)
    f0 = 0.04 + (base - 0.04) * metal[:, None]
    diff_col = base * (1.0 - metal[:, None])

    alpha = (rough * rough)[:, None]
    a2 = alpha * alpha
    lo = np.zeros((count, 3), _F32)

    for li, light in enumerate(lights):
        l = light.to_light
        radiance = (light.color * light.intensity).astype(_F32)
        ndl = n @ l
        positive = ndl > 0.0
        ndl_c = np.maximum(ndl, 0.0)
        hv = l + view
        hv = hv / np.maximum(np.linalg.norm(hv, axis=1, keepdims=True), 1e-8)
        ndh = np.clip(np.einsum("ij,ij->i", n, hv), 0.0, None)
        vdh = np.clip(np.einsum("ij,ij->i", view, hv), 0.0, None)

        denom = ndh * ndh * (a2[:, 0] - 1.0) + 1.0
        d = a2[:, 0] / np.maximum(np.pi * denom * denom, 1e-8)
        k = ((rough + 1.0) ** 2) / 8.0
        gv = ndv / (ndv * (1.0 - k) + k)
        gl = ndl_c / np.maximum(ndl_c * (1.0 - k) + k, 1e-8)
        g = (gv * gl)[:, None]
        fres = f0 + (1.0 - f0) * ((1.0 - vdh) ** 5)[:, None]
        spec = (d[:, None] * g * fres) / (4.0 * ndv)[:, None]

        diffuse = diff_col / np.pi * ndl_c[:, None]
        contrib = diffuse + spec
        contrib = np.where(positive[:, None], contrib, 0.0)
        if li == shadow_light:
            contrib = contrib * shadow[:, None]
        lo += contrib * radiance[None, :]

    # hemispherical ambient
    hemi_t = np.clip(0.5 * n[:, 1] + 0.5, 0.0, 1.0)
    amb = (ambient.ground[None, :] + (ambient.sky - ambient.ground)[None, :] * hemi_t[:, None]) * (
        ambient.strength
    )
    # the contact shadow also slightly attenuates the ambient so the subject
    # reads as grounded rather than floating above the ground
    lo += diff_col * amb * (0.55 + 0.45 * shadow)[:, None]

    # environment specular approximation + Fresnel edge lift
    refl = 2.0 * ndv[:, None] * n - view
    refl_t = np.clip(0.5 * refl[:, 1] + 0.5, 0.0, 1.0)
    env_r = (ambient.ground[None, :] + (ambient.sky - ambient.ground)[None, :] * refl_t[:, None]) * (
        ambient.strength
    )
    edge = (1.0 - ndv) ** 5
    fres_env = f0 + (np.maximum(1.0 - rough, 0.0)[:, None] - f0) * edge[:, None]
    lo += env_r * fres_env * (1.0 - 0.8 * rough)[:, None]

    lo += table.emissive[midx] * table.emissive_strength[midx][:, None]
    return lo.astype(_F32, copy=False)


# ---------------------------------------------------------------------------
# main entry point
# ---------------------------------------------------------------------------


def render_frame(
    scene: Scene,
    frame: Frame,
    width: int = 1280,
    height: int = 720,
    ss: int = 1,
    options: Optional[RenderOptions] = None,
    stats: Optional[Dict] = None,
) -> np.ndarray:
    """Render one frame into an sRGB uint8 array of shape (height, width, 3).

    ``stats``, when given, is filled with diagnostics (candidate fragments,
    non-finite pixels, ...).  The render is deterministic: identical inputs
    always produce identical bytes.
    """
    # numpy's float32 matmul/divide re-read the hardware FPU status flags after
    # the call.  A broken OpenMP runtime on the host leaves stale flags behind
    # and numpy then reports phantom "divide by zero" / "overflow" warnings for
    # results that are perfectly finite.  Silence the FP reporting here and
    # validate finiteness explicitly instead (see _render_frame).
    with np.errstate(all="ignore"):
        return _render_frame(scene, frame, width, height, ss, options, stats)


def _render_frame(
    scene: Scene,
    frame: Frame,
    width: int = 1280,
    height: int = 720,
    ss: int = 1,
    options: Optional[RenderOptions] = None,
    stats: Optional[Dict] = None,
) -> np.ndarray:
    o = options or RenderOptions()
    ss = max(1, int(ss))
    width = int(width)
    height = int(height)
    rw = width * ss
    rh = height * ss

    cam = frame.camera
    eye, right, upv, fwd = _camera_basis(cam)
    focal = 1.0 / math.tan(math.radians(cam.fov) * 0.5)
    aspect = rw / rh
    near = max(float(cam.near), 1e-4)
    far = float(cam.far)

    view_mat = np.stack([right, upv, -fwd], axis=1)  # columns: right, up, -forward

    # ---- gather instance geometry -------------------------------------
    world_tris: List[np.ndarray] = []
    world_nrms: List[np.ndarray] = []
    tri_mats: List[np.ndarray] = []
    boxes: List[Tuple[np.ndarray, np.ndarray]] = []
    for inst in frame.instances:
        mesh = scene.mesh_by_id(inst.mesh)
        m = inst.matrix
        tri_l = mesh.triangles
        if tri_l.shape[0] == 0:
            continue
        wpos = tri_l @ m[:3, :3].T + m[:3, 3]
        nm = _normal_matrix(m)
        wnrm = mesh.tri_normals @ nm.T
        wnrm = wnrm / np.maximum(np.linalg.norm(wnrm, axis=2, keepdims=True), 1e-8)
        world_tris.append(wpos.astype(_F32, copy=False))
        world_nrms.append(wnrm.astype(_F32, copy=False))
        tri_mats.append(
            np.full(tri_l.shape[0], scene.material_index(inst.mat), _I32)
        )
        corners = mesh.aabb_corners @ m[:3, :3].T + m[:3, 3]
        boxes.append((corners.min(axis=0), corners.max(axis=0)))

    if world_tris:
        tri_world = np.concatenate(world_tris, axis=0)
        tri_nrm_world = np.concatenate(world_nrms, axis=0)
        tri_mat = np.concatenate(tri_mats, axis=0)
    else:
        tri_world = np.zeros((0, 3, 3), _F32)
        tri_nrm_world = np.zeros((0, 3, 3), _F32)
        tri_mat = np.zeros((0,), _I32)
    n_tri = tri_world.shape[0]

    # ---- view transform, near clip, project --------------------------
    if n_tri:
        view_pos = (tri_world.reshape(-1, 3) - eye) @ view_mat
        view_pos = view_pos.reshape(-1, 3, 3)
        if o.cull_far and far > near:
            beyond = (view_pos[:, :, 2] < -far).all(axis=1)
            if beyond.any():
                keep = ~beyond
                view_pos = view_pos[keep]
                tri_nrm_world = tri_nrm_world[keep]
                tri_world = tri_world[keep]
                tri_mat = tri_mat[keep]

        data = np.concatenate([view_pos, tri_nrm_world, tri_world], axis=2)
        clipped, src = _clip_near(data, near)
        if clipped.shape[0]:
            view_pos = clipped[:, :, :3]
            tri_nrm_c = clipped[:, :, 3:6]
            tri_pos_c = clipped[:, :, 6:9]
        else:
            view_pos = np.zeros((0, 3, 3), _F32)
            tri_nrm_c = np.zeros((0, 3, 3), _F32)
            tri_pos_c = np.zeros((0, 3, 3), _F32)
        # clipping can drop or split triangles: carry the material along
        tri_mat_c = tri_mat[src] if src.size else tri_mat

        w = np.maximum(-view_pos[:, :, 2], 1e-6)
        iw = (1.0 / w).astype(_F32)
        ndc_x = (view_pos[:, :, 0] * focal / aspect) * iw
        ndc_y = (view_pos[:, :, 1] * focal) * iw
        screen = np.empty((view_pos.shape[0], 3, 2), np.float64)
        screen[:, :, 0] = (ndc_x * 0.5 + 0.5) * rw
        screen[:, :, 1] = (0.5 - ndc_y * 0.5) * rh
    else:
        screen = np.zeros((0, 3, 2), np.float64)
        iw = np.zeros((0, 3), _F32)
        tri_nrm_c = np.zeros((0, 3, 3), _F32)
        tri_pos_c = np.zeros((0, 3, 3), _F32)
        tri_mat_c = tri_mat

    # ---- rasterize ----------------------------------------------------
    gbuf = _GBuffer(rw, rh)
    n_frag = _rasterize(
        screen, iw, tri_nrm_c, tri_pos_c, tri_mat_c, gbuf, rw, rh, o
    )

    has_geom = gbuf.has_geometry()

    # ---- material table (+ ground material) ---------------------------
    table = _material_table(scene, frame)
    ground_idx = len(table.albedo)
    if frame.ground.enabled:
        table.albedo = np.concatenate(
            [table.albedo, frame.ground.color.reshape(1, 3).astype(_F32)], axis=0
        )
        table.metallic = np.concatenate([table.metallic, np.array([frame.ground.metallic], _F32)])
        table.roughness = np.concatenate(
            [table.roughness, np.array([frame.ground.roughness], _F32)]
        )
        table.emissive = np.concatenate([table.emissive, np.zeros((1, 3), _F32)])
        table.emissive_strength = np.concatenate(
            [table.emissive_strength, np.zeros(1, _F32)]
        )

    # ---- background / ground rays -------------------------------------
    bg_idx = np.flatnonzero(~has_geom)
    dir_px = np.zeros((bg_idx.size, 3), _F32)
    if bg_idx.size:
        px = (bg_idx % rw).astype(np.float64)
        py = (bg_idx // rw).astype(np.float64)
        ndc_x = (px + 0.5) / rw * 2.0 - 1.0
        ndc_y = 1.0 - (py + 0.5) / rh * 2.0
        dir_px[:, 0] = right[0] * ndc_x * aspect / focal + upv[0] * ndc_y / focal + fwd[0]
        dir_px[:, 1] = right[1] * ndc_x * aspect / focal + upv[1] * ndc_y / focal + fwd[1]
        dir_px[:, 2] = right[2] * ndc_x * aspect / focal + upv[2] * ndc_y / focal + fwd[2]
        dir_px /= np.maximum(np.linalg.norm(dir_px, axis=1, keepdims=True), 1e-8)

    # ---- assemble the shading list ------------------------------------
    geom_idx = np.flatnonzero(has_geom)
    total = geom_idx.size + bg_idx.size
    nrm_all = np.zeros((total, 3), _F32)
    pos_all = np.zeros((total, 3), _F32)
    mat_all = np.zeros(total, _I32)
    shadow_all = np.ones(total, _F32)
    is_ground = np.zeros(total, bool)

    if geom_idx.size:
        nrm_all[: geom_idx.size] = gbuf.normal[geom_idx]
        pos_all[: geom_idx.size] = gbuf.position[geom_idx]
        mat_all[: geom_idx.size] = gbuf.material[geom_idx]

    ground_extra = np.zeros((total, 3), _F32)
    if frame.ground.enabled and bg_idx.size:
        d = dir_px[:, 1]
        with np.errstate(divide="ignore", invalid="ignore"):
            t = -float(eye[1]) / d
        hit = (d < -1e-6) & (t > near) & np.isfinite(t)
        if hit.any():
            gp = eye[None, :] + t[hit, None] * dir_px[hit]
            # rows of the assembled arrays that belong to these ground pixels
            g_rows = geom_idx.size + np.flatnonzero(hit)
            nrm_all[g_rows] = np.array([0.0, 1.0, 0.0], _F32)
            pos_all[g_rows] = gp
            mat_all[g_rows] = ground_idx
            is_ground[g_rows] = True

            # contact shadow from the projected instance bounding boxes
            key_idx = next((i for i, l in enumerate(frame.lights) if l.name == "key"), 0)
            if key_idx < len(frame.lights) and boxes:
                field = _ShadowField(boxes, frame.lights[key_idx].dir, o)
                if field.valid:
                    shadow_all[g_rows] = field.sample(gp[:, 0], gp[:, 2])

            # subtle world-space grid lines
            if frame.ground.grid > 1e-6:
                g = frame.ground.grid
                gx = np.abs(((gp[:, 0] / g) % 1.0) - 0.5) * g
                gz = np.abs(((gp[:, 2] / g) % 1.0) - 0.5) * g
                dist = np.linalg.norm(gp - eye[None, :], axis=1)
                aa = 0.006 + 0.006 * dist
                lx = 1.0 - np.clip(gx / aa, 0.0, 1.0)
                lz = 1.0 - np.clip(gz / aa, 0.0, 1.0)
                # fade the grid out once a cell is only a few pixels wide,
                # otherwise the distant ground turns into moire
                world_per_px = 2.0 * math.tan(math.radians(cam.fov) * 0.5) * dist / max(rh, 1)
                cell_px = g / np.maximum(world_per_px, 1e-9)
                fade = np.clip((cell_px - 4.0) / 4.0, 0.0, 1.0)
                line = (np.maximum(lx, lz) * 0.05 * fade)[:, None]
                ground_extra[g_rows] = line * np.array([1.0, 0.97, 0.9], _F32)

    view_all = eye[None, :] - pos_all
    view_all /= np.maximum(np.linalg.norm(view_all, axis=1, keepdims=True), 1e-8)

    shadow_light = -1
    for i, l in enumerate(frame.lights):
        if l.name == "key":
            shadow_light = i
            break
    if shadow_light < 0 and frame.lights:
        shadow_light = 0

    col = _shade(
        nrm_all, pos_all, view_all, mat_all, table, frame.lights, frame.ambient, shadow_all, shadow_light
    )
    col = col + ground_extra

    # ---- background gradient ------------------------------------------
    hdr = np.zeros((rh, rw, 3), _F32)
    flat_hdr = hdr.reshape(-1, 3)
    if geom_idx.size:
        flat_hdr[geom_idx] = col[: geom_idx.size]
    if bg_idx.size:
        bg_col = col[geom_idx.size :]
        dy = dir_px[:, 1]
        t = np.clip(dy * 0.5 + 0.5, 0.0, 1.0)[:, None]
        base = frame.background.bottom[None, :] + (
            frame.background.top - frame.background.bottom
        )[None, :] * t
        if frame.background.horizon_glow > 0.0:
            glow = np.exp(-((dy * 5.0) ** 2))[:, None] * frame.background.horizon_glow
            base = base + glow * (frame.background.top * 3.0 + 0.02)
        # ground pixels override the gradient
        gmask = is_ground[geom_idx.size :]
        base = np.where(gmask[:, None], bg_col, base)
        flat_hdr[bg_idx] = base

    hdr = _post_process(hdr, frame.exposure, o, ss, width, height)

    if stats is not None:
        stats["candidate_fragments"] = int(n_frag)
        stats["triangles_submitted"] = int(n_tri)
        stats["geometry_pixels"] = int(has_geom.sum())
        stats["ground_pixels"] = int(is_ground.sum())
        stats["nonfinite_pixels"] = int((~np.isfinite(hdr)).any(axis=2).sum())
    # never emit NaN pixels: a broken export would show up as black speckle
    if not np.isfinite(hdr).all():
        hdr = np.nan_to_num(hdr, nan=0.0, posinf=255.0, neginf=0.0)
    return hdr


def _post_process(
    hdr: np.ndarray, exposure: float, o: RenderOptions, ss: int, width: int, height: int
) -> np.ndarray:
    """Bloom, downsample, tonemap, vignette, grain and sRGB encode."""
    hdr = hdr * np.float32(exposure)

    if o.bloom_strength > 0.0 and hdr.size:
        lum = hdr @ _LUMA
        scale = np.maximum(lum - o.bloom_threshold, 0.0) / np.maximum(lum, 1e-4)
        bright = hdr * scale[:, :, None]
        # clamp fireflies: a single mirror highlight can be orders of magnitude
        # brighter than the rest of the frame and would otherwise dominate the
        # whole glow
        clamp = max(float(o.bloom_threshold), 1e-3) * float(o.bloom_clamp_mult)
        np.minimum(bright, clamp, out=bright)
        h, w = bright.shape[:2]
        d = max(1, int(o.bloom_downscale))
        small = _box_downsample(bright, d)
        for i in range(max(1, int(o.bloom_passes))):
            small = _box_blur(small, 1 + 2 * i)
        hdr = hdr + _resize_bilinear(small, w, h) * np.float32(o.bloom_strength)

    if ss > 1:
        hdr = hdr.reshape(height, ss, width, ss, 3).mean(axis=(1, 3))

    # vignette (lens falloff, applied in linear light)
    if o.vignette > 0.0:
        yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
        cx = max((width - 1) * 0.5, 1.0)
        cy = max((height - 1) * 0.5, 1.0)
        r = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2) / math.sqrt(2.0)
        hdr = hdr * (1.0 - np.float32(o.vignette) * np.clip(r, 0.0, 1.5) ** 2)[:, :, None]

    # ACES filmic tonemap
    x = np.clip(hdr, 0.0, None)
    hdr = np.clip((x * (_ACES_A * x + _ACES_B)) / (x * (_ACES_C * x + _ACES_D) + _ACES_E), 0.0, 1.0)

    # sRGB transfer
    hdr = np.clip(hdr, 0.0, 1.0)
    srgb = np.where(
        hdr <= 0.0031308, hdr * 12.92, 1.055 * np.power(hdr, 1.0 / 2.4) - 0.055
    )

    # Deterministic film grain.  It is applied in *display* space: adding it in
    # linear space would let the steep part of the sRGB curve multiply the
    # amplitude in dark areas several times over (a 0.012 linear step becomes
    # ~0.03 in sRGB near black).
    if o.grain > 0.0:
        rng = np.random.default_rng(int(o.grain_seed))
        noise = rng.standard_normal((height, width, 1)).astype(_F32)
        lum2 = srgb @ _LUMA
        srgb = srgb + noise * np.float32(o.grain) * (1.0 - 0.7 * lum2)[:, :, None]

    srgb = np.clip(srgb, 0.0, 1.0)
    return np.clip(srgb * 255.0 + 0.5, 0.0, 255.0).astype(np.uint8)
