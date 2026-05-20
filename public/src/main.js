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
  runSearchUI, setActiveProvider, getActiveProvider,
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
function syncSnapToggle() {
  const enabled = snap.isEnabled();
  snapToggleBtn.classList.toggle('active', enabled);
  snapToggleBtn.textContent = enabled ? '📐 encaixar' : '📐 livre';
  snapToggleBtn.title = enabled
    ? 'encaixe ativo — clique pra liberar posicionamento (G)'
    : 'encaixe desligado — clique pra encaixar à grade (G)';
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
  obj.name = transform.name || meta.name;
  addToScene(obj, { name: transform.name || meta.name, idPrefix: 'asset' });
  if (transform.position) obj.position.copy(transform.position);
  if (transform.rotation) obj.rotation.set(...transform.rotation);
  if (transform.scale) obj.scale.fromArray(transform.scale);
  URL.revokeObjectURL(url);
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
const cube = addCube();
cube.position.set(-1.4, 0.5, 0);
const sphere = addSphere();
sphere.position.set(1.4, 0.6, 0);

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
});

toast('clag carregado — arraste para orbitar · clique em objetos para selecionar', { timeout: 4500 });
