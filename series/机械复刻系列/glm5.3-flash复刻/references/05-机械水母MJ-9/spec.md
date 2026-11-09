# 机械水母 MJ-9 · 参考规格（spec）

参考图（原始参考见共同任务）：
- [Festo-AquaJelly-特写-正面.jpg](../../../../../tasks/jellyfish/references/02-Festo-AquaJelly-特写-正面.jpg) —— 主参考。Festo AquaJelly（2008，Bionic Learning Network）：透明半球钟罩，钟顶一块白色圆环形极板；钟罩下是灰白色耐压舱（圆柱、带端盖螺钉）；8 条聚碳酸酯触须沿钟缘分布，每条是一串半透明链节、节间夹白色 LED 方块，须端带叶状鳍片；舱体外侧 4 片竖直定位鳍。
- [Festo-AquaJelly-三台编队巡游.jpg](../../../../../tasks/jellyfish/references/01-Festo-AquaJelly-三台编队巡游.jpg) —— 编队视角：能看到钟缘一圈 8 根短刚骨架 + 触须拖尾姿态，水面反光下钟体接近透明。
- [弗吉尼亚理工-RoboJelly-水槽测试.png](../../../../../tasks/jellyfish/references/03-弗吉尼亚理工-RoboJelly-水槽测试.png) —— Virginia Tech RoboJelly 水槽测试（帧抓）：钟体分段式、收缩时钟口内收、带拖缆。取其"收缩-舒张"脉动姿态与裙边内收形态。

## 部件表（与几何文件对应）

| 部件 | 参考出处 | 几何 |
|---|---|---|
| 钟体 8 片柔性瓣（透明半球瓣，收缩下压收拢、舒张回弹，逐瓣沿缘滞后模拟波动） | AquaJelly 透明钟罩 + RoboJelly 分段钟 | geometry-bell.js |
| 钟缘裙边（valve skirt，8 瓣锯齿软裙，收缩时内收） | RoboJelly 钟口内收 | geometry-bell.js |
| 钟顶泵核（耐压舱：吸入-喷出泵 + 喷口 4 瓣，排气段张开） | AquaJelly 中央耐压舱 + 电驱动 | geometry-pump.js |
| 触须 5 条（链节摆动，被动拖曳，相位沿须错开） | AquaJelly 8 触须（本仓库 5 条，模型为 TENTACLES=5） | geometry-tentacle.js |
| 平衡腔（钟内浮沉活塞，随相位微动） | AquaJelly 压载舱（ buoyancy tank，升沉控制） | geometry-pump.js |
| 钟顶极板 + 环形灯圈 | AquaJelly 钟顶白环 + LED | geometry-bell.js |

## 唯一输入

脉动相位 `p ∈ [0,1)`，一个收缩-舒张周期；脉动频率 `PULSE_HZ = 0.85 Hz`（guess，水母量级 0.5–1 Hz）。`t` 秒对应 `p = (t·PULSE_HZ) % 1`。

## 尺寸表（桌面尺度，钟体直径约 0.5 m）

| 名称 | 值 | 单位 | 来源 |
|---|---|---|---|
| BELL_R（钟体半径） | 0.25 | m | guess（任务设定直径 ≈0.5 m） |
| BELL_H（钟体拱高） | 0.17 | m | guess（参考钟罩高/径比 ≈0.68） |
| PETALS（钟体瓣数） | 8 | - | frame（AquaJelly 8 条骨架/触须位） |
| PETAL_LAG（相邻瓣相位滞后） | 0.045 | 周期 | guess（沿缘波动量） |
| PETAL_DIP（收缩时瓣尖下压） | 16 | deg | guess |
| SKIRT_DENT（裙边内收幅度） | 0.032 | m | guess |
| PUMP_D（泵核舱直径） | 0.115 | m | guess（AquaJelly 舱/钟径比 ≈0.46） |
| PUMP_H（泵核舱长） | 0.16 | m | guess |
| NOZZLE_FLAPS（喷口瓣数） | 4 | - | frame（任务设定喷口 4 瓣） |
| NOZZLE_D（喷口直径） | 0.042 | m | guess |
| NOZZLE_A（喷口面积） | π·0.021² = 1.385e-3 | m² | 手算 |
| TENTACLES（触须数） | 5 | - | guess（任务设定 4-6 条） |
| SEG_PER_T（每须链节数） | 22 | - | guess |
| SEG_LEN（链节长） | 0.042 | m | guess（触须全长 ≈0.92 m） |
| TENT_PHASE_STEP（相邻须相位差） | 1/5 周期 | - | frame（任务设定相位沿须错开） |
| SWAY_MAX（节摆角幅） | 26 | deg | guess |
| PULSE_HZ（脉动频率） | 0.85 | Hz | guess |
| PEAK_KPA（钟腔压力峰） | 12 | kPa | guess（章鱼 OC-8 为 93 kPa 喷水姿态，水母柔性钟取低一个量级） |
| DEPTH0（初始深度） | 12.4 | m | guess |

## 推力手算（check.mjs 第 1 条）

`T = 2·ΔP·A`：压力峰 `ΔP = 12 kPa`、喷口面积 `A = π·(0.042/2)² = 1.3854e-3 m²`，
`T_peak = 2 × 12000 × 1.3854e-3 ≈ 33.25 N`（取整面版峰读数 ≈33 N）。

## 相机与节拍（timeline.json，总 25 s）

| t (s) | 拍 | 视角 |
|---|---|---|
| 0 | 巡游 | 主机位 3/4 缓移，全机 + 界面 |
| 3 | 泵核特写 | 俯冲向钟顶泵核，喷口 4 瓣开合 |
| 6 | 钟体收缩波 | 侧高机位，8 瓣逐瓣滞后特写 |
| 9 | 触须拖曳 | 钟缘下仰视，5 须错相摆动 |
| 12 | 深度剖面+推力曲线 | 侧视拉远，面板推力/深度为主 |
| 15 | 拆解转台 | 整机拆解 + 330° 转台 |
| 19 | 重组 | 部件回归 |
| 22 | 离场 | 上浮离站，拉远 |
