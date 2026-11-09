// Export the character for the offline renderer and for GLB.
//
// Two consumers, one source of truth:
//   artifacts/scene/  -> the software rasterizer (numpy) reads it
//   artifacts/exports/ -> a glTF 2.0 binary with both endpoint poses
//
// The frames file is the same rig the browser page plays, so the movie and
// the interactive page can never drift apart.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCharacter } from '../src/model.mjs';
import { createRig } from '../src/rig.mjs';
import { cameraAt, FPS, SOURCE_DURATION, LIGHTS, AMBIENT, GROUND, BACKGROUND } from '../src/shots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneDir = path.join(root, 'artifacts', 'scene');
await mkdir(sceneDir, { recursive: true });

const character = buildCharacter();
const rig = createRig(character);

// --- meshes ---------------------------------------------------------------
const meshList = Object.entries(character.meshes);
const meshIndex = new Map();
const manifestMeshes = [];
for (let i = 0; i < meshList.length; i++) {
  const [name, g] = meshList[i];
  meshIndex.set(name, i);
  const base = `m${String(i).padStart(3, '0')}`;
  await writeFile(path.join(sceneDir, `${base}.pos.f32`), Buffer.from(g.positions.buffer, g.positions.byteOffset, g.positions.byteLength));
  await writeFile(path.join(sceneDir, `${base}.nrm.f32`), Buffer.from(g.normals.buffer, g.normals.byteOffset, g.normals.byteLength));
  await writeFile(path.join(sceneDir, `${base}.idx.u32`), Buffer.from(g.indices.buffer, g.indices.byteOffset, g.indices.byteLength));
  manifestMeshes.push({
    id: i,
    name,
    positions: `${base}.pos.f32`,
    normals: `${base}.nrm.f32`,
    indices: `${base}.idx.u32`,
    vertexCount: g.positions.length / 3,
    indexCount: g.indices.length,
  });
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  unit: 'meter',
  meshes: manifestMeshes,
  materials: character.materials,
};
await writeFile(path.join(sceneDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// --- frames ----------------------------------------------------------------
const frameCount = Math.round(SOURCE_DURATION * FPS);
const frames = [];
for (let i = 0; i < frameCount; i++) {
  const t = i / FPS;
  const mats = rig.poseAt(t);
  const instances = [];
  for (const a of character.assemblies) {
    const m = mats.get(a.id);
    const idx = meshIndex.get(a.mesh);
    if (idx === undefined) continue;
    instances.push({
      mesh: idx,
      m: Array.from(m, (v) => Math.round(v * 1e6) / 1e6),
      mat: a.material,
    });
  }
  const cam = cameraAt(t);
  frames.push({
    t: Math.round(t * 1000) / 1000,
    camera: {
      eye: cam.eye,
      target: cam.target,
      up: cam.up,
      fov: cam.fov,
      near: cam.near,
      far: cam.far,
      shotId: cam.shotId,
    },
    instances,
    exposure: 1.0,
    lights: LIGHTS,
    ambient: AMBIENT,
    ground: GROUND,
    background: BACKGROUND,
  });
}
await writeFile(
  path.join(sceneDir, 'frames.json'),
  JSON.stringify({ fps: FPS, count: frameCount, width: 1280, height: 720, frames }),
);
console.log(`scene: ${manifestMeshes.length} meshes, ${frameCount} frames, ${character.assemblies.length} instances/frame`);

// --- GLB -------------------------------------------------------------------
// Minimal glTF 2.0 writer: two scenes holding the vehicle and the robot
// pose of the same mesh data, so the export can be inspected in any viewer.
const glbDir = path.join(root, 'artifacts', 'exports');
await mkdir(glbDir, { recursive: true });

function buildGlb() {
  const buffers = [];
  const bufferViews = [];
  const accessors = [];
  const gltfMeshes = [];
  const materials = [];
  const materialIndex = new Map();
  const nodes = [];
  const scenes = [];

  const align4 = (n) => (n + 3) & ~3;
  const pushView = (bytes, target) => {
    const offset = buffers.reduce((a, b) => a + b.length, 0);
    buffers.push(bytes);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
    return bufferViews.length - 1;
  };

  for (const [name, g] of meshList) {
    const idx = meshIndex.get(name);
    const posView = pushView(Buffer.from(g.positions.buffer, g.positions.byteOffset, g.positions.byteLength), 34962);
    const nrmView = pushView(Buffer.from(g.normals.buffer, g.normals.byteOffset, g.normals.byteLength), 34962);
    const idxView = pushView(Buffer.from(g.indices.buffer, g.indices.byteOffset, g.indices.byteLength), 34963);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = g.positions[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    accessors.push({ bufferView: posView, componentType: 5126, count: g.positions.length / 3, type: 'VEC3', min, max });
    accessors.push({ bufferView: nrmView, componentType: 5126, count: g.normals.length / 3, type: 'VEC3' });
    accessors.push({ bufferView: idxView, componentType: 5125, count: g.indices.length, type: 'SCALAR' });
    gltfMeshes.push({
      name,
      primitives: [{
        attributes: { POSITION: accessors.length - 3, NORMAL: accessors.length - 2 },
        indices: accessors.length - 1,
        material: 0,
      }],
    });
    void idx;
  }

  for (const [name, def] of Object.entries(character.materials)) {
    if (materialIndex.has(name)) continue;
    materialIndex.set(name, materials.length);
    materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [...def.baseColor, 1],
        metallicFactor: def.metallic,
        roughnessFactor: def.roughness,
      },
      emissiveFactor: def.emissive || [0, 0, 0],
      doubleSided: true,
    });
  }
  // One material per mesh: every assembly that shares a mesh must agree.
  const meshMaterial = new Map();
  for (const a of character.assemblies) {
    const idx = meshIndex.get(a.mesh);
    if (idx === undefined) continue;
    const mi = materialIndex.get(a.material) ?? 0;
    if (meshMaterial.has(idx) && meshMaterial.get(idx) !== mi) {
      throw new Error(`网格 ${a.mesh} 被不同材质共用，GLB 需要拆分`);
    }
    meshMaterial.set(idx, mi);
  }
  for (const [meshIdx, mi] of meshMaterial) {
    gltfMeshes[meshIdx].primitives[0].material = mi;
  }

  const vehicleMats = rig.poseAt(0);
  const robotMats = rig.poseAt(SOURCE_DURATION);
  for (const [label, mats] of [['vehicle', vehicleMats], ['robot', robotMats]]) {
    const sceneNodes = [];
    for (const a of character.assemblies) {
      const m = mats.get(a.id);
      if (!m) continue;
      const node = {
        name: a.id,
        mesh: meshIndex.get(a.mesh),
        matrix: Array.from(m, (v) => Math.round(v * 1e6) / 1e6),
      };
      nodes.push(node);
      sceneNodes.push(nodes.length - 1);
    }
    scenes.push({ name: label, nodes: sceneNodes });
  }

  const json = {
    asset: { version: '2.0', generator: 'bumblebee-2007 minimax-m3.1-flash export' },
    scene: 0,
    scenes,
    nodes,
    meshes: gltfMeshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: buffers.reduce((a, b) => a + b.length, 0) }],
  };

  const bin = Buffer.concat(buffers);
  const jsonText = JSON.stringify(json);
  const jsonPad = Buffer.alloc(align4(jsonText.length) - jsonText.length, 0x20);
  const jsonChunk = Buffer.concat([Buffer.from(jsonText, 'utf8'), jsonPad]);
  const binPad = Buffer.alloc(align4(bin.length) - bin.length, 0);
  const binChunk = Buffer.concat([bin, binPad]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

const glb = buildGlb();
await writeFile(path.join(glbDir, 'bumblebee-2007.glb'), glb);
console.log(`glb: ${(glb.length / 1024 / 1024).toFixed(2)} MB`);
