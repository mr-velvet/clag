import {
  scene, bootViewport, on, setGizmoMode, getGizmoMode,
  getSelected, setSelected, removeFromScene, duplicateObject,
  notifySceneChanged, userRoot, addToScene,
  // CR-12 (wave-b2, 2026-05-21): helper único pra sincronizar pós-mutação
  // em batch (load, restore, boot inicial). Substitui o par
  // `scene.updateMatrixWorld(true) + physics.registerAll(userRoot)` que estava
  // duplicado em 3 call sites — drift fácil de erro de ordem.
  syncSceneAfterMutation,
} from './scene.js';
import { addCube, addSphere, addPlane, addPointLight } from './primitives.js';
import { initOutliner } from './outliner.js';
import { initInspector } from './inspector.js';
import {
  initSearch, getLastResults, setLastResults, downloadAndPlace,
  runSearchUI, setActiveProvider, getActiveProvider, applyAnchor,
  setKeyPanelOpener,
} from './search.js';
import * as snap from './snap.js';
import { initCatalogUI, searchCategory, showTab, expandCategory, collapseCategory, getExpandedCategories } from './catalog-ui.js';
import { getTree, getLeaf } from './catalog.js';
import { initToast, toast } from './toast.js';
import { saveSceneToLocal, restoreSceneFromLocal } from './persist.js';
import { loadModelFromUrl } from './loader.js';
import { providerMap } from './providers/index.js';
import { initApi } from './api.js';
import { createRoom, removeRoom, getRoomDimensions, hasRoom } from './room.js';
import { initContextualGizmo } from './contextual-gizmo.js';
// CR-12: physics não é mais importado direto — syncSceneAfterMutation em scene.js
// encapsula registerAll. Mantém main.js mais magro e desacopla do store de física.
import * as THREE from 'three';

const $ = id => document.getElementById(id);

// boot
initToast($('toast-stack'));
bootViewport($('viewport'));
// D.3: gizmo contextual — drag-to-translate + cadeado overlay
initContextualGizmo({ container: $('viewport-wrap') });
initOutliner($('outliner'));
initInspector($('inspector'));
initSearch({
  searchInput: $('search-input'),
  searchBtn: $('search-btn'),
  resultsEl: $('results'),
  providerBtn: $('provider-btn'),
  providerLabel: $('provider-label'),
  providerMenu: $('provider-menu'),
  viewportWrap: $('viewport-wrap'),
});
initCatalogUI({
  treeEl: $('catalog-tree'),
  resultsEl: $('catalog-results'),
  searchPane: $('search-pane'),
  catalogPane: $('catalog-pane'),
  tabSearch: $('tab-search'),
  tabCatalog: $('tab-catalog'),
  viewportWrap: $('viewport-wrap'),
});

// topbar wiring
$('btn-add-cube').addEventListener('click', addCube);
$('btn-add-sphere').addEventListener('click', addSphere);
$('btn-add-plane').addEventListener('click', addPlane);
$('btn-add-light').addEventListener('click', addPointLight);
$('btn-add-room').addEventListener('click', () => openRoomModal());
$('btn-delete').addEventListener('click', () => {
  const s = getSelected();
  if (s) removeFromScene(s);
  else toast('nada selecionado', { kind: 'warn' });
});
$('btn-duplicate').addEventListener('click', () => {
  const s = getSelected();
  if (s) duplicateObject(s);
  else toast('nada selecionado', { kind: 'warn' });
});

// mode buttons
const modeButtons = {
  translate: $('mode-translate'),
  rotate: $('mode-rotate'),
  scale: $('mode-scale'),
};
function syncModeButtons() {
  const m = getGizmoMode();
  for (const k in modeButtons) modeButtons[k].classList.toggle('active', k === m);
}
modeButtons.translate.addEventListener('click', () => { setGizmoMode('translate'); syncModeButtons(); });
modeButtons.rotate.addEventListener('click', () => { setGizmoMode('rotate'); syncModeButtons(); });
modeButtons.scale.addEventListener('click', () => { setGizmoMode('scale'); syncModeButtons(); });
on('selectionChanged', syncModeButtons);

