// ONE arm of the OC-8, built from code: 25 white armour links over a dark core, the joints
// showing between them, and 60 orange roller wheels (2 per joint on the flanks, plus root and
// tip clusters) like the reference's chain arms. Everything is instanced — the whole arm is a
// handful of draw calls — and pose() places every instance from model.armChain, so nothing is
// animated by hand. The other seven arms are copies of this one.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {G, armChain} from './model.js';

const V3 = THREE.Vector3;
const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const P = new V3();
const S = new V3(1, 1, 1);

// wheel stations: [joint index 0..LINKS, lateral offset, in-plane offset] — 50 flank + 6 root + 4 tip = 60
const WHEEL_STATIONS = [];
for (let j = 1; j <= G.LINKS; j++) {
  WHEEL_STATIONS.push([j, 0.0195, 0], [j, -0.0195, 0]);
}
WHEEL_STATIONS.push([0, 0.0195, 0.016], [0, -0.0195, 0.016], [0, 0.0195, -0.016], [0, -0.0195, -0.016], [0, 0, 0.022], [0, 0, -0.022]);
WHEEL_STATIONS.push([G.LINKS, 0.017, 0.008], [G.LINKS, -0.017, 0.008], [G.LINKS, 0, 0.018], [G.LINKS, 0, -0.018]);

export function buildArm(M) {
  const group = new THREE.Group();
  const links = new THREE.InstancedMesh(new RoundedBoxGeometry(0.037, 0.037, 0.032, 2, 0.008), M.white, G.LINKS);
  const cores = new THREE.InstancedMesh(new RoundedBoxGeometry(0.022, 0.012, 0.02, 1, 0.004), M.dark, G.LINKS);
  const wheelGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.0065, 14);
  wheelGeo.rotateZ(Math.PI / 2); // axle along local X
  const hubGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.0085, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const wheels = new THREE.InstancedMesh(wheelGeo, M.orange, WHEEL_STATIONS.length);
  const hubs = new THREE.InstancedMesh(hubGeo, M.dark, WHEEL_STATIONS.length);
  for (const m of [links, cores, wheels, hubs]) {
    m.castShadow = true;
    m.frustumCulled = false;
    group.add(m);
  }
  // the tip claw and the root collar are single meshes
  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.03, 10), M.dark);
  claw.castShadow = true;
  group.add(claw);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.011, 8, 20), M.white);
  collar.castShadow = true;
  group.add(collar);
  const collarTrim = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 20), M.orange);
  collar.add(collarTrim);

  // scratch shared with the caller
  const pts = new Float64Array((G.LINKS + 1) * 3);
  const pitch = new Float64Array(G.LINKS + 1);
  const lat = new V3();
  const dir = new V3();
  const nrm = new V3();
  const basis = new THREE.Matrix4();

  /** pose the arm at azimuth az with curl command cmd 0..1 */
  const pose = (az, cmd) => {
    armChain(az, cmd, pts, pitch);
    lat.set(Math.sin(az), 0, -Math.cos(az)); // the arm's flank direction
    for (let j = 0; j < G.LINKS; j++) {
      const th = pitch[j];
      dir.set(Math.cos(az) * Math.cos(th), Math.sin(th), Math.sin(az) * Math.cos(th));
      nrm.copy(dir).cross(lat); // in-plane curl direction
      basis.makeBasis(lat, dir, nrm);
      const x = (pts[j * 3] + pts[j * 3 + 3]) / 2;
      const y = (pts[j * 3 + 1] + pts[j * 3 + 4]) / 2;
      const z = (pts[j * 3 + 2] + pts[j * 3 + 5]) / 2;
      P.set(x, y, z);
      M4.compose(P, Q.setFromRotationMatrix(basis), S);
      links.setMatrixAt(j, M4);
      P.set(pts[j * 3 + 3], pts[j * 3 + 4], pts[j * 3 + 5]);
      M4.compose(P, Q, S);
      cores.setMatrixAt(j, M4);
    }
    // claw at the tip, pointing on (the basis already maps local +Y onto the chain direction)
    {
      const j = G.LINKS;
      const th = pitch[j];
      dir.set(Math.cos(az) * Math.cos(th), Math.sin(th), Math.sin(az) * Math.cos(th));
      nrm.copy(dir).cross(lat);
      basis.makeBasis(lat, dir, nrm);
      Q.setFromRotationMatrix(basis);
      claw.position.set(pts[j * 3], pts[j * 3 + 1], pts[j * 3 + 2]);
      claw.quaternion.copy(Q);
    }
    // collar around the root, facing outward
    P.set(pts[0], pts[1], pts[2]);
    collar.position.copy(P);
    collar.quaternion.setFromUnitVectors(new V3(0, 0, 1), new V3(Math.cos(az), 0.25, Math.sin(az)).normalize());
    // wheels
    for (let w = 0; w < WHEEL_STATIONS.length; w++) {
      const [j, lo, no] = WHEEL_STATIONS[w];
      const th = pitch[j];
      dir.set(Math.cos(az) * Math.cos(th), Math.sin(th), Math.sin(az) * Math.cos(th));
      nrm.copy(dir).cross(lat);
      const along = j === 0 ? 0.012 : j === G.LINKS ? -0.012 : 0;
      P.set(
        pts[j * 3] + lat.x * lo + nrm.x * no + dir.x * along,
        pts[j * 3 + 1] + lat.y * lo + nrm.y * no + dir.y * along,
        pts[j * 3 + 2] + lat.z * lo + nrm.z * no + dir.z * along,
      );
      basis.makeBasis(lat, dir, nrm);
      Q.setFromRotationMatrix(basis);
      M4.compose(P, Q, S);
      wheels.setMatrixAt(w, M4);
      hubs.setMatrixAt(w, M4);
    }
    links.instanceMatrix.needsUpdate = true;
    cores.instanceMatrix.needsUpdate = true;
    wheels.instanceMatrix.needsUpdate = true;
    hubs.instanceMatrix.needsUpdate = true;
  };
  pose(0, 0.8);
  return {group, pose, pts, pitch};
}
