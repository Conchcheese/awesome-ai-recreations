# tools/render — 离线软件光栅化渲染器

纯 Python + numpy + Pillow + ffmpeg 的**确定性**软件光栅化器。用于把
`tools/export.mjs` 导出的场景数据渲染成 PNG 序列 / MP4 短片。

- 无 GPU 依赖、无 Blender、无浏览器（Chromium/Playwright 在本机不可用）。
- 同一输入**逐帧字节级一致**（已验证：不同 `--workers` 数量、不同运行次数，
  SHA256 完全相同）。
- 只依赖 `numpy` / `Pillow` / `ffmpeg` / `ffprobe`，可脱离仓库其它部分独立运行，
  不 import 仓库里任何其它 Python 文件。

---

## 1. 目录内容

| 文件 | 作用 |
|---|---|
| `raster.py` | 渲染核心库（场景读取、光栅化、着色、后处理） |
| `render_film.py` | 命令行入口：渲染 PNG 序列 → ffmpeg 封装 MP4 |
| `make_test_scene.py` | 合成测试场景 + 自检（几何校验、耗时统计、出图） |
| `artifacts/_selftest/` | 自检产物：`selftest.json` / `selftest.log` / 验证图 / 测试场景 |

## 2. 快速开始

```bash
# 单帧快速迭代
python3 tools/render/render_film.py --scene artifacts/scene --frame 0 \
    --out /tmp/frame0.png --ss 1

# 整段渲染 + 封装 MP4（多进程）
python3 tools/render/render_film.py --scene artifacts/scene --out-dir artifacts/frames \
    --out-mp4 artifacts/film.mp4 --workers 8 --ss 1

# 只渲染一段区间（python 切片语义，右端不含）
python3 tools/render/render_film.py --scene artifacts/scene --frames 24:96 \
    --out-dir artifacts/frames --workers 8

# 跑自检（生成测试场景 + 校验 + 出图 + 计时）
python3 tools/render/make_test_scene.py --stress
```

## 3. CLI 参数（`render_film.py`）

| 参数 | 默认 | 说明 |
|---|---|---|
| `--scene DIR` | 必填 | 含 `manifest.json` / `frames.json` 的目录 |
| `--out FILE.png` | – | 输出一张 PNG（配合 `--frame`） |
| `--out-dir DIR` | – | 输出 PNG 序列 `frame_%05d.png` |
| `--out-mp4 FILE.mp4` | – | 用 ffmpeg 封装 MP4 |
| `--frame N` | – | 只渲染第 N 帧 |
| `--frames a:b` | 全部 | 帧区间，python 切片语义（右端不含）；`a:` / `:b` 可省略 |
| `--width` / `--height` | 取自 `frames.json` | 覆盖输出分辨率 |
| `--workers N` | 1 | 渲染进程数（每进程独立渲染一批帧） |
| `--ss {1,2}` | 1 | 超采样抗锯齿倍率 |
| `--no-audio` | 关 | 即使存在 wav 也不混音 |
| `--audio FILE` | 自动探测 | 指定要混入的 wav |
| `--fps` | 取自 `frames.json` | 覆盖帧率 |
| `--tile N` | 32 | 光栅化 tile 边长（像素） |
| `--budget N` | 1200000 | 单批次候选片元上限（内存护栏） |
| `--bloom-threshold` | 1.0 | bloom 亮度阈值 |
| `--bloom-strength` | 0.6 | bloom 强度 |
| `--bloom-clamp` | 8.0 | bloom 萤火虫钳制倍数（×阈值） |
| `--vignette` | 0.3 | 暗角强度 |
| `--grain` / `--grain-seed` | 0.012 / 20240101 | 胶片颗粒强度与固定 seed |
| `--shadow-strength` / `--shadow-resolution` | 1.0 / 192 | 接触阴影强度 / 阴影场分辨率 |

**音频**：默认探测 `<scene>/film.wav` 与 `<scene>/../film.wav`。找到则用 ffmpeg 混入
AAC 立体声并加 `-shortest`；找不到则输出**无声 MP4**（无音轨）。

## 4. 库 API

```python
import raster

scene  = raster.load_scene("artifacts/scene")          # Scene
frames, meta = raster.load_frames("artifacts/scene")   # list[Frame], dict

opts = raster.RenderOptions(ss=1, bloom_strength=0.6, ...)
stats = {}
img = raster.render_frame(scene, frames[0],
                          width=1280, height=720, ss=1,
                          options=opts, stats=stats)     # uint8 (H, W, 3) sRGB
# stats -> candidate_fragments / triangles_submitted / geometry_pixels /
#           ground_pixels / nonfinite_pixels
```

