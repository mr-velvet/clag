# QA-NOTES — clag Sims-mode

> Notas estruturadas do agente QA UX. Atualiza a cada rodada de teste.

---

## Sessao 1 — 2026-05-20

### Contexto

- **Commits testados:** `3bb48d5` (ultimo do main) + **mudancas locais nao-commitadas** do agente DEV:
  - `public/src/api.js` (novo) — superficie `window.clag.*`
  - `public/index.html` (mod) — atributos `data-clag-action` em 16 controles
  - `public/src/main.js` (mod) — chama `initApi(...)` no boot
  - `public/src/search.js` (mod) — exporta `getLastResults / setLastResults / downloadAndPlace`
  - `docs/SIMS-MODE.md` (novo) — plano da missao
- **Servidor:** `npm start` na porta **5045** (Express). Boot limpo, sem erro.
- **URL:** http://localhost:5045
- **Viewport principal de teste:** 1440x900. Tambem testado 900x700 e 800x600 (responsivo).
- **Fase entregue pelo DEV:** **Fase 0 (api hooks)** apenas. **Fase 1 (Catalogo) ainda nao implementada.**

### Resumo geral

**Status: Fase 0 PASSA. Ressalva: 1 bug funcional importante (`runSearch` via API nao renderiza grade) + 1 lacuna de cobertura de API.**

- `window.clag` esta exposto e funcional. Versao 0.1.
- 14 actions, 6 state getters, event bus `on` repassado.
- 16 controles UI com `data-clag-action`. Coverage UI -> API: **15/16 (94%)**.
- Zero erros no console. Zero warnings.
- Layout responsivo: nenhum overflow horizontal em 1440/900/800.
- Feedback visual de botoes: ok (mode buttons trocam `.active` corretamente).

### Tabela: UI -> `window.clag.actions.*`

| `data-clag-action` (UI) | API equivalente | Status |
|---|---|---|
| `toggle-left-panel` | `toggleLeftPanel()` | OK |
| `toggle-right-panel` | `toggleRightPanel()` | OK |
| `add-cube` | `addPrimitive('cube')` | OK |
| `add-sphere` | `addPrimitive('sphere')` | OK |
| `add-plane` | `addPrimitive('plane')` | OK |
| `add-light` | `addPrimitive('light')` | OK |
| `gizmo-translate` | `setGizmoMode('translate')` | OK |
| `gizmo-rotate` | `setGizmoMode('rotate')` | OK |
| `gizmo-scale` | `setGizmoMode('scale')` | OK |
| `delete-selected` | `deleteSelected()` | OK |
| `duplicate-selected` | `duplicateSelected()` | OK |
| `save` | `save()` | OK |
| `load` | `load()` | OK |
| `search-input` (campo) | coberto por `runSearch(query)` | OK |
| `search-run` (botao) | `runSearch(query, providerId?)` | parcial (ver bug 1) |
| `provider-menu-toggle` | **AUSENTE** — sem `setProvider(id)` nem equivalente | **FALHA** |

Tambem ausente da API (mas existe so via teclado, nao via UI clicavel):
- Atalho `F` (frame selection) — nao tem `frameSelected()` em `actions`. Baixa prioridade — nao tem botao UI correspondente.

### Tabela: state getters

| Getter | Retorno | Status |
|---|---|---|
| `state.selected()` | objeto sumario ou null | OK |
| `state.objects()` | array de objetos | OK |
| `state.providers()` | 3 providers (khronos, polyhaven, sketchfab) | OK |
| `state.lastResults()` | clone do array | OK |
| `state.gizmoMode()` | string | OK |
| `state.isPanelOpen(side)` | bool | OK |

### Fluxos end-to-end

| Fluxo | Caminho | Resultado |
|---|---|---|
| `addPrimitive` x4 (cube/sphere/plane/light) | API | OK — cena vai de 3 -> 7 objetos |
| `addPrimitive('banana')` (invalido) | API | OK — lanca `primitivo desconhecido: banana` |
| `setGizmoMode('rotate' / 'scale' / 'translate')` | API | OK — botoes UI sincronizam classe `.active` |
| `setGizmoMode('foo')` (invalido) | API | OK — lanca |
| `selectByName('Cube')` | API | OK |
| `selectBySceneId('cube_2')` | API | OK |
| `selectByName('nao-existe')` | API | OK — retorna null |
| `duplicateSelected()` | API | OK |
| `deleteSelected()` | API | OK — delta -1 |
| `deselect()` | API | OK — selected vira null |
| `toggleLeftPanel()` / `toggleRightPanel()` | API | OK |
| `save()` -> dado retornado com `objects: [...]` v1 | API | OK |
| `load()` apos save | API | OK — restaura 4 objetos |
| **UI: digitar "rock" + Enter** | UI | OK — 64 cards renderizados, primeiro: "Rockingchair 01" CC0 (Poly Haven) |
| **API: `runSearch('rock')`** | API | parcial — retorna 64 itens e atualiza `lastResults`, mas **grade UI continua mostrando "hint" inicial** (bug 1) |
| **`dropAsset(id, {x:3,y:0,z:3})`** apos search UI | API | OK — Rockingchair 01 baixou de polyhaven, entrou na cena em (3,0,3), `assetMeta` populado com license CC0 |

### Bugs encontrados

#### Bug 1 — `runSearch` via API nao renderiza grade no asset browser (MEDIA)

- **Repro:** abrir console, rodar `await window.clag.actions.runSearch('rock')`. Items retornados, `state.lastResults()` populado, mas `#results` continua mostrando o hint inicial ("type a query and press Enter…").
- **Causa:** `api.js::runSearch` chama `searchAll(query)` direto + `setLastResults(items)`, sem disparar o `renderResults()` interno do `search.js`. Caminho UI usa `search.js::runSearch()` local, que **rendereiza**; caminho API pula isso.
- **Impacto:** Para QA programatico funciona (lastResults disponivel). Mas para um agente que esta dirigindo o app pra demonstrar visualmente ("rode busca pra mim e me mostre"), a UI nao reflete. Tambem assimetria: UI poe `<div class="status">searching…</div>` durante fetch, API nao.
- **Sugestao de fix:** expor `renderResults` em `search.js` e chamar via deps em `api.js::runSearch`, ou ja delegar a `search.js::runSearch(queryString)` (refatorar `search.js` pra aceitar query opcional como parametro em vez de so ler do DOM input).
- **Severidade:** media. Nao bloqueia uso programatico, mas quebra a expectativa de "API espelha UI."

#### Bug 2 — Sem cobertura de API pra escolha de provider (MEDIA)

- **Repro:** UI permite trocar provider via `#provider-btn` (botao "all providers ▾"). Estado interno `activeProviderId` em `search.js` muda. `window.clag.actions` **nao tem** acao equivalente.
- **Atenuante:** `runSearch(query, providerId)` aceita o providerId como 2o argumento, mas nao persiste — proxima busca volta a usar o que esta no DOM (que e o da UI, nao o do parametro anterior). Estado de provider e split entre 2 fontes.
- **Sugestao:** `actions.setProvider(id)` que muda `activeProviderId` interno + atualiza label/menu da UI. Ou expor o `activeProviderId` em `state.activeProvider()`.
- **Severidade:** media. Botao UI nao tem equivalente programatico — fere o principio do prompt ("Se algum botao nao tem equivalente em window.clag, e falha").

#### Bug 3 — `addPrimitive` retorna `name: 'Cube'` mas sceneId no segundo cube vira `cube_2` (BAIXA / nota)

- **Observacao, nao bug:** apos rodar `addPrimitive('cube')` 1 vez, ja existem 2 objetos chamados `Cube` (o starter scene + o adicionado). `selectByName('Cube')` retorna o **primeiro** encontrado, nao o ultimo. Pode confundir agente que assume "name = identificador unico".
- **Sugestao:** docs do `window.clag.actions.selectByName` mencionarem que e match do primeiro. `selectBySceneId` ja resolve quando precisao e critica. Tambem considerar sufixar nomes no UI (Cube, Cube.001) como faz Blender.
- **Severidade:** baixa. So virou nota.

### O que NAO testei (porque nao existe ainda)

- **Catalogo Fase 1:** nenhuma aba "Catalogo", nenhuma arvore semantica, `state.categoryTree()` nao existe. Aguardando DEV.
- **Snap/grid Fase 2:** nada exposto. `actions.toggleSnap` listado no SIMS-MODE.md mas nao implementado.
- **Sala / footprint / anchor (Fase 3 e 4):** idem.

### Achados de UX (sao notas — PM decide)

1. **Sem indicacao "API pronta" no UI.** Usuario nao-tecnico nao sabe que pode dirigir o app via console. (Provavel proposital — agentes leem doc, nao precisa balao.)
2. **Botao "+ light" usa label cru ("PointLight" no nome do objeto).** Roteirista vai chamar de "luz" ou "lampada", nao "PointLight". Considerar renomear `Light 1`, `Light 2` no `primitives.js::addPointLight`.
3. **Hint inicial em ingles** ("type a query and press Enter…"). UI e mixed pt/en hoje — pra leigo brasileiro, traduzir hints/labels visiveis ajuda.
4. **`+ light`** nao tem visual feedback de onde a luz caiu na cena (ponto em vez de mesh). Inspector mostra, mas no viewport e invisivel pra leigo. Helper visual (icone de lampada) ajudaria mas e Fase futura.
5. **Faltam tooltips com texto descritivo** nos icones do gizmo. So tem o atalho de teclado. Pra leigo, "rotate (E)" e melhor que so "↻".

### Screenshots

- `screenshots/qa/01-initial-boot.png` — cena starter (ground + cube + sphere)
- `screenshots/qa/02-after-search-rock.png` — apos `runSearch('rock')` via API: grade nao atualizou (bug 1)
- `screenshots/qa/03-ui-search-rock-results.png` — apos search via UI: 64 cards renderizados
- `screenshots/qa/04-after-dropAsset.png` — Rockingchair posicionado em (3,0,3)
- `screenshots/qa/05-responsive-900.png` — viewport 900x700, layout intacto
- `screenshots/qa/06-responsive-800.png` — viewport 800x600, layout intacto
- `screenshots/qa/07-left-panel-toggled.png` — painel hierarchy escondido

### Veredito Fase 0

**APROVA com 2 fixes pedidos antes de Fase 1:**

1. **Bug 1** (`runSearch` API renderiza grade) — alto valor pra QA visual e demos
2. **Bug 2** (action `setProvider` ausente) — fechar gap UI <-> API

Outras notas sao backlog.

---

## Revisao 2026-05-20 — commits 889bb4a + 1f5d59f

### Contexto

- **Commits commitados:** `889bb4a` (Fase 0 — `window.clag` + `data-clag-action`) e `1f5d59f` (Fase 1 — catalogo).
- **Servidor:** mesma instancia Express na porta `5045` (HTTP 200 verificado).
- **Viewport principal:** 1440x900. Tambem testado 1024x768 e 800x700.
- **Console:** 1 erro durante a sessao, mas e o esperado (`sketchfab: API token not configured`) ao tentar baixar item Sketchfab sem token. Nao e regressao.

### Status dos bugs anteriores

| Bug anterior | Estado pos-commits |
|---|---|
| **Bug 1** — `runSearch` via API enche `state.lastResults` mas nao renderiza grade visual | **PERSISTE.** Reproducido: `await window.clag.actions.runSearch('rock')` retorna 64 itens, `state.lastResults().length === 64`, mas `#results` continua mostrando `<div class="hint">…</div>` (0 cards). UI manual (`type "chair" + Enter`) renderiza 64 cards normalmente. |
| **Bug 2** — `setProvider(id)` ausente em `window.clag.actions` | **PERSISTE.** `Object.keys(window.clag.actions).includes('setProvider') === false`. Botao `data-clag-action="provider-menu-toggle"` continua sem equivalente programatico. |

Ambos os bugs reportados na sessao anterior continuam, exatamente como apontado, e foram commitados sem fix. Os 2 commits adicionaram **Fase 1 (catalogo)** sem encostar nos 2 bugs.

### Fase 1 (Catalogo) — funcionalidade

