# 贡献指南

按「共同任务 → 独立实现 → 可用成果」推进。已有任务可以直接导出执行。

## 新增或修订任务

1. 复制 [任务书](templates/task-brief.md)和[输入清单](templates/task-input.json)到 `tasks/<case-id>/`。说明案例版本、需求、必做效果、质量目标、交付形式、验收与允许资源。
2. 登记原始参考路径、SHA-256、来源和权利边界。可分发副本放 `references/`，仅供本地的副本放 `references/local/`。来源变更时核对媒体内容和字节摘要。
3. 任务就绪后写入 `tasks/index.json`。新任务从 `input_version: 1` 开始。修改已发布的任务书、共同说明、空白模板或原始媒体时，为所有受影响任务提升输入版本。运行 `python3 scripts/catalog.py freeze` 并提交锁定清单。
4. 用 `recreate --require-complete` 导出一次，运行 `verify`，让所有执行者用同一个包和同一组附加指示。分别记录执行条件。操作见[共同输入](docs/共同输入与资源.md)。

## 登记成果

1. 选定独立输出目录，按任务交付。完成后放到系列下的 `models/<model-slug>/<case-id>/`，旧实现沿用原址。
2. 从[成果模板](templates/case.md)整理 README。先给能打开的页面或媒体和使用方法，再给源码、依赖与重建命令。记录输入版本、摘要、实际模型与执行工具、人工介入、验证与已知差距。深度规格、关键证据可独立成文。
3. 在 `catalog.json` 登记 `task_manifest`、版本 ID、来源属性、工作目录和实际命令。命令用参数数组。再更新首页、系列索引与 [NOTICE](NOTICE.md)。变形金刚媒体同时登记 `publication.json`，保持路径与 SHA-256 一致。
4. 已有实现的复用需要可追溯的来源和权利信息。详细比较见[对照复刻约定](docs/对照复刻约定.md)。

## 验证与提交

```bash
python3 scripts/check_repo.py --base origin/main
python3 -m unittest discover -s tests -v
git diff --check
# 暂存精确的发布候选后
python3 scripts/check_clean_checkout.py
git diff --cached --check
```

工具行为变化补回归测试。页面、模型或影片变化按版本 README 跑实际验证。提交白名单、本地归档和远端发布规则见[发布与清理](docs/发布与清理.md)。
