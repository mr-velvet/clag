// catalog-ui.js — render da aba Catalogo
//
// Layout: arvore colapsavel a esquerda, grade de resultados a direita
// (mesma estrutura que a aba "Buscar" usa). Click em folha -> dispara
// searchAll(leaf.query) e popula a grade.
//
// Comparte renderResults / downloadAndPlace com search.js: o catalogo
// nao tem fluxo proprio de download; ele so escolhe a query.

import { tree, getLeaf } from './catalog.js';
import { searchAll, providerMap } from './providers/index.js';
import { setLastResults, downloadAndPlace } from './search.js';
import { worldPointAtScreen } from './scene.js';
import { toast } from './toast.js';

const DOM = {
  tree: null,
  results: null,
  searchPane: null,
  catalogPane: null,
  tabSearch: null,
  tabCatalog: null,
  viewportWrap: null,
};

let expandedCategories = new Set();
let activeLeafId = null;
let currentAbort = null;

export function initCatalogUI({
  treeEl, resultsEl, searchPane, catalogPane,
  tabSearch, tabCatalog, viewportWrap,
}) {
  DOM.tree = treeEl;
  DOM.results = resultsEl;
  DOM.searchPane = searchPane;
  DOM.catalogPane = catalogPane;
  DOM.tabSearch = tabSearch;
  DOM.tabCatalog = tabCatalog;
  DOM.viewportWrap = viewportWrap;

  // expanda primeira categoria por padrao pra o user ver a estrutura no boot
  expandedCategories.add(tree[0]?.id);

  // tabs
  tabSearch.addEventListener('click', () => showTab('search'));
  tabCatalog.addEventListener('click', () => showTab('catalog'));

  renderTree();
}

export function showTab(which) {
  if (which === 'search') {
    DOM.searchPane.classList.remove('hidden');
    DOM.catalogPane.classList.add('hidden');
    DOM.tabSearch.classList.add('active');
    DOM.tabSearch.setAttribute('aria-selected', 'true');
    DOM.tabCatalog.classList.remove('active');
    DOM.tabCatalog.setAttribute('aria-selected', 'false');
  } else {
    DOM.searchPane.classList.add('hidden');
    DOM.catalogPane.classList.remove('hidden');
    DOM.tabSearch.classList.remove('active');
    DOM.tabSearch.setAttribute('aria-selected', 'false');
    DOM.tabCatalog.classList.add('active');
    DOM.tabCatalog.setAttribute('aria-selected', 'true');
  }
}

function renderTree() {
  const t = DOM.tree;
  t.innerHTML = '';
  for (const cat of tree) {
    const catEl = document.createElement('div');
    catEl.className = 'catalog-cat';

    const header = document.createElement('button');
    header.className = 'catalog-cat-header' + (expandedCategories.has(cat.id) ? ' expanded' : '');
    header.dataset.categoryId = cat.id;
    header.setAttribute('data-clag-action', `catalog-toggle-${cat.id}`);
    header.innerHTML = `
      <span class="cat-chevron">${expandedCategories.has(cat.id) ? '▾' : '▸'}</span>
      <span class="cat-icon">${cat.icon || '◆'}</span>
      <span class="cat-label">${cat.label}</span>
      <span class="cat-count">${cat.children?.length || 0}</span>
    `;
    header.addEventListener('click', () => {
      if (expandedCategories.has(cat.id)) expandedCategories.delete(cat.id);
      else expandedCategories.add(cat.id);
      renderTree();
    });
    catEl.appendChild(header);

    if (expandedCategories.has(cat.id)) {
      const list = document.createElement('div');
      list.className = 'catalog-leaf-list';
      for (const leaf of (cat.children || [])) {
        const item = document.createElement('button');
        item.className = 'catalog-leaf' + (activeLeafId === leaf.id ? ' active' : '');
        item.dataset.leafId = leaf.id;
        item.setAttribute('data-clag-action', `catalog-pick-${leaf.id}`);
        item.textContent = leaf.label;
        item.title = `busca: "${leaf.query}"`;
        item.addEventListener('click', () => searchCategory(leaf.id));
        list.appendChild(item);
      }
      catEl.appendChild(list);
    }

    t.appendChild(catEl);
  }
}

export async function searchCategory(leafId) {
  const leaf = getLeaf(leafId);
  if (!leaf) {
    toast(`categoria desconhecida: ${leafId}`, { kind: 'warn' });
    return [];
  }
  activeLeafId = leafId;
  renderTree();

  // garante que estamos na aba Catalogo
  if (DOM.catalogPane?.classList.contains('hidden')) showTab('catalog');

  currentAbort?.abort();
  currentAbort = new AbortController();
  const signal = currentAbort.signal;

  DOM.results.innerHTML = `<div class="status">buscando "${escapeHtml(leaf.label)}"…</div>`;
  let items;
  try {
    items = await searchAll(leaf.query, { signal });
  } catch (e) {
    if (signal.aborted) return [];
    DOM.results.innerHTML = `<div class="status error">falhou: ${escapeHtml(e.message)}</div>`;
    return [];
  }
  if (signal.aborted) return [];
  // decora cada item com defaults de posicionamento da folha (Fase 3).
  // assim drop, dblclick e dropAsset via API ja herdam anchor/footprint
  // sem que cada caminho precise lookup separado.
  const decorated = items.map(it => ({
    ...it,
    anchor: leaf.anchor || 'floor',
    footprint: Array.isArray(leaf.footprint) ? [leaf.footprint[0], leaf.footprint[1]] : [1, 1],
  }));
  setLastResults(decorated);
  if (decorated.length === 0) {
    DOM.results.innerHTML = `<div class="status">nenhum asset pra "${escapeHtml(leaf.label)}". tente outra categoria.</div>`;
    return decorated;
  }
  renderResults(decorated);
  return decorated;
}

function renderResults(items) {
  DOM.results.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.draggable = true;
    card.title = `${item.name} — arraste para a cena`;
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

export function expandCategory(id) {
  expandedCategories.add(id);
  renderTree();
}
export function collapseCategory(id) {
  expandedCategories.delete(id);
  renderTree();
}
export function getExpandedCategories() {
  return Array.from(expandedCategories);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
