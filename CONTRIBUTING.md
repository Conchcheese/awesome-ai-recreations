# 贡献指南

新增内容遵循同一条路径：**先准备共同输入，再独立实现，最后登记成果。** 仓库方法见[对照复刻约定](docs/对照复刻约定.md)，具体目录见[仓库结构](docs/仓库结构.md)。

## 增加案例或系列

1. 在 tasks/<case-id>/ 创建 brief.md、input.json 与原始参考。模板见 [任务清单](templates/task-input.json)和[任务书](templates/task-brief.md)。任务描述需求、目标、要求、可用资源和大致思路，不预置某版结构、参数或代码。
2. 原始参考逐文件登记路径、来源完整度和 SHA-256；原始视频等不分发时留 local，并提供可获取的原始来源。媒体不能用已有成品截图替代。
3. 就绪任务登记 tasks/index.json，input_version 从 1 开始；无需先有模型成果。此时 recreate 可发现任务，show 不会伪造实现。
4. 相同输入包交给不同智能体，允许各自在资源约定内选择框架与方法。输出写独立目录；迭代、参数、测量和代码都是成果侧记录。
5. 完成可运行实现后，在 catalog.json 的 cases 增加案例或版本，填写对应 task_manifest，再更新首页截图/简介/演示、系列索引与 NOTICE。新系列同样遵循这套路径，不另建一套输入规则。

已有作品路径保持稳定，允许历史目录。新成果在 series 下按系列与模型分目录；具体内部技术结构由执行者决定。改进已有实现明确 derived，不能冒充新独立执行。

## 索引与输入版本

catalog schema 2 只保存成果信息，输入由 task_manifest 指向 tasks/<id>/input.json。catalog 工具加载时提供兼容的 prompt/recreation 查询字段，维护者不要手工复制这些字段回成果索引。tasks/index.json 是任务入口；同一任务可以有多个实现，也可以尚无实现。

每个成果版本填写 id、model_label、visual_goal、provenance、readme/live/film/source/spec/record/references、cwd、commands、build_outputs 和 notes。路径相对仓库根；命令使用参数数组，必须能实际运行。模型署名与未知记录如实说明；新执行的输入包摘要记录在成果 records 中，不反写成历史版本已采用当前任务。

修改共同输入时增加 input_version，保存旧包与摘要，并检查所有任务使用者。新增框架约束、参考、原始资产或研究候选都是输入条件变化；不要默默替换媒体。

## 文档与提交

首页直接展示全部已实现案例、截图、简介与各模型演示；任务入口在 tasks，详细代码和过程在各版本。版本 README 说明运行、重建、来源和限制；通用经验去掉角色答案后进入方法文档，下一组实验统一使用。

只提交源码、锁文件、正式页面、必要静帧、共同任务和原始参考的合规分发副本。生成包、原始长视频、逐帧缓存、诊断日志、私密信息、依赖和工具程序留 local/private/artifacts。兼容路径和上游快照保留，许可见 NOTICE。

```bash
python3 scripts/check_repo.py
python3 -m unittest discover -s tests -v
# 暂存后验证真正发布的文件树：
python3 scripts/check_clean_checkout.py
```

工具行为变化补针对性测试；模型变化另跑其 check/QA 与对照；媒体变化核对实际输出。发布规则见[发布与清理](docs/发布与清理.md)。
