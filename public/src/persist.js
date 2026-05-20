import * as THREE from 'three';
import { getUserObjects, addToScene, userRoot } from './scene.js';

const STORAGE_KEY = 'clag:scene-v1';

export function serializeScene() {
  const objs = getUserObjects().map(serializeObj);
  return { version: 1, objects: objs };
}

function serializeObj(obj) {
  const o = {
    name: obj.name,
    kind: obj.userData?.kind || 'unknown',
    position: obj.position.toArray(),
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: obj.scale.toArray(),
  };
  if (obj.userData?.assetMeta) {
    o.assetMeta = obj.userData.assetMeta;
  }
  // primitive: persist color of the first material
  const mat = firstMat(obj);
  if (mat?.color) {
    o.color = '#' + mat.color.getHexString();
    if ('roughness' in mat) o.roughness = mat.roughness;
    if ('metalness' in mat) o.metalness = mat.metalness;
  }
  // light props
  const lt = firstLight(obj);
  if (lt) {
    o.light = {
      type: lt.type,
      color: '#' + lt.color.getHexString(),
      intensity: lt.intensity,
      distance: lt.distance ?? 0,
    };
  }
  return o;
}

function firstMat(root) {
  let m = null;
  root.traverse(o => {
    if (!m && o.isMesh) {
      m = Array.isArray(o.material) ? o.material[0] : o.material;
    }
  });
  return m;
}
function firstLight(root) {
  let l = null;
  root.traverse(o => { if (!l && o.isLight) l = o; });
  return l;
}

export function saveSceneToLocal() {
  const data = serializeScene();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export async function restoreSceneFromLocal(addPrimitive, downloadAndPlaceMeta) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  let data;
  try { data = JSON.parse(raw); } catch { return false; }
  if (!data?.objects) return false;
  // we clear current userRoot to load
  while (userRoot.children.length) userRoot.remove(userRoot.children[0]);
  for (const o of data.objects) {
    try {
      await rehydrate(o, addPrimitive, downloadAndPlaceMeta);
    } catch (e) {
      console.warn('failed to restore object', o, e);
    }
  }
  return true;
}

async function rehydrate(o, addPrimitive, downloadAndPlaceMeta) {
  if (o.kind?.startsWith('primitive:')) {
    const kind = o.kind.split(':')[1];
    const obj = addPrimitive(kind);
    if (!obj) return;
    obj.name = o.name;
    obj.position.fromArray(o.position);
    obj.rotation.set(...o.rotation);
    obj.scale.fromArray(o.scale);
    const mat = firstMat(obj);
    if (mat) {
      if (o.color && mat.color) mat.color.set(o.color);
      if (o.roughness != null && 'roughness' in mat) mat.roughness = o.roughness;
      if (o.metalness != null && 'metalness' in mat) mat.metalness = o.metalness;
    }
    return;
  }
  if (o.kind === 'light:point') {
    const obj = addPrimitive('light');
    if (!obj) return;
    obj.name = o.name;
    obj.position.fromArray(o.position);
    obj.rotation.set(...o.rotation);
    obj.scale.fromArray(o.scale);
    const lt = firstLight(obj);
    if (lt && o.light) {
      lt.color.set(o.light.color);
      lt.intensity = o.light.intensity;
      if ('distance' in lt) lt.distance = o.light.distance;
    }
    return;
  }
  if (o.kind === 'asset' && o.assetMeta) {
    // re-download via stored meta
    if (downloadAndPlaceMeta) {
      await downloadAndPlaceMeta(o.assetMeta, {
        position: new THREE.Vector3().fromArray(o.position),
        rotation: o.rotation,
        scale: o.scale,
        name: o.name,
      });
    }
  }
}
