#!/usr/bin/env python3
"""Original deterministic sound design; no film or music samples."""
from array import array
import math
import random
import wave
from pathlib import Path

RATE = 48000
DURATION = 20.0
random.seed(127)
out = Path(__file__).resolve().parents[1] / "artifacts"
if not out.exists():
    out.mkdir(parents=True)
samples = array("h")
phase = 0.0
for i in range(int(RATE * DURATION)):
    t = i / RATE
    # Low studio/vehicle bed, restrained to leave transients readable.
    engine_env = max(0.0, 1.0 - t / 3.2) if t < 3.2 else 0.0
    engine = engine_env * (0.12 * math.sin(2 * math.pi * (52 + 4 * math.sin(t * 2)) * t) + 0.04 * math.sin(2 * math.pi * 104 * t))
    hum = 0.018 * math.sin(2 * math.pi * 38 * t) + 0.008 * math.sin(2 * math.pi * 76 * t)
    servo = 0.0
    if 3.0 <= t <= 9.0:
        env = math.sin(math.pi * (t - 3.0) / 6.0) ** 0.6
        freq = 150 + 90 * math.sin((t - 3.0) * 2.1)
        phase += 2 * math.pi * freq / RATE
        servo = env * (0.075 * math.sin(phase) + 0.032 * math.sin(phase * 2.03) + 0.018 * (random.random() * 2 - 1))
    # Original synthesized metal lock transients at assembly events.
    metal = 0.0
    for cue, strength in [(3.0, .25), (5.8, .15), (9.0, .4), (15.0, .18), (19.55, .3)]:
        dt = t - cue
        if 0 <= dt < 0.65:
            env = math.exp(-dt * 8.5) * strength
            metal += env * (0.2 * math.sin(2 * math.pi * 92 * dt) + 0.08 * math.sin(2 * math.pi * 437 * dt) + 0.05 * math.sin(2 * math.pi * 913 * dt))
            metal += env * 0.08 * (random.random() * 2 - 1)
    # Gentle stereo width from a short delayed harmonic, not an external asset.
    left = max(-0.95, min(0.95, engine + hum + servo + metal))
    right = max(-0.95, min(0.95, engine * .96 + hum + servo * .88 + metal * .92 + .006 * math.sin(2 * math.pi * 57 * t)))
    samples.extend((int(left * 32767), int(right * 32767)))
path = out / "大黄蜂-原创音轨.wav"
with wave.open(str(path), "wb") as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(samples.tobytes())
print(path)