// snap toggle + popover de config (Fase 2 Sims-mode)
const snapToggleBtn = $('btn-snap-toggle');
const snapConfigBtn = $('btn-snap-config');
// Fix C (Fase 3): texto do botao eh fixo "encaixar". So a classe .active +
// cor + tooltip dao sinal de estado. Pattern de toggle (B do Word, VS Code).
function syncSnapToggle() {
  const enabled = snap.isEnabled();
  snapToggleBtn.classList.toggle('active', enabled);
  snapToggleBtn.title = enabled
    ? 'encaixe ativo (G) — clique pra liberar'
    : 'encaixe desligado (G) — clique pra encaixar à grade';
}
snapToggleBtn.addEventListener('click', () => snap.setEnabled(!snap.isEnabled()));
snap.on('snapChanged', syncSnapToggle);
syncSnapToggle();

// popover de config — custom (sem prompt/confirm/select nativos)
let snapPopover = null;
function buildSnapPopover() {
  const pop = document.createElement('div');
  pop.className = 'snap-popover hidden';
  pop.innerHTML = `
    <div class="snap-popover-title">configurações de encaixe</div>
    <div class="snap-popover-row">
      <label for="snap-grid-input">tamanho do grid (m)</label>
      <input id="snap-grid-input" type="number" min="0.05" max="5" step="0.05" />
    </div>
    <div class="snap-popover-row">
      <label for="snap-rot-input">passo de rotação (°)</label>
      <input id="snap-rot-input" type="number" min="1" max="90" step="1" />
    </div>
    <div class="snap-popover-hint">grid 0.5 m + rotação 15° é confortável pra interiores.</div>
  `;
  // anexa ao grupo do snap pra posicionar relativo ao botao
  const group = snapToggleBtn.parentElement;
  group.appendChild(pop);

  const gridInput = pop.querySelector('#snap-grid-input');
  const rotInput  = pop.querySelector('#snap-rot-input');
  gridInput.value = snap.getGridSize();
  rotInput.value  = snap.getRotStep();

  gridInput.addEventListener('change', () => {
    const v = parseFloat(gridInput.value);
    try { snap.setGridSize(v); } catch (_) { gridInput.value = snap.getGridSize(); }
  });
  rotInput.addEventListener('change', () => {
    const v = parseFloat(rotInput.value);
    try { snap.setRotStep(v); } catch (_) { rotInput.value = snap.getRotStep(); }
  });
  // sincroniza inputs se outra fonte mudar (api programatica, atalho G nao muda esses)
  snap.on('snapChanged', s => {
    if (document.activeElement !== gridInput) gridInput.value = s.gridSize;
    if (document.activeElement !== rotInput)  rotInput.value  = s.rotStep;
  });
  return pop;
}
function openSnapPopover() {
  if (!snapPopover) snapPopover = buildSnapPopover();
  snapPopover.classList.remove('hidden');
  snapConfigBtn.setAttribute('aria-expanded', 'true');
  // fecha clicando fora
  setTimeout(() => document.addEventListener('mousedown', onDocMouseDown), 0);
}
function closeSnapPopover() {
  if (snapPopover) snapPopover.classList.add('hidden');
  snapConfigBtn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('mousedown', onDocMouseDown);
}
function onDocMouseDown(ev) {
  if (!snapPopover) return;
  if (snapPopover.contains(ev.target)) return;
  if (snapConfigBtn.contains(ev.target)) return;
  closeSnapPopover();
}
snapConfigBtn.addEventListener('click', ev => {
  ev.stopPropagation();
  const isOpen = snapConfigBtn.getAttribute('aria-expanded') === 'true';
  if (isOpen) closeSnapPopover(); else openSnapPopover();
});

// save / load
$('btn-save').addEventListener('click', () => {
  const data = saveSceneToLocal();
  toast(`${data.objects.length} objetos salvos`, { kind: 'success' });
});
$('btn-load').addEventListener('click', async () => {
  const ok = await restoreSceneFromLocal(addPrimitiveByKind, downloadAndPlaceFromMeta);
  if (ok) {
    // CR-12: syncSceneAfterMutation faz updateMatrixWorld + registerAll na ordem certa.
    syncSceneAfterMutation();
    toast('cena carregada', { kind: 'success' });
  } else {
    toast('nenhuma cena salva', { kind: 'warn' });
  }
});

