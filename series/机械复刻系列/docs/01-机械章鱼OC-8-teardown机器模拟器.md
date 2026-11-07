# 01 机械章鱼 Pelagos OC-8：可拆解 3D 机器模拟器复刻全流程

> 本文档记录 **GLM 5.3-Flash 版（9 台，原交付）** 的首次复刻过程；同一方法也用于 **DeepSeek 版（00/01，主推）**，后者见 [`../deepseek复刻/`](../deepseek复刻/)。

> 类别：3D 机器模拟器（teardown 方法）　状态：已完成（OC-8 复刻已出片 25 秒）
> 写于 2026-11-01（北京时间，Asia/Shanghai）。本文分两部分：A 是 OC-8 这次复刻的实际记录，B 是跨工具通用方法（原文并入，保证本文单独可用）。
> 凡是没有证据的地方写「未找到记录」，没有验证过的写「未验证」。

---

## A 部分：OC-8 复刻记录（只写有证据的）

### A.1 一页概览

| 项 | 内容 |
|---|---|
| 原作 | 机械章鱼 Pelagos OC-8 的 25 秒演示视频，作者 @0x_fokki，帖子 https://x.com/0x_fokki/status/2116289885870981296 |
| 方法来源 | @elvar_official 的 teardown skill，帖子 https://x.com/elvar_official/status/2116174609355571402 ；仓库 https://github.com/elvarofficial/teardown （MIT 许可）；它参考了 whaleyxbt 的 claude-motion |
| 原作者是否公开提示词和源码 | 没有。视频作者自述代码约 2,616 行，提示词和源码均未公开。本仓库做的是「同一套方法下自己的章鱼」，造型对照视频里的帧，数字大多是估算 |
| 目标效果 | 一个离线单文件 HTML（约 830 KB）：3D 机器加右侧控制台（子系统按钮、曲线、示意图、视角按钮），带自动巡览；再加一条 25 秒 1920×1080 60 帧的演示视频，带代码合成的配乐 |
| 成果 | `glm5.3-flash复刻/pages/00-机械章鱼OC-8/`：互动页 828,808 B、影片页 836,060 B（2026-11-03 交付版：中文化重建 + 中文页面标题，与 `glm5.3-flash复刻/src/kit/sims/octopus-*` 的重建产物逐字节一致；历史版本为英文首版互动页 827,301 B、影片页 834,362 B）；成片 `机械章鱼OC8-复刻-25s-1080p60.mp4` 42,303,718 B，未随仓库分发 |
| 视频规格（ffprobe 实测） | H.264，1920×1080，60 fps，25.000 s，音轨 AAC，时长 25.000 s |

### A.2 资产清单与位置

本仓库 OC-8 目录（`glm5.3-flash复刻/pages/00-机械章鱼OC-8/`、`glm5.3-flash复刻/references/00-机械章鱼OC-8/`、`glm5.3-flash复刻/records/`）：

| 位置 | 内容 |
|---|---|
| `glm5.3-flash复刻/references/00-机械章鱼OC-8/spec.md` | 造型规格书：零件表、唯一输入、尺寸表（每个数字标 frame 或 guess）、相机、巡览节拍。全文见 A.5 |
| `glm5.3-flash复刻/src/kit/sims/octopus-shared/` | model.js（141 行）、geometry.js（148）、geometry-arm/beak/head/mantle/siphon.js（116/81/65/151/76）、stage.js（184）、console.js（338）、film.js（301）、live.js（348）、check.mjs（107）、score.py（52） |
| `glm5.3-flash复刻/src/kit/sims/octopus-film/` | main.js（4 行）、timeline.json（12 行，节拍表） |
| `glm5.3-flash复刻/src/kit/sims/octopus-live/` | main.js（4 行） |
| `glm5.3-flash复刻/pages/00-机械章鱼OC-8/` | 三个交付文件（见 A.1） |
| `glm5.3-flash复刻/covers/` | 封面图（浅色 A、深色 B）、缩略图 |
| 制作期素材（未入库） | 原视频、节拍接触表与关键单帧、封面 HTML 源与参考帧 |

工具仓库：`glm5.3-flash复刻/src/upstream-teardown/` 是 teardown 仓库的克隆（上游版本控制实际追踪的部分，不含 octopus —— 上游 README 演示了章鱼但没把源码纳入版本控制）。本仓库的 OC-8 实现放在 `glm5.3-flash复刻/src/kit/sims/octopus-{shared,film,live}/`，与另外 8 台并列；`glm5.3-flash复刻/src/kit/` 是 9 台共用的构建工作副本。

### A.3 环境

- 环境：macOS / Linux；Node、ffmpeg、Python 3；浏览器用 Playwright 自带的 Chromium。
- macOS 下无头 Chrome 默认的软件渲染路径可能起不来；构建副本 `glm5.3-flash复刻/src/kit/paths.mjs` 已给 Chromium 加上 `--use-angle=metal`，其他平台不需要。`glm5.3-flash复刻/src/upstream-teardown/` 快照保持上游原样，不含该参数。
- 要复现需要的命令：`git clone https://github.com/elvarofficial/teardown`、`npm install`、`npx playwright install chromium`、`ffmpeg`、`python3`。

### A.4 复刻的推进顺序（概要）

一次完整复刻大致按下面的顺序推进，每步的产物在本仓库里可查：

1. **看参考**：原作视频/示例页 + 上游仓库，确认结构、节拍与可读出的数字；
2. **写规格**：`spec.md` 列出零件、尺寸、唯一输入、相机与节拍，逐项标来源；
3. **环境冒烟**：先用仓库自带示例验证构建与录制链路能出页面；
4. **写实现**：`model.js` → `geometry-*.js` → `stage.js` → `console.js` → `film.js` / `live.js`；
5. **构建与断言**：`build.mjs` + `check.mjs`，产物与交付页面逐字节一致；
6. **录制与配乐**：`capture.mjs` 逐帧录制，`run_sfx.py` 按同一份时间线合成配乐，ffmpeg 混音；
7. **中文化与视觉调整**：面板文字、配色、构图与节拍细节的迭代。

每一步的具体数字、耗时与失败重试记录，见正文各节与 [`../glm5.3-flash复刻/records/`](../glm5.3-flash复刻/records/)。

### A.5 造型规格书 `ref/spec.md`（原文）

规格书头部写明：来源是 0x_fokki 视频里 00:08（外套膜张开）和 00:16（喙张开）两帧，加外套膜特写 oct8.png；每个数字标「frame」（从图上读到）或「guess」（估算，这台机器没有手册）。

零件表：

| 组 | 数量 | 形状（来自帧） | 材质 |
|---|---|---|---|
| 外套膜壳 | 1 个加 8 片 | 高圆顶，上沿一圈 8 片白色装甲瓣向外铰接张开；下半是亮黑碗；铆接白板，橙色条饰 | 白装甲、亮黑 |
| 脑核（在外套膜里） | 1 | 黑色缠绕线缆球，带橙色小卡扣，坐在黑碗里 | 哑光黑线缆 |
| 玻璃舷窗 | 1 | 外套膜前下方的圆窗，深色玻璃，橙色边圈，内有齿轮辐条 | 玻璃加橙环 |
| 光学单元 | 2 | 头部两只大镜头，深色镜筒，橙色边圈，玻璃前镜 | 白镜筒加玻璃 |
| 腕 | 8 | 每条是一串节段：白装甲板盖着深色芯，两侧可见橙色滚轮，末端卷成螺旋；围着中心轮毂安装 | 白装甲加橙轮 |
| 虹吸管 | 1 | 外套膜后下方的漏斗套筒组件（控制台写 3 节套筒），6 瓣喷口 | 白加深色 |
| 喙 | 1 | 中心下方、腕根之间：深色双颚围着橙色齿舌环，像相机快门一样合拢 | 亮黑加橙 |
| 轮毂环 | 1 | 腕的安装中心，多层白环带铆钉 | 白装甲 |

控制台读数（8 秒、16 秒两帧里的子系统面板）：OPTIC ARRAY（2×82 mm 镜头，IR 圈）、MANTLE SHELL（8 瓣，玻璃舷窗）、PUMP CORE（反应环，7 个活塞）、ARM CHAINS（202 节，480 个滚轮，8/8 在线）、SIPHON（3 节套筒，6 瓣喷口）、BEAK（双颚，齿舌环）。

唯一输入：喷射相位 p ∈ [0,1)，每 1/1.8 秒（约 0.556 秒）一次外套膜脉冲。
- 外套膜压力是 p 的函数，每个脉冲一个 93 kPa 的峰；推力 = 2·ΔP·A，喷口 38 mm 对应 A ≈ 1.134e-3 m²，峰值约 211 N。
- 外套膜的瓣随脉冲小幅开合（呼吸），只有巡览里「外套膜张开」那一拍才完全张开。
- 每条腕按同一条波卷曲，相邻腕错开 1/8 个脉冲。
- 虹吸管的喷口瓣在脉冲的排气段张开。
- 头、光学、喙相对外套膜是静止的。

尺寸表（毫米；来源列标明 frame 或 guess）：

| 部位 | 数值 | 来源 |
|---|---|---|
| 外套膜长度 | 420 | guess（文档示例值） |
| 外套膜直径 | 300 | guess（文档示例值） |
| 壳瓣 | 8 片，各张开约 70° | 8 片来自 frame，角度是 guess |
| 玻璃舷窗直径 | 120 | 按比例估 |
| 光学镜头直径 | 82 | frame（控制台写 82 mm） |
| 腕长 | 25 节 × 40 mm = 1000 | guess（文档示例；控制台总计 202 节约合每条 25 节，对得上） |
| 腕节尺寸 | 长 40，宽约 34 | guess |
| 腕滚轮 | 480/8 = 每条 60 个，约每节 2 到 3 个 | frame |
| 单关节最大弯角 | 12°，整条完全卷曲约 300° | guess（文档示例） |
| 虹吸喷口 | 直径 38，6 瓣，3 节套筒 | guess，控制台为准 |
| 喙 | 双颚，齿舌环约 90 | 按比例估 |
| 峰值压力 | 93 kPa | frame（JET 面板峰值，文档的手算检验） |
| 峰值推力 | 211 N | frame 加 T = 2·ΔP·A 手算 |
| 脉冲频率 | 1.8 Hz | guess（文档示例） |
| 电池、功耗、电芯电压、电机温度 | 84% 到 86%，16 到 21 W，3.72 V，25 到 27 °C | frame（POWER 面板） |
| 深度、速度 | 约 12.3 m；垂直速度 +0.06 到 0.09 m/s；航速 0.08 到 0.12 m/s | frame（DEPTH 面板） |

