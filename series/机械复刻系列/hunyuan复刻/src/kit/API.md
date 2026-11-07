# 宝石蓝复刻 · kit API 与实现约定（v1）

> 本文件是 00/01 两台共用的接口契约。kit 目录只读，改动需同步更新本文件。
> 设计画布 **1920 × 1080**（16:9），窗口任意尺寸时整体等比缩放居中；相机 aspect 跟随窗口。

---

## 1. 目录与职责

```
hunyuan复刻/
├── src/kit/                    共享库（只读）
├── src/<机器目录>/
│   ├── shared/sim.js           组装：影棚 + HUD + 模型 + 巡览（必需）
│   ├── shared/model.js         纯函数模型（无 three / 无 DOM）
│   ├── shared/check.mjs        断言
│   ├── live/main.js            互动页入口
│   ├── film/main.js            影片页入口
│   └── style.css               可选的机器专属样式（会被内联）
├── <机器目录>/                  交付 HTML（由 build.mjs 生成）
```

入口文件只有这几行（照抄）：

```js
// live/main.js
import {createSim} from '../shared/sim.js';
import {startSim} from '../../kit/player.js';
startSim(createSim({mode: 'live'}), {mode: 'live'});
```

```js
// film/main.js
import {createSim} from '../shared/sim.js';
import {startSim} from '../../kit/player.js';
startSim(createSim({mode: 'film'}), {mode: 'film'});
```

`createSim({mode})` 返回：

```js
{
  duration,          // 秒；影片页 = 巡览总长
  frame(t),          // 纯函数式渲染一帧：只依赖 t（秒），不读真实时钟
  onResize?(),       // 窗口变化时调用（一般 studio.setSize 后即可）
  onKey?(e),         // 可选：自定义快捷键
}
```

---

## 2. 命令

```bash
cd series/机械复刻系列/hunyuan复刻/src/kit

node build.mjs 00            # 构建 00 的互动页 + 影片页
node build.mjs 01            # 构建 01
node build.mjs all           # 全部
DS_DEBUG=1 node build.mjs 00 # 不压缩（调试用）

node shot.mjs 00 /tmp/oc8 --t=0,4,8,12.5   # 逐帧截图（默认 1600×900 @1.2 → 1920×1080 输出）
node shot.mjs 00 /tmp/oc8 --t=8 --nohud    # 不显示 HUD（看模型）
node shot.mjs 00 /tmp/oc8 --t=8 --mode=film
```

依赖目录默认自动找 `series/机械复刻系列/glm5.3-flash复刻/src/kit/node_modules`（three 0.186.1 / esbuild / playwright / @fontsource 字体），无需另装；需要时用 `DS_DEPS=...` 覆盖。

**构建产物**：`hunyuan复刻/<机器目录>/<中文名>-互动页.html`、`<中文名>-影片页.html`。单文件、零外链、断网可开。

---

## 3. 影棚 `kit/stage3d.js`

```js
import {createStudio} from '../../kit/stage3d.js';
const studio = createStudio({canvas, shadowSize: 2.6, exposure: 1.0});
```

单位 **米**，Y 轴向上，机器原点落在世界原点、底面贴 y=0，**正面朝 +Z**。

| 成员 | 说明 |
|---|---|
| `studio.scene` / `.camera` / `.renderer` | three 对象 |
| `studio.materials` | 调好的材质库（见下） |
| `studio.setSize(w, h)` | 窗口尺寸变化时调用 |
| `studio.setPose({pos,target,fov})` | 直接摆机位（数组坐标，米） |
| `studio.getPose()` | 当前机位 |
| `studio.tweenPose({pos,target,fov}, 0.9)` | 平滑过渡（每帧调 `studio.update(dt)`，live 用） |
| `studio.update(dt)` | 推进 tween |
| `studio.render()` | 渲染一帧（内部会 applyCamera） |
| `studio.project(v3)` | 世界坐标 → 窗口像素 `{x,y,z}`（标注用） |
| `studio.controls.onTakeover` | 用户按下/滚轮时回调（互动页接管巡览） |
| `studio.controls.enabled` | 是否允许拖拽/缩放 |
| `studio.setContactShadow(radius, opacity)` | 地面接触影大小 |
| `studio.setExposure(v)` | 曝光 |
| `studio.lights` | `{hemi, key, fill, rim, bounce}`，可调强度/位置（精致度需要机器自己调光） |

