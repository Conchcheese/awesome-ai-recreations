// The OC-8's optic array: two 82 mm lens units on a white brow band at the front of the mantle,
// each a white barrel with a dark inner tube that racks focus, a glass front, an orange rim and
// a thin IR ring that lights with the pulse.
import * as THREE from 'three';
import {G} from './model.js';

export function buildOptics(M) {
  const root = new THREE.Group();
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    root.add(m);
    return m;
  };

  // the brow band the lenses mount to: a curved white plate on the mantle's upper front
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.207, 12, 8, -0.66, 1.32, 0.42, 0.4), M.white);
  brow.scale.set(1, 1, 0.92);
  brow.castShadow = true;
  root.add(brow);

  const units = [1, -1].map((sx) => {
    const unit = new THREE.Group();
    const az = sx * 0.3; // rack out a little from the front centre
    unit.position.set(Math.sin(az) * 0.183, 0.108, Math.cos(az) * 0.17);
    unit.rotation.set(0.32, az, 0);
    root.add(unit);
    const barrel = add(new THREE.CylinderGeometry(0.047, 0.051, 0.058, 28), M.white);
    barrel.rotation.x = Math.PI / 2;
    const rim = add(new THREE.TorusGeometry(0.046, 0.0075, 8, 32), M.orange);
    rim.position.z = 0.028;
    const focus = new THREE.Group();
    unit.add(focus);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 24), M.dark);
    tube.rotation.x = Math.PI / 2;
    tube.castShadow = true;
    focus.add(tube);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.006, 24), M.glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.027;
    focus.add(lens);
    const ir = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.003, 6, 28), M.ir.clone());
    ir.position.z = 0.03;
    focus.add(ir);
    // three focus ribs on the barrel
    for (let i = 0; i < 3; i++) {
      const rib = add(new THREE.BoxGeometry(0.006, 0.062, 0.008), M.dark);
      const a = (i / 3) * Math.PI * 2 + 0.5;
      rib.position.set(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.012);
    }
    return {unit, focus, ir, homeZ: 0};
  });

  return {
    root,
    units,
    /** focus 0..1 racks the inner tubes, ir 0..1 lights the rings */
    set(focus, ir) {
      for (const u of units) {
        u.focus.position.z = 0.004 + focus * 0.012;
        u.ir.material.emissiveIntensity = 0.05 + ir * 0.85;
      }
    },
  };
}
