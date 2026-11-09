# 机械系列 · 任务书与资料

[系列索引](../README.md) · [快速开始](../../../docs/快速开始.md) · [文档总览](../../../docs/README.md)

## 开始复刻

| 入口 | 用途 |
|---|---|
| [机械章鱼 OC-8 任务书](../../../cases/oc8/task/brief.md) | 按参考、灰模、机构、材质、HUD 与逐帧验收推进 |
| [全部共同任务](../../../cases/README.md) | 选择 V8、起落架、海滩兽等案例 |
| [精细复刻流程](../../../docs/精细复刻流程.md) | 成果制作的可选技术建议 |
| [通用约定](../../../docs/通用基础与约定.md) | 时间驱动、参数依据与工程验收 |

Agent 可按案例名运行 `python3 scripts/catalog.py recreate "机械章鱼"`（从仓库根目录），自动定位任务书和允许的参考。任务书供新实验使用；原作作者的源码与提示词未随仓库提供。

## 历史记录

| 资料 | 内容 |
|---|---|
| [GPT-6.1 Sol 记录](../../../cases/oc8/models/gpt-6-1-sol/records/提示词与过程.md) | 实际任务、迭代、视频与差距 |
| [DeepSeek 记录](../../../shared/mechanical/deepseek-kit/records/实现与验证.md) | 实现约定、验证与简化项 |
| [GLM 案例记录](../../../cases/README.md) | 九台机器的实现记录 |
| [HY4 记录](../../../cases/oc8/models/hy4-direct/records/实现与验证.md) | 输入、运镜、偏差与审计 |
| [HY 衍生版记录](../../../cases/oc8/models/hy-derived/records/实现与验证.md) | 复用关系与腕节实现 |
| [首次长篇复盘](01-机械章鱼OC-8-teardown机器模拟器.md) | GLM 首次实现的公开摘要与历史位置 |
| [历史改写提示词](提示词原文/teardown-机械章鱼.md) | 基于 teardown 方法的六条模板 |

历史记录保留当时结论；当前安装和命令以版本 README 与 catalog 查询为准。
