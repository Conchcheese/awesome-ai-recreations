// The Pelagos OC-8 robotic cephalopod, the math. Real units (metres, Pa, N), ONE input:
// the jet phase p ∈ [0,1) — one full mantle pulse every 1/1.8 s. Every pose angle and every
// readout on the console is a pure function of p (plus the tour's slow mode inputs, the way
// the Cessna's stroke rides under its flight phases). No three.js in this file.
//
// Parameter table (name, value, unit, source) — also in ../ref/spec.md:
//   PULSE_HZ        1.8       Hz    guess (the machine's heartbeat, doc example value)
//   PEAK_KPA        93        kPa   frame (JET panel peak, doc's hand-check)
//   NOZZLE_D        0.038     m     guess  → A = π·0.019² = 1.134e-3 m², thrust peak 2·ΔP·A ≈ 211 N (frame)
//   MANTLE_LEN      0.42      m     guess (doc example)
//   MANTLE_DIA      0.30      m     guess (doc example)
//   PETALS          8         -     frame (8 shell petals hinge open)
//   PETAL_OPEN      55        deg   guess (petal hinge at full open — a tulip splay, not flat)
//   LINKS           25/arm    -     frame (console: 202 links total = 8×25 arm links + 2 beak jaw links)
//   LINK_LEN        0.040     m     guess (1.0 m arm)
//   JOINT_MAX       12.5      deg   guess (per-joint bend cap; tips stay beside the dome instead of crossing over it)
//   WHEELS_PER_ARM  60        -     frame (480 wheels / 8 arms: 2 per joint + root and tip clusters)
//   OPTIC_D         0.082     m     frame (console: 2 × 82 mm lens)
//   SIPHON_SLEEVES  3         -     frame (console: 3 sleeves)
//   NOZZLE_FLAPS    6         -     frame (console: 6-flap nozzle)

const D2R = Math.PI / 180;

export const G = {
  PULSE_HZ: 1.8,
  PEAK_KPA: 93,
  NOZZLE_D: 0.038,
  MANTLE_LEN: 0.42,
  MANTLE_DIA: 0.3,
  PETALS: 8,
  PETAL_OPEN: 55 * D2R,
  ARMS: 8,
  LINKS: 25,
  LINK_LEN: 0.04,
  JOINT_MAX: 14 * D2R,
  WHEELS_PER_ARM: 60,
  OPTIC_D: 0.082,
  SIPHON_SLEEVES: 3,
  NOZZLE_FLAPS: 6,
  // arm root: where the chain starts, and its first heading (outward, barely pitched down —
  // the curl does the shaping, so the arms arc out and spiral up instead of hanging)
  HUB_R: 0.165,
  HUB_Y: -0.04,
  ARM_PITCH0: -0.3, // rad below horizontal
};

export const LINKS_TOTAL = G.ARMS * G.LINKS + 2; // 202, the beak's twin jaws carry the last two
export const WHEELS_TOTAL = G.ARMS * G.WHEELS_PER_ARM; // 480
export const NOZZLE_A = Math.PI * (G.NOZZLE_D / 2) ** 2; // 1.134e-3 m²
export const THRUST_PEAK = 2 * G.PEAK_KPA * 1000 * NOZZLE_A; // ≈ 211 N

export const frac = (x) => x - Math.floor(x);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

// ------------------------------------------------------------ the pulse
/** exhaust bump: one gaussian per pulse, peak at p = 0.42 */
export const pulse = (p) => Math.exp(-0.5 * ((frac(p) - 0.42) / 0.13) ** 2);
/** nozzle flaps: open onto the exhaust, closed the rest of the pulse */
export const flap = (p) => ss(0.3, 0.42, p) * (1 - ss(0.55, 0.78, p));