`raster.render_frame` 是唯一需要调用的入口；它不写文件、不调用 ffmpeg、
不依赖全局状态，可安全地在多进程中使用。

## 5. 实现要点

### 几何 / 相机
- 透视相机：`eye / target / up / fov(垂直) / near / far`；`up` 与视线平行时自动
  退化到任意垂直轴，不产生 NaN。
- 实例矩阵按 **列主序** 解析（`reshape(4,4,order='F')`），法线用逆转置变换。
- **背面剔除关闭**；着色时法线背向相机则翻转（双面着色），适配薄板 / 双面件。
- **近平面裁剪**：三角形按视图空间 `z <= -near` 做 Sutherland–Hodgman 裁剪
  （1 前 2 后 → 1 三角形；2 前 1 后 → 2 三角形），裁剪时线性插值法线与世界坐标。
  完全位于近平面之后的三角形被丢弃；远平面只做整体剔除。
- 材质 id 随裁剪一起展开/丢弃（`_clip_near` 返回 source 映射），避免裁剪后错位。

### 光栅化
- **屏幕分块（tiled）**：屏幕切成 32×32 tile，三角形只与重叠 tile 求交，
  每个 (三角形, tile) 对的候选像素被 tile 边界裁到 ≤ 1024。
- 候选像素用 ragged 展开一次性向量化生成，**没有逐三角形 Python 循环**。
- **深度解析用 scatter-max，不用排序**：
  `packed = (depth_bits << 32) | fragment_id`，`depth_bits` 是 `1/w` 的 float32
  位模式（正浮点下单调递增）。`np.maximum.at` 每像素取最大值 = 最近片元，
  平局按 fragment_id 确定性打破。实测 `np.maximum.at` 比排序快一个数量级。
- 深度用 `1/w`（即 `inv_depth`）：near 附近精度高，且天然是单调的深度序。
- 采样发生在**像素中心**（`px + 0.5`），否则整幅图会相对投影偏移半像素。
- 内存：G-buffer 全部用 float32 / uint32 / uint64 平铺数组；候选批次受
  `--budget` 限制，不会分配整屏 float64 临时量。

### 着色
- Cook-Torrance / GGX（metallic-roughness 工作流）：Lambert 漫反射 + GGX 高光
  （Smith 几何项 + Schlick Fresnel）。
- 三盏方向光（`key` / `fill` / `rim`，名字取自 `frames.json`）+ 半球环境光
  （`ambient.sky` / `ambient.ground` 按法线 y 混合）+ Fresnel 边缘增强 +
  粗糙度相关的环境镜面近似。
- 顶点法线用重心坐标做**透视校正**插值到像素。
- `emissive` / `emissiveStrength` 直接加入，并进入 bloom。

### 地面
- `ground.enabled` 为真时用**解析式无限平面**（射线-平面求交）填充无几何像素，
  按同一套 PBR 着色；不做真实反射。
- 可选世界坐标网格；随距离淡出以避免远处摩尔纹。
- **柔和接触阴影**：把每个实例的世界空间 AABB 沿 key 光方向投影到 `y=0`，
  在阴影场里叠加椭圆覆盖度（高度越高越淡越散），再双线性采样到地面像素。
  阴影只作用于 key 光，并轻微压低环境光，使主体不"飘"。
  阴影场累加后会做两遍 box blur：分片常数场直接双线性插值会把网格边界
  显成刻面。

### 后处理
- 亮度阈值提取 → **面积平均**降采样（避免单像素萤火虫变成方块）→ 可分离
  box blur ×3 → 上采样叠加。
- ACES filmic 色调映射 + `exposure`。
- 轻微暗角 + **固定 seed 的确定性胶片颗粒**（逐帧完全相同，不做时间抖动）。
  颗粒加在 **sRGB 显示空间**而不是线性空间：线性空间里 0.012 的扰动经过
  sRGB 曲线在暗部会被放大约 3 倍（天空会出现 ±15 级的噪点）。
- 输出 sRGB（精确分段传递函数）。

### 线程
渲染主体是逐元素 numpy 运算而非 BLAS。本机 OpenMP 运行时损坏
（`OMP: Warning #179`），默认多线程数学库会出现 3~9 秒的病态抖动，因此
`raster.py` 在 **import numpy 之前**把 `OPENBLAS_NUM_THREADS` /
`OMP_NUM_THREADS` / `MKL_NUM_THREADS` / `VECLIB_MAXIMUM_THREADS` /
`NUMEXPR_NUM_THREADS` 默认钉到 1（环境里已显式设置的值优先）。
这既让单帧更快更稳定，也避免多进程渲染时线程超订。

