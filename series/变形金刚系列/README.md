# 变形金刚复刻系列

围绕同一角色版本、原始参考与目标要求，由不同智能体、模型和工具分别尝试实现，观察造型、变形、交互与成片效果，并改进可复用的制作流程。

当前有 **2 个案例、6 个实现、5 个模型**。按案例选择演示，或从模型索引查找对应实现。

[返回首页](../../README.md) · [模型目录](models/README.md) · [角色研究库](research/README.md) · [快速开始](../../docs/快速开始.md)

## 全部案例

在线演示使用 GitHub Pages。案例文档提供离线 HTML、源码、规格和重建方法。

| 案例 | 案例 ID | 模型版本 | 在线演示 | 仓库文档 |
|---|---|---|---|---|
| 擎天柱·2007真人电影版 | `optimus-prime-2007` | GPT-6.1 Sol | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/01-擎天柱-电影版/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/01-擎天柱-电影版/film.html) | [说明与源码](01-擎天柱-电影版/README.md) |
| 擎天柱·2007真人电影版 | `optimus-prime-2007` | HY4 | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/hy4/optimus-prime-2007/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/hy4/optimus-prime-2007/film.html) | [说明与源码](models/hy4/optimus-prime-2007/README.md) |
| 擎天柱·2007真人电影版 | `optimus-prime-2007` | GLM-5.3-Flash | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/glm-5.3-flash/optimus-prime-2007/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/glm-5.3-flash/optimus-prime-2007/film.html) | [说明与源码](models/glm-5.3-flash/optimus-prime-2007/README.md) |
| 大黄蜂·2007真人电影版外观研究 | `bumblebee-2007` | GPT-6.1 Sol | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/gpt-6.1-sol/bumblebee-2007/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/gpt-6.1-sol/bumblebee-2007/film.html) | [说明、源码与本地视频](models/gpt-6.1-sol/bumblebee-2007/README.md) |
| 大黄蜂·2007真人电影版 | `bumblebee-2007` | Minimax-M3.1-Flash | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/minimax-m3.1-flash/bumblebee-2007/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/minimax-m3.1-flash/bumblebee-2007/film.html) | [说明、源码与本地视频](models/minimax-m3.1-flash/bumblebee-2007/README.md) |
| 大黄蜂·2007真人电影版 | `bumblebee-2007` | Kimi-K3.1-Pro | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/kimi-k3.1-pro/bumblebee-2007/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/kimi-k3.1-pro/bumblebee-2007/film.html) | [说明、源码与本地视频](models/kimi-k3.1-pro/bumblebee-2007/README.md) |

## 选择版本

| 模型版本 | 实现与呈现特点 | 版本说明 |
|---|---|---|
| GPT-6.1 Sol | 擎天柱与大黄蜂，分层装配、连续变形与同源 Cycles 短片 | [实现与用法](models/gpt-6.1-sol/README.md) |
| HY4 | 2007 电影版：Three.js PBR、连续变形及逐帧渲染短片 | [实现与用法](models/hy4/README.md) |
| GLM-5.3-Flash | 2007 电影版：程序化装配、连续变形、灰模与拆解研究 | [实现与用法](models/glm-5.3-flash/README.md) |
| Minimax-M3.1-Flash | 大黄蜂双形态、同源 GLB 与软件光栅化短片 | [实现与用法](models/minimax-m3.1-flash/README.md) |
| Kimi-K3.1-Pro | 大黄蜂双形态、47 模块、同源 20 秒有声逐帧巡览 | [实现与用法](models/kimi-k3.1-pro/README.md) |

历史实现的选帧、工具、迭代和记录完整度并非完全相同；比较时应先核对各版输入边界。当前造型与隐藏机构仍有差距，不能把分件数或渲染方式当作还原度评分。

## 使用与复刻

重建现有版本时，从仓库根目录查询对应命令；开始新的独立复刻时用 recreate 获取允许的任务和参考。

```bash
python3 scripts/catalog.py show optimus-prime-2007 --variant cinematic-v2
python3 scripts/catalog.py show optimus-prime-2007 --variant hy4
python3 scripts/catalog.py show optimus-prime-2007 --variant glm-5-3-flash
python3 scripts/catalog.py show bumblebee-2007 --variant gpt-6-1-sol
python3 scripts/catalog.py show bumblebee-2007 --variant minimax-m3-1-flash
python3 scripts/catalog.py show bumblebee-2007 --variant kimi-k3-1-pro
python3 scripts/catalog.py recreate bumblebee-2007
```

安装和 Agent 用法见[快速开始](../../docs/快速开始.md)。新建复刻先核验共同任务包，在独立目录实现。角色草稿和研究库用于维护者准备下一批任务；目录约定见[模型版本说明](models/README.md)。

## 参考与制作方法

| 资料 | 用途 |
|---|---|
| [角色研究库](research/characters/README.md) | 67 个角色/版本的来源入口与拆分候选；实现另登记，参考档案不计作成品 |
| [参考研究板](references/README.md) | 浏览精选产品缩略图；原图与原片测量按来源清单获取 |
| [制作协议](docs/工作流协议.md) | 角色契约、装配身份、动作、摄影与验收流程 |
| [经验与实践](docs/经验与实践.md) | 从已做案例提炼可复用方法及适用限制 |
| [视频制作方法](01-擎天柱-电影版/视频工作流.md) | 同源电影渲染、网页功能演示及动作音效 |
| [发布说明](docs/发布说明.md) | 素材、生成文件与版权参考的公开边界 |
