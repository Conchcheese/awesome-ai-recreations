// The Mellis HB-7 body: the thorax shell with the crankcase windows and the drive gears
// (pinion, ring gear, crank disk with two connecting rods out to the wing roots), the optic
// head on its neck bearing, the abdomen capsule with the battery train, the six tucked legs
// and the two antennae. Every moving part is posed by update() from model.js only.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = THREE.Vector3;

/** a spur gear: a short cylinder with teeth boxes around it */
function gear(r, teeth, thick, mat, toothMat) {
  const g = new THREE.Group();
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thick, 32).rotateX(Math.PI / 2), mat);
  disk.castShadow = true;
  g.add(disk);
  const tooth = new THREE.BoxGeometry(0.0018, 0.0016, thick * 1.04);
  for (let i = 0; i < teeth; i++) {
    const t = new THREE.Mesh(tooth, toothMat);
    const a = (i / teeth) * Math.PI * 2;
    t.position.set(Math.cos(a) * (r + 0.0008), Math.sin(a) * (r + 0.0008), 0);
    t.rotation.z = a;
    g.add(t);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, thick * 1.7, 16).rotateX(Math.PI / 2), mat);
  g.add(hub);
  return g;
}

export function buildThorax(M) {
  const root = new THREE.Group();
  // main shell: dark like the reference machine's thorax, with a cobalt trim band
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.021, 0.032, 3, 0.007), M.shellDark);
  shell.castShadow = true;
  shell.receiveShadow = true;
  root.add(shell);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0112, 0.0112, 0.0035, 32).rotateX(Math.PI / 2), M.accent);
  stripe.position.z = 0.004;
  root.add(stripe);
  // crankcase windows (both sides): clear panels over the gears, below the wing roots
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.0012, 24).rotateZ(Math.PI / 2), M.window);
    win.position.set(s * 0.0118, -0.002, 0.001);
    root.add(win);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0007, 6, 28).rotateY(Math.PI / 2), M.trim);
    rim.position.set(s * 0.0124, -0.002, 0.001);
    root.add(rim);
  }
  // the drive train, visible through the windows: pinion (motor) left, ring gear right
  const gears = new THREE.Group();
  gears.position.set(0, -0.002, 0.001);
  root.add(gears);
  const pinion = gear(0.0031, 14, 0.003, M.gearDark, M.gearDark); // 14 teeth: the model's GEAR_PINION
  pinion.position.set(0, 0.0068, 0.008);
  gears.add(pinion);
  const ring = gear(0.0075, 34, 0.0026, M.gear, M.trim);
  ring.position.set(-0.0008, 0, 0);
  gears.add(ring);
  // crank disk + pins + connecting rods to the wing roots
  const crank = new THREE.Group();
  crank.position.set(0.0015, -0.002, 0.001);
  root.add(crank);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.0022, 24).rotateX(Math.PI / 2), M.gearDark);
  crank.add(disk);
  const pinL = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.006, 8).rotateX(Math.PI / 2), M.steel);
  crank.add(pinL);
  const rods = [];
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.00055, 0.00055, 1, 8), M.steel);
    rod.castShadow = true;
    root.add(rod);
    rods.push(rod);
  }
  // wing root servo blocks, up at the wing roots
  const roots = [];
  for (const s of [-1, 1]) {
    const blk = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.007, 0.009, 2, 0.002), M.lavender);
    blk.castShadow = true;
    blk.position.set(s * 0.0155, 0.006, 0.005);
    root.add(blk);
    roots.push(blk);
  }
  return {root, gears, pinion, ring, crank, pinL, rods, roots};
}