手算检验：A = π·0.019² = 1.134e-3 m²；T = 2·93000·1.134e-3 ≈ 211 N，对得上。

相机：主视角取斜上方 3/4 角，8 条腕向四周展开（正对着看，8 条腕会糊成一排栅栏）；机器占画面 60% 到 70%。喙在中心下方、虹吸管在后方、脑核在外套膜里，主视角看不到。巡览里的特写：光学（正面）、外套膜（上方，瓣张开）、R2 腕（沿一条腕）、虹吸管（后方）、喙（下方）。

巡览各拍：光学（镜头对焦，IR 圈亮起）；外套膜（8 瓣张开约 70°，脑核升起转动；原片 8 秒时张开 70%）；虹吸管（3 节套筒伸出，6 瓣喷口张开）；R2 腕（一条腕从身体旁展开，各节散开）；喙（双颚分开约 50%，齿舌环旋转；原片 16 秒时分开 50%）；原片 16 到 20 秒整机拆开、转台约 330° 后重组。

### A.6 实际做出来的结构和参数（从代码读到的）

文件分工与文档一致：model.js 只放纯函数数学，不含 three.js；几何拆成 5 个文件，每个都在 150 行以内；stage.js 放灯光、地面、相机；console.js 画控制台；film.js 读 timeline.json 出影片页；live.js 出互动页。节拍表 `octopus-film/timeline.json` 如下（秒）：

```json
{ "duration": 25, "jet": 0, "optics": 3, "mantle": 5.2, "siphon": 9,
  "arm": 11.2, "beak": 13.4, "explode": 16.2, "reassemble": 20, "depart": 23 }
```

film.js 的节拍里，每一拍带视角、状态词、模式词、操作员阶段。配乐 score.py 读同一个 timeline.json，所以声音和画面不会错位。

model.js 的参数（代码实值；括号里是 spec.md 的原值，有出入的标出）：

| 名称 | 值 | 备注 |
|---|---|---|
| PULSE_HZ | 1.8 | 与 spec 一致 |
| PEAK_KPA | 93 | 一致 |
| NOZZLE_D | 0.038 m | 一致，推力峰值 THRUST_PEAK ≈ 211 N |
| MANTLE_LEN、MANTLE_DIA | 0.42 m、0.30 m | 一致 |
| PETALS | 8 | 一致 |
| PETAL_OPEN | 55° | spec 写约 70°，代码改成 55°，注释的理由是「像郁金香一样张开，不要摊平」 |
| ARMS、LINKS、LINK_LEN | 8、25、0.04 m | 一致；LINKS_TOTAL = 8×25+2 = 202（多出的 2 节算在喙的双颚上） |
| JOINT_MAX | 代码 14°（头部注释表写 12.5°，spec 写 12°） | 三处数字不一致，以代码为准；注释写的目的是「腕尖停在穹顶旁边，不越过它」 |
| WHEELS_PER_ARM | 60 | WHEELS_TOTAL = 480 |
| OPTIC_D | 0.082 m | 一致 |
| SIPHON_SLEEVES、NOZZLE_FLAPS | 3、6 | 一致 |
| HUB_R、HUB_Y、ARM_PITCH0 | 0.165 m、-0.04 m、-0.3 rad | spec 没有，建模时加的（腕根位置和初始朝向，让腕先向外弧出再卷起，避免自然下垂） |

脉冲函数：`pulse(p)` 是每个脉冲一个高斯，峰在 p = 0.42，宽 0.13；`flap(p)` 是喷口瓣的开合曲线；`pressureKPa = 93·pulse`；`thrustN = 2·pressureKPa·1000·A·flap`；`speed = 0.075 + 0.12·pulse`。

check.mjs 的断言（跑 `node sims/octopus-shared/check.mjs`），共覆盖：脉冲峰在 p = 0.42；压力峰等于 93 kPa；峰值时喷口瓣全开；峰值推力在 211 N 的 1 N 以内；怠速推力在个位数到两位数牛；第 3 条腕的卷曲等于第 2 条腕移 1/8 个脉冲；每个关节弯角不超过 JOINT_MAX；腕链不会折回到轮毂下面；完全卷曲时腕尖向上向内成螺旋；速度在 0.05 到 0.25 m/s；推力最大值等于手算峰值；外套膜随脉冲内收并变长；瓣在闭合时仍有轻微呼吸；瓣开到 PETAL_OPEN；IR 圈随脉冲亮起；虹吸套筒伸出、瓣展开；喙在咬合时轻微张开；202 节总数和 480 个滚轮总数与控制台一致。

check.mjs 在本次整理中没有重跑，所以「全部通过」未验证。

### A.7 复刻的实际步骤（对应 B 部分的十步）

1. 选机器和参考：用 0x_fokki 视频 8 秒和 16 秒两帧（源文件里的 frame-08s.jpg、frame-16s.jpg、oct8.png、oct16d.png），写成 `ref/spec.md`。
2. 环境验证：先构建仓库自带的塞斯纳示例，确认能出页面，顺手给 paths.mjs 加 `--use-angle=metal`。
3. 建模：先写 model.js（纯函数、参数表带来源），再写 check.mjs 断言，再写 5 个几何文件。
4. 控制台：console.js，6 行子系统按钮、曲线、示意图、视角按钮，所有数字读自模型。
5. 风格：stage.js，浅色摄影棚、柔影、一个强调色。
6. 自检：出每一拍的静帧（live-mantle.png、live-exploded.png、octopus_sheets 接触表）。自检时发现并调整了什么：未找到记录。
7. 互动页和影片页：`node sims/build.mjs octopus-live`、`octopus-film`，得到单文件页面（约 830 KB）。
8. 录视频：输出 1920×1080，60 fps，25 秒。实际命令行未找到记录；输出尺寸与文档里的 `--size 1600x900 --dpr 1.2` 相乘一致（1600×1.2 = 1920，900×1.2 = 1080），推测用的是这组参数，未验证。
9. 配乐：`python run_sfx.py sims/octopus-shared/score.py`，生成 octopus-score.wav；用 ffmpeg 合成 octopus.mp4。score.py 的内容：安静的水下底床（柔和电钢琴和弦，无鼓），镜头到达每个组件时一声低沉的 whoosh，操作员按每个按钮时一声轻 click，零件分离时一声轻 pop，拆解冲击前一个 riser，重组完成时一声 chime，离站时有空气声；响度目标 -14 LUFS，随机种子 31。
10. 发布：归档到交付目录。第 9 步「发布上线」和第 10 步「加餐滑块」：本次未做，未找到记录。

### A.8 迭代与调参（能确认的）

- 数字从 spec 到代码有三处改动：PETAL_OPEN 70° 改 55°；JOINT_MAX 12° 改 14°（头部注释表仍写 12.5°）；新增 HUB_R、HUB_Y、ARM_PITCH0。改动的触发原因只有代码注释里的描述，改了几轮未找到记录。
- 中文化改写：已于 2026-11-02 完成交付——仓库内 `glm5.3-flash复刻/pages/00-机械章鱼OC-8/` 的两个页面即中文化重建版（见 A.1），`glm5.3-flash复刻/src/kit/sims/octopus-*` 的 console.js（47 行含中文）、film.js（35 行）、live.js（2 行）与交付页对应。
- 经验：参数写在 model.js 顶部并带来源标记，之后改数字不用动几何文件；节拍写在 timeline.json，画面和配乐共用一份。

### A.9 素材与交付

这次复刻产出的内容，分三类：

| 类别 | 内容 | 位置 |
|---|---|---|
| 交付页面 | 单文件离线互动页 + 影片页（各约 830 KB） | `glm5.3-flash复刻/pages/00-机械章鱼OC-8/` |
| 源码快照 | `octopus-shared` / `octopus-film` / `octopus-live` 三目录，与 `glm5.3-flash复刻/src/kit/sims/` 逐字节一致 | `glm5.3-flash复刻/src/kit/sims/octopus-*` |
| 造型依据 | 造型参考图 + `spec.md` 参数表 | `glm5.3-flash复刻/references/00-机械章鱼OC-8/` |

- 25 秒成片（`机械章鱼OC8-复刻-25s-1080p60.mp4`，42,303,718 B）体积较大，未随仓库分发，可按第十步的复现命令自行生成。
- 制作期的验收静帧（节拍接触表、关键单帧、波形图）留在制作目录，未入库。

### A.10 验收标准（本次采用）

1. `check.mjs` 全部断言通过。
2. 每一拍出静帧逐张看：有无零件穿插、悬空、标签遮挡、数字与姿态不符。
3. 转场按 0.2 秒步长拉一遍，看有无跳变。
4. 成片 1920×1080、60 fps、25.0 秒，H.264 加 AAC，ffprobe 可核对。
5. 页面单文件离线可开，体积小于 1 MB（实测约 830 KB）。
6. 波形图和接触表各出一张留档（octopus_wave.png、octopus_sheets）。

### A.11 常见问题

- macOS 无头 Chrome 起不来或画面黑：给 Chrome 启动参数加 `--use-angle=metal`（本仓库已加在 `glm5.3-flash复刻/src/kit/paths.mjs`）。
- 模型一次吐不完 2000 行：拆文件，一个文件一个请求，见 B 部分 3.0。
- 其余见 B 部分第 4 节排错表。

### A.12 其他可选题材

机械鸡（自有题材）、机械表擒纵机构：提示词在 B 部分附录 B。仓库自带示例还有塞斯纳、V8、Strandbeest 等，换机器时只改 spec 和 model，流程不变。

### A.13 缺失信息

- 复刻的执行者与模型：GLM 5.3-Flash；实际提示词、迭代轮次：未找到记录。
- 录视频的实际命令行：未找到记录。
- 中文化改写的目标和进度：未找到记录。
- check.mjs 最近一次通过的输出：未验证。

---

## B 部分：跨工具通用方法（2026-11-01 整理）

