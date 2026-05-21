// api.js — superficie programatica de testes (window.clag)
//
// Exposto pra agentes (QA UX, automacao, console manual) acionarem a engine
// sem depender de coordenadas de pixel ou DOM. Cada acao mapeia para um
// botao/atalho ja existente — esta camada NAO altera comportamento, so expoe.
//
// Convencao: actions.* sao funcoes (sync ou Promise). state.* sao getters.
//
// Uso tipico no console:
//   await clag.actions.addPrimitive('cube')
//   await clag.actions.runSearch('chair')
//   await clag.actions.dropAsset(clag.state.lastResults()[0].id)
//   clag.state.selected()

import * as THREE from 'three';
import {
  on,
  getSelected, setSelected,
  removeFromScene, duplicateObject,
  setGizmoMode, getGizmoMode,
  getUserObjects, userRoot,
  worldPointAtScreen, renderer,
  notifySceneChanged,
  gizmo,
} from './scene.js';
import { providers, providerMap, searchAll } from './providers/index.js';
import { getTree, getLeaf, allLeaves } from './catalog.js';
import * as snap from './snap.js';
import * as physics from './physics.js';
import {
  toggleLock as cgToggleLock,
  dragObjectTo as cgDragObjectTo,
  isContextualMode, setContextualMode,
} from './contextual-gizmo.js';
// runSearchUI / setActiveProvider vem via deps pra evitar acoplamento direto,
// mas como search.js ja eh importado em main, pegamos via deps em initApi.

// estes vem de main.js via initApi(deps) — modulos pesados ficam la pra evitar
// dependencia circular de import
let _deps = null;

function ensureDeps() {
  if (!_deps) throw new Error('clag api nao inicializada — chame initApi(deps) primeiro');
  return _deps;
}

// -------------------- actions --------------------

