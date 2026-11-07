# 模型版本与目录约定

角色和具体作品版本构成案例；模型或其他独立实现构成案例版本。同一角色的不同电影版本可构成不同案例，不同模型对同一目标的复刻是不同版本。模型署名与执行证据见各版本文档，案例与在线作品统一从[系列首页](../README.md)进入。

| 模型 / 执行者 | 实现入口 |
|---|---|
| Codex | [版本说明](codex/README.md) |
| GPT-6.1 Sol | [版本说明](gpt-6.1-sol/README.md) |
| HY4 | [版本说明](hy4/README.md) |
| GLM-5.3-Flash | [版本说明](glm-5.3-flash/README.md) |

```text
series/变形金刚系列/
  characters/                 # 跨模型共享的参考入口与结构候选
  references/                 # 有来源说明的参考研究板
  models/
    gpt-6.1-sol/README.md     # 既有作品的模型入口
    hy4/README.md             # HY4 / Tencent Hunyuan Hy
    glm-5.3-flash/README.md   # GLM-5.3-Flash
    <model-slug>/<case-slug>/ # 新增模型的独立实现
  experiments/<case-slug>/    # 未登记的研究草稿
  01-擎天柱-电影版/          # 既有作品的实际目录与稳定链接
  templates/、tools/          # 可复用契约与脚手架
```

新模型使用小写字母、数字和连接符命名，案例目录标明角色、目标版本，彼此独立保存 README、源码、规格、记录与构建结果。不要覆盖另一模型的结果。先用 `tools/characters.py start` 生成草稿，再在成果具备运行与验证证据时迁入对应模型/案例目录并登记 `catalog.json`、系列索引和 `NOTICE.md`。草稿路径不是已完成版本；脚手架不会自动调用或验证指定模型。

独立复刻只使用任务书允许的原始参考，声明 independent；复用已有实现需声明 derived 并注明来源。模型 ID、执行工具、视觉目标和未验证项分别如实登记。公共参考不等于模型生成资产。

历史目录继续作为实际实现与稳定链接；当前导航不复制源码，也不通过软链接混淆版本。在线 Pages 与 Release 仍指向各作品原位置。
