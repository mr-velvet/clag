// snap.js — grid + snap como default de posicionamento (Fase 2 Sims-mode)
//
// Tese: 90% dos casos o roteirista posiciona objetos sem precisar de precisao
// sub-milimetrica. Snap a grid + rotacao discreta resolvem rapido. Gizmo livre
// continua existindo como escape hatch (atalhos W/E/R, TransformControls).
//
// Estado interno persistido em localStorage:
//   clag:snap-enabled  -> 'true' | 'false'   (default 'true')
//   clag:grid-size     -> numero em metros   (default 0.5)
//   clag:rot-step      -> numero em graus    (default 15)
//
// Por-objeto: `obj.userData.freeTransform === true` desliga snap so naquele
// objeto (escape hatch granular, exposto no inspector).
//
// Para Fase 2 snap so afeta XZ (altura Y livre). Anchor='ceiling'/'wall'
// entram na Fase 3.

import * as THREE from 'three';

const LS_ENABLED        = 'clag:snap-enabled';
const LS_GRID           = 'clag:grid-size';
const LS_ROT            = 'clag:rot-step';
const LS_SURFACE_SNAP   = 'clag:surface-snap-enabled';

const DEFAULT_ENABLED       = false; // D.3: surface-snap é o default novo; grid vira opt-in
const DEFAULT_GRID          = 0.5;
const DEFAULT_ROT_DEG       = 15;
const DEFAULT_SURFACE_SNAP  = true;

// estado
let _enabled       = DEFAULT_ENABLED;
let _gridSize      = DEFAULT_GRID;
let _rotStep       = DEFAULT_ROT_DEG; // em graus
let _surfaceSnap   = DEFAULT_SURFACE_SNAP;

// mini event bus interno
const _subs = new Set();
function emit() {
  for (const cb of _subs) {
    try { cb(snapshot()); } catch (e) { console.error('[snap] subscriber error', e); }
  }
}
export function on(event, cb) {
  if (event !== 'snapChanged') throw new Error(`evento desconhecido: ${event}`);
  _subs.add(cb);
  return () => _subs.delete(cb);
}

// boot — carrega de localStorage com fallback
// Migração D.3: se clag:snap-enabled nunca foi gravado (boot zero), usa
// DEFAULT_ENABLED=false (grid snap OFF) e DEFAULT_SURFACE_SNAP=true.
(function loadFromStorage() {
  try {
    const e = localStorage.getItem(LS_ENABLED);
    if (e === 'true' || e === 'false') _enabled = (e === 'true');

    const g = parseFloat(localStorage.getItem(LS_GRID));
    if (Number.isFinite(g) && g > 0) _gridSize = g;

    const r = parseFloat(localStorage.getItem(LS_ROT));
    if (Number.isFinite(r) && r > 0 && r <= 90) _rotStep = r;

    const ss = localStorage.getItem(LS_SURFACE_SNAP);
    if (ss === 'true' || ss === 'false') _surfaceSnap = (ss === 'true');
  } catch (_) { /* ignora — localStorage pode estar bloqueado */ }
})();

// -------------------- getters/setters --------------------

export function isEnabled() { return _enabled; }
export function setEnabled(v) {
  const next = !!v;
  if (next === _enabled) return _enabled;
  _enabled = next;
  try { localStorage.setItem(LS_ENABLED, _enabled ? 'true' : 'false'); } catch (_) {}
  emit();
  return _enabled;
}

export function getGridSize() { return _gridSize; }
export function setGridSize(n) {
  const v = parseFloat(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`gridSize invalido: ${n}`);
  if (v === _gridSize) return _gridSize;
  _gridSize = v;
  try { localStorage.setItem(LS_GRID, String(_gridSize)); } catch (_) {}
  emit();
  return _gridSize;
}

export function getRotStep() { return _rotStep; }
export function setRotStep(deg) {
  const v = parseFloat(deg);
  if (!Number.isFinite(v) || v <= 0 || v > 90) throw new Error(`rotStep invalido (precisa 0 < v <= 90): ${deg}`);
  if (v === _rotStep) return _rotStep;
  _rotStep = v;
  try { localStorage.setItem(LS_ROT, String(_rotStep)); } catch (_) {}
  emit();
  return _rotStep;
}

