// One Mellis HB-7 wing: the flap hinge (rotation.z = stroke) carrying a twist hinge
// (rotation.x = chord angle of attack), the translucent membrane with five veins and the
// leading-edge spar. Built once for the left side; the right wing reuses it inside a
// scale.x = −1 group, which mirrors it exactly (the model's symmetry the check asserts).
import * as THREE from 'three';

const V3 = THREE.Vector3;

/** the forewing planform as a flat shape in the span (x) / chord (y) plane, leading edge +y;
 * rotated into the wing plane below so the chord runs along z with the LE at +z. */
const membraneShape = () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.010); // root leading corner
  s.bezierCurveTo(0.012, 0.013, 0.03, 0.012, 0.046, 0.006); // leading edge out to the tip
  s.bezierCurveTo(0.0505, 0.003, 0.049, -0.002, 0.044, -0.004); // rounded tip
  s.bezierCurveTo(0.03, -0.008, 0.016, -0.009, 0.004, -0.007); // trailing edge home
  s.lineTo(0, 0.010);
  return s;
};

export function buildWing(M) {
  const root = new THREE.Group();
  // flap hinge on the thorax wall
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.008, 20).rotateZ(Math.PI / 2), M.steel);
  hinge.castShadow = true;
  root.add(hinge);
  const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0046, 0.0032, 20).rotateZ(Math.PI / 2), M.accent);
  hubCap.position.x = 0.0042;
  root.add(hubCap);

  const flap = new THREE.Group();
  flap.position.x = 0.0042;
  root.add(flap);

  // twist hinge: the spar runs out along +x, membrane and veins hang off it
  const twist = new THREE.Group();
  flap.add(twist);
  const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0005, 0.047, 10).rotateZ(Math.PI / 2), M.trim);
  spar.position.set(0.0235, 0, 0.008);
  spar.castShadow = true;
  twist.add(spar);

  const memGeo = new THREE.ShapeGeometry(membraneShape(), 24);
  memGeo.rotateX(Math.PI / 2); // shape y (chord) → world z, leading edge at +z
  const mem = new THREE.Mesh(memGeo, M.membrane);
  twist.add(mem);

  // five veins from the root to the trailing edge, holding the membrane
  const VEIN_ENDS = [
    [0.044, -0.004],
    [0.036, -0.007],
    [0.027, -0.0085],
    [0.017, -0.008],
    [0.008, -0.006],
  ];
  const veinGeo = new THREE.CylinderGeometry(0.00026, 0.00042, 1, 6);
  for (const [ex, ez] of VEIN_ENDS) {
    const from = new V3(0.002, 0, 0.006);
    const to = new V3(ex, 0, ez);
    const len = from.distanceTo(to);
    const vein = new THREE.Mesh(veinGeo, M.vein);
    vein.scale.set(1, len, 1);
    vein.position.copy(from).add(to).multiplyScalar(0.5);
    vein.quaternion.setFromUnitVectors(new V3(0, 1, 0), to.clone().sub(from).normalize());
    twist.add(vein);
  }
  return {root, flap, twist, spar};
}

/** the wingtip's local position on the spar (for the 3D tip trace and the labels) */
export const WING_TIP = new THREE.Vector3(0.047, 0, 0.006);
export const WING_MID = new THREE.Vector3(0.024, 0, 0.003);
