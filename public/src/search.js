import * as THREE from 'three';
import { providers, providerMap, searchAll } from './providers/index.js';
import { loadModelFromUrl } from './loader.js';
import { addToScene, worldPointAtScreen, userRoot } from './scene.js';
import { toast } from './toast.js';

// altura de teto padrao usada como fallback quando nao ha sala
// (Fase 3 — anchor='ceiling' sem room:ceiling cola nesse valor).
const ROOM_HEIGHT_DEFAULT = 2.7;

let activeProviderId = 'all';
let lastResults = [];
let currentSearchAbort = null;

// expoe pra api.js / agentes consumirem os mesmos results que a UI ve
export function getLastResults() { return lastResults; }
export function setLastResults(items) { lastResults = items; }
export { downloadAndPlace };
// applyAnchor exportado abaixo (declarado adiante).

// expoe pra api.js: dirige a UI da aba Buscar (input, provider, render)
// asim a API espelha exatamente o caminho UI — fecha bug 1 do QA.
export async function runSearchUI(query, providerId) {
  if (typeof query === 'string' && DOM.input) {
    DOM.input.value = query;
  }
  if (providerId !== undefined && providerId !== null) {
    setActiveProvider(providerId);
  }
  return await runSearch();
}

// expoe pra api.js: troca o provider ativo, atualiza label e menu da UI.
// fecha bug 2 do QA — botao #provider-btn agora tem equivalente programatico.
export function setActiveProvider(id) {
  const valid = id === 'all' || providers.some(p => p.id === id);
  if (!valid) throw new Error(`provider invalido: ${id}`);
  activeProviderId = id;
  if (DOM.providerLabel) {
    const label = id === 'all' ? 'todos os providers' : (providerMap[id]?.label || id);
    DOM.providerLabel.textContent = label;
  }
  if (DOM.providerMenu) buildProviderMenu();
  return activeProviderId;
}

export function getActiveProvider() { return activeProviderId; }

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

  // label inicial em PT-BR pra coincidir com a opcao default 'all'
  if (DOM.providerLabel) DOM.providerLabel.textContent = 'todos os providers';
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
    { id: 'all', label: 'todos os providers', badge: `${providers.length}` },
    ...providers.map(p => ({ id: p.id, label: p.label, badge: p.needsKey ? 'chave' : 'livre' })),
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

  DOM.results.innerHTML = `<div class="status">buscando…</div>`;
  const providerIds = activeProviderId === 'all' ? null : [activeProviderId];
  let items;
  try {
    items = await searchAll(q, { signal, providerIds });
  } catch (e) {
    if (signal.aborted) return [];
    DOM.results.innerHTML = `<div class="status error">busca falhou: ${escapeHtml(e.message)}</div>`;
    return [];
  }
  if (signal.aborted) return [];
  lastResults = items;
  if (items.length === 0) {
    DOM.results.innerHTML = `<div class="status">nenhum resultado para "${escapeHtml(q || '(vazio)')}"</div>`;
    return items;
  }
  renderResults(items);
  return items;
}

function renderResults(items) {
  DOM.results.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.draggable = true;
    card.title = `${item.name} — arraste para a cena para adicionar`;
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
  if (!provider) { toast(`provider desconhecido: ${item.source}`, { kind: 'error' }); return; }
  const t = toast(`baixando "${item.name}"…`, { timeout: 0 });
  try {
    const { url, ext } = await provider.download(item, {
      onProgress: (rec, total) => {
        if (total > 0) {
          t.setProgress(rec / total);
          t.update(`baixando "${item.name}"… ${formatBytes(rec)}/${formatBytes(total)}`);
        }
      },
    });
    t.update(`carregando "${item.name}"…`);
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
      // Fase 3: defaults de posicionamento herdados do catalogo (se vieram).
      anchor: item.anchor || 'floor',
      footprint: Array.isArray(item.footprint) ? [item.footprint[0], item.footprint[1]] : [1, 1],
    };
    // propaga pro topo do userData pra leitura barata (snap, inspector, api)
    obj.userData.anchor = obj.userData.assetMeta.anchor;
    obj.userData.footprint = obj.userData.assetMeta.footprint;
    obj.name = item.name;
    addToScene(obj, { name: item.name, idPrefix: 'asset', position });
    applyAnchor(obj, position);
    t.setKind('success');
    t.update(`"${item.name}" adicionado`);
    setTimeout(() => t.dismiss(), 1500);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    t.setKind('error');
    t.update(`falhou: ${e.message}`);
    setTimeout(() => t.dismiss(), 6000);
  }
}

