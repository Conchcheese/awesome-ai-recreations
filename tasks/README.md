# 共同复刻任务

这里保存全仓统一输入，不保存任何智能体的实现。任务可以先于成果存在：就绪任务登记到 index.json 后即可被 catalog recreate 发现，尚无成果时不增加已实现作品。

| 每个 tasks/<case-id>/ | 内容 |
|---|---|
| brief.md | 需求、目标、验收要求与通用思路；不预写具体实现答案 |
| input.json | 身份、输入版本、允许资源、参考范围、来源完整度与每个原始文件的摘要 |
| references/ | 各案例一致的原始媒体；不放输出、测量、截图对照或代码 |
| references/local/ | 原片等不随 Git 发布的媒体；公开来源清单，缺失时不可宣称输入齐全 |

`index.json` 是全部就绪任务的索引；根 `catalog.json` 只登记成果及对应 task_manifest。旧参考位置为兼容旧作品链接保留，不再作为新任务的输入。

从仓库根目录运行：

```bash
python3 scripts/catalog.py recreate oc8 --export local/input-packs/oc8
python3 scripts/catalog.py show oc8 --variant gpt-6-1-sol
```

第一条交付一致输入，第二条运行既有成果。导出只复制任务白名单、共同方法、空白模板与原始媒体，不递归目录、不读取已有代码。

## 增加任务或成果

1. 复制 templates/task-input.json 为新任务 input.json，按同目录模板填写 brief.md，补齐原始参考和摘要。未就绪草稿不要登记。
2. 任务就绪后登记 tasks/index.json；即使尚无模型实现，也可以开始复刻。运行仓库检查。
3. 把同一冻结输入包交给执行者，只提供独立输出目录和允许资源。每个实现自行建立规格、结构、参数和过程。
4. 有可运行成果后再在 catalog.json 登记案例与版本，指回同一 task_manifest；更新首页、系列索引与 NOTICE。
5. 输入改变时增加 input_version，并保存旧输入包；新结果记录实际包摘要，不能把新标准套到旧结果上。

各历史实现未必采用当前任务包；其真实输入和过程以原有记录为准，不补写成已经在相同条件下完成。
