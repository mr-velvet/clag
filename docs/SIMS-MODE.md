# SIMS-MODE — plano

> **Status:** documento ativo, em execução. Iniciado em 2026-05-20.
> **Goal name:** `filosofia 'the sims' no editor da ferramenta, permitindo a busca de items e posicionamento tal qual mudança de posição e ajuste facil como 'the sims'`

Este documento é a **fonte de verdade** pros 3 agentes (DEV, PM, QA UX) trabalhando em paralelo. Leia inteiro antes de qualquer ação. Atualize ao final de cada fase.

---

## Missão (uma frase)

clag vira **ferramenta de pré-visualização de cena pra roteiristas e equipes de narrativa** — pessoa não-técnica monta locação + adereços (e, no futuro, personagens) pra ensaiar movimentação narrativa, e exporta a cena pra equipes técnicas finalizarem em motor de jogo / animação.

## O que "tipo The Sims" significa aqui

**Inclui (referência forte):**
- Posicionamento de objetos com **snap a grid** como padrão
- Rotação em **passos discretos** (15°/45°/90°)
- Objetos têm **footprint** (ocupam tiles) e **âncora** (chão, parede, teto)
- Navegação por **catálogo categorizado** (Sala / Cozinha / Quarto / Decoração / Plantas / Iluminação...) — não só busca livre
- Câmera com modo top-down/iso confortável (futuro — não bloqueia v1)

**Não inclui (explicitamente fora):**
- Sims andando, IA, necessidades, simulação de tempo
- Build mode com tijolos / construção de paredes complexa estilo Sims (versão simples sim — sala retangular)
- Curadoria manual de assets — engine continua agnóstica, providers continuam plugins
- Estética cartoon forçada — assets vêm como vêm dos providers

**Princípio fundamental que se mantém:** snap é o **default**, gizmo livre é o **escape hatch** sob 1 clique. 90% dos casos sem ajuste fino.

## Por que isso casa com o produto

Roteirista quer **bloquear cena** ("personagem A senta no sofá, vai até a janela, sai pela porta"). Não precisa de precisão sub-milimétrica — precisa de **velocidade e clareza visual**. Sims é a referência mais reconhecida do mundo de "posicionar coisas dentro de ambiente sem sofrer com 3D."

A cena montada deve ser **exportável (.glb + CREDITS.txt)** pra que outras equipes finalizem em Unity/Unreal/Blender. clag é o **bloco de rascunho** — não o produto final.

---

## Princípios que continuam intactos

(Sem revisitar sem motivo forte — ver `PRINCIPLES.md`.)

1. Zero build step
2. Providers como plugin
3. Licença explícita
4. State explícito via event bus
5. Componentes UI custom (nenhum nativo)
6. Documentar pra IA

**Tudo que existe hoje continua funcionando.** Nada é removido. Toda feature nova é camada por cima.

---

## Camadas a adicionar (em ordem)

### Fase 0 — Infra: hooks programáticos pra QA

**Por que primeiro:** sem isso, QA UX não consegue testar nada sem depender de coordenadas de pixel.

- Todo botão/input/control interativo ganha `data-clag-action="<verb>"` ou id estável
- `window.clag = { actions, state, scene }` exposto em modo dev:
  - `actions.addPrimitive(kind)`, `actions.runSearch(q)`, `actions.selectByName(name)`, `actions.dropAsset(itemId, position)`, `actions.setGizmoMode(mode)`, `actions.save()`, `actions.load()`, `actions.toggleSnap()`, `actions.setRoom({w,d,h})`, etc.
  - `state.selected()`, `state.objects()`, `state.categoryTree()`, `state.snapEnabled()`
- Cada action retorna Promise quando faz IO; resolve com objeto útil pra teste
- Não acoplar testes ao DOM diretamente — usar `window.clag.*`

### Fase 1 — Catálogo semântico

**Tese:** árvore de categorias é **só açúcar de busca**. Cada folha = query pré-formada. Sem curadoria, sem promessa.

