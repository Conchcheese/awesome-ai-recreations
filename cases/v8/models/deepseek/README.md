# V8发动机 · DeepSeek

[互动 HTML](index.html) · [巡览 HTML](film.html) · [源码](src/) · [规格](src/spec.md) · [实现与验证](records/实现与验证.md)

## 重建

从仓库根目录安装共用依赖，再查询本版本的构建与检查命令。

```bash
npm ci --prefix shared/mechanical/kit
python3 scripts/catalog.py show v8 --variant deepseek
```

离线页面可直接打开。共享工具、离线构建和素材说明见 [机械构建工具](../../../../shared/mechanical/deepseek-kit/README.md)。执行条件和实现差异见本版验证记录。共同任务见[案例入口](../../README.md)。
