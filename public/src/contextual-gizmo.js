// contextual-gizmo.js — drag-to-translate + cadeado HTML overlay (D.1 + D.2 + D.3 + D.5)
//
// Responsabilidades:
//   - Detecta click/drag em objetos do userRoot via pointerdown/pointermove/pointerup
//   - Drag: move objeto seguindo cursor no plano XZ, aplicando surface-snap (D.1)
//     e anti-overlap sweep (D.2)
//   - Threshold de 4px antes de "comitar" como drag (evita click virar drag)
//   - Esc durante drag cancela (volta posição original)
//   - Cadeado HTML overlay: 🔒/🔓 em screen-space sobre o objeto selecionado
//   - Click no cadeado toggla userData.freeTransform (com tooltip custom — D.5)
//   - Durante drag: orbit desabilitado, cursor grabbing
//   - W/E/R TransformControls tem prioridade — não interfere quando gizmo.dragging
//
// D.5 — polish e discoverability:
//   - Hint flutuante no viewport ("arraste objetos pra mover") até primeira
//     interação. Persistência em LS `clag:hint-seen` pra não voltar.
//   - Tooltip custom no cadeado (substitui `title=` nativo — Princípio 8).
//   - Bbox visual sutil ao hover (Box3Helper tracejado, opacity 0.4).
//   - Cursor `not-allowed` durante slide (sweepXZ retorna `.blocked=true`).
//   - Tunneling mitigation: drag rápido (>1u/frame) divide em sub-steps.
//
// Limitações conhecidas:
//   - Objeto preso entre objetos sem saída (cadeado libera manualmente)
//   - Touch/multi-touch fora de escopo

import * as THREE from 'three';
import {
  scene, camera, orbit, gizmo, userRoot, renderer,
  getSelected, setSelected, notifySceneChanged, worldPointAtScreen,
  on as sceneOn,
} from './scene.js';
import * as physics from './physics.js';
import { applyAnchor } from './search.js';

// -------------------- estado interno --------------------

let _container = null;           // o viewport-wrap
let _lockEl = null;              // div do cadeado
let _tooltipEl = null;           // D.5: tooltip custom (substitui title= nativo)
let _hintEl = null;              // D.5: hint flutuante de discoverability
let _hoverBoxHelper = null;      // D.5: Box3Helper do bbox de hover
let _hoverObj = null;            // objeto atualmente em hover (sem seleção)
let _lastTargetXZ = null;        // D.5: último targetXZ pra tunneling mitigation
let _isDragging = false;
let _dragObj = null;
let _dragOrigin = null;          // THREE.Vector3 — posição original pra Esc
let _pointerDownPos = null;      // { x, y } em pixels
let _dragCommitted = false;      // true quando threshold 4px foi ultrapassado
const DRAG_THRESHOLD = 4;        // pixels

// D.5: chave LS pro hint de discoverability
const LS_HINT_SEEN = 'clag:hint-seen';
// D.5: tunneling mitigation. > 0.25u entre frames triggera sub-steps.
// 0.25u garante passo <= metade do menor AABB típico (1u). MAX=32 cobre drag
// de tela inteira (~10-15u) sem pular colisor.
const TUNNEL_STEP_THRESHOLD = 0.25;
const TUNNEL_MAX_SUBSTEPS = 32;

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
  _buildTooltip();        // D.5: tooltip custom (Princípio 8 — sem title= nativo)
  _buildHint();           // D.5: hint flutuante de discoverability
  _buildHoverBoxHelper(); // D.5: bbox tracejado de hover

  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', _onPointerDown, { capture: false });
  canvas.addEventListener('pointermove', _onPointerMove);
  canvas.addEventListener('pointerup',   _onPointerUp);
  canvas.addEventListener('pointerleave', _onPointerLeave);

  // D.5: re-avalia visibilidade do hint quando cena muda (objeto adicionado/removido)
  sceneOn('sceneChanged', _updateHintVisibility);
  sceneOn('selectionChanged', _updateHintVisibility);
  // tick inicial — caso boot tenha cena starter
  _updateHintVisibility();

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
  // D.5 (GIZMO-5): sem title= nativo — tooltip custom é injetado via _buildTooltip.
  document.body.appendChild(_lockEl);

  _lockEl.addEventListener('click', ev => {
    ev.stopPropagation();
    const sel = getSelected();
    if (!sel) return;
    _toggleLock(sel);
    // atualiza texto do tooltip imediatamente pra refletir o novo estado
    _updateTooltipForLock(sel);
  });

  _lockEl.addEventListener('pointerdown', ev => {
    // impede que o clique no cadeado chegue ao canvas e desfaça a seleção
    ev.stopPropagation();
  });

  // D.5: tooltip custom no hover do cadeado
  _lockEl.addEventListener('pointerenter', () => {
    const sel = getSelected();
    if (!sel) return;
    _updateTooltipForLock(sel);
    _showTooltipFor(_lockEl);
  });
  _lockEl.addEventListener('pointerleave', _hideTooltip);
}