> 给 DeepSeek、Codex、Cursor、Gemini CLI 这类工具复刻「可拆解 3D 模拟器」用的。
> 上一版（只讲 Claude Code）：`章鱼复刻全流程.md`。这一版把所有提示词都改成能在别的工具里照抄。
> 写于 2026-11-01（北京时间）。凡未亲自验证的工具说法，都标了「未核实」。

---

### 0. 先说结论

1. **能复刻，但要分清卡在哪。** 这套流程里模型只负责写代码；真正要跑 `node`、`playwright`、`ffmpeg` 的是「智能体外壳」（Z Code、Codex、Cursor、Claude Code 这类）。所以选工具先看它能不能在你电脑上跑命令，其次才看模型。
2. **三条路线**（第 2 节详细讲）：
   - A. 会跑命令的智能体（Z Code / Codex / Cursor / Gemini CLI / 接了 DeepSeek 或 GLM 的 Claude Code 兼容客户端）：最接近原作者的做法，推荐。
   - B. 只能聊天的网页（DeepSeek 网页版等）：能出代码，但文件要你手动保存、手动跑；录视频要在自己的电脑上做。
   - C. 录视频这一步跟模型无关：用仓库自带的脚本，或者自己写个 playwright+ffmpeg 循环。
3. **弱一点的模型第一版大概率是「玩具」。** 花花大人用 Codex 复刻机械蚁时，第一版控制台脚本只有约 4KB（官方示例动辄 20KB 以上），模型像「椭圆肉球插六根牙签腿」，靠多轮挑刺才救回来（作者自述；未运行其仓库）。所以本文每一步都按「小步、一次一个文件、先表后码」来拆。
4. **一台机器大概 1600 到 2200 行代码。** 仓库里的三个示例统计：V8 约 1900 行、塞斯纳约 1600 行、Strandbeest 约 2200 行（JS 加 score.py）。章鱼视频的作者自述 2,616 行，量级对得上。一次让模型吐 2000 行基本会被截断，所以要拆成 7 个文件、一个一个要。
5. 原视频里的章鱼（Pelagos OC-8）没有公开提示词，也没有公开源码。你照本文做出来的是「同一套方法下你自己的章鱼」，不会和视频一模一样。

---

### 1. 来源与数据

#### 1.1 来源

| 项目 | 内容 |
|---|---|
| 方法原文 | @elvar_official 的 X Article《How I Turn Any Machine Into a 3D Simulator You Can Take Apart》，2026-10-30 22:25（北京时间）发布 https://x.com/elvar_official/status/2116174609355571402 |
| 文章最新数据 | 浏览 874,615，收藏 2,775，赞 1,088，转发 169，引用 70，回复 43（2026-11-01 11:4x 北京时间查询） |
| 章鱼视频 | @0x_fokki 在 2026-10-31 06:03（北京时间）引用转发，25 秒，浏览 547,909，赞 6,104，收藏 6,601（同一时间查询）https://x.com/0x_fokki/status/2116289885870981296 |
| 技能仓库 | https://github.com/elvarofficial/teardown （MIT，免费，自带 V8、塞斯纳起落架、Strandbeest 三个示例） |
| 在线示例 | https://visual-learning.app |
| 上游工具 | whaleyxbt/claude-motion（逐帧录制和音效引擎），teardown 站在它上面 |

#### 1.2 产物的 6 个组成部分（文章原话的意思，用六足机器人举例）

一个 HTML 页面，约 800KB，离线可用。

1. **机器**：全部用代码建模（六足机器人是六边形底盘、6 条腿、18 个关节、红色舵机壳）。
2. **模型**：一个求解器驱动所有部件，机器、面板、地面都读它。
3. **面板**：关节扭矩、每只脚的高度、6 条腿的负载、求解耗时、舵机温度。
4. **按钮**：步态切换、方向键、WASD、速度/步幅/车身高度滑块。
5. **窗口**：地面上画出求解器在干什么（连到每只着地脚的线、落脚点标记、摆动轨迹）。
6. **巡览**：没人碰的时候，一个光标自己操作页面；点任何东西就把控制权交给你；安静 25 秒后巡览回来。

另外可以导出 60fps、1920×1080、带配乐的视频。

#### 1.3 案例清单（数字均为作者自述，未核实）

| 案例 | 文章里怎么写的 |
|---|---|
| V8 发动机 | 「类似的 V8 模拟器在 X 上 3,790,000 浏览」；你跟踪的那个气缸变成玻璃，能看到混合气在里面燃烧，压力图每 720° 曲轴闭合一圈；V8 影片 26 秒、189 个音效，每一下低音都落在做功冲程上 |
| 山火工具 | 「用 Opus 5.5 做的山火工具 1,640,000 浏览」（这个不是 teardown 做的，只是文中举例） |
| 沙虫 | 长 1,300 m、宽 190 m；面板读的是沙虫的真实姿态，头段跟着钻头转，深度剖面跟着埋在地下的身体走，地图画出它的轨迹 |
| 机械水母 | 每个子系统是一个按钮，按下去那部分散开，其余身体让位 |
| 六足机器人 | 18 个关节；集显上 15fps，加了降质档位后 75fps；沙丘页面慢在一个着色器，每个顶点把同一个位移算了 5 次 |
| 塞斯纳 337 起落架 | 液压缸推一根 201 mm 的齿条，齿条带动 32 齿齿轮（模数 4 mm，分度圆 128 mm）转正好半圈，起落架腿摆 180° 收进机身。手算：128 mm 圆周的一半约 201 mm |
| Strandbeest | 用 Theo Jansen 1990 年的 11 根连杆长度，转曲柄后每个关节靠「圆与圆求交点」算出来 |
| 兔子场景 | 兔子脸从帽子壁里穿出来，一个数 0.222 m 把它放回去；深色版本丢了 feed 的第一秒；带模型的页面 15.9 MB，X 不显示链接卡片；模型挪出去后 967 KB，卡片出现 |
| 数量 | 2 天做了 7 个，3 个随技能开源（V8、塞斯纳、Strandbeest） |
| visual-learning.app | 文章说「6 个在浏览器里跑」。2026-11-01 打开站点，Simulators 栏列了 7 个：机械水母、六足机器人、沙虫 MK-X、Strandbeest、V8、塞斯纳起落架、机械蜜蜂；下面还有 Machines 栏几十个日常机器（无人机、劳力士、咖啡机之类）。章鱼不在站点列表里 |
| 作者推荐但没做的 5 个题材 | 自行车变速器换 11 个飞轮、机械表擒纵机构 4 Hz、汽车差速器过弯、缝纫机锁式线迹、挖掘机挖一斗 |

#### 1.4 文章没讲、翻仓库和视频发现的事

- **章鱼来自仓库 README。** 仓库 `docs/` 里有蜜蜂（Mellis HB-7）、蝎子（Telson SC-8）、章鱼（Pelagos OC-8）三个 GIF。`octopus.gif` 与 0x_fokki 视频帧对照过，是同一台 Pelagos OC-8。但仓库只带 V8、塞斯纳、Strandbeest 的源码，章鱼的源码和提示词都没有。
- **章鱼的构建过程在 0x_fokki 的长推文里**（文章里没有）：参考图定外观；先渲一张静帧和参考图并排，改了 3 轮才碰影片；第一版像玩具，于是回去给 8 条手臂塞进 202 节连杆和 480 个轮子（作者自述）；每条手臂一次 draw call，每帧沿着弯折链摆姿势；每 2 到 3 秒就有东西打开（镜头旋开、外套膜铰开、泵升起来转）；0:16 整体炸开、绕 330° 转台、转完前复位；25 秒、2,616 行代码。
- **示例里的 `timeline.json` 只有一个 `duration`。** 三个示例的 `*-film/timeline.json` 内容就是 `{"duration":26.2}` 这种，没有节拍时间。节拍在 `film.js` 的 SCRIPT 和 `score.py` 的常量里写死。后果：你新做一台机器时，如果不自己把节拍写进 `timeline.json`，`--stills beats` 只会出一张图，音效也没法跟画面对时间。本文第 7、8 步里专门处理了。
- **页面 800KB 的底子不是机器。** 字体约 114KB（JetBrains Mono ×3 加 Inter），其余大头是压缩后的 three.js 和后处理，塞斯纳整台机器代码约 74KB。1MB 上限留给你的机器大概 150 到 200KB。模型用 GLB 的话必须外置。
- **响度规格两个说法。** SKILL.md 写真峰值 ≤ −2 dBFS，文章提示词写「低于 −1 dB」。实测塞斯纳配乐 −14.0 LUFS、真峰值 −2.5 dBFS，两个说法都满足。
- **`capture.mjs` 能录任何网页。** 只要 HTML 暴露 `window.seek(秒)`，设好 `window.DURATION` 和 `window.FPS`，并且 `?render` 时冻结自己的时钟，就能直接 `node sims/capture.mjs 你的.html` 录成 mp4。用一个 2 秒的 canvas 测试页，实测能出 1600×900 的 mp4。这是路线 B/C 的关键：聊天模型写出来的单个 HTML，也能用仓库的录制脚本出片。
- **`npx skills` 要 Node ≥ 22.20**，而 teardown 本身只要 Node 20+。装 skill 嫌麻烦就直接 `git clone`，效果一样（见 2.2）。
- **没有 GPU 也能出图，但慢。** 没有显卡的机器用软件渲染，一张静帧约 18 秒；25 秒 60fps 的视频是 1500 帧，软件渲染要跑好几个小时。录视频请用有显卡的电脑。`capture` 启动时会打印 `gpu: …`，看到 SwiftShader 就是软件渲染。
- **Windows 兼容问题**：`smoothstep` 的两个边界写反（a>b）在 Windows 上返回 0，要写成 `1.0 - smoothstep(b,a,x)`。

#### 1.5 别人在其他工具里复刻的证据（全是第三方自述）

| 谁 | 用什么 | 说了什么 | 状态 |
|---|---|---|---|
| @huahuadaren2023（花花大人） | Codex（Windows） | 把 teardown 移植到 Codex，做了六足机械蚁，约 810KB，公开仓 HuaJuan2023/teardown-codex；坦白「不如上游」：机构密度不足、没有真机遥测、没在集显/手机上测、没走通录像出片 | 仅阅读其文章与仓库 README，**未运行、未审代码** |
| @GLionad | 某个能读链接的智能体，模型是 DeepSeek Flash（他自述） | 回复里给的提示词（中文）：「把 [仓库链接] 转换成工作流，审查通过后使用此工作流运行『制作一把左轮手枪的拆解，你自行推进任务直到完成』」，称只花了 $0.7 | 自述，**未核实**；没说用的是哪个外壳，也没有成品链接 |
| @mephiroth | Codex | 回复里两次说「用 codex 做的」，带视频和图 | 没点开媒体，**未核实** |