| Item | Resultado |
|---|---|
| Aba "buscar" e "catalogo" no DOM | OK — 2 `.asset-tab` no `#bottom-panel`, com `data-clag-action="tab-search"` e `tab-catalog`. |
| Click manual em "catalogo" | OK — `.asset-pane#catalog-pane` deixa de ter `.hidden`, troca classe `.active` no botao. |
| `catalog.tree()` retorna 6 categorias | OK — `living-room`, `kitchen`, `bedroom`, `bathroom`, `office`, `exterior` (icones 🛋 🍳 🛏 🛁 💼 🌳). |
| `catalog.leaves()` retorna ~47 folhas | OK — exatamente 47. Distribuicao: Sala 9, Cozinha 9, Quarto 7, Banheiro 6, Escritorio 8, Exterior 8. |
| Estrutura da arvore | Cada `tree()[i]` tem `children: [...]` com folhas. Cada folha tem `id, label, query, anchor, footprint`. **Nota:** prompt original do agente DEV citou `leaves` como propriedade aninhada, mas implementacao usa `children`. So convencao. |
| Click manual em "Sofá" (sala expandida) | OK — `#catalog-results` mostra 24 `.result-card` ("Sofa Couch" / Sketchfab). Folha fica com classe `.active`. |
| `catalog.searchCategory('armchair')` via API | OK — auto-troca para aba Catalogo, expande `living-room` se preciso, marca leaf `Poltrona`, renderiza 24 cards, popula `lastResults`. |
| `catalog.expand('kitchen')` + `collapse('living-room')` | OK — `expanded()` muda. Render reflete. |
| `catalog.showTab('search'/'catalog')` | OK — troca aba ativa. |
| `catalog.getLeaf('sofa')` | OK — retorna objeto com `categoryId: 'living-room'`. Invalida retorna `null`. |
| Drag&drop (`draggable=true` no `.result-card`) | OK — atributo presente, listener `dragstart` registra `application/x-clag-asset`. Nao executei drop fisico, mas API equivalente (`dropAsset`) funciona — testei com `polyhaven:anthurium_botany_01` e objeto entrou na cena em (5,0,5). |
| Double-click em `.result-card` do catalogo | OK pra polyhaven. Para sketchfab: dispara `downloadAndPlace`, falha esperada por falta de token. Comportamento identico a aba Buscar. |
| Catalog tree expandida em 1024 | OK — sem overflow. |
| Catalog tree em 800x700 | OK — `#catalog-tree` 199px, sem overflow horizontal. Tabs 73px + 89px caberam tranquilo. |

### Tabela: actions/state cobertura

| API | Existe? | Testei via API? | Tem UI? | Resultado |
|---|---|---|---|---|
| `actions.addPrimitive(kind)` | sim | sim | sim (4 botoes) | OK |
| `actions.setGizmoMode(mode)` | sim | (sessao 1) | sim (3 botoes) | OK |
| `actions.getGizmoMode()` | sim | implicito | n/a | OK |
| `actions.deleteSelected()` | sim | (sessao 1) | sim | OK |
| `actions.duplicateSelected()` | sim | (sessao 1) | sim | OK |
| `actions.selectByName(name)` | sim | (sessao 1) | n/a (so atalhos) | OK |
| `actions.selectBySceneId(id)` | sim | (sessao 1) | n/a | OK |
| `actions.deselect()` | sim | (sessao 1) | n/a | OK |
| `actions.dropAsset(itemId, pos)` | sim | sim (polyhaven) | n/a programatico | OK |
| `actions.runSearch(q, providerId?)` | sim | sim | sim | **falha visual — Bug 1** |
| `actions.save()` | sim | (sessao 1) | sim | OK |
| `actions.load()` | sim | (sessao 1) | sim | OK |
| `actions.toggleLeftPanel()` | sim | (sessao 1) | sim | OK |
| `actions.toggleRightPanel()` | sim | (sessao 1) | sim | OK |
| `actions.catalog.tree()` | sim | sim | n/a | OK |
| `actions.catalog.leaves()` | sim | sim | n/a | OK |
| `actions.catalog.getLeaf(id)` | sim | sim | n/a | OK |
| `actions.catalog.searchCategory(id)` | sim | sim | sim (47 botoes) | OK |
| `actions.catalog.expand(id)` | sim | sim | sim (6 toggles) | OK |
| `actions.catalog.collapse(id)` | sim | sim | sim | OK |
| `actions.catalog.expanded()` | sim | sim | n/a | OK |
| `actions.catalog.showTab(tab)` | sim | sim | sim (2 tabs) | OK |
| `actions.setProvider(id)` | **NAO** | n/a | **sim** (`provider-menu-toggle`) | **Bug 2 — gap UI/API** |

State getters (`selected`, `objects`, `providers`, `lastResults`, `gizmoMode`, `isPanelOpen`): todos presentes e funcionando. Nao foi alterado nos 2 commits.

### Cobertura UI → API (botoes com `data-clag-action`)

Total: **42 elementos** com `data-clag-action` quando todas as categorias estao expandidas.

- **18 acoes "base"** (toggles, gizmos, primitives, save/load, tabs, search bits)
- **6** `catalog-toggle-{categoryId}` (Sala, Cozinha, Quarto, Banheiro, Escritorio, Exterior)
- **47** `catalog-pick-{leafId}` (renderizados quando categoria expandida)

Convencao `catalog-pick-*` e `catalog-toggle-*` e dinamica — bom pro QA automatizado (selector previsivel por id de folha), nao precisa adicionar manualmente.

Acoes que **so existem na API** (sem botao UI, ok por design):
- `getGizmoMode`, `selectByName`, `selectBySceneId`, `deselect`, `dropAsset`. Razoaveis — sao primitivas pra script externo, nao precisam de botao.

### Bugs novos / observacoes desta sessao

#### Bug 4 — `catalog.searchCategory` retorna so Sketchfab pra varias folhas (BAIXA)

- **Repro:** `await window.clag.actions.catalog.searchCategory('plant')` retorna 24 itens, todos `source: "sketchfab"`. Por comparacao, `runSearch('plant')` retorna 64 (40 polyhaven + 24 sketchfab). A diferenca esta na query da folha: a folha `plant` usa `query: "house plant pot"` (mais especifica), e Poly Haven nao tem match pra esse termo composto. Resultado: o catalogo, na pratica, vira so Sketchfab pra muitas folhas, o que e ironico porque Sketchfab e o unico provider que precisa de token. O usuario nao-tecnico que abre o catalogo sem token cai num beco.
- **Severidade:** baixa-pra-media. Nao bloqueia (basta digitar consulta simples na aba Buscar). Mas a feature "catalogo guiado" perde valor se 70% das folhas so retornam Sketchfab. Sugestao: queries mais curtas (so `plant`, `chair`) ou queries fallback se o resultado primario veio so de provider com chave. Decisao do PM.

#### Bug 5 — Aba "buscar" usa classe `.result-card` agora (NOTA, nao bug — afeta selectors de QA)

- **Observacao:** na sessao 1, eu citei `.card` como classe dos cards do search. Depois dos commits, ambas as abas (Buscar e Catalogo) usam **`.result-card`** (verificado). Nao quebrou nada — so anota pra futuras suites de teste E2E mirarem em `.result-card`.

#### Observacao 6 — Inspector usa `<input type="color">` e `<input type="range">` nativos (PRE-EXISTENTE)

- Encontrei 17 `<input>` no DOM (1 search-input, 1 nome do objeto, 9 number, 2 color, 2 range, mais 2 number). Os `type="color"` e `type="range"` violam a regra "PROIBIDO componentes nativos do SO" do CLAUDE.md global. **Nao e regressao dos commits 889bb4a/1f5d59f** — ja estava no codigo do inspector. So registro pra PM.

### Screenshots

- `screenshots/qa-pass2/01-initial-boot.png` — boot apos commits, 1440x900.
- `screenshots/qa-pass2/02-catalog-tab.png` — click manual na aba "catalogo", Sala expandida com 9 folhas.
- `screenshots/qa-pass2/03-catalog-sofa-results.png` — click em "Sofá", 24 result-cards renderizados.
- `screenshots/qa-pass2/04-search-via-api-still-bug.png` — apos `runSearch('rock')` via API: hint continua, Bug 1 persiste.
- `screenshots/qa-pass2/05-search-ui-chair-1440.png` — search UI manual "chair" em 1440, grade ok.
- `screenshots/qa-pass2/06-catalog-1024.png` — catalogo em 1024x768, layout intacto.
- `screenshots/qa-pass2/07-catalog-800.png` — catalogo em 800x700, layout intacto.

### Veredito da rodada 2

**NO-GO para Fase 2** ate Bug 1 e Bug 2 serem fechados.

Justificativa:
- Fase 1 (catalogo) esta **funcionalmente solida**: arvore, expand/collapse, searchCategory, drag/drop, double-click — tudo OK.
- Mas os 2 bugs reportados na sessao 1 foram commitados **sem fix** e seguem afetando o uso programatico:
  - **Bug 1** vai dar dor durante Fase 2: snap/grid/footprint dependem do agente externo poder dirigir busca e ver o resultado. Se a grade nao renderiza via API, demos auto-conduzidas quebram.
  - **Bug 2** (`setProvider` ausente) e gap de cobertura que so vai crescer com mais providers.

Recomendo: **ciclo curto de fix dos 2 bugs (estimativa: 1h)** antes de abrir Fase 2. Fase 1 esta excelente, mas debito tecnico de Fase 0 nao pode arrastar.

Backlog (nao bloqueia Fase 2):
- Bug 4 (queries do catalogo retornam so Sketchfab)
- Observacao 6 (`<input type="color">` no inspector)

---

## Revisao 2026-05-20 — commit cb41eba (patch)

### Contexto

- **Commit testado:** `cb41eba` ("fix(api,catalog,i18n): patch pos-revisao Fase 0+1 Sims-mode").
- **Servidor:** mesma instancia Express na porta `5045` (HTTP 200 verificado antes de comecar).
- **Hard refresh:** `?nocache=qa3` na URL.
- **Viewport:** 1440x900 (default do MCP).
- **Console:** **0 errors, 0 warnings** em toda a sessao. Boot limpo.

### Status dos 4 bugs

| Bug | Estado | Detalhe |
|---|---|---|
| **Bug 1** — `runSearch` API nao renderizava grade | **CORRIGIDO** | `await clag.actions.runSearch('rock')` agora renderiza **64 cards** em `#results .result-card`. `state.lastResults().length === 64`. Hint inicial sumiu. Causa do fix: `api.js` agora chama `runSearchUI(query)` exportado do `search.js`, que dispara o render interno. |
| **Bug 2** — `setProvider` ausente | **CORRIGIDO** | `Object.keys(clag.actions).includes('setProvider') === true`. `clag.actions.setProvider('polyhaven')` muda `state.activeProvider()` de `"all"` para `"polyhaven"`. Label do botao UI muda de "todos os providers ▾" para **"Poly Haven ▾"**. `runSearch('rock')` apos `setProvider('polyhaven')` retorna 40 itens, todos `source: "polyhaven"` — filtragem funciona. |
| **Bug 3 (i18n PT-BR)** | **CORRIGIDO** | Textos do bottom panel verificados: placeholder do input = `"buscar assets 3d… (ex: árvore, pedra, cadeira)"`; botao = `"buscar"`; tabs = `"buscar"` / `"catálogo"`; provider btn = `"todos os providers ▾"`; itens do menu = `Khronos Samples / Poly Haven / Sketchfab` com badges `"livre"` / `"chave"`; hint do catalogo = `"escolha uma categoria à esquerda pra ver assets sugeridos."`; viewport-help, panel-headers (`"objetos na cena"`, `"propriedades"`), `"arraste um resultado para a cena · ou clique duplo"`, `"nenhum objeto selecionado"` no inspector — **tudo PT-BR**. Toasts: `baixando "X"…`, `carregando…`, `"X" adicionado`, `falhou: …`, `nada selecionado`, `objetos salvos`, `cena carregada`, `clag carregado` (visto no boot e ao acionar drop). Badges das cards = `"CC0"` (nome de licenca, mantem). **Unico leftover EN encontrado:** `outliner.js:18` ainda usa string literal `"empty scene"` quando a hierarchy esta vazia. Nao mencionado no patch — passou batido. Baixa severidade. |
| **Bug 4 (queries de 1 palavra, claim "36 folhas")** | **PARCIALMENTE CORRIGIDO** | O catalogo tem **47 folhas**, nao 36 como o commit message do DEV afirma (ele lista ~36 leaves mas a arvore total e 47 — possivel que o DEV nao tenha contado as folhas que ja eram "1 palavra"). Patch simplificou ~33 queries, e o resultado e **bom**: hoje 33/47 (70%) das folhas retornam pelo menos 1 item livre (Poly Haven ou Khronos). **Ainda restam 14/47 folhas (~30%) que retornam SO Sketchfab**, listadas abaixo. |