// D.5 — tooltip custom (Princípio 8: zero `title=` nativo)
function _buildTooltip() {
  _tooltipEl = document.createElement('div');
  _tooltipEl.className = 'tooltip-custom hidden';
  document.body.appendChild(_tooltipEl);
}

function _updateTooltipForLock(sel) {
  const locked = !sel.userData?.freeTransform;
  _tooltipEl.textContent = locked
    ? '🔒 ancorado à superfície (clique pra liberar)'
    : '🔓 livre (clique pra ancorar)';
}

function _showTooltipFor(anchorEl) {
  if (!_tooltipEl || !anchorEl) return;
  _tooltipEl.classList.remove('hidden');
  // posiciona logo abaixo do anchor
  const rect = anchorEl.getBoundingClientRect();
  // mede o próprio tooltip pra centralizar horizontalmente
  const tRect = _tooltipEl.getBoundingClientRect();
  const left = rect.left + rect.width / 2 - tRect.width / 2;
  const top  = rect.bottom + 6;
  _tooltipEl.style.left = `${Math.max(4, left)}px`;
  _tooltipEl.style.top  = `${top}px`;
}

function _hideTooltip() {
  if (_tooltipEl) _tooltipEl.classList.add('hidden');
}

// D.5 — hint de discoverability ("arraste objetos pra mover")
function _buildHint() {
  _hintEl = document.createElement('div');
  _hintEl.className = 'viewport-hint hidden';
  _hintEl.textContent = 'arraste objetos pra mover';
  // anexa no viewport-wrap pra ficar relativo ao palco
  if (_container) _container.appendChild(_hintEl);
}

function _updateHintVisibility() {
  if (!_hintEl) return;
  // se já viu, esconde pra sempre
  let seen = false;
  try { seen = localStorage.getItem(LS_HINT_SEEN) === '1'; } catch (_) {}
  if (seen) { _hintEl.classList.add('hidden'); return; }

  // mostra apenas quando: tem objetos na cena E nenhum está selecionado
  const hasObjects = userRoot.children.some(c =>
    !c.userData?.isHelper && !_isRoomPart(c),
  );
  const noSel = !getSelected();
  _hintEl.classList.toggle('hidden', !(hasObjects && noSel));
}

function _markHintSeen() {
  try { localStorage.setItem(LS_HINT_SEEN, '1'); } catch (_) {}
  if (_hintEl) _hintEl.classList.add('hidden');
}

// D.5 — bbox visual ao hover (linhas sólidas com transparência — visual sutil)
function _buildHoverBoxHelper() {
  const box = new THREE.Box3(
    new THREE.Vector3(-0.5, -0.5, -0.5),
    new THREE.Vector3(0.5, 0.5, 0.5),
  );
  _hoverBoxHelper = new THREE.Box3Helper(box, 0xcccccc);
  _hoverBoxHelper.material.transparent = true;
  _hoverBoxHelper.material.opacity = 0.4;
  _hoverBoxHelper.material.depthTest = false;
  _hoverBoxHelper.visible = false;
  _hoverBoxHelper.userData.isHelper = true;
  _hoverBoxHelper.renderOrder = 999;
  scene.add(_hoverBoxHelper);
}

function _showHoverBox(obj) {
  if (!_hoverBoxHelper) return;
  if (obj === _hoverObj && _hoverBoxHelper.visible) return;
  _hoverObj = obj;
  const box = new THREE.Box3().setFromObject(obj);
  _hoverBoxHelper.box.copy(box);
  _hoverBoxHelper.visible = true;
  _hoverBoxHelper.updateMatrixWorld(true);
}

