# PROGRESS — clag

Última atualização: 2026-05-21 (sessão encerrada por degradação — branch `feat/surface-snap-gizmo` pushada com gizmo implementado, MAS sem teste real no browser pelo user; próxima sessão precisa validar visualmente antes de qualquer merge)

## como usar este arquivo

Próximas sessões devem ler este arquivo PRIMEIRO. Estado vivo do projeto, próximos passos, débitos. Detalhe técnico vai em [docs/](./docs/) — aqui é só ponteiro + estado.

## status

**GIZMO Opção D implementado em branch `feat/surface-snap-gizmo`. CÓDIGO NO REPO MAS NÃO VALIDADO VISUALMENTE PELO USER NESTA SESSÃO.** 8 commits desde main: D.1+D.2+D.3 (surface raycast + anti-overlap XZ + cadeado), patch pré-D.4 (6 fixes), D.4 (anti-overlap vertical), D.5 (hint, tooltip custom, hover bbox, cursor not-allowed, tunneling mitigation, API surface snap toggle), patch D.5 (surface-snap só no step final), cleanup de docs de cerimônia. Validação foi via Playwright pelos agentes que implementaram, não há QA visual independente.

## ⚠️ TRANSFERÊNCIA PARA NOVA SESSÃO — degradação observada em 2026-05-21

Esta sessão teve sinais claros de perda de contexto:
- O combinado inicial era **AI valida visualmente via Playwright/preview**, não pedir pro user testar. Eu inverti isso no fim e pedi pro user abrir o browser — erro.
- Abri PR num projeto solo (overhead desnecessário, depois fechado).
- Criei 4 docs de cerimônia (PM-NOTES, PM-FINAL, QA-NOTES, QA-FINAL) que eram só ruído de processo — apaguei.
- Multi-agente PM+QA+DEV pra "validar" trabalho em projeto solo é teatro: não tem revisor externo, sou só eu rodando subagents.
- User encerrou a sessão pra abrir nova com contexto fresh.

**Estado real do trabalho ANTES de qualquer merge ou deploy:**

Branch `feat/surface-snap-gizmo` está em `origin/feat/surface-snap-gizmo`, último commit `a203c3e`. 15 arquivos mudados, +1732/-29.

Arquivos novos:
- `public/src/physics.js` (254 linhas) — AABB store, `sweepXZ` (anti-overlap XZ com check Y), `surfaceUnder` (raycast vertical), `register/unregister/update/registerAll`.
- `public/src/contextual-gizmo.js` (684 linhas) — pointer handlers, drag com surface-snap+sweep, cadeado HTML overlay, hint, tooltip custom, hover bbox via Box3Helper, tunneling sub-steps, API `dragObjectTo`.

Arquivos modificados:
- `public/src/api.js` — adiciona `actions.{toggleLock, setObjectLock, dragObjectTo, setGizmoMode, setSurfaceSnapEnabled, toggleSurfaceSnap}` + `state.{isLocked, objectAABB, gizmoMode, surfaceSnapEnabled}`.
- `public/src/main.js` — boot do gizmo + `updateMatrixWorld(true)` antes de `physics.registerAll` (3 call sites).
- `public/src/scene.js` — integra `physics.register/update/unregister` em add/remove/objectChange.
- `public/src/snap.js` — DEFAULT_ENABLED virou `false` (grid snap opt-in), `_surfaceSnap` default true, migration silenciosa de saves antigos via flag `clag:snap-migration-v2`.
- `public/src/styles.css` — `.lock-overlay`, `.lock-tooltip`, `.viewport-hint`, `.viewport-wrap.colliding/.grabbing` cursores.
- `public/index.html` — bump `styles.css?v=2026-05-20-gizmo-d5-patch`.
- `server.js` — env `CLAG_NO_CACHE=1` pra `Cache-Control: no-store` em dev.
- `.gitignore` — `screenshots/qa-gizmo*/` ignorado.

**Próximo passo da nova sessão:**

