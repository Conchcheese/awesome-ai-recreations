# awesome-ai-recreations

![擎天柱、大黄蜂与机械章鱼在工业工坊中的概念封面](assets/covers/awesome-ai-recreations-cover.jpg)

让不同的智能体、AI 模型和工具，围绕同一案例、原始参考与目标要求尝试复刻：看各自能做出什么效果，也研究怎样把演示和复刻做得更精细、更稳定、更容易复用。

我们保存可运行作品、源码、参考入口和制作方法。关注造型与动作还原、交互体验、材质与摄影、声音，以及从实现到实际交付的完整质量；把有效的方法与失败经验转化为下一次可以采用的流程。

[看全部作品](#案例展示) · [重建已有版本](docs/快速开始.md#修改或重建现有版本) · [新建独立复刻](#让-ai-agent-复刻) · [仓库结构](docs/仓库结构.md) · [本地工作区](docs/本地工作区.md)

## 让 AI Agent 复刻

把下面的内容发给能够读取仓库、查看图片并运行代码的 AI Agent，将案例名称替换为你想复刻的案例即可：

```text
https://github.com/topmindspace/awesome-ai-recreations
请复刻这个仓库里的机械章鱼案例。
```

也可以说「复刻 V8 发动机」或「复刻 2007 电影版擎天柱」，并附上模型、交付格式等要求。Agent 会按 [AGENTS.md](AGENTS.md) 查找共同任务和原始参考，自行实现并验证；无需手动查案例 ID、挑选旧版本或整理提示词。默认对齐参考、独立实现；如需修改某个已有版本，请直接说明。

同条件比较时，组织者核验完整输入包，交给每位 Agent 同一份文件和同样的附加指示。部分参考需按清单本地取得。具体操作见[快速开始](docs/快速开始.md)和[共同输入与资源](docs/共同输入与资源.md)。

## 案例展示

目前有 **11 个案例、20 个在线演示版本和 2 个本地短片版本**。点击「互动」操作作品，「巡览」打开自动演示。短片版本页收录剧照、制作与验收资料。

### 变形金刚复刻系列

| 剧照 | 案例介绍 | 版本与演示 |
|---|---|---|
| <img src="cases/optimus-prime-2007/models/gpt-6-2-sol/stills/余烬信号-剧照.jpg" width="160" alt="擎天柱·余烬信号剧照"><br><sub>GPT-6.2 Sol</sub> | **[擎天柱·2007真人电影版](cases/optimus-prime-2007/README.md)**<br>2007 真人电影版擎天柱：卡车与人形变换、局部展开和拆解重组。 | GPT-6.2 Sol：[《余烬信号》剧照与制作资料](cases/optimus-prime-2007/models/gpt-6-2-sol/README.md)（本地短片）<br>GPT-6.1 Sol：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/optimus-prime-2007/models/gpt-6-1-sol/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/optimus-prime-2007/models/gpt-6-1-sol/film.html)<br>HY4：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/optimus-prime-2007/models/hy4/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/optimus-prime-2007/models/hy4/film.html)<br>GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/optimus-prime-2007/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/optimus-prime-2007/models/glm-5-3-flash/film.html) |
| <img src="cases/bumblebee-2007/models/gpt-6-2-sol/stills/午夜回波-剧照.jpg" width="160" alt="大黄蜂·午夜回波剧照"><br><sub>GPT-6.2 Sol</sub> | **[大黄蜂·2007真人电影版](cases/bumblebee-2007/README.md)**<br>独立程序化外观研究，包含连续车形／人形变换、面罩与同源电影短片。 | GPT-6.2 Sol：[《午夜回波》剧照与制作资料](cases/bumblebee-2007/models/gpt-6-2-sol/README.md)（本地短片）<br>GPT-6.1 Sol：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/bumblebee-2007/models/gpt-6-1-sol/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/bumblebee-2007/models/gpt-6-1-sol/film.html)<br>MiniMax-M3.1-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/bumblebee-2007/models/minimax-m3-1-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/bumblebee-2007/models/minimax-m3-1-flash/film.html)<br>Kimi-K3.1-Pro：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/bumblebee-2007/models/kimi-k3-1-pro/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/bumblebee-2007/models/kimi-k3-1-pro/film.html) · [重建与本地视频](cases/bumblebee-2007/models/kimi-k3-1-pro/README.md) |

### 机械复刻系列