---

### 2. 跨工具怎么适配

#### 2.1 先选路线

| 路线 | 适合谁 | 能做到 | 做不到 |
|---|---|---|---|
| **A 智能体**（跑命令） | Z Code、Codex、Cursor、Gemini CLI、接了第三方 API 的 Claude Code 兼容客户端 | 自己装依赖、建文件、build、截图自检、录视频 | 模型太弱时挑刺那步会糊弄，要你盯 |
| **B 聊天网页** | DeepSeek 网页版、任何对话框 | 出代码文件 | 不能自己跑、不能自己看截图。文件你保存，命令你跑，截图你贴回去（DeepSeek 网页能不能看图：**未核实**） |
| **C 只做录制** | 页面已经有了，只缺视频 | 用仓库 `capture.mjs`；或自己写 playwright+ffmpeg | 要有显卡的电脑才快 |

模型和外壳可以分开选。例如 Z Code 里挂 DeepSeek，或者 Claude Code 兼容客户端里挂 GLM。

#### 2.2 每个工具怎么装 teardown（路线 A）

**最稳的通用做法，不依赖任何工具的 skill 机制：**

```bash
git clone https://github.com/elvarofficial/teardown ~/teardown
cd ~/teardown && npm install && npx playwright install chromium
```

然后每次开聊，先告诉智能体：`SKILL_DIR is ~/teardown. Read $SKILL_DIR/SKILL.md first, then follow it.`。这样不管工具认不认 SKILL.md 都能用。用这个办法实际构建了 6 个页面，每个约 805 到 830KB，都能出。

**如果想走工具自己的 skill 机制：**

| 工具 | skills CLI 命令 | skill 目录 | 核实状态 |
|---|---|---|---|
| Z Code | `npx skills add elvarofficial/teardown -g -a zcode` | 用户级 `~/.zcode/skills/` 或 `~/.agents/skills/`；项目级 `.zcode/skills/` 或 `.agents/skills/` | 官方文档核实；用 `$teardown` 或 `/` 菜单调用；有「从 Claude Code / Codex CLI 导入 skill」按钮。**自动触发是否灵：未核实** |
| Codex | `-a codex` | 用户级 `~/.agents/skills`，项目级 `.agents/skills` | 官方文档（搜索摘要）称用 `/skills` 或 `$` 调用，也能按 description 自动选；未逐页打开 |
| Cursor | `-a cursor` | 用户级 `~/.cursor/skills/`；项目级 `.agents/skills/` | 同上，搜索摘要 |
| Gemini CLI | `-a gemini-cli` | 用户级 `~/.gemini/skills/`；项目级 `.agents/skills/` 或 `.gemini/skills/` | 同上，搜索摘要 |
| Claude Code | `-a claude-code` | `~/.claude/skills/` | 作者原文做法 |

skills CLI（vercel-labs/skills 1.7.4）需要 Node ≥ 22.20，上面这些 agent id 和路径是它 README 里的。装完仍然要进 skill 目录跑一次 `npm install && npx playwright install chromium`（文章原文这样写）。

**想把规则放进「常驻说明文件」（AGENTS.md）：**

- Z Code：读 `~/.zcode/AGENTS.md`（用户级）和工作区根目录的 `AGENTS.md`，先用户级后工作区；**不读 `CLAUDE.md`**，不扫子目录，不展开 `@import`。（官方文档核实）
- Codex：读项目里的 `AGENTS.md`，从项目根到当前目录逐层，越近越优先（官方文档，搜索摘要）。
- Cursor：根目录和子目录的 `AGENTS.md`，更近的优先（官方文档，搜索摘要）。
- Gemini CLI：默认读 `GEMINI.md`；要读 AGENTS.md 得在 `.gemini/settings.json` 里设 `context.fileName: ["AGENTS.md","GEMINI.md"]`（官方文档，搜索摘要）。
- teardown 仓库本身**没带 AGENTS.md**，只有 SKILL.md。所以下面 2.3 给你一份压缩好的，直接存成 `AGENTS.md`。

#### 2.3 可直接粘贴的压缩版系统提示词（英文）

存成工作区根目录的 `AGENTS.md`（Z Code / Codex / Cursor），或者聊天网页的第一条消息。它把 SKILL.md 的核心规则压缩了。装了完整仓库的话，最后一行会让智能体去读全文。

```
# Teardown: build one interactive 3D machine simulator as an offline HTML page

You build ONE machine as ONE self-contained HTML page (target under 1 MB) that people can take apart,
with live panels driven by the same model that moves the parts, plus a film of the tour recorded frame by frame.

## Stack (do not change it)
- three.js (0.186.x), bundled with esbuild into one HTML file. No CDN, no network at runtime. Fonts are inlined.
- Plain JavaScript modules. No framework. No external 3D model files unless I say so.
- Node 20+, Playwright Chromium for stills and video, ffmpeg for encoding, Python 3 (stdlib only) for the score.

## File structure, one folder per machine, one job per file
- model.js    the math. Real units, one input, every pose and readout as a pure function of it. NO three.js in this file.
- geometry.js the parts, built from code. update(input) poses them. Group parts by assembly so each can be isolated.
- stage.js    studio, lights, soft shadows, post (ambient occlusion, bloom). frame(state, cam) draws one frame.
- console.js  the overlay: a fixed 1600x900 CSS layout of panels, charts, buttons, callouts with leader lines. update(state) redraws it.
- film.js     a SCRIPT of operator moves (views, isolate, cut, explode) and render(t) as a PURE function of time.
- live.js     the same machine in real time: buttons, orbit, zoom, keys. With no input it plays the film script as an auto tour with a cursor.
              Any click, drag, wheel or key hands control to the visitor; 25 s of quiet hands it back.
- score.py    the sound, on the film's timeline.
Write ONE file per reply, complete, never a diff. If a file will pass ~400 lines, split it.

## Hard rules
1. Reference first. Build against the reference I give you and compare. If I gave none, ask for one. Never invent from a sentence.
2. Real numbers, one source. Every gauge, chart and label reads from the same function that poses the parts. No number on screen is typed in.
   Hand-check one number and show the arithmetic. If you are not sure a number is real, say so.
3. ONE input drives everything (a phase, an angle, a stroke, a speed). Nothing is keyframed by hand.
4. The part doing the work opens up: isolate it, cut it, x-ray it, explode it. Collisions are fixed with a number in the parameter block, never by moving the camera.
5. Light studio, ONE accent colour that marks the part working right now. Near-white parts get a thin ink outline or a darker ground.
   The machine fills 60-70% of its view. Labels are never under 34 px on a 1080 canvas. Pick the camera for the mechanism (3/4 view for planar linkages).
6. render(t) is pure: no Math.random (use a seeded rng), no Date, no state kept between frames. Anything stateful is precomputed at load into typed arrays.
   Frame 0 must already show the machine. Every beat goes in timeline.json (seconds).
7. Live page: add quality tiers for integrated GPUs (no AO, lower pixel ratio, smaller shadow maps, panels redrawn every other frame), compile shaders before the first frame, keep the page under 1 MB.

## three.js traps
- smoothstep(a,b,x) with a>b returns 0 on Windows: write 1.0 - smoothstep(b,a,x).
- ShadowMaterial / decals need polygonOffset. Mirrored quads need DoubleSide.
- Clamp every pow() base in a shader (one NaN blacks out the frame through bloom).
- Ambient-occlusion on a clipped model needs the same clipping planes on its normal material.
- Keep emissive under 1.0 (bloom). Big metal surfaces: roughness >= 0.45, envMapIntensity about 0.5.

## Taste
- Easing: entrances cubic-bezier(0.16,1,0.3,1); exits cubic-bezier(0.6,0,0.9,0.35) at half the length; state to state cubic-bezier(0.65,0,0.35,1). Linear only for continuous motion.
- A state holds 1 s for a short phrase plus 0.25 s per extra word beyond three.
- Sound accents, never narrates: continuous motion stays silent. Master -14 LUFS, true peak <= -2 dBFS.

## How you work
- Small steps. Before any code for a new part, write a parameter table (name, value, unit, source) and wait for my OK.
- One change per round. After a change, rebuild, render a still, and tell me what you saw.
- If the repo is installed at $SKILL_DIR (the folder holding SKILL.md), read $SKILL_DIR/SKILL.md and copy the closest example in $SKILL_DIR/sims/ (cessna-* is the smallest) before writing from scratch.
```

（这份提示词为本文压缩整理，不是作者原文；规则内容来自 SKILL.md 的 7 条规则、Live page、render(t)、three.js 常见问题、Sound、Taste 几节。）

#### 2.4 路线 A：用智能体的完整流程

1. 装好仓库（2.2 第一段）。
2. 新建一个工作目录，放 `AGENTS.md`（2.3）和 `ref/` 文件夹（参考图）。
3. 开聊，第一条消息：

```
SKILL_DIR is ~/teardown. Read $SKILL_DIR/SKILL.md and $SKILL_DIR/sims/cessna-shared/ first.
We will build a new machine in sims/octopus-shared, sims/octopus-film and sims/octopus-live inside $SKILL_DIR,
copying the cessna-* structure. Do not touch the existing examples. Confirm you understand, then wait.
```

把新机器放进 `$SKILL_DIR/sims/octopus-*` 有个好处：`node sims/build.mjs octopus-live` 直接能认。如果想放在别处，用 `node sims/build.mjs ./my-machine`，目录里放 `main.js`，用 `teardown-kit/runtime.js` 引用工具包（`build.mjs` 源码里写了这个用法，未单独运行）。

4. 然后从第 3 节第 1 步开始，一步一步粘。

**最省事的小模型技巧：让它先把 cessna 三个文件夹复制成 octopus，再逐个文件改写。** 塞斯纳最小（1600 行），结构完整（有 film、live、score）。模型照着已有结构改，比凭空写稳得多。

#### 2.5 路线 A 里的模型怎么挂（只列已核实的）

