"""Score for the MK-X sandworm film: a low, slow peristaltic bed (the crawl itself), a drill
whirr that rides the wave peaks, a soft click on every button the operator presses, sand-pop
when the tail ejects, a riser into the teardown lift, a chime when the rebuild settles, and
deep air under the final dive.

    python run_sfx.py sims/sandworm-shared/score.py

Every time comes from ../sandworm-film/timeline.json (beats) — the same file film.js reads — so
sound cannot drift out of sync with the picture.
"""

import os

from sfx.score_kit import airy, bed, chords, hz
from sfx.synth import chime, click, impact, pop, riser, whoosh

TIMELINE = "../sandworm-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "sandworm-score.wav")
TARGET_LUFS = -14.0
SEED = 44

CHORDS = chords("Dm9:D1 A1 C2 E2 F2/G0", "Bbmaj7:Bb1 F2 A2 C3 D2/G0", "Fmaj7:F1 C2 E2 G2 A2/C0", "C6:C2 G2 A2 E3 D3/A0")
# the operator presses and the two big machine moments come straight from the timeline
CLICK_BEATS = ("xray", "head", "wave", "map", "explode", "reassemble", "depart")
POP_BEATS = ("head", "explode")


def score(mix, tl):
    dur = tl["duration"]
    beats = {k: v for k, v in tl.items() if isinstance(v, (int, float)) and k != "duration"}
    left, right, low, drums = bed(dur, 58, CHORDS, (), motif_voice="blip", kicks=(), snares=(), hats=0, keys_vel=0.45, keys_lp=2200)
    mix.put_stereo(0, left, right, 0.16)
    mix.put(0, low, 0.12)
    # the dive breathes deep air under the last chord
    mix.put(tl["depart"] - 0.6, airy(dur - tl["depart"] + 0.5, 120, 600, 0.9), 0.06)
    # a low whoosh as the camera arrives at each beat, a click on the press
    for i, key in enumerate(CLICK_BEATS):
        t = beats[key]
        if t <= 0:
            continue
        mix.put(max(0.0, t - 0.55), whoosh(0.75, 180 + 30 * i, 700 + 50 * i, peak=0.5), 0.05)
        mix.put(t, click(1900 + 80 * i, 0.03), 0.05)
    # the maw settles and the teardown lifts: soft pops
    for i, key in enumerate(POP_BEATS):
        mix.put(beats[key] + 0.8, pop(240 + 40 * i, 520 + 60 * i, 0.18), 0.07)
    # the teardown: one riser into the lift, then a slow low whoosh under the turntable
    mix.put(tl["explode"] - 1.5, riser(1.5, 160, 3200), 0.05)
    mix.put(tl["explode"], impact(1.1), 0.11)
    mix.put(tl["explode"] + 0.6, whoosh(3.2, 120, 360, peak=0.4), 0.04)
    # the rebuild settles on a chime
    mix.put(tl["reassemble"] + 1.1, chime([hz("D5"), hz("A5")], 1.6, 0.6), 0.05)
