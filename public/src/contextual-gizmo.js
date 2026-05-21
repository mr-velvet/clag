// contextual-gizmo.js — drag-to-translate + cadeado HTML overlay (D.1 + D.2 + D.3)
//
// Responsabilidades:
//   - Detecta click/drag em objetos do userRoot via pointerdown/pointermove/pointerup
//   - Drag: move objeto seguindo cursor no plano XZ, aplicando surface-snap (D.1)
//     e anti-overlap sweep (D.2)
//   - Threshold de 4px antes de "comitar" como drag (evita click virar drag)
//   - Esc durante drag cancela (volta posição original)
//   - Cadeado HTML overlay: 🔒/🔓 em screen-space sobre o objeto selecionado
//   - Click no cadeado toggla userData.freeTransform
//   - Durante drag: orbit desabilitado, cursor grabbing
//   - W/E/R TransformControls tem prioridade — não interfere quando gizmo.dragging
//
// Limitações conhecidas (TODO D.5):
//   - Tunneling em drag muito rápido
//   - Objeto preso entre objetos sem saída (cadeado libera manualmente)
//   - Touch/multi-touch fora de escopo

import * as THREE from 'three';
import {
  scene, camera, orbit, gizmo, userRoot, renderer,
  getSelected, setSelected, notifySceneChanged, worldPointAtScreen,
} from './scene.js';
import * as physics from './physics.js';
import { applyAnchor } from './search.js';

// -------------------- estado interno --------------------

let _container = null;           // o viewport-wrap
let _lockEl = null;              // div do cadeado
let _isDragging = false;
let _dragObj = null;
let _dragOrigin = null;          // THREE.Vector3 — posição original pra Esc
let _pointerDownPos = null;      // { x, y } em pixels
let _dragCommitted = false;      // true quando threshold 4px foi ultrapassado
const DRAG_THRESHOLD = 4;        // pixels

// raycaster reutilizado
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

// modo contextual global — usado por api.js pra saber o modo
let _contextualMode = true;

export function isContextualMode() { return _contextualMode; }
export function setContextualMode(v) { _contextualMode = !!v; }

// -------------------- init --------------------

export function initContextualGizmo({ container }) {
  _container = container;
  _buildLockOverlay();

  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', _onPointerDown, { capture: false });
  canvas.addEventListener('pointermove', _onPointerMove);
  canvas.addEventListener('pointerup',   _onPointerUp);
  canvas.addEventListener('pointerleave', _onPointerLeave);

  // Esc durante drag cancela; fora de drag restaura modo contextual
  window.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (_isDragging) {
        _cancelDrag();
      } else {
        // Fix GIZMO-3: Esc fora de drag restaura modo contextual.
        // W/E/R ativam TransformControls e setam _contextualMode=false;
        // Esc desfaz isso devolvendo o drag contextual como modo ativo.
        _contextualMode = true;
      }
    }
    if ((ev.key === 'w' || ev.key === 'W' ||
         ev.key === 'e' || ev.key === 'E' ||
         ev.key === 'r' || ev.key === 'R') &&
        !(ev.target instanceof HTMLInputElement) &&
        !(ev.target instanceof HTMLTextAreaElement)) {
      // TransformControls assumindo — contextual fica inativo durante essa sessão
      _contextualMode = false;
    }
  });

  // atualiza posição do cadeado a cada frame via RAF
  _animateLock();
}

// -------------------- cadeado overlay --------------------

function _buildLockOverlay() {
  _lockEl = document.createElement('div');
  _lockEl.className = 'lock-overlay hidden';
  _lockEl.setAttribute('title', 'clique para alternar posicionamento livre');
  document.body.appendChild(_lockEl);

  _lockEl.addEventListener('click', ev => {
    ev.stopPropagation();
    const sel = getSelected();
    if (!sel) return;
    _toggleLock(sel);
  });

  _lockEl.addEventListener('pointerdown', ev => {
    // impede que o clique no cadeado chegue ao canvas e desfaça a seleção
    ev.stopPropagation();
  });
}

function _updateLockOverlay() {
  const sel = getSelected();
  if (!sel || !_container) {
    _lockEl.classList.add('hidden');
    return;
  }

  // projeta o centro do objeto em screen-space
  const box = new THREE.Box3().setFromObject(sel);
  const center = box.getCenter(new THREE.Vector3());

  // projetar pra NDC
  const ndc = center.clone().project(camera);

  // converter pra coordenadas de tela
  const rect = renderer.domElement.getBoundingClientRect();
  const sx = (ndc.x * 0.5 + 0.5) * rect.width  + rect.left;
  const sy = (-ndc.y * 0.5 + 0.5) * rect.height + rect.top;

  // se atrás da câmera, esconde
  if (ndc.z > 1) {
    _lockEl.classList.add('hidden');
    return;
  }

  const locked = !sel.userData?.freeTransform;
  _lockEl.textContent = locked ? '🔒' : '🔓';
  _lockEl.classList.toggle('hidden', false);
  _lockEl.classList.toggle('unlocked', !locked);

  // posiciona no centro do objeto + offset pra não sobrepor
  const SIZE = 32;
  _lockEl.style.left = `${sx - SIZE / 2}px`;
  _lockEl.style.top  = `${sy - SIZE / 2 - 20}px`; // 20px acima do centro
}

