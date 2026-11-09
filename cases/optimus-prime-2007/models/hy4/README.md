# HY4 · 擎天柱（2007 真人电影版）精细复刻

**模型署名：HY4 / Tencent Hunyuan Hy**（用户指定标注，沿用仓库历史署名口径）。执行模型名称由用户提供；本次会话未另行调用带版本号的 HY4 模型 API，精确模型 ID、完整提示词与迭代轮次未归档。铭牌不用于模型能力排名。

- **视觉目标** `fidelity` · **实现来源** `independent`：只读官方素材、任务书、流程与制作协议，未把既有电影版或已归档原型的几何源码、规格或 HTML 当作建模输入。
- **版本冻结**：Transformers (2007), Michael Bay 长头卡车造型；排除 G1 平头玩具与 2009/2011/2014/2018 续集造型。
- **目录**：按[版本与目录约定](../../../../series/变形金刚系列/README.md)落在 `models/hy4/optimus-prime-2007/`，不覆盖已发布案例的稳定链接。
- **本轮重做**：初版为 57 个色块的 Canvas 2D 投影、无影片。按`docs/精细复刻流程.md`（仓库根）重做后改为 Three.js PBR 三维、37 个可动装配 / 490 个命名视觉分件 / 974 个 Mesh，并输出真实编码影片。

## 体验与下载

| 内容 | 入口 | 说明 |
|---|---|---|
| **成片 MP4** | 本地 `artifacts/HY4-擎天柱-2007-电影版.mp4` | **28 秒 / 24fps / 1920×804 / H.264 + AAC / 672 帧**；同源模型逐帧离线渲染，不是网页录屏，也不是生成视频 |
| 互动页 | [index.html](index.html) | 双形态、50 秒源时间线、灰模/系统分色、分层拆解、零件拾取、侧背视角 |
| 巡览页 | [film.html](film.html) | 同源页面，自动播放 7 镜头成片时间线（网页实时巡览，与 MP4 区别见下） |
| 原创音轨 | `artifacts/HY4-original-score.wav` | 48kHz 双声道 28 秒，振荡器与包络合成，9 个与镜头对齐的声音事件，无电影配乐采样 |
| 解码证据 | `artifacts/qa/成片解码接触表.jpg` · `artifacts/qa/成片分镜.jpg`（本地成片分镜） · `artifacts/qa/原作对照-并排.jpg`（本地原作并排） | 从编码后 MP4 实际解码抽帧，非复用渲染 PNG |

页面为自包含单文件（内联 Three.js 与程序化环境），双击即可离线运行。影片与逐帧缓存保留在被忽略的 `artifacts/`，按仓库发布约定不提交、不上传。

## 成片口径（与 Cycles 区分）

本轮成片是**同一 Three.js 模型按 `cameraAt(i/24)` 求源时间与镜头、逐帧确定性重绘后截取 PNG 序列，再由 FFmpeg 编码**。`MeshPhysicalMaterial` 分区（红蓝清漆 / 铬 / 拉丝铝 / 钢 / 焦黑关节 / 橡胶 / 玻璃 / 发光）、程序化 equirectangular 环境经 PMREM 生成反射、ACES 调色、主辅轮廓光与软阴影。

**它不是 Blender Cycles 路径追踪**，也不等同于仓库既有案例的离线物理渲染；光照、色彩管理与材质精度有差距。Blender 4.5.4 便携版在本机可用，但本轮未用于成片，因此不冒充。网页实时巡览与 MP4 使用同一模型与姿态，逐帧渲染保证确定性，跨 GPU 的像素一致性未验证。

## 重建与验证

依赖复用同系列已锁定的 `node_modules`（Three.js 0.186.1 / esbuild 0.28.1 / Playwright 1.58.2），本版本目录不复制依赖。从本案例目录执行：

```bash
export NODE_PATH="../../../01-擎天柱-电影版/node_modules"

node tools/build.mjs      # esbuild 打包 src/ 并内联成 index.html / film.html
node tools/audio.mjs      # 生成原创 WAV
node tools/render.mjs     # Playwright 逐帧离线渲染 672 帧 PNG（约 3 分钟）
node tools/video.mjs      # FFmpeg 封装 + 解码/黑帧/电平/规格验收
python3 tools/contact.py  # 从 MP4 解码生成接触表、分镜、原作并排与 50% 叠图

node tools/check.mjs      # 契约/状态机/几何/镜头/页面/影片，36 项
node tools/qa.mjs         # DOM 契约 + 真实 Chromium 实跑，15 项
```

修改模型、镜头或材质后必须重跑 `render.mjs` 全量重渲，不能复用旧帧；`artifacts/render-manifest.json` 记录每帧镜头、源时间、拆解/展甲参数与指纹。

## 输入、规格与证据

- [官方素材与哈希](references/sources.json)：8 张精选原帧 + 7 份补充精读素材（MPM-4 官方产品图、ILM 100s / 080s、Paramount 61s、8–32s 变形接触表、2007 研究板），全部本地研究
- [参考测量与差异合同](records/参考测量与差异合同.md) · [配色统计与地标](records/参考测量.json)
- [装配与镜头规格](spec.md) · [可查询装配清单](records/assembly-catalog.json) · [生产契约](production.json)
- [实现、验证与已知差距](records/实现与验证.md) · [阶段验收](records/验收清单.md) · `artifacts/video-check.json`（本地影片验收数据）

## 主要边界

原始电影经过剪辑和遮挡，没有取得干净完整的静止三视图或 ILM 模型。所有世界尺寸、隐藏连接、背面藏件、材料参数与变形避让路径为 `guess` / `inferred`；展甲、分层拆解与重组为 `designed` 展示动作，不冒充原片已证实的能力。未做原片同机位量化误差测量，不给还原度百分比；没有完整碰撞检测，不写「无穿模」或「机构可制造」。

## 来源与许可

原始影片及角色权利归 Paramount / DreamWorks / Hasbro 等权利人，ILM 制作资料归相应权利人，MPM-4 产品图归 Takara Tomy / Hasbro；不随新增代码的 MIT 许可转移。原始媒体仅本地研究，不提交、不发布、不随成片分发。Three.js MIT 完整许可内嵌页面并见仓库第三方声明；环境、火焰纹、磨损贴图、配乐均由代码生成，没有来源不明的三维模型或音频采样。
