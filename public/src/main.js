import {
  bootViewport, on, setGizmoMode, getGizmoMode,
  getSelected, setSelected, removeFromScene, duplicateObject,
  notifySceneChanged,
} from './scene.js';
import { addCube, addSphere, addPlane, addPointLight } from './primitives.js';
import { initOutliner } from './outliner.js';
import { initInspector } from './inspector.js';
import {
  initSearch, getLastResults, setLastResults, downloadAndPlace,
  runSearchUI, setActiveProvider, getActiveProvider, applyAnchor,
} from './search.js';
import * as snap from './snap.js';
import { initCatalogUI, searchCategory, showTab, expandCategory, collapseCategory, getExpandedCategories } from './catalog-ui.js';
import { getTree, getLeaf } from './catalog.js';
import { initToast, toast } from './toast.js';
import { saveSceneToLocal, restoreSceneFromLocal } from './persist.js';
import { loadModelFromUrl } from './loader.js';
import { providerMap } from './providers/index.js';
import { addToScene } from './scene.js';
import { initApi } from './api.js';
import { createRoom, removeRoom, getRoomDimensions, hasRoom } from './room.js';
import * as THREE from 'three';

const $ = id => document.getElementById(id);

// boot
initToast($('toast-stack'));
bootViewport($('viewport'));
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
  if (ok) toast('cena carregada', { kind: 'success' });
  else toast('nenhuma cena salva', { kind: 'warn' });
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
      <div class="modal-subtitle">paredes, piso e teto serão criados ao redor da origem. já existir uma sala, ela é substituída.</div>
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

// cena starter — plane grande chão + cubo + esfera, pra dar sinal de vida no boot
const ground = addPlane();
ground.scale.set(2.5, 1, 2.5);  // 20x20
ground.name = 'Ground';
// Fix B (Fase 3): coordenadas multiplo de 0.5 (gridSize default) pra
// cena starter nascer alinhada ao grid — coerente com snap default ON.
const cube = addCube();
cube.position.set(-1.5, 0.5, 0);
const sphere = addSphere();
sphere.position.set(1.5, 0.6, 0);

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
  load: async () => await restoreSceneFromLocal(addPrimitiveByKind, downloadAndPlaceFromMeta),
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
});

toast('clag carregado — arraste para orbitar · clique em objetos para selecionar', { timeout: 4500 });
