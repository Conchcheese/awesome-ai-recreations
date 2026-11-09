# teardown 复刻机械章鱼（改写自 @elvar_official 原文 9 条提示词）
> 历史改写模板，保留原貌；不是原作作者提示词，也不是最终规格。例子中的 12 节腕足、吸盘和尺寸含假设，不能直接当作原作事实。后续精细复刻请用[新任务书](../../../../cases/oc8/task/brief.md)。`/teardown` 仅在对应技能已安装时可调用，否则直接使用正文约束。

来源：https://x.com/elvar_official/status/2116174609355571402 ；skill：github.com/elvarofficial/teardown（MIT）
章鱼视频：@0x_fokki https://x.com/0x_fokki/status/2116289885870981296 （其本人提示词未公开）

## 1 建模
/teardown Build [a robotic octopus] as an interactive 3D simulator. Reference attached: [one image of a mechanical octopus].
Build it from code in real units: [a domed mantle shell, a central drive hub, 8 tentacles each made of 12 segments, cable-driven joints, suction cups on the underside, a water-jet nozzle].
Before you draw anything, write the model as pure functions of one input: [swim cycle phase from 0 to 1]. Use real numbers: [mantle 0.6 m across, tentacles 1.2 m long, each joint bends at most 30°, adjacent tentacles offset by 1/8 of the cycle]. Check them by hand and show me the check. If you are not sure a number is real, say so and tell me where it comes from.
Every part, every panel and every label reads from that one model. Nothing is animated by hand.

## 2 面板
Lay out a console around the machine at 1600×900:
- the title and the main live number top left, big: [swim speed in m/s]
- live charts that move with the machine: [bend angle of each tentacle over one cycle, jet thrust]
- a schematic panel that redraws the mechanism in 2D from the same model
- one button per subsystem: isolate it, cut it, show it alone [mantle, drive hub, tentacles, suction cups, jet]
- camera views as buttons: [hero, front, side, top, underside]
- callouts with thin leader lines into the parts they name
Every panel redraws from the frame's state. No number on screen is typed in.

## 3 风格
Style: a clean study model on a pale studio.
- light background, soft shadows on an invisible floor, one accent colour for the part that is working right now
- the machine fills 60 to 70% of its view
- dark parts glossy, liners glass, metal roughness at least 0.45 so it never streaks white
- if a part is near-white, give it a thin ink outline or a darker ground
- pick the camera for the mechanism: if it collapses into a lattice face-on, use a 3/4 view

## 4 自检
Before you show me anything:
1. Render a still at every beat of the tour and read each one: a part passing through another, a part floating off its mount, a label covering what it names, a number that disagrees with the pose.
2. Scrub every transition at 0.2 s steps and look for a jump.
3. Fix collisions with a number in the parameter block. Never hide them with the camera.
Tell me what you checked and what you fixed. Show me the stills.

## 5 录视频
Record the tour: render(t) has to be a pure function of time, so draw every frame at 60 fps at 1920×1080 in headless Chrome and pipe it into ffmpeg as H.264, yuv420p, faststart. Then show me a contact sheet of every beat.

## 6 配乐（可选）
Score it in code on the same timeline: [soft ambient pads, a low whoosh on every jet pulse, a quiet click on every button press]. Master to -14 LUFS with the true peak under -1 dB and mux it into the video.
