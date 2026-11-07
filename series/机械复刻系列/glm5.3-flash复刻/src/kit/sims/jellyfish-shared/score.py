"""Score for the MJ-9 film: a calm underwater bed (soft e-piano chords, no drums), a low whoosh
as the camera arrives at each assembly, a quiet click on every button the operator presses,
a soft pop each time a part separates, a riser into the teardown impact, a chime when the
rebuild settles, a gentle whoosh on every pulse (排气), and air under the departure.

    python run_sfx.py sims/jellyfish-shared/score.py

Every time comes from ../jellyfish-film/timeline.json (beats) — the same file film.js reads — so
sound cannot drift out of sync with the picture.
"""

import os

from sfx.score_kit import airy, bed, chords, hz
from sfx.synth import chime, click, impact, pop, riser, whoosh

TIMELINE = "../jellyfish-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "jellyfish-score.wav")
TARGET_LUFS = -14.0
SEED = 9

CHORDS = chords("Cmaj9:C2 G2 E3 B3 D4/G1", "Am7:A1 E2 G2 C3 E3/C0", "Fmaj7:F1 C2 A2 E3 G3/C0", "G6:G1 D2 B2 D3 E3/A0")
# the button presses and the part-separations come straight from the timeline
CLICK_BEATS = ("pump", "bell", "tentacle", "explode", "reassemble", "depart")
POP_BEATS = ("pump", "bell", "tentacle")
PULSE_HZ = 0.85


def score(mix, tl):
    dur = tl["duration"]
    beats = {k: v for k, v in tl.items() if isinstance(v, (int, float)) and k != "duration"}
    left, right, low, drums = bed(dur, 66, CHORDS, (), motif_voice="blip", kicks=(), snares=(), hats=0, keys_vel=0.5, keys_lp=2400)
    mix.put_stereo(0, left, right, 0.14)
    mix.put(0, low, 0.1)
    mix.put(0, drums, 0.0)
    # 水底氛围：离场段加一层气声
    mix.put(tl["depart"] - 0.8, airy(dur - tl["depart"] + 0.4, 300, 900, 0.7), 0.05)
    # 每次脉动排气一声柔和 whoosh（0.35 相位 = 排气峰，脉动 0.85 HZ）
    period = 1.0 / PULSE_HZ
    t0 = (0.35 / PULSE_HZ)
    n = 0
    t = t0
    while t < dur - 0.6:
        if not (tl["explode"] - 0.2 <= t <= tl["reassemble"] + 1.2):  # 拆解段让位给 impact
            mix.put(t, whoosh(0.5, 260 + (n % 4) * 18, 760 + (n % 4) * 24, peak=0.34), 0.035)
        n += 1
        t += period
    # 到站 whoosh + 按钮 click
    for i, key in enumerate(CLICK_BEATS):
        t = beats[key]
        if t <= 0:
            continue
        mix.put(max(0.0, t - 0.55), whoosh(0.75, 300 + 40 * i, 900 + 60 * i, peak=0.55), 0.05)
        mix.put(t, click(2100 + 90 * i, 0.03), 0.05)
    # 每个部件散开的柔和 pop（开度 ~0.85 s 后落定）
    for i, key in enumerate(POP_BEATS):
        mix.put(beats[key] + 0.8, pop(320 + 30 * i, 620 + 60 * i, 0.16), 0.07)
    # 拆解：riser 进 impact，转台低 whoosh
    mix.put(tl["explode"] - 1.5, riser(1.5, 220, 4200), 0.05)
    mix.put(tl["explode"], impact(1.1), 0.12)
    mix.put(tl["explode"] + 0.6, whoosh(3.2, 160, 420, peak=0.4), 0.04)
    # 重组落定一声 chime
    mix.put(tl["reassemble"] + 1.1, chime([hz("E5"), hz("B5")], 1.6, 0.6), 0.05)