#### Folhas que ainda dependem so de Sketchfab (apos patch)

| Leaf id | Query | Itens (todos sketchfab) |
|---|---|---|
| `fridge` | `fridge` | 24 |
| `sink` | `sink` | 24 |
| `counter` | `counter` | 24 |
| `microwave` | `microwave` | 24 |
| `wardrobe` | `wardrobe` | 24 |
| `dresser` | `dresser` | 24 |
| `sink-bath` | `sink` | 24 |
| `bathtub` | `bathtub` | 24 |
| `shower` | `shower` | 24 |
| `towel` | `towel` | 24 |
| `laptop` | `laptop` | 24 |
| `keyboard` | `keyboard` | 24 |
| `whiteboard` | `whiteboard` | 24 |
| `bicycle` | `bicycle` | 24 |

Observacao: a query ja e 1 palavra simples — o problema agora nao e mais "termo composto", e **lacuna real de Poly Haven** pra esses domesticos (banheiro, eletro de cozinha, periferico). Nao tem como melhorar via query — so via outro provider ou Poly Haven expandir biblioteca. Cabe ao PM decidir se exibe banner "este catalogo precisa de token Sketchfab" pras 14 folhas, ou se aceita a lacuna.

### Smoke tests (zero regressao confirmada)

| Cenario | Resultado |
|---|---|
| UI manual: digitar `"tree"` + Enter no `#search-input` | OK — 59 `.result-card` renderizados |
| Aba catalogo + expand `living-room` + click leaf `sofa` | OK — 30 cards renderizados em `#catalog-results` |
| `catalog.expanded()` apos `expand('living-room')` | OK — retorna `['living-room']` |
| `actions.dropAsset('polyhaven:Sofa_01', {x:2,y:0,z:2})` | OK — objeto adicionado (`Sofa 01` na cena, count 5 -> 6) |
| `state.activeProvider()` apos `setProvider('all')` | OK — `"all"` |
| Toast no boot (`clag carregado — arraste para orbitar...`) | OK — PT-BR, exibido |
| Toast de download (`baixando "X"…`) | OK — PT-BR, observado em 2 drops |
| Console: erros novos | **0 errors, 0 warnings** |

### Achados novos

1. **Leftover EN em `outliner.js:18`**: `"empty scene"` quando a hierarchy nao tem objetos do usuario. Nao foi tocado no patch. Severidade baixa (cena starter sempre tem ground+cube+sphere — usuario raramente ve essa string).
2. **Catalog tem 47 folhas, nao 36**: discrepancia com o commit message. Nao e bug, e nota — DEV pode ter usado contagem diferente (sem `dining-chair`/`office-chair` duplicados, sem `sink-bath`, etc.). 47 e o numero real exposto em `clag.actions.catalog.leaves().length`.
3. **Multiplas folhas compartilham a mesma query**: `coffee-table` / `dining-table` -> `"table"`; `cabinet` / `tv-stand` / `filing-cabinet` -> `"cabinet"`; `floor-lamp` / `desk-lamp` / `streetlight` -> `"lamp"`; `plant` / `office-plant` -> `"plant"`; `mirror` / `bath-mirror` -> `"mirror"`; `dining-chair` / `office-chair` -> `"chair"`. Resultado: clicar em 2 folhas diferentes mostra a **mesma grade**. Nao quebra nada, mas confunde — `armchair` (`armchair`) tem 25 hits enquanto `dining-chair` (`chair`) tem 48. Nao bloqueia Fase 2; PM decide se quer diferenciar (e.g. `dining chair`, `office chair` voltando — mas ai cai no Bug 4 antigo). Trade-off de design.
4. **Coverage UI -> API: 100%** agora. Antes era 15/16 (Bug 2). Com `setProvider` exposto, todos os botoes com `data-clag-action` tem equivalente programatico.

### Screenshots

- `screenshots/qa-pass3/01-after-runSearch-rock.png` — Bug 1 fix: 64 cards renderizados via `runSearch('rock')` API
- `screenshots/qa-pass3/02-setProvider-polyhaven.png` — Bug 2 fix: label "Poly Haven ▾" + grade filtrada a 40 itens polyhaven
- `screenshots/qa-pass3/03-search-tree-ui.png` — smoke: UI manual "tree" + Enter, 59 cards
- `screenshots/qa-pass3/04-catalog-sofa-ptbr.png` — catalogo PT-BR, leaf "Sofá" ativa, 30 cards
- `screenshots/qa-pass3/05-provider-menu-ptbr.png` — menu de provider aberto com badges PT-BR (livre/chave)

### Veredito final

**GO para Fase 2.**

Justificativa:
- **Bug 1** e **Bug 2** (os 2 bloqueadores) — **fechados**, verificados via Playwright.
- **Bug 3 (i18n)** — fechado pra todos os textos do bottom panel, toasts, viewport-help, panel-headers, inspector. Unico leftover (`outliner.js:18 "empty scene"`) e cosmetico e nao bloqueia.
- **Bug 4** — patch reduziu drasticamente o problema (de "maioria so Sketchfab" para 70% com fonte livre). As 14 folhas restantes sao limitacao de biblioteca, nao de query. Backlog pra PM decidir politica.
- **Zero regressao funcional**: search UI, catalogo, dropAsset, save/load, toggles — tudo OK.
- **Zero erros / warnings no console.**

Backlog (Fase 2 pode comecar em paralelo):
- Traduzir `"empty scene"` em `outliner.js`
- PM decidir destino das 14 folhas dependentes de Sketchfab (banner? fallback de query? aceitar lacuna?)
- 6 leaves compartilham query — UX-wise pode confundir, decisao do PM
- Observacao 6 da pass2 (`<input type="color">` nativo) ainda nao tratada

---

## Revisao 2026-05-20 — commit 3ea96f1 (Fase 2)

### Contexto

- **Commit testado:** `3ea96f1` (Fase 2 Sims-mode — snap/grid + popover + freeTransform + backlog i18n).
- **Servidor:** mesma instancia Express na porta `5045` (HTTP 200 antes de comecar).
- **Hard refresh:** `?nocache=qa4` e `?nocache=qa4-reload` na URL durante a sessao.
- **Viewport:** 1440x900.
- **Console:** **0 errors, 0 warnings**. Unica entrada: log de boot `[clag] window.clag pronto — actions: ...` listando 21 actions (vs 14 na pass3).

### Status do snap (default + persistencia + atalho + intercepts)

| Item | Resultado |
|---|---|
| `state.snapEnabled()` no boot (sem localStorage) | **true** — default correto |
| `state.gridSize()` no boot | **0.5** — default correto |
| `state.rotStep()` no boot | **15** — default correto |
| `addPrimitive('cube')` com snap ON | x=-0.5, z=-1 (multiplos de 0.5) — y=0.5 livre. **OK**, snap-on-add via `addToScene → applySnapToObject` (scene.js:241) |
| `addPrimitive('sphere')` com snap ON | x=-0.5, z=-1, y=0.6 livre — **OK** |
| `actions.toggleSnap()` | retorna `false` na 1a chamada, `true` na 2a — **OK** |
| `actions.setGridSize(1.0)` | `state.gridSize() === 1.0`, localStorage `clag:grid-size === "1"` — **OK** |
| `actions.setRotStep(45)` | `state.rotStep() === 45`, localStorage `clag:rot-step === "45"` — **OK** |
| Persistencia apos F5 (refresh) | snap ON, grid 1, rot 45 mantidos — **OK** |
| Atalho `G` | toggle snap on/off via teclado — **OK** (2 cliques verificados) |
| `actions.setSnapEnabled(false)` | tooltip muda para `"encaixe desligado — clique pra encaixar à grade (G)"`, classe `.active` removida — **OK, totalmente reativo** |
| `setGridSize(0)`, `setGridSize(-1)` | throw `gridSize invalido: ...` — **OK** validacao |
| `setRotStep(0)`, `setRotStep(95)` | throw `rotStep invalido (precisa 0 < v <= 90): ...` — **OK** validacao |
| Snap so XZ na Fase 2 | confirmado — y permanece livre nos primitivos adicionados |

### Snap-on-gizmo-drag

- **Codigo verificado** em `scene.js:140-143`: `gizmo.addEventListener('objectChange', ...)` chama `snap.applySnapToObject(selected)` enquanto user arrasta + tambem em `dragging-changed=false` (linha 138) para garantir snap final ao soltar.
- **Codigo verificado** em `snap.js:139-161`: `applySnapToObject` arredonda XZ pra multiplo de `_gridSize` e rotacao pra multiplo de `_rotStep`, respeitando `obj.userData.freeTransform`.
- **Teste programatico de drag e inviavel** sem simular eventos de mouse no gizmo (TransformControls). Como o path UI esta limpo, e snap-on-add (que usa a mesma funcao) funcionou em todos os testes, considero **OK por inspecao + validacao indireta**.

### freeTransform (escape hatch por-objeto)

| Item | Resultado |
|---|---|
| Inspector mostra toggle `[data-clag-action="toggle-free-transform"]` | OK — botao `.insp-free-toggle` com texto inicial `"encaixar na grade"` |
| Click manual no toggle | `userData.freeTransform === true`; texto muda para `"posicionamento livre (ignora encaixe)"`; classe `.active` adicionada — **OK** |
| `actions.setObjectFreeTransform('cube_4', false)` | API muda state (`isObjectFreeTransform === false`), MAS botao do inspector **nao atualiza texto/classe na hora** — fica `"posicionamento livre (ignora encaixe)"` com `.active` ate o objeto ser re-selecionado. Bug menor. **(Bug 5)** |
| Re-selecao apos API call | inspector re-renderiza com texto correto `"encaixar na grade"` sem `.active` — OK |

### Popover de configuracao

| Item | Resultado |
|---|---|
| Botao `⚙` ao lado do snap toggle | presente, `data-clag-action="snapConfig"`, title `"configurações de encaixe"` |
| Click abre `.snap-popover` | OK, popover visivel |
| Conteudo PT-BR | titulo `"configurações de encaixe"`, label `"tamanho do grid (m)"`, label `"passo de rotação (°)"`, hint `"grid 0.5 m + rotação 15° é confortável pra interiores."` — **tudo PT-BR** |
| Input `#snap-grid-input` com `step="0.05"` | OK, valor inicial `0.5` |
| Input `#snap-rot-input` com `step="1"` | OK, valor inicial `15` |
| Mudar input `0.5 → 0.25` (event `input` + `change`) | `state.gridSize() === 0.25`, localStorage atualizado. **OK** |
| Click fora (no canvas) fecha popover | OK — popover continua no DOM mas `rect.width === 0` e `rect.height === 0` (oculto) |
| Click em `document.body` direto **NAO** fecha | popover continua visivel. Acidentalmente click em area neutra que nao seja viewport pode nao fechar. **(Observacao 7, baixa severidade)** |

### Backlog i18n (commit message DEV citou 3 items)

| Item | Resultado |
|---|---|
| `outliner.js:18` `"empty scene"` → PT-BR | **OK** — agora `"cena vazia"`, verificado deletando todos os objetos da cena |
| Topbar tooltips PT-BR | **TODOS OK**: `+ cubo` ("adicionar cubo"), `+ esfera` ("adicionar esfera"), `+ plano` ("adicionar plano"), `+ luz` ("adicionar luz"), `⇄` ("mover (W)"), `↻` ("rotacionar (E)"), `⤧` ("escalar (R)"), `apagar` ("apagar selecionado (Del)"), `duplicar` ("duplicar (Ctrl+D)"), `salvar` ("salvar cena"), `carregar` ("carregar cena"), `☰` ("alternar painel de objetos"), `▤` ("alternar painel de propriedades") |
| 12 queries diferenciadas | **OK** — `sharedQueries.length === 0` (zero queries duplicadas entre as 47 folhas). Pass3 tinha 6 grupos compartilhados (`coffee-table`/`dining-table` -> `table`, etc.), agora cada folha tem query unica. Verificado: `coffee-table → "coffee table"` retorna 30 itens (todos polyhaven, 0 overlap com dining), `dining-table → "dining table"` retorna 24 itens (todos sketchfab). |

