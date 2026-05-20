# PROGRESS — clag

Última atualização: 2026-05-20 (patch pré-deploy SIMS-MODE v1 — Bug 9 ceiling pivot, Bug 10 persist anchorApplied, modal grammar, room limpa Ground)

## como usar este arquivo

Próximas sessões devem ler este arquivo PRIMEIRO. Estado vivo do projeto, próximos passos, débitos. Detalhe técnico vai em [docs/](./docs/) — aqui é só ponteiro + estado.

## status

**PoC funcional graduado pra repo dedicado.** Em 2026-05-19:
- Layout 3 painéis (hierarchy / viewport / inspector) + asset browser embaixo
- Cena editável com TransformControls (W/E/R/F/Del/Ctrl+D/Esc)
- 3 providers integrados: Khronos (catálogo curado), Poly Haven (API pública CC0), Sketchfab (search anônima — download exige OAuth, ainda não implementado)
- Save/load via localStorage, drag-to-scene + double-click, toast com progress
- Layout responsivo testado 800 / 1024 / 1200 / 1480
- Deploy ainda em `st.did.lu/scene-ide/v2/` (clone do PoC). `clag.did.lu` ainda não foi subido — esperando estabilizar.

Repo: https://github.com/mr-velvet/clag

## o que precisa antes de subir clag.did.lu