export const pressureKPa = (p) => G.PEAK_KPA * pulse(p);
/** T = 2·ΔP·A with the flaps throttling the jet */
export const thrustN = (p) => 2 * pressureKPa(p) * 1000 * NOZZLE_A * flap(p);
/** cruise over the ground (the DEPTH panel's SPEED) */
export const speed = (p) => 0.075 + 0.12 * pulse(p);

// ------------------------------------------------------------ mantle
/** the mantle squeezes and stretches a little on every pulse */
export const mantleBreath = (p) => {
  const s = pulse(p);
  return {r: 1 - 0.055 * s, len: 1 + 0.045 * s};
};
/** petal hinge angle: the tour's open amount, but the petals always breathe with the pulse */
export const petalAngle = (p, open) => {
  const breath = 0.05 + 0.1 * pulse(frac(p + 0.72));
  return G.PETAL_OPEN * Math.max(open, breath);
};

// ------------------------------------------------------------ arms
/**
 * Arm i's curl command 0..1: a steady grip with the jet wave rolling around the eight arms,
 * each offset by 1/8 of the pulse. apart = {arm, k}: the isolated arm uncurls to 10%.
 * yield 0..1: the whole ring relaxes and droops aside while another assembly opens
 * (the way the article puts it: the rest of the body yields).
 */
export const armCmd = (i, p, apart, yieldK = 0) => {
  const grip = (0.74 + 0.24 * pulse(frac(p + i / G.ARMS))) * (1 - 0.48 * yieldK);
  if (apart && apart.arm === i) return grip + (0.1 - grip) * apart.k;
  return grip;
};
/** curl percent of the arm's design curl, for the panel bars */
export const armCurlPct = (cmd) => cmd * 100;

/** per-joint bend envelope: the first links run nearly straight out-and-down, then the bend
 * piles up toward the tip so the arm sweeps out before it coils (like the reference) */
export const bendEnvelope = (j) => 0.05 + 0.95 * Math.pow(Math.max(0, (j - 3) / (G.LINKS - 4)), 1.35);

/**
 * One arm's chain in the arm's vertical plane. az = the arm's azimuth. Fills the out arrays:
 * pts (LINKS+1 joint positions xyz), pitch (LINKS+1 heading angles in-plane), and returns the
 * tip pitch. Pure, no allocation inside the loop.
 */
export function armChain(az, cmd, pts, pitch) {
  const rh = {x: Math.cos(az), z: Math.sin(az)}; // radial horizontal
  let x = rh.x * G.HUB_R;
  let y = G.HUB_Y;
  let z = rh.z * G.HUB_R;
  let th = G.ARM_PITCH0;
  pts[0] = x;
  pts[1] = y;
  pts[2] = z;
  pitch[0] = th;
  for (let j = 0; j < G.LINKS; j++) {
    th += G.JOINT_MAX * bendEnvelope(j) * cmd;
    const cp = Math.cos(th);
    x += rh.x * cp * G.LINK_LEN;
    y += Math.sin(th) * G.LINK_LEN;
    z += rh.z * cp * G.LINK_LEN;
    const k = (j + 1) * 3;
    pts[k] = x;
    pts[k + 1] = y;
    pts[k + 2] = z;
    pitch[j + 1] = th;
  }
  return th;
}

// ------------------------------------------------------------ optics, siphon, beak
/** the optics rack focus and open their IR rim with the pulse */
export const opticState = (p) => ({focus: 0.3 + 0.14 * Math.sin(p * Math.PI * 2), ir: 0.25 + 0.75 * pulse(p)});
/** the siphon's three sleeves extend onto the exhaust, the 6 nozzle flaps spread with the flap */
export const siphonState = (p, open) => {
  const f = flap(p);
  return {extend: Math.max(open, 0.12 + 0.3 * f), spread: Math.max(open, f)};
};
/** the beak's twin jaws part on the bite of the pulse; the radula ring spins with the jet */
export const beakState = (p, open) => ({jaw: Math.max(open, 0.06 + 0.14 * pulse(p)), radula: p * Math.PI * 2 * 4});
