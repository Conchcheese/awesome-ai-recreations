// The OC-8's beak, hanging under the centre between the arm roots: a dark dome base, twin jaws
// that part sideways (the console's BEAK · 50% APART), and the orange radula ring — a small
// gear — that spins with the jet between them. The jaw plates are the model's last two links
// (8 × 25 arm links + 2 jaw links = the console's 202).
import * as THREE from 'three';
import {beakState} from './model.js';

export function buildBeak(M) {
  const root = new THREE.Group();
  root.position.set(0, -0.132, 0);
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    root.add(m);
    return m;
  };

  // the dark dome the jaws hang from
  add(new THREE.SphereGeometry(0.072, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), M.dark);
  const collar = add(new THREE.TorusGeometry(0.062, 0.008, 8, 32).rotateX(Math.PI / 2), M.white);
  collar.position.y = 0.01;

  // the radula ring: a gear between the jaws
  const radula = new THREE.Group();
  radula.position.y = -0.055;
  root.add(radula);
  const teeth = 12;
  const rr = 0.026;
  const sh = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    const pts = [[rr * 0.78, a0], [rr * 0.78, a0 + da * 0.4], [rr, a0 + da * 0.55], [rr, a0 + da * 0.85]];
    pts.forEach(([r, a], k) => (i === 0 && k === 0 ? sh.moveTo(r * Math.cos(a), r * Math.sin(a)) : sh.lineTo(r * Math.cos(a), r * Math.sin(a))));
  }
  sh.closePath();
  const gear = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 3}), M.orange);
  gear.rotation.x = Math.PI / 2;
  gear.position.y = 0.007;
  gear.castShadow = true;
  radula.add(gear);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 12), M.dark);
  radula.add(axle);

  // twin jaws: curved hooks beside the radula, parting sideways
  const jawGeo = (() => {
    // a curved plate: an arc strip extruded down
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.03, 0, 0.01),
      new THREE.Vector3(0.042, -0.02, 0),
      new THREE.Vector3(0.038, -0.05, -0.006),
      new THREE.Vector3(0.02, -0.07, -0.004),
    ]);
    const sh2 = new THREE.Shape();
    sh2.moveTo(-0.008, -0.012);
    sh2.lineTo(0.008, -0.012);
    sh2.lineTo(0.006, 0.012);
    sh2.lineTo(-0.006, 0.012);
    sh2.closePath();
    return new THREE.ExtrudeGeometry(sh2, {steps: 24, extrudePath: curve, bevelEnabled: false});
  })();
  const jaws = [1, -1].map((sx) => {
    const jaw = new THREE.Mesh(jawGeo, M.dark);
    jaw.castShadow = true;
    jaw.scale.x = sx;
    root.add(jaw);
    return jaw;
  });

  return {
    root,
    /** jaw 0..1 parts the twin jaws; the radula angle comes straight from the model */
    set(jaw, radulaAngle) {
      for (const j of jaws) {
        j.position.x = j.scale.x * (0.004 + jaw * 0.052);
        j.rotation.z = -j.scale.x * jaw * 0.5;
      }
      radula.rotation.y = radulaAngle;
    },
  };
}
