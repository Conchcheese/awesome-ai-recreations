// 00 机械章鱼 OC-8 · 宝石蓝版 · 页面组装：宝石蓝影棚 + 整机 + 中文 HUD + 25 s 巡览 + 交互。
// 入口（live/main.js / film/main.js）只调用 createSim({mode})；所有读数来自 shared/model.js。
import * as THREE from 'three';
import {createStudio} from '../../../../../../shared/mechanical/hy-derived-kit/stage3d.js';
import {createHud} from '../../../../../../shared/mechanical/hy-derived-kit/hud.js';
import {createAnnotations} from '../../../../../../shared/mechanical/hy-derived-kit/annotate.js';
import {createDirector} from '../../../../../../shared/mechanical/hy-derived-kit/tour.js';
import {buildMachine} from './geometry.js';
import {buildConsole} from './hud-oc8.js';
import * as MODEL from './model.js';

const DURATION = MODEL.DURATION;

const SPIN = {jet: 0.05, hold: 0.07, rebuild: 0.03, depart: 0.1};
const OPS_EVENT = (beat) => beat.phase || beat.mode;

function buildDirector() {
  const beats = MODEL.BEATS.map((b) => ({
    t: b.t,
    key: b.key,
    mode: '运行模式',
    title: b.mode,
    sub: b.sub,
    cam: b.cam,
    spin: SPIN[b.key] || 0,
    trans: b.key === 'jet' ? 0.01 : 1.7,
  }));
  return createDirector({beats, duration: DURATION});
}

