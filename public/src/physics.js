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
// CR-13 (wave-b2, 2026-05-21): _isRoomPart compartilhado em state-helpers.js
// (estava duplicado aqui e em contextual-gizmo.js — drift garantido).
import { isRoomPart as _isRoomPart } from './state-helpers.js';

// sceneId -> { obj, box: THREE.Box3 }
const _store = new Map();

// tolerância pra evitar auto-colisão por imprecisão numérica
const TOLERANCE = 0.01;

// CR-5/6 (wave-b, 2026-05-21): instâncias reutilizáveis no hot path.
// surfaceUnder e sweepXZ rodam até 32x por pointermove (sub-steps). Antes
// alocavam Vector3/Box3/Raycaster a cada chamada — pressão de GC severa em
// drags rápidos. Agora reusamos as mesmas instâncias module-level.
const _rcOrigin       = new THREE.Vector3();
const _rcDir          = new THREE.Vector3(0, -1, 0);
const _rcRay          = new THREE.Raycaster();
_rcRay.near = 0.001;
_rcRay.far  = 500;
const _sweepCenter    = new THREE.Vector3();
const _sweepCandidate = new THREE.Box3();
const _sweepOtherExp  = new THREE.Box3();
const _sweepOutPos    = new THREE.Vector3();

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

// Esvazia o store inteiro. Usado por persist.js antes de repopular userRoot
// (CR-1 fix 2026-05-21 — antes o loop de clear bypassava removeFromScene e
// vazava AABBs no _store, criando colisores invisíveis em sessões longas).
export function clear() {
  _store.clear();
}

