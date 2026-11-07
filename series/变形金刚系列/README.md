# 变形金刚复刻系列

围绕同一角色版本、原始参考与目标要求，由不同智能体、模型和工具分别尝试实现，观察造型、变形、交互与成片效果，并改进可复用的制作流程。

当前有 **1 个案例、3 个实现、3 个模型署名**。沿用机械系列的组织方式：先选案例，再选模型版本，最后进入具体作品与运行方法。

## 全部案例

「在线演示」运行作品；「仓库文档」查看源码、规格和重建方法。当前案例为 2007 电影版擎天柱。

| 案例 | 案例 ID | 模型版本 | 在线演示 ↗ | 仓库文档 |
|---|---|---|---|---|
| 擎天柱·2007真人电影版 | `optimus-prime-2007` | GPT-6.1 Sol | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/01-擎天柱-电影版/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/01-擎天柱-电影版/film.html) | [说明与源码](01-擎天柱-电影版/README.md) |
| 擎天柱·2007真人电影版 | `optimus-prime-2007` | HY4 | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/hy4/optimus-prime-2007/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/hy4/optimus-prime-2007/film.html) | [说明与源码](models/hy4/optimus-prime-2007/README.md) |
| 擎天柱·2007真人电影版 | `optimus-prime-2007` | GLM-5.3-Flash | [互动](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/glm-5.3-flash/optimus-prime-2007/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/series/变形金刚系列/models/glm-5.3-flash/optimus-prime-2007/film.html) | [说明与源码](models/glm-5.3-flash/optimus-prime-2007/README.md) |

## 选择版本

| 模型版本 | 实现与呈现特点 | 版本说明 |
|---|---|---|
| GPT-6.1 Sol | 电影版：分层装配、组合展开、同源 Cycles 短片 | [实现与用法](models/gpt-6.1-sol/README.md) |
| HY4 | 2007 电影版：Three.js PBR、连续变形及逐帧渲染短片 | [实现与用法](models/hy4/README.md) |
| GLM-5.3-Flash | 2007 电影版：程序化装配、连续变形、灰模与拆解研究 | [实现与用法](models/glm-5.3-flash/README.md) |

历史实现的选帧、工具、迭代和记录完整度并非完全相同；比较时应先核对各版输入边界。当前造型与隐藏机构仍有差距，不能把分件数或渲染方式当作还原度评分。

## 使用与复刻

重建现有版本时，从仓库根目录查询对应命令；开始新的独立复刻时用 recreate 获取允许的任务和参考。

```bash
python3 scripts/catalog.py show optimus-prime-2007 --variant cinematic-v2
python3 scripts/catalog.py show optimus-prime-2007 --variant hy4
python3 scripts/catalog.py show optimus-prime-2007 --variant glm-5-3-flash
python3 scripts/catalog.py recreate optimus-prime-2007
```

安装和 Agent 用法见[快速开始](../../docs/快速开始.md)。新增模型或角色先建立研究草稿，达到运行与验证要求后再登记为实现；目录约定见[模型版本说明](models/README.md)。

## 参考与制作方法

| 资料 | 用途 |
|---|---|
| [角色研究库](characters/README.md) | 67 个其他角色/版本的来源入口与拆分候选，尚不是成品 |
| [参考研究板](references/README.md) | 浏览精选产品缩略图；原图与原片测量按来源清单获取 |
| [制作协议](工作流协议.md) | 角色契约、装配身份、动作、摄影与验收流程 |
| [经验与实践](经验与实践.md) | 从已做案例提炼可复用方法及适用限制 |
| [视频制作方法](01-擎天柱-电影版/视频工作流.md) | 同源电影渲染、网页功能演示及动作音效 |
| [发布说明](发布说明.md) | 素材、生成文件与版权参考的公开边界 |

[返回仓库首页](../../README.md)。
