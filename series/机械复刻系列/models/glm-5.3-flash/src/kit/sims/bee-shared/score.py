"""Score for the Mellis HB-7 film: a calm studio bed (soft e-piano chords, no drums) under a
high wing-buzz hum whose amplitude breathes with the on-screen stroke (3 Hz = 150 Hz at the
1/50 slow-motion), a low whoosh as the camera arrives at each beat, a quiet click on every
button the operator presses, a soft pop each time a part separates, a riser into the teardown
impact, a chime when the rebuild settles, and air under the departure climb.

    python run_sfx.py sims/bee-shared/score.py

Every time comes from ../bee-film/timeline.json (beats) — the same file film.js reads — so
sound cannot drift out of sync with the picture.
"""

import math
import os

from sfx.score_kit import airy, bed, chords, hz, motor
from sfx.synth import chime, click, impact, pop, riser, whoosh

TIMELINE = "../bee-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "bee-score.wav")
TARGET_LUFS = -14.0
SEED = 7

CHORDS = chords("Dmaj9:D2 A2 F#3 C#4 E3/A1", "Bm7:B1 F#2 A2 D3 F#3/D0", "Gmaj7:G1 D2 B2 F#3 A3/G0", "A6:A1 E2 C#3 E3 F#3/E0")
# the button presses and the part-separations come straight from the timeline
CLICK_BEATS = ("wing", "drive", "lift", "ballast", "explode", "reassemble", "depart")
POP_BEATS = ("wing", "drive", "ballast")
SCREEN_HZ = 3.0  # 150 Hz at the 1/50 slow-motion — the wing-buzz amplitude breathes at this


def score(mix, tl):
    dur = tl["duration"]
    beats = {k: v for k, v in tl.items() if isinstance(v, (int, float)) and k != "duration"}
    left, right, low, drums = bed(dur, 72, CHORDS, (), motif_voice="blip", kicks=(), snares=(), hats=0, keys_vel=0.5, keys_lp=2500)
    mix.put_stereo(0, left, right, 0.13)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.0)
    # the wing-buzz hum: a small high motor, amplitude swaying with the on-screen stroke
    buzz = motor(dur, f0=296, grit_hz=2600, wobble=0.0)
    for k in range(len(buzz)):
        buzz[k] *= 0.72 + 0.28 * math.sin(2 * math.pi * SCREEN_HZ * (k / 48000.0) - 0.7)
    mix.put(0, buzz, 0.045)
    # the departure breathes a little air under the last chord
    mix.put(tl["depart"] - 0.6, airy(dur - tl["depart"] + 0.4, 400, 1200, 0.7), 0.05)
    # a low whoosh as the camera arrives at each beat, a click on the press
    for i, key in enumerate(CLICK_BEATS):
        t = beats[key]
        if t <= 0:
            continue
        mix.put(max(0.0, t - 0.55), whoosh(0.75, 320 + 40 * i, 950 + 60 * i, peak=0.55), 0.05)
        mix.put(t, click(2100 + 90 * i, 0.03), 0.05)
    # a soft pop as each part separates (the open settles ~0.85 s after the beat)
    for i, key in enumerate(POP_BEATS):
        mix.put(beats[key] + 0.8, pop(340 + 30 * i, 640 + 60 * i, 0.16), 0.07)
    # the teardown: one riser into the impact, the turntable rides a slow low whoosh
    mix.put(tl["explode"] - 1.5, riser(1.5, 240, 4400), 0.05)
    mix.put(tl["explode"], impact(1.1), 0.12)
    mix.put(tl["explode"] + 0.6, whoosh(3.2, 170, 430, peak=0.4), 0.04)
    # the rebuild settles on a chime
    mix.put(tl["reassemble"] + 1.1, chime([hz("D5"), hz("A5")], 1.6, 0.6), 0.05)