// Introspecção pra QA — não usar em prod.
export function _storeSize() {
  return _store.size;
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
  // CR-6 (wave-b, 2026-05-21): reusa Raycaster/Vector3 module-level em vez de
  // alocar a cada chamada. Set origin/dir via .set() no singleton.
  _rcOrigin.set(targetXZ.x, 200, targetXZ.z);
  _rcRay.set(_rcOrigin, _rcDir);

  // candidatos: todos em userRoot excluindo o próprio e room:floor
  const candidates = [];
  for (const child of userRoot.children) {
    if (child === obj) continue;
    if (_isFloor(child)) continue;        // não queremos Y do chão (é 0 por definição)
    if (_isRoomPart(child)) continue;     // paredes/teto não são superfície de cola por baixo
    if (child.userData?.isHelper) continue;
    candidates.push(child);
  }

  const hits = _rcRay.intersectObjects(candidates, true);
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
//
// CR-8 (wave-b, 2026-05-21): retorna `{ position: Vector3, blocked: boolean }`
// em vez de mutar Vector3 com prop `.blocked`. Vector3 retornado é uma
// INSTÂNCIA REUTILIZADA module-level (_sweepOutPos) — chamador que precisa
// manter a posição entre frames DEVE clonar.
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
  if (!myId) {
    _sweepOutPos.copy(targetPos);
    return { position: _sweepOutPos, blocked: false };
  }

  const myEntry = _store.get(myId);
  if (!myEntry) {
    _sweepOutPos.copy(targetPos);
    return { position: _sweepOutPos, blocked: false };
  }

  // CR-5/8: reusa _sweepCenter/_sweepCandidate module-level. AABB candidato
  // = AABB atual deslocado pro centro target no plano XZ.
  myEntry.box.getCenter(_sweepCenter);
  const deltaX = targetPos.x - _sweepCenter.x;
  const deltaZ = targetPos.z - _sweepCenter.z;

  _sweepCandidate.copy(myEntry.box);
  _sweepCandidate.min.x += deltaX;
  _sweepCandidate.max.x += deltaX;
  _sweepCandidate.min.z += deltaZ;
  _sweepCandidate.max.z += deltaZ;

  // D.4: se chamador informou candidateY (Y onde o pivot do obj VAI ficar
  // pós-surface-snap), translada o AABB em Y antes do teste de overlap.
  // Sem isso, yOverlap usa o Y atual do obj (frame anterior) e bloqueia
  // empilhamento.
  if (typeof opts.candidateY === 'number') {
    const baseOffset = obj.position.y - myEntry.box.min.y;
    const candidateMinY = opts.candidateY - baseOffset;
    const deltaY = candidateMinY - myEntry.box.min.y;
    _sweepCandidate.min.y += deltaY;
    _sweepCandidate.max.y += deltaY;
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
    // overlap. CR-5: reusa _sweepOtherExp module-level.
    _sweepOtherExp.copy(other);
    _sweepOtherExp.min.x -= TOLERANCE;
    _sweepOtherExp.min.z -= TOLERANCE;
    _sweepOtherExp.max.x += TOLERANCE;
    _sweepOtherExp.max.z += TOLERANCE;
    _sweepOtherExp.min.y += TOLERANCE;
    _sweepOtherExp.max.y -= TOLERANCE;

    // D.4: intersecção nos 3 eixos. Sem overlap em Y -> objeto passa por
    // cima/baixo sem colidir (empilhamento, travessia aérea).
    const xOverlap = _sweepCandidate.min.x < _sweepOtherExp.max.x && _sweepCandidate.max.x > _sweepOtherExp.min.x;
    const zOverlap = _sweepCandidate.min.z < _sweepOtherExp.max.z && _sweepCandidate.max.z > _sweepOtherExp.min.z;
    const yOverlap = _sweepCandidate.min.y < _sweepOtherExp.max.y && _sweepCandidate.max.y > _sweepOtherExp.min.y;
    if (!xOverlap || !zOverlap || !yOverlap) continue;

    // há colisão — calcula penetração em X e Z
    const penX = Math.min(
      _sweepCandidate.max.x - _sweepOtherExp.min.x,
      _sweepOtherExp.max.x - _sweepCandidate.min.x,
    );
    const penZ = Math.min(
      _sweepCandidate.max.z - _sweepOtherExp.min.z,
      _sweepOtherExp.max.z - _sweepCandidate.min.z,
    );

    // slide pelo eixo com MENOR penetração (mais fácil de escapar)
    if (penX <= penZ) {
      // slide em X: empurra pra fora no eixo X
      const pushX = (_sweepCandidate.min.x + _sweepCandidate.max.x) / 2 < (_sweepOtherExp.min.x + _sweepOtherExp.max.x) / 2
        ? -(penX + TOLERANCE)
        : (penX + TOLERANCE);
      finalX += pushX;
      _sweepCandidate.min.x += pushX;
      _sweepCandidate.max.x += pushX;
    } else {
      // slide em Z
      const pushZ = (_sweepCandidate.min.z + _sweepCandidate.max.z) / 2 < (_sweepOtherExp.min.z + _sweepOtherExp.max.z) / 2
        ? -(penZ + TOLERANCE)
        : (penZ + TOLERANCE);
      finalZ += pushZ;
      _sweepCandidate.min.z += pushZ;
      _sweepCandidate.max.z += pushZ;
    }
    blocked = true;
  }

  // CR-8: retorno tipado. Vector3 reaproveitado — caller que persistir entre
  // frames deve clonar (call sites em contextual-gizmo.js leem .x/.z na hora).
  _sweepOutPos.set(finalX, targetPos.y, finalZ);
  return { position: _sweepOutPos, blocked };
}

// -------------------- helpers --------------------

// CR-14 (wave-b2, 2026-05-21): removida a branch morta `if (_isRoomPart) return false`
// — ela já cai no `return false` abaixo de qualquer jeito (era no-op).
// Helper segue mínimo: só helpers são puláveis; room parts SÃO registrados
// pro sweep enxergar paredes (mas surfaceUnder/sweep XZ os ignoram via filtro próprio).
function _shouldSkip(obj) {
  if (obj.userData?.isHelper) return true;
  return false;
}

function _isFloor(obj) {
  const kind = obj?.userData?.kind || '';
  return kind === 'room:floor';
}