## 6. 性能实测

机器：Apple Silicon（10 核），macOS 27.2，Python 3.14.7，numpy 2.5.3。
计时均为**墙钟时间**，含光栅化 + 着色 + 后处理，不含 PNG 编码。

| 场景 | 分辨率 | ss | 三角形/帧 | 实例 | 每帧耗时（机器空载） |
|---|---|---|---|---|---|
| 基础测试场景 | 1280×720 | 1 | 1,048 | 3 | **0.39–0.45 s** |
| 基础测试场景 | 1280×720 | 2 | 1,048 | 3 | **1.7–2.1 s** |
| 压力场景 | 1280×720 | 1 | **126,720** | 60 | **0.55 s** |
| 压力场景 | 1280×720 | 2 | **126,720** | 60 | **2.12–2.16 s** |

目标为 ss=1 ≤ 2 s、ss=2 ≤ 8 s。压力场景的三角形数是任务书里
"2~4 万三角形"的 3~6 倍，仍有 3.6 倍余量。真实机器人场景会更接近下界。

多进程（`--workers 4`，8 帧，1280×720 ss=1）：**1.44 s 墙钟**，
即约 0.18 s/帧 的有效吞吐。

> **关于本机负载**：这台机器是共享的，实测期间 load average 在 10~28 之间
> 波动（有本会话之外的进程在占满 CPU）。在负载高峰时，同样的渲染墙钟会
> 膨胀 3~4 倍（例如压力场景 ss=1 从 0.55 s 变成 3.1 s，ss=2 从 2.1 s 变成
> 13.3 s），因为 CPU 时间和墙钟会一起被超线程争用拉高。上表取的是
> **机器空载时**的实测值。**跑基准前请先确认 load average 接近空闲**，
> 否则数字没有可比性。
>
> 另外，本机 OpenMP 运行时损坏（每次 numpy 导入都会打印
> `OMP: Warning #179: Function Can't set size of /tmp file failed`）。
> 这会让 numpy 的 float32 matmul 报出**虚假的** "divide by zero / overflow"
> 警告（结果本身与 einsum 逐位相同，已核对）。渲染器因此在 import numpy
> 之前关闭 numpy 的浮点异常上报，并改为**显式校验**输出是否有限
> （`stats["nonfinite_pixels"]`），所以警告不会污染日志，真问题也不会被
> 淹没。

## 7. 自检

```bash
python3 tools/render/make_test_scene.py --stress
# 额外用真实导出场景做一次集成校验
python3 tools/render/make_test_scene.py --real-scene artifacts/scene
```

会做四件事：

1. **生成**符合冻结格式的合成场景（立方体 + 球 + 自发光块 + 地面 + 三盏灯），
   写入 `artifacts/_selftest/scene/`（`manifest.json` / `frames.json` /
   `m*.pos.f32` / `m*.nrm.f32` / `m*.idx.u32`）。
2. **几何校验**：逐三角形检查绕向与顶点法线是否一致（`winding_consistent`）、
   法线是否朝外（`normals_outward`）。这是"法线绕向反了"故障的自动化探针。
3. **实际出图**：通过真实 CLI 渲染第 0 帧到 `artifacts/_selftest/frame0.png`，并渲染
   一张 3/4 视角的立方体特写到 `artifacts/_selftest/cube_check.png`。
4. **统计**：每帧耗时、三角形数、实例数、图像亮度直方图写入
   `artifacts/_selftest/selftest.json`，控制台日志写入 `artifacts/_selftest/selftest.log`。

`artifacts/_selftest/film.wav` 是用于验证混音路径的合成 4 秒 48 kHz 立体声测试音。
`artifacts/_selftest/` 内只保留少量 PNG。

### 真实导出场景的集成校验

用 `--real-scene artifacts/scene` 跑过一次真实导出数据的校验（当时该目录
由 `tools/export.mjs` 生成）：

| 项 | 实测值 |
|---|---|
| mesh / material | 51 / 11 |
| 帧数 / 分辨率 / fps | 480 / 1280×720 / 24 |
| 每帧实例数 | 69 |
| 每帧三角形数 | 8,445 |
| 解析 | manifest / frames.json 全部按冻结格式直接读入，额外字段（如 `camera.shotId`）被忽略 |

