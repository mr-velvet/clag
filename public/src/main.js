import {
  bootViewport, on, setGizmoMode, getGizmoMode,
  getSelected, setSelected, removeFromScene, duplicateObject,
} from './scene.js';
import { addCube, addSphere, addPlane, addPointLight } from './primitives.js';
import { initOutliner } from './outliner.js';
import { initInspector } from './inspector.js';
import { initSearch } from './search.js';
import { initToast, toast } from './toast.js';
import { saveSceneToLocal, restoreSceneFromLocal } from './persist.js';
import { loadModelFromUrl } from './loader.js';
import { providerMap } from './providers/index.js';
import { addToScene } from './scene.js';
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

// topbar wiring
$('btn-add-cube').addEventListener('click', addCube);
$('btn-add-sphere').addEventListener('click', addSphere);
$('btn-add-plane').addEventListener('click', addPlane);
$('btn-add-light').addEventListener('click', addPointLight);
$('btn-delete').addEventListener('click', () => {
  const s = getSelected();
  if (s) removeFromScene(s);
  else toast('nothing selected', { kind: 'warn' });
});
$('btn-duplicate').addEventListener('click', () => {
  const s = getSelected();
  if (s) duplicateObject(s);
  else toast('nothing selected', { kind: 'warn' });
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

// save / load
$('btn-save').addEventListener('click', () => {
  const data = saveSceneToLocal();
  toast(`saved ${data.objects.length} objects`, { kind: 'success' });
});
$('btn-load').addEventListener('click', async () => {
  const ok = await restoreSceneFromLocal(addPrimitiveByKind, downloadAndPlaceFromMeta);
  if (ok) toast('scene loaded', { kind: 'success' });
  else toast('no saved scene', { kind: 'warn' });
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
  hudSelection.textContent = `selected: ${sel.name || sel.userData.sceneId}`;
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

// deseleciona pra inspector mostrar "no object selected" no boot
setSelected(null);

toast('clag loaded — drag to orbit · click objects to select', { timeout: 4500 });
