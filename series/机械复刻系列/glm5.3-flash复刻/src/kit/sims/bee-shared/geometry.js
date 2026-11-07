// The whole Mellis HB-7, assembled: thorax with the drive train, the two wings (the right
// one mirrored), the optic head on its neck, the abdomen capsule, six tucked legs and the
// 3D wingtip trace. update(input) is the only thing that moves parts, and every angle it
// applies comes from model.js. input: {p, ballast, explode, tipTrace, t, dy, pitchTilt}.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {strokeAngle, twistAngle, crankAngle, gearAngle, ballastSlide} from './model.js';
import {buildWing, WING_TIP} from './geometry-wings.js';
import {buildThorax, buildHead, buildAbdomen, buildLegs, poseLeg} from './geometry-body.js';

const V3 = THREE.Vector3;

export function buildMaterials() {
  return {
    shell: new THREE.MeshPhysicalMaterial({color: '#eef1f5', roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4}),
    shellDark: new THREE.MeshPhysicalMaterial({color: '#2b3c55', roughness: 0.44, metalness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    dark: new THREE.MeshPhysicalMaterial({color: '#16233a', roughness: 0.42, metalness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    accent: new THREE.MeshPhysicalMaterial({color: '#1e5fd6', roughness: 0.4, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.3}),
    trim: new THREE.MeshStandardMaterial({color: '#3d8fe0', roughness: 0.45, metalness: 0.55}),
    cyanTrim: new THREE.MeshStandardMaterial({color: '#12aecb', roughness: 0.45, metalness: 0.5}),
    lavender: new THREE.MeshStandardMaterial({color: '#8c8fd0', roughness: 0.5, metalness: 0.45}),
    steel: new THREE.MeshStandardMaterial({color: '#c9ccd1', roughness: 0.32, metalness: 0.9}),
    gear: new THREE.MeshStandardMaterial({color: '#9fb3c8', roughness: 0.4, metalness: 0.85}),
    gearDark: new THREE.MeshStandardMaterial({color: '#3a4a63', roughness: 0.42, metalness: 0.8}),
    glass: new THREE.MeshPhysicalMaterial({color: '#0e1c30', roughness: 0.1, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08}),
    window: new THREE.MeshPhysicalMaterial({color: '#a9c4e0', transparent: true, opacity: 0.32, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false}),
    lens: new THREE.MeshPhysicalMaterial({color: '#0a1526', roughness: 0.06, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.05}),
    ir: new THREE.MeshStandardMaterial({color: '#0a1c30', emissive: '#54c8ff', emissiveIntensity: 0.45, roughness: 0.4}),
    cell: new THREE.MeshStandardMaterial({color: '#2a9d8f', roughness: 0.45, metalness: 0.35}),
    membrane: new THREE.MeshPhysicalMaterial({color: '#cfe6f7', transparent: true, opacity: 0.55, roughness: 0.32, metalness: 0, side: THREE.DoubleSide, depthWrite: false}),
    vein: new THREE.MeshStandardMaterial({color: '#6aa7d6', roughness: 0.45, metalness: 0.2}),
    trace: new THREE.LineBasicMaterial({color: '#12aecb', transparent: true, opacity: 0.85}),
  };
}

export function buildBee() {
  const M = buildMaterials();
  const root = new THREE.Group();
  const collect = (g) => g.traverse((o) => o.isMesh && (o.castShadow = true));

  const thorax = buildThorax(M);
  thorax.root.position.z = 0.004;
  root.add(thorax.root);

  const head = buildHead(M);
  head.root.position.set(0, 0.002, 0.030);
  root.add(head.root);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0045, 0.010, 16), M.lavender);
  neck.position.set(0, 0.001, 0.022);
  neck.rotation.x = Math.PI / 2;
  neck.castShadow = true;
  root.add(neck);

  const abdomen = buildAbdomen(M);
  abdomen.root.position.set(0, -0.001, -0.032);
  root.add(abdomen.root);

  const legs = buildLegs(M);
  root.add(legs.root);

  // wings: the right one is the left one mirrored through a scale.x = −1 group
  const wingL = buildWing(M);
  const wingR = buildWing(M);
  const mirrorR = new THREE.Group();
  mirrorR.scale.x = -1;
  mirrorR.add(wingR.root);
  wingL.root.position.set(0.017, 0.006, 0.005);
  mirrorR.position.set(-0.017, 0.006, 0.005);
  root.add(wingL.root, mirrorR);

  // the wingtip trace (06 显示 · 翼尖轨迹): the true 3D tip path over one stroke —
  // twist about the span axis first, then the flap rotation, sampled from the model
  const TR_N = 96;
  const tipV = new V3();
  const qFlap = new THREE.Quaternion();
  const qTwist = new THREE.Quaternion();
  const AXZ = new V3(0, 0, 1);
  const AXX = new V3(1, 0, 0);
  const tracePts = [];
  for (let i = 0; i <= TR_N; i++) {
    const th = strokeAngle(i / TR_N);
    const al = twistAngle(i / TR_N);
    tipV.copy(WING_TIP);
    qTwist.setFromAxisAngle(AXX, al);
    qFlap.setFromAxisAngle(AXZ, th);
    tipV.applyQuaternion(qTwist).applyQuaternion(qFlap);
    tracePts.push(tipV.clone());
  }
  const trace = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tracePts), M.trace);
  trace.visible = false;
  wingL.root.add(trace);

  collect(root);

  // explode offsets per assembly, and their home positions
  const OFF = {
    wingL: new V3(0.075, 0.04, 0),
    wingR: new V3(-0.075, 0.04, 0),
    head: new V3(0, 0.035, 0.075),
    abdomen: new V3(0, -0.015, -0.08),
    legs: new V3(0, -0.035, 0),
  };
  const home = {
    wingL: wingL.root.position.clone(),
    wingR: mirrorR.position.clone(),
    head: head.root.position.clone(),
    abdomen: abdomen.root.position.clone(),
    legs: legs.root.position.clone(),
  };

  const v = new V3();
  const up = new V3(0, 1, 0);
  const out = {p: 0};

  /** the one update: everything on the machine reads model.js through here */
  const update = ({p = 0, ballast = 0, explode = 0, tipTraceOn = false, t = 0, dy = 0, pitchTilt = 0, wingApart = 0} = {}) => {
    out.p = p;
    root.position.y = dy;
    root.rotation.x = pitchTilt;
    // wings: same stroke both sides (hover), twist about the span axis
    const th = strokeAngle(p);
    const al = twistAngle(p);
    wingL.flap.rotation.z = th;
    wingL.twist.rotation.x = al;
    wingR.flap.rotation.z = th;
    wingR.twist.rotation.x = al;
    // drive train: crank one turn per stroke, ring gear on the tooth ratio
    thorax.crank.rotation.x = crankAngle(p);
    thorax.ring.rotation.x = gearAngle(p);
    thorax.pinion.rotation.x = -crankAngle(p);
    const [py, pz] = [0.0075 * Math.cos(crankAngle(p)), 0.0075 * Math.sin(crankAngle(p))];
    thorax.pinL.position.set(0, py, pz);
    // connecting rods: crank pin → wing-root lever, stretched to span
    const rootL = new V3(0.0155, 0.006, 0.006);
    const rootR = new V3(-0.0155, 0.006, 0.006);
    const pinL = new V3(0.0015, -0.002 + py, 0.001 + pz);
    const pinR = new V3(0.0015, -0.002 + py, 0.001 + pz);
    const setRod = (mesh, a, b) => {
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.scale.set(1, a.distanceTo(b), 1);
      mesh.quaternion.setFromUnitVectors(up, v.copy(b).sub(a).normalize());
    };
    setRod(thorax.rods[0], pinL, rootL);
    setRod(thorax.rods[1], pinR, rootR);
    // head + antennae: a small stabilised counter-bob
    head.root.rotation.z = 0.1 * Math.sin(p * Math.PI * 2);
    head.root.rotation.x = 0.06 * Math.sin(p * Math.PI * 2 + 1);
    for (let i = 0; i < 2; i++) head.antennae[i].rotation.z = (i ? -1 : 1) * 0.08 * Math.sin(p * Math.PI * 2 + 0.6);
    // abdomen: ballast slide forward with the tour's trim input
    abdomen.root.position.z = home.abdomen.z + ballastSlide(ballast);
    // legs: tucked, tremble with the stroke
    for (const L of legs.legs) poseLeg(L, p, t);
    // explode: assemblies drift apart; the tour's wing beat slides the left wing out first
    wingL.root.position.copy(home.wingL).addScaledVector(OFF.wingL, explode).add({x: 0.045 * wingApart, y: 0.018 * wingApart, z: 0});
    mirrorR.position.copy(home.wingR).addScaledVector(OFF.wingR, explode);
    head.root.position.copy(home.head).addScaledVector(OFF.head, explode);
    abdomen.root.position.x = home.abdomen.x;
    abdomen.root.position.y = home.abdomen.y + OFF.abdomen.y * explode;
    abdomen.root.position.z = home.abdomen.z + ballastSlide(ballast) + OFF.abdomen.z * explode;
    legs.root.position.copy(home.legs).addScaledVector(OFF.legs, explode);
    // 3D tip trace
    trace.visible = tipTraceOn;
  };
  update();
  return {root, update, M, thorax, head, abdomen, legs, wingL, wingR, out};
}
