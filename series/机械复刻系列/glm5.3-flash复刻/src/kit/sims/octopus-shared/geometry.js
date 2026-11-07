// The whole OC-8, assembled: the mantle (with its brain, reactor ring, shell petals and glass
// port), the optic array, the siphon, the beak, the hub ring the arms mount to, and eight arms.
// update(input) is the only thing that moves parts, and every angle it applies comes from
// model.js. input: {p, mantle, siphon, beak, armApart:{arm,k}, explode, wake, wakeT, t}.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {armCmd, beakState, mantleBreath, opticState, petalAngle, siphonState, G} from './model.js';
import {buildArm} from './geometry-arm.js';
import {buildMantle} from './geometry-mantle.js';
import {buildOptics} from './geometry-head.js';
import {buildSiphon} from './geometry-siphon.js';
import {buildBeak} from './geometry-beak.js';

const V3 = THREE.Vector3;

export function buildMaterials() {
  return {
    white: new THREE.MeshPhysicalMaterial({color: '#f1f3f4', roughness: 0.4, metalness: 0, clearcoat: 0.32, clearcoatRoughness: 0.4}),
    dark: new THREE.MeshPhysicalMaterial({color: '#191c20', roughness: 0.32, metalness: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.3}),
    cable: new THREE.MeshStandardMaterial({color: '#20242a', roughness: 0.75, metalness: 0.1}),
    orange: new THREE.MeshPhysicalMaterial({color: '#2f9fe0', roughness: 0.36, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    steel: new THREE.MeshStandardMaterial({color: '#c9ccd1', roughness: 0.3, metalness: 0.9}),
    glass: new THREE.MeshPhysicalMaterial({color: '#101114', roughness: 0.08, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.06}),
    ir: new THREE.MeshStandardMaterial({color: '#0a1c30', emissive: '#54c8ff', emissiveIntensity: 0.3, roughness: 0.4}),
    whiteDS: new THREE.MeshPhysicalMaterial({color: '#f1f3f4', roughness: 0.4, metalness: 0, clearcoat: 0.32, clearcoatRoughness: 0.4, side: THREE.DoubleSide}),
    darkDS: new THREE.MeshPhysicalMaterial({color: '#191c20', roughness: 0.32, metalness: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.3, side: THREE.DoubleSide}),
    bubble: new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false}),
  };
}

const ARM_AZ = (i) => (i + 0.5) * ((Math.PI * 2) / G.ARMS); // 8 arms, none blocking the front
export const ARM_NAME = (i) => (i < 4 ? `R${i + 1}` : `L${i - 3}`); // right fore-to-aft, then left

export function buildOctopus() {
  const M = buildMaterials();
  const root = new THREE.Group();
  const all = [];
  const collect = (g) => g.traverse((o) => o.isMesh && all.push(o));

  const mantle = buildMantle(M);
  root.add(mantle.root);
  const optics = buildOptics(M);
  root.add(optics.root);
  const siphon = buildSiphon(M);
  root.add(siphon.root);
  const beak = buildBeak(M);
  root.add(beak.root);

  // the hub ring the arms mount to, over the beak's dome
  const hub = new THREE.Group();
  hub.position.y = -0.085;
  root.add(hub);
  const hubRing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.145, 0.03, 48), M.white);
  hubRing.castShadow = true;
  hubRing.receiveShadow = true;
  hub.add(hubRing);
  const hubTrim = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.006, 6, 48).rotateX(Math.PI / 2), M.orange);
  hub.add(hubTrim);
  for (let i = 0; i < 8; i++) {
    const a = ARM_AZ(i);
    const bolt = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.036, 0.034, 2, 0.008), M.white);
    bolt.castShadow = true;
    bolt.position.set(Math.sin(a) * 0.135, 0.008, Math.cos(a) * 0.135);
    bolt.rotation.y = -a;
    hub.add(bolt);
  }

  const arms = [];
  for (let i = 0; i < G.ARMS; i++) {
    const arm = buildArm(M);
    root.add(arm.group);
    arms.push(arm);
  }
  collect(root);

  // ------------------------------------------------------------ jet wake: instanced bubbles, closed form in t
  const WAKE_N = 42;
  const wake = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.bubble, WAKE_N);
  wake.frustumCulled = false;
  wake.visible = false;
  root.add(wake);
  const tip = new V3();
  const S1 = new V3();

  // explode offsets per assembly (staging, not model math), and the assemblies' home positions
  const OFF = {
    mantle: new V3(0, 0.18, 0),
    optics: new V3(0, 0.32, 0.26),
    siphon: new V3(0, -0.04, -0.3),
    beak: new V3(0, -0.32, 0),
  };
  const ASM = [
    ['mantle', mantle.root],
    ['optics', optics.root],
    ['siphon', siphon.root],
    ['beak', beak.root],
  ];
  for (const [, g] of ASM) g.userData.home = g.position.clone();

  const out = {p: 0};
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new V3();
  /** the one update: everything on the machine reads model.js through here */
  const update = ({p = 0, mantle: mantleOpen = 0, siphon: siphonOpen = 0, beak: beakOpen = 0, armApart = null, armYield = 0, explode = 0, wake: wakeK = 0, wakeT = 0, tilt = 0, dy = 0} = {}) => {
    out.p = p;
    root.rotation.x = tilt;
    root.position.y = dy;
    const breath = mantleBreath(p);
    // mantle breathes: the bowl and everything mounted on it scales a little
    mantle.root.scale.set(breath.r, breath.len, breath.r);
    mantle.setPetal(petalAngle(p, mantleOpen));
    mantle.setBrain(0.02 + mantleOpen * 0.12, p * Math.PI * 0.8 + mantleOpen * 1.4);
    const o = opticState(p);
    optics.set(o.focus, o.ir);
    const s = siphonState(p, siphonOpen);
    siphon.set(s.extend, s.spread);
    const b = beakState(p, beakOpen);
    beak.set(beakOpen, b.radula);
    for (let i = 0; i < G.ARMS; i++) {
      const cmd = armCmd(i, p, armApart, armYield);
      arms[i].pose(ARM_AZ(i), cmd);
      // explode: arms drift out along their azimuth
      arms[i].group.position.set(Math.sin(ARM_AZ(i)) * 0.13 * explode, -0.05 * explode, Math.cos(ARM_AZ(i)) * 0.13 * explode);
    }
    for (const [k, g] of ASM) g.position.copy(g.userData.home).addScaledVector(OFF[k], explode);
    // jet wake: bubbles streaming aft of the nozzle, positions closed-form in wakeT
    wake.visible = wakeK > 0.02;
    if (wake.visible) {
      siphon.nozzleTip(tip);
      for (let i = 0; i < WAKE_N; i++) {
        const u = (i / WAKE_N + wakeT * 0.9) % 1;
        const spread = 0.02 + u * 0.09;
        const ang = i * 2.39996;
        m4.compose(
          v.set(tip.x + Math.cos(ang) * spread * u, tip.y - 0.05 * u * u - 0.01 * u, tip.z - (0.05 + u * 0.7) * (0.4 + 0.6 * wakeK)),
          q,
          S1.set(1, 1, 1).multiplyScalar(0.006 * (1 - u) * (0.4 + wakeK)),
        );
        wake.setMatrixAt(i, m4);
      }
      wake.instanceMatrix.needsUpdate = true;
      M.bubble.opacity = 0.25 + 0.3 * wakeK;
    }
  };
  update();
  return {root, update, M, all, mantle, optics, siphon, beak, hub, arms, ARM_AZ, ARM_NAME, out};
}
