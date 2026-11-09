# NOTICE · 署名与来源

本仓库新增代码与文档使用 [MIT](LICENSE)，版权声明见 LICENSE。第三方代码、字体、音效、参考图片、原视频与包含原作的对比图保留各自许可和归属，不因纳入仓库自动转为 MIT。

## 机械系列：实现来源

| 实现 | 范围 | 复用与署名 |
|---|---|---|
| [GPT-6.1 Sol](cases/oc8/models/gpt-6-1-sol/README.md) | OC-8 | 本轮从原作参考帧重新编写，新增几何/HUD/工具及原创合成音轨；展示名由用户指定，先前审计接触既有实现已披露，不作为隔离盲测 |
| [GLM 5.3-Flash](shared/mechanical/kit/README.md) | 9 台 | 01 V8 / 02 塞斯纳 337 / 03 海滩兽基于 elvarofficial/teardown 的 MIT 示例改色、汉化、重定时；00 与 04–08 为新增实现 |
| [DeepSeek](shared/mechanical/deepseek-kit/README.md) | OC-8 / V8 | 历史记录为独立重写；V8 参考上游结构、参数与节拍，使用相同第三方库 |
| [HY 宝石蓝衍生版](cases/oc8/models/hy-derived/README.md) | OC-8 | 在 DeepSeek 实现上改色、重写腕足等部分几何；HUD、调度、构建链和断言沿用，不作为独立模型实验 |
| [HY4 独立直出版](cases/oc8/models/hy4-direct/README.md) | OC-8 | 历史记录为依据参考帧和方法重写；第三方库共用不等于复用已有实现；HUD、配色、镜头属于设计改编 |

模型名称沿用历史署名（HY4 / Tencent Hunyuan Hy、DeepSeek、GLM 5.3-Flash），完整精确模型 ID、工具调用与会话并未全部归档。不得由展示铭牌推断已验证身份。代码行/8-gram 相似度只能提供辅助信号，不能证明独立创作、模型来源或公平对照。

## 逐案例参考

