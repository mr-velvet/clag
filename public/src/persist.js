import * as THREE from 'three';
import { getUserObjects, addToScene, userRoot, removeFromScene } from './scene.js';
import { createRoom, getRoomDimensions, isRoomPart } from './room.js';
import * as physics from './physics.js';

const STORAGE_KEY = 'clag:scene-v1';

export function serializeScene() {
  // Fase 4: sala vira campo top-level `room` no JSON (mais simples que
  // serializar 6 mesh com kind='room:*'). Restore recria via createRoom().
  const room = getRoomDimensions();
  // pula objetos com kind=room:* na lista de objects — sala vem do campo room.
  const objs = getUserObjects()
    .filter(o => !isRoomPart(o))
    .map(serializeObj);
  const out = { version: 1, objects: objs };
  if (room) out.room = room;
  return out;
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
    // Fase 3: garante que anchor/footprint estao no assetMeta serializado
    // mesmo se quem populou userData esqueceu de copiar.
    const meta = { ...obj.userData.assetMeta };
    if (obj.userData.anchor && !meta.anchor) meta.anchor = obj.userData.anchor;
    if (obj.userData.footprint && !meta.footprint) meta.footprint = [...obj.userData.footprint];
    o.assetMeta = meta;
  }
  // Fase 3: persiste anchor/footprint tambem fora de assetMeta pra que
  // primitivas (cubo, esfera) que usam essas props possam restaurar.
  if (obj.userData?.anchor) o.anchor = obj.userData.anchor;
  if (Array.isArray(obj.userData?.footprint)) o.footprint = [...obj.userData.footprint];
  if (obj.userData?.freeTransform) o.freeTransform = true;
  // Bug 10: persistir anchorApplied (runtime tag: 'ceiling' | 'ceiling-fallback'
  // | 'wall' | 'wall-fallback' | 'floor'). Sem isso, state.objectAnchorApplied
  // virava null apos save+load mesmo com objeto na posicao certa.
  if (obj.userData?.anchorApplied) o.anchorApplied = obj.userData.anchorApplied;
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
  // Clear current userRoot — usa removeFromScene (que dispara physics.unregister
  // + dispose de geometry/material) pra cada child. Fix CR-1 (2026-05-21):
  // antes o loop `userRoot.remove(...)` direto vazava AABBs no _store de physics,
  // criando colisores invisíveis em load/save loops. Belt-and-suspenders: também
  // chama physics.clear() no fim pra garantir Map vazio caso algum child escape
  // (ex: helpers órfãos sem sceneId nunca registrados via register()).
  const toRemove = [...userRoot.children];
  for (const child of toRemove) {
    removeFromScene(child);
  }
  physics.clear();
  // Fase 4: recria sala primeiro (se houver) — assim anchor='ceiling' /
  // 'wall' nos assets seguintes encontra room:ceiling / room:wall reais.
  if (data.room && Number.isFinite(data.room.width) && Number.isFinite(data.room.depth) && Number.isFinite(data.room.height)) {
    try { createRoom(data.room); } catch (e) { console.warn('failed to restore room', data.room, e); }
  }
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
    applySimsMeta(obj, o);
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
    applySimsMeta(obj, o);
    return;
  }
  if (o.kind === 'asset' && o.assetMeta) {
    // re-download via stored meta
    if (downloadAndPlaceMeta) {
      const placed = await downloadAndPlaceMeta(o.assetMeta, {
        position: new THREE.Vector3().fromArray(o.position),
        rotation: o.rotation,
        scale: o.scale,
        name: o.name,
      });
      // se downloadAndPlaceMeta nao colou ja, aplica meta Sims-mode
      // localizando o objeto pelo nome (best effort).
      if (placed && placed.userData) applySimsMeta(placed, o);
    }
  }
}

// aplica metadata Sims-mode (anchor, footprint, freeTransform) no objeto
// recem-rehidratado, sem mexer em transform.
function applySimsMeta(obj, saved) {
  if (saved.anchor) obj.userData.anchor = saved.anchor;
  if (Array.isArray(saved.footprint)) obj.userData.footprint = [...saved.footprint];
  if (saved.freeTransform) obj.userData.freeTransform = true;
  // Bug 10: restaura anchorApplied (introspecao pos-load via state API).
  if (saved.anchorApplied) obj.userData.anchorApplied = saved.anchorApplied;
}