function addPrimitiveByKind(kind) {
  if (kind === 'cube') return addCube();
  if (kind === 'sphere') return addSphere();
  if (kind === 'plane') return addPlane();
  if (kind === 'light') return addPointLight();
  return null;
}

async function downloadAndPlaceFromMeta(meta, transform) {
  const provider = providerMap[meta.sourceId];
  if (!provider) throw new Error(`unknown provider: ${meta.sourceId}`);
  const item = {
    id: meta.itemId,
    source: meta.sourceId,
    name: meta.name,
    format: meta.format,
    raw: meta.raw,
  };
  const { url, ext } = await provider.download(item);
  const obj = await loadModelFromUrl(url, ext || meta.format);
  obj.userData.kind = 'asset';
  obj.userData.assetMeta = meta;
  // fallback retro-compat: saves anteriores à Fase 3 não têm anchor/footprint
  // no top-level mas têm em assetMeta — copia daqui pra userData garantir.
  if (meta.anchor) obj.userData.anchor = meta.anchor;
  if (Array.isArray(meta.footprint)) {
    obj.userData.footprint = [meta.footprint[0], meta.footprint[1]];
  }
  obj.name = transform.name || meta.name;
  addToScene(obj, { name: transform.name || meta.name, idPrefix: 'asset' });
  if (transform.position) obj.position.copy(transform.position);
  if (transform.rotation) obj.rotation.set(...transform.rotation);
  if (transform.scale) obj.scale.fromArray(transform.scale);
  URL.revokeObjectURL(url);
  // Fix Bug 8 (bloqueador Fase 3): retornar obj pra persist.js conseguir
  // chamar applySimsMeta(obj, savedObj) e restaurar anchor/footprint/freeTransform
  // do save. Antes retornava undefined -> applySimsMeta nunca rodava.
  return obj;
}

// modal custom "Nova Sala" (Fase 4) — substitui prompt(). Defaults 6×5×2.7m.
// Reabre sempre limpo. Esc fecha. Click fora do card tambem fecha.
let _roomModal = null;
function buildRoomModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay hidden';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-labelledby="room-modal-title">
      <div class="modal-title" id="room-modal-title">nova sala</div>
      <div class="modal-subtitle">paredes, piso e teto serão criados ao redor da origem. se já existir uma sala, ela será substituída — cores das paredes voltam ao padrão.</div>
      <div class="modal-row">
        <label for="room-w-input">largura (m)</label>
        <input id="room-w-input" type="number" min="1" max="50" step="0.1" value="6" />
      </div>
      <div class="modal-row">
        <label for="room-d-input">profundidade (m)</label>
        <input id="room-d-input" type="number" min="1" max="50" step="0.1" value="5" />
      </div>
      <div class="modal-row">
        <label for="room-h-input">altura (m)</label>
        <input id="room-h-input" type="number" min="1.5" max="20" step="0.1" value="2.7" />
      </div>
      <div class="modal-actions">
        <button id="room-modal-cancel" class="btn" data-clag-action="room-modal-cancel">cancelar</button>
        <button id="room-modal-create" class="btn primary" data-clag-action="room-modal-create">criar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const wInput = overlay.querySelector('#room-w-input');
  const dInput = overlay.querySelector('#room-d-input');
  const hInput = overlay.querySelector('#room-h-input');
  const cancelBtn = overlay.querySelector('#room-modal-cancel');
  const createBtn = overlay.querySelector('#room-modal-create');

  function commit() {
    const w = parseFloat(wInput.value);
    const d = parseFloat(dInput.value);
    const h = parseFloat(hInput.value);
    if (!Number.isFinite(w) || w <= 0 ||
        !Number.isFinite(d) || d <= 0 ||
        !Number.isFinite(h) || h <= 0) {
      toast('dimensões inválidas — use números positivos', { kind: 'warn' });
      return;
    }
    try {
      createRoom({ width: w, depth: d, height: h });
      toast(`sala criada (${w}×${d}×${h}m)`, { kind: 'success' });
      closeRoomModal();
    } catch (e) {
      toast(`falha ao criar sala: ${e.message}`, { kind: 'error' });
    }
  }
  cancelBtn.addEventListener('click', closeRoomModal);
  createBtn.addEventListener('click', commit);
  // Enter em qualquer input confirma; Esc cancela
  overlay.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    if (ev.key === 'Escape') { ev.preventDefault(); closeRoomModal(); }
  });
  overlay.addEventListener('click', ev => {
    if (ev.target === overlay) closeRoomModal();
  });
  return { overlay, wInput, dInput, hInput };
}
function openRoomModal() {
  if (!_roomModal) _roomModal = buildRoomModal();
  // pre-preenche com dimensoes atuais se ja ha sala (facilita "editar")
  const cur = getRoomDimensions();
  if (cur) {
    _roomModal.wInput.value = cur.width;
    _roomModal.dInput.value = cur.depth;
    _roomModal.hInput.value = cur.height;
  } else {
    _roomModal.wInput.value = 6;
    _roomModal.dInput.value = 5;
    _roomModal.hInput.value = 2.7;
  }
  _roomModal.overlay.classList.remove('hidden');
  // foco no primeiro input pra Enter confirmar direto
  setTimeout(() => _roomModal.wInput.focus(), 0);
}
function closeRoomModal() {
  if (_roomModal) _roomModal.overlay.classList.add('hidden');
}