| 编号 | 案例 | 来源 |
|---|---|---|
| 00 | Pelagos OC-8 | [@0x_fokki 演示视频](https://x.com/0x_fokki/status/2116289885870981296)；参考帧/截图归原作者，源码与作者原始提示词未随本仓库提供 |
| 01 | V8 发动机 | teardown 的 `v8-*` 示例；实车图见对应 references 来源 |
| 02 | 塞斯纳 337 起落架 | teardown 的 `cessna-*` 示例与实机公开照片 |
| 03 | 海滩兽 Strandbeest | teardown 的 `strandbeest-*` 示例与 Theo Jansen 公开资料 |
| 04 | 仿生沙虫 MK-X | Dune 风格概念图、2021 年电影剧照与沙面形态参考 |
| 05 | 机械水母 MJ-9 | Festo AquaJelly / RoboJelly 公开资料 |
| 06 | 六足机器人 HX-18 | LAURON IVc / STEMI 等实机公开图片 |
| 07 | 机械蜜蜂 HB-7 | DelFlyMicro / RoboBee 等公开论文与图片 |
| 08 | 机械蝎子 SC-8 | 蝎类与机械蝎公开形态资料 |

逐项图片来源和参数依据保留在 [案例版本索引](cases/README.md)、[DeepSeek references](shared/mechanical/deepseek-kit/references/README.md)。公开可见不代表素材可自由再分发；使用者需按原许可处理。

## 上游代码与方法

- [elvarofficial/teardown](https://github.com/elvarofficial/teardown)：MIT。其[快照](shared/mechanical/upstream-teardown/)保留 LICENSE 与 SKILL.md；含 V8、起落架、海滩兽示例和公共库。快照 README 的章鱼演示 GIF 不代表快照含章鱼源码。
- [方法原始文章](https://x.com/elvar_official/status/2116174609355571402)：@elvar_official。仓库的[六条提示词](series/机械复刻系列/docs/提示词原文/teardown-机械章鱼.md)是改写材料，不是 OC-8 原作者未公开的提示词。
- [whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion)：逐帧录制与音效方法来源。
- [HuaJuan2023/teardown-codex](https://github.com/HuaJuan2023/teardown-codex)：社区移植参考。
- Three.js、esbuild、Playwright、Inter、JetBrains Mono 分别保留其发行许可；锁文件记录版本，依赖不随库提交。构建内联代码/字体的再分发仍须遵守各自许可。
- 内联运行库与字体的完整许可见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。单独分发 HTML 时也应保留对应许可。
- 音效素材的逐项来源及许可见 [sfx/samples/SOURCES.md](shared/mechanical/kit/sfx/samples/SOURCES.md)。

## 对比展示与未分发内容

[四宫格](cases/oc8/comparisons/oc8-grid/README.md)和[历史纵向](cases/oc8/comparisons/oc8-vertical/README.md)保留封面、截图和制作脚本。涉及原作的图像部分归原作者。大体积成片、原作 MP4 与音轨默认不提交；本地已有文件保留，合成须自行提供有使用权限的原视频。

对比片中的“Opus 5.5”等历史铭牌没有在本库归档可独立核验的模型运行证据。各格取景、HUD、输入和迭代不同，只作作品展示，不作模型能力排名。新生成铭牌使用原作作者名。

[首次实现回顾](series/机械复刻系列/docs/01-机械章鱼OC-8-teardown机器模拟器.md)说明首次实现范围；新实验使用[机械章鱼共同任务](cases/oc8/task/brief.md)。新增案例需补充逐项来源，见 [CONTRIBUTING](CONTRIBUTING.md)。

## 本轮仓库封面

[横版封面](assets/covers/awesome-ai-recreations-cover.jpg)为内置 ImageGen 编辑的工业工坊概念插画，融入擎天柱、大黄蜂与机械章鱼，文字经过人工核对；不是仓库页面渲染或实验结果。完整[生成提示词](assets/covers/prompt.txt)随库保存。正式案例截图见各版本页。

## 变形金刚系列

### GPT-6.2 Sol 本地短片

两部短片由 Codex 制作，模型署名由用户确认。公开版本说明与本轮渲染剧照，成片、Blender 工程及第三方参考原图存于本地。角色与影视设计权利归相应权利人。[擎天柱·余烬信号](cases/optimus-prime-2007/models/gpt-6-2-sol/README.md) · [大黄蜂·午夜回波](cases/bumblebee-2007/models/gpt-6-2-sol/README.md)

### 大黄蜂 · Kimi-K3.1-Pro 版本（2026-11-08）

- 新增 `series/变形金刚系列/models/kimi-k3.1-pro/bumblebee-2007/`：47 装配 / 274 视觉网格的独立程序化复刻，页面与影片明确署名 Kimi-K3.1-Pro。
- 仅使用冻结输入包内两张 TOMY MPM-3 官方产品图；原图仅本地研究使用，不随案例再分发。没有读取其他复刻成品作为几何或动画输入。
- 同源 Three.js 模型驱动互动与 20 秒 WebGL 逐帧影片；原创程序化音轨无电影或音乐采样。Three.js / esbuild / Playwright 保留各自许可。
- 静帧与接触表为自渲染，角色/IP 权利仍归相应权利人。MP4、WAV 与缓存保留在被忽略的 `artifacts/`，未上传发布。
- 隐藏机构、尺寸、变形和镜头含推断与展示设计；未做电影原帧量化、碰撞、GLB/Blend 或 Cycles，详见[实现与验证](cases/bumblebee-2007/models/kimi-k3-1-pro/records/实现与验证.md)。

### 大黄蜂 · Minimax-M3.1-Flash 版本（2026-11-08）

- 新增 `series/变形金刚系列/models/minimax-m3.1-flash/bumblebee-2007/`：大黄蜂 2007 真人电影版的独立程序化复刻，模型署名 Minimax-M3.1-Flash。
- 原始参考为 TOMY MPM-3 官方产品图两张，仅本地研究使用，未取得再分发许可，不随仓库发布。
- 程序化模型、材质、镜头表与音轨由本案例代码生成；Three.js 保持 MIT 许可并见第三方声明。
- 离线短片、逐帧缓存与工具产物保留在被忽略的 `artifacts/`，未上传发布。

### 擎天柱 · 2007 真人电影版重构

[电影版擎天柱](cases/optimus-prime-2007/models/gpt-6-1-sol/README.md)由当前Codex会话重写几何、分层装配、曲面装甲、材质、动作与摄影，沿用旧C-01的构建/确定性导出方法，故标 **derived / fidelity**。用户提供执行模型名称 GPT-6.1 Sol；会话未暴露精确模型 ID，未另调模型 API；实际工具与修订见案例records。以Paramount官方2007片段和ILM官方制作画面为主输入，Takara MPM-4仅为有标记的补充观察，不作为电影内部拓扑证明。原始影片、角色与制作资料归Paramount / DreamWorks / Hasbro、ILM / Lucasfilm等相应权利人；公开可访问不等于可再分发。参考清单逐文件记录原始URL、日期、尺寸和哈希，原始长视频仅留local。源码与演示公开；原始影片与高分辨率下载不分发。

世界尺度、隐藏机构及部分运动为推断；展开/检查核心/工具部署/分层拆解与重组含展示设计，不冒称所选电影已证明这些机构。172装配节点、2200视觉分件或路径追踪均不能证明达到ILM资产精度、完整无碰撞或实体可制造。

环境为Poly Haven **Industrial Sunset 02**，作者Sergej Majboroda，CC0；来源与哈希见[素材说明](cases/optimus-prime-2007/models/gpt-6-1-sol/assets/SOURCES.md)。车漆/粗糙度/微法线纹理由确定性Canvas生成，声音为NumPy原创合成，无影视配乐/台词/第三方音频采样。Three.js 0.186.1 MIT完整许可内嵌HTML；esbuild、Playwright遵循各自许可和锁文件。Blender 4.5.4 LTS便携程序只保留在ignored local中，不随仓库分发；逐帧影片、GLB与blend仅在ignored artifacts中。

[可复用工作流协议与草稿脚手架](series/变形金刚系列/docs/工作流协议.md)是本轮新增源代码/文档，依仓库MIT。脚手架不包含角色成品、原片资产或任何再授权声明。


## 变形金刚系列：HY4 独立版本

[HY4 擎天柱（2007 真人电影版）](cases/optimus-prime-2007/models/hy4/README.md)按[版本与目录约定](series/变形金刚系列/README.md)落在 `models/hy4/optimus-prime-2007/`，与两个已发布案例分开保存，不覆盖稳定链接。模型署名 `HY4 / Tencent Hunyuan Hy` 由用户指定标注，沿用机械系列历史口径；本次 WorkBuddy 会话内独立编写，未另行调用带版本号的 HY4 模型 API，精确模型 ID、完整提示词与迭代轮次未归档。铭牌不证明模型身份已核验，也不用于能力排名。

本版声明 `independent / fidelity`：只读任务书、方法文档、系列制作协议、仓库既有素材与测量记录，以及 15 份经登记的官方素材（8 张 Paramount / ILM 原帧，加 MPM-4 官方产品图、ILM 100s / 080s、Paramount 61s、8–32s 变形接触表、TOMY 2007 研究板），未使用既有擎天柱实现的几何源码、规格或页面作为建模输入。新增源代码（程序化几何、确定性 `stateAt(t)`、Three.js PBR 场景、7 镜头时间线、逐帧渲染与影片验收脚本、原创音轨合成）依仓库 MIT；角色、名称与原始影视/产品图像仍归 TOMY / Hasbro、Paramount / DreamWorks / Hasbro 及 ILM / Lucasfilm 等权利人，仓库 MIT 不转移这些权利。页面内联 Three.js（MIT，见第三方声明）；环境、火焰纹、磨损贴图与配乐均由代码生成，无来源不明的三维模型或音频采样。

原始参考哈希与逐帧来源见[案例来源清单](cases/optimus-prime-2007/models/hy4/references/sources.json)；原图、逐帧缓存与成片仅留 `local/` / `artifacts/`，不提交、不分发。成片为**同源模型逐帧 WebGL PBR 渲染 + FFmpeg 编码**（28s / 24fps / 1920×804 / H.264+AAC / 672 帧），原创程序化音轨；**不是 Blender Cycles 路径追踪**，不等同电影资产。未导出 GLB / Blend，未验证原片同机位量化误差、完整碰撞、跨 GPU 一致性与窄屏实跑；展甲与分层拆解为本轮设计动作。逐项限制见[实现与验证](cases/optimus-prime-2007/models/hy4/records/实现与验证.md)。

## 变形金刚系列：GLM-5.3-Flash 独立版本

[GLM-5.3-Flash 擎天柱（2007 真人电影版）](cases/optimus-prime-2007/models/glm-5-3-flash/README.md)按[版本与目录约定](series/变形金刚系列/README.md)落在 `models/glm-5.3-flash/optimus-prime-2007/`，与其他实现分开保存，不覆盖稳定链接。执行环境为 ZCode 会话，运行模型 GLM-5.3-Flash（账号计划 bigmodel-individual-coding-plan，会话未暴露可独立核验的精确快照 ID），未另行调用其他模型 API；用户最初要求标注 HY4，因 models/hy4 同案例由另一并行会话实现，本实现按仓库署名规则如实标注执行模型，最终署名调整权在项目使用者。

本版声明 `independent / fidelity`：只读任务书、方法文档与 [8 份经登记的官方素材](cases/optimus-prime-2007/models/glm-5-3-flash/references/sources.json)（Paramount 官方频道截帧 ×6、ILM 官方制作画面 ×2，哈希逐一校验），未读取既有擎天柱实现的几何源码、规格或页面作建模输入；构建管线（依赖回退、esbuild 内联、断言+浏览器 QA 模式）复用仓库 C-01 方法工具，属方法复用并在案例 README 署名。新增源代码（程序化几何、确定性 `stateAt(t)`、火焰/徽记/地面程序化贴图、Three.js PBR 场景、9 拍影片巡览、QA 与静帧脚本）依仓库 MIT；角色、名称与原始影视图像仍归 Paramount / DreamWorks / Hasbro 及 ILM / Lucasfilm 等权利人，仓库 MIT 不转移这些权利。页面内联 Three.js（MIT，见第三方声明）；无来源不明的三维模型或音频采样。

72 装配 / 339 视觉分件；世界尺寸 guess，变形单路径演示，无碰撞检测；未导出 GLB / MP4，未做原片同机位量化误差；`film.html` 为实时巡览，无音轨。逐项限制见[实现与验证](cases/optimus-prime-2007/models/glm-5-3-flash/records/实现与验证.md)。原始参考仅本地保留（local-only），不随仓库分发。

## 变形金刚参考与发布范围

[公开素材清单](series/变形金刚系列/publication.json)登记自渲染静帧、CC0 环境和[官方产品参考研究板](series/变形金刚系列/references/README.md)。研究板选用 62 个档案的完整产品画面缩略，保留原标识并标注来源，用于非商用参考研究；图片、摄影和角色权利归 TOMY / Hasbro 及相应权利人，不属于仓库 MIT，未声称已取得再分发许可。原始大图、原片帧、PDF、对照和影片留 local。

67 个角色研究档案中，62 个对应 144 张实际核验的官方产品样例，其余 5 个提供匹配片段或图证入口。伴随角色与跨版本问题见各档案。成果目录单独登记可运行实现。

正式28秒MP4为本轮模型的原创渲染与合成声音，不含原片画面、对白、配乐或未知三维模型。角色/名称与影视设计权利仍归相应权利人；新增代码的MIT不再授权这些角色。此项目非官方、非商业制作方资产。素材来源和工具许可继续依各自说明执行。


本地电影与网页功能演示采用 Scott Buckley 的 Titan（CC BY 4.0），截取并调整淡入淡出与响度；原曲不进入 Git。署名、曲目链接与复用要求见[视频工作流](cases/optimus-prime-2007/models/gpt-6-1-sol/视频工作流.md)。原版 28 秒影片的 NumPy 合成声音不变。


## 变形金刚系列 · GPT-6.1 Sol 大黄蜂研究

大黄蜂 2007 外观研究由 GPT-6.1 Sol 在 Codex 中独立实现。模型署名由用户确认，精确模型 ID 未知。外观参考为两张已登记的 TOMY MPM-3 官方产品原图。共同任务和本轮输入摘要分别保存在任务清单与成果记录中。内部机构、世界尺度与变形轨迹为推演，车壳、车型与头雕仍明显简化。原始输入范围与已完成的验证见[大黄蜂案例说明](cases/bumblebee-2007/models/gpt-6-1-sol/README.md)。

新增模型代码、程序化环境、材质及原创配乐／机械音效依仓库 MIT。角色、名称、电影设计和产品摄影权利仍归 TOMY / Hasbro / Paramount 等相应权利人。本版实际依赖 Three.js、esbuild、Playwright，遵循各自许可；Three.js 完整许可随离线 HTML 和案例文本保留。原始图像、GLB、Blend、逐帧缓存和 MP4 留在 local / artifacts，不自动提交或发布。
