"""Score for the Pelagos OC-8 film: a calm underwater bed (soft e-piano chords, no drums), a low
whoosh as the camera arrives at each assembly, a quiet click on every button the operator
presses, a soft pop each time a part separates, a riser into the teardown impact, a chime when
the rebuild settles, and air under the departure.

    python run_sfx.py sims/octopus-shared/score.py

Every time comes from ../octopus-film/timeline.json (beats) — the same file film.js reads — so
sound cannot drift out of sync with the picture.
"""

import os

from sfx.score_kit import airy, bed, chords, hz
from sfx.synth import chime, click, impact, pop, riser, whoosh

TIMELINE = "../octopus-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "octopus-score.wav")
TARGET_LUFS = -14.0
SEED = 31

CHORDS = chords("Am9:A1 E2 G2 B2 C3/E1", "Fmaj7:F1 C2 E2 A2 B2/C1", "Cmaj7:C2 G2 B2 D3 E2/G0", "G6:G1 D2 E2 B2 D3/A0")
# the button presses and the part-separations come straight from the timeline
CLICK_BEATS = ("optics", "mantle", "siphon", "arm", "beak", "explode", "reassemble", "depart")
POP_BEATS = ("mantle", "siphon", "arm", "beak")


def score(mix, tl):
    dur = tl["duration"]
    beats = {k: v for k, v in tl.items() if isinstance(v, (int, float)) and k != "duration"}
    left, right, low, drums = bed(dur, 76, CHORDS, (), motif_voice="blip", kicks=(), snares=(), hats=0, keys_vel=0.55, keys_lp=2600)
    mix.put_stereo(0, left, right, 0.14)
    mix.put(0, low, 0.1)
    mix.put(0, drums, 0.0)
    # the departure breathes a little air under the last chord
    mix.put(tl["depart"] - 0.8, airy(dur - tl["depart"] + 0.4, 300, 900, 0.7), 0.05)
    # a low whoosh as the camera arrives at each assembly, a click on the press
    for i, key in enumerate(CLICK_BEATS):
        t = beats[key]
        if t <= 0:
            continue
        mix.put(max(0.0, t - 0.55), whoosh(0.75, 300 + 40 * i, 900 + 60 * i, peak=0.55), 0.05)
        mix.put(t, click(2100 + 90 * i, 0.03), 0.05)
    # a soft pop as each part separates (the open settles ~0.85 s after the beat)
    for i, key in enumerate(POP_BEATS):
        mix.put(beats[key] + 0.8, pop(320 + 30 * i, 620 + 60 * i, 0.16), 0.07)
    # the teardown: one riser into the impact, the turntable rides a slow low whoosh
    mix.put(tl["explode"] - 1.5, riser(1.5, 220, 4200), 0.05)
    mix.put(tl["explode"], impact(1.1), 0.12)
    mix.put(tl["explode"] + 0.6, whoosh(3.2, 160, 420, peak=0.4), 0.04)
    # the rebuild settles on a chime
    mix.put(tl["reassemble"] + 1.1, chime([hz("E5"), hz("B5")], 1.6, 0.6), 0.05)