- Arquivo novo: `public/src/catalog.js` exporta árvore JSON:
  ```js
  export const tree = [
    { id: 'living-room', label: 'Sala', children: [
      { id: 'sofa', label: 'Sofá', query: 'sofa couch', anchor: 'floor', footprint: [2,1] },
      { id: 'tv', label: 'TV', query: 'tv television', anchor: 'floor', footprint: [1,1] },
      ...
    ]},
    { id: 'kitchen', label: 'Cozinha', children: [...] },
    ...
  ];
  ```
- UI: aba "Catálogo" ao lado de "Buscar" no asset browser. Tree colapsável. Click numa folha → dispara `searchAll(query)` e mostra resultados na mesma grade.
- Custom UI (nenhum `<select>` nativo, nenhum tree nativo) — coerente com princípio 8.
- **Não bloqueia busca livre.** Os dois fluxos coexistem.

### Fase 2 — Grid + snap como default

- Snap habilitado por padrão. Toggle visível no topbar: `Snap [ON]` / `Snap [OFF]`.
- Grid size configurável (default 0.5u — bom pra interiores). Persistir em localStorage.
- Snap aplica em **drop** (asset cai no tile mais próximo) e em **drag** (mover objeto existente).
- Rotação discreta: ao rotacionar via gizmo com snap ON, snap em 15° (configurável).
- Indicador visual: tile sob cursor destacado durante drag/drop.
- Botão por-objeto "destravar" no inspector: marca `userData.freeTransform = true` → snap ignorado nesse objeto. Permite ajuste fino quando precisa.
- **Mantém atalhos W/E/R, mantém TransformControls.** Snap intercepta o `objectChange` event e arredonda.

### Fase 3 — Footprint + ancoragem por categoria

- Cada item do catálogo declara:
  - `footprint: [w, d]` (em tiles) — opcional, default [1,1]
  - `anchor: 'floor' | 'wall' | 'ceiling'` — opcional, default 'floor'
- No drop, engine:
  - Calcula posição base via raycast (já faz)
  - Se anchor='ceiling', sobe pra altura da sala
  - Se anchor='wall', faz raycast contra paredes da sala (se houver) e cola; sem sala, mantém comportamento atual
  - Snap leva footprint em conta (ex: 2×1 alinha pelos 2 tiles, não pelo centro)
- Inspector ganha mini-seção "Posicionamento":
  - Footprint editável (numero numero)
  - Anchor (dropdown custom)
  - Toggle "destravar" (livre)
- Assets de busca livre que **não vêm do catálogo** entram com defaults. User pode editar.

### Fase 4 — Modo Sala (opcional, mas central pra UX)

- Botão "Nova Sala" no topbar. Modal custom (não `prompt()`): largura × profundidade × altura em metros. Default 6×5×2.7.
- Cria 4 paredes + piso como objetos especiais (`userData.kind = 'room:wall'` / `'room:floor'`). Selecionáveis, têm material editável (cor/textura).
- Snap pra grid alinha com cantos da sala.
- Wall-anchored items (quadro, janela, prateleira) usam paredes pra cola.
- **Cena vazia continua funcional sem sala** — sala é opcional.
- Sem build/buy mode separado por enquanto — só botão "Nova Sala" ao lado dos add-primitive.

### Fase 5 (futuro, não compromete) — Câmera Sims-like

- Toggle "Câmera de cena" → vista isométrica rotacionável em 8 passos, altura ajustável, cut-away de paredes próximas da câmera
- Não bloqueia v1 do Sims-mode

---

## O que **não** muda

- `scene.js` continua dono dos singletons three.js e event bus
- Providers continuam plugins isolados
- Persist continua salvando em JSON via localStorage
- Search livre continua funcionando exatamente como hoje
- Todo atalho de teclado atual continua válido
- Inspector atual continua — ganha seções, não perde

---

## Estrutura de arquivos prevista