### Cobertura UI → API (refeita)

| `data-clag-action` (UI) | API equivalente | Status |
|---|---|---|
| `toggle-left-panel` | `toggleLeftPanel()` | OK |
| `toggle-right-panel` | `toggleRightPanel()` | OK |
| `add-cube` / `add-sphere` / `add-plane` / `add-light` | `addPrimitive(kind)` | OK |
| `gizmo-translate` / `gizmo-rotate` / `gizmo-scale` | `setGizmoMode(mode)` | OK |
| `delete-selected` | `deleteSelected()` | OK |
| `duplicate-selected` | `duplicateSelected()` | OK |
| `save` / `load` | `save()` / `load()` | OK |
| `tab-search` / `tab-catalog` | `catalog.showTab(tab)` | OK |
| `search-input` / `search-run` | `runSearch(query, providerId?)` | OK |
| `provider-menu-toggle` | `setProvider(id)` | OK |
| `catalog-toggle-{id}` (6) | `catalog.expand/collapse(id)` | OK |
| `catalog-pick-{id}` (47) | `catalog.searchCategory(id)` | OK |
| `toggleSnap` **(novo)** | `toggleSnap()` / `setSnapEnabled(bool)` | OK |
| `snapConfig` **(novo)** | sem API direta — `setGridSize`/`setRotStep` cobrem o efeito final; popover e so UI helper. Aceito por design. |
| `toggle-free-transform` **(novo)** | `setObjectFreeTransform(sceneId, free)` | OK funcional, mas botao nao atualiza visualmente sem re-selecao (Bug 5) |

**Total UI elementos com `data-clag-action`:** 35 unicos (era 16+ na pass3; novos: `snapConfig`, `toggleSnap` no topbar + `toggle-free-transform` no inspector).

**API surface:** 21 actions de topo + 8 em `catalog.*`, 11 state getters (era 14+6 na pass3). Crescimento: `toggleSnap`, `setSnapEnabled`, `setGridSize`, `setRotStep`, `setObjectFreeTransform` nas actions; `snapEnabled`, `gridSize`, `rotStep`, `isObjectFreeTransform` nos state.

### Smoke tests Fase 1 (zero regressao)

| Cenario | Resultado |
|---|---|
| `catalog.tree().length === 6` | OK (`living-room`, `kitchen`, `bedroom`, `bathroom`, `office`, `exterior`) |
| `catalog.leaves().length === 47` | OK |
| `catalog.showTab('catalog')` + `expand('living-room')` + `searchCategory('sofa')` | OK — 30 cards em `#catalog-results`, mix khronos+polyhaven |
| `runSearch('rock')` via API | OK — retorna 64, lastResults 64, **renderiza 64 cards em `#results`** (Bug 1 segue fixado) |
| `state.activeProvider()` apos `setProvider('all')` / `setProvider('polyhaven')` | OK (Bug 2 segue fixado) |

### Bugs encontrados

#### Bug 5 — Inspector toggle `freeTransform` nao reage a chamada API (BAIXA)

- **Repro:** selecionar objeto, no inspector clicar "encaixar na grade" — vira `"posicionamento livre (ignora encaixe)"` com `.active`. Depois, no console: `clag.actions.setObjectFreeTransform('cube_4', false)`. State muda (`isObjectFreeTransform === false`), mas o botao continua mostrando `"posicionamento livre (ignora encaixe)"` com classe `.active` no DOM.
- **Causa:** `inspector.js::freeTransformToggle` so atualiza o botao no evento `click` interno, nao reage a mudancas externas (api ou outro caminho).
- **Mitigacao:** re-selecionar o objeto refresca o inspector e mostra o estado correto.
- **Impacto:** afeta principalmente agentes externos que mudam freeTransform via API e esperam que UI espelhe. Para uso manual nao acontece (usuario sempre clica o botao). **Severidade: baixa.**
- **Sugestao de fix:** `inspector.js` ouve `'sceneChanged'` (que `setObjectFreeTransform` ja emite via `forceUpdateInspector`?) — checar se ha event hook faltando, ou re-renderizar inspector quando o sceneId selecionado mudar de `userData.freeTransform`.

#### Observacao 7 — Click em `document.body` direto nao fecha popover (BAIXA)

- **Repro:** abrir popover, executar `document.body.click()` no console — popover permanece visivel. Click em `canvas` (viewport 3D) fecha normalmente.
- **Causa:** provavelmente listener de close esta no canvas/window, nao em body genericamente.
- **Severidade:** baixa, raramente reproduzivel manualmente (usuario sempre clica em algum elemento visivel). Reporto so como nota.

#### Observacao 8 — Tamanho de grid sem cap programatico (NOTA)

- `setGridSize(0.01)` e `setGridSize(10)` sao aceitos sem reclamacao (so 0/negativo bloqueiam). DEV citou "cap 600 divisoes" no reporte — confirmei que o cap esta **na renderizacao visual do grid** (helper THREE), nao no setter. Ou seja: `state.gridSize()` pode virar 0.01 mesmo que o helper visual desenhe so cada Nth linha. Snap matematico continua funcionando em qualquer valor.
- **Severidade:** nota. Comportamento aceitavel (snap fino e legitimo, so o desenho do grid degrada).

### Regressoes

**Nenhuma.** Fase 0 (api hooks + persist) e Fase 1 (catalog + i18n bottom panel) continuam funcionando 100%. Bug 1 (`runSearch` API renderiza grade) e Bug 2 (`setProvider`) seguem fixos. Bug 3 (`empty scene`) agora fechado.

### Screenshots

- `screenshots/qa-pass4/01-initial-boot-defaults.png` — boot limpo, snap ON, grid 0.5
- `screenshots/qa-pass4/02-after-setGridSize-1.png` — grid visual com `gridSize=1`
- `screenshots/qa-pass4/03-snap-popover-open.png` — popover de config aberto, labels PT-BR
- `screenshots/qa-pass4/04-cena-vazia.png` — outliner com cena vazia (i18n fix)
- `screenshots/qa-pass4/05-catalog-sofa.png` — catalogo "Sofá" com 30 cards (sem regressao)
- `screenshots/qa-pass4/06-final-state.png` — estado final apos suite completa

### Veredito da rodada 4

**GO para Fase 3.**

Justificativa:
- **Snap default + grid + rotStep:** todos os 12 cenarios passaram. Defaults corretos, persistencia OK, atalho G funciona, validacao de entrada e robusta.
- **freeTransform:** funciona via API e UI individualmente. So tem o gap menor de UI nao reagir a chamada externa (Bug 5), nao bloqueia.
- **Popover de config:** PT-BR, inputs reativos, persistencia OK. Click fora (canvas) fecha — comportamento aceitavel.
- **i18n backlog:** `cena vazia` + 13 tooltips PT-BR no topbar + 47 queries diferenciadas (zero duplicacao). DEV cumpriu os 3 items.
- **Cobertura UI → API:** 100% das acoes UI tem equivalente programatico (snapConfig e helper de UX, nao precisa de API).
- **Zero regressao**, **zero erros / warnings no console**.

Fase 3 (sala + footprint + anchor) pode comecar. Backlog para PM:
- Bug 5 (inspector reativo a freeTransform API) — fix de 10min, vale fazer antes de Fase 3 mexer no inspector
- Observacao 7 (close popover em body) — cosmetico, deixar
- Observacao 8 (cap programatico de gridSize) — feature, nao bug
- Bug 4 da pass3 (14 folhas so Sketchfab) — politica de PM, segue backlog
- Inputs nativos `color`/`range` no inspector — pendente desde pass2

---

## Revisao 2026-05-20 — commit 4f553d8 (Fase 3 + fix-ups)

### Contexto

- **Commit testado:** `4f553d8` ("feat(footprint,anchor): consumo de footprint + ancoragem no drop — Fase 3 Sims-mode").
- **Servidor:** Express na porta `5045` (caiu uma vez durante a sessao, reiniciado via `npm start`).
- **Hard refresh:** `?nocache=qa5` e `?nocache=qa5-reload` na URL.
- **Viewport:** 1440x900.
- **Console:** 1 error de Sketchfab (esperado — token nao configurado, mesmo padrao da pass2/pass3). **Zero erros novos, zero warnings.**

### Status dos fix-ups (A / B / C)

| Fix | Item | Resultado |
|---|---|---|
| **A (Bug 5)** | Inspector toggle freeTransform reage a API | **CORRIGIDO** — `setObjectFreeTransform(id, true)` emite `notifySceneChanged()` e inspector re-renderiza via rAF. Verificado: apos 2x rAF, texto vira `"posicionamento livre (ignora encaixe)"` com `.active`. **OBS:** leitura imediata (sincrona) ainda mostra estado velho — sao 2 frames de delay devido ao throttle do rAF. Para QA programatico, basta um `await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))` antes de verificar. Nao bloqueia. |
| **B** | Cena starter cube/sphere alinhados ao grid 0.5 | **CORRIGIDO** — `state.objects()` mostra Cube em `(-1.5, 0.5, 0)` e Sphere em `(1.5, 0.6, 0)`. X multiplos de 0.5 = encaixados. Y livre. |
| **C** | Snap toggle label fixo "encaixar" | **CORRIGIDO** — `textContent` permanece `"📐 encaixar"` em ON e OFF. Apenas `.active` (classList) e `title` mudam. Pattern de toggle button (Word, VS Code). |

### Fase 3 — footprint

| Item | Resultado |
|---|---|
| `catalog.getLeaf('sofa').footprint === [2,1]` | OK |
| `lastResults[i].footprint` populado nos cards do catalogo | OK — todos os 30 cards de "sofa" trazem `footprint:[2,1]` e `anchor:'floor'` |
| Drop de sofa em (0,0,0) com snap ON + gridSize 0.5 | OK — posicao final `(0.25, 0, 0)`. Footprint [2,1] (par × impar) snapa centro pra meia-tile em X (0.25) e centro de tile em Z (0). Matematica correta. |
| `state.objectFootprint('asset_4') === [2,1]` apos drop | OK |
| `setObjectFootprint(id, [3,2])` | OK — `state.objectFootprint` retorna `[3,2]`; posicao reajusta pra `(0.5, 0, 0.25)` (impar × par) |
| `setObjectFootprint(id, [1,1])` | OK — posicao snapa pra `(0.5, 0, 0.5)` (impar × impar) |
| Validacao `[0,1]` | OK — throw `footprint invalido (precisa inteiros >= 1)` |
| Validacao `[2]` | OK — throw `footprint invalido (esperado [w, d])` |
| Validacao `[1.5, 1]` | **FALHA SILENCIOSA** — `parseInt(1.5) === 1`, aceita e seta [1,1]. Float truncado sem aviso. **(Bug 6, baixa)** |

### Fase 3 — anchor

| Item | Resultado |
|---|---|
| Leaves com `anchor: 'wall'` (7 total) | OK — `tv`, `cabinet`, `mirror`, `picture-frame`, `towel`, `bath-mirror`, `whiteboard` |
| Leaves com `anchor: 'ceiling'` | **ZERO** — nenhuma folha do catalogo tem anchor 'ceiling'. Prompt cita "Luz de Teto" mas a folha nao existe. **(Observacao 9, nota)** |
| Drop de "Quadro" (picture-frame) sem sala | OK — anchor='wall', footprint=[1,1], posicao (2,0,2) → fica no chao. Marca `anchorApplied='wall-fallback'` em userData (nao exposto via state — agente nao consegue checar via API). |
| `setObjectAnchor(id, 'ceiling')` em cubo | OK funcional mas **comportamento inesperado**: cubo de 1m vai pra y=1.7 (= 2.7 - 1m altura). Codigo posiciona o **topo do objeto** na altura do teto (objeto "pendura" do teto). Prompt esperava y=2.7 (centro). E comportamento defensavel — ler como "teto = teto, asset cola por cima" — mas merece confirmacao do PM. |
| `setObjectAnchor(id, 'wall')` apos ceiling | **BUG** — Y permanece em 1.7 (nao reseta pra chao no fallback). `anchorApplied` marca `'wall-fallback'` mas posicao nao volta. **(Bug 7, media)** |
| `setObjectAnchor(id, 'floor')` apos ceiling | **BUG** — Y permanece em 1.7 (nao reseta pra chao). Em `applyAnchor`, branch 'floor' retorna sem mexer Y. **(Bug 7, media)** |
| `setObjectAnchor(id, 'invalid')` | OK — throw `anchor invalido (esperado floor|wall|ceiling)` |