| 截图 | 案例介绍 | 在线演示 |
|---|---|---|
| <img src="cases/oc8/models/gpt-6-1-sol/stills/光影-整机.jpg" width="160" alt="机械章鱼OC-8截图"><br><sub>截图：GPT-6.1 Sol</sub> | **[机械章鱼OC-8](cases/oc8/README.md)**<br>机械章鱼的腕足、开壳、推进与分层拆解。 | GPT-6.1 Sol：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/gpt-6-1-sol/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/gpt-6-1-sol/film.html)<br>DeepSeek：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/deepseek/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/deepseek/film.html)<br>GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/glm-5-3-flash/film.html)<br>HY4 直出版：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/hy4-direct/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/hy4-direct/film.html)<br>HY 衍生版：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/hy-derived/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/hy-derived/film.html)<br>WorkBuddy 版：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/workbuddy/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/oc8/models/workbuddy/film.html) |
| <img src="cases/v8/models/glm-5-3-flash/covers/01-V8发动机-封面A-4x3.png" width="160" alt="V8发动机截图"><br><sub>截图：GLM 5.3-Flash</sub> | **[V8发动机](cases/v8/README.md)**<br>观察 V8 发动机的活塞、曲轴与内部结构。 | DeepSeek：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/v8/models/deepseek/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/v8/models/deepseek/film.html)<br>GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/v8/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/v8/models/glm-5-3-flash/film.html) |
| <img src="cases/cessna337/models/glm-5-3-flash/covers/02-塞斯纳337起落架-封面A-4x3.png" width="160" alt="塞斯纳337起落架截图"> | **[塞斯纳337起落架](cases/cessna337/README.md)**<br>塞斯纳 337 飞机的起落架与收放机构。 | GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/cessna337/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/cessna337/models/glm-5-3-flash/film.html) |
| <img src="cases/strandbeest/models/glm-5-3-flash/covers/03-海滩兽Strandbeest-封面A-4x3.png" width="160" alt="海滩兽Strandbeest截图"> | **[海滩兽Strandbeest](cases/strandbeest/README.md)**<br>海滩兽的连杆步行结构与运动。 | GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/strandbeest/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/strandbeest/models/glm-5-3-flash/film.html) |
| <img src="cases/sandworm/models/glm-5-3-flash/covers/04-仿生沙虫MK-X-封面A-4x3.png" width="160" alt="仿生沙虫MK-X截图"> | **[仿生沙虫MK-X](cases/sandworm/README.md)**<br>仿生沙虫的分节身体和运动机构。 | GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/sandworm/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/sandworm/models/glm-5-3-flash/film.html) |
| <img src="cases/jellyfish/models/glm-5-3-flash/covers/05-机械水母MJ-9-封面A-4x3.png" width="160" alt="机械水母MJ-9截图"> | **[机械水母MJ-9](cases/jellyfish/README.md)**<br>机械水母的伞体、触腕与运动。 | GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/jellyfish/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/jellyfish/models/glm-5-3-flash/film.html) |
| <img src="cases/hexapod/models/glm-5-3-flash/covers/06-六足机器人HX-18-封面A-4x3.png" width="160" alt="六足机器人HX-18截图"> | **[六足机器人HX-18](cases/hexapod/README.md)**<br>六足机器人的腿部关节与步行动作。 | GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/hexapod/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/hexapod/models/glm-5-3-flash/film.html) |
| <img src="cases/bee/models/glm-5-3-flash/covers/07-机械蜜蜂HB-7-封面A-4x3.png" width="160" alt="机械蜜蜂HB-7截图"> | **[机械蜜蜂HB-7](cases/bee/README.md)**<br>机械蜜蜂的翅膀、足部与内部结构。 | GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/bee/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/bee/models/glm-5-3-flash/film.html) |
| <img src="cases/scorpion/models/glm-5-3-flash/covers/08-机械蝎子SC-8-封面A-4x3.png" width="160" alt="机械蝎子SC-8截图"> | **[机械蝎子SC-8](cases/scorpion/README.md)**<br>机械蝎子的躯体、足部和尾部机构。 | GLM 5.3-Flash：[互动](https://topmindspace.github.io/awesome-ai-recreations/cases/scorpion/models/glm-5-3-flash/index.html) · [巡览](https://topmindspace.github.io/awesome-ai-recreations/cases/scorpion/models/glm-5-3-flash/film.html) |

## 使用与资料

从[案例索引](cases/README.md)打开任务、原始参考和各模型版本。重建按版本 README 执行；制作项目与成片按同一案例和版本归入[本地工作区](docs/本地工作区.md)。其他维护说明见[文档导航](docs/README.md)。

## 许可

新增代码与文档使用 [MIT](LICENSE)。原作、角色、影视设计和第三方素材保留各自权利，详见 [NOTICE](NOTICE.md)；参考资料不因放入仓库而取得新的商用或再分发授权。