const actions = {
  // primitivas
  addPrimitive(kind) {
    const d = ensureDeps();
    const obj = d.addPrimitiveByKind(kind);
    if (!obj) throw new Error(`primitivo desconhecido: ${kind}`);
    return summarizeObject(obj);
  },

  // gizmo
  setGizmoMode(mode) {
    if (!['translate', 'rotate', 'scale', 'contextual'].includes(mode)) {
      throw new Error(`modo invalido: ${mode}`);
    }
    if (mode === 'contextual') {
      // Fix GIZMO-3: ao voltar pro modo contextual via API, desacopla TransformControls
      // pra que o gizmo visual desapareça. Sem isso, gizmo fica visível sobreposto.
      setContextualMode(true);
      if (gizmo) gizmo.detach();
    } else {
      setContextualMode(false);
      setGizmoMode(mode);
      d_syncModeButtons();
    }
    return mode;
  },
  getGizmoMode() {
    if (isContextualMode()) return 'contextual';
    return getGizmoMode();
  },

  // selecao
  selectByName(name) {
    const obj = getUserObjects().find(o => o.name === name);
    if (!obj) return null;
    setSelected(obj);
    return summarizeObject(obj);
  },
  selectBySceneId(id) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === id);
    if (!obj) return null;
    setSelected(obj);
    return summarizeObject(obj);
  },
  deselect() { setSelected(null); },

  // ops de cena
  deleteSelected() {
    const s = getSelected();
    if (!s) return false;
    removeFromScene(s);
    return true;
  },
  duplicateSelected() {
    const s = getSelected();
    if (!s) return null;
    const clone = duplicateObject(s);
    return summarizeObject(clone);
  },

  // persistencia
  save() {
    const d = ensureDeps();
    return d.save();
  },
  async load() {
    const d = ensureDeps();
    return await d.load();
  },

  // busca — delega pra UI da aba Buscar pra que a grade visual atualize
  // (fecha bug 1 do QA: API espelha UI).
  async runSearch(query, providerId) {
    const d = ensureDeps();
    return await d.runSearchUI(query, providerId);
  },

  // troca de provider ativo — sincroniza estado interno + label/menu da UI
  // (fecha bug 2 do QA: botao #provider-btn ganha equivalente programatico).
  setProvider(id) {
    const d = ensureDeps();
    return d.setActiveProvider(id);
  },

  // drop programatico de asset (usa lastResults guardado pelo search.js + api)
  async dropAsset(itemId, position) {
    const d = ensureDeps();
    const item = d.getLastResults().find(r => r.id === itemId);
    if (!item) throw new Error(`item nao encontrado em lastResults: ${itemId}`);
    let pos = null;
    if (position) {
      pos = new THREE.Vector3(position.x ?? 0, position.y ?? 0, position.z ?? 0);
    } else {
      // centro do viewport como fallback
      const r = renderer.domElement.getBoundingClientRect();
      pos = worldPointAtScreen(r.left + r.width / 2, r.top + r.height / 2);
    }
    await d.downloadAndPlace(item, pos);
    const s = getSelected();
    return s ? summarizeObject(s) : null;
  },

  // paineis
  toggleLeftPanel() {
    document.getElementById('app').classList.toggle('no-left');
    return !document.getElementById('app').classList.contains('no-left');
  },
  toggleRightPanel() {
    document.getElementById('app').classList.toggle('no-right');
    return !document.getElementById('app').classList.contains('no-right');
  },

  // snap (Fase 2) — encaixar a grade
  toggleSnap() {
    return snap.setEnabled(!snap.isEnabled());
  },
  setSnapEnabled(v) {
    return snap.setEnabled(v);
  },
  setGridSize(n) {
    return snap.setGridSize(n);
  },
  setRotStep(deg) {
    return snap.setRotStep(deg);
  },

  // D.5 (GIZMO-6): toggle programático de surface-snap.
  // QA precisa controlar o comportamento de cola-na-superfície sem UI
  // dedicada (o feature é defaultON e não tem botão visível ainda).
  setSurfaceSnapEnabled(v) {
    return snap.setSurfaceSnapEnabled(v);
  },
  toggleSurfaceSnap() {
    return snap.setSurfaceSnapEnabled(!snap.isSurfaceSnapEnabled());
  },
  setObjectFreeTransform(sceneId, free) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) throw new Error(`objeto nao encontrado: ${sceneId}`);
    obj.userData.freeTransform = !!free;
    // se voltou a snapar, aplica imediatamente
    if (!obj.userData.freeTransform) snap.applySnapToObject(obj);
    // Fix Bug 5: emite sceneChanged direto pra inspector re-renderizar e
    // refletir o estado novo do toggle (texto + classe .active).
    notifySceneChanged();
    return { sceneId, freeTransform: obj.userData.freeTransform };
  },

  // D.3: cadeado — toggla freeTransform por objeto
  toggleLock(sceneId) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) throw new Error(`objeto nao encontrado: ${sceneId}`);
    cgToggleLock(obj);
    return { sceneId, locked: !obj.userData.freeTransform };
  },
  setObjectLock(sceneId, locked) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) throw new Error(`objeto nao encontrado: ${sceneId}`);
    obj.userData.freeTransform = !locked;
    if (locked && !obj.userData.freeTransform) snap.applySnapToObject(obj);
    notifySceneChanged();
    return { sceneId, locked };
  },

  // D.1/D.2: move objeto programaticamente pela pipeline sweep+surface.
  // Retorna posição final. Crítico pra QA testar headless.
  dragObjectTo(sceneId, targetXZ) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) throw new Error(`objeto nao encontrado: ${sceneId}`);
    const pos = cgDragObjectTo(obj, targetXZ, userRoot);
    return { sceneId, position: pos.toArray() };
  },

  // Fase 3: footprint editavel via API. valida w,d inteiros >= 1.
  // Fix Bug 6: usa Number.isInteger no valor cru pra rejeitar floats
  // (antes `parseInt(1.5)` truncava silenciosamente pra 1).
  setObjectFootprint(sceneId, footprint) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) throw new Error(`objeto nao encontrado: ${sceneId}`);
    if (!Array.isArray(footprint) || footprint.length !== 2) {
      throw new Error(`footprint invalido (esperado [w, d]): ${JSON.stringify(footprint)}`);
    }
    const w = footprint[0];
    const d = footprint[1];
    if (!Number.isInteger(w) || !Number.isInteger(d) || w < 1 || d < 1) {
      throw new Error(`footprint deve ser dois inteiros >= 1: ${JSON.stringify(footprint)}`);
    }
    obj.userData.footprint = [w, d];
    if (obj.userData.assetMeta) obj.userData.assetMeta.footprint = [w, d];
    snap.applySnapToObject(obj);
    notifySceneChanged();
    return { sceneId, footprint: [w, d] };
  },

  // Fase 3: anchor editavel via API. floor | wall | ceiling.
  // Fase 4 (PM #3): silent=true por default — chamada programatica nao
  // dispara toast a cada mudanca. UI/inspector tambem usam silent.
  setObjectAnchor(sceneId, anchor) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) throw new Error(`objeto nao encontrado: ${sceneId}`);
    if (!['floor', 'wall', 'ceiling'].includes(anchor)) {
      throw new Error(`anchor invalido (esperado floor|wall|ceiling): ${anchor}`);
    }
    obj.userData.anchor = anchor;
    if (obj.userData.assetMeta) obj.userData.assetMeta.anchor = anchor;
    const d = ensureDeps();
    if (d.applyAnchor) d.applyAnchor(obj, obj.position.clone(), { silent: true });
    snap.applySnapToObject(obj);
    notifySceneChanged();
    return { sceneId, anchor };
  },

  // Fase 4: modo Sala. namespace 'room' coerente com 'catalog'.
  room: {
    create({ width = 6, depth = 5, height = 2.7 } = {}) {
      const d = ensureDeps();
      return d.createRoom({ width, depth, height });
    },
    remove() {
      const d = ensureDeps();
      return d.removeRoom();
    },
    openModal() {
      const d = ensureDeps();
      return d.openRoomModal();
    },
    dimensions() {
      const d = ensureDeps();
      return d.getRoomDimensions();
    },
    has() {
      const d = ensureDeps();
      return d.hasRoom();
    },
  },

  // abre painel custom de configuracao de chave de provider.
  // Mesma funcao que o botao "Configurar" do toast invoca.
  openProviderKeyPanel(providerId) {
    const d = ensureDeps();
    return d.openProviderKeyPanel(providerId);
  },

  // catalogo (Fase 1)
  catalog: {
    tree() { return getTree(); },
    leaves() { return allLeaves(); },
    getLeaf(id) { return getLeaf(id); },
    async searchCategory(leafId) {
      const d = ensureDeps();
      return await d.catalogSearchCategory(leafId);
    },
    expand(id) {
      const d = ensureDeps();
      d.catalogExpandCategory(id);
    },
    collapse(id) {
      const d = ensureDeps();
      d.catalogCollapseCategory(id);
    },
    expanded() {
      const d = ensureDeps();
      return d.catalogGetExpandedCategories();
    },
    showTab(which) {
      const d = ensureDeps();
      d.catalogShowTab(which);
    },
  },
};