function _animateLock() {
  _updateLockOverlay();
  requestAnimationFrame(_animateLock);
}

export function updateLockOverlay() { _updateLockOverlay(); }

// -------------------- toggle lock --------------------

export function toggleLock(obj) {
  if (!obj) return;
  _toggleLock(obj);
}

function _toggleLock(obj) {
  const wasLocked = !obj.userData?.freeTransform;
  obj.userData.freeTransform = wasLocked; // se estava travado, libera; e vice-versa
  notifySceneChanged();
  // atualiza visual imediatamente
  _updateLockOverlay();
}

// -------------------- pointer handlers --------------------

function _onPointerDown(ev) {
  if (ev.button !== 0) return;
  // TransformControls tem prioridade
  if (gizmo.dragging) return;

  const sel = getSelected();
  const rect = renderer.domElement.getBoundingClientRect();
  _pointer.x = ((ev.clientX - rect.left) / rect.width)  * 2 - 1;
  _pointer.y = -((ev.clientY - rect.top)  / rect.height) * 2 + 1;

  _raycaster.setFromCamera(_pointer, camera);

  // candidatos: userRoot, excluindo helpers e room:*
  const candidates = userRoot.children.filter(c =>
    !c.userData?.isHelper && !_isRoomPart(c),
  );
  const hits = _raycaster.intersectObjects(candidates, true);

  if (hits.length === 0) {
    // miss — deseleciona (scene.js também faz isso, mas coordenamos aqui)
    // Não desfazemos seleção aqui — deixamos scene.js tratar via seu próprio listener
    _pointerDownPos = null;
    return;
  }

  // sobe até filho direto do userRoot
  let hitObj = hits[0].object;
  while (hitObj.parent && hitObj.parent !== userRoot) hitObj = hitObj.parent;

  // registra intenção de drag
  _pointerDownPos = { x: ev.clientX, y: ev.clientY };
  _dragObj = hitObj;
  _dragCommitted = false;

  // seleção imediata no pointerdown (independente de drag)
  if (getSelected() !== hitObj) {
    setSelected(hitObj);
  }
}

function _onPointerMove(ev) {
  if (!_pointerDownPos || !_dragObj) {
    // só hover: muda cursor
    _updateHoverCursor(ev);
    return;
  }

  const dx = ev.clientX - _pointerDownPos.x;
  const dy = ev.clientY - _pointerDownPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (!_dragCommitted) {
    if (dist < DRAG_THRESHOLD) return; // ainda dentro do threshold
    _dragCommitted = true;

    // verifica se objeto está liberado (freeTransform) — se sim, não faz drag contextual
    if (_dragObj.userData?.freeTransform) {
      // objeto liberado: deixa TransformControls cuidar, não inicia drag
      _dragObj = null;
      _pointerDownPos = null;
      return;
    }

    // inicia drag
    _isDragging = true;
    _dragOrigin = _dragObj.position.clone();
    orbit.enabled = false;
    if (_container) _container.classList.add('grabbing');
    renderer.domElement.style.cursor = 'grabbing';
  }

  if (!_isDragging) return;
  if (!_contextualMode) { _endDrag(); return; } // W/E/R assumiu

  // calcula ponto no plano XZ sob o cursor
  const worldPoint = worldPointAtScreen(ev.clientX, ev.clientY);

  // sweep XZ — anti-overlap (D.2)
  const targetXZ = new THREE.Vector3(worldPoint.x, 0, worldPoint.z);
  const swept    = physics.sweepXZ(_dragObj, targetXZ, userRoot);

  // surface raycast — snap-to-surface (D.1)
  const surface  = physics.surfaceUnder(_dragObj, swept, userRoot);

  // Fix Bug 11: compensa offset entre pivot e base do bbox.
  // surface.y indica onde a BASE do objeto deve ficar; o pivot pode estar
  // no centro — sem compensar, o objeto afunda meia-altura na superfície.
  const _currentBox = new THREE.Box3().setFromObject(_dragObj);
  const _baseOffset = _dragObj.position.y - _currentBox.min.y; // pivot -> base
  const finalY = (surface ? surface.y : 0) + _baseOffset;

  // aplica posição
  _dragObj.position.set(swept.x, finalY, swept.z);

  // atualiza AABB do objeto draggado pra próxima iteração do sweep
  physics.update(_dragObj);

  // não dispara sceneChanged a cada frame — só no commit (pointerup)
}

