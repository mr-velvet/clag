// physics.js — AABB store + sweep test XZ + surface raycast (D.1 + D.2 + D.4)
//
// Não é uma engine de física. É um store de bounding boxes axis-aligned com
// dois algoritmos simples: sweep no plano XZ (anti-overlap) e raycast pra
// baixo (snap-to-surface). Sem constraints, sem rigidbodies, sem integração.
//
// Objetos registrados: todos em userRoot que não são room:* nem isHelper.
// AABB é recalculado via update(obj) quando transform muda.
//
// D.4 — anti-overlap vertical: sweepXZ agora checa yOverlap antes de bloquear.
// Se o AABB candidato passa POR CIMA (ou POR BAIXO) do outro objeto sem
// sobreposição vertical, não bloqueia. Permite empilhamento (objeto sobre
// objeto), passagem por cima de obstáculos baixos, lustres no teto sem
// colidir com móveis no chão. Mantém bloqueio quando há overlap real em Y.
//
// Limitações conhecidas (TODO D.5):
//   - AABB não rotaciona com o objeto (axis-aligned = sempre alinhado ao mundo)
//   - Tunneling em drag muito rápido não é detectado
//   - Objeto completamente cercado não tem saída automática (cadeado libera)

import * as THREE from 'three';

// sceneId -> { obj, box: THREE.Box3 }
const _store = new Map();

// tolerância pra evitar auto-colisão por imprecisão numérica
const TOLERANCE = 0.01;

// -------------------- registro --------------------

export function register(obj) {
  if (!obj?.userData?.sceneId) return;
  const box = new THREE.Box3().setFromObject(obj);
  _store.set(obj.userData.sceneId, { obj, box });
}

export function unregister(obj) {
  if (!obj?.userData?.sceneId) return;
  _store.delete(obj.userData.sceneId);
}

// recalcula AABB de um objeto já registrado
export function update(obj) {
  if (!obj?.userData?.sceneId) return;
  const entry = _store.get(obj.userData.sceneId);
  if (!entry) { register(obj); return; }
  entry.box.setFromObject(obj);
}

export function getAABB(obj) {
  if (!obj?.userData?.sceneId) return null;
  const entry = _store.get(obj.userData.sceneId);
  return entry ? entry.box.clone() : null;
}

// registra todos os objetos de userRoot (usado no boot pra idempotência)
export function registerAll(userRoot) {
  for (const child of userRoot.children) {
    if (_shouldSkip(child)) continue;
    register(child);
  }
}

// -------------------- surface raycast (D.1) --------------------

// Raycasta pra baixo a partir da posição candidata (XZ + altura AABB do obj).
// Retorna { y, hitObj } com Y do ponto de topo da superfície, ou null se sem hit.
// Exclui o próprio objeto e room:floor (o chão lógico é Y=0).
//
// Lógica: posiciona rayo de cima pra baixo. Hit em outro objeto -> Y = hit.point.y.
// Se não há hit -> Y = 0 (chão lógico).
export function surfaceUnder(obj, targetXZ, userRoot) {
  const myId = obj?.userData?.sceneId;

  // calcula meio AABB do objeto pra saber a altura dele
  const myBox = _store.get(myId)?.box;
  const objHeight = myBox ? (myBox.max.y - myBox.min.y) : 1;

  // origem do raio: ponto XZ alvo, altura bem acima
  const origin = new THREE.Vector3(targetXZ.x, 200, targetXZ.z);
  const dir    = new THREE.Vector3(0, -1, 0);
  const ray    = new THREE.Raycaster(origin, dir, 0.001, 500);

  // candidatos: todos em userRoot excluindo o próprio e room:floor
  const candidates = [];
  for (const child of userRoot.children) {
    if (child === obj) continue;
    if (_isFloor(child)) continue;        // não queremos Y do chão (é 0 por definição)
    if (_isRoomPart(child)) continue;     // paredes/teto não são superfície de cola por baixo
    if (child.userData?.isHelper) continue;
    candidates.push(child);
  }

  const hits = ray.intersectObjects(candidates, true);
  if (hits.length === 0) {
    // sem hit -> Y = 0 (chão lógico), objeto planta no chão
    return { y: 0, hitObj: null };
  }

  const h = hits[0];
  // topo do objeto draggado vai parar em hit.point.y
  return { y: h.point.y, hitObj: h.object };
}

// -------------------- sweep XZ + yOverlap (D.2 + D.4) --------------------

