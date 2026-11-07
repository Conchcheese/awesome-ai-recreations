"""Score for the Telson SC-8 film: a low desert bed (slow Dm chords, wind under), a soft sand
thud on every footfall of the alternating gait groups, one crisp whip + snap on the featured
tail strikes, quiet clicks on the operator's button presses, staggered pops as the tail chain
separates segment by segment, and a chime when the rebuild settles.

    python run_sfx.py sims/scorpion-shared/score.py

Every time comes from ../scorpion-film/timeline.json (beats) plus the gait model constants
mirrored from scorpion-shared/model.js (CYCLE / WALK_END / STEPS / PHASE0) — the same mapping
film.js uses — so sound cannot drift out of sync with the picture.
"""

import math
import os

from sfx.score_kit import airy, bed, chords, hz, thud
from sfx.synth import chime, click, impact, pop, riser, whoosh

TIMELINE = "../scorpion-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "scorpion-score.wav")
TARGET_LUFS = -14.0
SEED = 8

# —— 与 scorpion-shared/model.js 保持一致的步态常量 ——
CYCLE = 2.2
WALK_END = 0.62
STEPS = 2
PHASE0 = 0.35
GUARD_MID = 0.66

CHORDS = chords("Dm9:D2 A2 C3 E3 F3/D1", "Bbmaj7:Bb1 F2 A2 D3/Bb0", "Fmaj7:F1 C2 E3 G3 A3/C1", "Gm7:G1 D2 F2 A2 C3/A0")
CLICK_BEATS = ("gait", "leg", "claw", "tail", "explode", "reassemble", "alert")


def smoother(x):
    u = min(1.0, max(0.0, x))
    return u * u * u * (u * (u * 6 - 15) + 10)


def ss(a, b, x):
    return smoother((x - a) / (b - a))


def p_at(t, alert_t):
    """film.js 的相位映射：alertT 后减速驻停到警戒带中点。"""
    if t >= alert_t:
        pa = ((alert_t + PHASE0) / CYCLE) % 1.0
        target = GUARD_MID if pa < WALK_END else 1 + GUARD_MID
        return pa + (target - pa) * ss(alert_t, alert_t + 1.3, t)
    return ((t + PHASE0) / CYCLE) % 1.0


def explode_at(t, tl):
    return ss(tl["explode"], tl["explode"] + 1.5, t) * (1 - ss(tl["reassemble"], tl["reassemble"] + 1.3, t))


def touchdowns(dur, tl):
    """两足组的落脚时刻：组相位 u 穿 0 即支撑相开始（与 model.gaitPhase 同式）。"""
    out = []
    n = int(dur / (1 / 240)) + 2
    prev = [None, None]
    for i in range(n):
        t = i / 240
        p = p_at(t, tl["alert"])
        e = explode_at(t, tl)
        walking = p < WALK_END and p > 0.05 and e < 0.4 and t < tl["alert"] - 0.15
        for g in (0, 1):
            u = (p * STEPS / WALK_END + g * 0.5) % 1.0
            k = math.floor(p * STEPS / WALK_END + g * 0.5)
            if walking and prev[g] is not None and k != prev[g] and u < 0.2:
                out.append(t)
            prev[g] = k
    return out


def score(mix, tl):
    dur = tl["duration"]
    beats = {k: v for k, v in tl.items() if isinstance(v, (int, float)) and k != "duration"}
    left, right, low, drums = bed(dur, 62, CHORDS, (), motif_voice="blip", kicks=(), snares=(), hats=0, keys_vel=0.5, keys_lp=2200)
    mix.put_stereo(0, left, right, 0.15)
    mix.put(0, low, 0.12)
    # 沙漠风床：全程很低，警戒收尾时略抬
    mix.put(0, airy(dur, 180, 460, 0.5), 0.018)
    mix.put(tl["alert"] - 0.6, airy(dur - tl["alert"] + 1.2, 300, 900, 0.6), 0.03)

    # 脚步 thud：两足组交替落脚
    for t in touchdowns(dur, tl):
        mix.put(t, thud(96, 0.05, 0.22), 0.055)

    # 每拍按钮 click + 到位 whoosh
    for i, key in enumerate(CLICK_BEATS):
        t = beats[key]
        if t <= 0:
            continue
        mix.put(max(0.0, t - 0.5), whoosh(0.7, 260 + 40 * i, 800 + 60 * i, peak=0.5), 0.045)
        mix.put(t, click(2000 + 90 * i, 0.03), 0.05)

    # 尾链甩击：尾部特写拍里的两次攻击各来一声利落的 whip，咬合处补 snap
    for k in range(int(dur / CYCLE) + 1):
        t_whip = k * CYCLE - PHASE0 + 0.74 * CYCLE + 0.5 * 0.109 * CYCLE  # 甩击窗中点
        if tl["tail"] - 0.35 <= t_whip <= tl["explode"] + 0.2:
            mix.put(max(0.0, t_whip - 0.12), whoosh(0.34, 1400, 320, peak=0.85, q=1.4), 0.09)
        t_snap = k * CYCLE - PHASE0 + 0.885 * CYCLE  # 钳咬合
        if tl["claw"] - 0.3 <= t_snap <= tl["tail"] + 0.9:
            mix.put(t_snap, click(2600, 0.024), 0.06)

    # 拆解：尾链逐节分离的 pop（与 geometry 的错开节奏一致）
    for i in range(6):
        t = tl["explode"] + 1.5 * (0.294 + 0.0765 * i)
        mix.put(t, pop(300 + 36 * i, 560 + 60 * i, 0.14), 0.06)
    mix.put(tl["explode"] + 0.15, impact(1.0), 0.1)

    # 重组落定 chime，警戒收尾一声低钟
    mix.put(tl["reassemble"] + 1.35, chime([hz("D5"), hz("A5")], 1.6, 0.6), 0.05)
    mix.put(tl["alert"] + 1.6, chime([hz("D4")], 2.2, 0.9), 0.03)


