"""Score for the HX-18 hexapod film: an electric servo-hum bed (motor drone + soft e-piano
chords), one light thud per tripod touchdown, a click on every button the operator presses,
a pop when the leg's three joints come apart, a riser into the teardown impact, a chime when
the rebuild settles, and air under the departure walk-off.

    python run_sfx.py sims/hexapod-shared/score.py

Every time comes from ../hexapod-film/timeline.json (beats + gait_stop/gait_resume +
step_period) — the same file film.js reads — so sound cannot drift out of sync.
"""

import os

from sfx.score_kit import airy, bed, hz, motor, thud
from sfx.synth import chime, click, impact, pop, riser, whoosh

TIMELINE = "../hexapod-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "hexapod-score.wav")
TARGET_LUFS = -14.0
SEED = 18

CHORDS = None  # set in score() via chords()
CLICK_BEATS = ("gait", "leg", "joint", "top", "explode", "reassemble", "depart")


def score(mix, tl):
    from sfx.score_kit import chords

    dur = tl["duration"]
    beats = {k: v for k, v in tl.items() if isinstance(v, (int, float)) and k != "duration"}
    chord_prog = chords("Am9:A1 E2 G2 B2 C3/E1", "Fmaj7:F1 C2 E2 A2 B2/C1", "Cmaj7:C2 G2 B2 D3 E2/G0", "G6:G1 D2 E2 B2 D3/A0")
    left, right, low, drums = bed(dur, 76, chord_prog, (), motif_voice="blip", kicks=(), snares=(), hats=0, keys_vel=0.5, keys_lp=2400)
    mix.put_stereo(0, left, right, 0.13)
    mix.put(0, low, 0.09)
    # 电动嗡鸣底：舵机总线 e 的电机嗡声，整段铺底（随拆解窗口淡出由音量包络近似）
    mix.put(0, motor(dur, 118, 1500, 14), 0.05)
    # 离场走远时垫一点空气
    mix.put(tl["depart"] - 0.6, airy(dur - tl["depart"] + 0.4, 300, 900, 0.7), 0.05)
    # 相机到站低啸 + 按键咔哒
    for i, key in enumerate(CLICK_BEATS):
        t = beats[key]
        if t <= 0:
            continue
        mix.put(max(0.0, t - 0.55), whoosh(0.75, 300 + 40 * i, 900 + 60 * i, peak=0.55), 0.05)
        mix.put(t, click(2100 + 90 * i, 0.03), 0.05)
    # 每次三脚架触地一声轻 thud：支撑组落地时刻 = 半周期节拍，停机窗口内静音
    period = tl["step_period"]
    stop, resume = tl["gait_stop"], tl["gait_resume"]
    t = 0.0
    k = 0
    while t < dur:
        if not (stop - 0.05 <= t <= resume + 0.05):
            mix.put(t, thud(82 + (k % 2) * 6, decay=0.1, dur=0.32), 0.16)
            k += 1
        t += period
    # 单腿三关节拆开：三声 pop（髋/股/胫）
    for j in range(3):
        mix.put(tl["joint"] + 0.25 + 0.55 * j, pop(300 + 60 * j, 620 + 80 * j, 0.14), 0.08)
    # 整机拆解：riser 进冲击，转台低啸；重组落在 chime
    mix.put(tl["explode"] - 1.5, riser(1.5, 220, 4200), 0.05)
    mix.put(tl["explode"], impact(1.1), 0.12)
    mix.put(tl["explode"] + 0.6, whoosh(3.2, 160, 420, peak=0.4), 0.04)
    mix.put(tl["reassemble"] + 1.1, chime([hz("E5"), hz("B5")], 1.6, 0.6), 0.05)
