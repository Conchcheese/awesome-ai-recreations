// Shot list for the film. The web research page and the offline renderer
// both read this table, so the on-screen page and the encoded movie are
// driven by the same camera decisions.
//
// Camera angles are derived from the character bounds, then reviewed by eye:
// the low 3/4 keeps the silhouette readable, the detail shots are framed on
// the port that carries the action of that beat.

export const FPS = 24;
export const SOURCE_DURATION = 20.0;

export const SHOTS = [
  {
    id: 'vehicle-establish',
    purpose: 'vehicle-establish',
    from: 0.0, to: 3.50,
    label: '车辆建立',
    fov: [34, 32],
    keys: [
      { t: 0.00, eye: [6.40, 0.78, 4.85], target: [0.30, 0.72, 0.00] },
      { t: 3.50, eye: [5.20, 0.88, 3.95], target: [0.25, 0.76, 0.00] },
    ],
  },
  {
    id: 'transformation',
    purpose: 'transformation',
    from: 3.50, to: 9.50,
    label: '连续变形',
    fov: [32, 34],
    keys: [
      { t: 3.50, eye: [5.90, 0.92, 4.50], target: [0.25, 0.75, 0.00] },
      { t: 5.60, eye: [7.00, 1.55, 5.40], target: [0.10, 1.20, 0.00] },
      { t: 7.90, eye: [7.60, 2.05, 5.80], target: [0.00, 1.45, 0.00] },
      { t: 9.50, eye: [7.20, 1.85, 5.50], target: [0.05, 1.40, 0.00] },
    ],
  },
  {
    id: 'hero-reveal',
    purpose: 'hero-reveal',
    from: 9.50, to: 12.00,
    label: '人形亮相',
    fov: [30, 29],
    keys: [
      { t: 9.50, eye: [7.20, 1.85, 5.50], target: [0.05, 1.40, 0.00] },
      { t: 10.70, eye: [4.30, 0.66, -3.35], target: [0.05, 1.45, 0.00] },
      { t: 12.00, eye: [3.95, 0.82, -3.10], target: [0.05, 1.52, 0.00] },
    ],
  },
  {
    id: 'head-chest',
    purpose: 'detail',
    from: 12.00, to: 14.50,
    label: '头胸揭示',
    fov: [26, 24],
    keys: [
      { t: 12.00, eye: [4.80, 0.86, -3.80], target: [0.05, 1.55, 0.00] },
      { t: 12.90, eye: [1.95, 2.62, 1.55], target: [0.05, 2.42, 0.00] },
      { t: 13.80, eye: [1.85, 2.56, 1.48], target: [0.12, 2.30, 0.00] },
      { t: 14.50, eye: [1.80, 2.22, 1.42], target: [0.30, 1.96, 0.00] },
    ],
  },
  {
    id: 'arm-hand',
    purpose: 'detail',
    from: 14.50, to: 16.50,
    label: '前臂与手',
    fov: [24, 22],
    keys: [
      { t: 14.50, eye: [1.80, 2.22, 1.42], target: [0.30, 1.96, 0.00] },
      { t: 15.50, eye: [1.95, 1.58, 2.00], target: [0.14, 1.30, 0.58] },
      { t: 16.50, eye: [1.82, 1.26, 1.90], target: [0.12, 1.12, 0.62] },
    ],
  },
  {
    id: 'legs',
    purpose: 'detail',
    from: 16.50, to: 18.00,
    label: '下肢承重',
    fov: [26, 25],
    keys: [
      { t: 16.50, eye: [1.82, 1.26, 1.90], target: [0.12, 1.12, 0.62] },
      { t: 17.20, eye: [2.05, 0.42, 2.05], target: [0.02, 0.62, 0.22] },
      { t: 18.00, eye: [1.88, 0.52, 1.88], target: [0.00, 0.68, 0.20] },
    ],
  },
  {
    id: 'final-hero',
    purpose: 'final',
    from: 18.00, to: 20.00,
    label: '重组与落幅',
    fov: [30, 29],
    keys: [
      { t: 18.00, eye: [1.88, 0.52, 1.88], target: [0.00, 0.68, 0.20] },
      { t: 18.80, eye: [3.95, 0.82, -3.10], target: [0.05, 1.52, 0.00] },
      { t: 20.00, eye: [5.10, 1.18, -4.05], target: [0.00, 1.40, 0.00] },
    ],
  },
];

// The transformation interval covered by one unbroken shot.
export const TRANSFORM = [3.50, 9.50];

export function shotAt(t) {
  for (const s of SHOTS) {
    if (t >= s.from && t < s.to) return s;
  }
  return SHOTS[SHOTS.length - 1];
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function cameraAt(t) {
  const shot = shotAt(t);
  const keys = shot.keys;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const span = Math.max(1e-6, b.t - a.t);
  const k = smooth(Math.min(1, Math.max(0, (t - a.t) / span)));
  const lerp3 = (u, v) => [
    u[0] + (v[0] - u[0]) * k,
    u[1] + (v[1] - u[1]) * k,
    u[2] + (v[2] - u[2]) * k,
  ];
  const fov = shot.fov[0] + (shot.fov[1] - shot.fov[0]) * k;
  return {
    eye: lerp3(a.eye, b.eye),
    target: lerp3(a.target, b.target),
    up: [0, 1, 0],
    fov,
    near: 0.05,
    far: 400,
    shotId: shot.id,
  };
}

// The edit list consumed by the production contract.
export const EDIT = SHOTS.map((s) => ({
  in: s.from,
  out: s.to,
  sourceIn: s.from,
  sourceOut: s.to,
  purpose: s.purpose,
}));

// Studio lighting rig, shared by the page and the offline renderer.
// `dir` is the direction the light travels: the key comes from the front
// right, above the subject, so the camera side of the car is the lit side.
export const LIGHTS = {
  key: { dir: [-0.55, -0.76, -0.36], color: [1.0, 0.95, 0.88], intensity: 3.1 },
  fill: { dir: [0.72, -0.24, -0.36], color: [0.38, 0.48, 0.68], intensity: 0.85 },
  rim: { dir: [0.26, -0.30, 0.92], color: [0.82, 0.88, 1.0], intensity: 2.3 },
};

export const AMBIENT = { sky: [0.085, 0.110, 0.155], ground: [0.042, 0.038, 0.034], strength: 1.0 };

export const BACKGROUND = {
  top: [0.016, 0.021, 0.030],
  bottom: [0.004, 0.005, 0.008],
  horizonGlow: 0.22,
};

export const GROUND = { enabled: true, color: [0.050, 0.055, 0.064], grid: 0.0, roughness: 0.30, metallic: 0.05 };