```
public/src/
  catalog.js          ← NOVO: árvore semântica
  snap.js             ← NOVO: lógica de snap (grid + rotação discreta)
  room.js             ← NOVO: criação de sala + ancoragem em paredes
  api.js              ← NOVO: window.clag.* pra testes
  search.js           ← MODIFICADO: tabs Buscar/Catálogo
  inspector.js        ← MODIFICADO: seção Posicionamento
  scene.js            ← MODIFICADO: snap hook no gizmo objectChange
  main.js             ← MODIFICADO: wire dos novos botões
  primitives.js       ← MODIFICADO: addRoom()
  styles.css          ← MODIFICADO: estilos tab, tree, snap toggle
```

---

## Plano de execução por agentes

### Agente DEV

**Responsabilidade:** implementação. Trabalha fase a fase. Após cada fase: commita, pinga PM e QA pra revisar, espera ok antes de seguir.

**Regras:**
- Sem build step novo. Sem dependência externa nova (exceto via `importmap` se inevitável)
- Cada PR/commit pequeno e focado numa fase
- Nada de `<select>` nativo, `confirm()`, etc. Princípio 8 vale
- Toda nova ação UI tem hook em `window.clag.actions`
- Atualiza `PROGRESS.md` e este `SIMS-MODE.md` ao terminar cada fase
- Pode rodar `npm start` (Express na 5045) localmente pra fumaça antes de commitar

### Agente PM (guardião da missão)

**Responsabilidade:** garantir que cada mudança alinha com a tese.

**Regras:**
- Lê este doc + a missão de uma frase antes de qualquer revisão
- Pergunta toda vez: **"isso facilita o roteirista não-técnico montar cena rápido?"**
- Sinaliza desvios: complexidade desnecessária, feature além do escopo, jargão que confunde leigo, fluxo que exige conhecimento técnico
- Sugere ajustes em formato actionable (linha → linha; "rotular X em vez de Y"; "esconder Z atrás de um toggle")
- Posta o veredito como comentário na task (alinha / desvia / sugere)
- **NÃO escreve código** — orienta

### Agente QA UX

**Responsabilidade:** valida na prática que tudo funciona via UI e via API programática.

**Regras:**
- Sobe app local (`npm start` na 5045 ou `python -m http.server` na `/public`)
- Usa Playwright MCP pra navegar
- Testa: cada botão clicável; cada fluxo end-to-end (busca → drag → drop com snap; catálogo → click → drag → drop; etc.)
- **Crítico:** testa via `window.clag.actions.*` que tudo é acionável programaticamente — relata se algum botão só funciona via click humano
- Tira screenshots em momentos-chave
- Reporta achados como notas estruturadas: o que funcionou / o que quebrou / o que confundiu / sugestão
- **NÃO escreve código de produção** — escreve teste e reporta

---

## Definição de pronto (DoD) por fase

- DEV: código commitado + push, dev server roda sem erro de console, fase entregue conforme escopo acima
- PM: revisou e aprovou (ou pediu ajuste explícito)
- QA UX: testou via Playwright, screenshot anexado, lista de achados publicada, todos os achados endereçados ou reconhecidos

**Só passa pra próxima fase quando os 3 dizem ok.**

---

## Como atualizar este documento

Ao final de cada fase, agente DEV adiciona seção `## Histórico` lá embaixo com:
- Data
- Fase entregue
- Resumo de mudança (1-3 linhas)
- Links pra commits

---

## Histórico

- **2026-05-20:** documento criado. Tasks 1-9 abertas no tracking. Agentes DEV, PM, QA UX disparados.
- **2026-05-20 — Fase 0 entregue (DEV):** `public/src/api.js` criado expondo `window.clag = { actions, state, on }`. Wraps cobrem addPrimitive, gizmo mode, selecao, save/load, runSearch, dropAsset, toggle de paineis, delete/duplicate. `data-clag-action` adicionado em todos os botoes interativos de `index.html` (sem remover ids). `search.js` agora exporta `getLastResults/setLastResults/downloadAndPlace` pra api reusar lastResults da UI. Zero mudanca de comportamento — so superficie programatica nova.

