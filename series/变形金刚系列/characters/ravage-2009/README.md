# 机器狗 / Ravage

目标版本：Revenge of the Fallen (2009)。状态：**待复刻研究档案**，没有可运行模型或成片。

[来源与实际样例元数据](sources.json) · [计划拆分结构](structure.json) · [角色库](../README.md) · [制作协议](../../工作流协议.md)

## 素材

[电影官方入口](https://www.paramount.com/movies/transformers-revenge-of-the-fallen)；尚未完成该角色原始电影镜头测量。


已核验 0 张样例的实际图像响应、尺寸与哈希。图片保留在被忽略的 `local/`，公开提供[对应年份的缩略研究板](../../references/boards/2009.jpg)与来源元数据；不分发原始大图。无需把原始图片提交才能复用结构。

**片段/图证示例：** [来源入口](https://www.youtube.com/watch?v=Ca3IBHG0Xuw)。Ravage Attacks；已核验角色对应的片段入口，尚未抽帧测量。 尚未冻结单帧，开工时先取材标注。

## 开工与限制

- 电影原始逐帧素材尚未采样；官方产品图只作外观补充，不证明电影内部机构。
- 指节数、轮数、尺度、零件去向与避让轨迹均需原始画面确认。
- 片段/图证的单帧冻结尚未完成，禁止用异年同名素材替代。

按 `structure.json` 的 16 个候选模块逐个确认外甲、内撑、转轴/滑轨、活塞、线束和紧固件；所有去向/轨迹初始为空。非人形与合体接口按角色调整。

```bash
python3 "series/变形金刚系列/tools/characters.py" show ravage-2009
python3 "series/变形金刚系列/tools/characters.py" start ravage-2009
```

## 该角色的优先核对项

四足、颌部、背甲与尾链。这些是待研究候选，不是已经确认或完成的电影机构。