材质库 `studio.materials`（别处可 `.clone()` 后改参数）：

`white`（白瓷高光）· `whiteSoft` · `dark`（黑色机加工）· `darkSoft` · `rubber` · `steel` · `steelDark` ·
`accent`（宝石蓝阳极氧化）· `accentMatte` · `accentGlow`（自发光）· `accentSoft` · `glass` · `lens` · `bore`（玻璃缸套）· `glow`

几何工具 `kit/geo.js`：`rbox`（圆角盒）、`bevelCyl`（倒角圆柱）、`lathe`、`ring`、`gear`、`tube`（线缆/软管）、`spring`、`boltRing`、`bolt`、`place`、`merge`、`crossMarks`、`THREE`（re-export）。

性能约定：**重复零件用 `InstancedMesh` 或 `mergeGeometries` 合并**；目标 draw calls ≤ ~300、三角面 ≤ ~60 万；不要在 `frame(t)` 里每帧新建几何/材质。

---

## 4. HUD `kit/hud.js`

```js
import {createHud, createChart, createCompass, createBars, createButtons,
        createOpsPanel, pill, h, esc} from '../../kit/hud.js';

// canvas 先 append 到 #app，再 createHud（createHud 会保留 canvas，只替换自己的 .hud）
const hud = createHud(document.getElementById('app'));
```

布局原点 1920×1080。常用坐标（照原作版式，不要漂移）：

| 区域 | 坐标 |
|---|---|
| 顶栏 | 高 112；logo 左上 172×96；品牌块 left 202 top 15 |
| 左列 | left 24，width 322；首面板 top 118 |
| 右列 | left 1548，width 348；首面板 top 118 |
| 节拍大字 | left 404，bottom 208 |
| 操作日志 | left 404，right 372，bottom 62，height 104 |
| 底部角标 | bottom 17，left/right 24 |

| API | 说明 |
|---|---|
| `hud.setBrand({code, icon, kicker, title, subtitle})` | 顶栏品牌；`title` 可含少量 HTML（如 `<span class="slash">/</span>`），`icon` 为 SVG 字符串 |
| `hud.setMeta([{k, v, mono?, id?, status?{text,ok,live}}])` | 顶栏右侧数据组；`id` 会写到 `data-id` 便于逐帧更新 |
| `hud.addPanel({x,y,w,h,n,title,right,body,cls})` | 面板（`.panel`）。返回 `{el, body, head}`；`right` 可放胶囊 HTML |
| `hud.add(el, {x,y,w,h})` | 任意元素绝对定位进画布 |
| `hud.addDeco({labels, arcs, crosses})` | 背景装饰：大圆弧/虚线圆/顶部十字排 + 文本 `{text,x,y,dim?,rotate?}` |
| `hud.setBeat({mode,title,sub,key})` | 左下节拍大字；`title` 可含 HTML |
| `hud.showToast(html)` / `hud.hideToast()` | 顶部居中小提示（“自动巡览 · 点击接管”） |
| `hud.setFoot({left,right})` | 底部左右角标 |
| `hud.viewport` | `{w,h,scale,ox,oy}`（截图/标注换算） |

组件：

- `createChart({w,h,xRange,yRange,pad,grid})` → `{el, draw({series,xLabels,yLabels,dots,marks,xRange,yRange})}`；`series=[{pts:[[x,y]...], color, width, dash, area, step}]`；canvas 已按 DPR 2 渲染。
- `createCompass({size,title})` → `{el, update({pitch,roll,wobble})}`。
- `createBars([{label, showValue?, status?}])` → `{el, update([0..1...])}`。
- `createButtons([{label,on?,key?,toggle?}], onChange)` → `{el,set(idxOrKey)}`。
- `createOpsPanel({duration, beats:[{t,major?}], onSeek(t), onToggle, left,right})` → `{el, set({t,playing,event,count})}`；追加进 `hud.frame`，CSS 已带默认位置（可用内联样式微调）。
- `pill(text, 'ok'|'on'|'hot'|'idle'|'warn'|'line')` → HTML 字符串。
- `h(...)` 迷你 DOM 构造；`esc` 转义。