- **2026-05-20 — Fase 1 entregue (DEV):** `public/src/catalog.js` exporta arvore com 6 categorias (Sala, Cozinha, Quarto, Banheiro, Escritorio, Exterior) totalizando 47 folhas; cada folha tem `query`, `anchor`, `footprint`. `public/src/catalog-ui.js` renderiza arvore colapsavel + grade de results, reusando o mesmo `downloadAndPlace` e `setLastResults` de `search.js` (drop e double-click funcionam igual). Tabs "Buscar" e "Catalogo" no header do bottom panel, coexistencia preservada — aba Buscar fica default. `window.clag.actions.catalog.{tree,leaves,getLeaf,searchCategory,expand,collapse,expanded,showTab}` exposto. Componentes UI todos custom (button-based tabs, button-based tree — sem `<select>` nativo).

- **2026-05-20 — Fase 3 entregue (DEV):** `snap.js` ganha `snapVec3WithFootprint(v3, [w,d])` — eixo de tamanho ímpar snapa pra centro de tile, eixo par snapa pra meia-tile (objeto cobre N tiles inteiros, regra "tipo Sims"). `applySnapToObject` consome `obj.userData.footprint`. `search.js::downloadAndPlace` propaga `item.anchor` / `item.footprint` pra `userData.{anchor,footprint}` e `assetMeta.{anchor,footprint}` (defaults pra busca livre: floor, [1,1]). `search.js::applyAnchor(obj, dropPos)` aplica apoio no drop: ceiling cola Y na altura do `room:ceiling` ou em `ROOM_HEIGHT_DEFAULT=2.7` (fallback sem sala — marca `anchorApplied='ceiling-fallback'`); wall faz raycast horizontal contra `room:wall`, alinha rotação Y pela normal, sem sala mantém chão (`anchorApplied='wall-fallback'`). `catalog-ui.js::searchCategory` decora resultados com anchor/footprint da folha antes de `setLastResults` — drop/dblclick/dropAsset via API herdam metadados sem lookup. `inspector.js` ganha seção "posicionamento" com inputs L × P (footprint) + dropdown custom de apoio (Chão/Parede/Teto). `api.js`: `setObjectFootprint`, `setObjectAnchor`, `objectFootprint`, `objectAnchor`. `persist.js` serializa/deserializa anchor/footprint/freeTransform. **Fix-ups no mesmo commit:** (A) `setObjectFreeTransform` API chama `notifySceneChanged()` direto (Bug 5 QA); (B) cena starter cube -1.5 / sphere 1.5 (alinha com grid 0.5); (C) snap toggle texto fixo "📐 encaixar" — só `.active` + cor + tooltip diferenciam (CSS contraste off→cinza). Decisão de design: ceiling fallback 2.7m permite o user já trabalhar com armários de teto antes da Fase 4 existir — engine não trava. Wall raycast sem sala cai pra chão silenciosamente — não trava, mas marca `anchorApplied` pra UI futura mostrar warning. Dropdown de apoio 100% custom (button + popup, fecha clicando fora) — zero `<select>` nativo introduzido.

