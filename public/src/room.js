// room.js — modo Sala (Fase 4 Sims-mode)
//
// Cria 4 paredes + piso + teto como objetos especiais no `userRoot`. Cada
// componente eh selecionavel (raycast funciona), tem material editavel via
// inspector (cor / roughness), e carrega `userData.kind` distintivo pra que
// o resto da engine reconheca (snap ignora moves, inspector esconde
// transform, applyAnchor le altura/normais reais em vez do fallback 2.7m).
//
// Convencoes de userData:
//   - room:floor    -> piso (PlaneGeometry horizontal, y=0)
//   - room:ceiling  -> teto (PlaneGeometry horizontal, y=height)
//   - room:wall     -> parede (BoxGeometry fino, vertical)
//   - roomFace: 'north' | 'south' | 'east' | 'west' (so em room:wall)
//
// Eixos: largura ao longo de X, profundidade ao longo de Z, altura Y.
//   - parede 'north' fica em Z = -depth/2 (face apontando pra +Z)
//   - parede 'south' fica em Z = +depth/2 (face apontando pra -Z)
//   - parede 'east'  fica em X = +width/2 (face apontando pra -X)
//   - parede 'west'  fica em X = -width/2 (face apontando pra +X)
//
// Paredes sao Box finos (espessura 0.05m) — recebem/projetam sombra,
// preservam volume real e raycast da Fase 3 (`applyAnchor` wall) funciona
// igual ao raycast contra mesh comum.

import * as THREE from 'three';
import { addToScene, removeFromScene, userRoot, notifySceneChanged, setSelected } from './scene.js';

const WALL_THICKNESS = 0.05;
const FLOOR_THICKNESS = 0.02;

// materiais default — cinza claro pras paredes/teto/piso. User pinta via inspector.
function wallMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc8ccd6,
    roughness: 0.85,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
}
function floorMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9aa2b0,
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
}
function ceilingMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xd0d3da,
    roughness: 0.92,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
}

const FACE_LABEL_PT = {
  north: 'Parede Norte',
  south: 'Parede Sul',
  east: 'Parede Leste',
  west: 'Parede Oeste',
};

export function roomFaceLabel(face) { return FACE_LABEL_PT[face] || 'Parede'; }

// cria sala — se ja existir, remove a anterior antes (substitui).
export function createRoom({ width = 6, depth = 5, height = 2.7 } = {}) {
  if (!Number.isFinite(width) || width <= 0) throw new Error(`width invalido: ${width}`);
  if (!Number.isFinite(depth) || depth <= 0) throw new Error(`depth invalido: ${depth}`);
  if (!Number.isFinite(height) || height <= 0) throw new Error(`height invalido: ${height}`);

  // remove sala anterior (se houver) — substitui.
  removeRoom();

  const created = [];

  // piso — Box fino (recebe sombra). Centro em y = -thickness/2 (topo em y=0).
  const floorGeo = new THREE.BoxGeometry(width, FLOOR_THICKNESS, depth);
  const floor = new THREE.Mesh(floorGeo, floorMaterial());
  floor.userData.kind = 'room:floor';
  floor.userData.freeTransform = true; // snap nao deve mexer em sala
  floor.position.set(0, -FLOOR_THICKNESS / 2, 0);
  floor.name = 'Piso';
  addToScene(floor, { name: 'Piso', idPrefix: 'room' });
  created.push(floor);

  // teto — Box fino, centro em y = height + thickness/2 (face de baixo em y=height).
  const ceilingGeo = new THREE.BoxGeometry(width, FLOOR_THICKNESS, depth);
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMaterial());
  ceiling.userData.kind = 'room:ceiling';
  ceiling.userData.freeTransform = true;
  ceiling.position.set(0, height + FLOOR_THICKNESS / 2, 0);
  ceiling.name = 'Teto';
  addToScene(ceiling, { name: 'Teto', idPrefix: 'room' });
  created.push(ceiling);

  // paredes — Box finas verticais. Cada parede eh centrada na borda da sala.
  // Largura da geometria casa com a dimensao da borda; profundidade = espessura.
  const wallSpecs = [
    // north: ao longo de X, fica em Z = -depth/2
    { face: 'north', geo: [width, height, WALL_THICKNESS], pos: [0, height / 2, -depth / 2] },
    // south: ao longo de X, fica em Z = +depth/2
    { face: 'south', geo: [width, height, WALL_THICKNESS], pos: [0, height / 2, depth / 2] },
    // east: ao longo de Z, fica em X = +width/2
    { face: 'east', geo: [WALL_THICKNESS, height, depth], pos: [width / 2, height / 2, 0] },
    // west: ao longo de Z, fica em X = -width/2
    { face: 'west', geo: [WALL_THICKNESS, height, depth], pos: [-width / 2, height / 2, 0] },
  ];

  for (const spec of wallSpecs) {
    const geo = new THREE.BoxGeometry(...spec.geo);
    const wall = new THREE.Mesh(geo, wallMaterial());
    wall.userData.kind = 'room:wall';
    wall.userData.roomFace = spec.face;
    wall.userData.freeTransform = true;
    wall.position.set(...spec.pos);
    wall.name = FACE_LABEL_PT[spec.face];
    addToScene(wall, { name: FACE_LABEL_PT[spec.face], idPrefix: 'room' });
    created.push(wall);
  }

  // deseleciona — addToScene seleciona a ultima parede, mas user nao quis
  // entrar na sala selecionando parede oeste. Boot limpo.
  setSelected(null);
  notifySceneChanged();
  return { width, depth, height, parts: created };
}

// remove todos os objetos com userData.kind === 'room:*' do userRoot.
export function removeRoom() {
  const toRemove = [];
  for (const c of userRoot.children) {
    const k = c.userData?.kind;
    if (typeof k === 'string' && k.startsWith('room:')) toRemove.push(c);
  }
  for (const obj of toRemove) removeFromScene(obj);
  if (toRemove.length > 0) notifySceneChanged();
  return toRemove.length;
}

// inspeciona o userRoot e retorna dimensoes da sala atual, ou null se nao ha.
// width / depth saem do bbox do piso; height sai do bbox da primeira parede.
export function getRoomDimensions() {
  let floor = null;
  let wall = null;
  for (const c of userRoot.children) {
    const k = c.userData?.kind;
    if (k === 'room:floor' && !floor) floor = c;
    if (k === 'room:wall' && !wall) wall = c;
  }
  if (!floor) return null;
  const floorBox = new THREE.Box3().setFromObject(floor);
  const floorSize = floorBox.getSize(new THREE.Vector3());
  const width = round(floorSize.x);
  const depth = round(floorSize.z);
  let height = 2.7;
  if (wall) {
    const wallBox = new THREE.Box3().setFromObject(wall);
    const wallSize = wallBox.getSize(new THREE.Vector3());
    height = round(wallSize.y);
  }
  return { width, depth, height };
}

// existe sala carregada agora?
export function hasRoom() {
  for (const c of userRoot.children) {
    if (c.userData?.kind === 'room:floor') return true;
  }
  return false;
}

function round(v) { return Math.round(v * 1000) / 1000; }

// helper pra `room:*` — UI usa pra mostrar label PT-BR no inspector / outliner.
export function describeRoomPart(obj) {
  const k = obj?.userData?.kind;
  if (k === 'room:floor') return 'Piso';
  if (k === 'room:ceiling') return 'Teto';
  if (k === 'room:wall') return roomFaceLabel(obj.userData.roomFace);
  return null;
}

export function isRoomPart(obj) {
  const k = obj?.userData?.kind;
  return typeof k === 'string' && k.startsWith('room:');
}