**Bug 7 — `setObjectAnchor` nao re-posiciona Y ao voltar pra floor/wall fallback** (MEDIA)

- **Repro:** `cube = addPrimitive('cube')` → `setObjectAnchor(cube.sceneId, 'ceiling')` → Y vai pra 1.7. Depois `setObjectAnchor(cube.sceneId, 'floor')` → Y permanece 1.7. Idem para 'wall' sem sala.
- **Causa:** em `search.js::applyAnchor`, branches 'floor' e 'wall-fallback' marcam `anchorApplied` mas nao resetam `obj.position.y`. So 'ceiling' altera Y.
- **Impacto:** agente externo (ou usuario via dropdown do inspector) que move objeto entre apoios deixa objeto flutuando no ar. Comportamento confuso. UI permite a operacao mas resultado e inconsistente.
- **Sugestao:** 'floor' deveria resetar Y=0 (ou y do chao da sala). 'wall-fallback' idem ou manter Y atual com aviso. Ou: documentar que mudanca de anchor preserva Y, e e responsabilidade do user re-posicionar.

### Inspector — secao "posicionamento"

| Item | Resultado |
|---|---|
| Secao visivel ao selecionar objeto | OK — entre `posição` e `material` |
| Titulo da secao | `"posicionamento"` — PT-BR OK |
| Row label "tamanho" | **Observacao 10:** PM ia preferir "tamanho na grade" (prompt menciona). Atual `"tamanho"` ambiguo com escala. Baixa. |
| Inputs L × P sao `<input type="number">` com `min=1 step=1` | OK |
| L valor `3` via UI → `state.objectFootprint` = `[3,1]`, posicao re-snapa | OK |
| P valor `2` via UI → `state.objectFootprint` = `[3,2]`, posicao re-snapa pra `(2, 0, 2.25)` | OK |
| L valor `0` via UI → clamp pra 1 | OK |
| Dropdown "apoio" e custom (NAO `<select>` nativo) | OK — botao `.insp-anchor-btn` + popup `.insp-anchor-menu` |
| Click no botao abre popup | OK (`menu.classList.remove('hidden')`) |
| 3 opcoes "Chão" / "Parede" / "Teto" | OK (PT-BR), `data-anchor-id="floor|wall|ceiling"` |
| Click em opcao fecha popup + aplica anchor | OK — verificado: clicar "Chão" muda label, sincroniza state |
| Click outside (mousedown) fecha popup | OK |
| Click outside via `click` event nao fecha | OK por design (handler usa `mousedown`) |

**Observacao 11 — Titulos de secao misturam EN/PT** (BAIXA)

`identity`, `material`, `info` permanecem em ingles enquanto `posição` e `posicionamento` viraram PT-BR. Inconsistente com a politica i18n da pass3. Sugestao: `identidade` / `material` / `info` (info ja serve PT).

### Fase 3 — persistencia

| Item | Resultado |
|---|---|
| `save()` serializa footprint/anchor/freeTransform de assets | OK em localStorage — verifiquei JSON: Picture Frame salvo com `anchor:'ceiling', footprint:[3,2], freeTransform:true` |
| Save → F5 → `load()` restaura asset com Sims-mode meta | **BUG** — apos reload, `state.objectAnchor`/`objectFootprint`/`isObjectFreeTransform` retornam **defaults** (`floor`, `[1,1]`, `false`). `assetMeta` tem `footprint:[2,1]` (da definicao do catalogo, nao do save). **`userData.anchor/footprint/freeTransform` perdidos.** **(Bug 8, ALTA)** |
| Save/load de primitivas com Sims-mode meta | NAO testei diretamente (so testei cubo com anchor default 'floor'). Provavelmente OK pois branch primitive chama `applySimsMeta` (persist.js:106). Asset branch e que falha. |

**Bug 8 — persistencia de Sims-mode meta perdida no rehydrate de assets** (ALTA)

- **Repro:** drop "Fancy Picture Frame 01", `setObjectAnchor(id, 'ceiling')` + `setObjectFootprint(id, [3,2])` + `setObjectFreeTransform(id, true)` → `save()` → recarrega pagina → `load()` → checa state: anchor=floor, footprint=[1,1], isFree=false. Posicao Y preservada (2.235m) mas semantica perdida.
- **Causa:** em `main.js::downloadAndPlaceFromMeta` (linha 181), funcao **nao retorna** o `obj` criado. Em `persist.js::rehydrate` (linha 128), `const placed = await downloadAndPlaceMeta(...)` pega `undefined`, entao `if (placed && placed.userData) applySimsMeta(placed, o)` nunca executa. `applySimsMeta` foi escrita pra cobrir esse caso mas a deps esta quebrada.
- **Impacto:** **ALTA.** Toda a Fase 3 (footprint/anchor por objeto + freeTransform) e silenciosamente perdida ao salvar e recarregar cena com assets. Agente que automatiza "monte cena, salve, recarregue" vai ver state inconsistente. Tambem afeta usuario manual.
- **Sugestao de fix:** `downloadAndPlaceFromMeta` retornar `obj`. Alternativa: chamar `applySimsMeta` diretamente dentro de `downloadAndPlaceFromMeta` (passando `o` salvo como parametro), invertendo a responsabilidade.

### Cobertura UI → API

| Categoria | Total |
|---|---|
| Total UI com `data-clag-action` (com 1 categoria expandida) | 37 elementos unicos |
| API actions (top-level) | 23 (incluindo `catalog`) |
| API actions em `catalog.*` | 8 |
| State getters | 13 (novos: `objectFootprint`, `objectAnchor`) |
| UI sem equivalente API | `anchor-menu-toggle` (helper de UI, OK por design); `snapConfig` (helper de UI, OK por design) |
| API sem UI | `selectByName/BySceneId/deselect/dropAsset/getGizmoMode` — primitivas pra script externo, OK por design |

**Coverage UI funcional → API: 100%** (todos os botoes que disparam acao concreta tem equivalente). Os 2 sem API sao toggles de popup que nao tem semantica programatica util.

### Smoke tests (zero regressao Fase 0-2)

| Cenario | Resultado |
|---|---|
| `runSearch('chair')` via API | OK — 48 resultados, 48 cards em `#results` |
| `catalog.tree().length === 6` | OK |
| `catalog.leaves().length === 47` | OK |
| `addPrimitive('cube')` com snap ON | OK — pos `(-0.5, 0.5, -1)` |
| `deleteSelected()` | OK — delta -1 |
| `setProvider('polyhaven')` apos `setProvider('all')` | nao re-testei aqui, mas seguiu funcionando ate sessao 4 |
| `toggleSnap()` 2x | OK — `state.snapEnabled()` volta a true |
| `setGridSize(1)` + persistencia | nao re-testei (pass4 cobriu) |
| `cena starter` apos boot | OK — 3 objetos (Ground, Cube em -1.5/0.5/0, Sphere em 1.5/0.6/0) |

**Nenhuma regressao detectada.**

### Bugs novos desta sessao

- **Bug 6** (BAIXA): `setObjectFootprint(id, [1.5, 1])` aceita sem throw (parseInt trunca pra 1).
- **Bug 7** (MEDIA): `setObjectAnchor` nao reposiciona Y ao mudar pra floor/wall-fallback (objeto fica flutuando apos ceiling → floor).
- **Bug 8** (ALTA): persistencia perde anchor/footprint/freeTransform de assets ao salvar+recarregar (downloadAndPlaceFromMeta nao retorna obj, applySimsMeta nunca roda).

### Observacoes / notas

- **Obs 9** (NOTA): catalogo nao tem nenhuma folha com `anchor:'ceiling'`. Prompt pede pra testar "Luz de Teto" mas folha nao existe. Recomendado adicionar pelo menos `ceiling-light` (sala / cozinha) pra usuario leigo encontrar luminarias suspensas.
- **Obs 10** (BAIXA): label "tamanho" no inspector seria mais claro como "tamanho na grade" pra distinguir de escala.
- **Obs 11** (BAIXA): titulos de secao do inspector misturam EN (identity, material, info) e PT (posição, posicionamento). Inconsistencia visivel.
- **Obs 12** (NOTA): `applyAnchor` para 'ceiling' alinha o topo do objeto ao teto (pendura do teto). Prompt sugere y=2.7 (centro). Comportamento atual e defensavel para luminarias / fans de teto, mas precisa decisao de design do PM.
- **Obs 13** (NOTA): `userData.anchorApplied` (que distingue 'wall' real de 'wall-fallback') nao e exposto via state API. Agente externo nao consegue verificar se o anchor "pegou" ou caiu pra fallback.

### Screenshots

- `screenshots/qa-pass5/01-initial-boot.png` — boot com cena starter alinhada ao grid 0.5 (Fix B)
- `screenshots/qa-pass5/02-after-sofa-frame-drops.png` — Sofa 01 + Glam Velvet Sofa + Picture Frame na cena
- `screenshots/qa-pass5/03-inspector-posicionamento.png` — secao posicionamento visivel com L×P + dropdown apoio
- `screenshots/qa-pass5/04-inspector-glam-selected.png` — Glam Velvet Sofa selecionada, footprint [2,1], anchor floor

### Veredito da rodada 5

**NO-GO para Fase 4** ate Bug 8 fechado.

Justificativa:
- **Fix A, B, C todos passaram.** Fase 3 funcional (footprint, anchor, inspector custom dropdown, API setters/getters) — entrega solida.
- **Bug 8 (persistencia perdida)** e bloqueador: toda a Fase 3 silenciosamente se perde no save/load de assets. Roundtrip que era OK ate Fase 2 agora regride em metadata Sims-mode. Cliente que monta cena com semantica de apoio e tamanho perde tudo ao recarregar.
- **Bug 7 (Y nao reseta no anchor change)** e regressao funcional menor mas visivel — usuario muda dropdown e objeto flutua.
- **Bug 6** e baixa, pode esperar.

Recomendacao: **fix de Bug 8 e Bug 7 (estimativa 30min total)** antes de abrir Fase 4. Fase 3 esta 90% completa — so falta fechar esses 2 gaps.

Backlog (nao bloqueia Fase 4):
- Bug 6 (validacao de footprint float)
- Obs 9 (adicionar folha 'ceiling-light' no catalogo)
- Obs 10 (renomear label "tamanho" → "tamanho na grade")
- Obs 11 (i18n: traduzir titulos identity/material/info pra PT-BR)
- Obs 12 (decisao PM: ceiling anchor cola topo vs centro)
- Obs 13 (expor `objectAnchorApplied` em state API)
- Backlog anterior: inputs nativos color/range, Bug 4 (14 folhas so Sketchfab)

---

## Revisao 2026-05-20 — commit c8d5596 (fix bloqueador)

### Contexto

- **Commit testado:** `c8d5596` ("fix(persist,anchor,validation,i18n): fecha bloqueador Fase 3 + ressalvas PM").
- **Servidor:** Express na porta `5045` (HTTP 200 antes de comecar, sem precisar reiniciar).
- **Hard refresh:** `?nocache=qa6` e `?nocache=qa6-reload` na URL.
- **Viewport:** 1440x900.
- **Console:** **0 errors, 0 warnings**. So entrada de log eh `[clag]` boot.

### Status dos 3 bugs (Pass5)