- **2026-05-20 — Fase 4 entregue (DEV):** `public/src/room.js` novo — `createRoom({width,depth,height})` constrói 4 paredes (Box finos 0.05m), piso e teto (Box finos 0.02m) como `userData.kind='room:wall|floor|ceiling'`. Paredes ganham `roomFace='north|south|east|west'` (sul=+Z, norte=-Z, leste=+X, oeste=-X). Cada parte nasce com `freeTransform=true` pra snap ignorar. `removeRoom` / `getRoomDimensions` / `hasRoom` / `isRoomPart` / `describeRoomPart` expostos. Topbar ganha `🏠 sala` que abre modal custom 100% (não `prompt()`) — 3 inputs PT-BR (largura/profundidade/altura em metros, defaults 6×5×2.7), Esc/click-fora/cancelar fecha, Enter confirma. Modal pre-preenche com dimensões atuais se já há sala (facilita "editar"). `search.js::applyAnchor` ganha `opts.silent` — quando true suprime toast de fallback. Inspector e `api.js::setObjectAnchor` chamam com `silent:true` (PM #3 fechado). Ceiling agora centraliza topo do objeto no teto via `ceilingY - boxSize.y/2` em vez de `ceilingY - boxSize.y` (Obs 12 QA — Chandelier 01 com altura significativa antes vazava acima do teto virtual). `persist.js` serializa sala como campo `room` top-level (mais simples que serializar 6 mesh `room:*` na lista). Restore recria sala via `createRoom(saved.room)` antes de rehidratar assets — anchor='ceiling'/'wall' encontra `room:ceiling`/`room:wall` reais sem cair em fallback. `inspector.js` esconde transform + posicionamento pra `room:*` (paredes não se editam individualmente — pra alterar, recriar sala); mostra label PT-BR baseado em `userData.kind` + `roomFace` ("Piso"/"Teto"/"Parede Norte/Sul/Leste/Oeste"). Inspector ganha aviso textual sutil `.insp-anchor-warning` quando `anchorApplied` tem `-fallback` (mostra motivo sem disparar toast a cada re-aplicacao). 14 labels internos do inspector traduzidos via `ROW_LABELS` const. `api.js`: `actions.room.{create,remove,openModal,dimensions,has}` + `state.hasRoom/roomDimensions/objectAnchorApplied` (Obs 13). `catalog.js`: nova folha `kitchen-pendant` (Cozinha→Luminária Pendente, anchor=ceiling, query=`pendant lamp`). Snap-toggle off ganha `border-style: dashed` em `var(--text-2)` (PM #5 — definição visual mais forte que só cor/opacidade). Comentário do Bug 8 em `main.js::downloadAndPlaceFromMeta` reescrito como "fallback retro-compat: saves anteriores à Fase 3 não têm anchor/footprint no top-level mas têm em assetMeta — copia daqui pra userData garantir" (PM #4). **Fim do SIMS-MODE.md original** — Fase 5 (câmera isométrica) era do roadmap futuro, fora deste plano.

- **2026-05-20 — Fase 2 entregue (DEV):** `public/src/snap.js` novo expõe `isEnabled/setEnabled/getGridSize/setGridSize/getRotStep/setRotStep/snapVec3/snapAngle/snapEuler/applySnapToObject` + event bus `on('snapChanged')`. Defaults: enabled=true, grid=0.5m, rot=15°. Persistência em `localStorage` (`clag:snap-enabled`, `clag:grid-size`, `clag:rot-step`). Fase 2 snapa só XZ + rotação Euler (Y livre — anchor='ceiling'/'wall' são Fase 3). `scene.js` hook no `gizmo.objectChange` (snap contínuo durante drag — efeito "pula pro tile"), no `dragging-changed=false` (snap final ao soltar), e no `addToScene` (objetos caem snapados). Atalho `G` toggle snap. `rebuildGrid()` reativo: grid 30m × 30m com `divisions = 30/gridSize` (cap 600), opacidade 0.85/0.45 conforme enabled. Topbar ganha `📐 encaixar` (toggle .active) + botão `⚙` que abre popover custom com inputs number (tamanho do grid em m / passo de rotação em °) — popover fecha clicando fora, sem `prompt()`. Inspector ganha botão "posicionamento livre / encaixar na grade" que alterna `obj.userData.freeTransform` (escape hatch granular). API: `actions.toggleSnap/setSnapEnabled/setGridSize/setRotStep/setObjectFreeTransform(sceneId, bool)` e `state.snapEnabled/gridSize/rotStep/isObjectFreeTransform(sceneId)`. Backlog i18n no mesmo commit: topbar 100% PT-BR (cubo/esfera/plano/luz, salvar/carregar/apagar/duplicar, tooltips de mover/rotacionar/escalar e de painéis); `outliner.js` "empty scene" → "cena vazia"; 12 folhas do catálogo com queries genéricas duplicadas viraram queries de 2 palavras (`coffee table`, `dining table`, `dining chair`, `office chair`, `tv stand`, `filing cabinet`, `floor lamp`, `desk lamp`, `street light`, `bathroom sink`, `bathroom mirror`, `office plant`) — trade-off: risco de zero result aceito em troca de evitar colisão semântica entre folhas. Componentes 100% custom — zero `<select>`/`prompt()`/`confirm()` introduzido.