| 模型 | 接入方式 | 核实状态 |
|---|---|---|
| DeepSeek | Anthropic 协议 base `https://api.deepseek.com/anthropic`；OpenAI 协议 base `https://api.deepseek.com`。模型名 `deepseek-flash`（现为 V4.1-Flash-1017）和 `deepseek-v4-pro`，旧名 `deepseek-v4-flash` 仍可用 | DeepSeek 官方文档 |
| DeepSeek 接 Claude Code | 环境变量：`ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_MODEL`、`ANTHROPIC_DEFAULT_OPUS_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_HAIKU_MODEL`、`CLAUDE_CODE_SUBAGENT_MODEL`；官方页给的是 `deepseek-flash[1m]`，第三方教程用 v4-pro；`CLAUDE_CODE_EFFORT_LEVEL=max`、`CLAUDE_CODE_AUTO_COMPACT_WINDOW=786432`。Claude 模型名会被映射：opus 到 `deepseek-v4-pro`，sonnet/haiku 到 `deepseek-flash` | 官方文档 |
| Z Code 挂 DeepSeek | 自定义供应商，选 Anthropic 或 OpenAI 协议，填上面的 base 和 key。第三方博客说选「Anthropic Messages」，模型填 `deepseek-v4-flash` 或 `deepseek-v4-pro`。Z Code 官方文档的示例里模型名可能和 DeepSeek 官方当前名字不一致，**以 DeepSeek 官方文档的名字为准**。Z Code 不能给第三方模型加自定义请求参数 | Z Code 官方文档 + 一篇第三方博客 |
| 智谱 GLM | Anthropic 协议 base `https://open.bigmodel.cn/api/anthropic`；OpenAI Chat 协议 `https://open.bigmodel.cn/api/coding/paas/v4`；OpenAI Responses 协议 `https://open.bigmodel.cn/api/v1`。模型 `glm-5.3[1m]`、`glm-5.3-flash[1m]`；`CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000`、`API_TIMEOUT_MS=3000000`；辅助工具 `npx @z_ai/coding-helper` | 智谱官方文档 |
| GLM Coding Plan | Coding Plan 的 key 和普通 API 的 key 不通用，而且只能在官方支持的工具里用；Z Code 列在第一位（用量 1.5 倍）。别拿 Coding Plan 的 key 去挂不在名单里的工具，可能违规或被拒 | 智谱官方文档 |
| cc-switch | 一个桌面应用，在 Claude Code、Codex、Gemini CLI 之间切供应商，只改端点、key、模型、协议字段；有「路由」功能做协议转换。**未安装，仅阅读项目说明**，标「未核实」 | 搜索到项目 farion1231/cc-switch 及其文档，未实装 |
| Codex 挂 DeepSeek | Codex 要什么协议、DeepSeek 的 OpenAI 兼容接口能不能直接用：**未核实**。想省事就用 Z Code 或 Claude Code 兼容客户端挂 DeepSeek；想用 Codex，先试 cc-switch 的路由，或者直接用 OpenAI 的模型 | 未核实 |
| 图片输入 | DeepSeek 的模型接不接图片：**未核实**。稳妥做法见第 3 节第 1 步：用能看图的模型把参考图转成文字规格，再喂给 DeepSeek | 未核实 |

#### 2.6 路线 B：聊天网页怎么用（DeepSeek 网页版等）

聊天网页没有文件系统，改成「你当搬运工」。DeepSeek 网页版一次能不能稳定输出一个几百行的单文件：**未核实**，所以每次只要一个文件，并要求「完整输出，放进一个代码块，别写别的」。

1. 先在自己的电脑上装好仓库（`git clone` 加 `npm install`，2.2 第一段）。网页聊天只负责写代码，其余命令你来跑。
2. 第一条消息粘 2.3 的 `AGENTS.md` 全文，再说：`Wait. I will ask for one file at a time.`
3. 每一步按第 3 节的提示词发。要文件时，补一句固定的话：

```
Output the complete file <name>.js in ONE code block, nothing before or after it. Do not abbreviate with "...".
If it would be over 400 lines, tell me how you will split it and stop.
```

4. 你把代码存进 `~/teardown/sims/octopus-shared/<name>.js`，然后在终端跑 build，报错原样贴回去：

```bash
cd ~/teardown
node sims/build.mjs octopus-film
node sims/capture.mjs octopus-film --size 1600x900 --dpr 1.2 --still 3 --out teardown-out/oct-3.png
```

5. 截图自己看。把你看到的问题用文字告诉模型（「左边第二块面板数字和手臂姿势对不上」），不要说「不好看」。
6. 代码被截断（结尾缺括号、函数写一半）时，别说「继续」，让它「从第 N 行起重写整个文件」。

#### 2.7 路线 C：录视频跟模型无关

三种做法，由简到繁：

**C1：页面是按 teardown 结构写的（有 `film.js` 加 `main.js`）：**

```bash
cd ~/teardown
node sims/build.mjs octopus-film
node sims/capture.mjs octopus-film --size 1600x900 --dpr 1.2 --out teardown-out/octopus-silent.mp4
```

`--size 1600x900 --dpr 1.2` 输出 1920×1080，60fps，H.264，yuv420p，faststart，crf 16。配乐见第 3 节第 8 步。

**C2：页面是聊天模型随便写的单个 HTML（没用 teardown 结构）：** 只要它满足三条，仓库的 `capture.mjs` 就能直接录：

- 暴露 `window.seek(seconds)`：画出第 `seconds` 秒那一帧；
- 设好 `window.DURATION`（秒）和 `window.FPS`；
- 页面链接带 `?render` 时，不用 `requestAnimationFrame` 自己跑时钟，只在 `seek` 里画。

```bash
node ~/teardown/sims/capture.mjs ./my-page.html --size 1600x900 --dpr 1.2 --fps 60 --out out.mp4
```

注意 `--size` 不写的话默认是 1080x1350（竖版），`--fps` 默认 60。给聊天模型的要求可以直接粘：

```
Make the page recordable: expose window.DURATION (seconds) and window.FPS, and window.seek(t) that draws frame t from scratch
(pure function of t, no Math.random, no Date, no state between frames). When the URL has ?render, do not run your own animation loop;
only draw inside seek(t). Call seek(0) once at load so frame 0 shows the machine.
```

**C3：自己写 playwright+ffmpeg 循环：** 需要自己写的话，思路就是 `capture.mjs` 的做法：无头 Chromium 打开页面，对每一帧调 `window.SIM.render(t)`（或 `seek(t)`），截 JPEG（quality 97）通过管道喂给 `ffmpeg -f image2pipe -framerate 60 -i - -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart out.mp4`。直接让智能体读 `glm5.3-flash复刻/src/kit/sims/capture.mjs` 照着写就行，没必要从零想。

**录制环境要有显卡。** 没显卡也能录，但按 18 秒一帧算，1500 帧要几个小时。

---

### 3. 十步流程（以机械章鱼为例）

#### 3.0 对弱一点的模型，每一步都按这 6 条来

1. **一次只要一件事。** 不要把「建模加面板加风格」打包发。
2. **先要参数表，再要代码。** 表格列：名字、数值、单位、来源（图上读的 / 手册 / 估算的）。你确认了表，才让它写代码。
3. **一轮只改一处。** 改完重新 build，出一张图，描述看到什么，再改下一处。
4. **每次重写整个文件，不要补丁。** 弱模型的 diff 经常对不上行号。让它「输出完整的 xxx.js」。
5. **文件过 400 行就拆。** 几何文件最容易爆，按总成拆：外套膜、手臂、眼睛、虹吸管、嘴。
6. **把数字交给脚本检查。** 让它写一个 `check.mjs`，导入 `model.js` 用断言验证（例如推力、周期），比让它「心算」可靠。

下面所有章鱼数字都是**示例值**（按视频面板反推和估算的），不是真实机器的数据。有真实参考的话换成参考里的数。

#### 第 1 步：选机器，找参考（决定成败）

作者的原话：不给参考，让它做穿山甲、犰狳、蝎子，三个都成了普通玩具；给一段真实 V8 模拟器的片段，它一块面板一块面板地复原出来。

- 选机器的标准：**只有一个驱动输入，而且有真实数字可用。**
- 参考可以是：手册里的剖视图、一张照片、一段视频。章鱼就找机械章鱼的渲染图或概念图。**视频里那台 Pelagos OC-8 的截图可以当练手参考；但要发出去的作品，建议换成你自己的题材（鸡、擒纵机构，见附录 B）。**
- **模型看不了图怎么办**（DeepSeek 能不能看图：未核实）：先让一个能看图的模型把参考图转成文字规格，再把这段文字存成 `ref/spec.md` 喂给写代码的模型。

给能看图的模型（任何一个）：

```
Look at the reference image(s) of a robotic octopus. Do not draw or code anything yet. Write a build spec in plain text, under 60 lines:
1. Parts list: every visible part group (mantle shell, head and optics, eight arms, siphon, beak, anything else), with count, rough shape and material.
2. The ONE input that could drive the whole machine, and what each part does as that input goes from 0 to 1.
3. Dimensions: for each part group give a size in mm or m. Mark every number either "from the image" or "my guess".
4. What the camera sees at the hero angle, and what is hidden behind it.
5. Which parts could open, hinge, unscrew or lift out to show what is inside.
```

作者提醒：没参考就是玩具。花花大人的机械蚁也是第一版太简陋，后来补了工程图（爆炸图、三向正交图、运动学简图）才好。

验收：`ref/spec.md` 里每个数字都标了来源，部件清单能和图一一对上。

#### 第 2 步：建模（模型加几何，分四小轮）

这一步对应文章的 Build 提示词（原文在附录 A.5）。弱模型不要一口气发，分四轮。

**2A. 只要参数表，不写代码：**

```
Do not write any code yet. Write the model for a robotic octopus "OC-8" as a parameter table plus a plan.

One input: jet phase p from 0 to 1. One full mantle pulse takes 1/1.8 s.
Parts: mantle shell, 8 arms, 2 optic units, 1 siphon with a nozzle, 1 beak.
Start from these example numbers and fix anything that disagrees with ref/spec.md:
- mantle: 420 mm long, 300 mm across, 8 shell petals that hinge open
- siphon nozzle: 38 mm diameter
- mantle pressure peaks at 93 kPa once per pulse
- arms: 8, each 25 links of 40 mm, each joint bends at most 12 degrees, so a full curl is 300 degrees
- adjacent arms are offset by 1/8 of the pulse

Table columns: name, value, unit, source ("reference", "calculated" or "my guess").
Then list every readout the panels will need (thrust, pressure, arm curl per arm, speed) and write the formula for each as a function of p.
Hand-check one number and show the arithmetic: thrust T = rho * A * v^2, with v = sqrt(2 * dP / rho), which simplifies to T = 2 * dP * A.
If you are not sure a number is real, say so and tell me where it should come from.
Wait for my OK.
```