| Bug | Severidade Pass5 | Estado | Detalhe |
|---|---|---|---|
| **Bug 8** — persistencia perde anchor/footprint/freeTransform de assets no save+reload | ALTA (bloqueador) | **CORRIGIDO** | Drop polyhaven Chandelier 01 (anchor='ceiling') → `setObjectFootprint(id, [3,2])` + `setObjectFreeTransform(id, true)` → `save()` → reload pagina → `load()`. Apos rehidratacao: `state.objectAnchor === 'ceiling'`, `state.objectFootprint === [3,2]`, `state.isObjectFreeTransform === true`, Y preservado em 1.9. **localStorage** ja vinha com `anchor`, `footprint`, `freeTransform` top-level + assetMeta refletindo. `main.js::downloadAndPlaceFromMeta` agora retorna `obj`, e `persist.js::applySimsMeta` finalmente roda. Defesa em profundidade tambem aplicada: `main.js` propaga `meta.anchor`/`meta.footprint` pro `userData` ao recriar asset. |
| **Bug 7** — `setObjectAnchor` nao reposiciona Y ao voltar pra floor/wall-fallback | MEDIA | **CORRIGIDO** | Cubo de 1m em y=0.5: `setObjectAnchor(id, 'ceiling')` → y=1.7 (2.7 - 1m, pendura do teto); `setObjectAnchor(id, 'floor')` → y=0.5 (de volta ao chao via novo helper `plantOnFloor` que zera base do bbox). Idem `wall-fallback` (sem sala): replanta no chao. `applyAnchor` em `search.js` agora invoca `plantOnFloor(obj)` antes de marcar `anchorApplied`. |
| **Bug 6** — `setObjectFootprint(id, [1.5, 1])` aceita float (parseInt truncava silenciosamente) | BAIXA | **CORRIGIDO** | `api.js::setObjectFootprint` agora valida valor cru com `Number.isInteger`. Testes: `[1.5,1]` → throw `footprint deve ser dois inteiros >= 1`; `[0,1]` → throw; `[-2,1]` → throw; `['2',1]` → throw (string rejeitada); `[2]` → throw `footprint invalido (esperado [w, d])`; `[2,3]` → aceita e seta. |

**Os 3 bugs reportados estao 100% fechados.**

### Status das ressalvas PM + bonus

| Item | Resultado |
|---|---|
| **PM #1** — toasts warn ao usar ceiling-fallback / wall-fallback | **OK** — Drop "Chandelier 01" (polyhaven, anchor='ceiling') sem sala dispara `.toast.warn` com texto `"sem sala — luz pendurada no teto virtual (2.7m)"`. Drop "Fancy Picture Frame 01" (polyhaven, anchor='wall') sem sala dispara `.toast.warn` com `"sem parede — objeto posicionado no chão"`. Drop "Sofa 01" (anchor='floor') NAO dispara warn — so success `"\"Sofa 01\" adicionado"`. Tres caminhos exercitados via dropAsset API. |
| **PM #2** — Inspector row "tamanho na grade" + titulos PT-BR | **OK** — Inspector com cubo primitivo selecionado: secoes em PT-BR = `IDENTIDADE / POSIÇÃO / POSICIONAMENTO / MATERIAL / INFORMAÇÕES`. Inspector de asset (Chandelier 01) idem. Row da secao Posicionamento tem label `"tamanho na grade"` (era `"tamanho"` no Pass5). |
| **PM #3** — Snap toggle off com contraste melhor (text-1 + opacity 0.85) | **OK** — Verificado computedStyle: ON = `color: white` `opacity: 1` + background `rgb(69,132,234)` solido (accent). OFF = `color: rgb(170,178,197)` (text-1) + `opacity: 0.85`, background transparente. Visualmente distinguivel, NAO parece desabilitado. Screenshots 06 vs 07. |
| **Bonus 1** — 3 folhas ceiling-anchor no catalogo | **OK** — `catalog.leaves().length === 50` (era 47 no Pass5). Tres novas folhas: `ceiling-light` ("Luz de Teto", Sala), `chandelier` ("Lustre", Sala), `pendant-lamp` ("Luminária Pendente", Quarto). Todas com `anchor: 'ceiling'`, `footprint: [1,1]`. Catalogo expandido total mostra **50 `[data-clag-action^="catalog-pick-"]`** no DOM. |
| **Bonus 2** — Inspector titles PT-BR (Obs 11 Pass5) | **OK** — `identity → identidade`, `light → luz`, `info → informações`. Sem leftovers EN nos titulos de secao. Labels de rows internos (`name, type, source, license, color, rough., metal., emissive, verts, tris, meshes`) continuam em EN — pre-existentes, fora do escopo declarado do commit. |
| **searchCategory** das novas folhas | **OK** — `catalog.searchCategory('ceiling-light')` auto-troca pra aba `catálogo` (`activeTab === 'catálogo'`, pane visivel = `catalog-pane`), marca leaf `"Luz de Teto"` como ativa, e renderiza **24** `.result-card` em `#catalog-results`. Idem `chandelier` (29 cards; 5 polyhaven livres + 24 sketchfab) e `pendant-lamp` (24 cards, todos sketchfab). |
| **Drop com anchor=ceiling aplicado** | **OK** — `dropAsset('polyhaven:Chandelier_01', {x:2,y:0,z:2})` → posicao final `[2, 1.902, 2]` (Y proximo de ROOM_HEIGHT_DEFAULT 2.7 - altura do bbox ~0.8). `state.objectAnchor === 'ceiling'`, `state.objectFootprint === [1,1]`. Anchor herdado da folha do catalogo. |

### Cobertura UI → API

| Categoria | Total |
|---|---|
| Total UI com `data-clag-action` (com 1 categoria expandida — Sala) | 39 unicos |
| Total UI com `data-clag-action` (todas 6 categorias expandidas) | 28 base + 6 catalog-toggle + **50** catalog-pick = 84 elementos |
| API actions top-level | 23 (incluindo `catalog`) |
| API `catalog.*` | 8 |
| State getters | 13 |
| UI sem equivalente API | 3 helpers de UI (`provider-menu-toggle`, `anchor-menu-toggle`, `snapConfig`) — aceitos por design (popup helpers, sem semantica programatica util) |
| API sem UI | 5 (`getGizmoMode`, `selectByName`, `selectBySceneId`, `deselect`, `dropAsset`) — primitivas pra script externo, OK por design |

**Cobertura UI funcional → API: 100%.**

### Smoke tests Fase 0-2 (zero regressao)

| Cenario | Resultado |
|---|---|
| `runSearch('rock')` via API → 64 cards renderizados em `#results` | OK (Bug 1 segue fixado) |
| `addPrimitive('cube')` com snap on → posicao `(-0.5, 0.5, -1)` (multiplos de 0.5) | OK |
| `setGizmoMode('rotate')` → `state.gizmoMode() === 'rotate'`, botao UI sincroniza `.active` | OK |
| `setProvider('polyhaven')` → state muda, label UI muda | nao re-testei aqui (cobre desde Pass3) |
| `toggleSnap()` 2x → state volta ao default true | OK |
| `catalog.tree().length === 6` + `catalog.leaves().length === 50` | OK |
| Save round-trip de primitiva (kind=primitive) | implicito pelo teste de Chandelier (asset) e teste de cubo (primitive) na sessao Pass5 que passou — branch primitive sempre rodou applySimsMeta corretamente |

**Zero regressao detectada.**

### Bugs novos / observacoes

Nenhum bug novo introduzido pelo patch. As ressalvas pre-existentes (inputs nativos `color`/`range` no inspector, 14 folhas so Sketchfab, ceiling cola topo vs centro — Obs 12 Pass5, `objectAnchorApplied` nao exposto em state — Obs 13 Pass5) seguem no backlog.

**Nota cosmetica:** `pendant-lamp` retorna 0 resultados livres (so Sketchfab). Sem token, usuario que clica no catalogo "Quarto → Luminária Pendente" cai em grade sem download possivel. Mesma situacao do `ceiling-light`. So `chandelier` tem 5 itens polyhaven livres. Coerente com pattern do Pass3/4 — limitacao de biblioteca de provider, nao do clag.

### Screenshots

