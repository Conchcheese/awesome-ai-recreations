// check.mjs — asserts the model's numbers the way the doc asks: run with `node sims/octopus-shared/check.mjs`.
import {
  G, LINKS_TOTAL, WHEELS_TOTAL, NOZZLE_A, THRUST_PEAK,
  pulse, flap, pressureKPa, thrustN, speed, mantleBreath, petalAngle,
  armCmd, armCurlPct, bendEnvelope, armChain, opticState, siphonState, beakState,
} from './model.js';

let fails = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails++;
};

// ------------------------------------------------------------ hand-check, shown
console.log('hand-check: nozzle area and peak thrust');
console.log(`  A = π·(0.038/2)² = ${NOZZLE_A.toExponential(4)} m²`);
console.log(`  T = 2·ΔP·A = 2·${G.PEAK_KPA}e3·${NOZZLE_A.toExponential(4)} = ${THRUST_PEAK.toFixed(1)} N  (video panel peak: 211 N)`);

// 1. thrust at the pressure peak is within 1 N of 211 N
const pPeak = 0.42;
ok(Math.abs(pulse(pPeak) - 1) < 1e-9, 'pulse peaks at p = 0.42');
ok(Math.abs(pressureKPa(pPeak) - G.PEAK_KPA) < 1e-9, `pressure peak = ${G.PEAK_KPA} kPa`, pressureKPa(pPeak).toFixed(2));
const fl = flap(pPeak);
ok(Math.abs(fl - 1) < 1e-6, 'nozzle flaps fully open at the pulse peak', fl.toFixed(4));
ok(Math.abs(thrustN(pPeak) - 211) <= 1, 'thrust at the pressure peak within 1 N of 211 N', thrustN(pPeak).toFixed(2) + ' N');

// thrust/throttle consistency: 24 kPa with the flaps barely open reads ~6 N like the video's idle panel
{
  // find p where pressure ≈ 24 kPa on the pulse's decay side
  let p = 0.5;
  for (let i = 0; i < 400; i++) {
    p += 0.0005;
    if (pressureKPa(p) <= 24) break;
  }
  const t = thrustN(p);
  ok(t > 1 && t < 40, 'idle-bleed thrust stays single/low-double-digit N', `${pressureKPa(p).toFixed(1)} kPa → ${t.toFixed(1)} N at p=${p.toFixed(3)}`);
}

// 2. arm 3's curl is arm 2's curl shifted by 1/8 of the pulse
{
  let worst = 0;
  for (let i = 0; i < 40; i++) {
    const p = i / 40;
    const a2 = armCurlPct(armCmd(2, p + 1 / G.ARMS, null));
    const a3 = armCurlPct(armCmd(3, p, null));
    worst = Math.max(worst, Math.abs(a2 - a3));
  }
  ok(worst < 1e-9, 'arm 3 curl = arm 2 curl shifted 1/8 pulse', `worst Δ ${worst.toExponential(2)} %`);
}

// 3. every joint angle stays within its cap, and the chain stays off the mantle
{
  const pts = new Float64Array((G.LINKS + 1) * 3);
  const pitch = new Float64Array(G.LINKS + 1);
  let maxBend = 0;
  let minR = 9;
  for (const az of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
    for (const cmd of [0, 0.5, 1]) {
      armChain(az, cmd, pts, pitch);
      for (let j = 0; j < G.LINKS; j++) {
        const bend = (pitch[j + 1] - pitch[j]) / cmd || 0;
        maxBend = Math.max(maxBend, cmd > 0 ? Math.abs(pitch[j + 1] - pitch[j]) : 0);
      }
      for (let j = 1; j <= G.LINKS; j++) {
        const r = Math.hypot(pts[j * 3], pts[j * 3 + 2]);
        minR = Math.min(minR, r);
      }
    }
  }
  ok(maxBend <= G.JOINT_MAX + 1e-12, 'every joint bend ≤ JOINT_MAX', `${((maxBend * 180) / Math.PI).toFixed(2)}° ≤ ${((G.JOINT_MAX * 180) / Math.PI)}°`);
  ok(minR > G.HUB_R * 0.5, 'arm chain never doubles back under the hub', `min radius ${minR.toFixed(3)} m`);
  const tipPitch = (() => {
    armChain(0, 1, pts, pitch);
    return pitch[G.LINKS];
  })();
  ok(tipPitch > Math.PI / 2 && tipPitch < Math.PI * 1.25, 'full curl leaves the tip curling up and over (a spiral)', `${((tipPitch * 180) / Math.PI).toFixed(0)}°`);
}

// 4. readout ranges the panels promise
{
  let sMin = 9, sMax = 0, tMax = 0;
  for (let i = 0; i < 720; i++) {
    const p = i / 720;
    sMin = Math.min(sMin, speed(p));
    sMax = Math.max(sMax, speed(p));
    tMax = Math.max(tMax, thrustN(p));
  }
  ok(sMin > 0.05 && sMax < 0.25, 'speed stays in the 0.05–0.25 m/s band', `${sMin.toFixed(3)}–${sMax.toFixed(3)} m/s`);
  ok(Math.abs(tMax - THRUST_PEAK) < 0.5, 'thrust max equals the hand-checked peak', tMax.toFixed(1));
}
{
  const b = mantleBreath(pPeak);
  ok(b.r > 0.9 && b.r < 1 && b.len > 1 && b.len < 1.1, 'mantle breaths inward and longens on the pulse', `r ${b.r.toFixed(3)}, len ${b.len.toFixed(3)}`);
  ok(petalAngle(0.3, 0) > 0 && petalAngle(0.3, 0) < G.PETAL_OPEN * 0.3, 'petals breathe a little even sealed', `${((petalAngle(0.3, 0) * 180) / Math.PI).toFixed(1)}°`);
  ok(Math.abs(petalAngle(0.3, 1) - G.PETAL_OPEN) < 1e-9, `petals reach ${G.PETAL_OPEN * 180 / Math.PI}° when open`);
}
{
  const o = opticState(pPeak), s = siphonState(pPeak, 0), bk = beakState(pPeak, 0);
  ok(o.ir > 0.9, 'IR rim lights on the pulse', o.ir.toFixed(2));
  ok(s.extend > 0.3 && s.spread > 0.3, 'siphon sleeves extend and flaps spread on the exhaust', `ext ${s.extend.toFixed(2)}, spr ${s.spread.toFixed(2)}`);
  ok(bk.jaw > 0.15 && bk.jaw < 0.25, 'beak parts a little on the bite when sealed', bk.jaw.toFixed(3));
  ok(LINKS_TOTAL === 202, '202 links total (console claim)', String(LINKS_TOTAL));
  ok(WHEELS_TOTAL === 480, '480 wheels total (console claim)', String(WHEELS_TOTAL));
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