渲染结果（`artifacts/_selftest/real_frame0.png`）：车辆形态完整可辨——黄色车漆面板分块
明暗正确、玻璃为暗色、镀铬件有高光、**车下有柔和接触阴影（不"飘"）**、
前后遮挡关系正确、地面与背景可分。

### 人工复核结论（实际看图）

- `frame0.png`：非全黑/全白/全灰——256 个亮度级全部出现，16 桶直方图分布
  连续；地面（105~127）与天空（44~61）明显可分；地平线清晰；网格随距离淡出。
- 立体明暗正确：立方体三个面分别是亮（顶）、中（前）、暗（左）三种朝向不同的
  亮度；球体左下暗、右上亮，终止线方向与 key 光一致；三处高光分别对应
  key / fill / rim。
- `cube_check.png`：立方体是**规整六面体**——能看到前 / 顶 / 左三个面，
  边缘平直锐利，轮廓为凸盒体，**没有"只有接缝发白、整体灰扑扑"的翻面迹象**，
  即三角形绕向与法线均正确。
- 自发光块呈青色并带柔和圆形辉光（bloom 无方块状伪影）。
- 立方体与球体脚下可见柔和暗区（接触阴影），主体不"飘"。

## 8. 已知限制与取舍

- **软阴影是近似的**：接触阴影来自实例包围盒的投影，不是真正的 shadow map，
  因此没有自遮挡、没有面板级细节，边缘是柔和椭圆而非真实轮廓。
- **无真实反射**：地面只有 Fresnel 环境镜面近似，不反射几何体。
- **无间接光 / GI**：环境光只有半球常量项 + 环境镜面近似。
- **无透明 / alpha 测试 / 双面材质分支**：`doubleSided` 字段被解析但渲染器
  全局采用双面着色（按任务书要求不开启背面剔除）。
- **无运动模糊 / 景深 / 色散**。
- **胶片颗粒是静态的**：固定 seed、逐帧完全相同，因此不随时间抖动
  （按任务书"不随时间漂移成噪点风暴"的要求），代价是颗粒没有"活"的感觉。
- **bloom 的萤火虫钳制**：`--bloom-clamp` 默认 8×阈值，镜面极强的物体
  （粗糙度 0.12 的镜面金属可达 HDR 900+）其辉光会被压到阈值量级。
- **精度**：深度用 float32 的 `1/w`。near=0.05 / far=400 时，近处 1 mm 以上的
  面间距可分辨；远距离共面物体可能出现 z-fighting（需要时把 near 调大）。
- **网格会在远处淡出**（cell 小于 4 像素时消失），以避免摩尔纹。
- **单进程内存**约 200~400 MB（1280×720），与分辨率线性相关；
  多进程时按进程数倍增。
- **多进程需要场景可 pickle**：本实现每个 worker 各自加载场景文件，
  不共享内存。

## 9. 与 `tools/export.mjs` 的接口约定

渲染器**严格按**冻结格式解析，未做任何改动：

- `manifest.json`：`meshes[]`（`id` / `name` / `positions` / `normals` /
  `indices` / `vertexCount` / `indexCount`）、`materials{}`
  （`baseColor` / `metallic` / `roughness` / `emissive` /
  `emissiveStrength` / `doubleSided`）。
- 顶点/法线：little-endian float32，`vertexCount*3` 个；索引：little-endian
  uint32，`indexCount` 个。
- `frames.json`：`fps` / `count` / `width` / `height` / `frames[]`；
  每帧含 `t` / `camera` / `instances[]` / `exposure` / `lights` / `ambient` /
  `ground` / `background`。
- 实例矩阵 `m` 为 16 个 float 的**列主序**；`lights.*.dir` 为**光传播方向**。

格式本身没有阻塞性问题。两点可选建议（不影响当前实现）：

1. `ground.grid` 目前按"世界单位网格间距"解释；若导出端希望的是"网格线数量"
   或需要非等距网格，需要额外字段。
2. `materials[*].doubleSided` 目前被忽略（渲染器全局双面）。如果后续需要
   真正的单面材质（例如内部不可见的装甲板），建议要么按此字段关闭双面着色，
   要么明确该字段只作参考用途。

## 10. 环境要求

- Python ≥ 3.11（实测 3.14.7）、numpy ≥ 1.24（实测 2.5.3）、Pillow（实测 12.1.1）
- ffmpeg / ffprobe 9.0.2（仅封装 MP4 时需要；只出 PNG 时不需要）
