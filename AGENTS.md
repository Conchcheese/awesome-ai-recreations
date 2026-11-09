# 给接手仓库的 Agent

默认中文。动手前说明文件与计划，执行命令前说明用途。先用 `git status --short` 保护已有改动。路径、运行条件和验证结果都以证据为准。

## 新建独立复刻

1. 复用已有检出，或获取用户提供的仓库。读本文件后，从仓库根目录用 `python3 scripts/catalog.py recreate "机械章鱼"` 解析案例。名称不匹配时用 `python3 scripts/catalog.py list --tasks`，无法唯一定位才询问。
2. 从任务清单取得缺失参考，并核对 SHA-256。用 `python3 scripts/catalog.py recreate "机械章鱼" --export local/cases/oc8/input-packs/v3 --require-complete` 导出到新目录，再用 `python3 scripts/catalog.py verify local/cases/oc8/input-packs/v3` 校验。只给各执行者同一完整包和各自的空输出目录。缺参考时明确说明，并由组织者决定补齐或统一缩小范围。
3. 从包内 `TASK.md` 开始，只使用白名单和约定允许的资源。已有演示、源码、截图、规格、测量、角色研究档案和过程都属于成果侧。自行决定实现、工具和迭代方式，持续做到可运行交付。
4. 记录实际输入版本与包摘要、模型与执行工具、人工介入、参考差异、实际验收和未知。只整理有用的最终证据，逐轮对话和中间过程可选且默认留本地。精确模型 ID 或验证记录不可确认时标为未知。

没有 Python 时，从 `cases/index.json` 定位任务，只读任务允许的文件。需要同条件比较时，请由组织者先导出并核验包。

## 看作品、重建或改进

用 `catalog.py show <case> --variant <variant>` 查路径与命令，以该版 README 为准。用户明确要求复用时可读相应成果，并登记 `derived` 与来源。历史 Pages URL 通过 `site/` 跳转到案例下的正式页面。

## 维护与发布

- 新任务用 [共同任务模板](templates/task-brief.md) 和 [输入清单模板](templates/task-input.json)。就绪后登记 `cases/index.json`，运行 `catalog.py freeze`。已发布的输入发生变化时提升版本，旧条件由 Git 提交及留存的原始媒体复原。
- 可运行成果才登记 `catalog.json`，关联 `task_manifest`，更新首页、系列索引与 NOTICE。变形金刚公开媒体更新系列 `publication.json`。新研究草稿放忽略目录。
- 行为变化补针对性测试。发布前运行 `python3 scripts/check_repo.py`、`python3 -m unittest discover -s tests -v`，暂存后跑 `python3 scripts/check_clean_checkout.py`。模型或媒体有变化时额外验证实际页面或文件。
- 提交范围、归档、隐私与发布见 [发布与清理](docs/发布与清理.md)，目录和索引见 [仓库结构](docs/仓库结构.md)。上游快照保留原样和原许可。