手算检查（反推值）：喷口直径 38 mm，截面积约 1.134×10⁻³ m²；93 kPa 下推力 T = 2·ΔP·A ≈ 2×93000×0.001134 ≈ 211 N。视频面板的峰值正好是 93 kPa、211 N（从视频帧读取的）。注意这个公式为反推，不是作者给出的。

**2B. 数学文件加检查脚本：**

```
Now write model.js, complete, no three.js in it. Export one pure function state(p) that returns every pose angle and every readout in the table
(mantle radius scale, petal opening, per-arm joint angles, curl per arm in percent, pressure, thrust, speed).
Then write check.mjs that imports model.js and asserts: thrust at the pressure peak is within 1 N of 211 N; arm 3's curl is
the same as arm 2's curl shifted by 1/8 of the pulse; every joint angle stays within 12 degrees. Run it and show me the output.
```

**2C. 几何文件，一个总成一个文件，先做一条手臂：**

```
Write geometry-arm.js: ONE arm built from code as 25 links, each a lathed or boxed segment with 2 or 3 small wheel rings.
Use instanced meshes so the whole arm is one draw call. Export buildArm() and poseArm(arm, jointAngles).
The joint angles come from model.js. Nothing is animated by hand. Keep the file under 300 lines.
```

然后依次要 `geometry-mantle.js`（外套膜加 8 片可铰开的壳瓣加玻璃窗）、`geometry-head.js`（两个镜头加 IR 圈）、`geometry-siphon.js`（3 节套筒加 6 瓣喷口）、`geometry-beak.js`，最后一个 `geometry.js` 把它们装起来：

```
Now write geometry.js that assembles the mantle, head, siphon, beak and eight copies of the arm into groups named mantle, optics, siphon, beak, arm1..arm8,
so each group can be isolated later. update(p) calls state(p) from model.js and poses everything. Nothing else moves the parts.
```

**2D. 最小舞台加出第一张图（后面所有检查都靠它）：**

```
Write a minimal stage.js (pale background, one soft key light, soft shadows on an invisible floor, no post-processing yet) and a minimal film.js
whose render(t) sets p = (t / 25 * 14) mod 1 and draws one frame from a fixed 3/4 camera. Copy the structure of sims/cessna-shared/stage.js and film.js.
Add sims/octopus-film/main.js like sims/cessna-film/main.js. Build it and render a still at t=3, then tell me what you see.
```

在命令行里自己跑也行：

```bash
node sims/build.mjs octopus-film
node sims/capture.mjs octopus-film --size 1600x900 --dpr 1.2 --still 3 --out teardown-out/oct-3.png
```

为什么有效：模型先于画面。零件、仪表、时间线读同一个函数，不会对不上。只由一个数字驱动，才像真机器；8 条手臂各自手动做动画，就只是 8 段动画。

弱模型怎么办：
- 参数表没确认前不让它写代码；
- 手臂先做一条，对着参考图修好再复制 8 份；
- 几何文件超 400 行就按总成拆；
- 出图后让它只描述「看到什么」，不让它说「完美」。

作者提醒：机器是 1600 到 2200 行的体量，别指望一轮出完。

验收：`check.mjs` 全部通过；一张静帧里 8 条手臂、外套膜、镜头都在，没有明显穿模。

#### 第 3 步：加控制台面板

对应文章的 Console 提示词（附录 A.4）。章鱼视频里可见的面板可以当清单（面板编号和内容按视频帧读取，具体字不一定完全准）：

- 顶部一排：喷射负载条、SIM ID、运行时间、状态（JETTING / MANTLE OPEN / TEARDOWN / HOLDING / DEPARTING）、操作员；
- 左边 3 块：01 JET（外套膜压力 kPa、推力 N、脉冲曲线）、02 POWER（电量、功耗 W、单体电压、电机温度）、03 ARM CURL（R1 到 R4、L1 到 L4 的弯曲百分比）；
- 右边 4 块：04 DEPTH（深度、垂直速度、俯仰、横滚、速度）、05 ASSEMBLIES（HERO、OPTICS、MANTLE、ARM 02、SIPHON、BEAK 六个按钮）、06 DISPLAY（LABELS、EXPLODED、JET WAKE、TURNTABLE）、07 SUBSYSTEMS（6 个子系统及状态）；
- 底部：08 OPERATION LOG 时间线，右下角「0 OPERATOR ACTIONS」计数；
- 画面上带引线的标注（JET TURBINE、SIPHON、REACTOR RING、SHELL PETAL、GLASS PORT、PUMP CORE、ARM HUB 等）。

弱模型一次做不完，**一块面板一块面板加**。第一轮只做布局框架加两块面板：

```
Write console.js, complete. A fixed 1600x900 CSS layout around the machine, in this order. Round 1 only builds the frame and TWO panels:
- title block top left: "Pelagos OC-8", subtitle "Robotic cephalopod - field simulator"
- panel 01 JET (left): mantle pressure in kPa as a big number, thrust in N, and a live pulse chart of pressure over the last 1.2 s
- panel 03 ARM CURL (left): eight bars R1..R4 and L1..L4, curl in percent
Every value comes from state(p) in model.js. No number on screen is typed in. update(state) redraws everything from the frame's state.
Wire it into film.js and render a still at t=3 and t=12. Tell me what you see.
```

下一轮再加 02 POWER、04 DEPTH，再下一轮加按钮（05、06）、子系统列表（07）、操作日志（08）、标注引线。每轮都是完整的 `console.js`。

完整的 Console 提示词原文（V8 版）在附录 A.4。章鱼要改成：

```
Lay out a console around the machine at 1600×900:
- the title and the main live number top left, big: [thrust in N]
- live charts that move with the machine: [mantle pressure over the last 1.2 s, curl of each of the eight arms]
- a schematic panel that redraws the mechanism in 2D from the same model
- one button per subsystem: isolate it, cut it, show it alone [optics, mantle, arm 2, siphon, beak]
- camera views as buttons: [hero, front, side, top, underside]
- callouts with thin leader lines into the parts they name
Every panel redraws from the frame's state. No number on screen is typed in.
```

作者的原话：图表跟着零件一起动，是观众愿意看下去的原因（V8 的压力环每 720° 曲轴闭合一圈，你看着它闭合）。

弱模型最常见的毛病：面板里的数字「看着像真的」，其实是写死的。验收时让它**改一个参数**（比如喷口直径 38 改 30），看推力数字是不是跟着变；不变就是写死了。

验收：8 块面板都在，字没被截断，改一个参数后面板数字同步变。

#### 第 4 步：定风格

对应文章的 Style 提示词（附录 A.2）。章鱼版：

```
Style: a clean study model on a pale studio.
- light cream background, soft shadows on an invisible floor, ONE accent colour (orange, about #e3562a) for the part that is working right now
- the machine fills 60 to 70% of its view
- white armoured body with riveted shell, dark parts glossy, glass port as glass, metal roughness at least 0.45 so it never streaks white
- the white body sits on a cream background: give it a thin ink outline or a slightly darker ground
- pick the camera for the mechanism: eight arms seen face-on collapse into a fence, so use a 3/4 view
Change the style only. Do not change the model or the panels. Render stills at t=3 and t=12.
```

作者说这里每一行都是遇到问题后补上的：白色零件在奶油色背景上会消失；正面看多条腿会糊成一道栅栏；暗色版本会让视频第一秒看不清；他的 Strandbeest 白管在奶油底上看不见，换到沙地加墨线才好。

弱模型：配色用具体色值（`#e3562a` 取自塞斯纳示例控制台的橙色强调色），别说「好看一点」。

验收：缩小到手机宽度，机器仍然看得清轮廓，强调色只出现在当前工作的部件上。

#### 第 5 步：像挑刺的人一样自检

对应文章的 Critic 提示词（附录 A.9）。关键点：**能看图的模型才能自检**。DeepSeek 看不了图的话（未核实），这一步让你自己看截图，或者把截图丢给能看图的模型，把它的意见转给 DeepSeek。

先把节拍写进时间线，否则 `--stills beats` 只有一张图（见 1.4）。章鱼版巡览节拍（按视频反推，时间为近似值）：

```
Write sims/octopus-film/timeline.json with every beat of the tour in seconds, as flat numbers keyed by name, for example:
{"duration": 25, "jet": 0, "optics": 3, "mantleOpen": 5, "siphonOpen": 9, "armApart": 11, "explode": 16, "reassemble": 20, "depart": 23}
film.js and score.py must READ these times from this file, never retype them.
```

然后：

```
Before you show me anything:
1. Render a still at every beat of the tour and read each one: a part passing through another, a part floating off its mount, a label covering what it names, a number that disagrees with the pose.
2. Scrub every transition at 0.2 s steps and look for a jump.
3. Fix collisions with a number in the parameter block. Never hide them with the camera.
Tell me what you checked and what you fixed. Show me the stills.
```

命令（智能体会自己跑，你手动跑也行）：

```bash
node sims/capture.mjs octopus-film --size 1600x900 --dpr 1.2 --stills beats --cols 4 --out teardown-out/oct-beats.png
node sims/capture.mjs octopus-film --size 1600x900 --dpr 1.2 --stills every:0.2 --from 15 --to 18 --out teardown-out/oct-transition.png
node sims/capture.mjs octopus-film --size 1600x900 --dpr 1.2 --still 16.5 --out teardown-out/oct-16.5.png
```

没有节拍文件时，用手写时间列表也行：`--stills 0,3,5,9,11,16,20,23`。

检查清单（来自 SKILL.md）：机构（该接触的接触、没有穿过去、面板数和姿态一致）；构图（每帧一个焦点、重要的东西离边 60px 以上、标签不盖住所指的零件）；字（没截断、关键读数手机宽度能读）；3D（emissive 低于 1.0、近白表面不过曝、大面积金属 roughness ≥ 0.45、envMapIntensity 约 0.5）；节奏（短语停留 1 秒，三个词以上每词加 0.25 秒）。

