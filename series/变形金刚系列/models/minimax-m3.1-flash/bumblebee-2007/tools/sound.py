#!/usr/bin/env python3
"""Original mechanical sound design for the Bumblebee short film.

Everything is synthesised from scratch: no film samples, no music, no third
party audio. The cues follow the shot list (see src/shots.mjs):

  0.0-3.5 s  vehicle bed: engine order harmonics, tyre roll, wind
  3.5-4.2 s  unlock: latch clicks and a short body creak
  4.2-9.5 s  transformation: servo sweep, sliding panels, metal impacts
  9.5-12.0 s lock: heavy clamp, hydraulic settle, servo stop
  12.0-20.0 s idle: low hum with faint servo ticks

Run:  python3 tools/sound.py [--out artifacts/film.wav]
"""

import argparse
import math
import random
import struct
import wave
from array import array
from pathlib import Path

RATE = 48000
DURATION = 20.0


def env_exp(t, attack, decay, start=0.0):
    """Percussive envelope: fast attack, exponential decay."""
    if t < start:
        return 0.0
    x = t - start
    a = min(1.0, x / max(1e-4, attack))
    return a * math.exp(-x / max(1e-4, decay))


def metal_hit(t, start, strength, base=180.0, bright=1400.0, decay=0.22):
    """A struck-metal transient: a few inharmonic partials with a noise tick."""
    x = t - start
    if x < 0 or x > decay * 4:
        return 0.0
    e = math.exp(-x / decay)
    out = 0.0
    for k, (f, g) in enumerate(((base, 1.0), (base * 2.41, 0.55), (base * 3.83, 0.3),
                                (bright, 0.22), (bright * 1.61, 0.12))):
        out += g * math.sin(2 * math.pi * f * x + k) * e
    out += 0.35 * (random.random() * 2 - 1) * math.exp(-x / (decay * 0.18))
    return strength * out * 0.22


def servo(t, start, end, f0=140.0, f1=320.0, amp=0.10):
    """Frequency swept servo whine with a tremolo, gated by a window."""
    if t < start or t > end:
        return 0.0
    u = (t - start) / max(1e-4, end - start)
    f = f0 + (f1 - f0) * u
    phase = 2 * math.pi * f * (t - start)
    gate = math.sin(math.pi * min(1.0, u * 1.05)) ** 0.7
    return amp * gate * (math.sin(phase) + 0.35 * math.sin(phase * 2.03))


def build(out_path: Path):
    random.seed(20261108)
    total = int(RATE * DURATION)
    left = array('f', bytes(4 * total))
    right = array('f', bytes(4 * total))

    # --- vehicle bed ------------------------------------------------------
    # Engine: stacked harmonics with a slow idle wobble.
    phase = 0.0
    for i in range(total):
        t = i / RATE
        engine = 0.0
        if t < 4.6:
            fade = 1.0 if t < 3.4 else max(0.0, 1.0 - (t - 3.4) / 1.2)
            wobble = 1.0 + 0.06 * math.sin(2 * math.pi * 1.7 * t)
            f = 46.0 * wobble
            phase += 2 * math.pi * f / RATE
            engine = fade * (0.10 * math.sin(phase)
                             + 0.045 * math.sin(phase * 2.0 + 0.4)
                             + 0.022 * math.sin(phase * 3.0 + 1.1))
            # tyre / road roll
            engine += fade * 0.02 * (random.random() * 2 - 1)
            engine += fade * 0.012 * math.sin(2 * math.pi * 210 * t)

        # --- transformation machinery ------------------------------------
        mech = 0.0
        mech += servo(t, 4.15, 7.60, 130.0, 330.0, 0.085)
        mech += servo(t, 5.30, 8.40, 90.0, 210.0, 0.045)
        # panel slide: filtered noise swell while the panels travel
        if 4.2 <= t <= 9.4:
            u = (t - 4.2) / 5.2
            slide = math.sin(math.pi * u) ** 2
            mech += 0.030 * slide * (random.random() * 2 - 1)
        # unlock clicks
        for cue, strength in ((3.55, 0.30), (3.78, 0.22), (4.05, 0.26), (4.18, 0.18)):
            mech += metal_hit(t, cue, strength, base=520.0, bright=2600.0, decay=0.09)
        # transformation impacts
        for cue, strength, base in ((4.9, 0.30, 210.0), (5.6, 0.24, 260.0), (6.4, 0.34, 190.0),
                                    (7.2, 0.26, 240.0), (8.1, 0.38, 170.0), (8.9, 0.30, 220.0)):
            mech += metal_hit(t, cue, strength, base=base, bright=1500.0, decay=0.26)
        # lock down
        mech += metal_hit(t, 9.55, 0.55, base=95.0, bright=900.0, decay=0.5)
        mech += metal_hit(t, 9.85, 0.30, base=140.0, bright=1200.0, decay=0.3)
        # hydraulic settle after the lock
        if 9.8 <= t <= 10.6:
            x = t - 9.8
            mech += 0.05 * math.exp(-x / 0.22) * math.sin(2 * math.pi * (300 - 120 * x / 0.8) * x)

        # --- idle --------------------------------------------------------
        idle = 0.0
        if t > 10.2:
            u = min(1.0, (t - 10.2) / 1.2)
            idle = u * (0.020 * math.sin(2 * math.pi * 41.0 * t)
                        + 0.010 * math.sin(2 * math.pi * 82.0 * t + 0.3))
            # faint servo ticks so the idle is not a dead tone
            tick = (t * 2.0) % 1.0
            if tick < 0.02:
                idle += 0.012 * math.exp(-tick / 0.006) * (random.random() * 2 - 1)

        # --- body resonance: the studio floor gives the low end some weight
        body = 0.0
        if t < 9.9:
            body = 0.030 * math.sin(2 * math.pi * 31.0 * t) * (1.0 if t < 3.4 else max(0.0, 1.0 - (t - 3.4) / 6.5))

        l = engine + mech + idle + body
        # a touch of stereo width on the machinery
        r = engine * 0.96 + mech * 0.94 + idle + body

        # soft limiter
        l = max(-0.95, min(0.95, l * 0.9))
        r = max(-0.95, min(0.95, r * 0.9))
        left[i] = l
        right[i] = r

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = bytearray(total * 4)
        for i in range(total):
            struct.pack_into('<hh', frames, i * 4,
                             int(max(-1.0, min(1.0, left[i])) * 32767),
                             int(max(-1.0, min(1.0, right[i])) * 32767))
        w.writeframes(bytes(frames))
    return out_path


def main():
    root = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out', default=str(root / 'artifacts' / 'film.wav'))
    args = ap.parse_args()
    path = build(Path(args.out))
    print(path)


if __name__ == '__main__':
    main()
