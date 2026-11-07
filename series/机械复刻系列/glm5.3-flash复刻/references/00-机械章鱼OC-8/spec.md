# Pelagos OC-8 — build spec (read from the reference frames)

Source: frames at 00:08 (MANTLE OPEN) and 00:16 (BEAK OPEN) of the 0x_fokki video,
plus the mantle close-up (`oct8.png`). Every number is marked: "frame" (read off the
image) or "guess" (my estimate — no manual exists for this machine).

## 1. Parts list

| group | count | shape (from the frames) | material |
|---|---|---|---|
| mantle shell | 1 + 8 petals | tall dome, upper ring of 8 white armour petals that hinge OPEN outward; lower half a glossy dark bowl; riveted white plates; orange strip accents | white armour / gloss black |
| brain core (inside mantle) | 1 | sphere of tangled black cables with small orange clips, sits in the dark bowl | matte black cables |
| glass port | 1 | round porthole low on the front of the mantle, dark glass with an orange rim ring and inner gear/spoke detail | glass + orange ring |
| optic units | 2 | big camera lenses on the head, dark barrels, orange rim rings, glass fronts | white barrel + glass |
| arms | 8 | each arm a chain of segments: white armour plates over a dark core, orange roller wheels visible on both flanks, tips curl into spirals; arms attach around the centre hub | white armour + orange wheels |
| siphon | 1 | funnel/sleeve assembly under the rear of the mantle (3 sleeves per the console), 6-flap nozzle | white + dark |
| beak | 1 | under the centre between the arm roots: dark twin jaws around an orange radula ring/gear, closes like a camera shutter | gloss black + orange |
| hub ring | 1 | the centre the arms mount to, layered white rings with rivets | white armour |

Console facts (subsystems panel, read from frame 8s/16s):
- OPTIC ARRAY — 2 × 82 mm lens · IR rim → TRACKING
- MANTLE SHELL — 8 petals · glass port → SEALED / OPEN
- PUMP CORE — reactor ring · 7 pistons → RUNNING / EXPANDED
- ARM CHAINS — 202 links · 480 wheels → 8/8 LIVE
- SIPHON — 3 sleeves · 6-flap nozzle → IDLE
- BEAK — twin jaw · radula ring → SEALED / OPEN

## 2. The ONE input

Jet phase p ∈ [0,1): one mantle pulse every 1/1.8 s ≈ 0.556 s (frame: JET panel
shows a pulse chart; pulse rate is the machine's heartbeat).

- mantle pressure = f(p): one 93 kPa peak per pulse → thrust = 2·ΔP·A ≈ 211 N peak
  (nozzle 38 mm → A ≈ 1.134e-3 m²).
- mantle petals: part open with the pulse (breathing), fully OPEN only in the
  mantle-open beat of the tour.
- arms: each arm curls by the same wave, adjacent arms offset by 1/8 of the pulse
  (frame: ARM CURL panel shows R1..R4/L1..L4 all near 100% while curled, tip spiral).
- siphon: nozzle flaps open on the exhaust part of the pulse.
- everything else (head, optics, beak) is static relative to the mantle.

## 3. Dimensions (mm)

| part | value | source |
|---|---|---|
| mantle length | 420 | guess (doc example value) |
| mantle diameter | 300 | guess (doc example value) |
| shell petals | 8, each hinging open ~70° | frame (8 petals) + guess (angle) |
| glass port diameter | 120 | guess from proportion |
| optic lens diameter | 82 | frame (console says 82 mm lens) |
| arm length | 25 links × 40 mm = 1000 | guess (doc example; console says 202 links total ≈ 25/arm ✓) |
| arm link size | 40 mm long, ~34 mm wide segment | guess |
| arm wheels | 480/8 = 60 per arm → ~2-3 per link | frame (orange wheels on both flanks) |
| arm max joint bend | 12° per joint → 300° full curl | guess (doc example) |
| siphon nozzle | 38 mm diameter, 6 flaps, 3 sleeves | guess (console: 3 sleeves · 6-flap nozzle) |
| beak | twin jaw, radula ring ~90 mm | guess from proportion |
| peak pressure | 93 kPa | frame (JET panel peaks; doc's hand-check) |
| peak thrust | 211 N | frame + T = 2·ΔP·A hand-check |
| pulse rate | 1.8 Hz → one pulse 0.556 s | guess (doc example) |
| battery 84-86%, draw 16-21 W, cell 3.72 V, motor 25-27 °C | frame (POWER panel) |
| depth ~12.3 m, v/s +0.06..0.09 m/s, speed 0.08-0.12 m/s | frame (DEPTH panel) |

Hand-check (thrust): A = π·(0.019)² = 1.134e-3 m²; T = 2·ΔP·A = 2·93000·1.134e-3 ≈ 211 N. ✓

## 4. Camera

- Hero: 3/4 view from slightly above, arms spread in all directions — a face-on
  view would collapse the 8 arms into a fence. Machine fills 60-70%.
- Hidden behind the hero view: the beak under the centre, the siphon at the rear,
  the brain core inside the mantle.
- Close-ups used by the tour: optics (front), mantle (upper, petals opening),
  arm R2 (along one arm), siphon (rear), beak (underneath).

## 5. What opens (the tour beats)

- optics: head lenses rack focus, IR rim lights up (isolate).
- mantle: the 8 petals hinge open ~70°, brain core rises and turns (MANTLE OPEN, 70% apart at 8 s).
- siphon: 3 sleeves extend telescopically, 6 nozzle flaps spread (SIPHON IDLE in frames, but opens in its beat).
- arm R2: one arm uncurls apart from the body, links fan out (ARM R2).
- beak: twin jaws split ~50% apart, radula ring spins (BEAK OPEN, 50% apart at 16 s).
- at 0:16-0:20 of the film: whole machine explodes apart, turntable ~330°, reassembles.
