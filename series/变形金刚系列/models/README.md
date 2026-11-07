# 模型版本与目录约定

角色和具体作品版本构成案例；模型或其他独立实现构成案例版本。同一角色的不同电影版本可构成不同案例，不同模型对同一目标的复刻是不同版本。模型署名与执行证据见各版本文档，案例与在线作品统一从[系列首页](../README.md)进入。

| 模型 | 已有案例 | 实现入口 |
|---|---|---|
| GPT-6.1 Sol | 擎天柱、大黄蜂 | [版本说明](gpt-6.1-sol/README.md) |
| HY4 | 擎天柱 | [版本说明](hy4/README.md) |
| GLM-5.3-Flash | 擎天柱 | [版本说明](glm-5.3-flash/README.md) |

```text
series/变形金刚系列/
  characters/                 # 跨模型共享的参考入口与结构候选
  references/                 # 有来源说明的参考研究板
  models/
    gpt-6.1-sol/
      README.md              # Sol 的作品索引
      bumblebee-2007/        # 大黄蜂实现
    hy4/optimus-prime-2007/
    glm-5.3-flash/optimus-prime-2007/
  experiments/<case-id>/     # 未登记的研究草稿
  01-擎天柱-电影版/          # 既有作品的实际目录与稳定链接
  templates/、tools/          # 可复用契约与脚手架
```

新实现放在 `models/<model-slug>/<case-id>/`，分别保存 README、源码、规格、记录与构建结果。模型目录采用小写名称，例如 `gpt-6.1-sol`。目录名和 CLI 的版本 ID 分开登记，例如大黄蜂的版本 ID 是 `gpt-6-1-sol`。可以用 `tools/characters.py start` 起研究草稿，成果具备运行与验证证据后再进入模型目录并登记。维护入口见[贡献指南](../../../CONTRIBUTING.md)。

独立复刻只使用任务书允许的原始参考，声明 `independent`。复用已有实现时声明 `derived` 并注明来源。成果记录分开填写模型名称、精确模型 ID、执行工具和视觉目标，无法确认的字段标为未知。

已发布的历史实现保留原目录。Sol 的擎天柱位于 [01-擎天柱-电影版](../01-擎天柱-电影版/README.md)，通过模型索引访问。