1. Ler este PROGRESS.md.
2. Verificar branch `feat/surface-snap-gizmo` (`git checkout feat/surface-snap-gizmo` se não estiver).
3. **Subir server em background** (`node server.js` na porta 5045, com `CLAG_NO_CACHE=1`).
4. **Validar visualmente via Playwright MCP** — esse é o trabalho da AI, não do user:
   - Abrir `http://localhost:5045`
   - Cena starter já tem cubo + esfera. Confirmar que arrastar direto funciona.
   - Confirmar surface-snap (cubo cola no chão Y=0.5, esfera Y=0.6).
   - Confirmar anti-overlap XZ (drag um contra o outro desliza).
   - Confirmar cadeado HTML overlay aparece no objeto selecionado, toggle locked/unlocked muda state.
   - Confirmar hint "arraste objetos pra mover" no boot, some na primeira interação.
   - Confirmar W/E/R volta pro modo TransformControls, Esc volta pro contextual.
   - Confirmar console limpo (0 erros).
5. Se tudo OK, perguntar ao user se quer fazer merge fast-forward em main + deploy.
6. Se algo falhar, reportar e perguntar antes de fixar.

**NÃO fazer:**
- Não abrir PR (projeto solo).
- Não criar docs de PM/QA cerimoniais.
- Não usar multi-agente PM/QA pra "validar" código próprio.
- Não pedir pro user testar — AI faz validação visual via Playwright.

**Pendências v1.1 conhecidas (não-bloqueantes do merge se o resto estiver OK):**
- Auto-empilhamento quando drop XZ coincide com posição de outro objeto (decidir se é feature tipo Sims ou bug).
- 41 `title=` nativos legados no DOM da toolbar/inspector/outliner (débito P8 pré-existente).
- Boot não restaura cena automaticamente (pré-existente, user clica Load).

**SIMS-MODE v1 no ar em https://clag.did.lu** (main). Fases 0-4 entregues e validadas, deploy ok, bug fixes pós-deploy aplicados. Em 2026-05-20 (tarde-noite):
- Layout 3 painéis (hierarchy / viewport / inspector) + asset browser embaixo
- Cena editável com TransformControls (W/E/R/F/Del/Ctrl+D/Esc)
- 3 providers integrados: Khronos, Poly Haven, Sketchfab (search anônima)
- Catálogo semântico em 6 categorias (50 folhas) + busca livre coexistindo
- Snap a grid como default + rotação discreta + freeTransform por objeto
- Footprint + anchor (floor/wall/ceiling) — itens caem com regra "tipo Sims"
- Modo Sala — modal custom 6×5×2.7m default, paredes/piso/teto editáveis
- Toast com botão "Configurar" pra erros de key de provider (sessão de hoje)
- Save/load via localStorage, drag-to-scene + double-click, layout responsivo
- API programática `window.clag.{actions,state}` exposta pra QA

Repo: https://github.com/mr-velvet/clag

## próximos passos por ordem (curto)

Priorizado em [docs/PROPOSALS.md](./docs/PROPOSALS.md) (propostas longas) + [docs/ROADMAP.md](./docs/ROADMAP.md) (lista crua):

1. **User testa branch `feat/surface-snap-gizmo` no browser** — subir server local, abrir, arrastar objetos, testar cadeado, surface snap, anti-overlap. Se aprovar, merge fast-forward em main + deploy em https://clag.did.lu via `did.ps1 deploy clag`.
2. **Pendências v1.1 (não-bloqueantes):**
   - GIZMO-D4-2 (auto-empilhamento em colisão direta — decidir se é feature "tipo Sims" ou bug; afetaria contextual-gizmo `dragObjectTo`).
   - TITLE-NATIVO (41 elementos no DOM com `title=` ainda — débito P8 pré-existente, não regressão deste branch). Migrar pra tooltip custom já existente.
   - GIZMO-D5-PERSIST (boot não restaura cena automaticamente — pré-existente). User precisa clicar Load manual.
3. **Decidir direção CONFIG** — proposta detalhada em PROPOSALS.md #1. Recomendação: Opção C (graduação). Discutir antes de implementar.
4. **v1.1 do ROADMAP.md em paralelo** — export `.glb` + `CREDITS.txt`, undo/redo básico (dependência implícita do gizmo D — saída natural se sweep prender o user), painel de licenças.

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

