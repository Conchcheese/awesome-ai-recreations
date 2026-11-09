# 共同复刻任务

任务可以独立于成果发布。每个案例以任务书定义目标和验收，以输入清单固定原始参考。通用方法与执行边界放在 [_shared](_shared/)，由输入锁一起校验。

| 系列 | 共同任务 |
|---|---|
| 机械 | [机械章鱼](oc8/brief.md) · [V8 发动机](v8/brief.md) · [塞斯纳 337](cessna337/brief.md) · [海滩兽](strandbeest/brief.md) · [仿生沙虫](sandworm/brief.md) · [机械水母](jellyfish/brief.md) · [六足机器人](hexapod/brief.md) · [机械蜜蜂](bee/brief.md) · [机械蝎子](scorpion/brief.md) |
| 变形金刚 | [擎天柱 2007](optimus-prime-2007/brief.md) · [大黄蜂 2007](bumblebee-2007/brief.md) |

```bash
python3 scripts/catalog.py list --tasks
python3 scripts/catalog.py recreate oc8 --export local/input-packs/oc8-v2 --require-complete
python3 scripts/catalog.py verify local/input-packs/oc8-v2
```

`index.json` 登记已就绪的任务；`inputs.lock.json` 锁定其版本和文件摘要。各案例的 `references/local/` 供本地取材。缺少参考时先按清单补齐，再向每位执行者分发同一完整输入包。已有实现放在 [series](../series/)。

## 历史输入

当前 11 个任务使用 v2 通用说明。v1 的任务清单、通用文档与导出工具可从提交 `b231b6c0c84303da6158fe7a0278a4149560f66a` 恢复。原始媒体继续按历史清单的 SHA-256 核对，本地留存的旧输入包按各成果记录识别。新成果引用实际使用的版本，历史记录沿用当时条件。

[共同输入与资源](../docs/共同输入与资源.md) · [新增任务](../CONTRIBUTING.md#新增或修订任务) · [作品首页](../README.md)
