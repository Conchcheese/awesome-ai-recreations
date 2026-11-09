# 机械构建工具

共用的 Three.js、字体、构建、逐帧采集与合成音效工具。各案例代码及其证据位于[案例目录](../../../cases/README.md)。[上游 MIT 快照](../upstream-teardown/)与[署名](../../../NOTICE.md)单独保存。

## 复现

从仓库根目录执行：

```bash
npm ci --prefix shared/mechanical/kit
npm exec --prefix shared/mechanical/kit -- playwright install chromium
python3 scripts/catalog.py show v8 --variant glm-5-3-flash
```

按目录查询给出的命令构建。GLM 的构建和临时导出位于当前版本的 `artifacts/teardown-out/`，正式 HTML 在版本目录。已有版本的依赖与代码用于重建；独立复刻的资源范围以任务包为准。