// painel custom de configuracao de chave de provider — substitui prompt().
// Acionado pelo botao "Configurar" do toast quando download exige token.
// Persiste em localStorage[`clag:keys:${providerId}`] (convencao do ARCHITECTURE.md).
const PROVIDER_KEY_HINTS = {
  sketchfab: { label: 'obter token em sketchfab.com/settings/password', url: 'https://sketchfab.com/settings/password' },
};
let _keyPanel = null;
function buildKeyPanel() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay hidden';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-labelledby="key-modal-title">
      <div class="modal-title" id="key-modal-title">configurar acesso</div>
      <a class="modal-link" id="key-modal-hint" target="_blank" rel="noopener"></a>
      <div class="modal-row full">
        <label for="key-modal-input">token de API</label>
        <input id="key-modal-input" type="password" autocomplete="off" spellcheck="false" />
      </div>
      <div class="modal-actions">
        <button class="btn" data-clag-action="key-modal-cancel" id="key-modal-cancel">cancelar</button>
        <button class="btn primary" data-clag-action="key-modal-save" id="key-modal-save">salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const titleEl = overlay.querySelector('#key-modal-title');
  const hintEl = overlay.querySelector('#key-modal-hint');
  const input = overlay.querySelector('#key-modal-input');
  const cancelBtn = overlay.querySelector('#key-modal-cancel');
  const saveBtn = overlay.querySelector('#key-modal-save');
  let currentProviderId = null;

  function commit() {
    if (!currentProviderId) return;
    const v = input.value.trim();
    if (!v) { toast('token vazio', { kind: 'warn' }); return; }
    localStorage.setItem(`clag:keys:${currentProviderId}`, v);
    const prov = providerMap[currentProviderId];
    toast(`token de ${prov?.label || currentProviderId} salvo`, { kind: 'success' });
    close();
  }
  function close() { overlay.classList.add('hidden'); }
  cancelBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', commit);
  overlay.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
  });
  overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });
  return {
    overlay, titleEl, hintEl, input,
    open(providerId) {
      currentProviderId = providerId;
      const prov = providerMap[providerId];
      titleEl.textContent = `configurar acesso ao ${prov?.label || providerId}`;
      const hint = PROVIDER_KEY_HINTS[providerId];
      if (hint) {
        hintEl.textContent = hint.label;
        hintEl.href = hint.url;
        hintEl.style.display = '';
      } else {
        hintEl.style.display = 'none';
      }
      input.value = localStorage.getItem(`clag:keys:${providerId}`) || '';
      overlay.classList.remove('hidden');
      setTimeout(() => input.focus(), 0);
    },
  };
}
function openProviderKeyPanel(providerId) {
  if (!providerMap[providerId]) {
    toast(`provider desconhecido: ${providerId}`, { kind: 'warn' });
    return;
  }
  if (!_keyPanel) _keyPanel = buildKeyPanel();
  _keyPanel.open(providerId);
}
setKeyPanelOpener(openProviderKeyPanel);

