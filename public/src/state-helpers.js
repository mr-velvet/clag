// state-helpers.js — predicados compartilhados sobre objetos de userRoot.
//
// Existe pra eliminar duplicação e inconsistência (CR-9, CR-13 da QA review
// 2026-05-21):
//   - `freeTransform` era consultado de 3 jeitos diferentes em api.js +
//     contextual-gizmo.js: `!!obj.userData.freeTransform`,
//     `obj.userData?.freeTransform === true`, `!obj.userData?.freeTransform`.
//     Diferença sutil — `=== true` falha se vier truthy não-bool (1, 'yes')
//     do save. Unifica num único ponto.
//   - `_isRoomPart` estava duplicado em physics.js E contextual-gizmo.js,
//     com mesma lógica. Importar daqui evita drift.

// True se o objeto está liberado do snap/sweep (escape hatch granular).
// Coerção via comparação estrita: só `userData.freeTransform === true` libera.
// Qualquer outro valor (undefined, null, false, 0, '') → considerado ancorado.
export function isFreeTransform(obj) {
  return obj?.userData?.freeTransform === true;
}

// Inverso semântico de isFreeTransform. Útil em call sites que leem como
// "está travado?" — fica mais legível que `!isFreeTransform(obj)`.
export function isLocked(obj) {
  return !isFreeTransform(obj);
}

// True se o objeto é parte da sala (chão/parede/teto). Room parts são
// registradas no physics store pra sweep enxergar paredes, mas ignoradas
// em surfaceUnder e em filtros de seleção (não são "objetos do usuário").
export function isRoomPart(obj) {
  const kind = obj?.userData?.kind || '';
  return kind.startsWith('room:');
}