export function buildHead(M) {
  const root = new THREE.Group(); // posed at the neck top by geometry.js
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 28, 20), M.shell);
  skull.scale.set(0.92, 0.86, 1);
  skull.castShadow = true;
  root.add(skull);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.0088, 0.0011, 8, 28).rotateX(Math.PI / 2), M.trim);
  collar.position.y = -0.004;
  root.add(collar);
  // two optics: dark lenses with an IR-cyan rim, front-left and front-right
  const lenses = [];
  for (const s of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0048, 0.004, 24).rotateX(Math.PI / 2), M.lens);
    lens.position.set(s * 0.0045, 0.001, 0.0088);
    root.add(lens);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0044, 0.0006, 6, 24), M.ir);
    rim.position.set(s * 0.0045, 0.001, 0.0106);
    root.add(rim);
    lenses.push(lens);
  }
  // antennae: back-swept tubes with tip beads, posed to sway with the stroke
  const antennae = [];
  for (const s of [-1, 1]) {
    const ant = new THREE.Group();
    ant.position.set(s * 0.0035, 0.007, -0.002);
    const curve = new THREE.Mesh(new THREE.CylinderGeometry(0.00028, 0.00014, 0.022, 6), M.dark);
    curve.rotation.x = 1.95;
    curve.rotation.z = s * 0.4;
    curve.position.set(0, 0.004, -0.008);
    curve.castShadow = true;
    ant.add(curve);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0007, 10, 8), M.accent);
    tip.position.set(s * 0.006, 0.001, -0.017);
    ant.add(tip);
    root.add(ant);
    antennae.push(ant);
  }
  return {root, lenses, antennae};
}

export function buildAbdomen(M) {
  const root = new THREE.Group();
  const caps = new THREE.Mesh(new THREE.CapsuleGeometry(0.0102, 0.026, 6, 20).rotateX(Math.PI / 2), M.shell);
  caps.castShadow = true;
  caps.receiveShadow = true;
  root.add(caps);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.0101, 0.0011, 8, 32).rotateY(Math.PI / 2), M.cyanTrim);
  band.position.z = 0.008;
  root.add(band);
  // battery train: two cells visible through the port
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.0012, 20).rotateX(Math.PI / 2), M.glass);
  port.position.set(0, 0.0075, 0.002);
  root.add(port);
  const cells = [];
  for (const s of [-1, 1]) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.010, 14).rotateX(Math.PI / 2), M.cell);
    cell.position.set(s * 0.0032, 0.0025, 0.002);
    root.add(cell);
    cells.push(cell);
  }
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.0016, 0.007, 12).rotateX(-Math.PI / 2), M.dark);
  sting.position.z = -0.025;
  root.add(sting);
  return {root, cells};
}

const LEG_Z = [0.012, 0.0, -0.012];
export function buildLegs(M) {
  const root = new THREE.Group();
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? 1 : -1; // L1..L3 then R1..R3
    const side = new THREE.Group();
    const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0008, 1, 8), M.dark);
    femur.castShadow = true;
    const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0004, 1, 8), M.dark);
    tibia.castShadow = true;
    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 10, 8), M.lavender);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 8, 6), M.lavender);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.0009, 8, 6), M.dark);
    side.add(hip, femur, knee, tibia, foot);
    root.add(side);
    legs.push({side, hip, femur, knee, tibia, foot, s, zi: i % 3});
  }
  return {root, legs};
}

/** pose one tucked leg: hip at the thorax underside, femur down-out, tibia folded under */
export function poseLeg(L, p, t) {
  const z = LEG_Z[L.zi];
  const hx = L.s * 0.010;
  const hip = new V3(hx, -0.008, z);
  const jitter = 0.05 * Math.sin(p * Math.PI * 2 + L.zi * 1.1) + 0.03 * Math.sin(t * 0.9 + L.zi);
  const knee = new V3(hx + L.s * (0.006 + 0.001 * jitter), hip.y - 0.0085, z + 0.003);
  const foot = new V3(knee.x + L.s * 0.0015, knee.y - 0.0105, knee.z - 0.008);
  const setSeg = (mesh, a, b) => {
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, a.distanceTo(b), 1);
    mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
  };
  L.hip.position.copy(hip);
  setSeg(L.femur, hip, knee);
  L.knee.position.copy(knee);
  setSeg(L.tibia, knee, foot);
  L.foot.position.copy(foot);
  return {hip, knee, foot};
}