function _onPointerUp(ev) {
  if (ev.button !== 0) return;

  if (_isDragging && _dragObj) {
    // Fix GIZMO-1: re-aplica anchor de ceiling/wall após drag.
    // surface-snap planta no chão objetos sem hit, quebrando lustres/fixações
    // de teto. applyAnchor recalcula a posição correta (fallback 2.7m sem sala).
    // Anchor 'floor' NÃO precisa — surface-snap já planta corretamente (Fix 1).
    const anchor = _dragObj.userData?.anchor;
    if (anchor === 'ceiling' || anchor === 'wall') {
      applyAnchor(_dragObj, _dragObj.position.clone(), { silent: true });
    }

    // commit final
    physics.update(_dragObj);
    notifySceneChanged();
  }

  _endDrag();
}

function _onPointerLeave() {
  if (_isDragging) {
    // mouse saiu do canvas durante drag — commita onde parou
    if (_dragObj) {
      physics.update(_dragObj);
      notifySceneChanged();
    }
    _endDrag();
  }
  _resetCursor();
}

function _cancelDrag() {
  if (_dragObj && _dragOrigin) {
    _dragObj.position.copy(_dragOrigin);
    physics.update(_dragObj);
    notifySceneChanged();
  }
  _endDrag();
}

function _endDrag() {
  _isDragging = false;
  _dragCommitted = false;
  _dragObj = null;
  _pointerDownPos = null;
  _dragOrigin = null;
  orbit.enabled = true;
  if (_container) _container.classList.remove('grabbing');
  _resetCursor();
}

function _resetCursor() {
  renderer.domElement.style.cursor = '';
}

function _updateHoverCursor(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  _pointer.x = ((ev.clientX - rect.left) / rect.width)  * 2 - 1;
  _pointer.y = -((ev.clientY - rect.top)  / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_pointer, camera);

  const candidates = userRoot.children.filter(c =>
    !c.userData?.isHelper && !_isRoomPart(c),
  );
  const hits = _raycaster.intersectObjects(candidates, true);

  if (hits.length === 0) {
    renderer.domElement.style.cursor = '';
    return;
  }

  let hitObj = hits[0].object;
  while (hitObj.parent && hitObj.parent !== userRoot) hitObj = hitObj.parent;

  // cursor grab se travado (drag contextual disponível), default se liberado
  if (!hitObj.userData?.freeTransform) {
    renderer.domElement.style.cursor = 'grab';
  } else {
    renderer.domElement.style.cursor = 'default';
  }
}

// -------------------- drag programático (para QA) --------------------

// Move objeto pela pipeline sweep+surface sem interação de mouse.
// Retorna posição final.
export function dragObjectTo(obj, targetXZ, userRoot_) {
  const root = userRoot_ || userRoot;
  const target = new THREE.Vector3(targetXZ.x ?? 0, 0, targetXZ.z ?? 0);

  // Fix Bug 12: freeTransform=true → move livremente, sem sweep nem surface.
  // Simetria com drag visual (que aborta antes de iniciar o drag contextual).
  if (obj.userData?.freeTransform === true) {
    obj.position.set(target.x, obj.position.y, target.z);
    physics.update(obj);
    notifySceneChanged();
    return obj.position.clone();
  }

  const swept   = physics.sweepXZ(obj, target, root);
  const surface = physics.surfaceUnder(obj, swept, root);

  // Fix Bug 11: compensa offset entre pivot e base do bbox (mesma lógica do drag visual).
  // surface.y é onde a BASE deve pousar; ajusta Y para que aabb.min.y caia exatamente aí.
  const currentBox = new THREE.Box3().setFromObject(obj);
  const baseOffset = obj.position.y - currentBox.min.y;
  const finalY = (surface ? surface.y : 0) + baseOffset;

  obj.position.set(swept.x, finalY, swept.z);

  // Fix GIZMO-1: re-aplica anchor de ceiling/wall após move programático.
  // Sem isso, dragObjectTo enviaria lustres pro chão (surface retorna Y=0 sem hit).
  const anchor = obj.userData?.anchor;
  if (anchor === 'ceiling' || anchor === 'wall') {
    applyAnchor(obj, obj.position.clone(), { silent: true });
  }

  physics.update(obj);
  notifySceneChanged();

  return obj.position.clone();
}

// -------------------- helpers --------------------

function _isRoomPart(obj) {
  const kind = obj?.userData?.kind || '';
  return kind.startsWith('room:');
}