// surface snap getter/setter (D.3)
export function isSurfaceSnapEnabled() { return _surfaceSnap; }
export function setSurfaceSnapEnabled(v) {
  const next = !!v;
  if (next === _surfaceSnap) return _surfaceSnap;
  _surfaceSnap = next;
  try { localStorage.setItem(LS_SURFACE_SNAP, _surfaceSnap ? 'true' : 'false'); } catch (_) {}
  emit();
  return _surfaceSnap;
}

function snapshot() {
  return { enabled: _enabled, gridSize: _gridSize, rotStep: _rotStep, surfaceSnap: _surfaceSnap };
}

// -------------------- snap puro (funcoes utilitarias) --------------------

// arredonda um numero pro multiplo mais proximo de step
function snapTo(v, step) {
  return Math.round(v / step) * step;
}

// snap so XZ — altura Y fica livre na Fase 2
export function snapVec3(v3) {
  return new THREE.Vector3(
    snapTo(v3.x, _gridSize),
    v3.y,
    snapTo(v3.z, _gridSize),
  );
}

// snap considerando footprint do objeto (Fase 3 Sims-mode).
//
// Regra "tipo Sims": pra cada eixo, se a dimensao em tiles eh impar, o
// centro snapa pra centro de tile (multiplo de gridSize). Se eh par, o
// centro snapa pra meia-tile (multiplo deslocado de 0.5 * gridSize), pra
// que o objeto cubra exatamente N tiles inteiros (centro entre tiles).
//
// Ex: footprint = [2, 1] com gridSize = 0.5 ->
//   eixo X (par): x = (floor(x/0.5) + 0.5) * 0.5  -> 0.25, 0.75, ...
//   eixo Z (impar): z = round(z/0.5) * 0.5         -> 0, 0.5, 1, ...
//
// Footprint padrao [1,1] cai exatamente em snapVec3 (compat 100%).
export function snapVec3WithFootprint(v3, footprint) {
  const fp = Array.isArray(footprint) && footprint.length === 2 ? footprint : [1, 1];
  const w = Math.max(1, Math.round(fp[0]));
  const d = Math.max(1, Math.round(fp[1]));
  const x = snapAxisWithSize(v3.x, w, _gridSize);
  const z = snapAxisWithSize(v3.z, d, _gridSize);
  return new THREE.Vector3(x, v3.y, z);
}

function snapAxisWithSize(value, sizeTiles, step) {
  if (sizeTiles % 2 === 1) {
    // impar -> centro do tile (multiplo de step)
    return snapTo(value, step);
  }
  // par -> meia-tile (offset de step/2)
  return Math.round(value / step - 0.5) * step + step / 2;
}

// snap de angulo em radianos para multiplo de rotStep (graus)
export function snapAngle(rad) {
  const deg = THREE.MathUtils.radToDeg(rad);
  const snapped = snapTo(deg, _rotStep);
  return THREE.MathUtils.degToRad(snapped);
}

// wrapper que retorna novo Euler com cada eixo snapado
export function snapEuler(e) {
  return new THREE.Euler(
    snapAngle(e.x),
    snapAngle(e.y),
    snapAngle(e.z),
    e.order,
  );
}

// -------------------- aplica em objeto da cena --------------------

// idempotente: chama varias vezes nao acumula erro (snap arredonda pra mais
// proximo, entao posicao ja snapada continua igual).
//
// Respeita `obj.userData.freeTransform === true` (escape hatch granular).
//
// Retorna true se mexeu em algo, false se nada mudou.
export function applySnapToObject(obj) {
  if (!_enabled) return false;
  if (!obj) return false;
  if (obj.userData && obj.userData.freeTransform) return false;

  let changed = false;

  // posicao (XZ) — leva footprint em conta (Fase 3)
  const fp = obj.userData?.footprint;
  const snapped = snapVec3WithFootprint(obj.position, fp);
  if (snapped.x !== obj.position.x) { obj.position.x = snapped.x; changed = true; }
  if (snapped.z !== obj.position.z) { obj.position.z = snapped.z; changed = true; }

  // rotacao (3 eixos)
  const rx = snapAngle(obj.rotation.x);
  const ry = snapAngle(obj.rotation.y);
  const rz = snapAngle(obj.rotation.z);
  if (rx !== obj.rotation.x) { obj.rotation.x = rx; changed = true; }
  if (ry !== obj.rotation.y) { obj.rotation.y = ry; changed = true; }
  if (rz !== obj.rotation.z) { obj.rotation.z = rz; changed = true; }

  return changed;
}