function _hideHoverBox() {
  if (!_hoverBoxHelper) return;
  _hoverBoxHelper.visible = false;
  _hoverObj = null;
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

  // D.5: primeira interação no canvas marca hint como visto
  _markHintSeen();

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
    // só hover: muda cursor + mostra bbox
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
    _lastTargetXZ = _dragObj.position.clone(); // baseline pra tunneling
    orbit.enabled = false;
    if (_container) _container.classList.add('grabbing');
    renderer.domElement.style.cursor = 'grabbing';
    // hover bbox some ao começar drag (objeto selecionado já tem highlight próprio)
    _hideHoverBox();
  }

  if (!_isDragging) return;
  if (!_contextualMode) { _endDrag(); return; } // W/E/R assumiu

  // calcula ponto no plano XZ sob o cursor
  const worldPoint = worldPointAtScreen(ev.clientX, ev.clientY);
  const targetXZ = new THREE.Vector3(worldPoint.x, 0, worldPoint.z);

  // D.5 — tunneling mitigation: se o delta entre frames é grande (>0.25u em XZ),
  // divide em sub-steps pra que o sweep XZ rode em cada passo intermediário.
  //
  // Patch GIZMO-D4-1 (drag visual + programático):
  //   1. Surface-snap roda APENAS no step final. Steps intermediários mantêm
  //      Y fixo (não deixa o objeto "escalar" obstáculo no caminho do drag).
  //      Antes: sub-step subia Y pro topo do obstáculo → yOverlap zerava
  //      → sweep liberava → objeto atravessava. Agora bloqueia em XZ.
  //   2. Pré-check de empilhamento: se target final cai em cima de outro
  //      objeto (surface-snap retorna Y > 0), pula sub-steps e vai direto
  //      pro snap final. Empilhamento via drag rápido continua funcionando.
  //   3. Early-abort em sub-step bloqueado: evita teleport-push do slide
  //      quando target intermediário cai DENTRO do AABB do obstáculo.
  const finalSurface = physics.surfaceUnder(_dragObj, targetXZ, userRoot);
  const isStackingTarget = !!(finalSurface && finalSurface.y > 0.001);
  let lastBlocked = false;

  if (isStackingTarget) {
    lastBlocked = _applyDragStep(_dragObj, targetXZ, { snapSurface: true });
  } else {
    const stepsXZ = _calcSubSteps(_lastTargetXZ, targetXZ);
    const fixedY = _dragObj.position.y;
    for (let i = 1; i <= stepsXZ; i++) {
      const t = i / stepsXZ;
      const sub = new THREE.Vector3(
        _lastTargetXZ.x + (targetXZ.x - _lastTargetXZ.x) * t,
        0,
        _lastTargetXZ.z + (targetXZ.z - _lastTargetXZ.z) * t,
      );
      const isFinal = (i === stepsXZ);
      const stepBlocked = _applyDragStep(_dragObj, sub, { snapSurface: isFinal, fixedY });
      lastBlocked = stepBlocked || lastBlocked;
      if (!isFinal && stepBlocked) {
        // Aborta sub-steps subsequentes ao detectar bloqueio e roda
        // surface-snap na posição corrente. Evita que slide com penetração
        // total teleporte o objeto pro outro lado do obstáculo.
        _applyDragStep(_dragObj, new THREE.Vector3(_dragObj.position.x, 0, _dragObj.position.z), { snapSurface: true });
        break;
      }
    }
  }
  _lastTargetXZ = targetXZ.clone();

  // D.5 — cursor not-allowed durante slide (algum sub-step bloqueou)
  if (lastBlocked) {
    if (_container) _container.classList.add('colliding');
  } else {
    if (_container) _container.classList.remove('colliding');
  }

  // não dispara sceneChanged a cada frame — só no commit (pointerup)
}

// D.5 — aplica um único passo de drag (surface + sweep + posição).
// Retorna `true` se o sweep bloqueou a posição (slide ativo).
//
// Patch GIZMO-D4-1: parâmetro `opts.snapSurface` controla se surface-snap roda.
//   - true (default ou step final): comportamento clássico (surface + sweep).
//   - false (steps intermediários de drag rápido): usa `opts.fixedY` como Y do
//     candidato. Evita que sub-step "escale" obstáculo no caminho do drag.
function _applyDragStep(obj, targetXZ, opts = {}) {
  const snapSurface = opts.snapSurface !== false; // default true (retrocompat)

  let finalY;
  if (snapSurface) {
    // D.4: ordem invertida — surface primeiro, sweep depois.
    const surface = physics.surfaceUnder(obj, targetXZ, userRoot);

    // Fix Bug 11: compensa offset entre pivot e base do bbox.
    const currentBox = new THREE.Box3().setFromObject(obj);
    const baseOffset = obj.position.y - currentBox.min.y;
    finalY = (surface ? surface.y : 0) + baseOffset;
  } else {
    // Step intermediário: Y herdado do start do drag (não tenta escalar obstáculo).
    finalY = (opts.fixedY != null) ? opts.fixedY : obj.position.y;
  }

  // sweep XZ — anti-overlap (D.2 + D.4 yOverlap).
  const swept = physics.sweepXZ(obj, targetXZ, userRoot, { candidateY: finalY });

  obj.position.set(swept.x, finalY, swept.z);
  physics.update(obj);

  // D.5: sweep agora retorna .blocked — propagamos pra cima pra cursor not-allowed
  return !!swept.blocked;
}