// HUD stats
const hudStats = $('hud-stats');
const hudSelection = $('hud-selection');
on('statsTick', s => {
  hudStats.textContent = `${s.fps.toFixed(0)} fps · ${s.calls} calls · ${formatTris(s.tris)} tris`;
});
on('selectionChanged', sel => {
  if (!sel) { hudSelection.textContent = ''; return; }
  hudSelection.textContent = `selecionado: ${sel.name || sel.userData.sceneId}`;
});

function formatTris(n) {
  if (n < 1000) return `${n}`;
  if (n < 1e6) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1e6).toFixed(2)}M`;
}

// toggle painéis laterais
const appEl = document.getElementById('app');
$('toggle-left').addEventListener('click', () => appEl.classList.toggle('no-left'));
$('toggle-right').addEventListener('click', () => appEl.classList.toggle('no-right'));

// DEBT-2 (wave-b2, 2026-05-21): auto-load da cena salva no boot.
// Antes o user sempre clicava Load mesmo tendo cena salva (violava Princípio 7).
// Lógica:
//   1. Cria starter scene (plane + cube + sphere) como fallback visual imediato.
//   2. Se localStorage tem `clag:scene-v1`, tenta restaurar. Restore limpa o
//      starter e repopula. Em falha (JSON corrompido), starter fica como está.
//   3. Toast informa qual fluxo aconteceu — important pro user perceber.
function _buildStarterScene() {
  const ground = addPlane();
  ground.scale.set(2.5, 1, 2.5);  // 20x20
  ground.name = 'Ground';
  // D.3: grid snap agora é OFF por default (surface-snap é o novo default).
  // addToScene já chama applySnapToObject, que respeita o novo DEFAULT_ENABLED=false.
  const cube = addCube();
  cube.position.set(-1.5, 0.5, 0);
  const sphere = addSphere();
  sphere.position.set(1.5, 0.6, 0);
}

_buildStarterScene();

// CR-12: syncSceneAfterMutation centraliza o par updateMatrixWorld + registerAll.
// Sem isso, todos os AABBs ficariam na posição do primeiro objeto (matrix stale
// pré-primeiro-render).
syncSceneAfterMutation();

// DEBT-2: tenta restaurar cena salva. restoreSceneFromLocal limpa o userRoot
// antes de hidratar, então o starter scene some se houver save. Em erro de
// parse/restore, registra warning e mantém starter — não derruba o boot.
(async () => {
  try {
    const ok = await restoreSceneFromLocal(addPrimitiveByKind, downloadAndPlaceFromMeta);
    if (ok) {
      syncSceneAfterMutation();
      toast('cena anterior carregada', { kind: 'success' });
    }
    // se !ok (sem save), starter scene fica visível — sem toast (boot limpo)
  } catch (err) {
    console.warn('[clag] auto-load falhou; usando cena starter', err);
    toast('falha ao restaurar cena salva — usando starter', { kind: 'warn' });
  }
})();

// deseleciona pra inspector mostrar "nenhum objeto selecionado" no boot
setSelected(null);

// expoe api programatica (window.clag) — Fase 0 + Fase 1 Sims-mode
initApi({
  addPrimitiveByKind,
  downloadAndPlace,
  getLastResults,
  setLastResults,
  runSearchUI,
  setActiveProvider,
  getActiveProvider,
  save: () => saveSceneToLocal(),
  load: async () => {
    // CR-12: syncSceneAfterMutation faz updateMatrixWorld + registerAll na ordem certa.
    const ok = await restoreSceneFromLocal(addPrimitiveByKind, downloadAndPlaceFromMeta);
    if (ok) syncSceneAfterMutation();
    return ok;
  },
  // catalogo
  catalogSearchCategory: searchCategory,
  catalogExpandCategory: expandCategory,
  catalogCollapseCategory: collapseCategory,
  catalogGetExpandedCategories: getExpandedCategories,
  catalogShowTab: showTab,
  notifyChange: notifySceneChanged,
  // Fase 3: anchor helper pro inspector / api re-aplicarem ao mudar 'apoio'
  applyAnchor,
  // Fase 4: modo sala
  createRoom,
  removeRoom,
  getRoomDimensions,
  hasRoom,
  openRoomModal,
  // config: painel custom de chave de provider
  openProviderKeyPanel,
});

toast('clag carregado — arraste para orbitar · clique em objetos para selecionar', { timeout: 4500 });
