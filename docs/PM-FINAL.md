# PM-FINAL — veredito de merge GIZMO Opção D

> Branch `feat/surface-snap-gizmo` (6 commits desde main, HEAD `9cb63e1`) — decisão final de merge pra main após D.1-D.5 + patch D4-1.

---

## 1. Veredito: **VERDE — merge OK** (com pendências pós-merge)

## 2. Por que

Funcionalidade-núcleo da Opção D (drag direto + surface-snap + anti-overlap XZ + cadeado) está sólida e cobre as três frições centrais que a proposta SIMS-MODE.md pediu: leigo não pensa em eixo, não configura grid, não atravessa móvel. Polish da D.5 (hint inicial, tooltip custom no cadeado, hover bbox, cursor not-allowed, API `setSurfaceSnapEnabled`/`toggleSurfaceSnap`) entregue por inteiro — discoverability do paradigma novo já não depende de instrução externa. As 6 ressalvas da revisão D.1-D.3 (GIZMO-1 anchor re-apply, GIZMO-2 LS migration, GIZMO-3 Esc contextual, GIZMO-4 elevação no slide, GIZMO-5 title nativo, GIZMO-6 API surface snap) foram fechadas — checagem direta no `contextual-gizmo.js`/`api.js` confirma. Console limpo nos 21 cenários do QA-FINAL, zero regressão funcional detectada. Os 2 itens amarelos do QA (D4-1 tunneling + D4-2 auto-empilhamento) e os 2 débitos pré-existentes (TITLE-NATIVO 41 elementos, D5-PERSIST sem autoload) **não são regressões deste branch** — são limite/decisão de design e backlog herdado.

## 3. Sumário do entregue

- `physics.js` (254 linhas) — AABB store + `sweepXZ` (anti-overlap horizontal + vertical via `yOverlap`) + `surfaceUnder` raycast + filtro `room:*`/planos finos.
- `contextual-gizmo.js` (684 linhas) — drag-to-translate XZ com threshold 4px, anchor re-apply pós-drag, Esc cancela/retorna a contextual, cadeado HTML overlay com tooltip custom, hover bbox em obj não-selecionado, cursor `not-allowed` quando `sweep.blocked`.
- `snap.js` — surface-snap ON por default, grid-snap vira opt-in, migração silenciosa de LS legado (`clag:snap-migration-v2`).
- `api.js` — `actions.toggleLock/setObjectLock/dragObjectTo/setSurfaceSnapEnabled/toggleSurfaceSnap` + `state.isLocked/objectAABB/surfaceSnapEnabled`. Cobertura UI→API 100%.
- Patch `9cb63e1` — surface-snap aplicado apenas no step final do sub-stepping, mitigando GIZMO-D4-1.
- Hint "arraste objetos pra mover" no viewport (some na 1ª interação, flag em LS).

## 4. Pendências aceitas pós-merge

| Item | Prioridade | Destino |
|---|---|---|
| TITLE-NATIVO — 41 elementos com `title=` violam P8 (débito pré-existente) | média | v1.1 — patch único de tooltip custom global |
| D5-PERSIST — autoload de cena no boot (pré-existente, quebra "tipo Sims") | média | v1.1 — junto com undo/redo |
| GIZMO-D4-1 — tunneling em `dragObjectTo` programático com Δ>5u (mouse real raramente cai) | baixa | v1.1 — só se reportado por user |
| GIZMO-D4-2 — auto-empilhamento em colisão direta no mesmo Y | baixa | aceitar como comportamento "tipo Sims" — documentar |
| Bug 3 — `selectByName` colisão de nome | baixa | backlog persistente |
| `<input type="color">/range` nativos no inspector | baixa | v1.1 — fechar P8 100% |

## 5. Risco de regressão: **baixo**

Patch é cirúrgico, isolado em 2 módulos novos + integrações pontuais em `scene.js`/`api.js`/`snap.js`. TransformControls (W/E/R) preservado intacto como escape hatch. Compatibilidade retro com saves antigos verificada (Bug 13 fechado no patch pré-D.4 — `updateMatrixWorld` antes de `registerAll`). 21 cenários QA + checagem de princípios P1/P3/P6/P8 sem regressão. Único vetor de risco real é o auto-empilhamento (D4-2) confundir leigo em vez de soar "tipo Sims" — mas isso é validável só com user real, não bloqueia.

## 6. Recomendação ao user

Merge pra main + deploy clag.did.lu agora; testa pessoalmente montando uma sala em <2min sem instrução (critério original de merge) — se o auto-empilhamento incomodar na prática, abrir patch separado tratando D4-2 como bug; se soar natural, fica documentado como feature.
