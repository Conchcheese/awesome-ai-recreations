# 仿生沙虫 MK-X · 复刻 README

> 复刻模型：**GLM 5.3-Flash**｜方法论：teardown 逐帧模拟器

teardown 方法第 4 台机器：Dune 风格的机械沙虫（钻沙行走的分节巨虫），桌面尺度模型
（总长 3.6 m 显示尺度，原作 1300 m × 190 m 按 1/380 缩放，见 ref/spec.md）。

## 产物

| 文件 | 说明 |
|---|---|
| `../pages/04-仿生沙虫MK-X/仿生沙虫MK-X-互动页.html` | 离线单文件互动页，776 KB（≤1 MB 达标） |
| `../pages/04-仿生沙虫MK-X/仿生沙虫MK-X-影片页.html` | 25 s 影片页，783 KB |
| `../pages/04-仿生沙虫MK-X/仿生沙虫MK-X-复刻-25s-1080p60.mp4` | 成片 1920×1080 60fps H.264 + AAC 192k，11 MB（未随仓库分发） |
| 制作期验收帧（未入库） | 节拍接触表 1 张 + 5 张关键单帧 + 拆解转场逐帧 |
| `../covers/` | 封面图（4:3 横版） |
| `../src/kit/sims/sandworm-{shared,film,live}/` | 整机源码 |
| `../references/04-仿生沙虫MK-X/` | 3 张参考图 + spec.md |

## 模型与唯一输入

- **唯一输入：爬行相位 p ∈ [0,1)**（蠕动波周期，f = 0.55 Hz）。14 节环段沿身传播蠕动波
  （波峰鼓胀 +32%、波谷收缩 −18%），头段旋转钻芯（12–46 rpm 随波峰加载）+ 8 颚瓣 +
  24 针齿，尾部排沙喷口 + 喷沙粒子，沙面为程序化沙丘 + 行进沙脊 + 尾部弃沙堆 + 浅沟。
- 关系式：**v = λ·f·ε**（波速 × 应变）= 2.8 × 0.55 × 0.10 = **0.154 m/s**（手算核对）；
  功率 P = T·ω 恒等式；环段压力 220 kPa × 波形。
- 沙下透视：沙板默认透明度 0.78，透视节拍/开关降到 0.07。

## 工具链与命令

全部在系列根目录（`series/机械复刻系列/`）下执行：

```bash
node glm5.3-flash复刻/src/kit/sims/build.mjs sandworm-film && node glm5.3-flash复刻/src/kit/sims/build.mjs sandworm-live
node glm5.3-flash复刻/src/kit/sims/capture.mjs sandworm-film --size 1600x900 --dpr 1.2 --stills beats --cols 4 --out teardown-out/sandworm-beats2.png
node glm5.3-flash复刻/src/kit/sims/capture.mjs sandworm-film --size 1600x900 --dpr 1.2 --stills every:0.5 --from 15 --to 19 --out teardown-out/sandworm-tr1.png
node glm5.3-flash复刻/src/kit/sims/capture.mjs sandworm-film --size 1600x900 --dpr 1.2 --out teardown-out/sandworm-silent.mp4
python3 run_sfx.py glm5.3-flash复刻/src/kit/sims/sandworm-shared/score.py
ffmpeg -y -i teardown-out/sandworm-silent.mp4 -i teardown-out/sandworm-score.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart teardown-out/sandworm-final.mp4
node sheet.mjs --video teardown-out/sandworm-final.mp4 --timeline sims/sandworm-film/timeline.json
```

录制 GPU：`ANGLE Metal`（非 SwiftShader），1500 帧 ≈ 75 s。

## 各步耗时

| 步骤 | 耗时 |
|---|---|
| 必读文件 + 参考图检索/下载 + spec.md | ≈ 10 min |
| model.js + check.mjs（含修 2 处自写错的断言） | ≈ 8 min |
| geometry/geometry-sand/stage | ≈ 9 min |
| console/film/live/main + 构建跑通 | ≈ 8 min |
| 静帧自查两轮 + 修复 + 重录 | ≈ 12 min |
| 配乐/混音/验证/交付/README | ≈ 7 min |

（并发空位回收后从参考图步骤起算，总计 ≈ 54 min，未超 60 min 预算；无卡点超 30 min。）

## 代码行数（wc -l，共 1772 行，目标 1600–2200）

```
model.js 140  check.mjs 132  geometry.js 283  geometry-sand.js 99
stage.js 140  console.js 336  film.js 385  live.js 330  score.py 51
film/main.js 4  live/main.js 4
```

（另有 kit/sims/sandworm-shared/check.mjs 内含 19 条断言；单文件均 <400 行。）

## 遇到的问题与改法（静帧自查发现并修掉）

1. **沙面几乎隐形**（颜色 ≈ 背景，虫像浮在白空中）：沙板颜色 #dde4ee/透明度 0.38 →
   #b9c9e0/0.78，透视模式 0.78→0.07；主机位俯仰 12°→17°。
2. **沙脊读不出来**：隆起公式改为 `min(0.16, max(0, r−0.45·depth)·(0.3+0.9b))`，头部隆包
   上限 0.18；并给虫尾之后加一道浅沟（−3.5 cm）。
3. **针齿外翻像海胆**：针齿改为喉壁 (x0.15, r0.20) 向轴心前 (x0.37, r0.035) 汇聚的
   22 cm 长针（四元数定向），贴近 2021 剧照的"针齿胡须"；颚瓣从锥爪改为口缘装甲板并
   贴紧口缘（半径 0.82·HEAD_R）。
4. **环带螺栓悬浮**：螺栓原放在环节距中点、半径取单环值，与蒙皮插值半径最大差 7 cm →
   改放环带正上方（环心 x、r+0.014）。
5. **拆解时机体离场但沙面被挖坑**：隆起量含 (1−lift) 因子会变负 → 乘前先 `max(0, 1−lift)`。
6. **02 功率面板读数溢出串行**：三行"标签+右对齐值"布局对 m/s 这类长值放不下 → 改为
   三列"标签在上、值在下"的 stat 布局。
7. **运行模式"深度剖面与轨迹"被日志面板裁切**：模式名缩短为"剖面与轨迹"。
8. **尾部喷口件离散**（口环浮在锥外）：口环/暗芯/发光环半径与位置收紧到锥端。

## 验证结果

- `node glm5.3-flash复刻/src/kit/sims/sandworm-shared/check.mjs`：**19 条断言全部通过**（含 1 条手算：v = c·ε =
  1.54 × 0.10 = 0.154 m/s；另有波相位滞后、P=T·ω 恒等、半径不越界/不自交、颚环与尾喷
  相位、路径闭式、钻芯转角积分、速度带等）。
- ffprobe：`1920,1080,60/1,25.000000`（视频），`aac,48000`（音频）。
- blackdetect（d=0.2, pix_th=0.05）：**无黑场**。
- 配乐：25 s、23 个声音、−14.0 LUFS、true peak −2.9 dBFS。
- 互动页烟测（playwright + ANGLE Metal）：自动巡览运行、按钮/光标正常、画质分档正常。

## 未尽事项

- 蠕动波只有 1 个波长走完全身（原计划可选 1.2）；皮肤后滑速率取基准速度的整流近似。
- 喷沙粒子为闭式 t 的简单喷流，未做与沙面碰撞的沉积耦合。
- 转场 15.0–15.5 s 拆解起始 0.5 s 内相机还在从高机位拉出，画面偏空（可接受）。