// -------------------- state --------------------

const state = {
  selected() {
    const s = getSelected();
    return s ? summarizeObject(s) : null;
  },
  objects() {
    return getUserObjects().map(summarizeObject);
  },
  providers() {
    return providers.map(p => ({
      id: p.id,
      label: p.label,
      needsKey: !!p.needsKey,
      description: p.description || '',
    }));
  },
  lastResults() {
    const d = ensureDeps();
    return d.getLastResults().slice();
  },
  gizmoMode() {
    if (isContextualMode()) return 'contextual';
    return getGizmoMode();
  },
  activeProvider() {
    const d = ensureDeps();
    return d.getActiveProvider();
  },
  // snap state (Fase 2)
  snapEnabled() { return snap.isEnabled(); },
  gridSize() { return snap.getGridSize(); },
  rotStep() { return snap.getRotStep(); },

  // D.5: state getter pro surface-snap
  surfaceSnapEnabled() { return snap.isSurfaceSnapEnabled(); },
  isObjectFreeTransform(sceneId) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) return null;
    return !!obj.userData.freeTransform;
  },

  // D.3: isLocked é o inverso de freeTransform — leitura natural pra QA
  isLocked(sceneId) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) return null;
    return !obj.userData.freeTransform;
  },

  // D.1/D.2: retorna AABB atual do objeto (min/max como arrays)
  objectAABB(sceneId) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) return null;
    const box = physics.getAABB(obj);
    if (!box) return null;
    return {
      min: box.min.toArray(),
      max: box.max.toArray(),
    };
  },
  // Fase 3: footprint + anchor por objeto
  objectFootprint(sceneId) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) return null;
    const fp = obj.userData?.footprint;
    return Array.isArray(fp) ? [fp[0], fp[1]] : [1, 1];
  },
  objectAnchor(sceneId) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) return null;
    return obj.userData?.anchor || 'floor';
  },
  // Fase 4 (Obs 13 QA): expoe se anchor real foi aplicado ou caiu pra fallback.
  // Retorna 'ceiling' | 'ceiling-fallback' | 'wall' | 'wall-fallback' | 'floor' | null.
  objectAnchorApplied(sceneId) {
    const obj = getUserObjects().find(o => o.userData?.sceneId === sceneId);
    if (!obj) return null;
    return obj.userData?.anchorApplied || null;
  },
  // Fase 4: estado da sala atual.
  hasRoom() {
    const d = ensureDeps();
    return d.hasRoom();
  },
  roomDimensions() {
    const d = ensureDeps();
    return d.getRoomDimensions();
  },
  isPanelOpen(side) {
    const el = document.getElementById('app');
    if (side === 'left') return !el.classList.contains('no-left');
    if (side === 'right') return !el.classList.contains('no-right');
    return false;
  },
};

// -------------------- helpers --------------------

function summarizeObject(obj) {
  return {
    sceneId: obj.userData?.sceneId || null,
    name: obj.name || null,
    kind: obj.userData?.kind || 'unknown',
    position: obj.position.toArray(),
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: obj.scale.toArray(),
    assetMeta: obj.userData?.assetMeta || null,
  };
}

function d_syncModeButtons() {
  // espelha o syncModeButtons() do main.js — se main expor, melhor
  const m = getGizmoMode();
  const map = { translate: 'mode-translate', rotate: 'mode-rotate', scale: 'mode-scale' };
  for (const k in map) {
    const el = document.getElementById(map[k]);
    if (el) el.classList.toggle('active', k === m);
  }
}

// -------------------- init --------------------

export function initApi(deps) {
  // deps esperado: { addPrimitiveByKind, downloadAndPlace, save, load,
  //   getLastResults, setLastResults, runSearchUI, setActiveProvider,
  //   getActiveProvider, catalog* }
  _deps = deps;

  // expoe global
  window.clag = {
    actions,
    state,
    // event bus pra QA esperar mudancas — passa o `on` direto
    on,
    // info de debug
    version: '0.1',
  };

  // log discreto so no boot
  console.log('[clag] window.clag pronto — actions:', Object.keys(actions).join(', '));
  return window.clag;
}