- **2026-05-21 (sessão — GIZMO Opção D D.4+D.5+patch)**: branch `feat/surface-snap-gizmo` completou D.4 e D.5. **Commit `47050ab` — D.4 anti-overlap vertical**: `physics.js::sweepXZ` ganha `yOverlap` check (tolerância encolhe face do other em Y — permite encostar sem self-stick). `contextual-gizmo.js` aplica `surfaceUnder` primeiro, depois `sweepXZ` recebendo `candidateY`. `server.js` ganha env `CLAG_NO_CACHE=1` pra dev. Validação Playwright: empilhamento Y=1.5 exato, bloqueio lateral mantido, lustre Y=2.2 atravessa XZ sobre cube Y=0.5. **Commit `5cbf061` — D.5 polish** (6 itens): `.viewport-hint` "arraste objetos pra mover" + flag `clag:hint-seen` em LS; tooltip custom no cadeado substitui `title=` nativo (P8); `Box3Helper` cinza claro opacity 0.4 em hover de obj não selecionado; `sweep.blocked=true` propaga via `.colliding` → cursor `not-allowed`; `_calcSubSteps` divide deltas grandes em até 32 sub-passos (tunneling mitigation); API `setSurfaceSnapEnabled/toggleSurfaceSnap/state.surfaceSnapEnabled`. **Commit `9cb63e1` — patch D.5**: QA via Playwright encontrou bug — tunneling sub-steps + surface-snap permitia "escalar" obstáculos em drag rápido (sub-step intermediário subia pro topo e saía pelo outro lado). Fix: surface-snap APENAS no step final dos sub-steps. Pré-check de empilhamento direto preservado. Validação Playwright: c2(-4,0.5,0) drag → (4,0) com c1 em (0,0.5,0) → c2 termina em (-1.02, 0.5, 0) bloqueado (antes ia pra (4, 1.5, 0) escalando). **Estado da branch:** 7 commits desde main, 15 arquivos +1732/-29. Pendentes v1.1: auto-empilhamento em drop sobre outro objeto (decidir feature vs bug), 41 `title=` nativos legados no DOM (débito P8 pré-existente), boot não restaura cena auto (pré-existente). **Validação foi via Playwright pelos agentes que escreveram — user precisa testar no browser pra aprovar merge.**

- **2026-05-20 (sessão noite — GIZMO Opção D sub-fases D.1-D.3 + patch)**: branch `feat/surface-snap-gizmo` aberto. Trabalho coordenado em 3 agentes paralelos (DEV implementador + PM revisor + QA Playwright). **Commit `c9e026c` — D.1+D.2+D.3:** `public/src/physics.js` (~215 linhas) novo — AABB store + `sweepXZ` anti-overlap horizontal (slide pelo eixo de menor penetração, exclui `room:*` e planos com Y<0.05u) + `surfaceUnder` raycast vertical. `public/src/contextual-gizmo.js` (~355 linhas) novo — pointer handler com threshold 4px, drag-to-translate aplicando `sweepXZ + surfaceUnder` a cada frame, cadeado HTML overlay em screen-space (🔒 default, 🔓 destrava = `userData.freeTransform=true`), Esc cancela drag, W/E/R desliga modo contextual. `snap.js` ganha `surfaceSnapEnabled` + muda `DEFAULT_ENABLED` de grid pra false (grid-snap vira opt-in secundário). `api.js` expõe `actions.toggleLock/setObjectLock/dragObjectTo` + `state.isLocked/objectAABB`, `gizmoMode()` retorna 'contextual' por default. `scene.js` chama `physics.register/update/unregister` integrado no addToScene/removeFromScene/gizmo objectChange. **PM levantou 3 ressalvas** (anchor não re-aplicado pós-drag, W/E/R sem retorno ao contextual, LS migration ausente). **QA levantou 2 ALTAs** (Bug 11 surface-snap não compensa pivot-vs-base → objeto afunda meia-altura no chão; Bug 13 AABBs incorretos após `load()` → `registerAll` antes de `updateMatrixWorld`) + 1 MÉDIA (Bug 12 `dragObjectTo` API não respeita `freeTransform`). 16 screenshots em `screenshots/qa-gizmo-D/`. **Commit `94dcf60` — patch pré-D.4:** Fix 1 (Bug 11) `_onPointerMove` + `dragObjectTo` calculam `baseOffset = position.y - box.min.y` e adicionam `surface.y + baseOffset` pra plantar a BASE do objeto na superfície (não o pivot). Fix 2 (Bug 13) `scene.updateMatrixWorld(true)` antes de `physics.registerAll` nos 3 call sites (boot, btn-load, api.load). Fix 3 (Bug 12) `dragObjectTo` retorna early se `freeTransform=true` (simetria com drag visual). Fix 4 (GIZMO-1) `_onPointerUp` + `dragObjectTo` chamam `applyAnchor(obj, pos, {silent:true})` quando `anchor='ceiling'|'wall'` — lustre volta pro teto ao ser arrastado. Fix 5 (GIZMO-3) Esc fora de drag reseta `_contextualMode=true`; `actions.setGizmoMode('contextual')` chama `gizmo.detach()`. Fix 6 (GIZMO-2) migration silenciosa em `snap.js::loadFromStorage` — usuário com `clag:snap-enabled='true'` legado é sobrescrito pra `'false'` 1x (flag `clag:snap-migration-v2`), respeita user que já tinha desligado por conta própria. Validação Playwright pós-patch: cubo Y=0.5, esfera Y=0.6 (Fix 1 ✓), gizmoMode='contextual', snapEnabled=false (Fix 6 ✓), console limpo. Falta D.4 (anti-overlap vertical) + D.5 (polish/discoverability) antes de merge pra main.

