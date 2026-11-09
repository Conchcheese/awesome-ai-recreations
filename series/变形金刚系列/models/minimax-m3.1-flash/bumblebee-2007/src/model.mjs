// Bumblebee (Transformers 2007) - model definition.
//
// Every part is authored once and carries two endpoint poses: the Camaro
// stance and the robot stance. The rig interpolates between them, so identity
// and scale stay continuous through the whole transformation.
//
// Allowed original references (see references/sources.json):
//   - TOMY MPM-3 official product photography, vehicle and figure views.
// No film frames were used, therefore every internal mechanism, joint range
// and dimension that is not readable on those two photographs is declared
// inferred or designed, never observed.
//
// Coordinate system: +X forward (car nose / robot chest), +Y up, +Z to the
// robot's left. Ground plane is y = 0.
//
// Convention: a panel's geometry is expressed relative to its own pivot, and
// the pivot is also the assembly's vehicle pose. Rows below are written in
// absolute car coordinates and shifted by `base` when the mesh is built, so a
// row of 0.96 m really is 0.96 m from the car's origin.

import { Q, M, V } from './math.mjs';
import {
  box, chamferBox, cylinder, revolve, tube, extrude, loftSurface, loftShell,
  merge, transformGeometry, finalize, orientOutward, bounds, translate, rotate,
} from './geometry.mjs';

const D = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */

export const MATERIALS = {
  // Car paint keeps a low metalness on purpose: without a bright HDRI a
  // fully metallic paint reads as dull olive instead of yellow.
  'paint.yellow': { baseColor: [0.93, 0.56, 0.03], metallic: 0.25, roughness: 0.30, emissive: [0, 0, 0], emissiveStrength: 0 },
  'paint.black': { baseColor: [0.045, 0.046, 0.050], metallic: 0.20, roughness: 0.44, emissive: [0, 0, 0], emissiveStrength: 0 },
  'paint.blackFlat': { baseColor: [0.030, 0.030, 0.033], metallic: 0.10, roughness: 0.62, emissive: [0, 0, 0], emissiveStrength: 0 },
  'metal.chrome': { baseColor: [0.88, 0.89, 0.91], metallic: 0.95, roughness: 0.15, emissive: [0, 0, 0], emissiveStrength: 0 },
  'metal.gun': { baseColor: [0.20, 0.21, 0.23], metallic: 0.70, roughness: 0.38, emissive: [0, 0, 0], emissiveStrength: 0 },
  'metal.dark': { baseColor: [0.095, 0.098, 0.108], metallic: 0.60, roughness: 0.50, emissive: [0, 0, 0], emissiveStrength: 0 },
  'rubber.tire': { baseColor: [0.032, 0.032, 0.035], metallic: 0.0, roughness: 0.86, emissive: [0, 0, 0], emissiveStrength: 0 },
  'glass.tint': { baseColor: [0.11, 0.14, 0.18], metallic: 0.20, roughness: 0.12, emissive: [0, 0, 0], emissiveStrength: 0 },
  'light.head': { baseColor: [0.80, 0.83, 0.90], metallic: 0.10, roughness: 0.06, emissive: [1.0, 0.94, 0.80], emissiveStrength: 0.55 },
  'light.tail': { baseColor: [0.55, 0.05, 0.05], metallic: 0.10, roughness: 0.12, emissive: [1.0, 0.12, 0.06], emissiveStrength: 0.5 },
  'light.eye': { baseColor: [0.20, 0.55, 0.95], metallic: 0.05, roughness: 0.05, emissive: [0.20, 0.60, 1.0], emissiveStrength: 5.0 },
};

/* ------------------------------------------------------------------ */
/* vehicle layout constants                                            */
/* ------------------------------------------------------------------ */

export const CAR = {
  frontX: 2.36,
  rearX: -2.36,
  halfW: 0.93,
  beltY: 1.00,
  sillY: 0.27,
  wheel: { r: 0.352, w: 0.255, frontX: 1.40, rearX: -1.36, z: 0.79 },
};

/* ------------------------------------------------------------------ */
/* small geometry helpers                                              */
/* ------------------------------------------------------------------ */

function sectionProfile(w, yTop, yBot, rTop = 0.10, rBot = 0.09, seg = 3) {
  const pts = [];
  const arc = (cy, cz, r, a0, a1, steps) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      pts.push([cy + Math.sin(a) * r, cz + Math.cos(a) * r]);
    }
  };
  const rr = Math.min(rTop, (yTop - yBot) * 0.4);
  const rb = Math.min(rBot, (yTop - yBot) * 0.4);
  const rw = Math.min(rr, w * 0.5);
  const rwB = Math.min(rb, w * 0.5);
  arc(yBot + rwB, w - rwB, rwB, -90 * D, 0, seg);
  arc(yTop - rw, w - rw, rw, 0, 90 * D, seg);
  arc(yTop - rw, -(w - rw), rw, 90 * D, 180 * D, seg);
  arc(yBot + rwB, -(w - rwB), rwB, 180 * D, 270 * D, seg);
  return pts;
}

const shift = (g, base) => (base ? translate(g, [-base[0], -base[1], -base[2]]) : g);

// Top skin panel (hood, roof, deck lid): a gently crowned surface with a
// slight edge drop, built as a thin shell.
function topPanel(stations, { thickness = 0.035, drop = 0.07, base = null } = {}) {
  const st = stations.map((s) => {
    const w = s.halfW;
    const pts = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const z = -w + 2 * w * t;
      const edge = Math.min(1, Math.min(t, 1 - t) * 6);
      const crown = s.crown || 0;
      const y = s.y + crown * (1 - Math.pow(z / w, 2)) - drop * (1 - edge);
      pts.push([y, z]);
    }
    return { x: s.x, pts };
  });
  const g = loftShell(st, thickness, { ref: (s) => [s.y - 0.4, 0] });
  return shift(g, base);
}

// Side skin panel (door, fender, quarter, rocker).
function sidePanel(stations, { thickness = 0.03, side = 1, tumble = 0.05, base = null } = {}) {
  const st = stations.map((s) => {
    const yTop = s.yTop, yBot = s.yBot, w = s.halfW;
    const pts = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = yTop + (yBot - yTop) * t;
      const bulge = 1 - tumble * t * t;
      pts.push([y, side * w * bulge]);
    }
    return { x: s.x, pts };
  });
  const g = loftShell(st, thickness, { ref: (s) => [(s.yTop + s.yBot) / 2, 0] });
  return shift(g, base);
}

