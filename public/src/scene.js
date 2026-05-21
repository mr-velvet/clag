import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import * as snap from './snap.js';
import * as physics from './physics.js';
// CR-3 (2026-05-21): consulta estado do gizmo contextual pra Esc não
// desselecionar quando contextual está em drag ou usuário está saindo
// de modo W/E/R. Import dinâmico evita ciclo de dependência (contextual
// importa scene).
import * as _cg from './contextual-gizmo.js';

// world singletons (exported for other modules)
export const scene = new THREE.Scene();
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
export const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 5000);
export let orbit;       // initialized in bootViewport
export let gizmo;       // TransformControls

// the "user scene" — everything the user adds lives here, so the helpers (grid, ambient light, etc.) stay out of save/load.
export const userRoot = new THREE.Group();
userRoot.name = 'userRoot';
scene.add(userRoot);

// helpers root (grid + helper lights) kept separate
const helpersRoot = new THREE.Group();
helpersRoot.name = 'helpersRoot';
scene.add(helpersRoot);

// stats hooks
let frameCount = 0;
let fpsT0 = performance.now();
let fpsValue = 0;

const listeners = {
  selectionChanged: new Set(),
  sceneChanged: new Set(),
  statsTick: new Set(),
  // CR-2 fix (2026-05-21): hook do render loop — outros módulos (cadeado overlay,
  // helpers visuais) se inscrevem aqui em vez de criar RAF próprio. Evita
  // múltiplos RAFs concorrentes e centraliza o tick.
  beforeRender: new Set(),
};

export function on(event, cb) {
  listeners[event].add(cb);
  return () => listeners[event].delete(cb);
}

function emit(event, payload) {
  for (const cb of listeners[event]) cb(payload);
}

let selected = null;

// grid helper — recriado quando snap.gridSize muda
let _gridHelper = null;
const GRID_EXTENT = 30; // metros

export function rebuildGrid() {
  if (_gridHelper) {
    helpersRoot.remove(_gridHelper);
    if (_gridHelper.geometry) _gridHelper.geometry.dispose();
    if (_gridHelper.material) _gridHelper.material.dispose();
    _gridHelper = null;
  }
  const size = snap.getGridSize();
  // divisoes = total / cell — cap pra evitar explosao se user botar grid muito fino
  const divisions = Math.min(600, Math.max(2, Math.round(GRID_EXTENT / size)));
  _gridHelper = new THREE.GridHelper(GRID_EXTENT, divisions, 0x4a5570, 0x2a3144);
  // opacidade um pouco menor quando snap off — sinal visual sutil
  _gridHelper.material.opacity = snap.isEnabled() ? 0.85 : 0.45;
  _gridHelper.material.transparent = true;
  _gridHelper.position.y = -0.001;
  helpersRoot.add(_gridHelper);
}

export function getSelected() { return selected; }

export function setSelected(obj) {
  if (selected === obj) return;
  selected = obj;
  if (obj) gizmo.attach(obj);
  else gizmo.detach();
  emit('selectionChanged', obj);
}

export function notifySceneChanged() { emit('sceneChanged'); }