// Testa posição candidata de `obj` contra todos os outros AABBs.
// Retorna a posição final no plano XZ (sem mudar Y) — pode ser a posição
// clamped caso haja colisão (slide pela face de colisão).
//
// D.5: o vetor retornado tem `blocked: boolean` anexado (`.blocked` no Vector3).
// `true` quando alguma colisão fez o slide deslocar o resultado em relação ao
// `targetPos` original — usado pelo gizmo pra trocar o cursor pra `not-allowed`.
//
// Algoritmo simples de slide:
//   1. Calcula AABB candidato (translada AABB atual pra targetPos)
//   2. Para cada outro objeto, testa intersecção em X, Z **e Y** (D.4)
//   3. Se há overlap nos 3 eixos: calcula penetração em X e Z separadamente
//   4. Desloca no eixo com MENOR penetração (slide pelo eixo "mais livre")
//   5. Repete com posição ajustada (1 iteração — suficiente pra N<100)
//
// D.4: yOverlap check resolve "passar por cima". O AABB candidato usa o Y
// atual do objeto (que pode ter sido elevado por surface-snap no frame
// anterior). Se intervalos Y não se cruzam, o objeto passa livre verticalmente
// — empilhamento e travessia aérea funcionam naturalmente.
export function sweepXZ(obj, targetPos, userRoot, opts = {}) {
  const myId = obj?.userData?.sceneId;
  if (!myId) return targetPos.clone();

  const myEntry = _store.get(myId);
  if (!myEntry) return targetPos.clone();

  // AABB candidato: desloca do centro atual -> centro target no plano XZ
  const currentCenter = new THREE.Vector3();
  myEntry.box.getCenter(currentCenter);

  const delta = new THREE.Vector3(
    targetPos.x - currentCenter.x,
    0, // Y é controlado externamente — translação Y vem via opts.candidateY (D.4)
    targetPos.z - currentCenter.z,
  );

  // clona o box e desloca XZ
  const candidateBox = myEntry.box.clone();
  candidateBox.min.x += delta.x;
  candidateBox.max.x += delta.x;
  candidateBox.min.z += delta.z;
  candidateBox.max.z += delta.z;

  // D.4: se chamador informou candidateY (Y onde o pivot do obj VAI ficar
  // pós-surface-snap), translada o AABB em Y antes do teste de overlap.
  // Sem isso, yOverlap usa o Y atual do obj (frame anterior) e bloqueia
  // empilhamento. baseOffset = pivot - aabb.min.y; aabb.min.y candidato =
  // candidateY - baseOffset; deltaY = aabb.min.y candidato - aabb.min.y atual.
  if (typeof opts.candidateY === 'number') {
    const baseOffset = obj.position.y - myEntry.box.min.y;
    const candidateMinY = opts.candidateY - baseOffset;
    const deltaY = candidateMinY - myEntry.box.min.y;
    candidateBox.min.y += deltaY;
    candidateBox.max.y += deltaY;
  }

  // resultado final começa em targetPos e vai sendo corrigido
  let finalX = targetPos.x;
  let finalZ = targetPos.z;
  let blocked = false;

  for (const [id, entry] of _store) {
    if (id === myId) continue;
    if (_isRoomPart(entry.obj)) continue; // sala nunca bloqueia XZ
    if (entry.obj.userData?.isHelper) continue;

    const other = entry.box;

    // Ignora objetos praticamente 2D (planos/chão — espessura Y < 0.05u)
    // Esses não devem bloquear sweep horizontal. Ex: ground plane, room:floor.
    const otherHeight = other.max.y - other.min.y;
    if (otherHeight < 0.05) continue;

    // expand other por tolerância em XZ pra evitar self-stick.
    // Em Y a tolerância vai pro outro lado (encolhe), pra permitir que
    // objetos ENCOSTEM verticalmente (empilhamento) sem o sistema considerar
    // overlap. Sem isso, base do topo tangencia topo do base e bloqueia.
    const otherExp = other.clone();
    otherExp.min.x -= TOLERANCE;
    otherExp.min.z -= TOLERANCE;
    otherExp.max.x += TOLERANCE;
    otherExp.max.z += TOLERANCE;
    otherExp.min.y += TOLERANCE;
    otherExp.max.y -= TOLERANCE;

    // D.4: intersecção nos 3 eixos. Sem overlap em Y -> objeto passa por
    // cima/baixo sem colidir (empilhamento, travessia aérea). candidateBox.min.y
    // / max.y refletem o Y candidato (pós-surface-snap) injetado via opts.candidateY.
    const xOverlap = candidateBox.min.x < otherExp.max.x && candidateBox.max.x > otherExp.min.x;
    const zOverlap = candidateBox.min.z < otherExp.max.z && candidateBox.max.z > otherExp.min.z;
    const yOverlap = candidateBox.min.y < otherExp.max.y && candidateBox.max.y > otherExp.min.y;
    if (!xOverlap || !zOverlap || !yOverlap) continue;

    // há colisão — calcula penetração em X e Z
    const penX = Math.min(
      candidateBox.max.x - otherExp.min.x,
      otherExp.max.x - candidateBox.min.x,
    );
    const penZ = Math.min(
      candidateBox.max.z - otherExp.min.z,
      otherExp.max.z - candidateBox.min.z,
    );

    // slide pelo eixo com MENOR penetração (mais fácil de escapar)
    if (penX <= penZ) {
      // slide em X: empurra pra fora no eixo X
      const pushX = (candidateBox.min.x + candidateBox.max.x) / 2 < (otherExp.min.x + otherExp.max.x) / 2
        ? -(penX + TOLERANCE)
        : (penX + TOLERANCE);
      finalX += pushX;
      candidateBox.min.x += pushX;
      candidateBox.max.x += pushX;
    } else {
      // slide em Z
      const pushZ = (candidateBox.min.z + candidateBox.max.z) / 2 < (otherExp.min.z + otherExp.max.z) / 2
        ? -(penZ + TOLERANCE)
        : (penZ + TOLERANCE);
      finalZ += pushZ;
      candidateBox.min.z += pushZ;
      candidateBox.max.z += pushZ;
    }
    blocked = true;
  }

  const out = new THREE.Vector3(finalX, targetPos.y, finalZ);
  // D.5: anexa flag pro caller saber se o sweep mexeu na posição. Não usamos
  // sub-classe (Vector3 já é referência ok) — só uma prop extra no objeto.
  out.blocked = blocked;
  return out;
}

// -------------------- helpers --------------------

function _shouldSkip(obj) {
  if (obj.userData?.isHelper) return true;
  if (_isRoomPart(obj)) return false; // registra room:wall/floor/ceiling pro sweep funcionar
  return false;
}

function _isRoomPart(obj) {
  const kind = obj?.userData?.kind || '';
  return kind.startsWith('room:');
}

function _isFloor(obj) {
  const kind = obj?.userData?.kind || '';
  return kind === 'room:floor';
}