function stripePanel(stations, { zc, halfZ, lift = 0.008, thickness = 0.008, base = null } = {}) {
  const st = stations.map((s) => {
    const pts = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const z = zc - halfZ + 2 * halfZ * t;
      const crown = s.crown || 0;
      const y = s.y + crown * (1 - Math.pow(z / s.halfW, 2)) + lift;
      pts.push([y, z]);
    }
    return { x: s.x, pts };
  });
  const g = loftShell(st, thickness, { ref: (s) => [s.y - 0.4, 0] });
  return shift(g, base);
}

function wheelMeshes() {
  const { r, w } = CAR.wheel;
  const tire = tube(r, r * 0.62, w, 26);
  const rim = cylinder(r * 0.66, r * 0.66, w * 0.92, 24, { capped: true });
  const spokes = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = chamferBox(r * 0.56, 0.045, w * 0.55, 0.012);
    const m = M.compose([0, 0, 0], Q.fromAxisAngle([0, 1, 0], a));
    spokes.push(transformGeometry(s, M.multiply(M.fromTranslation([Math.cos(a) * r * 0.33, 0, 0]), m)));
  }
  const hub = cylinder(r * 0.2, r * 0.2, w * 1.02, 16);
  const cap = cylinder(r * 0.13, r * 0.13, w * 1.06, 14);
  const orient = M.compose([0, 0, 0], Q.fromAxisAngle([0, 0, 1], -90 * D));
  return {
    tire: transformGeometry(tire, orient),
    rim: transformGeometry(merge([rim, ...spokes, hub, cap]), orient),
  };
}

/* ------------------------------------------------------------------ */
/* panel row tables (absolute car coordinates)                         */
/* ------------------------------------------------------------------ */

const HOOD_ROWS = [
  { x: 0.96, halfW: 0.80, y: 0.985, crown: 0.020 },
  { x: 1.22, halfW: 0.83, y: 0.975, crown: 0.030 },
  { x: 1.56, halfW: 0.83, y: 0.955, crown: 0.032 },
  { x: 1.81, halfW: 0.80, y: 0.935, crown: 0.024 },
  { x: 1.96, halfW: 0.74, y: 0.915, crown: 0.014 },
];
const ROOF_ROWS = [
  { x: -0.70, halfW: 0.55, y: 1.262, crown: 0.014 },
  { x: -0.48, halfW: 0.62, y: 1.288, crown: 0.022 },
  { x: -0.08, halfW: 0.66, y: 1.312, crown: 0.032 },
  { x: 0.28, halfW: 0.66, y: 1.308, crown: 0.032 },
  { x: 0.50, halfW: 0.63, y: 1.300, crown: 0.026 },
];
const DECK_ROWS = [
  { x: -2.05, halfW: 0.78, y: 1.055, crown: 0.012 },
  { x: -1.80, halfW: 0.82, y: 1.045, crown: 0.018 },
  { x: -1.45, halfW: 0.80, y: 1.020, crown: 0.014 },
];
const WINDSHIELD_ROWS = [
  { x: 0.55, halfW: 0.62, y: 1.262 },
  { x: 0.78, halfW: 0.66, y: 1.190 },
  { x: 0.96, halfW: 0.64, y: 1.080 },
];
const REARWINDOW_ROWS = [
  { x: -1.45, halfW: 0.55, y: 1.040 },
  { x: -1.10, halfW: 0.64, y: 1.150 },
  { x: -0.70, halfW: 0.66, y: 1.262 },
];
const DOOR_ROWS = [
  { x: -0.75, halfW: 0.925, yTop: 0.985, yBot: 0.30 },
  { x: -0.40, halfW: 0.935, yTop: 0.995, yBot: 0.28 },
  { x: 0.10, halfW: 0.935, yTop: 0.995, yBot: 0.27 },
  { x: 0.55, halfW: 0.930, yTop: 0.985, yBot: 0.28 },
];
const FENDER_ROWS = [
  { x: 1.36, halfW: 0.925, yTop: 0.940, yBot: 0.30 },
  { x: 1.66, halfW: 0.930, yTop: 0.945, yBot: 0.28 },
  { x: 1.96, halfW: 0.915, yTop: 0.930, yBot: 0.31 },
];
const QUARTER_ROWS = [
  { x: -1.45, halfW: 0.925, yTop: 1.020, yBot: 0.29 },
  { x: -1.15, halfW: 0.930, yTop: 1.030, yBot: 0.27 },
  { x: -0.89, halfW: 0.910, yTop: 1.020, yBot: 0.31 },
];
const ROCKER_ROWS = [
  { x: -0.15, halfW: 0.905, yTop: 0.46, yBot: 0.27 },
  { x: 0.20, halfW: 0.915, yTop: 0.45, yBot: 0.26 },
  { x: 0.55, halfW: 0.905, yTop: 0.46, yBot: 0.28 },
];
// Side panel between the door and the front wing arch: closes the body line.
const COWL_ROWS = [
  { x: 0.55, halfW: 0.930, yTop: 0.985, yBot: 0.28 },
  { x: 0.95, halfW: 0.935, yTop: 0.980, yBot: 0.27 },
  { x: 1.36, halfW: 0.930, yTop: 0.945, yBot: 0.29 },
];

const P_HOOD = [0.96, 0.985, 0];
const P_ROOF = [0.50, 1.300, 0];
const P_DECK = [-2.05, 1.055, 0];
const P_WINDSHIELD = [0.55, 1.262, 0];
const P_REARWINDOW = [-0.70, 1.262, 0];
const P_DOOR = [0.55, 0.30, 0.92];
const P_FENDER = [1.36, 0.30, 0.92];
const P_QUARTER = [-1.45, 0.30, 0.92];
const P_ROCKER = [0.55, 0.27, 0.90];

/* ------------------------------------------------------------------ */
/* part geometry                                                       */
/* ------------------------------------------------------------------ */