弱模型：「检查」类任务它们爱说「都没问题」。让它**逐张图写一行发现**，必须每张都写；抽一两张你自己核对。

作者靠这一步抓出两个差点上线的 bug：兔子的脸穿出帽子壁，用一个数 0.222 m 放回去；六足的腿每次换步态会飞出去，直到脚瞄准下一个真实落脚点。

验收：一轮完整检查下来没有新发现为止（SKILL.md 的停止条件）。

#### 第 6 步：做成能互动的网页

对应文章的 Page 提示词（附录 A.7）。章鱼版：

```
Make the simulator a page people drive (sims/octopus-live/main.js and live.js, same structure as sims/cessna-live and cessna-shared/live.js):
- buttons for HERO, OPTICS, MANTLE, ARM 02, SIPHON, BEAK; toggles for LABELS, EXPLODED, JET WAKE, TURNTABLE; a pause button; drag the log to scrub
- the tour from the film plays by itself, with a cursor that walks to each button and presses it
- any click, drag, scroll or key hands control to the visitor; 25 seconds of quiet hands it back
- drag to orbit, scroll to zoom, a key to hide the panels
- warm every shader before the first frame so the page never freezes (use kit/warm.js)
- add quality tiers like TIERS in cessna-shared/live.js: no ambient occlusion, a lower pixel ratio, smaller shadows, panels redrawn every other frame
```

注意：集显测试**没法在无独显的机器上做**。要自己在笔记本集显或手机上打开，看帧率。作者的数据：六足在集显上 15fps，降质后 75fps；沙丘页面慢在一个着色器每个顶点算 5 次位移，先找最贵的着色器，比所有降质档位加起来都管用。

弱模型：`live.js` 是整套里最长最乱的文件（示例 350 到 420 行）。先让它**照抄 `cessna-shared/live.js` 的结构**，只改机器相关的部分；按钮、巡览、降质档位分三轮加。

验收：打开页面不动，巡览自己跑；点一下巡览停，25 秒后回来；手机竖屏时底部有一条提示条（示例 `live.js` 里的 `.turn` 样式，竖屏且宽度不超过 820px 时显示）。

#### 第 7 步：录成视频

对应文章的 Record 提示词（附录 A.3）：

```
Record the tour: render(t) has to be a pure function of time, so draw every frame at 60 fps at 1920×1080 in headless Chrome and pipe it into ffmpeg as H.264, yuv420p, faststart. Then show me a contact sheet of every beat.
```

命令：

```bash
node sims/build.mjs octopus-film
node sims/capture.mjs octopus-film --size 1600x900 --dpr 1.2 --out teardown-out/octopus-silent.mp4
```

**这一步智能体经常卡在环境上。** 排查顺序：`ffmpeg -version`、`python3 --version`、`npx playwright install chromium` 有没有跑过、启动时打印的 `gpu:` 是不是 SwiftShader（是的话会很慢）。

为什么逐帧而不是录屏：录屏软件在 GPU 吃紧时掉帧，按时间逐帧渲染不会。

#### 第 8 步：配乐

对应文章的 Score 提示词（附录 A.1）。章鱼版：

```
Score it in code on the same timeline: [soft ambient pads, a low whoosh on every jet pulse, a quiet click on every button press, a soft pop when a part separates]. Master to -14 LUFS with the true peak under -1 dB and mux it into the video.
```

要点：
- 声音用纯 Python 合成（48 kHz、可复现），在 `sfx/` 里；`python3 run_sfx.py --list` 列出生成器；
- **所有时间读 `timeline.json`，不要手写数字**（作者的音画同步就靠这个；示例的 `score.py` 里时间是写死的，所以你的新机器要按第 5 步把节拍放进 JSON 并让 `score.py` 读它）；
- 「点缀，不要旁白」：连续运动保持安静；
- 响度会自动做到 −14 LUFS。

命令：

```bash
python3 run_sfx.py sims/octopus-shared/score.py
ffmpeg -y -i teardown-out/octopus-silent.mp4 -i teardown-out/octopus-score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart teardown-out/octopus.mp4
node wave.mjs teardown-out/octopus.mp4 --timeline sims/octopus-film/timeline.json
node sheet.mjs --video teardown-out/octopus.mp4 --timeline sims/octopus-film/timeline.json
```

（输出 WAV 的文件名以 `run_sfx.py` 实际打印的为准。用塞斯纳的 `score.py` 实测：约 10 秒出 26 秒的 WAV，26 个声音，−14.0 LUFS，真峰值 −2.5 dBFS。）

作者的数据：V8 影片 26 秒、189 个音效，每一下低音踩在做功冲程上。

弱模型：`score.py` 一律让它**照 `cessna-shared/score.py`（41 行）改**，别让它从零设计合成器。

验收：`wave.mjs` 的波形和 `sheet.mjs` 的接触表里，音效位置对得上画面节拍。

#### 第 9 步：交付

对应文章的 Publish 提示词（附录 A.6）：

```
Publish the simulator as a page:
- keep the HTML under 1 MB; move any large model out as a file next to the page
- a 1200×630 preview card from the best frame, with absolute image URLs
- deploy it to Vercel
```

要点：
- 仓库的页面本身就 800KB 出头（见 1.4），留给你机器的只有 150 到 200KB；章鱼 2600 多行的话要盯体积。让智能体 build 完报 `ls -l teardown-out/dist/*.html`；
- 大模型文件用 `build.json`：`{"external": {"heavy.glb": "light.glb"}}`，页面里变成 `"url:light.glb"` 字符串，文件复制到页面旁边；
- 预览卡图的 URL 必须是绝对地址，X 才读得到；
- 部署到 Vercel 需要你的账号，智能体做不了的话你自己拖目录上去。

作者提醒：兔子页面带模型 15.9MB，X 不显示链接卡；模型挪出去变 967KB，卡片就出来了。

验收：页面小于 1MB，`https://` 地址发进 X 编辑框能出卡片。

#### 第 10 步（加餐）：让人把它玩坏

对应文章的 Bonus 提示词（附录 A.8，原文是风速滑块 0 到 15 m/s）。章鱼版：

```
Add one slider for [water current, 0 to 3 m/s] and run the model live when it moves: [a gentle current barely sways the arms, a strong one makes the octopus pulse the jet harder to hold its place]. Show it on the same panels.
```

作者的话：谁能把机器推过极限，谁就知道每个数的作用。

弱模型：新增滑块只改 `model.js` 加一个输入，别动几何；改完先跑 `check.mjs`。

---

### 4. 排错表

| 现象 | 常见原因 | 给模型的修复提示词 |
|---|---|---|
| 零件穿模（脸穿出壳） | 参数没留余量 | `Part A passes through part B at t=<time>. Fix it by changing one number in the parameter block (scale or offset). Name the number and its old and new value. Do not touch the camera.` |
| 白屏 / 黑屏 | 着色器 NaN；`smoothstep` 边界写反（Windows）；`pow()` 底数为负 | `The page is blank. Open the console errors first. Then check every shader: clamp every pow() base to >= 0, write 1.0 - smoothstep(b,a,x) when a > b. Report what you changed.` |
| 只有开头第一帧好，之后全黑 | NaN 经过 bloom 扩散整帧 | `One NaN pixel blacks out the frame through bloom. Find the shader that can output NaN or Infinity, clamp its inputs, and lower emissive to under 1.0.` |
| 页面卡（集显 15fps） | 某个着色器算重复；AO 和阴影太大 | `Profile before changing anything: which shader or pass costs the most? Show the numbers. Then add the tiers (no ambient occlusion, lower pixel ratio, smaller shadow maps, panels redrawn every other frame) and report fps before and after.` |
| 启动卡一下 | 着色器首次绘制才编译 | `Warm every shader before the first frame with warmComposer from kit/warm.js, like cessna-shared/live.js.` |
| 页面超 1MB，X 没链接卡 | 模型内嵌 | `The page is X KB. Move large models out as external files through build.json {"external": {...}} and show the new size.` |
| 面板数字和姿态对不上 | 面板里写死或自己另算了一遍 | `The panel number does not match the pose at t=<time>. Make it read from state(p) in model.js only. Then change nozzle diameter in the parameter block and show that the panel changes.` |
| 面板的字被截断 / 盖住零件 | 布局没按 1600×900 | `Text is clipped at <panel>. Keep labels at 34 px or more on a 1080 canvas, nothing within 60 px of the edge, and labels must not cover the part they name. Fix only that panel.` |
| 代码被截断（结尾缺括号） | 单文件太长 | `Your last file was cut off. Do not continue it. Rewrite the whole file from line 1, and if it will pass 400 lines split it into two files.` |
| 模型每轮都推翻之前的东西 | 它在重写别的文件 | `Change only <file>. Reply with the complete file. Do not touch any other file.` |
| 巡览和声音对不上 | 节拍时间写死在两个地方 | `film.js and score.py both read the beat times from timeline.json. Remove every typed-in time.` |
| `--stills beats` 只出一张 | `timeline.json` 只有 duration | 按第 5 步写节拍文件；或者手写 `--stills 0,3,5,9,11,16,20,23` |
| 白色零件在奶油底上看不见 | 没有轮廓 | `Give near-white parts a thin ink outline or a slightly darker ground. Do not change the accent colour.` |
| 8 条手臂糊成一道栅栏 | 正面视角 | `Switch the hero camera to a 3/4 view along the body axis.` |
| 视频第一秒是空的 | 暗色背景 / 第 0 帧没画机器 | `Frame 0 is the thumbnail. It must already show the machine on a light background.` |
| 录视频非常慢 | 软件渲染（SwiftShader） | 看启动打印的 `gpu:`；换有显卡的电脑，或确认 `paths.mjs` 的 GPU 参数生效 |
| `npx skills add` 报 Node 版本错 | skills CLI 需要 Node ≥ 22.20 | 不用它，改用 2.2 的 `git clone` |

---

### 附录 A：文章里的 9 条原版英文模板（原样保留）

来源：@elvar_official 的文章，标题里的步骤号是本文第 3 节的步骤号（和文章自己的编号不同）。方括号 [ ] 里的内容就是要换的。下面是原文，不做任何改动；上面第 3 节的章鱼版为改写版。

