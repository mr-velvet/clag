import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

let gltfLoader, fbxLoader, objLoader;

function getGltfLoader() {
  if (gltfLoader) return gltfLoader;
  gltfLoader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/');
  gltfLoader.setDRACOLoader(draco);
  return gltfLoader;
}

export async function loadModelFromUrl(url, ext) {
  ext = (ext || '').toLowerCase();
  if (ext === 'glb' || ext === 'gltf' || !ext) {
    const data = await getGltfLoader().loadAsync(url);
    const root = data.scene || data.scenes?.[0];
    if (!root) throw new Error('gltf: empty scene');
    return finalize(root);
  }
  if (ext === 'fbx') {
    fbxLoader ||= new FBXLoader();
    const root = await fbxLoader.loadAsync(url);
    return finalize(root);
  }
  if (ext === 'obj') {
    objLoader ||= new OBJLoader();
    const root = await objLoader.loadAsync(url);
    return finalize(root);
  }
  throw new Error(`unsupported format: ${ext}`);
}

function finalize(root) {
  // unify pivot: center on XZ, ground Y=0
  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) {
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // shift so bottom touches y=0 and XZ centered on origin
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    // normalize scale: if hugely big or tiny, scale to ~2u diagonal
    const diag = size.length();
    if (diag > 30 || diag < 0.05) {
      const target = 2;
      const s = target / diag;
      root.scale.multiplyScalar(s);
      // re-fit Y to ground after scale
      const b2 = new THREE.Box3().setFromObject(root);
      root.position.y -= b2.min.y;
    }
  }
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}
