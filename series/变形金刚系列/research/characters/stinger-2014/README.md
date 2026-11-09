# 毒刺 / Stinger

目标版本：Age of Extinction (2014)。状态：**待复刻研究档案**，没有可运行模型或成片。

[来源与实际样例元数据](sources.json) · [计划拆分结构](structure.json) · [角色库](../README.md) · [制作协议](../../../docs/工作流协议.md)

## 素材

[电影官方入口](https://www.paramount.com/movies/transformers-age-of-extinction)；尚未完成该角色原始电影镜头测量。

- [官方 SS-02 图库](https://tf.takaratomy.co.jp/products-lineup/tf_ss/ss-02)：授权产品外观补充。

已核验 2 张样例的实际图像响应、尺寸与哈希。图片保留在被忽略的 `local/`，公开提供[对应年份的缩略研究板](../../../references/boards/2014.jpg)与来源元数据；不分发原始大图。无需把原始图片提交才能复用结构。

## 开工与限制

- 电影原始逐帧素材尚未采样；官方产品图只作外观补充，不证明电影内部机构。
- 指节数、轮数、尺度、零件去向与避让轨迹均需原始画面确认。

按 `structure.json` 的 51 个候选模块逐个确认外甲、内撑、转轴/滑轨、活塞、线束和紧固件；所有去向/轨迹初始为空。非人形与合体接口按角色调整。

```bash
python3 "series/变形金刚系列/tools/characters.py" show stinger-2014
python3 "series/变形金刚系列/tools/characters.py" fetch stinger-2014
python3 "series/变形金刚系列/tools/characters.py" start stinger-2014
```

## 该角色的优先核对项

KSI重构证据待核、红色车体、背部构件。这些是待研究候选，不是已经确认或完成的电影机构。