#### A.0 安装（文章原文，对应本文 2.2）

```
cd ~/.claude/skills/teardown && npm install && npx playwright install chromium
```

```
npx skills add elvarofficial/teardown -g -a claude-code
```

#### A.1 配乐 Score（本文第 8 步）

```
Score it in code on the same timeline: [Am9 chords at 92 bpm, a soft thump on every power stroke so the beat tightens when the throttle opens, a quiet click on every button press, rising air under the throttle drag]. Master to -14 LUFS with the true peak under -1 dB and mux it into the video.
```

#### A.2 风格 Style（本文第 4 步）

```
Style: a clean study model on a pale studio.
- light background, soft shadows on an invisible floor, one accent colour for the part that is working right now
- the machine fills 60 to 70% of its view
- dark parts glossy, liners glass, metal roughness at least 0.45 so it never streaks white
- if a part is near-white, give it a thin ink outline or a darker ground
- pick the camera for the mechanism: if it collapses into a lattice face-on, use a 3/4 view
```

#### A.3 录制 Record（本文第 7 步）

```
Record the tour: render(t) has to be a pure function of time, so draw every frame at 60 fps at 1920×1080 in headless Chrome and pipe it into ffmpeg as H.264, yuv420p, faststart. Then show me a contact sheet of every beat.
```

#### A.4 控制台 Console（本文第 3 步）

```
Lay out a console around the machine at 1600×900:
- the title and the main live number top left, big: [engine speed in rpm]
- live charts that move with the machine: [valve lift over 720° of crank, the pressure-volume loop of the tracked cylinder]
- a schematic panel that redraws the mechanism in 2D from the same model
- one button per subsystem: isolate it, cut it, show it alone
- camera views as buttons: [hero, front, side, top, inside the valley]
- callouts with thin leader lines into the parts they name
Every panel redraws from the frame's state. No number on screen is typed in.
```

#### A.5 建模 Build（本文第 2 步，塞斯纳版）

```
/teardown Build [the Cessna 337 main landing gear] as an interactive 3D simulator. Reference attached: [a cutaway drawing of the gear].

Build it from code in real units: [the main plate, the hydraulic actuator, the rack, the pinion on its output shaft, the universal joints, the side tubes, the spring legs and the wheels].

Before you draw anything, write the model as pure functions of one input: [stroke from 0 to 1]. Use the real numbers: [the rack travels 201 mm, the pinion has 32 teeth at module 4 mm, so the legs turn exactly 180°]. Check them by hand and show me the check. If you are not sure a number is real, say so and tell me where it comes from.

Every part, every panel and every label reads from that one model. Nothing is animated by hand.
```

#### A.6 交付 Deliver（本文第 9 步）

```
Publish the simulator as a page:
- keep the HTML under 1 MB; move any large model out as a file next to the page
- a 1200×630 preview card from the best frame, with absolute image URLs
- deploy it to Vercel
```

#### A.7 互动网页 Page（本文第 6 步）

```
Make the simulator a page people drive:
- the tour from the film plays by itself, with a cursor that walks to each button and presses it
- any click, drag, scroll or key hands control to the visitor; 25 seconds of quiet hands it back
- drag to orbit, scroll to zoom, a key to hide the panels
- warm every shader before the first frame so the page never freezes
- test it on an integrated GPU and add quality steps: no ambient occlusion, a lower pixel ratio, smaller shadows, panels redrawn every other frame
```

#### A.8 加餐滑块 Bonus（本文第 10 步，风速 0 到 15 m/s）

```
Add one slider for [the wind, 0 to 15 m/s] and run the model live when it moves: [a light breeze barely turns the crank, a gale makes the legs blur]. Show it on the same panels.
```

#### A.9 自检 Critic（本文第 5 步）

```
Before you show me anything:
1. Render a still at every beat of the tour and read each one: a part passing through another, a part floating off its mount, a label covering what it names, a number that disagrees with the pose.
2. Scrub every transition at 0.2 s steps and look for a jump.
3. Fix collisions with a number in the parameter block. Never hide them with the camera.
Tell me what you checked and what you fixed. Show me the stills.
```


---

### 附录 B：两个建模提示词

下面两个题材都有「一个输入、真实数字」的特点。**所有数字都是估算的示例值**，开工前让模型对着真实参考（手册、拆解图）逐条核对。参考图先去找：机械鸡找一张啄米鸡木制玩具的剖视图或照片；擒纵机构找一张瑞士杠杆擒纵的剖视图。

#### B.1 机械鸡（鸡骑猫账号的自家题材）

```
Build [a mechanical pecking hen] as an interactive 3D simulator. Reference attached: [a cutaway drawing or photo of a wooden pecking-hen toy].

Build it from code in real units: [a wooden base, a hen body, a head on a neck rocker, a beak, two wings on links, a tail, a crank handle, a cam on the crank shaft, a follower rod, a rocker arm].

Before you draw anything, write the model as pure functions of one input: [crank angle from 0 to 360 degrees]. Use these example numbers and fix any that disagree with the reference: [the cam is eccentric by 10 mm so the follower lifts 20 mm; the rocker arm multiplies it 2.5 times, so the beak drops 50 mm once per turn; the wings swing plus and minus 25 degrees on a link driven by the same shaft; the crank turns at 60 rpm, so one peck per second]. Check them by hand and show me the check. If you are not sure a number is real, say so and tell me where it comes from.

Every part, every panel and every label reads from that one model. Nothing is animated by hand.
```

可以接上的面板：喙的高度随曲轴角的曲线、凸轮升程图、每秒啄数、翅膀摆角。巡览里加一拍：外壳打开，露出凸轮和摇臂。

#### B.2 机械表擒纵机构

```
Build [a Swiss lever watch escapement] as an interactive 3D simulator. Reference attached: [a cutaway drawing of a lever escapement: escape wheel, pallet fork, balance wheel with hairspring].

Build it from code in real units: [a 15-tooth escape wheel, a pallet fork with two pallet stones, a roller and impulse jewel, a balance wheel with a hairspring, the bridge and the plate].

Before you draw anything, write the model as pure functions of one input: [the balance wheel angle over time, a sine with amplitude 270 degrees and frequency 4 Hz]. Use these example numbers and fix any that disagree with the reference: [4 Hz is 28,800 beats per hour, which is 8 beats per second; each beat releases the escape wheel by half a tooth pitch, so one tooth passes every 2 beats and the 15-tooth wheel turns once in 30 beats, which is 3.75 s]. The escape wheel angle must be a closed-form function of time (tabulate it at load), never state carried between frames. Check them by hand and show me the check. If you are not sure a number is real, say so and tell me where it comes from.

Every part, every panel and every label reads from that one model. Nothing is animated by hand.
```

（手算的依据：28,800 ÷ 3,600 = 8 拍每秒；每拍擒纵轮前进半个齿距，所以每 2 拍过一个齿，15 齿共 30 拍，30 ÷ 8 = 3.75 秒一圈。这是按杠杆擒纵基本原理推导的，真实机芯的擒纵轮转速还和机芯设计有关，让模型对着你的参考图核对。）

可以接上的面板：摆轮角度曲线、擒纵轮角度（阶梯形）、叉瓦的锁止与脱离状态、每秒拍数、振幅。文章里作者把「机械表擒纵机构 4 Hz」列为他推荐但还没做的题材。

---

### 附录 C：哪些说法核实了，哪些没有

| 说法 | 状态 |
|---|---|
| teardown 仓库的文件结构、命令、规则、示例的行数和体积 | 克隆仓库并实际 build 了 6 个页面（每个约 805 到 830KB），跑了塞斯纳的配乐和一张静帧；读了 SKILL.md、build.mjs、capture.mjs、paths.mjs |
| `capture.mjs` 能录任何有 `window.seek(t)` 的 HTML | 用一个 canvas 测试页，实测出了 1600×900 的 mp4 |
| `node sims/build.mjs ./自己的目录` | 源码和 SKILL.md 都这么写；未单独运行 |
| Z Code：AGENTS.md 加载规则、skills 目录与格式、description ≤1024 字符（超了会被丢弃）、`$skill` 调用、自定义供应商、不能加自定义请求参数 | 官方文档（zcode.z.ai/cn/docs） |
| DeepSeek / 智谱：base URL、模型名、Claude Code 环境变量 | 各自官方文档 |
| skills CLI：agent id 和路径、Node ≥ 22.20 | 它的 README（vercel-labs/skills 1.7.4） |
| Codex / Cursor / Gemini CLI：AGENTS.md 与 skill 目录行为 | 官方文档的搜索摘要，没逐页打开 |
| cc-switch 的功能 | 只看了项目说明，没装过 |
| 原 teardown 在 Z Code / Codex / Cursor / Gemini CLI 里是否会自动触发 | **未核实**（因此采用「显式告诉智能体读 SKILL.md」的做法） |
| DeepSeek 能否看图、网页版能否稳定输出长文件 | **未核实** |
| Codex 能否直接用 DeepSeek 的 OpenAI 兼容接口 | **未核实** |
| 非 Anthropic 模型能否跑通 playwright 与 ffmpeg 步骤 | 取决于智能体外壳而不是模型，**未核实** |
| @GLionad 的 $0.7 左轮手枪、@mephiroth 的 Codex 成品 | 自述，**未核实** |
| 花花大人的 Codex 机械蚁仓库 | 只读了文章和 README，没运行也没审代码 |
| 章鱼视频里的数字（202 节、480 个轮子、2,616 行代码、0:16 炸开） | 0x_fokki 自述，**未核实**；从视频帧可见 202 节清楚，轮子数字帧里看不清（480 还是 489） |
| 文章里的所有浏览量（V8 379 万、山火 164 万）、2 天做 7 个 | 作者自述，**未核实** |

### 附录 D：链接

- 文章：https://x.com/elvar_official/status/2116174609355571402
- 章鱼视频：https://x.com/0x_fokki/status/2116289885870981296
- 仓库：https://github.com/elvarofficial/teardown
- 上游：https://github.com/whaleyxbt/claude-motion
- 在线示例：https://visual-learning.app
- Z Code 文档：https://zcode.z.ai/cn/docs
- skills CLI：https://github.com/vercel-labs/skills
- cc-switch：https://github.com/farion1231/cc-switch
- 花花大人的 Codex 移植（第三方）：https://github.com/HuaJuan2023/teardown-codex