function buildMeshes() {
  const M_ = {};

  // --- main tub: the dark inner body everything else is bolted to ------
  {
    const rows = [
      [-2.36, 0.58, 0.84, 0.44],
      [-2.24, 0.80, 0.96, 0.34],
      [-2.02, 0.90, 1.02, 0.29],
      [-1.55, 0.93, 1.04, 0.27],
      [-1.30, 0.93, 1.02, 0.26],
      [-0.75, 0.93, 1.00, 0.26],
      [0.20, 0.93, 0.99, 0.26],
      [0.62, 0.93, 1.00, 0.25],
      [0.98, 0.93, 0.99, 0.25],
      [1.20, 0.93, 0.97, 0.25],
      [1.62, 0.93, 0.94, 0.26],
      [2.05, 0.90, 0.91, 0.29],
      [2.28, 0.83, 0.86, 0.35],
      [2.36, 0.70, 0.78, 0.42],
    ];
    const st = rows.map(([x, w, top, bot]) => ({ x, pts: sectionProfile(w, top, bot, 0.12, 0.10, 3) }));
    M_['body.tub'] = orientOutward(loftSurface(st, { closed: true }), [0, 0.6, 0]);
  }

  // --- chassis rails ----------------------------------------------------
  {
    const rails = [];
    for (const z of [-0.62, 0.62]) {
      rails.push(transformGeometry(chamferBox(4.1, 0.11, 0.13, 0.02), M.fromTranslation([-0.05, 0.30, z])));
    }
    for (const x of [-1.85, -0.9, 0.1, 1.05, 1.9]) {
      rails.push(transformGeometry(chamferBox(0.11, 0.09, 1.32, 0.02), M.fromTranslation([x, 0.31, 0])));
    }
    M_['body.frame'] = merge(rails);
  }

  // --- front fascia (nose): the robot's chest front ---------------------
  {
    const st = [
      { x: 0.00, pts: [[-0.32, -0.86], [0.12, -0.90], [0.30, -0.80], [0.33, -0.30], [0.33, 0.30], [0.30, 0.80], [0.12, 0.90], [-0.32, 0.86]] },
      { x: 0.20, pts: [[-0.31, -0.84], [0.10, -0.88], [0.28, -0.78], [0.31, -0.30], [0.31, 0.30], [0.28, 0.78], [0.10, 0.88], [-0.31, 0.84]] },
      { x: 0.40, pts: [[-0.29, -0.78], [0.06, -0.82], [0.24, -0.72], [0.26, -0.28], [0.26, 0.28], [0.24, 0.72], [0.06, 0.82], [-0.29, 0.78]] },
    ];
    M_['body.nose'] = orientOutward(loftShell(st, 0.05, { ref: (s) => [s.pts[0][0] - 0.2, 0] }), [0, 0, 0]);
  }

  // --- tail clip: the robot's pelvis ------------------------------------
  {
    const st = [
      { x: 0.00, pts: [[-0.32, -0.86], [0.12, -0.90], [0.30, -0.80], [0.33, -0.30], [0.33, 0.30], [0.30, 0.80], [0.12, 0.90], [-0.32, 0.86]] },
      { x: 0.45, pts: [[-0.31, -0.84], [0.10, -0.88], [0.28, -0.78], [0.31, -0.30], [0.31, 0.30], [0.28, 0.78], [0.10, 0.88], [-0.31, 0.84]] },
      { x: 0.91, pts: [[-0.29, -0.78], [0.06, -0.82], [0.24, -0.72], [0.26, -0.28], [0.26, 0.28], [0.24, 0.72], [0.06, 0.82], [-0.29, 0.78]] },
    ];
    M_['body.tail'] = orientOutward(loftShell(st, 0.05, { ref: (s) => [s.pts[0][0] - 0.2, 0] }), [0, 0, 0]);
  }

  // --- grille, bowtie, lamps --------------------------------------------
  {
    const surround = chamferBox(0.10, 0.30, 1.24, 0.03);
    const slats = [];
    for (let i = 0; i < 5; i++) {
      const y = -0.10 + i * 0.05;
      slats.push(transformGeometry(chamferBox(0.05, 0.022, 1.18, 0.006), M.fromTranslation([0.01, y, 0])));
    }
    M_['body.grille'] = merge([surround, ...slats]);
  }
  {
    const bar = chamferBox(0.05, 0.055, 0.30, 0.012);
    const wing = chamferBox(0.05, 0.075, 0.12, 0.014);
    M_['body.bowtie'] = merge([
      bar,
      transformGeometry(wing, M.fromTranslation([0.005, 0, 0.13])),
      transformGeometry(wing, M.fromTranslation([0.005, 0, -0.13])),
    ]);
  }
  {
    const lamp = merge([
      revolve([[0.0, -0.04], [0.090, -0.03], [0.098, 0.01], [0.090, 0.05], [0.0, 0.06]], 20),
      cylinder(0.101, 0.101, 0.03, 20, { capped: true }),
    ]);
    M_['body.headlight'] = transformGeometry(lamp, M.compose([0, 0, 0], Q.fromAxisAngle([1, 0, 0], 90 * D)));
  }
  {
    const fog = merge([
      revolve([[0.0, -0.03], [0.075, -0.02], [0.08, 0.01], [0.075, 0.04], [0.0, 0.05]], 16),
      cylinder(0.085, 0.085, 0.02, 16, { capped: true }),
    ]);
    M_['body.fog'] = transformGeometry(fog, M.compose([0, 0, 0], Q.fromAxisAngle([1, 0, 0], 90 * D)));
  }
  M_['body.taillight'] = chamferBox(0.07, 0.17, 0.30, 0.02);
  M_['body.bumper.front'] = merge([
    chamferBox(0.16, 0.17, 1.72, 0.05),
    transformGeometry(chamferBox(0.12, 0.10, 1.60, 0.03), M.fromTranslation([-0.02, -0.14, 0])),
  ]);
  M_['body.bumper.rear'] = merge([
    chamferBox(0.14, 0.15, 1.62, 0.05),
    transformGeometry(chamferBox(0.11, 0.09, 1.52, 0.03), M.fromTranslation([0.02, -0.13, 0])),
  ]);

  // --- painted panels ----------------------------------------------------
  M_['body.hood'] = topPanel(HOOD_ROWS, { thickness: 0.035, drop: 0.055, base: P_HOOD });
  M_['body.hood.stripe.l'] = stripePanel(HOOD_ROWS, { zc: -0.26, halfZ: 0.13, base: P_HOOD });
  M_['body.hood.stripe.r'] = stripePanel(HOOD_ROWS, { zc: 0.26, halfZ: 0.13, base: P_HOOD });
  M_['body.roof'] = topPanel(ROOF_ROWS, { thickness: 0.035, drop: 0.05, base: P_ROOF });
  M_['body.roof.stripe.l'] = stripePanel(ROOF_ROWS, { zc: -0.21, halfZ: 0.11, base: P_ROOF });
  M_['body.roof.stripe.r'] = stripePanel(ROOF_ROWS, { zc: 0.21, halfZ: 0.11, base: P_ROOF });
  M_['body.deck'] = topPanel(DECK_ROWS, { thickness: 0.032, drop: 0.05, base: P_DECK });
  M_['body.deck.stripe.l'] = stripePanel(DECK_ROWS, { zc: -0.25, halfZ: 0.12, base: P_DECK });
  M_['body.deck.stripe.r'] = stripePanel(DECK_ROWS, { zc: 0.25, halfZ: 0.12, base: P_DECK });
  M_['body.windshield'] = topPanel(WINDSHIELD_ROWS, { thickness: 0.02, drop: 0.03, base: P_WINDSHIELD });
  M_['body.rearwindow'] = topPanel(REARWINDOW_ROWS, { thickness: 0.02, drop: 0.03, base: P_REARWINDOW });

  {
    // The side skin is built around z = 0, so each side needs its own base
    // offset: the right hand panels are mirrored in z.
    for (const side of [1, -1]) {
      const s = side > 0 ? 'l' : 'r';
      const doorBase = [P_DOOR[0], P_DOOR[1], side * 0.92];
      M_[`body.door.${s}`] = sidePanel(DOOR_ROWS, { side, thickness: 0.032, tumble: 0.06, base: doorBase });
      const innerRows = DOOR_ROWS.map((r) => ({ ...r, halfW: r.halfW - 0.05 }));
      M_[`body.door.inner.${s}`] = sidePanel(innerRows, { side, thickness: 0.02, tumble: 0.05, base: doorBase });

      const fenderBase = [P_FENDER[0], P_FENDER[1], side * 0.92];
      M_[`body.fender.${s}`] = sidePanel(FENDER_ROWS, { side, thickness: 0.032, tumble: 0.07, base: fenderBase });

      const quarterBase = [P_QUARTER[0], P_QUARTER[1], side * 0.92];
      M_[`body.quarter.${s}`] = sidePanel(QUARTER_ROWS, { side, thickness: 0.032, tumble: 0.06, base: quarterBase });

      const rockerBase = [P_ROCKER[0], P_ROCKER[1], side * 0.90];
      M_[`body.rocker.${s}`] = sidePanel(ROCKER_ROWS, { side, thickness: 0.028, tumble: 0.02, base: rockerBase });

      const cowlBase = [1.36, 0.29, side * 0.92];
      M_[`body.cowl.${s}`] = sidePanel(COWL_ROWS, { side, thickness: 0.032, tumble: 0.06, base: cowlBase });
    }
  }

  // --- pillars, mirrors, wheels -----------------------------------------
  M_['body.pillar.a'] = chamferBox(0.46, 0.07, 0.07, 0.02);
  M_['body.pillar.c'] = chamferBox(0.55, 0.07, 0.08, 0.02);
  M_['body.mirror'] = merge([
    chamferBox(0.10, 0.09, 0.07, 0.02),
    transformGeometry(chamferBox(0.16, 0.05, 0.06, 0.015), M.fromTranslation([0.10, -0.03, 0])),
  ]);
  M_['body.wheel'] = wheelMeshes().tire;
  M_['body.rim'] = wheelMeshes().rim;

  // --- engine bay: becomes the chest mechanism --------------------------
  {
    const block = chamferBox(0.62, 0.34, 0.60, 0.03);
    const heads = [];
    for (const z of [-0.16, 0.16]) {
      heads.push(transformGeometry(chamferBox(0.46, 0.10, 0.16, 0.02), M.fromTranslation([0.02, 0.21, z])));
    }
    const pistons = [];
    for (const z of [-0.20, 0.20]) {
      pistons.push(transformGeometry(cylinder(0.035, 0.035, 0.26, 10), M.fromTranslation([-0.02, 0.30, z])));
    }
    M_['body.engine'] = merge([block, ...heads, ...pistons]);
  }

  // --- robot-only parts --------------------------------------------------
  {
    const shell = revolve([
      [0.0, -0.20], [0.10, -0.19], [0.16, -0.12], [0.185, 0.0], [0.175, 0.12], [0.12, 0.20], [0.0, 0.22],
    ], 18);
    const crest = chamferBox(0.20, 0.10, 0.05, 0.015);
    M_['head.shell'] = merge([
      transformGeometry(shell, M.fromScale([1.0, 0.92, 1.05])),
      transformGeometry(crest, M.fromTranslation([0.0, 0.19, 0])),
    ]);
    M_['head.face'] = chamferBox(0.13, 0.17, 0.10, 0.03);
    const eye = revolve([[0.0, 0.0], [0.045, 0.006], [0.05, 0.03], [0.0, 0.036]], 14);
    M_['head.eye'] = transformGeometry(eye, M.compose([0, 0, 0], Q.fromAxisAngle([1, 0, 0], 90 * D)));
    M_['head.pod'] = chamferBox(0.16, 0.10, 0.08, 0.02);
  }
  {
    M_['core.chest'] = merge([
      chamferBox(0.30, 0.56, 0.92, 0.04),
      transformGeometry(chamferBox(0.16, 0.52, 0.20, 0.03), M.fromTranslation([-0.16, -0.34, 0])),
    ]);
    M_['core.pelvis'] = chamferBox(0.34, 0.30, 0.66, 0.05);
    M_['core.rib'] = chamferBox(0.10, 0.16, 0.54, 0.02);
  }
  {
    M_['arm.fore'] = merge([
      chamferBox(0.20, 0.17, 0.17, 0.03),
      transformGeometry(cylinder(0.028, 0.028, 0.22, 10), M.compose([-0.10, 0, 0], Q.fromAxisAngle([0, 0, 1], 90 * D))),
    ]);
    const palm = chamferBox(0.16, 0.16, 0.14, 0.03);
    const fingers = [];
    for (let i = 0; i < 3; i++) {
      fingers.push(transformGeometry(chamferBox(0.11, 0.035, 0.035, 0.01), M.fromTranslation([0.10, -0.04 + i * 0.04, 0.03])));
    }
    M_['hand.fist'] = merge([palm, ...fingers]);
    M_['foot.plate'] = merge([
      chamferBox(0.46, 0.13, 0.22, 0.04),
      transformGeometry(chamferBox(0.14, 0.09, 0.19, 0.03), M.fromTranslation([0.24, -0.02, 0])),
    ]);
  }
  {
    const tip = revolve([[0.0, 0.0], [0.055, 0.01], [0.06, 0.10], [0.0, 0.11]], 14);
    M_['body.exhaust'] = transformGeometry(tip, M.compose([0, 0, 0], Q.fromAxisAngle([0, 0, 1], 90 * D)));
  }

  const out = {};
  for (const [k, g] of Object.entries(M_)) out[k] = finalize(g);
  return out;
}