- [ ] Validar Express server.js local (`npm install && npm start` → http://localhost:5045)
- [ ] Reservar porta 5045 no inventário do devops-workflow-2026 (se aplicável)
- [ ] `.\scripts\did.ps1 deploy clag` da workspace devops
- [ ] Smoke test em produção

## próximos passos por ordem (curto)

Priorizado em [docs/ROADMAP.md](./docs/ROADMAP.md). Em resumo, antes de mexer em features novas:

1. Subir em `clag.did.lu` (item acima)
2. Export `.glb` da cena + `CREDITS.txt` com licenças — produto fica útil de verdade só depois disso
3. Smithsonian como 4º provider (ver esboço no fim de [docs/PROVIDERS.md](./docs/PROVIDERS.md))

## próximos passos por ordem (médio)

- Unzip do Sketchfab via `fflate` → habilita download Sketchfab quando user fornecer OAuth token
- Multi-resolução Poly Haven (dropdown 1k/2k/4k no card)
- Inspector visual: outline pass no objeto selecionado
- Asset cache opcional em IndexedDB

## documentos do repo

- [README](./README.md) — entrada, por que existe, como rodar
- [docs/PRINCIPLES](./docs/PRINCIPLES.md) — 9 princípios fundadores (no-build, asset público como cidadão 1, etc)
- [docs/ARCHITECTURE](./docs/ARCHITECTURE.md) — mapa dos módulos + contrato dos componentes + convenções de estado
- [docs/PROVIDERS](./docs/PROVIDERS.md) — template + patterns pra adicionar provider novo
- [docs/ROADMAP](./docs/ROADMAP.md) — o que vem depois do PoC
- [docs/DEPLOY](./docs/DEPLOY.md) — como subir em clag.did.lu
- [docs/PRODUCT-NOTES](./docs/PRODUCT-NOTES.md) — avaliação honesta de viabilidade como produto + comparáveis
- [docs/PROVIDERS-RESEARCH](./docs/PROVIDERS-RESEARCH.md) — pesquisa original sobre cada API

## decisões arquiteturais já feitas (não revisitar sem motivo forte)

Resumo — detalhe em PRINCIPLES.md:

- **Sem build step.** Vanilla ES modules + importmap + CDN. Editar `.js`, F5.
- **Cada provider é um plugin isolado** em `public/src/providers/`. Adicionar não toca core.
- **Save em JSON via localStorage**, assets re-baixados no load (não cacheamos blobs por padrão).
- **Componentes UI custom** — nenhum `<select>` nativo, `confirm()`, focus ring padrão.
- **TransformControls + Inspector básico já é feature-completa pra v1.** Sem editor de animação, sem shader graph, sem renderer custom — fora do escopo.

## histórico

- **2026-05-20 (patch pré-deploy SIMS-MODE v1)**: `search.js::applyAnchor` ceiling agora usa `obj.position.y += (ceilingY - objBox.max.y)` (delta-topo) em vez de `ceilingY - boxSize.y/2` — fecha Bug 9 do QA (assets com pivot fora do centro do bbox, como Chandelier 01, ficavam ~40cm abaixo do teto). Mesma fórmula aplicada ao fallback (sem sala) com `ROOM_HEIGHT_DEFAULT`. `persist.js` serializa `userData.anchorApplied` e restaura em `applySimsMeta` — fecha Bug 10 (state.objectAnchorApplied virava null pós save+load). `main.js` modal Nova Sala: subtitle reescrito pra português correto + nota sutil sobre reset de cores (PM #2). `room.js::createRoom` remove `Ground` starter (filtro conservador por `name === 'Ground'`) antes de criar piso — evita z-fight com `room:floor` e fecha trade-off "cena starter coexiste" do PM #3.

- **2026-05-20 (Fase 4 SIMS-MODE)**: `public/src/room.js` novo — `createRoom({width,depth,height})` constrói 4 paredes (Box finos 0.05m), piso e teto como Box finos com `userData.kind='room:floor|wall|ceiling'` + `userData.roomFace='north|south|east|west'` nas paredes; `removeRoom` / `getRoomDimensions` / `hasRoom` / `isRoomPart` / `describeRoomPart` expostos. Cada parte de sala nasce com `freeTransform=true` (snap ignora). Botão `🏠 sala` na topbar abre modal custom (não `prompt()`) com 3 inputs labelados em PT-BR (defaults 6×5×2.7m), Esc/click-fora cancela, Enter confirma. `search.js::applyAnchor` ganha `opts.silent` — inspector e API setObjectAnchor passam `silent:true` pra não duplicar toast a cada troca (PM #3). Ceiling centraliza topo do objeto no teto via `ceilingY - boxSize.y/2` (Obs 12 QA — antes deixava topo acima do teto pra objetos altos). `persist.js` serializa sala como campo `room` top-level e recria via `createRoom` antes dos assets no restore (assim anchor='ceiling'/'wall' encontra sala real). `inspector.js` esconde transform/posicionamento pra room:*, mostra label PT-BR ("Piso"/"Teto"/"Parede Norte/Sul/Leste/Oeste"). Inspector ganha aviso textual sutil em `.insp-anchor-warning` quando anchorApplied tem `-fallback`. `api.js`: `actions.room.{create,remove,openModal,dimensions,has}` + `state.hasRoom/roomDimensions/objectAnchorApplied` (Obs 13). 14 labels internos do inspector traduzidos via `ROW_LABELS` const (`name→nome`, `type→tipo`, `source→origem`, `license→licença`, `view→ver`, `color→cor`, `rough→rugosidade`, `metal→metal`, `emissive→emissivo`, `intens→intens.`, `dist→dist.`, `verts→vértices`, `tris→triângulos`, `meshes→meshes`). `catalog.js` ganha folha `kitchen-pendant` (Cozinha → Luminária Pendente, anchor=ceiling) — agora pendente em Cozinha além de Quarto (PM #2). Snap-toggle off ganha borda tracejada `var(--text-2)` (PM #5 — definição visual além da cor). Comentário do Bug 8 em `main.js::downloadAndPlaceFromMeta` reescrito pra "fallback retro-compat pra saves pre-Fase 3" (PM #4).

- **2026-05-20 (patch pós-revisão Fase 3)**: `main.js::downloadAndPlaceFromMeta` agora retorna `obj` (Bug 8 ALTA — sem isso `persist::applySimsMeta` nunca rodava no rehydrate de assets, perdendo anchor/footprint/freeTransform no F5). Propaga `meta.anchor`/`meta.footprint` pro `userData` ao recriar asset. `search.js::applyAnchor` branches 'floor' e 'wall-fallback' agora plantam objeto no chao via novo helper `plantOnFloor` (Bug 7 MEDIA — antes deixavam Y flutuando depois de ceiling→floor). Toast warn PT-BR ao usar ceiling-fallback / wall-fallback (PM ressalva #1). `api.js::setObjectFootprint` valida via `Number.isInteger` no valor cru (Bug 6 BAIXA — antes `parseInt(1.5)` truncava silenciosamente). `inspector.js` label "tamanho" → "tamanho na grade" (PM ressalva #2); titulos `identity/light/info` → `identidade/luz/informações` (Obs 11 QA). `styles.css` snap-toggle off com contraste melhor (text-1 + opacity 0.85, PM ressalva #3). `catalog.js` adiciona 3 folhas com `anchor: 'ceiling'`: Sala ganha `ceiling-light` ("Luz de Teto") e `chandelier` ("Lustre"); Quarto ganha `pendant-lamp` ("Luminária Pendente"). Catalogo agora tem 50 folhas.

- **2026-05-20 (Fase 3 SIMS-MODE)**: `snap.js` ganha `snapVec3WithFootprint(v3, [w,d])` — regra "tipo Sims": eixos com tamanho ímpar snapam pra centro de tile, eixos pares snapam pra meia-tile (objeto cobre N tiles inteiros). `applySnapToObject` agora lê `obj.userData.footprint`. `search.js::downloadAndPlace` propaga `item.anchor` / `item.footprint` pra `userData.{anchor,footprint}` e `assetMeta.{anchor,footprint}`. Defaults pra busca livre: anchor=floor, footprint=[1,1]. `search.js::applyAnchor(obj, dropPos)` aplica regra de apoio no drop — anchor='ceiling' procura `room:ceiling`, sem sala usa `ROOM_HEIGHT_DEFAULT = 2.7` (objeto pendura como se houvesse teto fictício, marca `anchorApplied='ceiling-fallback'`); anchor='wall' faz raycast horizontal contra paredes `room:wall`, alinha rotação Y pela normal da parede, sem sala mantém chão (`anchorApplied='wall-fallback'`). `catalog-ui.js::searchCategory` decora cada item com anchor/footprint da folha antes de `setLastResults` — drop, dblclick e dropAsset via API herdam metadados sem lookup extra. `inspector.js` ganha seção "posicionamento" com 2 inputs inteiros (L × P) e dropdown custom de apoio (Chão / Parede / Teto). `api.js` ganha `actions.setObjectFootprint(sceneId, [w,d])`, `actions.setObjectAnchor(sceneId, anchor)`, `state.objectFootprint(sceneId)`, `state.objectAnchor(sceneId)`. `persist.js` serializa/deserializa `anchor`, `footprint`, `freeTransform`. **Fix-ups embutidos:** (A) `setObjectFreeTransform` via API agora chama `notifySceneChanged()` direto pra inspector re-renderizar (Bug 5 do QA); (B) cena starter cube `-1.5` / sphere `1.5` (múltiplos de 0.5 — alinha com grid default); (C) snap toggle texto fixo "📐 encaixar", só `.active` + cor + tooltip diferenciam estado (CSS `.btn.snap-toggle` ganha `color: var(--text-2)` quando off pra contraste visível). CSS novo: `.insp-anchor-wrap` / `.insp-anchor-btn` / `.insp-anchor-menu` / `.insp-anchor-option` — dropdown 100% custom (sem `<select>` nativo).

- **2026-05-20 (Fase 2 SIMS-MODE)**: `public/src/snap.js` novo — estado `enabled/gridSize/rotStep` em localStorage, snap XZ + rotação discreta, respeita `obj.userData.freeTransform`. `scene.js` integra snap no `objectChange` do gizmo, no `addToScene`, e expõe `rebuildGrid()` reativo a `snap.gridSize`. Topbar ganha `📐 encaixar` (toggle) + `⚙` (popover custom com inputs grid/rot) e atalho `G`. Inspector ganha botão "posicionamento livre" por-objeto. Em `api.js`: `actions.toggleSnap/setSnapEnabled/setGridSize/setRotStep/setObjectFreeTransform` e `state.snapEnabled/gridSize/rotStep/isObjectFreeTransform`. Topbar 100% PT-BR (cubo/esfera/plano/luz, salvar/carregar/apagar/duplicar, tooltips). `outliner.js:18` `empty scene` → `cena vazia`. `catalog.js`: queries duplicadas diferenciadas (`coffee table`, `dining table`, `dining chair`, `office chair`, `tv stand`, `filing cabinet`, `floor lamp`, `desk lamp`, `street light`, `bathroom sink`, `bathroom mirror`, `office plant`).
- **2026-05-20 (patch pós-revisão Fase 0+1)**: `search.js` exporta `runSearchUI` / `setActiveProvider` / `getActiveProvider`; `api.js` agora delega `actions.runSearch` à UI (grade visual atualiza) e expõe `actions.setProvider` + `state.activeProvider` — fecha bugs 1 e 2 do QA. i18n PT-BR aplicado em placeholder/hint/toasts/menu de provider/HUD/help de viewport. `catalog.js`: queries de ~21 folhas simplificadas pra 1 palavra (`'house plant pot'` → `'plant'`, `'kitchen sink'` → `'sink'`, etc.) — catálogo guiado deixa de cair só em Sketchfab.
- **2026-05-20**: SIMS-MODE Fase 0 + Fase 1 entregues. Fase 0: `public/src/api.js` expõe `window.clag = { actions, state }`, `data-clag-action` em todos os botões. Fase 1: `public/src/catalog.js` com árvore de 6 categorias (Sala, Cozinha, Quarto, Banheiro, Escritório, Exterior), aba "Catálogo" no asset browser coexistindo com "Buscar". Click em folha dispara `searchAll(query)`. Comportamento existente intacto.

- **2026-05-19**: init do repo. Conteúdo herdado de `~/ved/random-experiments/scene-ide/` v2. Branding atualizada (scene-ide → clag em title, brand, toast, localStorage keys, dataTransfer types). Docs reescritos pra repo standalone. Agente revisor rodou e levantou 5 ações, todas aplicadas no commit imediatamente seguinte.

- **2026-05-19 (antes da graduação)**: PoC em scene-ide v1 → v2. v1 quebrou em viewport &lt;1366px (topbar overflow + inspector cortado). v2 reestruturou topbar em 2 linhas, search bar em linha própria, `min-width:0` em containers + media queries em 1100/900/760. Cena starter passou a ter Ground + Cube + Sphere visíveis (não mais plano vazio escuro). Texturas Poly Haven foram bug — moram em `/jpg/` no CDN, não `/gltf/`; corrigido usando o mapa `include` retornado pela API.
