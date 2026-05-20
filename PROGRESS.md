# PROGRESS — clag

Última atualização: 2026-05-20 (Fase 2 do SIMS-MODE entregue — snap + grid como default, popover de config, toggle por-objeto, atalho G; backlog: outliner+topbar PT-BR, queries duplicadas diferenciadas)

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

- **2026-05-20 (Fase 2 SIMS-MODE)**: `public/src/snap.js` novo — estado `enabled/gridSize/rotStep` em localStorage, snap XZ + rotação discreta, respeita `obj.userData.freeTransform`. `scene.js` integra snap no `objectChange` do gizmo, no `addToScene`, e expõe `rebuildGrid()` reativo a `snap.gridSize`. Topbar ganha `📐 encaixar` (toggle) + `⚙` (popover custom com inputs grid/rot) e atalho `G`. Inspector ganha botão "posicionamento livre" por-objeto. Em `api.js`: `actions.toggleSnap/setSnapEnabled/setGridSize/setRotStep/setObjectFreeTransform` e `state.snapEnabled/gridSize/rotStep/isObjectFreeTransform`. Topbar 100% PT-BR (cubo/esfera/plano/luz, salvar/carregar/apagar/duplicar, tooltips). `outliner.js:18` `empty scene` → `cena vazia`. `catalog.js`: queries duplicadas diferenciadas (`coffee table`, `dining table`, `dining chair`, `office chair`, `tv stand`, `filing cabinet`, `floor lamp`, `desk lamp`, `street light`, `bathroom sink`, `bathroom mirror`, `office plant`).
- **2026-05-20 (patch pós-revisão Fase 0+1)**: `search.js` exporta `runSearchUI` / `setActiveProvider` / `getActiveProvider`; `api.js` agora delega `actions.runSearch` à UI (grade visual atualiza) e expõe `actions.setProvider` + `state.activeProvider` — fecha bugs 1 e 2 do QA. i18n PT-BR aplicado em placeholder/hint/toasts/menu de provider/HUD/help de viewport. `catalog.js`: queries de ~21 folhas simplificadas pra 1 palavra (`'house plant pot'` → `'plant'`, `'kitchen sink'` → `'sink'`, etc.) — catálogo guiado deixa de cair só em Sketchfab.
- **2026-05-20**: SIMS-MODE Fase 0 + Fase 1 entregues. Fase 0: `public/src/api.js` expõe `window.clag = { actions, state }`, `data-clag-action` em todos os botões. Fase 1: `public/src/catalog.js` com árvore de 6 categorias (Sala, Cozinha, Quarto, Banheiro, Escritório, Exterior), aba "Catálogo" no asset browser coexistindo com "Buscar". Click em folha dispara `searchAll(query)`. Comportamento existente intacto.

- **2026-05-19**: init do repo. Conteúdo herdado de `~/ved/random-experiments/scene-ide/` v2. Branding atualizada (scene-ide → clag em title, brand, toast, localStorage keys, dataTransfer types). Docs reescritos pra repo standalone. Agente revisor rodou e levantou 5 ações, todas aplicadas no commit imediatamente seguinte.

- **2026-05-19 (antes da graduação)**: PoC em scene-ide v1 → v2. v1 quebrou em viewport &lt;1366px (topbar overflow + inspector cortado). v2 reestruturou topbar em 2 linhas, search bar em linha própria, `min-width:0` em containers + media queries em 1100/900/760. Cena starter passou a ter Ground + Cube + Sphere visíveis (não mais plano vazio escuro). Texturas Poly Haven foram bug — moram em `/jpg/` no CDN, não `/gltf/`; corrigido usando o mapa `include` retornado pela API.