// D.5 — decide quantos sub-steps usar baseado no delta XZ
function _calcSubSteps(fromXZ, toXZ) {
  if (!fromXZ) return 1;
  const dx = toXZ.x - fromXZ.x;
  const dz = toXZ.z - fromXZ.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist <= TUNNEL_STEP_THRESHOLD) return 1;
  return Math.min(TUNNEL_MAX_SUBSTEPS, Math.ceil(dist / TUNNEL_STEP_THRESHOLD));
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
  _hideHoverBox(); // D.5
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
  _lastTargetXZ = null;
  orbit.enabled = true;
  if (_container) {
    _container.classList.remove('grabbing');
    _container.classList.remove('colliding'); // D.5
  }
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
    _hideHoverBox(); // D.5
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

  // D.5 — bbox visual ao hover, só se NÃO for o objeto selecionado
  // (selecionado já tem highlight próprio do TransformControls / cadeado).
  const sel = getSelected();
  if (hitObj !== sel) {
    _showHoverBox(hitObj);
  } else {
    _hideHoverBox();
  }
}

// -------------------- drag programático (para QA) --------------------

// Move objeto pela pipeline sweep+surface sem interação de mouse.
// Retorna posição final.
//
// D.5: tunneling mitigation também se aplica aqui. Sem isso, um QA chamando
// dragObjectTo de (-5,0,0) → (5,0,0) com colisor em (0,0,0) atravessava direto.
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

  // D.5 tunneling mitigation + patch GIZMO-D4-1 (espelha _onPointerMove):
  //   1. Surface-snap só no step final — sub-steps intermediários mantêm Y
  //      fixo, evita "escalar" obstáculos em drag rápido.
  //   2. Pré-check de empilhamento: se target final é em cima de outro objeto,
  //      atalho pro snap final (empilhamento programático preserva semântica).
  //   3. Early-abort em sub-step bloqueado: evita teleport-push do slide.
  // Também documenta GIZMO-D4-2 (comportamento esperado): se target XZ cai
  // dentro do AABB de outro objeto, o pré-check planta em cima — é
  // empilhamento intencional, não bug. Slide manual ocorre só quando o
  // target XZ está FORA do AABB do outro objeto.
  const fromXZ = new THREE.Vector3(obj.position.x, 0, obj.position.z);
  const finalSurface = physics.surfaceUnder(obj, target, root);
  const isStackingTarget = !!(finalSurface && finalSurface.y > 0.001);

  if (isStackingTarget) {
    // Atalho: vai direto pro target final (surface-snap empilha em cima).
    _programmaticStep(obj, target, root, { snapSurface: true });
  } else {
    // Caminho normal: sub-steps com Y fixo. Surface-snap só no final.
    // Se sub-step intermediário fica bloqueado, aborta trajetória e roda
    // snap final na posição parada — evita teleport-push do slide quando
    // o target cai DENTRO do AABB do obstáculo.
    const steps = _calcSubSteps(fromXZ, target);
    const fixedY = obj.position.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sub = new THREE.Vector3(
        fromXZ.x + (target.x - fromXZ.x) * t,
        0,
        fromXZ.z + (target.z - fromXZ.z) * t,
      );
      const isFinal = (i === steps);
      const result = _programmaticStep(obj, sub, root, { snapSurface: isFinal, fixedY });
      if (!isFinal && result?.blocked) {
        _programmaticStep(obj, new THREE.Vector3(obj.position.x, 0, obj.position.z), root, { snapSurface: true });
        break;
      }
    }
  }

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

// D.5 — versão "stateless" do step pro caminho programático
// (não toca em _container/classList; só executa surface+sweep).
//
// Patch GIZMO-D4-1: `opts.snapSurface` controla se surface-snap roda neste
// step. `false` (sub-step intermediário) → usa `opts.fixedY` como Y do
// candidato, evitando que o objeto escale obstáculos durante o trajeto.
function _programmaticStep(obj, target, root, opts = {}) {
  const snapSurface = opts.snapSurface !== false;

  let finalY;
  if (snapSurface) {
    const surface = physics.surfaceUnder(obj, target, root);
    const currentBox = new THREE.Box3().setFromObject(obj);
    const baseOffset = obj.position.y - currentBox.min.y;
    finalY = (surface ? surface.y : 0) + baseOffset;
  } else {
    finalY = (opts.fixedY != null) ? opts.fixedY : obj.position.y;
  }

  const swept = physics.sweepXZ(obj, target, root, { candidateY: finalY });
  obj.position.set(swept.x, finalY, swept.z);
  physics.update(obj);
  return { blocked: !!swept.blocked };
}

// -------------------- helpers --------------------

function _isRoomPart(obj) {
  const kind = obj?.userData?.kind || '';
  return kind.startsWith('room:');
}
