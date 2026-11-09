# Minimax-M3.1-Flash · 变形金刚复刻

执行环境为 MiniMax Code 会话，运行模型 Minimax-M3.1-Flash（会话未暴露可独立核验的精确快照 ID），未另行调用其他模型 API。

| 案例与目标 | 作品和源码 | 来源属性 |
|---|---|---|
| 大黄蜂 · 2007 真人电影 | [互动、影片、规格与验证](bumblebee-2007/README.md) | independent / fidelity |

本机 bash 沙箱内无法启动 Chromium（`bootstrap_check_in ... Permission denied (1100)`），
因此该案例的离线短片由自研软件光栅化器逐帧渲染同源几何，网页检查改用会话内置浏览器完成；
详见[输入与实现](bumblebee-2007/README.md#输入与实现)。

模型名称、视觉目标与来源属性分别记录；模型署名不证明独立性、模型调用记录或电影还原精度。新增模型请按[版本与目录约定](../README.md)建立独立实现。