CSS 关键类名：`.panel/.ph/.n/.big/.u/.lab/.kv/.kvrow/.hr/.hint/.pill/.btnrow/.btn.on/.bars/.bar/.fill/.readout` 等，自写面板时优先复用。

---

## 5. 3D 标注 `kit/annotate.js`

```js
import {createAnnotations} from '../../kit/annotate.js';
const ann = createAnnotations({hud, studio});
ann.add({getWorld: () => new THREE.Vector3(...), text: '凸轮轴', sub: '半曲轴转速',
         side: 'right'|'left', dist: 92, dy: 0, visible: () => true});
// 每帧末尾：ann.update();
```

---

## 6. 巡览 `kit/tour.js`

```js
import {createDirector} from '../../kit/tour.js';
const beats = [
  {t: 0, key: 'hero', mode: '运行模式', title: '喷射循环', sub: '俯冲 · 3.6 米/秒',
   cam: {pos: [1.6, 1.2, 2.6], target: [0, 0.5, 0], fov: 34}, spin: 0.12, drift: 0.25},
  // spin：本拍到下一拍之间绕目标水平旋转（弧度）；drift：沿视线拉远（米，负=推近）
];
const director = createDirector({beats, duration: 25});
const s = director.sample(t);   // {beat,index,local,progress,pose}
studio.setPose(s.pose);         // 影片页/自动巡览
```

- 换机位在**到达节拍前** `trans`（默认 1.8 s）内完成，节拍时刻正好就位；`trans` 可按拍覆盖。
- 节拍对象必须含 `t,key,mode,title,sub,cam`；`cam` 为 `{pos,target,fov}`。

---

## 7. 玩家 `kit/player.js`

`startSim(sim, {mode})`：接管 rAF、暴露 `window.__sim`、空格暂停、H 隐藏 HUD。无需自己写循环。

`window.__sim` 可用方法：`renderFrame(t)`（截图/录片：设定时间并暂停，自动关 CSS 动画保证逐帧一致）、`play()`、`pause()`、`setTime(t)`（只改时间、不改播放状态，互动页进度条跳转用）、`duration`、`time`、`ready`。

---

## 8. 设计规范（必须遵守）

- **宝石蓝**：主 `#0f52ba`、亮 `#4a86e8`、深 `#0a357a`、浅 `#bfd7fa`；影棚为冷白蓝（CSS 变量已就绪）。**不要**红/橙/宝石紫作强调，也不要与 GLM 版钴蓝 `#1e5fd6` 混淆；绿色只用于“状态正常”胶囊。
- **全中文界面**：型号（Pelagos OC-8、V8）、单位（kPa、N、m/s、rpm、bar、mm、°）保留拉丁；不写英文句子。
- **数字同源**：屏上任何读数由 `model.js` 在 `frame(t)` 里算出，禁止写死。
- **纯函数**：`frame(t)` 不读 `Date.now()/performance.now()`，不随机（随机用 `mulberry32` 固定种子）。
- **贴图全部程序化生成**（canvas），不引用外部图片/字体文件；不联网。
- 字体：正文/标题用 CSS 变量 `--font-ui`（Inter + 苹方），数字/标签用 `--font-mono`（JetBrains Mono）。
- 字号参考：大读数 42px、面板标题 10.5px、标签 9.5px、节拍大字 68px、顶栏主标题 39px。

## 9. 验收自查

1. `node build.mjs <key>` 无报错；`node shot.mjs <key> /tmp/x --t=...` 无页面报错、无 console error。
2. 逐拍看图：相机有主体、无穿模/悬空、无标注遮挡、HUD 无重叠溢出、中文无乱码。
3. `node shared/check.mjs` 全过。
4. 每个数都在 model 里算；节拍时间与 durations 一致。
5. 文件单测：`grep -c "http" 产物.html` 仅剩 three 内部命名空间/注释（无网络请求）。