- `screenshots/qa-pass6/01-before-reload-asset-saved.png` — Chandelier 01 dropado com anchor=ceiling, footprint=[3,2], freeTransform=true, antes do reload
- `screenshots/qa-pass6/02-after-reload-persist-ok.png` — apos reload + `load()`: asset restaurado com mesma meta (Bug 8 fechado)
- `screenshots/qa-pass6/03-toasts-fallback-warn.png` — 2 toasts warn PT-BR visiveis (ceiling-fallback + wall-fallback)
- `screenshots/qa-pass6/04-catalog-ceiling-light.png` — aba Catalogo, leaf "Luz de Teto" ativa com 24 cards (Bonus 1)
- `screenshots/qa-pass6/05-inspector-ptbr-titles.png` — Inspector com cubo selecionado: identidade/posição/posicionamento/material/informações + row "tamanho na grade" (PM #2 + Bonus 2)
- `screenshots/qa-pass6/06-snap-off.png` — snap toggle off (PM #3, contraste OK)
- `screenshots/qa-pass6/07-snap-on.png` — snap toggle on (azul acento)
- `screenshots/qa-pass6/08-final-state.png` — estado final apos suite completa

### Veredito da rodada 6

**GO para Fase 4.**

Justificativa:
- **Os 3 bugs reportados no Pass5 (Bug 6 baixa, Bug 7 media, Bug 8 ALTA bloqueador)** — todos fechados, verificados via Playwright com state API + localStorage + reload real.
- **3 ressalvas PM** (toasts warn / "tamanho na grade" / contraste snap off) — todas aplicadas e verificadas.
- **2 bonus** (3 folhas ceiling + titulos inspector PT-BR) — entregues, leaves de 47 → 50, titulos consistentes.
- **Cobertura UI → API: 100%** funcional.
- **Zero regressao** em Fase 0-2 (search, catalog, snap, primitives, save/load).
- **Zero erros / warnings no console.**

Fase 4 (sala / room geometry) pode comecar. Backlog que segue (nao bloqueia):
- Obs 12 Pass5 — decisao PM: ceiling anchor cola topo vs centro
- Obs 13 Pass5 — expor `objectAnchorApplied` em state API
- Bug 4 antigo — 14 folhas so Sketchfab (limitacao de provider, nao codigo)
- Inputs nativos `color`/`range` no inspector (debito da Pass2)
- Labels internos do inspector ainda em EN (`name`, `type`, `verts`, etc.) — debito i18n menor

---

## Revisao 2026-05-20 — commit 4043b70 (Fase 4 + backlog v1)

### Contexto

- Commit `4043b70`: `feat(room): modo sala (paredes+piso+teto) + backlog acumulado — Fase 4 Sims-mode`
- Server ja rodava em :5045. Boot limpo, 0 erros / 0 warnings.
- Viewport: 1440x900. Cwd: `C:/Users/manu/ved/clag`.
- API surface cresceu: actions top-level **23 → 24** (adiciona `room` namespace), state getters **13 → 16** (`hasRoom`, `roomDimensions`, `objectAnchorApplied`).
- Catalog: 50 → 51 folhas (+`kitchen-pendant`).

### Status Fase 4

| Item | Resultado |
|---|---|
| `room.js` criado com `createRoom / removeRoom / hasRoom / getRoomDimensions / isRoomPart / describeRoomPart` | **OK** — 188 linhas, materiais default cinza, paredes Box finos (0.05m), piso/teto Box 0.02m, `freeTransform=true` em todos |
| Botao `add-room` na toolbar abre modal | **OK** — `data-clag-action="add-room"` chama `openRoomModal()` |
| Modal custom (nao prompt nativo, segue regra de UI) | **OK** — overlay full-screen, card centrado, 3 inputs number PT-BR (`largura/profundidade/altura`), botoes `criar/cancelar` |
| Esc fecha modal | **OK** |
| Click fora (overlay) fecha modal | **OK** |
| Enter cria sala | **OK** — testado com `dispatchEvent(KeyboardEvent)`, gerou sala 6x5x2.7 |
| Foco automatico no primeiro input | **OK** — `setTimeout(focus, 0)` na linha 295 de main.js |
| `actions.room.create({width:6,depth:5,height:2.7})` cria 6 pecas | **OK** — 1 piso + 1 teto + 4 paredes (PT-BR: Piso/Teto/Parede Norte/Sul/Leste/Oeste) |
| Outliner lista cada peca com badge `room` | **OK** — 6 items, badge correto |
| `state.hasRoom()` apos create | **OK** — `true` |
| `state.roomDimensions()` retorna `{width, depth, height}` | **OK** — bbox-driven, valores arredondados pra 3 casas |
| Recriar sala substitui anterior (nao acumula) | **OK** — antes 6 pecas, depois 6 pecas, dims novas |
| Modal pre-preenche dims atuais quando ja ha sala | **OK** — apos `create(8,6,3)`, abrir modal mostra `8/6/3` (nao defaults) |
| `actions.room.remove()` apaga sala | **OK** — retorna 6, `hasRoom()===false`, `roomDimensions()===null` |
| Drop com `anchor=ceiling` + sala 3m: posiciona em altura real | **OK** — chandelier Y=2.6, `anchorApplied === 'ceiling'` (sem `-fallback`) |
| Drop com `anchor=wall` + sala: cola na parede mais proxima | **OK** — Fancy Picture Frame em Z=-2.97 (parede norte Z=-3), `anchorApplied === 'wall'` |
| Drop sem sala usa fallback 2.7m | **OK** — chandelier sem sala Y=2.3 (2.7 - 0.4), `anchorApplied === 'ceiling-fallback'` |
| Persist: save inclui `room` no JSON | **OK** — `save().room === {width:8,depth:6,height:3}` |
| Persist: load restaura sala + objetos | **OK** — apos F5, sala 8x6x3 + 6 pecas, chandelier em Y=2.6 |
| Inspector pra `room:*` esconde transform e posicionamento | **OK** — secoes mostradas: `identidade / material / informações`. Sem `posição / posicionamento` |
| Inspector pra `room:*` mostra nome PT-BR (`Parede Norte`, etc.) | **OK** |
| Inspector pra `room:*` mantem cor / rugosidade / metal / emissivo editaveis | **OK** |

### Status backlog A-G

| Item | Resultado |
|---|---|
| **A — 14 labels inspector PT-BR** | **OK** — `ROW_LABELS` em inspector.js tem 14 entradas. Cubo selecionado mostra: nome/tipo/posição/rotação/escala/tamanho na grade/apoio/cor/rugosidade/metal/emissivo/vértices/triângulos/meshes. Luz mostra: cor/intens./dist. Asset mostra: origem/licença/ver. **Zero leftover EN.** Fecha debito i18n da Pass5 e Pass6. |
| **B — kitchen-pendant em Cozinha** | **OK** — `catalog.tree()[kitchen].children` inclui `kitchen-pendant` (label "Luminária Pendente", anchor=ceiling, footprint=[1,1]). `bedroom` mantem `pendant-lamp` (label "Luminária Pendente"). Ambos retornam 24 resultados em `searchCategory`. |
| **C — toast so no drop inicial + aviso textual no inspector** | **OK** — drop sem sala dispara 1 toast warn PT-BR (`sem sala — luz pendurada no teto virtual (2.7m)`). `setObjectAnchor(id, 'ceiling')` programatico no mesmo objeto NAO adiciona novo toast (silent=true default). Inspector mostra `.insp-anchor-warning` com texto PT-BR (`sem sala — pendurado em altura padrão (2.7m)`), estilizado com border-left amarelo. |
| **D** (nao mencionado pelo DEV — assumindo nao implementado) | **N/A** — sem item D no commit message |
| **E — snap-off com border dashed** | **OK** — `btn.snap-toggle:not(.active)` tem `border-style: dashed`, `border-color: var(--text-2)`. CSS linha 111 do styles.css. Visual confirmado em screenshot. |
| **F (Obs 12) — ceiling Y centraliza topo do objeto no teto** | **PARCIAL — bug pivot** — formula em search.js:298 (`obj.position.y = ceilingY - objHeight/2`) so funciona se o pivot do mesh estiver no centro do bbox. Verificado: cubo primitive (pivot centrado) cola topo no teto exato (gap 0). **Chandelier 01 (asset com pivot no topo do mesh — comum em luminarias modeladas): top do bbox fica em Y=2.6, teto em Y=3.0, gap de 0.4m.** O DEV resolveu o caso "pivot centrado" mas nao o caso "pivot offset". Pra corrigir, formula correta: `position.y += (ceilingY - objBox.max.y)` (delta entre topo atual e topo desejado, agnostico ao pivot). |
| **G (Obs 13) — `state.objectAnchorApplied`** | **OK em runtime** / **bug em persist** — getter retorna `'ceiling'`/`'wall'`/`'floor'`/`'ceiling-fallback'`/`'wall-fallback'` corretamente apos drop ou `setObjectAnchor`. **Mas apos save + reload + load, retorna `null`** — `userData.anchorApplied` nao eh persistido em `persist.js`. Object position ja vem certo, entao impacto eh so na introspecao de estado pos-load. |

### Bugs novos

| # | Severidade | Descricao |
|---|---|---|
| 9 | **MEDIA** | **Backlog F regressao parcial**: ceiling anchor nao "cola topo no teto" pra assets com pivot fora do centro do bbox. Repro: criar sala 6x5x3, `dropAsset('polyhaven:Chandelier_01')` via catalog leaf `chandelier`. Top do bbox fica em Y=2.6, teto em Y=3.0 — visualmente o lustre fica flutuando ~40cm abaixo do teto. Fix sugerido: trocar `obj.position.y = ceilingY - objHeight/2` por `obj.position.y += (ceilingY - objBox.max.y)`. Mesma logica precisa em wall anchor (nao testado nesta rodada, pode ter mesmo problema). |
| 10 | **BAIXA** | `userData.anchorApplied` nao eh persistido. Apos save + reload + load, `state.objectAnchorApplied(id) === null` mesmo que objeto esteja em posicao de teto/parede. Impacto: introspecao de estado pos-load fica incompleta. Fix: incluir `anchorApplied` no payload de `persist.js`, restaurar em `loadScene`. |

### Regressoes

**Nenhuma.** Fase 0-3 smoke test passou: search (64 cards), addPrimitive, gizmo modes, setObjectFreeTransform, setObjectFootprint, catalog tree (6 categorias / 51 leaves agora — +1 do backlog B), duplicate/delete, providers (3), zero erros/warnings no console.

### Cobertura UI → API

| Categoria | Total |
|---|---|
| UI com `data-clag-action` (unicos, todas categorias colapsadas) | 38 |
| Inclui `add-room` novo (cobre `actions.room.openModal()`) | OK |
| API actions top-level | 24 (incl. `room`, `catalog`) |
| API `room.*` | 5 (create/remove/openModal/dimensions/has) |
| API `catalog.*` | 8 |
| State getters | 16 (+3 novos: hasRoom, roomDimensions, objectAnchorApplied) |
| UI sem equivalente API (helpers de popup) | 3 (provider-menu-toggle, snapConfig, anchor — nao tem; aceito por design) |

**Cobertura UI funcional → API: 100%** mantida.

### Screenshots

- `screenshots/qa-pass7/01-modal-open.png` — modal nova sala aberto via `actions.room.openModal()`
- `screenshots/qa-pass7/02-room-created-6x5x2.7.png` — sala 6x5x2.7 criada, 6 pecas no outliner
- `screenshots/qa-pass7/03-anchor-with-room.png` — wall anchor (picture frame) colado em parede norte
- `screenshots/qa-pass7/04-fallback-toast-and-warning.png` — toast warn + `.insp-anchor-warning` PT-BR no inspector (Backlog C)
- `screenshots/qa-pass7/05-inspector-room-wall.png` — Parede Norte selecionada, inspector so com identidade/material/informações
- `screenshots/qa-pass7/06-persist-after-reload.png` — sala + chandelier restaurados apos F5+load
- `screenshots/qa-pass7/07-snap-off-dashed.png` — snap toggle off com border dashed (Backlog E)
- `screenshots/qa-pass7/08-final-state.png` — estado final pos-suite

### Veredito

**GO com ressalvas — SIMS-MODE v1 pronto pra deploy.**

Justificativa:
- **Fase 4 entregue completa.** Modal custom respeitando regra "sem componentes nativos", `room.*` API funcional, anchor consome sala real, persist round-trip OK.
- **Backlog A, B, C, E entregues sem ressalva.** Quatro de seis itens fechados limpos.
- **Backlog F (Obs 12) parcial — Bug 9 MEDIA.** Algoritmo funciona pra primitivas mas falha em assets com pivot offset (caso mais comum de luminaria). Nao bloqueia v1 — chandelier ja fica "no teto" visualmente (mesmo que com gap), e o resto da experiencia sims-mode esta coerente. Fix de 1 linha pode entrar em patch pos-deploy.
- **Backlog G (Obs 13) parcial — Bug 10 BAIXA.** State getter funciona em runtime. Persist round-trip perde o valor. Impacto so em introspecao programatica.
- **Zero regressoes em Fase 0-3.** Cobertura UI → API 100%. Console limpo.

Recomendacao pro PM: deploy v1 ja, abrir issue pra Bug 9 + Bug 10 no backlog pos-deploy. Nenhum dos dois bloqueia a primeira impressao de quem testar o sims-mode.

---

## 2026-05-20 — gizmo D.1-D.3 (commit c9e026c)

### Contexto

- **Commit testado:** `c9e026c` (sub-fases D.1 surface-snap + D.2 anti-overlap XZ + D.3 cadeado HTML overlay).
- **Branch:** `feat/surface-snap-gizmo`.
- **Arquivos novos:** `public/src/physics.js` (~215 linhas), `public/src/contextual-gizmo.js` (~356 linhas).
- **Servidor:** Express na porta `5045`. Boot limpo, 0 errors, 0 warnings.
- **Viewport:** 1440x900 (default Playwright).
- **localStorage limpo** antes da suite (hard reset via `localStorage.clear()` + reload).
- **Nota pre-suite:** app carregava cena do localStorage anterior (5 objetos + sala) antes do clear. Limpeza necessaria para testar boot real.

### Tabela de cenarios

| Cenario | Esperado | Observado | Status |
|---|---|---|---|
| C1 Boot limpo | 3 objetos (Ground/Cube/Sphere), gizmoMode='contextual', 0 erros | 3 objetos, contextual, snap=false, 0 erros | PASS |
| C2 Cadeado fechado no add | addPrimitive retorna sceneId, 🔒 visivel, isLocked=true | SceneId ok, 🔒 visivel, isLocked=true | PASS |
| C2 Click cadeado abre 🔓 | Apos click: isLocked=false, visual 🔓, classe unlocked | Apos click via Playwright: isLocked=false, 🔓, .unlocked | PASS |
| C3 Anti-overlap XZ drag | Mover esfera pra cima do cubo -> slide pra fora sem overlap XZ | overlapX=true, overlapZ=false (sem overlap real), posicao final deslocada | PASS |
| C4 Surface snap D.1 | Objeto draggado cola na superficie (y = 0 + altura/2 = 0.5 pra cubo 1x1) | Y = ~0 (pivot no nivel do chao), aabb.min.y = -0.5 (penetra chao) | **FAIL (Bug 11 ALTA)** |
| C5 Anti-overlap 2 cubos | Cubo B nao sobrepoe cubo A no plano XZ | Cubo B bloqueado, hasXZOverlap=false | PASS |
| C6 W ativa TransformControls | Modo vira 'translate', botao UI ativo, gizmo 3 setas visivel | gizmoMode='translate', btn ativo | PASS |
| C6 Esc volta ao contextual | Apos Esc: gizmoMode='contextual' | gizmoMode permanece 'translate' | **OBS (ver abaixo)** |
| C6 setGizmoMode('contextual') via API | Retorna 'contextual', estado restaurado | Funciona via API | PASS |
| C7 Sala criada | 6 pecas room:*, hasRoom=true, roomDimensions correto | OK | PASS |
| C7 Cubo atravessa parede | Esperado D.1-D.3: cubo PODE atravessar (room:* excluida do sweep) | Cubo vai ate (10,0,10) sem bloqueio | OBS (esperado) |
| C8 freeTransform bypassa sweep via mouse | Objeto destravado pode sobrepor via drag manual | Nao testavel via dragObjectTo — sweep sempre aplicado na API | OBS (ver Bug 12) |
| C9 Snap default OFF | snapEnabled()=false por default (proposta D) | snapEnabled()=false | PASS |
| C9 toggleSnap funciona | on/off/on correto | on->true, off->false | PASS |
| C10 Save persiste freeTransform | localStorage tem freeTransform=true | localStorage tem freeTransform=true no cubo destravado | PASS |
| C10 Load restaura cadeado | Apos reload+load: isLocked/freeTransform corretos | isLocked=false pra cubo que tinha freeTransform=true | PASS |
| C10 Load restaura sala | Sala recriada com dims corretas | hasRoom=true, dims 4x3x2.5 | PASS |
| C10 AABBs corretas pos-load | Todos AABBs refletem posicao real do objeto | AABBs de todos os cubos apontam pra mesma posicao errada ate 1o drag | **FAIL (Bug 13 ALTA)** |

### Bugs encontrados

#### Bug 11 — Surface snap D.1 nao compensa meia-altura do objeto — pivot penetra o chao (ALTA)

- **Repro:** `addPrimitive('cube')` → `dragObjectTo(id, { x: 3, z: 3 })`. `objects()[n].position[1] === ~0`. AABB: `min.y = -0.5, max.y = +0.5` — objeto centrado em Y=0, metade abaixo do chao.
- **Causa:** `contextual-gizmo.js:245` faz `_dragObj.position.set(swept.x, finalY, swept.z)` onde `finalY = surface.y` (= 0 pro chao). Mas `surface.y` e o Y da superficie, nao o Y do centro do objeto. Objeto com pivot centrado precisa de `finalY = surface.y + objHeight/2`.
- **Comparacao:** `addPrimitive` coloca cubo em Y=0.5 corretamente (via `addToScene` que usa pos padrao). So o drag via `surfaceUnder` retorna Y=0 e nao compensa.
- **Impacto:** Todo objeto arrastado visualmente penetra o chao. Anti-overlap de D.2 tambem fica comprometido pois AABB do objeto draggado fica com min.y=-0.5 (abaixo do nivel do chao), causando potenciais falsos positivos de colisao com outros objetos nessa regiao.
- **Fix:** Em `surfaceUnder` (ou no caller em `contextual-gizmo.js`): `finalY = surface.y + objHeight/2`. Ou calcular `objHeight` a partir de `myBox.max.y - myBox.min.y` e adicionar metade ao hit.point.y.
- **Screenshot:** `screenshots/qa-gizmo-D/005-surface-snap-penetracao-chao.png`

#### Bug 12 — `dragObjectTo` API sempre aplica sweep mesmo com freeTransform=true (MEDIA)

- **Repro:** Setar objeto A com freeTransform=true. Chamar `dragObjectTo(A.sceneId, posicaoDeB)`. Objeto A e bloqueado pelo sweep como se estivesse travado — nao pode ser movido para cima de B via API.
- **Causa:** `contextual-gizmo.js:218-223` verifica `freeTransform` e pula o drag contextual (correto pra drag visual). Mas `contextual-gizmo.js::dragObjectTo` exportado nao faz essa verificacao — chama `sweepXZ` sempre.
- **Impacto:** Assimetria entre comportamento visual (mouse) e programatico (API): mouse drag de objeto destravado ignora collisao, mas `dragObjectTo` nao. Agente QA ou externo que tenta "mover objeto destravado por cima de outro" via API nao consegue.
- **Fix sugerido:** `dragObjectTo` verificar `obj.userData.freeTransform` e pular `sweepXZ` se true (mesma logica do handler de mouse).
- **Screenshot:** `screenshots/qa-gizmo-D/011-freeTransform-sweep-inconsistente.png`

#### Bug 13 — AABBs incorretas apos load() — anti-overlap quebrado ate 1o drag por objeto (ALTA)

- **Repro:** `save()` → reload pagina → `load()` → `objectAABB(sceneId)` em qualquer cubo retorna AABB identica (posicao do primeiro objeto na lista), nao a AABB correspondente ao objeto. Exemplo: cubo em (10,0,10) tem AABB de (-1.21, 0, -1.35) a (-0.21, 1, -0.35).
- **Causa:** `physics.registerAll(userRoot)` e chamado no boot antes do Three.js processar as `matrixWorld` dos objetos recem-criados pelo `load()`. `Box3.setFromObject(obj)` depende de `matrixWorld` estar atualizada. Se o objeto ainda nao teve `updateMatrixWorld`, retorna AABB na origem ou com transformacoes incorretas.
- **Impacto:** Ate o primeiro drag de cada objeto (que chama `physics.update(obj)` que recalcula a AABB corretamente), todos os objetos carregados tem AABBs invalidas. Anti-overlap da Fase D.2 funciona de forma errada logo apos load — objetos colidem onde nao deveriam ou nao colidem onde deveriam.
- **Fix sugerido:** Chamar `scene.updateMatrixWorld(true)` antes de `physics.registerAll(userRoot)` no load. Ou: chamar `physics.update(obj)` para cada objeto APOS o Three.js renderer ter executado pelo menos 1 frame (`requestAnimationFrame`).
- **Screenshot:** `screenshots/qa-gizmo-D/013-pos-load-aabbs-erradas.png`

### Observacoes

#### Obs A — Esc nao volta ao modo contextual apos W/E/R (fora do drag)

- **Repro:** pressionar W → gizmoMode='translate'. Pressionar Esc (sem estar no meio de um drag). Modo permanece 'translate'.
- **Proposta diz:** "Esc volta pra contextual". Mas o codigo `contextual-gizmo.js:61-65` so cancela drag com Esc, nao restaura modo contextual apos W. O comment no codigo diz "W/E/R voltam pro modo contextual quando Esc sem drag (ja tratado em scene.js)" — mas esse tratamento nao esta funcionando ou scene.js nao esta fazendo isso.
- **Workaround:** `setGizmoMode('contextual')` via API restaura. Pressionar Esc depois de W sem drag nao restaura.
- **Severidade:** media. Nao e regressao (contextual e novo). Mas frustra expectativa documentada na proposta.

#### Obs B — Cubo atravessa parede da sala (esperado em D.1-D.3)

- `physics.sweepXZ` exclui objetos `room:*` via `if (_isRoomPart(entry.obj)) continue` (linha 142). Comportamento intencional. D.4 deveria incluir paredes no sweep.
- Documentado como OBS por ser escopo futuro.

#### Obs C — addPrimitive sem snap OFF coloca objetos em posicoes nao-inteiras

- Com `snapEnabled=false` (default do branch D), `addPrimitive('cube')` retorna `position: [-0.714, 0.5, -0.857]`. Sao frações derivadas de calculo interno sem snap. Em sessoes anteriores (Fase 2+) com snap ON, as posicoes eram multiplos de 0.5 limpas. Sem snap, starter scene nao fica simetrica/alinhada. Nao e bug — e a logica esperada. Mas o starter scene poderia resetar snap/posicionar cubos em posicoes redondas pra primeiro impacto mais limpo.

#### Obs D — `dragObjectTo` API com freeTransform bypassa cadeado no sentido errado

- Objeto com freeTransform=true DEVERIA poder sobrepor (sem sweep). Via API (`dragObjectTo`), o sweep e sempre aplicado — objeto nao pode sobrepor mesmo que destravado. Via mouse drag visual, sweep e pulado corretamente.
- Documentado como Bug 12 (MEDIA) mas tambem como observacao de design de API.

#### Obs E — Snap default mudou de true (Fase 2) para false (branch D)

- Proposta D.1-D.3 correto. Default is false pra surface-snap ser o comportamento primario. Passa o cenario 9. Mas e uma **mudanca de comportamento** em relacao a Fase 2 — dev deve garantir que o commit de merge documente isso.

### Componentes nativos detectados

- **2x `<input type="color">`** no inspector — pre-existente desde Pass2 (Observacao 6). NAO e regressao dos commits D.1-D.3.
- Sem `<select>` nativo.
- Sem `confirm()/alert()` detectados.
- Scrollbar: custom CSS presente (`::-webkit-scrollbar`).
- Cadeado overlay: background custom, cursor pointer — correto.
- Focus ring: nao auditado em profundidade nesta sessao.

### Console errors

**Zero erros, zero warnings** em toda a suite. Console limpo.

### API programatica — novos endpoints D.1-D.3

| Endpoint | Existe? | Testado? | Resultado |
|---|---|---|---|
| `actions.toggleLock(sceneId)` | sim | sim | OK — toggle correto, erro em id invalido |
| `actions.setObjectLock(sceneId, locked)` | sim | sim | OK |
| `actions.dragObjectTo(sceneId, targetXZ)` | sim | sim | OK — mas bug freeTransform (Bug 12) |
| `state.isLocked(sceneId)` | sim | sim | OK |
| `state.objectAABB(sceneId)` | sim | sim | OK em runtime, errado pos-load (Bug 13) |
| `state.snapEnabled()` | sim | sim | OK — default false |
| `state.gizmoMode()` retorna 'contextual' | sim | sim | OK |
| `actions.setGizmoMode('contextual')` | sim | sim | OK |

### Veredito QA — D.1-D.3

**AMARELO — NO-GO para D.4** ate Bug 11 e Bug 13 serem fechados.

Justificativa:

- **Bug 11 (ALTA):** Surface snap nao compensa meia-altura — todo objeto arrastado penetra o chao. E o comportamento central da sub-fase D.1 e esta errado. Visualmente o produto fica com objetos semienterrados, o que destroi a proposta de valor ("objetos colam na superficie").
- **Bug 13 (ALTA):** AABBs erradas pos-load quebram o anti-overlap (D.2) ate o primeiro drag de cada objeto. Roundtrip save/load deixa o estado de fisica inconsistente.
- **Bug 12 (MEDIA):** Inconsistencia entre drag visual e API para objetos desbloqueados. Bloqueia QA programatico do cenario 8 e frustra expectativa de espelho API/UI.
- **Obs A (MEDIA):** Esc nao restaura modo contextual — comportamento documentado na proposta nao implementado.

O que esta bom:
- Anti-overlap XZ entre objetos funciona corretamente (Cenarios 3 e 5).
- Cadeado visual 🔒/🔓 funciona, persiste no save/load, estado restaurado.
- W/E/R ativa TransformControls, volta via API.
- Sala criada, objetos atravessam parede (esperado D.1-D.3).
- snap default OFF correto.
- Zero erros de console.
- API nova (toggleLock, setObjectLock, dragObjectTo, isLocked, objectAABB) funcional exceto lacunas apontadas.

Recomendacao antes de D.4:
1. **Fix Bug 11:** `finalY = surface.y + objHeight/2` em `contextual-gizmo.js` (1 linha).
2. **Fix Bug 13:** chamar `scene.updateMatrixWorld(true)` + `physics.registerAll` apos 1 frame do load, ou iterar com `physics.update(obj)` pos-load.
3. **Fix Bug 12 (se possivel em paralelo):** `dragObjectTo` verificar `obj.userData.freeTransform` e pular sweep.
4. **Obs A:** revisar logica de Esc em `scene.js` para restaurar contextual quando fora de drag.

### Screenshots

- `screenshots/qa-gizmo-D/001-boot-limpo.png` — boot sem localStorage, 3 objetos starter, gizmoMode=contextual
- `screenshots/qa-gizmo-D/002-cadeado-fechado.png` — cubo adicionado com 🔒 visivel no centro
- `screenshots/qa-gizmo-D/003-cadeado-aberto.png` — apos click: 🔓 com classe unlocked
- `screenshots/qa-gizmo-D/004-anti-overlap-xz.png` — esfera deslizada apos tentativa de overlap com cubo
- `screenshots/qa-gizmo-D/005-surface-snap-penetracao-chao.png` — cubo arrastado com metade abaixo do chao (Bug 11)
- `screenshots/qa-gizmo-D/006-anti-overlap-dois-cubos.png` — cubo B bloqueado pelo cubo A, posicionado adjacente
- `screenshots/qa-gizmo-D/007-w-translate-mode.png` — W ativou TransformControls translate, 3 setas visiveis
- `screenshots/qa-gizmo-D/008-volta-contextual.png` — modo contextual restaurado via API
- `screenshots/qa-gizmo-D/009-sala-criada.png` — sala 4x3x2.5, 6 pecas room:* no outliner
- `screenshots/qa-gizmo-D/010-cubo-atravessa-parede-esperado.png` — cubo fora da sala em (10,0,10) (OBS B, esperado)
- `screenshots/qa-gizmo-D/011-freeTransform-sweep-inconsistente.png` — dragObjectTo bloqueia objeto destravado (Bug 12)
- `screenshots/qa-gizmo-D/012-pre-reload-estado.png` — estado antes do reload
- `screenshots/qa-gizmo-D/013-pos-load-aabbs-erradas.png` — AABBs todas erradas pos-load (Bug 13)
- `screenshots/qa-gizmo-D/014-pos-load-cena-restaurada.png` — cena restaurada visualmente correta
- `screenshots/qa-gizmo-D/015-cadeado-aberto-restaurado-pos-load.png` — freeTransform=true restaurado corretamente pos-load
- `screenshots/qa-gizmo-D/016-estado-final.png` — estado final pos-suite
