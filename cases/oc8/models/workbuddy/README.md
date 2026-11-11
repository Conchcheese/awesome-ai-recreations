# WorkBuddy 版 · 机械章鱼 OC-8

由 WorkBuddy 智能体（小柏）在用户监督下独立实现的三维机械章鱼复刻：浅色影棚场景中的 Pelagos OC-8，含 8 片花瓣式壳甲、缆线脑核、8 条 25 节卷曲腕足、心跳驱动律动、整机拆解与线框模式。纯 three.js 程序化几何，无外部模型文件，下载后可完全离线运行。

[![WorkBuddy 版实际渲染](covers/00-机械章鱼OC-8-封面-workbuddy.png)](index.html)

## 打开成果

| 成果 | 说明 |
|---|---|
| 互动页 | [index.html](index.html) —— 拖动旋转、按钮切换常态/拆解/线框三态 |
| 自动巡览 | [film.html](film.html) —— 25 秒一轮：环绕 → 拆解 → 线框 → 特写 → 重组，下载后双击可离线播放 |
| 静帧 | [stills/](stills/) —— 常态、侧视、拆解、线框共 9 张实际截图 |

## 重建与检查

- 工作目录：本目录。运行环境：任意现代浏览器（Chrome/Edge）与 Node.js 18+。
- 依赖仅 `lib/three.min.js`（three.js r148 UMD 本地打包，608KB），无 npm 安装步骤。
- 源码：[src/main.js](src/main.js)（单文件实现，含几何、装配、动画、HUD 与音效）；规格与改编项见 [src/spec.md](src/spec.md)。
- 从**本目录**执行：

```bash
node src/build.mjs   # 由 index.html + 巡览驱动重新生成 film.html
node src/check.mjs   # 交付文件与页面引用一致性自检
```

## 输入与执行

- 任务 ID：`oc8`；输入版本：`input_version: 3`。
- 参考输入：任务书冻结的九张原作关键帧（`cases/oc8/task/references/`），未使用任务包外参考。
- 实际执行：WorkBuddy 智能体（模型 Claude，Anthropic）生成全部代码；人类用户参与审美决策并验收截图。执行条件为交互式对话会话，逐轮截图迭代。
- 人工介入：无外部素材引入；配色、材质与 HUD 版式为执行者重诠释。
- `visual_goal: fidelity`（整体按原作帧复刻；HUD 细节与部分结构为重诠释）、`provenance: independent`（未复用任何已有实现）。
- `input_sha256`：未随会话归档计算值，照实标注为缺失。

## 验收与限制

实际完成的检查：

- 常态/拆解/线框三态截图（见 [stills/](stills/)），无控制台 JS 报错。
- 8 条腕足按 1/8 周期相位差卷曲律动，花瓣壳采用铰点置于环圈上的"郁金香铰链"结构，拆解为有序分解视图而非随机爆散。

已知差距：

- 颚部开合、虹吸喷进等原作特定动作未逐一对照原作时刻复现。
- 未接入本仓库共享构建链（shared/ kit），验证为人工截图而非机器可读 QA。

## 来源与许可

- 原作：@0x_fokki 的 Pelagos OC-8 演示（https://x.com/0x_fokki/status/2116289885870981296 ），依据任务书以关键帧为可见证据复刻。
- 依赖：three.js（MIT License）。
- 本版由 WorkBuddy 会话产出，随仓库许可分发。关联：[任务书](../../task/brief.md) · [系列索引](../../../../series/机械复刻系列/README.md) · [NOTICE](../../../../NOTICE.md)。
