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
} from './scene.js';
import { providers, providerMap, searchAll } from './providers/index.js';

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
    if (!['translate', 'rotate', 'scale'].includes(mode)) {
      throw new Error(`modo invalido: ${mode}`);
    }
    setGizmoMode(mode);
    d_syncModeButtons();
    return mode;
  },
  getGizmoMode() { return getGizmoMode(); },

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

  // busca
  async runSearch(query, providerId) {
    const d = ensureDeps();
    if (providerId && providerId !== 'all') {
      const items = await searchAll(query, { providerIds: [providerId] });
      d.setLastResults(items);
      return items;
    }
    const items = await searchAll(query);
    d.setLastResults(items);
    return items;
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
  gizmoMode() { return getGizmoMode(); },
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
  // deps esperado: { addPrimitiveByKind, downloadAndPlace, save, load, getLastResults, setLastResults }
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