// aplica regra de ancoragem ao objeto recem-adicionado (Fase 3 Sims-mode).
//
// - floor: ja eh o comportamento padrao (asset entra com Y=0 do loader). nop.
// - ceiling: se ha `room:ceiling`, alinha Y a altura dele; sem sala, usa
//   ROOM_HEIGHT_DEFAULT como fallback. marca anchorApplied.
// - wall: tenta raycast da posicao de drop em direcao a cada parede
//   `room:wall`; se acerta, cola na parede (posiciona no hit, alinha
//   rotacao Y com a normal da parede); sem sala, fallback (mantem floor).
//
// Helper publico — chamavel por inspector quando muda anchor depois.
export function applyAnchor(obj, dropPos) {
  const anchor = obj?.userData?.anchor || 'floor';
  if (anchor === 'floor') {
    obj.userData.anchorApplied = 'floor';
    return;
  }
  if (anchor === 'ceiling') {
    const ceiling = findUserChildByKind('room:ceiling');
    if (ceiling) {
      // alinha topo do objeto na altura do teto
      const box = new THREE.Box3().setFromObject(obj);
      const objHeight = box.getSize(new THREE.Vector3()).y;
      obj.position.y = ceiling.position.y - objHeight;
      obj.userData.anchorApplied = 'ceiling';
    } else {
      // fallback: teto padrao 2.7m. objeto "pendura" do teto fictício.
      const box = new THREE.Box3().setFromObject(obj);
      const objHeight = box.getSize(new THREE.Vector3()).y;
      obj.position.y = ROOM_HEIGHT_DEFAULT - objHeight;
      obj.userData.anchorApplied = 'ceiling-fallback';
    }
    return;
  }
  if (anchor === 'wall') {
    const walls = findUserChildrenByKind('room:wall');
    if (walls.length === 0 || !dropPos) {
      // sem sala -> comportamento atual (chao). marca pra UI saber.
      obj.userData.anchorApplied = 'wall-fallback';
      return;
    }
    // raycast horizontal a partir do drop em direcao a cada parede.
    // procura a parede mais proxima e cola o objeto la.
    const origin = new THREE.Vector3(dropPos.x, 1.2, dropPos.z); // altura tipica
    const raycaster = new THREE.Raycaster();
    let best = null;
    for (const wall of walls) {
      const center = new THREE.Vector3();
      new THREE.Box3().setFromObject(wall).getCenter(center);
      const dir = new THREE.Vector3().subVectors(center, origin).setY(0).normalize();
      raycaster.set(origin, dir);
      raycaster.far = 50;
      const hits = raycaster.intersectObject(wall, true);
      if (hits.length > 0) {
        const h = hits[0];
        if (!best || h.distance < best.hit.distance) {
          best = { hit: h, wall, dir };
        }
      }
    }
    if (best) {
      obj.position.copy(best.hit.point);
      // alinha rotacao Y pela normal (objeto "encostado" na parede)
      if (best.hit.face?.normal) {
        const worldNormal = best.hit.face.normal.clone()
          .transformDirection(best.wall.matrixWorld).setY(0).normalize();
        // angulo da normal apontando do drop pro centro do objeto
        obj.rotation.y = Math.atan2(worldNormal.x, worldNormal.z);
      }
      obj.userData.anchorApplied = 'wall';
    } else {
      obj.userData.anchorApplied = 'wall-fallback';
    }
    return;
  }
}

function findUserChildByKind(kind) {
  for (const c of userRoot.children) {
    if (c.userData?.kind === kind) return c;
  }
  return null;
}

function findUserChildrenByKind(kind) {
  const out = [];
  for (const c of userRoot.children) {
    if (c.userData?.kind === kind) out.push(c);
  }
  return out;
}

function formatBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