/* ------------------------------------------------------------------ */
/* assembly table                                                      */
/* ------------------------------------------------------------------ */

const ROOT = 'scene.root';

function qz(deg) { return Q.fromAxisAngle([0, 0, 1], deg * D); }
function qy(deg) { return Q.fromAxisAngle([0, 1, 0], deg * D); }
const ax = (x, y) => Q.fromAxes(x, y);
const IDQ = Q.identity();

export function buildCharacter() {
  const meshes = buildMeshes();
  const A = [];
  const add = (o) => { A.push(o); return o; };

  // Transformation schedule, in source seconds.
  const W = {
    unlock: [3.50, 4.20],
    doorPop: [3.50, 4.05],
    hoodPop: [3.60, 4.20],
    feet: [4.40, 6.80],
    rockers: [4.60, 7.00],
    quarters: [4.80, 7.10],
    fenders: [4.70, 6.90],
    doors: [4.90, 7.20],
    arms: [5.30, 7.60],
    hood: [5.10, 7.40],
    nose: [5.00, 7.30],
    tail: [5.20, 7.50],
    roof: [4.80, 7.00],
    glass: [5.00, 7.10],
    engine: [4.90, 6.90],
    head: [5.60, 7.80],
    core: [5.10, 7.40],
  };

  // --- frame / core ------------------------------------------------------
  add({
    id: 'body.frame', parent: ROOT, system: 'frame', mesh: 'body.frame',
    material: 'metal.dark',
    vehicle: { p: [0, 0, 0], q: IDQ },
    robot: { p: [0.0, 1.62, 0], q: qz(90) },
    scaleRobot: [0.13, 1.4, 0.42],
    window: W.core, arc: [0, 0.16, 0],
    note: '车架纵梁 → 机器人脊柱骨架',
  });
  add({
    id: 'core.chest', parent: 'body.frame', system: 'frame', mesh: 'core.chest',
    material: 'metal.gun',
    vehicle: { p: [1.42, 0.62, 0], q: IDQ },
    robot: { p: [0.10, 1.90, 0], q: IDQ },
    window: W.core, arc: [0, 0.20, 0],
    note: '胸腔内构（inferred）',
  });
  add({
    id: 'core.pelvis', parent: 'body.frame', system: 'frame', mesh: 'core.pelvis',
    material: 'metal.gun',
    vehicle: { p: [-1.62, 0.60, 0], q: IDQ },
    robot: { p: [-0.04, 1.58, 0], q: IDQ },
    window: W.core, arc: [0, 0.10, 0],
    note: '骨盆内构（inferred）',
  });
  add({
    id: 'core.rib', parent: 'core.pelvis', system: 'frame', mesh: 'core.rib',
    material: 'metal.dark',
    vehicle: { p: [-1.62, 0.72, 0], q: IDQ },
    robot: { p: [-0.22, 1.52, 0], q: IDQ },
    window: W.core,
  });

  // --- tub ---------------------------------------------------------------
  add({
    id: 'body.tub', parent: ROOT, system: 'body', mesh: 'body.tub',
    material: 'metal.dark',
    vehicle: { p: [0, 0, 0], q: IDQ },
    robot: { p: [0.0, 1.68, 0], q: IDQ },
    scaleRobot: [0.17, 0.42, 0.48],
    window: [5.40, 8.00], arc: [0, 0.26, 0],
    note: '车身内构：车辆态是完整车身，人形态压缩为腰部块',
  });

  // --- front fascia / chest ----------------------------------------------
  add({
    id: 'body.nose', parent: ROOT, system: 'chest', mesh: 'body.nose',
    material: 'paint.yellow',
    vehicle: { p: [1.96, 0.62, 0], q: IDQ },
    robot: { p: [0.04, 1.90, 0], q: IDQ },
    window: W.nose, arc: [0, 0.24, 0],
    note: '车头面 → 胸甲正面',
  });
  add({
    id: 'body.grille', parent: 'body.nose', system: 'chest', mesh: 'body.grille',
    material: 'paint.blackFlat',
    vehicle: { p: [2.34, 0.74, 0], q: IDQ },
    robot: { p: [0.42, 1.88, 0], q: IDQ },
    window: W.nose,
  });
  add({
    id: 'body.bowtie', parent: 'body.nose', system: 'chest', mesh: 'body.bowtie',
    material: 'metal.chrome',
    vehicle: { p: [2.36, 0.74, 0], q: IDQ },
    robot: { p: [0.44, 1.88, 0], q: IDQ },
    window: W.nose,
  });
  add({
    id: 'body.headlight.l', parent: 'body.nose', system: 'chest', mesh: 'body.headlight',
    material: 'light.head',
    vehicle: { p: [2.31, 0.82, 0.62], q: IDQ },
    robot: { p: [0.40, 2.04, 0.50], q: IDQ },
    window: W.nose,
  });
  add({
    id: 'body.headlight.r', parent: 'body.nose', system: 'chest', mesh: 'body.headlight',
    material: 'light.head',
    vehicle: { p: [2.31, 0.82, -0.62], q: IDQ },
    robot: { p: [0.40, 2.04, -0.50], q: IDQ },
    window: W.nose,
  });
  add({
    id: 'body.fog.l', parent: 'body.nose', system: 'chest', mesh: 'body.fog',
    material: 'light.head',
    vehicle: { p: [2.33, 0.44, 0.54], q: IDQ },
    robot: { p: [0.42, 1.68, 0.44], q: IDQ },
    window: W.nose,
  });
  add({
    id: 'body.fog.r', parent: 'body.nose', system: 'chest', mesh: 'body.fog',
    material: 'light.head',
    vehicle: { p: [2.33, 0.44, -0.54], q: IDQ },
    robot: { p: [0.42, 1.68, -0.44], q: IDQ },
    window: W.nose,
  });
  add({
    id: 'body.bumper.front', parent: 'body.nose', system: 'chest', mesh: 'body.bumper.front',
    material: 'metal.gun',
    vehicle: { p: [2.30, 0.40, 0], q: IDQ },
    robot: { p: [0.42, 1.64, 0], q: IDQ },
    window: W.nose,
  });

  // --- hood / chest yoke -------------------------------------------------
  add({
    id: 'body.hood', parent: ROOT, system: 'chest', mesh: 'body.hood',
    material: 'paint.yellow',
    vehicle: { p: P_HOOD, q: IDQ },
    robot: { p: [0.06, 2.14, 0.50], q: ax([0, 0, -1], [-0.2, 0.98, 0]) },
    window: W.hood, arc: [0, 0.30, 0],
    pre: { window: W.hoodPop, q: qz(-7), p: P_HOOD },
    note: '引擎盖 → 胸前横轭',
  });
  add({
    id: 'body.hood.stripe.l', parent: 'body.hood', system: 'chest', mesh: 'body.hood.stripe.l',
    material: 'paint.black',
    vehicle: { p: [P_HOOD[0], P_HOOD[1], -0.26], q: IDQ },
    robot: { p: [0.06, 2.19, 0.50], q: ax([0, 0, -1], [-0.2, 0.98, 0]) },
    window: W.hood, arc: [0, 0.30, 0],
    pre: { window: W.hoodPop, q: qz(-7), p: [P_HOOD[0], P_HOOD[1], -0.26] },
  });
  add({
    id: 'body.hood.stripe.r', parent: 'body.hood', system: 'chest', mesh: 'body.hood.stripe.r',
    material: 'paint.black',
    vehicle: { p: [P_HOOD[0], P_HOOD[1], 0.26], q: IDQ },
    robot: { p: [0.14, 2.31, 0.50], q: ax([0, 0, -1], [-0.2, 0.98, 0]) },
    window: W.hood, arc: [0, 0.30, 0],
    pre: { window: W.hoodPop, q: qz(-7), p: [P_HOOD[0], P_HOOD[1], 0.26] },
  });

  // --- engine ------------------------------------------------------------
  add({
    id: 'body.engine', parent: ROOT, system: 'chest', mesh: 'body.engine',
    material: 'metal.dark',
    vehicle: { p: [1.45, 0.62, 0], q: IDQ },
    robot: { p: [0.16, 1.88, 0], q: IDQ },
    window: W.engine, arc: [0, 0.16, 0],
    note: '发动机 → 胸腔机构（inferred）',
  });

  // --- fenders / upper arms ---------------------------------------------
  for (const side of [1, -1]) {
    const s = side > 0 ? 'l' : 'r';
    add({
      id: `body.cowl.${s}`, parent: ROOT, system: 'chest', mesh: `body.cowl.${s}`,
      material: 'paint.yellow',
      vehicle: { p: [1.36, 0.29, side * 0.92], q: IDQ },
      robot: { p: [0.12, 2.14, side * 0.34], q: ax([0, -1, 0], [0, 0, side]) },
      scaleRobot: [1, 0.5, 1],
      window: W.fenders, arc: [0.04, 0.18, side * 0.06],
      note: '前围侧板 → 肩内侧盖板',
    });
    add({
      id: `body.fender.${s}`, parent: ROOT, system: 'arm', mesh: `body.fender.${s}`,
      material: 'paint.yellow',
      vehicle: { p: [P_FENDER[0], P_FENDER[1], side * 0.92], q: IDQ },
      robot: { p: [0.02, 1.56, side * 0.72], q: ax([0, 1, 0], [0, 0, side]) },
      scaleRobot: [1, 0.45, 1],
      window: W.fenders, arc: [0.06, 0.20, side * 0.08],
      note: '前翼子板 → 上臂外甲',
    });
    add({
      id: `arm.fore.${s}`, parent: `body.fender.${s}`, system: 'arm', mesh: 'arm.fore',
      material: 'metal.dark',
      vehicle: { p: [P_FENDER[0], P_FENDER[1], side * 0.86], q: IDQ },
      robot: { p: [0.04, 1.18, side * 0.78], q: IDQ },
      window: W.arms, arc: [0.06, 0.08, side * 0.05],
      reveal: 4.9,
      note: '车门内机构 → 前臂（inferred）',
    });
    add({
      id: `hand.${s}`, parent: `arm.fore.${s}`, system: 'arm', mesh: 'hand.fist',
      material: 'metal.gun',
      vehicle: { p: [P_FENDER[0], P_FENDER[1], side * 0.80], q: IDQ },
      robot: { p: [0.08, 0.90, side * 0.82], q: IDQ },
      window: W.arms,
      reveal: 5.4,
    });
  }

  // --- doors / wings -----------------------------------------------------
  for (const side of [1, -1]) {
    const s = side > 0 ? 'l' : 'r';
    const wingX = side > 0 ? [0.60, 0.62, -0.50] : [0.60, 0.62, 0.50];
    const wingY = side > 0 ? [0.34, 0.82, 0.46] : [0.34, 0.82, -0.46];
    add({
      id: `body.door.${s}`, parent: ROOT, system: 'wing', mesh: `body.door.${s}`,
      material: 'paint.yellow',
      vehicle: { p: [P_DOOR[0], P_DOOR[1], side * 0.92], q: IDQ },
      robot: { p: [-0.12, 2.02, side * 0.40], q: ax(wingX, wingY) },
      scaleRobot: [0.86, 0.62, 1],
      window: W.doors, arc: [-0.08, 0.26, side * 0.14],
      pre: { window: W.doorPop, q: qy(side > 0 ? -14 : 14), p: [P_DOOR[0], P_DOOR[1], side * 0.92] },
      note: '车门 → 背翼',
    });
    add({
      id: `body.door.inner.${s}`, parent: `body.door.${s}`, system: 'wing', mesh: `body.door.inner.${s}`,
      material: 'metal.chrome',
      vehicle: { p: [P_DOOR[0], P_DOOR[1], side * 0.87], q: IDQ },
      robot: { p: [-0.12, 2.02, side * 0.36], q: ax(wingX, wingY) },
      window: W.doors,
      pre: { window: W.doorPop, q: qy(side > 0 ? -14 : 14), p: [P_DOOR[0], P_DOOR[1], side * 0.87] },
    });
    add({
      id: `body.mirror.${s}`, parent: `body.door.${s}`, system: 'wing', mesh: 'body.mirror',
      material: 'paint.black',
      vehicle: { p: [0.80, 0.92, side * 0.98], q: IDQ },
      robot: { p: [0.02, 2.66, side * 0.18], q: qy(side > 0 ? 30 : -30) },
      window: W.doors,
      pre: { window: W.doorPop, q: qy(side > 0 ? -14 : 14), p: [0.80, 0.92, side * 0.98] },
      note: '后视镜 → 头侧舱',
    });
  }

  // --- quarters / thighs -------------------------------------------------
  for (const side of [1, -1]) {
    const s = side > 0 ? 'l' : 'r';
    add({
      id: `body.quarter.${s}`, parent: ROOT, system: 'leg', mesh: `body.quarter.${s}`,
      material: 'paint.yellow',
      vehicle: { p: [P_QUARTER[0], P_QUARTER[1], side * 0.92], q: IDQ },
      robot: { p: [0.0, 1.56, side * 0.23], q: ax([0, -1, 0], [0, 0, side]) },
      scaleRobot: [1, 0.36, 1],
      window: W.quarters, arc: [0.06, -0.08, side * 0.04],
      note: '后翼子板 → 大腿外甲',
    });
  }

  // --- rockers / shins ---------------------------------------------------
  for (const side of [1, -1]) {
    const s = side > 0 ? 'l' : 'r';
    add({
      id: `body.rocker.${s}`, parent: ROOT, system: 'leg', mesh: `body.rocker.${s}`,
      material: 'metal.gun',
      vehicle: { p: [P_ROCKER[0], P_ROCKER[1], side * 0.90], q: IDQ },
      robot: { p: [0.0, 1.16, side * 0.21], q: ax([0, 1, 0], [0, 0, side]) },
      window: W.rockers, arc: [0.04, -0.10, side * 0.04],
      note: '门槛梁 → 小腿',
    });
  }

  // --- tail / pelvis -----------------------------------------------------
  add({
    id: 'body.tail', parent: ROOT, system: 'pelvis', mesh: 'body.tail',
    material: 'paint.yellow',
    vehicle: { p: [-2.36, 0.62, 0], q: IDQ },
    robot: { p: [-0.42, 1.50, 0], q: IDQ },
    window: W.tail, arc: [0, 0.12, 0],
    note: '车尾 → 骨盆',
  });
  add({
    id: 'body.bumper.rear', parent: 'body.tail', system: 'pelvis', mesh: 'body.bumper.rear',
    material: 'metal.gun',
    vehicle: { p: [-2.32, 0.46, 0], q: IDQ },
    robot: { p: [-0.50, 1.44, 0], q: IDQ },
    window: W.tail,
  });
  add({
    id: 'body.taillight.l', parent: 'body.tail', system: 'pelvis', mesh: 'body.taillight',
    material: 'light.tail',
    vehicle: { p: [-2.34, 0.72, 0.62], q: IDQ },
    robot: { p: [-0.52, 1.62, 0.30], q: IDQ },
    window: W.tail,
  });
  add({
    id: 'body.taillight.r', parent: 'body.tail', system: 'pelvis', mesh: 'body.taillight',
    material: 'light.tail',
    vehicle: { p: [-2.34, 0.72, -0.62], q: IDQ },
    robot: { p: [-0.52, 1.62, -0.30], q: IDQ },
    window: W.tail,
  });

  // --- deck lid ----------------------------------------------------------
  add({
    id: 'body.deck', parent: ROOT, system: 'body', mesh: 'body.deck',
    material: 'paint.yellow',
    vehicle: { p: P_DECK, q: IDQ },
    robot: { p: [-0.34, 1.88, 0], q: qz(72) },
    window: [5.60, 7.90], arc: [-0.06, 0.14, 0],
    note: '后盖 → 背部装甲',
  });
  add({
    id: 'body.deck.stripe.l', parent: 'body.deck', system: 'body', mesh: 'body.deck.stripe.l',
    material: 'paint.black',
    vehicle: { p: [P_DECK[0], P_DECK[1], -0.25], q: IDQ },
    robot: { p: [-0.36, 1.90, -0.25], q: qz(72) },
    window: [5.60, 7.90], arc: [-0.06, 0.14, 0],
  });
  add({
    id: 'body.deck.stripe.r', parent: 'body.deck', system: 'body', mesh: 'body.deck.stripe.r',
    material: 'paint.black',
    vehicle: { p: [P_DECK[0], P_DECK[1], 0.25], q: IDQ },
    robot: { p: [-0.36, 1.90, 0.25], q: qz(72) },
    window: [5.60, 7.90], arc: [-0.06, 0.14, 0],
  });

  // --- greenhouse --------------------------------------------------------
  add({
    id: 'body.roof', parent: ROOT, system: 'head', mesh: 'body.roof',
    material: 'paint.yellow',
    vehicle: { p: P_ROOF, q: IDQ },
    robot: { p: [-0.26, 2.16, 0.60], q: ax([0, 0, 1], [-0.2, 0.98, 0]) },
    window: W.roof, arc: [0, 0.26, 0],
    note: '车顶 → 肩部横梁',
  });
  add({
    id: 'body.roof.stripe.l', parent: 'body.roof', system: 'head', mesh: 'body.roof.stripe.l',
    material: 'paint.black',
    vehicle: { p: [P_ROOF[0], P_ROOF[1], -0.21], q: IDQ },
    robot: { p: [-0.22, 2.20, 0.60], q: ax([0, 0, 1], [-0.2, 0.98, 0]) },
    window: W.roof, arc: [0, 0.26, 0],
  });
  add({
    id: 'body.roof.stripe.r', parent: 'body.roof', system: 'head', mesh: 'body.roof.stripe.r',
    material: 'paint.black',
    vehicle: { p: [P_ROOF[0], P_ROOF[1], 0.21], q: IDQ },
    robot: { p: [-0.04, 2.38, 0.60], q: ax([0, 0, 1], [-0.2, 0.98, 0]) },
    window: W.roof, arc: [0, 0.26, 0],
  });
  add({
    id: 'body.windshield', parent: ROOT, system: 'head', mesh: 'body.windshield',
    material: 'glass.tint',
    vehicle: { p: P_WINDSHIELD, q: IDQ },
    robot: { p: [0.24, 2.06, 0], q: qz(-62) },
    window: W.glass, arc: [0, 0.22, 0],
    note: '前风挡 → 胸前玻璃',
  });
  add({
    id: 'body.rearwindow', parent: ROOT, system: 'head', mesh: 'body.rearwindow',
    material: 'glass.tint',
    vehicle: { p: P_REARWINDOW, q: IDQ },
    robot: { p: [-0.42, 2.12, 0], q: qz(22) },
    window: W.glass, arc: [-0.06, 0.20, 0],
    note: '后风挡 → 背部玻璃',
  });
  for (const side of [1, -1]) {
    const s = side > 0 ? 'l' : 'r';
    add({
      id: `body.pillar.a.${s}`, parent: ROOT, system: 'head', mesh: 'body.pillar.a',
      material: 'paint.yellow',
      vehicle: { p: [0.74, 1.16, side * 0.60], q: qz(-32) },
      robot: { p: [0.04, 2.30, side * 0.21], q: qz(-14) },
      window: W.glass, arc: [0, 0.20, side * 0.06],
    });
    add({
      id: `body.pillar.c.${s}`, parent: ROOT, system: 'head', mesh: 'body.pillar.c',
      material: 'paint.yellow',
      vehicle: { p: [-0.86, 1.14, side * 0.60], q: qz(30) },
      robot: { p: [-0.24, 2.02, side * 0.25], q: qz(16) },
      window: W.glass, arc: [-0.04, 0.18, side * 0.06],
    });
  }

  // --- head (robot only, deployed from the cabin) ----------------------
  add({
    id: 'head.shell', parent: ROOT, system: 'head', mesh: 'head.shell',
    material: 'paint.yellow',
    vehicle: { p: [0.05, 1.05, 0], q: IDQ },
    robot: { p: [0.02, 2.62, 0], q: qz(-4) },
    window: W.head, arc: [0, 0.28, 0],
    reveal: 5.3,
    note: '驾驶舱内收起的头盔（inferred）',
  });
  add({
    id: 'head.face', parent: 'head.shell', system: 'head', mesh: 'head.face',
    material: 'metal.dark',
    vehicle: { p: [0.18, 1.05, 0], q: IDQ },
    robot: { p: [0.19, 2.60, 0], q: qz(-4) },
    window: W.head, arc: [0, 0.28, 0],
    reveal: 5.5,
  });
  add({
    id: 'head.eye.l', parent: 'head.face', system: 'head', mesh: 'head.eye',
    material: 'light.eye',
    vehicle: { p: [0.23, 1.05, 0.055], q: IDQ },
    robot: { p: [0.25, 2.64, 0.055], q: qz(-4) },
    window: W.head, arc: [0, 0.28, 0],
    reveal: 6.0,
  });
  add({
    id: 'head.eye.r', parent: 'head.face', system: 'head', mesh: 'head.eye',
    material: 'light.eye',
    vehicle: { p: [0.23, 1.05, -0.055], q: IDQ },
    robot: { p: [0.25, 2.64, -0.055], q: qz(-4) },
    window: W.head, arc: [0, 0.28, 0],
    reveal: 6.0,
  });
  for (const side of [1, -1]) {
    const s = side > 0 ? 'l' : 'r';
    add({
      id: `head.pod.${s}`, parent: 'head.shell', system: 'head', mesh: 'head.pod',
      material: 'metal.gun',
      vehicle: { p: [0.05, 1.05, side * 0.12], q: IDQ },
      robot: { p: [0.02, 2.64, side * 0.19], q: qy(side > 0 ? 24 : -24) },
      window: W.head, arc: [0, 0.26, side * 0.05],
      reveal: 5.7,
    });
  }

  // --- wheels / feet -----------------------------------------------------
  const wheelDef = [
    ['body.wheel.fl', 1, 'foot'],
    ['body.wheel.fr', -1, 'foot'],
    ['body.wheel.rl', 1, 'heel'],
    ['body.wheel.rr', -1, 'heel'],
  ];
  for (const [id, side, kind] of wheelDef) {
    const front = id.includes('fl') || id.includes('fr');
    const vx = front ? CAR.wheel.frontX : CAR.wheel.rearX;
    const rp = kind === 'foot'
      ? { p: [0.04, 0.26, side * 0.22], q: qz(90) }
      : { p: [-0.17, 0.74, side * 0.23], q: IDQ };
    add({
      id, parent: ROOT, system: 'leg', mesh: 'body.wheel',
      material: 'rubber.tire',
      vehicle: { p: [vx, CAR.wheel.r, side * CAR.wheel.z], q: IDQ },
      robot: rp,
      scaleRobot: kind === 'foot' ? [0.5, 0.72, 0.72] : undefined,
      window: front ? W.feet : W.rockers,
      arc: front ? [0.04, 0.08, side * 0.05] : [-0.06, 0.12, side * 0.04],
      note: kind === 'foot' ? '前轮 → 足底' : '后轮 → 小腿后侧',
    });
    add({
      id: `${id}.rim`, parent: id, system: 'leg', mesh: 'body.rim',
      material: 'metal.chrome',
      vehicle: { p: [vx, CAR.wheel.r, side * CAR.wheel.z], q: IDQ },
      robot: { p: [rp.p[0], rp.p[1], rp.p[2]], q: rp.q },
      scaleRobot: kind === 'foot' ? [0.55, 1, 1] : undefined,
      window: front ? W.feet : W.rockers,
      note: '轮辋随轮体',
    });
  }
  for (const side of [1, -1]) {
    const s = side > 0 ? 'l' : 'r';
    add({
      id: `foot.plate.${s}`, parent: 'body.frame', system: 'leg', mesh: 'foot.plate',
      material: 'metal.chrome',
      vehicle: { p: [1.40, 0.20, side * 0.74], q: IDQ },
      robot: { p: [0.06, 0.36, side * 0.22], q: qz(-4) },
      window: W.feet, arc: [0.04, 0.05, side * 0.04],
      reveal: 5.2,
    });
  }

  // --- exhaust ------------------------------------------------------------
  for (const side of [1, -1]) {
    const s = side > 0 ? 'l' : 'r';
    add({
      id: `body.exhaust.${s}`, parent: 'body.tail', system: 'body', mesh: 'body.exhaust',
      material: 'metal.chrome',
      vehicle: { p: [-2.36, 0.40, side * 0.42], q: IDQ },
      robot: { p: [-0.50, 1.34, side * 0.24], q: qz(90) },
      window: W.tail,
    });
  }

  return { meshes, assemblies: A, rootId: ROOT, materials: MATERIALS, windows: W };
}

export { ROOT };