export function bootViewport(container) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene.background = new THREE.Color(0x171b24);
  scene.fog = new THREE.Fog(0x171b24, 60, 200);

  camera.position.set(5, 4, 6);
  camera.lookAt(0, 0.5, 0);

  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.target.set(0, 0.5, 0);

  // grid — tamanho fixo 30m × 30m, divisoes refletem snap.gridSize
  rebuildGrid();
  snap.on('snapChanged', rebuildGrid);

  // origin axes — pequeno indicador visual
  const axes = new THREE.AxesHelper(1.5);
  axes.position.y = 0.002;
  helpersRoot.add(axes);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  helpersRoot.add(ambient);

  const hemi = new THREE.HemisphereLight(0xb0c4de, 0x404048, 0.55);
  helpersRoot.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  helpersRoot.add(sun);

  // rim/back light pra dar volume nos modelos PBR
  const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
  rim.position.set(-6, 4, -4);
  helpersRoot.add(rim);

  // gizmo
  gizmo = new TransformControls(camera, renderer.domElement);
  // newer three.js exposes the gizmo as a child .getHelper()
  const gizmoHelper = typeof gizmo.getHelper === 'function' ? gizmo.getHelper() : gizmo;
  scene.add(gizmoHelper);
  gizmo.addEventListener('dragging-changed', e => {
    orbit.enabled = !e.value;
    // ao soltar o gizmo, garante snap final (caso event objectChange tenha sido throttled).
    if (!e.value && selected) snap.applySnapToObject(selected);
  });
  gizmo.addEventListener('objectChange', () => {
    // snap continuo enquanto user arrasta — efeito "pula pro tile" e desejado.
    if (selected) snap.applySnapToObject(selected);
    // mantém AABB atualizado enquanto TransformControls move/escala o objeto
    if (selected) physics.update(selected);
    emit('sceneChanged');
  });

  // click selection (raycast against userRoot only)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    // skip if gizmo is consuming the event
    if (gizmo.dragging) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(userRoot.children, true);
    if (hits.length === 0) { setSelected(null); return; }
    // climb to the topmost ancestor that lives directly under userRoot
    let obj = hits[0].object;
    while (obj.parent && obj.parent !== userRoot) obj = obj.parent;
    setSelected(obj);
  });

  // viewport resize
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);

  // tick
  function tick() {
    orbit.update();
    // CR-2: notifica subscribers antes do render (cadeado overlay etc.)
    for (const cb of listeners.beforeRender) cb();
    renderer.render(scene, camera);
    frameCount++;
    const now = performance.now();
    if (now - fpsT0 >= 500) {
      fpsValue = (frameCount * 1000) / (now - fpsT0);
      frameCount = 0;
      fpsT0 = now;
      emit('statsTick', { fps: fpsValue, calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
    }
    requestAnimationFrame(tick);
  }
  tick();

  // keyboard shortcuts
  window.addEventListener('keydown', ev => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
    if (ev.key === 'w' || ev.key === 'W') setGizmoMode('translate');
    else if (ev.key === 'e' || ev.key === 'E') setGizmoMode('rotate');
    else if (ev.key === 'r' || ev.key === 'R') setGizmoMode('scale');
    else if (ev.key === 'g' || ev.key === 'G') {
      // toggle snap — efeito visual via rebuildGrid (subscribed acima)
      snap.setEnabled(!snap.isEnabled());
    }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (selected) removeFromScene(selected);
    } else if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')) {
      ev.preventDefault();
      if (selected) duplicateObject(selected);
    } else if (ev.key === 'f' || ev.key === 'F') {
      if (selected) frameSelected();
    } else if (ev.key === 'Escape') {
      // CR-3 fix (2026-05-21): se modo contextual está OFF (W/E/R ativos),
      // ou se há drag em curso, deixa o handler do contextual-gizmo lidar com
      // Esc (cancela drag / volta pro modo contextual) sem perder seleção.
      // Esc só deseleciona quando estamos genuinamente em modo contextual idle.
      const inContextual = _cg && typeof _cg.isContextualMode === 'function'
        ? _cg.isContextualMode()
        : true;
      if (inContextual) {
        setSelected(null);
      }
    }
  });
}

export function setGizmoMode(mode) {
  if (!gizmo) return;
  gizmo.setMode(mode);
  emit('selectionChanged', selected); // refresh UI mode toggle
}

export function getGizmoMode() {
  return gizmo?.getMode() ?? 'translate';
}

let _idCounter = 1;
function makeId(prefix) {
  return `${prefix}_${(_idCounter++).toString(36)}`;
}

export function addToScene(object, opts = {}) {
  if (!object.userData) object.userData = {};
  if (!object.userData.sceneId) object.userData.sceneId = makeId(opts.idPrefix || 'obj');
  if (!object.name) object.name = opts.name || object.userData.sceneId;
  // shadows
  object.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  if (opts.position) object.position.copy(opts.position);
  // snap inicial — XZ + rotacao discreta. Respeita freeTransform por-objeto.
  snap.applySnapToObject(object);
  userRoot.add(object);
  // registra AABB no store de física (D.1/D.2). Room parts também são
  // registradas para que o sweep detecte paredes — mas surfaceUnder as exclui.
  if (!object.userData?.isHelper) {
    physics.register(object);
  }
  emit('sceneChanged');
  setSelected(object);
  return object;
}

export function removeFromScene(obj) {
  if (obj.parent === userRoot) {
    physics.unregister(obj);
    userRoot.remove(obj);
    if (selected === obj) setSelected(null);
    disposeObject(obj);
    emit('sceneChanged');
  }
}

export function duplicateObject(obj) {
  const clone = obj.clone(true);
  // ensure unique id
  clone.userData = { ...obj.userData, sceneId: makeId('obj') };
  clone.position.x += 1;
  userRoot.add(clone);
  emit('sceneChanged');
  setSelected(clone);
  return clone;
}

export function getUserObjects() {
  return [...userRoot.children];
}

export function frameSelected() {
  if (!selected) return;
  const box = new THREE.Box3().setFromObject(selected);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.y, s.z) * 1.5 + 1;
  orbit.target.copy(c);
  // move camera along current orbit direction at distance r
  const dir = camera.position.clone().sub(orbit.target).normalize();
  camera.position.copy(c).add(dir.multiplyScalar(r));
  orbit.update();
}

// helper interno — não exportado
function _isRoomKind(obj) {
  return (obj?.userData?.kind || '').startsWith('room:');
}

function disposeObject(o) {
  o.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      for (const m of mats) {
        for (const k in m) {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    }
  });
}

// world point under mouse — used by drag-drop to place asset where the user dropped it
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export function worldPointAtScreen(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _ray.setFromCamera(_ndc, camera);
  const hit = new THREE.Vector3();
  if (_ray.ray.intersectPlane(_groundPlane, hit)) return hit;
  // fallback: 8 units in front of camera
  return camera.position.clone().add(_ray.ray.direction.clone().multiplyScalar(8));
}