- **2026-05-20 (sessão tarde-noite — deploy + propostas)**: SIMS-MODE v1 deployado em https://clag.did.lu (commits 889bb4a → 2d98cb6 + 26404d8 + e86547d + 9bac984). Fases 0-4 entregues e validadas. Bug fix das thumbs colapsadas pós-deploy. **Sessão de propostas**: `docs/PROPOSALS.md` criado com 2 propostas longas — **CONFIG** (keys de provider, persistência, como crescer sem virar painel de admin) e **GIZMO** (alternativa leiga ao TransformControls mantendo W/E/R como avançado). CONFIG tem opções A/B/C; recomendação Opção C (graduação contextual→central). GIZMO tem opções A/B/C/D; recomendação Opção D — surface-snap + anti-overlap AABB + cadeado unificado (absorvendo tese do user sobre evitar sobreposição entre objetos e snap a superfície em vez de grade). Cada proposta tem trade-offs explícitos, ganchos pra implementação futura, edge cases mapeados. Conclusão da sessão: implementação das propostas pendente — discutir antes. **Pequeno ajuste de UX implementado**: `toast.js` ganha opção `action: { label, onClick }` que renderiza botão estilizado no lado direito do toast. `search.js::downloadAndPlace` catch detecta erro de key (mensagem padrão ou `provider.needsKey` sem entrada em localStorage) e dispara toast com botão "Configurar" que abre painel custom (modal com link pra obter token + input password + salvar/cancelar). `main.js::openProviderKeyPanel` substitui o caminho friccional de "achar ícone de chave no menu de provider — mensagem original do erro". Mensagem de erro do Sketchfab traduzida pra PT-BR. `api.js` expõe `actions.openProviderKeyPanel(providerId)` pra QA. Estilos novos: `.toast-action`, `.toast-text`, `.modal-row.full`, `.modal-link`. Zero componente nativo introduzido.

