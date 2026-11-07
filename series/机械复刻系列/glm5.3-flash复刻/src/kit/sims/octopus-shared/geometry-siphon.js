// The OC-8's siphon, at the rear under the mantle: a white funnel housing, three telescoping
// sleeves that extend on the exhaust, and the 6-flap nozzle at the end. The jet wake reads
// this nozzle's position.
import * as THREE from 'three';
import {G} from './model.js';

export function buildSiphon(M) {
  const root = new THREE.Group();
  root.position.set(0, 0.03, -0.185);
  root.rotation.x = 0.5; // aimed down and aft
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    root.add(m);
    return m;
  };

  // the funnel housing on the mantle's rear
  const funnel = add(new THREE.CylinderGeometry(0.052, 0.068, 0.05, 28), M.white);
  funnel.position.z = -0.01;
  funnel.rotation.x = Math.PI / 2;
  const trim = add(new THREE.TorusGeometry(0.054, 0.006, 8, 28), M.orange);
  trim.position.z = 0.012;

  const sleeves = [];
  for (let i = 0; i < G.SIPHON_SLEEVES; i++) {
    const d = 0.044 - i * 0.008;
    const len = 0.05;
    const sleeve = new THREE.Group();
    root.add(sleeve);
    const tube = add(new THREE.CylinderGeometry(d / 2, d / 2, len, 20), i % 2 ? M.white : M.dark);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -len / 2;
    const ring = add(new THREE.TorusGeometry(d / 2 + 0.002, 0.004, 6, 20), i === 1 ? M.orange : M.steel);
    ring.position.z = -len;
    sleeves.push(sleeve);
  }

  // the 6-flap nozzle on the last sleeve: each flap hinges outward around its tangential axis
  const nozzle = new THREE.Group();
  root.add(nozzle);
  const hub = add(new THREE.CylinderGeometry(0.017, 0.013, 0.014, 16), M.dark);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.007;
  const flaps = [];
  for (let i = 0; i < G.NOZZLE_FLAPS; i++) {
    const a = (i / G.NOZZLE_FLAPS) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.z = a; // pivot's +y points radially out
    nozzle.add(pivot);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.013, -0.004);
    pivot.add(hinge);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.004, 0.026), M.dark);
    flap.castShadow = true;
    flap.position.z = -0.013;
    hinge.add(flap);
    flaps.push(hinge);
  }

  const SLEEVE0 = -0.028;
  const STEP = 0.032;
  return {
    root,
    nozzle,
    nozzleTip(out) {
      // world position of the exhaust, for the jet wake
      return out.set(0, 0, sleeves[2].position.z - 0.06).applyMatrix4(root.matrixWorld);
    },
    /** extend 0..1 slides the sleeves, spread 0..1 opens the flaps */
    set(extend, spread) {
      for (let i = 0; i < sleeves.length; i++) sleeves[i].position.z = SLEEVE0 - i * (STEP + extend * 0.048);
      for (const h of flaps) h.rotation.x = -(0.08 + spread * 0.85);
    },
  };
}
