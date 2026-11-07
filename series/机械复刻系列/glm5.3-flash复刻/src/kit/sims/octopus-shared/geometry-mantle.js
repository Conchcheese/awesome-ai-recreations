// The OC-8's mantle shell: the dark glossy under-bowl, a tangle of black cables (the brain core)
// sitting in it, the reactor ring with its 7 pistons at the bowl's mouth, eight white armour
// petals that hinge open like a flower, the riveted rim they hinge from, and the glass port with
// its orange ring on the front. The petals breathe with the pulse and swing wide when the tour
// opens the mantle; the brain rises and turns as it does.
import * as THREE from 'three';
import {rng} from '../kit/util.js';
import {G} from './model.js';

const V3 = THREE.Vector3;

export function buildMantle(M) {
  const root = new THREE.Group();
  const add = (parent, geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ------------------------------------------------------------ under-bowl (dark gloss)
  const bowlPts = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    // from the throat up and out: a bowl that flares to the rim
    bowlPts.push(new THREE.Vector2(0.028 + 0.135 * Math.pow(u, 0.8), -0.115 + 0.125 * u));
  }
  const bowl = add(root, new THREE.LatheGeometry(bowlPts, 48), M.darkDS);

  // ------------------------------------------------------------ brain core: tangled cables + clips
  const brain = new THREE.Group();
  brain.position.y = 0.03;
  root.add(brain);
  {
    const r = rng(20260101);
    const torus = new THREE.TorusGeometry(1, 1, 5, 12, Math.PI * (1.1 + r() * 1.2));
    const cables = new THREE.InstancedMesh(torus, M.cable, 40);
    cables.frustumCulled = false;
    cables.castShadow = true;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < 40; i++) {
      e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      q.setFromEuler(e);
      const rad = 0.016 + r() * 0.042;
      const tube = 0.003 + r() * 0.0025;
      m4.compose(new V3((r() - 0.5) * 0.075, (r() - 0.5) * 0.06, (r() - 0.5) * 0.075), q, new V3(rad, rad, tube));
      cables.setMatrixAt(i, m4);
    }
    brain.add(cables);
    // orange clips pinching the cables
    const clip = new THREE.InstancedMesh(new THREE.BoxGeometry(0.007, 0.0028, 0.0045), M.orange, 12);
    clip.frustumCulled = false;
    for (let i = 0; i < 12; i++) {
      e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      m4.compose(new V3((r() - 0.5) * 0.08, (r() - 0.5) * 0.06, (r() - 0.5) * 0.08), q.setFromEuler(e), new V3(1, 1, 1));
      clip.setMatrixAt(i, m4);
    }
    brain.add(clip);
  }

  // ------------------------------------------------------------ reactor ring + 7 pistons at the bowl mouth
  const reactor = new THREE.Group();
  reactor.position.y = -0.005;
  root.add(reactor);
  add(reactor, new THREE.TorusGeometry(0.072, 0.011, 8, 28).rotateX(Math.PI / 2), M.orange);
  const piston = new THREE.BoxGeometry(0.016, 0.022, 0.01);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const p = add(reactor, piston, M.steel);
    p.position.set(Math.cos(a) * 0.072, 0.004, Math.sin(a) * 0.072);
    p.rotation.y = -a;
  }

  // ------------------------------------------------------------ the eight shell petals
  const R = 0.205; // dome radius the petals belong to (dome centre = the mantle origin)
  const THETA = 62 * (Math.PI / 180); // how far down from the top they reach (the hinge line)
  const hingeR = R * Math.sin(THETA);
  const hingeY = R * Math.cos(THETA); // the hinge plane sits where the dome reaches hingeR
  const petals = [];
  const azSpan = (Math.PI * 2) / G.PETALS;
  const gap = 3.2 * (Math.PI / 180);
  for (let i = 0; i < G.PETALS; i++) {
    const az = i * azSpan;
    // one shell segment per petal, swung to its azimuth and hung from its hinge point
    const g = new THREE.SphereGeometry(R, 7, 9, az + gap, azSpan - 2 * gap, 0, THETA);
    g.scale(1, 1, 0.92); // slightly squat dome
    const h = new V3(Math.sin(az) * hingeR, hingeY, Math.cos(az) * hingeR);
    g.translate(-h.x, -h.y, -h.z);
    const pivot = new THREE.Group();
    pivot.position.copy(h);
    const petal = new THREE.Mesh(g, M.whiteDS);
    petal.castShadow = true;
    petal.receiveShadow = true;
    pivot.add(petal);
    root.add(pivot);
    petals.push({pivot, az});
  }
  // the riveted drum band between the bowl rim and the hinge ring
  const drum = add(root, new THREE.CylinderGeometry(hingeR + 0.002, 0.163, hingeY - 0.008, 48, 1, true), M.white);
  drum.position.y = (hingeY - 0.008) / 2 + 0.004;
  drum.material = M.white;
  // rivets along the rim ring
  {
    const rivet = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0045, 8, 6), M.dark, G.PETALS * 4);
    rivet.frustumCulled = false;
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < G.PETALS * 4; i++) {
      const a = (i / (G.PETALS * 4)) * Math.PI * 2;
      m4.setPosition(Math.sin(a) * (hingeR + 0.012), hingeY + 0.014, Math.cos(a) * (hingeR + 0.012));
      rivet.setMatrixAt(i, m4);
    }
    root.add(rivet);
  }
  // the rim ring the petals hinge from
  add(root, new THREE.TorusGeometry(hingeR + 0.004, 0.008, 8, 48).rotateX(Math.PI / 2).translate(0, hingeY, 0), M.white);

  // ------------------------------------------------------------ glass port on the front of the drum band
  const port = new THREE.Group();
  port.position.set(0, 0.048, 0.172);
  root.add(port);
  const glass = add(port, new THREE.CylinderGeometry(0.055, 0.055, 0.012, 32).rotateX(Math.PI / 2), M.glass);
  glass.position.z = 0.004;
  add(port, new THREE.TorusGeometry(0.058, 0.0085, 8, 40), M.orange);
  // the mechanism behind the glass: a dark gear face
  const gearFace = add(port, new THREE.CylinderGeometry(0.04, 0.04, 0.01, 24).rotateX(Math.PI / 2), M.dark);
  gearFace.position.z = -0.002;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spoke = add(port, new THREE.BoxGeometry(0.0095, 0.0038, 0.012), M.orange);
    spoke.position.set(Math.cos(a) * 0.022, Math.sin(a) * 0.022, -0.001);
    spoke.rotation.z = a;
  }

  const HINGE_AXIS = new V3();
  return {root, petals, brain, reactor, port, bowl, R, hingeY, hingeR,
    /** petal hinge angle per frame: swing outward about each rim tangent (a real axis-angle hinge) */
    setPetal(angle) {
      for (const {pivot, az} of petals) {
        HINGE_AXIS.set(Math.cos(az), 0, -Math.sin(az));
        pivot.setRotationFromAxisAngle(HINGE_AXIS, angle);
      }
    },
    setBrain(rise, turn) {
      brain.position.y = 0.03 + rise;
      brain.rotation.y = turn;
    },
  };
}