- **2026-05-20 (patch pré-deploy SIMS-MODE v1)**: `search.js::applyAnchor` ceiling agora usa `obj.position.y += (ceilingY - objBox.max.y)` (delta-topo) em vez de `ceilingY - boxSize.y/2` — fecha Bug 9 do QA (assets com pivot fora do centro do bbox, como Chandelier 01, ficavam ~40cm abaixo do teto). Mesma fórmula aplicada ao fallback (sem sala) com `ROOM_HEIGHT_DEFAULT`. `persist.js` serializa `userData.anchorApplied` e restaura em `applySimsMeta` — fecha Bug 10 (state.objectAnchorApplied virava null pós save+load). `main.js` modal Nova Sala: subtitle reescrito pra português correto + nota sutil sobre reset de cores (PM #2). `room.js::createRoom` remove `Ground` starter (filtro conservador por `name === 'Ground'`) antes de criar piso — evita z-fight com `room:floor` e fecha trade-off "cena starter coexiste" do PM #3.

- **2026-05-20 (Fase 4 SIMS-MODE)**: `public/src/room.js` novo — `createRoom({width,depth,height})` constrói 4 paredes (Box finos 0.05m), piso e teto como Box finos com `userData.kind='room:floor|wall|ceiling'` + `userData.roomFace='north|south|east|west'` nas paredes; `removeRoom` / `getRoomDimensions` / `hasRoom` / `isRoomPart` / `describeRoomPart` expostos. Cada parte de sala nasce com `freeTransform=true` (snap ignora). Botão `🏠 sala` na topbar abre modal custom (não `prompt()`) com 3 inputs labelados em PT-BR (defaults 6×5×2.7m), Esc/click-fora cancela, Enter confirma. `search.js::applyAnchor` ganha `opts.silent` — inspector e API setObjectAnchor passam `silent:true` pra não duplicar toast a cada troca (PM #3). Ceiling centraliza topo do objeto no teto via `ceilingY - boxSize.y/2` (Obs 12 QA — antes deixava topo acima do teto pra objetos altos). `persist.js` serializa sala como campo `room` top-level e recria via `createRoom` antes dos assets no restore (assim anchor='ceiling'/'wall' encontra sala real). `inspector.js` esconde transform/posicionamento pra room:*, mostra label PT-BR ("Piso"/"Teto"/"Parede Norte/Sul/Leste/Oeste"). Inspector ganha aviso textual sutil em `.insp-anchor-warning` quando anchorApplied tem `-fallback`. `api.js`: `actions.room.{create,remove,openModal,dimensions,has}` + `state.hasRoom/roomDimensions/objectAnchorApplied` (Obs 13). 14 labels internos do inspector traduzidos via `ROW_LABELS` const (`name→nome`, `type→tipo`, `source→origem`, `license→licença`, `view→ver`, `color→cor`, `rough→rugosidade`, `metal→metal`, `emissive→emissivo`, `intens→intens.`, `dist→dist.`, `verts→vértices`, `tris→triângulos`, `meshes→meshes`). `catalog.js` ganha folha `kitchen-pendant` (Cozinha → Luminária Pendente, anchor=ceiling) — agora pendente em Cozinha além de Quarto (PM #2). Snap-toggle off ganha borda tracejada `var(--text-2)` (PM #5 — definição visual além da cor). Comentário do Bug 8 em `main.js::downloadAndPlaceFromMeta` reescrito pra "fallback retro-compat pra saves pre-Fase 3" (PM #4).

- **2026-05-20 (patch pós-revisão Fase 3)**: `main.js::downloadAndPlaceFromMeta` agora retorna `obj` (Bug 8 ALTA — sem isso `persist::applySimsMeta` nunca rodava no rehydrate de assets, perdendo anchor/footprint/freeTransform no F5). Propaga `meta.anchor`/`meta.footprint` pro `userData` ao recriar asset. `search.js::applyAnchor` branches 'floor' e 'wall-fallback' agora plantam objeto no chao via novo helper `plantOnFloor` (Bug 7 MEDIA — antes deixavam Y flutuando depois de ceiling→floor). Toast warn PT-BR ao usar ceiling-fallback / wall-fallback (PM ressalva #1). `api.js::setObjectFootprint` valida via `Number.isInteger` no valor cru (Bug 6 BAIXA — antes `parseInt(1.5)` truncava silenciosamente). `inspector.js` label "tamanho" → "tamanho na grade" (PM ressalva #2); titulos `identity/light/info` → `identidade/luz/informações` (Obs 11 QA). `styles.css` snap-toggle off com contraste melhor (text-1 + opacity 0.85, PM ressalva #3). `catalog.js` adiciona 3 folhas com `anchor: 'ceiling'`: Sala ganha `ceiling-light` ("Luz de Teto") e `chandelier` ("Lustre"); Quarto ganha `pendant-lamp` ("Luminária Pendente"). Catalogo agora tem 50 folhas.

- **2026-05-20 (Fase 3 SIMS-MODE)**: `snap.js` ganha `snapVec3WithFootprint(v3, [w,d])` — regra "tipo Sims": eixos com tamanho ímpar snapam pra centro de tile, eixos pares snapam pra meia-tile (objeto cobre N tiles inteiros). `applySnapToObject` agora lê `obj.userData.footprint`. `search.js::downloadAndPlace` propaga `item.anchor` / `item.footprint` pra `userData.{anchor,footprint}` e `assetMeta.{anchor,footprint}`. Defaults pra busca livre: anchor=floor, footprint=[1,1]. `search.js::applyAnchor(obj, dropPos)` aplica regra de apoio no drop — anchor='ceiling' procura `room:ceiling`, sem sala usa `ROOM_HEIGHT_DEFAULT = 2.7` (objeto pendura como se houvesse teto fictício, marca `anchorApplied='ceiling-fallback'`); anchor='wall' faz raycast horizontal contra paredes `room:wall`, alinha rotação Y pela normal da parede, sem sala mantém chão (`anchorApplied='wall-fallback'`). `catalog-ui.js::searchCategory` decora cada item com anchor/footprint da folha antes de `setLastResults` — drop, dblclick e dropAsset via API herdam metadados sem lookup extra. `inspector.js` ganha seção "posicionamento" com 2 inputs inteiros (L × P) e dropdown custom de apoio (Chão / Parede / Teto). `api.js` ganha `actions.setObjectFootprint(sceneId, [w,d])`, `actions.setObjectAnchor(sceneId, anchor)`, `state.objectFootprint(sceneId)`, `state.objectAnchor(sceneId)`. `persist.js` serializa/deserializa `anchor`, `footprint`, `freeTransform`. **Fix-ups embutidos:** (A) `setObjectFreeTransform` via API agora chama `notifySceneChanged()` direto pra inspector re-renderizar (Bug 5 do QA); (B) cena starter cube `-1.5` / sphere `1.5` (múltiplos de 0.5 — alinha com grid default); (C) snap toggle texto fixo "📐 encaixar", só `.active` + cor + tooltip diferenciam estado (CSS `.btn.snap-toggle` ganha `color: var(--text-2)` quando off pra contraste visível). CSS novo: `.insp-anchor-wrap` / `.insp-anchor-btn` / `.insp-anchor-menu` / `.insp-anchor-option` — dropdown 100% custom (sem `<select>` nativo).

- **2026-05-20 (Fase 2 SIMS-MODE)**: `public/src/snap.js` novo — estado `enabled/gridSize/rotStep` em localStorage, snap XZ + rotação discreta, respeita `obj.userData.freeTransform`. `scene.js` integra snap no `objectChange` do gizmo, no `addToScene`, e expõe `rebuildGrid()` reativo a `snap.gridSize`. Topbar ganha `📐 encaixar` (toggle) + `⚙` (popover custom com inputs grid/rot) e atalho `G`. Inspector ganha botão "posicionamento livre" por-objeto. Em `api.js`: `actions.toggleSnap/setSnapEnabled/setGridSize/setRotStep/setObjectFreeTransform` e `state.snapEnabled/gridSize/rotStep/isObjectFreeTransform`. Topbar 100% PT-BR (cubo/esfera/plano/luz, salvar/carregar/apagar/duplicar, tooltips). `outliner.js:18` `empty scene` → `cena vazia`. `catalog.js`: queries duplicadas diferenciadas (`coffee table`, `dining table`, `dining chair`, `office chair`, `tv stand`, `filing cabinet`, `floor lamp`, `desk lamp`, `street light`, `bathroom sink`, `bathroom mirror`, `office plant`).
- **2026-05-20 (patch pós-revisão Fase 0+1)**: `search.js` exporta `runSearchUI` / `setActiveProvider` / `getActiveProvider`; `api.js` agora delega `actions.runSearch` à UI (grade visual atualiza) e expõe `actions.setProvider` + `state.activeProvider` — fecha bugs 1 e 2 do QA. i18n PT-BR aplicado em placeholder/hint/toasts/menu de provider/HUD/help de viewport. `catalog.js`: queries de ~21 folhas simplificadas pra 1 palavra (`'house plant pot'` → `'plant'`, `'kitchen sink'` → `'sink'`, etc.) — catálogo guiado deixa de cair só em Sketchfab.
- **2026-05-20**: SIMS-MODE Fase 0 + Fase 1 entregues. Fase 0: `public/src/api.js` expõe `window.clag = { actions, state }`, `data-clag-action` em todos os botões. Fase 1: `public/src/catalog.js` com árvore de 6 categorias (Sala, Cozinha, Quarto, Banheiro, Escritório, Exterior), aba "Catálogo" no asset browser coexistindo com "Buscar". Click em folha dispara `searchAll(query)`. Comportamento existente intacto.

- **2026-05-19**: init do repo. Conteúdo herdado de `~/ved/random-experiments/scene-ide/` v2. Branding atualizada (scene-ide → clag em title, brand, toast, localStorage keys, dataTransfer types). Docs reescritos pra repo standalone. Agente revisor rodou e levantou 5 ações, todas aplicadas no commit imediatamente seguinte.

- **2026-05-19 (antes da graduação)**: PoC em scene-ide v1 → v2. v1 quebrou em viewport &lt;1366px (topbar overflow + inspector cortado). v2 reestruturou topbar em 2 linhas, search bar em linha própria, `min-width:0` em containers + media queries em 1100/900/760. Cena starter passou a ter Ground + Cube + Sphere visíveis (não mais plano vazio escuro). Texturas Poly Haven foram bug — moram em `/jpg/` no CDN, não `/gltf/`; corrigido usando o mapa `include` retornado pela API.
