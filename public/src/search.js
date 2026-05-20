import { providers, providerMap, searchAll } from './providers/index.js';
import { loadModelFromUrl } from './loader.js';
import { addToScene, worldPointAtScreen } from './scene.js';
import { toast } from './toast.js';

let activeProviderId = 'all';
let lastResults = [];
let currentSearchAbort = null;

// expoe pra api.js / agentes consumirem os mesmos results que a UI ve
export function getLastResults() { return lastResults; }
export function setLastResults(items) { lastResults = items; }
export { downloadAndPlace };

const DOM = {
  input: null,
  btn: null,
  results: null,
  providerBtn: null,
  providerLabel: null,
  providerMenu: null,
  viewportWrap: null,
};

export function initSearch({
  searchInput, searchBtn, resultsEl,
  providerBtn, providerLabel, providerMenu, viewportWrap,
}) {
  DOM.input = searchInput;
  DOM.btn = searchBtn;
  DOM.results = resultsEl;
  DOM.providerBtn = providerBtn;
  DOM.providerLabel = providerLabel;
  DOM.providerMenu = providerMenu;
  DOM.viewportWrap = viewportWrap;

  buildProviderMenu();

  searchBtn.addEventListener('click', () => runSearch());
  searchInput.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') runSearch();
  });
  // open menu
  providerBtn.addEventListener('click', () => {
    providerMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', e => {
    if (!providerBtn.contains(e.target) && !providerMenu.contains(e.target)) {
      providerMenu.classList.add('hidden');
    }
  });

  // viewport drop handlers
  viewportWrap.addEventListener('dragover', ev => {
    if (ev.dataTransfer?.types?.includes('application/x-clag-asset')) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
      viewportWrap.classList.add('drop-active');
    }
  });
  viewportWrap.addEventListener('dragleave', () => viewportWrap.classList.remove('drop-active'));
  viewportWrap.addEventListener('drop', async ev => {
    ev.preventDefault();
    viewportWrap.classList.remove('drop-active');
    const itemId = ev.dataTransfer.getData('application/x-clag-asset');
    if (!itemId) return;
    const item = lastResults.find(r => r.id === itemId);
    if (!item) return;
    const pos = worldPointAtScreen(ev.clientX, ev.clientY);
    await downloadAndPlace(item, pos);
  });
}

function buildProviderMenu() {
  const menu = DOM.providerMenu;
  menu.innerHTML = '';
  const opts = [
    { id: 'all', label: 'all providers', badge: `${providers.length}` },
    ...providers.map(p => ({ id: p.id, label: p.label, badge: p.needsKey ? 'key' : 'free' })),
  ];
  for (const o of opts) {
    const div = document.createElement('div');
    div.className = 'select-option' + (o.id === activeProviderId ? ' active' : '');
    div.dataset.id = o.id;
    const left = document.createElement('span');
    left.textContent = o.label;
    const right = document.createElement('span');
    right.className = 'badge';
    right.textContent = o.badge;
    div.append(left, right);
    div.addEventListener('click', () => {
      activeProviderId = o.id;
      DOM.providerLabel.textContent = o.label;
      DOM.providerMenu.classList.add('hidden');
      buildProviderMenu();
      if (DOM.input.value.trim()) runSearch();
    });
    menu.appendChild(div);
  }
}

async function runSearch() {
  const q = DOM.input.value.trim();
  // abort previous
  currentSearchAbort?.abort();
  currentSearchAbort = new AbortController();
  const signal = currentSearchAbort.signal;

  DOM.results.innerHTML = `<div class="status">searching…</div>`;
  const providerIds = activeProviderId === 'all' ? null : [activeProviderId];
  let items;
  try {
    items = await searchAll(q, { signal, providerIds });
  } catch (e) {
    if (signal.aborted) return;
    DOM.results.innerHTML = `<div class="status error">search failed: ${escapeHtml(e.message)}</div>`;
    return;
  }
  if (signal.aborted) return;
  lastResults = items;
  if (items.length === 0) {
    DOM.results.innerHTML = `<div class="status">no results for "${escapeHtml(q || '(empty)')}"</div>`;
    return;
  }
  renderResults(items);
}

function renderResults(items) {
  DOM.results.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.draggable = true;
    card.title = `${item.name} — drag to viewport to add`;
    card.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('application/x-clag-asset', item.id);
      ev.dataTransfer.effectAllowed = 'copy';
    });
    card.addEventListener('dblclick', () => downloadAndPlace(item));
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (item.thumb) {
      const img = document.createElement('img');
      img.src = item.thumb;
      img.loading = 'lazy';
      img.alt = item.name;
      img.addEventListener('error', () => {
        thumb.innerHTML = '';
        thumb.textContent = '⬡';
      });
      thumb.appendChild(img);
    } else {
      thumb.textContent = '⬡';
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;
    const source = document.createElement('div');
    source.className = 'source';
    source.textContent = providerMap[item.source]?.label || item.source;
    meta.append(name, source);
    if (item.license) {
      const lic = document.createElement('div');
      lic.className = 'license';
      lic.textContent = item.license;
      meta.appendChild(lic);
    }
    card.append(thumb, meta);
    DOM.results.appendChild(card);
  }
}

async function downloadAndPlace(item, position) {
  const provider = providerMap[item.source];
  if (!provider) { toast(`unknown provider: ${item.source}`, { kind: 'error' }); return; }
  const t = toast(`downloading "${item.name}"…`, { timeout: 0 });
  try {
    const { url, ext } = await provider.download(item, {
      onProgress: (rec, total) => {
        if (total > 0) {
          t.setProgress(rec / total);
          t.update(`downloading "${item.name}"… ${formatBytes(rec)}/${formatBytes(total)}`);
        }
      },
    });
    t.update(`loading "${item.name}"…`);
    t.setProgress(1);
    const obj = await loadModelFromUrl(url, ext || item.format);
    obj.userData.kind = 'asset';
    obj.userData.assetMeta = {
      source: providerMap[item.source]?.label || item.source,
      sourceId: item.source,
      itemId: item.id,
      name: item.name,
      license: item.license,
      format: ext || item.format,
      raw: item.raw,
      thumb: item.thumb,
    };
    obj.name = item.name;
    addToScene(obj, { name: item.name, idPrefix: 'asset', position });
    t.setKind('success');
    t.update(`added "${item.name}"`);
    setTimeout(() => t.dismiss(), 1500);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    t.setKind('error');
    t.update(`failed: ${e.message}`);
    setTimeout(() => t.dismiss(), 6000);
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