export function createSim({mode = 'live'} = {}) {
  const root = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  root.append(canvas);

  const studio = createStudio({canvas, shadowSize: 3.2, exposure: 1.0});
  // 光与材质：压低环境光、突出主光，让白装甲有体积、黑件有层次
  studio.setExposure(1.0);
  const L = studio.lights;
  L.key.intensity = 2.9;
  L.key.position.set(2.0, 2.6, 2.0); // 低角度主光：臂在地面拉出长软影
  L.hemi.intensity = 0.3;
  L.fill.intensity = 0.45;
  L.rim.intensity = 1.4;
  L.bounce.intensity = 0.3;
  studio.scene.environmentIntensity = 0.4;
  {
    const M = studio.materials;
    M.white.color.set(0xf2f6fc);
    M.white.roughness = 0.34;
    M.white.clearcoat = 0.6;
    M.white.clearcoatRoughness = 0.22;
    M.whiteSoft.color.set(0xeaf1fa);
    M.whiteSoft.roughness = 0.5;
    M.dark.color.set(0x111925);
    M.dark.roughness = 0.3;
    M.dark.metalness = 0.62;
    M.darkSoft.color.set(0x1a2331);
  }
  studio.setSize(window.innerWidth, window.innerHeight);
  const hud = createHud(root);
  const machine = buildMachine(studio);
  studio.scene.add(machine.root);
  // 地面比白装甲略深一档，避免整机「糊」在浅色影棚里
  studio.floor.material.color.set(0xdfeaf9);
  studio.setContactShadow(1.35, 0.62);
  // 第二层更小更深的接触影：只放在机器正下方，压住「漂浮感」
  const contact2 = new THREE.Mesh(studio.contact.geometry, studio.contact.material.clone());
  contact2.rotation.x = -Math.PI / 2;
  contact2.position.y = 0.0014;
  contact2.material.color.set(0x12325e);
  contact2.material.opacity = 0.55;
  contact2.renderOrder = 2;
  contact2.scale.set(1.35, 1.35, 1);
  studio.scene.add(contact2);
  studio.controls.enabled = mode === 'live';

  const director = buildDirector();
  window.__OC8 = {studio, machine, director}; // 调试/截图用（不参与画面）

  /* ---------------------------------------------------------------- 交互状态 */
  const display = {labels: true, exploded: false, wake: false, turntable: false};
  let auto = true;
  let actions = 0;
  let seekT = null;
  let currentT = 0;
  let playing = true;
  let lastInput = 0;
  let explodeT = -99;
  let turntableT = 0;
  let blending = false;
  let lastFrameT = 0;

  let toastTimer = 0;
  const toast = (html, remain = 2.8) => {
    hud.showToast(html);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hud.hideToast(), remain * 1000);
  };

  const resume = () => {
    if (window.__sim && window.__sim.paused) window.__sim.play();
  };

  const goto = (target) => {
    const t = Math.max(0, Math.min(DURATION - 0.05, target));
    if (window.__sim) {
      window.__sim.renderFrame(t);
      window.__sim.play();
    } else seekT = t;
    currentT = t;
    lastInput = t;
    return t;
  };

  const noteAction = () => {
    actions++;
  };

  const consoleApi = buildConsole(hud, {
    mode,
    onAssembly(key) {
      const beatKey = key === 'arm2' ? 'arm' : key;
      const b = MODEL.BEATS.find((x) => x.key === beatKey);
      if (!b) return;
      auto = true;
      blending = true;
      studio.tweenPose(b.cam, 1.5);
      noteAction();
      resume();
      goto(b.t + 1.2);
      toast(`隔离 · ${b.mode.replace('张开', '').replace('循环', '')} — ${b.sub}`);
    },
    onDisplay(key, on) {
      display[key] = on;
      if (key === 'exploded') explodeT = currentT;
      if (key === 'turntable') turntableT = currentT;
      noteAction();
      resume();
      toast(`${on ? '打开' : '关闭'} · ${({labels: '标注', exploded: '拆解', wake: '喷射尾流', turntable: '转台'})[key]}`);
      if (key === 'labels' && mode === 'film') display.labels = true;
    },
    onSeek(t) {
      auto = true;
      blending = false;
      noteAction();
      goto(t);
      if (window.__sim && window.__sim.paused) window.__sim.play();
    },
    onToggle() {
      playing = !playing;
      if (window.__sim) {
        if (playing) window.__sim.play();
        else window.__sim.pause();
      }
    },
  });

  /* ---------------------------------------------------------------- 3D 标注 */
  const ann = createAnnotations({hud, studio});
  const keyAt = () => MODEL.beatAt(currentT).key;
  const gate = (...keys) => () => display.labels && keys.includes(keyAt());
  ann.add({getWorld: machine.labelPoints.optics, text: '光学阵列', sub: '2 × 82 mm 镜头 · 红外环', side: 'right', dist: 112, visible: gate('optics', 'hold')});
  ann.add({getWorld: machine.labelPoints.mantle, text: '壳瓣', sub: '8 瓣 · 70° 铰接', side: 'right', dist: 118, visible: gate('mantle')});
  ann.add({getWorld: machine.labelPoints.brain, text: '脑核', sub: '缆线束 · 蓝夹扣', side: 'left', dist: 104, visible: gate('mantle')});
  ann.add({getWorld: machine.labelPoints.port, text: '玻璃舷窗', sub: '齿轮机构藏于玻璃后', side: 'left', dist: 128, visible: gate('siphon', 'hold')});
  ann.add({getWorld: machine.labelPoints.siphon, text: '虹吸', sub: '3 套筒 · 6 瓣喷口', side: 'left', dist: 118, visible: gate('siphon')});
  ann.add({getWorld: machine.labelPoints.arm, text: 'R2 臂链', sub: '25 节 · 60 轮', side: 'left', dist: 120, visible: gate('arm')});
  ann.add({getWorld: machine.labelPoints.beak, text: '双颚', sub: '之间是齿舌环', side: 'right', dist: 112, visible: gate('beak')});
  ann.add({getWorld: machine.labelPoints.hub, text: '臂毂', sub: '8 安装座', side: 'left', dist: 112, visible: gate('teardown')});

  /* ---------------------------------------------------------------- 接管 / 空闲回巡览 */
  const takeOver = (msg = '已接管 · 拖动环绕 / 滚轮缩放') => {
    if (mode === 'film') return;
    if (auto) {
      noteAction();
      toast(msg);
      auto = false;
      blending = false;
    }
    lastInput = currentT;
    resume();
  };
  studio.controls.onTakeover = () => takeOver();

  /* ---------------------------------------------------------------- 状态胶囊 */
  function subsystems(st) {
    const detach = st.explode > 0.3;
    const m = st.opens.mantle > 0.5;
    const s = st.opens.siphon > 0.5;
    const bk = st.beak.jaw > 0.25;
    const ap = st.opens.arm > 0.5;
    const ir = st.optics.ir > 0.5;
    const flow = st.siphon.spread > 0.5;
    const det = {text: '分离', kind: 'hot'};
    return [
      detach ? det : {text: ir ? '跟踪中' : '待机', kind: ir ? 'ok' : 'idle'},
      detach ? det : {text: m ? '张开' : '密封', kind: m ? 'on' : 'ok'},
      detach ? det : {text: m ? '展开' : '运转中', kind: m ? 'on' : 'ok'},
      detach ? det : ap ? {text: 'R2 分离', kind: 'hot'} : {text: '8 / 8 在线', kind: 'ok'},
      detach ? det : {text: s || flow ? '张开' : '待机', kind: s ? 'hot' : flow ? 'on' : 'idle'},
      detach ? det : {text: bk ? '张开' : '密封', kind: bk ? 'hot' : 'ok'},
    ];
  }

  /* ---------------------------------------------------------------- 每帧 */
  let filmStarted = false;
  function frame(t) {
    let time = t;
    if (seekT != null) {
      time = seekT;
      seekT = null;
    }
    currentT = time;

    // 空闲 8 秒回到自动巡览
    if (mode === 'live' && !auto && time - lastInput > 8) {
      auto = true;
      blending = true;
      toast('自动巡览 · 点击接管');
    }

    const s = director.sample(time);
    if (auto || mode === 'film') {
      if (blending) {
        studio.update(1 / 60);
        if (!studio.isTweening()) blending = false;
      } else {
        studio.setPose(s.pose);
      }
    }

    const st = MODEL.stateAt(time);
    const beat = st.beat;

    // 拆解开关：把额外拆解量叠在巡览拆解之上
    let extra = 0;
    if (display.exploded) extra = Math.min(1, Math.max(0, (time - explodeT) / 0.8));
    const explode = Math.max(st.explode, extra * 0.92);
    // 转台开关：额外连续旋转
    const turretSpin = display.turntable ? (time - turntableT) * 0.55 : 0;
    const dy = 0.55 * smootherstep(23.3, 24.7, time);
    const wakeK = display.wake ? 1 : 0;

    machine.update({
      t: time,
      petals: st.petals,
      breathe: st.breathe,
      optics: st.optics,
      siphon: st.siphon,
      beak: st.beak,
      explode,
      turret: st.turret + turretSpin,
      dy,
      wake: wakeK,
      opens: st.opens,
    });
    const cr = 1.35 - dy * 0.55;
    studio.setContactShadow(cr, Math.max(0.2, 0.62 - dy * 0.25));
    const cs = cr * 2.4;
    contact2.scale.set(cs * 0.4, cs * 0.4, 1);
    contact2.material.opacity = Math.max(0.18, 0.55 - dy * 0.22);

    // HUD
    const tm = st.telemetry;
    const load = MODEL.jetLoad(time);
    consoleApi.update({
      t: time,
      beat,
      tm,
      pressure: MODEL.mantlePressure(time),
      thrustN: MODEL.thrust(time),
      load,
      chart: MODEL.pressureHistory(time, 41, 1.2),
      curls: MODEL.armWave(time),
      siphonFlowing: st.opens.siphon > 0.45 || st.siphon.spread > 0.5,
      playing,
      actions,
      isolate: beat.isolate,
      display,
      subs: subsystems(st),
      auto: mode === 'film' ? true : auto,
      opsEvent: OPS_EVENT(beat),
    });

    studio.render();
    // 标注投影必须在相机矩阵更新之后（render 之后），否则首帧标注会全部隐藏
    ann.update();

    if (mode === 'film' && !filmStarted) {
      filmStarted = true;
      setTimeout(() => {
        if (window.__sim) window.__sim.play();
      }, 80);
    }
    lastFrameT = time;
  }

  /* ---------------------------------------------------------------- 快捷键 */
  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    const asm = {1: 'hero', 2: 'optics', 3: 'mantle', 4: 'arm2', 5: 'siphon', 6: 'beak'}[k];
    if (asm) {
      const items = consoleApi.asmBtns.items;
      const it = items.find((x) => x.key === asm);
      if (it) it.key && consoleApi.asmBtns.els[items.indexOf(it)].click();
      e.preventDefault();
    } else if (k === 'l' || k === 'e' || k === 'j' || k === 't') {
      const key = {l: 'labels', e: 'exploded', j: 'wake', t: 'turntable'}[k];
      const idx = consoleApi.DISP.findIndex((x) => x.key === key);
      if (idx >= 0) consoleApi.dispBtns.els[idx].click();
      e.preventDefault();
    } else if (k === 'r') {
      auto = true;
      blending = true;
      resume();
      toast('恢复自动巡览');
    }
  }

  return {
    duration: DURATION,
    frame,
    onResize() {
      studio.setSize(window.innerWidth, window.innerHeight);
    },
    onKey,
  };
}

// 供 player.js 使用；保持模块无副作用
function smootherstep(a, b, x) {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * u * (u * (u * 6 - 15) + 10);
}
