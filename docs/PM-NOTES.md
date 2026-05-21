# PM-NOTES — clag (Sims-mode)

> Notas vivas do agente PM. Cada revisão posta uma seção nova ao final, com data + commit revisado. PM nao escreve codigo — orienta.

---

## Interpretacao oficial da missao (decorada)

**clag = ferramenta de pre-visualizacao de cena para roteiristas e equipes de narrativa NAO-tecnicas.**

A pessoa monta locacao + adereços para ensaiar movimentacao narrativa e exporta para equipes tecnicas finalizarem em Unity/Unreal/Blender. A referencia "tipo The Sims" eh **so sobre facilidade de posicionar**: snap, grid, footprint, rotacao discreta, catalogo categorizado em portugues. NAO eh sobre Sims andando, IA, necessidades, ou estetica cartoon.

### Pergunta-mestra (toda revisao responde explicitamente)

> "Isso facilita o roteirista nao-tecnico montar cena rapido?"

- **Sim, sem ressalva** → aprova
- **Talvez, mas o fluxo confunde** → sugere ajuste textual especifico
- **Nao, isso eh complexidade que tecnico curte mas leigo nao usa** → sinaliza desvio, propoe alternativa

---

## Criterios de revisao (checklist a aplicar a cada commit)

### A. Linguagem e rotulos (priorizado — onde leigo bate primeiro)

- [ ] Botoes/labels visiveis ao user em **portugues brasileiro**? (codigo segue em ingles — variaveis/funcoes/classes)
- [ ] Zero jargao tecnico exposto: nada de "transform", "vec3", "quaternion", "uniform", "mesh", "raycast", "gizmo"
  - **Substitutos aceitos:** transform → "posicao/rotacao/escala"; gizmo → "manipulador" ou esconder atras de modo; mesh → "objeto"
- [ ] Atalhos W/E/R continuam ativos, mas o user leigo NAO depende deles — botoes visiveis fazem o trabalho
- [ ] Sem ingles e portugues lado a lado pra mesma acao (ex: "rotate" e "rotacionar" duplicados confunde)
- [ ] Tooltip nunca expoe nome tecnico de propriedade three.js

### B. Defaults sensatos (regra-de-ouro do Sims)

- [ ] Snap habilitado por **default** ao subir o app
- [ ] Grid size com default razoavel (0.5u — bom pra interiores) sem o user precisar pensar
- [ ] Rotacao discreta como default (15°/45°/90°) — livre eh escape hatch
- [ ] Drop de asset cai em tile valido sem o user ajustar nada
- [ ] "Destravar" (modo livre por-objeto) existe mas eh **secundario** — botao pequeno no inspector, nao primario

### C. Hierarquia visual

- [ ] Acao principal (drop, drag, search) eh **grande e clara**
- [ ] Acoes secundarias (toggle snap, destravar, ajuste fino) sao menores e ficam atras de inspector ou icone pequeno
- [ ] NAO ha "dezenas de controles aparecendo de uma vez" — quando aparece, eh dentro de seção colapsavel
- [ ] Catalogo (semantico em PT) tem peso visual igual ou MAIOR que busca livre (em ingles)

### D. Catalogo semantico

- [ ] Arvore em portugues: Sala / Cozinha / Quarto / Decoracao / Plantas / Iluminacao / Banheiro / Escritorio (etc — cobrir ambientes basicos)
- [ ] Folhas com nome humano ("Sofa", "TV", "Janela") — internamente disparam query em ingles transparente ao user
- [ ] Tree colapsavel, custom UI (nao usar tree do SO/HTML padrao)
- [ ] Click numa folha dispara busca **sem que o user precise digitar palavra em ingles**
- [ ] Busca livre coexiste — nao remove nada

### E. Footprint + ancoragem

- [ ] Item de catalogo declara `footprint` e `anchor` no arquivo `catalog.js` — nao no codigo de scene
- [ ] Anchor 'wall' so faz cola se ha sala; sem sala, comportamento atual mantido (sem crash, sem feature quebrada)
- [ ] Inspector tem mini-secao "Posicionamento" em PT-BR (Tamanho no chao, Ancora, Destravar)
- [ ] Dropdown de anchor eh **custom** (regra 8 dos principios) — nada de `<select>` nativo

### F. Modo Sala

- [ ] Modal de "Nova Sala" eh **custom**, nao `prompt()` ou `confirm()`
- [ ] Dimensoes em metros, com defaults preenchidos (6×5×2.7)
- [ ] Cena sem sala continua funcional — sala eh opcional
- [ ] Paredes/piso sao selecionaveis, materiais editaveis

### G. API programatica (Fase 0)

- [ ] `window.clag` so existe em **modo dev** ou sempre? (Pre-definir; PM aceita ambos desde que documentado)
- [ ] Cada button tem `data-clag-action="<verb>"` ou id estavel
- [ ] Cobertura minima: addPrimitive, runSearch, selectByName, dropAsset, setGizmoMode, save, load, toggleSnap, setRoom
- [ ] Cada action async retorna Promise com objeto util pra teste (ex: ref ao objeto criado)
- [ ] QA UX consegue testar sem depender de coordenadas de pixel

### H. Principios estruturais (nao quebrar)

- [ ] Zero build step — sem dependencia node nova, sem .ts, sem .tsx
- [ ] Importmap continua sendo o caminho pra dependencia externa
- [ ] Providers continuam plugins isolados — Sims-mode nao toca em `providers/`
- [ ] `scene.js` continua dono dos singletons three.js e event bus
- [ ] Persistencia continua via localStorage em JSON
- [ ] Cena starter (Ground + Cube + Sphere) continua subindo no boot (ou substituida por algo equivalente, nao por viewport vazio)

### I. Escopo (sinais de desvio)

- [ ] Sims-mode NAO trouxe: animacao, fisica, IA, simulacao de tempo, multi-usuario
- [ ] Build mode complexo (tijolo por tijolo estilo Sims) NAO entrou — so "Nova Sala" retangular eh aceito
- [ ] Curadoria manual de assets NAO entrou — engine continua agnostica
- [ ] Estetica cartoon NAO foi forcada — assets vem como vem do provider

---

## Glossario sugerido (vocabulario PT-BR para a UI)

| termo tecnico evitar | sugestao para user leigo |
|---|---|
| transform | posicao, rotacao, escala (separar) |
| gizmo | manipulador / setas / esconder |
| mesh | objeto |
| primitive | forma basica |
| raycast | (nunca expor) |
| anchor | ancora / encaixe |
| footprint | tamanho no chao / pegada |
| snap | encaixe ao grid (label do toggle: "Encaixar") |
| asset | item / modelo |
| drop | soltar |
| viewport | cena / palco |
| hierarchy / outliner | objetos na cena / lista de objetos |
| inspector | propriedades |
| import / load | abrir |
| export | exportar (ok, eh palavra ja aportuguesada) |

**Nota:** PM nao impoe traducao mecanica — sugere o vocabulario, DEV escolhe o equilibrio. Mas qualquer palavra da coluna esquerda **visivel ao user na UI** entra como ponto a corrigir.

---

## Sinais de boa direcao (registrar quando ver)

- Default sensato + escape hatch claro
- Feedback visual rico durante drag/drop (tile destacado, ghost preview, sombra)
- Mensagens de toast em PT-BR
- Linguagem acessivel — pessoa que nunca abriu Blender entende sem treino
- Estrutura de catalogo cobrindo ambientes comuns (nao so 2 categorias de exemplo)

## Sinais de desvio (alertar quando ver)

- Botoes/menus duplicados (ingles e portugues lado a lado)
- Feature avancada sem default simples (gizmo sem snap como unica opcao)
- Complexidade visual no boot (muito controle de uma vez)
- Jargao 3D na UI ("primeiro defina o pivot...")
- Componentes nativos do sistema (regra 8)
- Tema fora do escopo entrando (animacao, fisica, IA)

---

## Estado pre-revisao

**Data:** 2026-05-20
**Commits no main:** `3bb48d5`, `0ec1b2b` — ambos pre-Sims-mode (init + ajustes do revisor)
**Aguardando:** primeiros commits do DEV (Fase 0 — API programatica, e Fase 1 — Catalogo semantico)

### Observacoes do estado atual (baseline) que ja podem orientar o DEV

Algumas coisas que o estado atual ja tem e que o PM sinaliza pra **NAO regredir**:

1. **`index.html`:** topbar ja tem buttons com IDs estaveis (`btn-add-cube`, `mode-translate`, etc) — Fase 0 deve ADICIONAR `data-clag-action`, nao remover/renomear IDs
2. **`search.js`:** ja tem drop handler no viewport (`worldPointAtScreen`) — snap deve interceptar **depois** desse raycast, nao substituir
3. **`main.js`:** `addPrimitiveByKind(kind)` ja eh a forma canonica de criar primitive — `window.clag.actions.addPrimitive` deve **reusar** essa funcao
4. **UI atual em ingles** (`+ cube`, `+ sphere`, `delete`, `duplicate`, `save`, `load`, "drag to orbit"): pertinente revisar agora pra entrar PT-BR junto com Sims-mode, OU manter ingles na engine-core e ter catalogo/inspector em PT? **PM sugere:** botoes de primitive (cube/sphere/plane/light) sao **debug/dev** — leigo nao usa. Aceitavel manter em ingles. Mas inspector, catalogo, sala, snap, anchor, todo o fluxo novo Sims-mode entra em PT-BR.
5. **Cena starter (Ground + Cube + Sphere)** existe — manter ou trocar por algo mais convidativo pro roteirista (ex: "sala vazia com 1 sofa" se Fase 4 estiver pronta)? PM aceita ambos por enquanto.

---

## Historico de revisoes

(Cada revisao a seguir recebe sua propria secao com data, commit revisado, veredito, pontos positivos, pontos a corrigir, e resposta da pergunta-mestra.)

### Template de entrada (manter consistente)

```
### Revisao YYYY-MM-DD — commit <hash>

**Veredito:** alinha | desvia | sugere ajuste

**Pontos positivos:**
- ...

**Pontos a corrigir:**
- **[O que]** ...
  - **Por que:** ...
  - **Sugestao:** ...

**Pergunta-mestra:** "Isso facilita o roteirista nao-tecnico montar cena rapido?" → ...
```

---

## Revisao 2026-05-20 — commits 889bb4a + 1f5d59f

**Veredito:** **alinha com ressalvas** (3 ajustes pequenos antes de Fase 2, nada bloqueante de fundo).

### Pontos positivos

- **Catalogo em PT-BR consistente.** 6 categorias (Sala, Cozinha, Quarto, Banheiro, Escritorio, Exterior) com 47 folhas em portugues humano ("Sofa", "Geladeira", "Criado-mudo", "Vaso sanitario"). Nenhum jargao tecnico vazou pra arvore. Caminho cumprido: roteirista nao precisa saber "couch" ou "nightstand" pra achar o item.
- **Catalogo eh acucar de busca, nao curadoria.** `catalog.js` declara `query` por folha e reusa `searchAll` + `setLastResults` + `downloadAndPlace` do `search.js`. Isso eh **exatamente** o que o SIMS-MODE.md prescreveu — drop e dbl-click se comportam identicos entre as duas abas. Zero divergencia de fluxo.
- **Coexistencia limpa.** Aba "Buscar" eh default no boot, "Catalogo" eh opt-in. Busca livre continua igual; arquitetura de providers nao foi tocada (principio 4 intacto). Zero regressao.
- **Footprint + anchor ja declarados nas folhas.** Embora Fases 2-3 ainda nao consumam, o vocabulario ja esta no lugar correto (no `catalog.js`, nao no codigo de scene — exatamente como pedido no criterio E).
- **Componentes 100% custom (principio 8 ok).** Tabs sao `<button>` estilizado, tree eh `<button>`+`<div>`, chevron via texto. Nenhum `<details>`, `<select>`, ou tree nativo do SO.
- **API programatica do catalogo eh completa.** `actions.catalog.{tree, leaves, getLeaf, searchCategory, expand, collapse, expanded, showTab}` — todo botao da arvore tem equivalente. Cobertura UI->API da Fase 1 esta integra.

### Pontos a corrigir

1. **Mistura de idiomas no header do bottom panel.**
   - **O que:** Tabs estao em PT ("buscar", "catalogo") mas o hint ao lado continua `drag a result onto the viewport · or double-click`, e a aba Buscar mantem placeholder `search 3d assets… (e.g. tree, rock, chair)` e o estado vazio `type a query and press Enter…`. Boot toast tambem segue ingles (`clag loaded — drag to orbit · click objects to select`).
   - **Por que:** Catalogo PT-BR ao lado de tudo em ingles cria a duplicidade que o glossario do PM-NOTES.md explicitamente bane ("Sem ingles e portugues lado a lado pra mesma acao"). Pro leigo brasileiro, vira UI mestica.
   - **Sugestao:** Traduzir os 4 textos visiveis (hint do bottom panel, placeholder do input, estado vazio do `#results`, toast de boot). Codigo, ids e nomes de provider continuam em ingles — so o que o usuario le. Botoes de primitive ("+ cube" etc.) ja foram aceitos como debug/dev no baseline (linha 153), mantenho a excecao.

2. **Bug 1 do QA (`runSearch` API nao renderiza grade) continua aberto.**
   - **O que:** Confirmei lendo `api.js:97-107` e `search.js:113-128`: `actions.runSearch` chama `searchAll` direto + `setLastResults`, sem invocar `renderResults`. O QA UX ja documentou. Fase 1 nao tocou nisso.
   - **Por que:** Quebra a expectativa "API espelha UI" (criterio G). Pra agente de QA visual / demo, busca via console nao atualiza a grade — assimetria irritante.
   - **Sugestao:** Exportar `renderResults` em `search.js` (ou refatorar `search.js::runSearch(query)` pra aceitar query como parametro e delegar), e chamar do `api.js::runSearch` apos `setLastResults`. Mudanca pequena, paga o debito antes da Fase 2 introduzir snap.

3. **Bug 2 do QA (`setProvider` ausente) continua aberto.**
   - **O que:** `grep activeProviderId` mostra que o estado ainda eh privado em `search.js`. `actions.runSearch(q, providerId)` aceita o id como argumento mas nao persiste — nao ha `actions.setProvider(id)` nem `state.activeProvider()`. O botao `#provider-btn` na UI nao tem equivalente programatico.
   - **Por que:** Fere literalmente o criterio G ("Cobertura minima: ... toggleSnap, setRoom") e o sinal de boa direcao "cada botao tem equivalente". Tambem deixa o estado de provider duplicado entre DOM e API.
   - **Sugestao:** Expor `setActiveProviderId` em `search.js`, criar `actions.setProvider(id)` que tambem atualiza label/menu da UI, e `state.activeProvider()`. Casa com o ajuste do bug 1 — provavelmente um patch unico de search.js + api.js.

### Notas (nao bloqueantes, backlog)

- **Linguagem do `+ light` no objeto criado.** QA observou que `addPointLight` cria `Light N`; pra leigo, "Luz 1", "Lampada 1" eh mais natural. PM concorda mas mantem como backlog — primitivas continuam tratadas como debug/dev.
- **Tab visual ok mas falta cor focus.** Tab inativa fica com `color: var(--text-2)` e ativa com `var(--accent)`. Hierarquia visual atende, sem ajuste necessario agora.
- **Arvore arranca com Sala expandida.** Boa escolha — mostra a estrutura pro user sem 1 click extra. Manter.

### Bugs do QA — status

| Bug | Severidade QA | Status |
|---|---|---|
| 1 — `runSearch` API nao renderiza grade | media | **Continua aberto.** Reclassificado pelo PM como "deve fechar antes de Fase 2." |
| 2 — `setProvider` ausente | media | **Continua aberto.** Idem. |
| 3 — `selectByName` colisao de nome | baixa | Continua aberto (backlog) — virou nota, nao bloqueia Fase 2. |

### Decisao sobre Fase 2

**GO CONDICIONAL.** O DEV pode iniciar Fase 2 (snap + grid) **assim que** entregar um patch curto fechando os 3 pontos a corrigir acima (traducao dos 4 textos + fix do `runSearch` + `setProvider` na API). Nenhum desses ajustes mexe em `scene.js`, providers, ou no caminho de snap — sao limpeza de superficie. O `catalog.js` ja deixou `anchor`+`footprint` declarados, entao o terreno de Fase 2/3 esta preparado.

**Pergunta-mestra:** "Isso facilita o roteirista nao-tecnico montar cena rapido?" → **Sim, com ressalva de idioma.** Fase 1 reduziu drasticamente a barreira pra encontrar item (clicar "Geladeira" eh infinitamente mais facil que digitar "fridge refrigerator"). O ponto de atrito restante eh ler "search 3d assets" e "type a query" em ingles dentro de uma UI que tambem fala portugues — incomoda mas nao impede.

---

## Revisao 2026-05-20 — commit cb41eba (patch)

**Veredito:** **alinha com ressalvas pequenas** (nada bloqueante de Fase 2).

### Status das 3 ressalvas anteriores

| Ressalva da revisao anterior | Status |
|---|---|
| 1 — Mistura PT/EN no bottom panel | **Fechada.** Placeholder, hint, botao "buscar", menu de provider (`todos os providers`, `livre`, `chave`), toasts de download (`baixando…`, `carregando…`, `X adicionado`, `falhou`), tooltip de card de resultado (`arraste para a cena para adicionar`), estado vazio (`nenhum resultado para…`), toast de boot (`clag carregado…`), help do viewport (`arraste para orbitar · botão direito para mover · scroll para zoom · W mover · E girar · R escalar · F focar · Del apagar`), panel headers (`objetos na cena` / `propriedades`), empty-state do inspector (`nenhum objeto selecionado`), HUD (`selecionado:`). Cobertura completa do fluxo Sims-mode. |
| 2 — Bug QA #1 (`runSearch` API sem render) | **Fechada.** `search.js` exporta `runSearchUI(query, providerId)`, que escreve em `DOM.input.value`, chama `setActiveProvider` se aplicavel, delega pra `runSearch()` interno (mesmo caminho de Enter no input) — grade renderiza. `api.js::actions.runSearch` agora chama `d.runSearchUI(...)`. Caminho API == caminho UI. |
| 3 — Bug QA #2 (`setProvider` ausente) | **Fechada.** `search.js` exporta `setActiveProvider(id)` e `getActiveProvider()`; valida id (`'all'` ou id de provider existente, lanca erro caso contrario), atualiza `activeProviderId`, label do botao e menu. `api.js` expoe `actions.setProvider(id)` e `state.activeProvider()`. Cobre o equivalente programatico de `#provider-btn`. |

### Pontos positivos do patch

- **Refactor correto do runSearch.** A solucao escolhida (delegar via `runSearchUI` em vez de exportar `renderResults` solto) mantem o invariante "API espelha UI exatamente" — DOM.input.value reflete o que foi pesquisado, provider muda se o argumento foi passado, e usuario humano que abrir o painel ve o estado coerente. Melhor que duas implementacoes paralelas.
- **`setActiveProvider` valida entrada.** Lanca erro pra id desconhecido em vez de aceitar silenciosamente. Bom pra debugging de agente.
- **Tradução do `(empty)` no estado vazio** virou `(vazio)` — atencao ao detalhe.
- **Patch cirurgico.** Nao tocou `scene.js`, `loader.js`, `primitives.js`, `providers/`. Diff de 7 arquivos, +130/-83 linhas. Reversivel facil se preciso.

### Pontos a corrigir (ressalvas novas — nao bloqueiam Fase 2)

1. **Queries simplificadas demais em 4 folhas — risco de colisao semantica.**
   - **O que:** Algumas folhas agora retornam o **mesmo conjunto** de resultados porque compartilham a mesma `query`:
     - `'lamp'` aparece em **3 folhas:** "Luminária de pé" (Sala), "Abajur" (Quarto), "Poste" (Exterior). Poste de rua e abajur de mesa sao objetos visualmente muito diferentes — usuario que clica "Poste" vai ver abajures e luminarias internas no topo, nao posts de rua.
     - `'cabinet'` em **3 folhas:** "Rack de TV" (Sala), "Armário" (Cozinha — esse OK), "Arquivo" (Escritório). Rack de TV ficou sem dica de TV; arquivo de escritorio ficou sem dica de "filing".
     - `'sink'` em **2 folhas:** "Pia" (Cozinha) e "Pia / lavatório" (Banheiro) — geometrias diferentes mas mesma query.
     - `'plant'` em **2 folhas:** "Planta" (Sala) e "Planta" (Escritório) — funcional ok, sao plantas em vasos genericas, mas as duas folhas viraram clones funcionais.
   - **Por que:** O ganho do patch (encontrar resultados Polyhaven/CC0 em vez de so Sketchfab) eh real e estava listado como objetivo, mas a perda de especificidade em 4 folhas eh nova. Sims-mode promete "Poste" no Exterior — entregar abajures eh quebra de promessa pro leigo.
   - **Sugestao (backlog, pode esperar):** Manter palavra unica mas escolher a **mais especifica visualmente** em vez da generica. Ex: `'streetlight'` em vez de `'lamp'` pra Poste; `'tv-stand'` pra Rack de TV (tag composta com hifen costuma funcionar como token unico em indexes); `'filing-cabinet'` pra Arquivo. Para "Abajur" usar `'lamp'` eh ok (eh o caso generico). Para `'sink'` no banheiro, manter assim eh aceitavel — usuario provavelmente nao distingue muito. NAO precisa fechar antes de Fase 2 (catalogo eh data, refinavel a qualquer momento), mas registrar pra revisao quando QA testar e reclamar.
2. **`outliner.js:18` ainda em ingles: "empty scene".**
   - **O que:** Patch traduziu o panel header pra "objetos na cena", mas o conteudo dentro do painel quando a cena esta vazia ainda mostra `empty scene`.
   - **Por que:** Inconsistencia nova revelada pelo patch — antes do patch tudo era ingles consistente, agora o header em PT abre um conteudo em EN.
   - **Sugestao:** Trocar pra `cena vazia` ou `nenhum objeto na cena`. Fix de 1 linha, cabe num patch posterior junto com Fase 2.
3. **Backlog persistente nao fechado, e PM nao exigiu:** `save`/`load`/`delete`/`duplicate` da topbar continuam em ingles, tooltips `title=""` em ingles, primitivas `+ cube`/`+ sphere`/`+ light` em ingles. Tudo coberto pelo baseline (linha 153 — "primitivas sao debug/dev"), mas `save`/`load` nao sao primitivas; sao fluxo de produto. Toasts ja foram traduzidos ("cena carregada", "nenhuma cena salva"). PM mantem como **nao bloqueante** mas nota: quando Fase 2 introduzir botao "Snap" na topbar, aproveitar pra traduzir tudo de uma vez ("salvar", "abrir", "apagar", "duplicar") — assim a topbar inteira nasce em PT sem retrabalho.

### Checagem dos demais criterios (apenas no diff)

- **A. Linguagem:** fluxo Sims-mode agora todo em PT. Backlog identificado acima (item 2, item 3). Sem jargao tecnico vazando.
- **B. Defaults:** patch nao mexe em defaults — Fase 2 vai cuidar disso (snap on por default).
- **C. Hierarquia visual:** patch nao mexe em layout.
- **D. Catalogo:** queries simplificadas, ja avaliado (item 1).
- **E. Footprint/anchor:** intactos.
- **F. Modo Sala:** nao tocado.
- **G. API:** Fase 0 agora 100% (runSearch+setProvider+activeProvider fechados). Falta toggleSnap+setRoom, mas sao das Fases 2/4.
- **H. Principios:** zero build step intacto, importmap intacto, providers nao tocados, scene.js nao tocado, localStorage intacto. **Principio 8: zero componente nativo introduzido pelo patch** (nenhum `<select>`, `alert()`, `confirm()`, `prompt()` novo; nenhum `title=` novo). Os tooltips nativos pre-existentes nao foram piorados.
- **I. Escopo:** patch nao introduziu animacao/fisica/IA/etc.

### Bugs do QA — status atualizado

| Bug | Severidade | Status |
|---|---|---|
| 1 — `runSearch` API nao renderiza grade | media | **FECHADO** em cb41eba. |
| 2 — `setProvider` ausente | media | **FECHADO** em cb41eba. |
| 3 — `selectByName` colisao de nome | baixa | Continua aberto (backlog, nao bloqueia). |

### Decisao final: **GO** pra Fase 2 (snap + grid)

DEV tem luz verde sem condicoes. As 3 ressalvas anteriores foram fechadas, o patch eh cirurgico, zero regressao detectada, princípio 8 preservado, e as 2 ressalvas novas (queries genericas demais em 4 folhas + "empty scene" no outliner) sao cosmeticas/refinaveis e cabem em qualquer patch futuro junto com Fase 2 ou depois.

**Pergunta-mestra:** "Isso facilita o roteirista nao-tecnico montar cena rapido?" → **Sim, sem ressalva relevante.** A barreira de idioma do fluxo Sims-mode foi removida (placeholder em PT, toast em PT, panel em PT, hint em PT). O atrito que restou (botoes save/load da topbar em EN, "empty scene") nao bloqueia: o caminho principal — buscar/catalogo → ver resultado → arrastar pra cena — fala portugues do inicio ao fim agora.

---

## Revisao 2026-05-20 — commit 3ea96f1 (Fase 2 + backlog)

**Veredito:** **alinha com ressalvas pequenas** — Fase 2 entregue conforme escopo, snap default ON funciona, backlog i18n fechado. 2 ajustes de redacao + 1 fix da cena starter ficam como pendencia leve.

### Status do backlog anterior (rev cb41eba)

| Item | Status |
|---|---|
| `outliner.js:18` "empty scene" | **Fechado.** Virou "cena vazia". |
| Topbar EN (save/load/delete/duplicate/+cube etc.) | **Fechado.** 100% PT-BR: `+ cubo / + esfera / + plano / + luz / salvar / carregar / apagar / duplicar`. Tooltips PT-BR completos (`mover (W)`, `rotacionar (E)`, `escalar (R)`, `alternar painel de objetos`, etc.). |
| 12 folhas com query duplicada | **Fechado.** Viraram queries de 2 palavras (`coffee table`, `tv stand`, `floor lamp`, `street light`, etc.) — colisao semantica resolvida (plano "Poste retorna abajur" apontado na rev 889bb4a). Trade-off declarado (risco de zero result) eh aceitavel — catalogo eh data, refinavel. |
| Observacao 6 (`<input type="color">` nativo) — herdado do baseline | **Persiste.** Nao foi tocado nesta fase (fora do escopo de snap). Continua em backlog. |

### Pontos positivos

- **Snap default ON entregue como prometido.** `_enabled = true`, persistido em LS, defaults sensatos (0.5 m grid, 15°). Pessoa abre o app, arrasta um objeto, ele encaixa sozinho — comportamento "tipo Sims" instantaneo, sem o user precisar descobrir um toggle escondido.
- **Toggle visivel e auto-explicativo.** `📐 encaixar` na topbar com classe `.active` (bg-accent forte) quando ligado, texto alterna pra `📐 livre` quando desligado. Hierarquia visual ok — toggle eh secundario (medio), nao compete com mover/rotacionar/escalar. Sinal claro do estado.
- **Popover de config eh custom, leigo-friendly.** Inputs labelados em PT (`tamanho do grid (m)`, `passo de rotação (°)`), hint humano no rodape (`grid 0.5 m + rotação 15° é confortável pra interiores`), validacao silenciosa (rejeita valor invalido e volta pro anterior — nao crasha). Zero `prompt()`, zero `<select>` — principio 8 ok.
- **Inspector "posicionamento livre / encaixar na grade"** eh excelente redacao: zero jargao ("freeTransform" so existe no codigo). Visual: dot colorido + label que troca, tooltip explicativo. Leigo entende sem treino.
- **Rebuilt do grid eh sensato.** 30m × 30m com cap de 600 divisoes evita explosao se o user digitar `0.05`. Opacidade muda com on/off — sinal visual sutil que reforca o estado.
- **API completa.** `toggleSnap/setSnapEnabled/setGridSize/setRotStep/setObjectFreeTransform` + 4 state getters. Cobertura UI → API mantida em 100%. QA UX vai ter caminho programatico pra cada coisa.
- **Princípio 1 intacto.** Zero build step, zero dep nova, ES modules nativos via importmap. Diff em 11 arquivos, +487/-40, 100% JS puro.
- **Princípio 8 intacto.** Popover custom (div + inputs + listeners), toggle do inspector custom (button + classe + dot). Nada nativo introduzido. Os `<input type="number">` do popover sao aceitaveis (number input estiliza bem, nao abre popup do SO como `<select>` ou `type=date`).
- **Princípio 4 intacto.** `scene.js` continua dono dos singletons, `snap.js` eh modulo isolado, event bus interno coerente (`on('snapChanged')`). Providers nao tocados.

### Pontos a corrigir (nao bloqueiam Fase 3 — paga antes ou junto)

1. **Cena starter cai fora do grid no primeiro contato.**
   - **O que:** `main.js:229-231` ainda faz `cube.position.set(-1.4, 0.5, 0)` e `sphere.position.set(1.4, 0.6, 0)` *depois* do `addToScene`, o que pula o snap (snap ocorreu no add, position.set sobrescreve). Primeiro objeto que o leigo ve quando abre o app esta entre tiles.
   - **Por que:** O toggle `📐 encaixar` esta aceso na topbar enquanto os objetos estao desalinhados — contradicao visual. Pessoa pensa "ué, eu liguei encaixar e nao encaixou nada". Se arrastar, dai sim pula pro tile — mas o estado inicial confunde.
   - **Sugestao:** Trocar pra `cube.position.set(-1.5, 0.5, 0)` e `sphere.position.set(1.5, 0.6, 0)` — multiplo de 0.5, alinha com o grid default. Fix de 2 caracteres por linha. Alternativa: rodar `snap.applySnapToObject(cube)` apos `position.set`. A primeira eh mais simples.

2. **Label do toggle muda de nome conforme estado.**
   - **O que:** Snap ON → botao mostra `📐 encaixar`. Snap OFF → vira `📐 livre`. Pessoa que aprendeu "encaixar" e quer reativar olha a topbar e nao acha mais o botao com esse nome — acha `livre`.
   - **Por que:** Toggle padrao da industria (B do bold no Word, toggles do VS Code) mantem o nome fixo e usa cor/`.active` pra sinalizar. Botao que muda de label exige memoria adicional do leigo.
   - **Sugestao:** Manter texto fixo `📐 encaixar` e usar apenas `.active` + cor + tooltip pra sinalizar estado. Tooltip ja diferencia ("encaixe ativo — clique pra liberar" / "encaixe desligado — clique pra encaixar"). Backlog leve.

3. **Atalho G nao eh descoberto fora do tooltip — mas isso eh aceitavel.**
   - **O que:** `G` aparece so no tooltip do toggle. Nao tem hint no viewport, nao tem panel de help.
   - **Por que:** Coerente com a decisao "atalho avancado nao precisa ser primario" — leigo nao depende de teclado, depende do botao visivel, que esta ali. Tooltip cobre o user power. Mantem.

### Checagem dos demais criterios (apenas no diff)

- **A. Linguagem PT-BR:** Topbar 100% PT-BR. Inspector "posição/rotação/escala" agora em PT (substituiu "transform/position/rotation/scale"). Toggle do inspector em PT-BR humano. Popover em PT-BR. Tooltips em PT-BR. Nenhum jargao tecnico vazou ("snap" virou "encaixar", "transform" virou "posição"). Sem ingles/portugues lado a lado.
- **B. Defaults sensatos:** snap ON, grid 0.5m, rot 15° — exatamente o que SIMS-MODE.md prescreveu. Persistencia em LS.
- **C. Hierarquia visual:** snap toggle eh medio (entre add-primitive e gizmo mode), config eh icone pequeno (`⚙`), popover sob demanda — nada explode no boot. Inspector toggle visivel sem dominar.
- **D. Catalogo:** 12 folhas refinadas (item 3 do backlog fechado).
- **E. Footprint/anchor:** intactos, Fase 3 vai consumir.
- **F. Modo Sala:** nao tocado, Fase 4.
- **G. API:** `toggleSnap` entregue, `setRoom` fica pra Fase 4. Cada novo botao tem `data-clag-action`.
- **H. Princípios:** zero build, zero dep, ES modules nativos, importmap intacto, providers nao tocados, scene.js continua dono dos singletons, LS para persistencia. Tudo intacto.
- **I. Escopo:** snap eh exatamente o que SIMS-MODE.md mandou. Zero animacao/fisica/IA introduzida.

### Trade-offs declarados — avaliacao do PM

- **"Commit unico em vez de 2"** — **aceito**. Diff esta organizado (snap.js separado, mudancas em scene.js logicas), commit message detalha tudo. Nao prejudica revisao. Pra Fase 3 (mais invasiva), pediria 2 commits, mas aqui ok.
- **"Snap continuo durante drag (efeito pula pro tile)"** — **alinha com Sims**. Eh exatamente como The Sims se comporta: objeto pula entre tiles enquanto user arrasta. Nao parece bug pro leigo — parece comportamento de jogo. Mantem.
- **"Cena starter fora do grid"** — **ressalva 1 acima** — eh o unico trade-off que pediria fix.

### Pergunta-mestra

"Snap default deixa o roteirista mais rapido?" → **Sim, sem ressalva relevante.**

A barreira "qual eh o grid? como ligo?" sumiu — o user abre o app, ja esta ligado, ja funciona. Arrastar um sofa cai em tile, soltar mantem alinhado. Para 90% dos casos (locacao com mobilia paralela as paredes), o user nunca precisa pensar em snap. Para os 10% (objeto enviesado, decoracao livre), o toggle por-objeto no inspector resolve sem o user precisar desligar globalmente. Padrao Sims aplicado direito.

A unica friccao real eh a cena starter (item 1) — primeiro objeto que o user ve esta desalinhado, contradiz a promessa visual do `📐 encaixar` aceso. Fix de 2 numeros.

### Decisao: **GO** pra Fase 3 (footprint + ancoragem)

DEV tem luz verde pra abrir Fase 3 sem aguardar fix dos 2 pontos. Os 2 itens sao cosmeticos e cabem em qualquer patch futuro (item 1 = literal 2 numeros em main.js, item 2 = texto do botao em main.js). Ambos podem entrar junto com o primeiro commit da Fase 3 (que naturalmente vai mexer em main.js + inspector.js de qualquer jeito), sem custo de contexto.

Fase 3 vai precisar:
- `footprint` consumido no drop (centraliza o objeto sobre `[w,d]` tiles, nao sobre o centro do BBox)
- `anchor='wall'` faz raycast contra paredes da sala se existir; sem sala mantem chao
- `anchor='ceiling'` sobe pra altura da sala
- Inspector ganha mini-secao "Posicionamento" com footprint editavel (number/number) + anchor (dropdown CUSTOM, NAO `<select>`)
- Snap leva footprint em conta (alinha pelo canto, nao pelo centro, em objetos NxM)
- Items de busca livre (sem catalogo) entram com defaults [1,1]/floor — user pode editar

Backlog persistente (nao bloqueia, registra):
- Fix da cena starter (ressalva 1)
- Texto fixo no toggle de snap (ressalva 2)
- 14 folhas dependentes so de Sketchfab (limitacao de biblioteca, nao de query — PM aguarda QA testar Fase 3 antes de decidir politica)
- `<input type="color">` / `type="range"` nativos no inspector (obs 6 da QA, herdado)

---

## Revisao 2026-05-20 — commit 4f553d8 (Fase 3 + fix-ups)

**Veredito:** **alinha com ressalvas pequenas** — Fase 3 entregue dentro do escopo, 3 fix-ups (A/B/C) fechados, snap "tipo Sims" funciona corretamente, dropdown custom de apoio. 3 ajustes de redacao + 1 decisao de UX pendente (silencio do ceiling-fallback) ficam pra encaixar dentro da Fase 4 — sem patch separado.

### Status dos 3 fix-ups

| Fix | Pedido | Entregue | Status |
|---|---|---|---|
| **A — Bug 5 QA** (inspector reage a `setObjectFreeTransform` API) | `notifySceneChanged()` dispara direto da action | `api.js:163` chama `notifySceneChanged()` direto (sem indirecao via `ensureDeps`). Comentario marca o fix. | **FECHADO** |
| **B — Cena starter alinhada** | cube e sphere em multiplo de 0.5 | `main.js:230,232` usa `-1.5` / `1.5` (era `-1.4` / `1.4`). Snap toggle aceso vai bater com posicao alinhada agora. | **FECHADO** |
| **C — Snap toggle label fixo** | texto fixo "📐 encaixar", so `.active`+cor+tooltip mudam | `main.js:84-90` removeu o `textContent = ...`; CSS adicionou `color: var(--text-2)` no estado off pra contraste visivel. Tooltip continua dinamico. | **FECHADO** |

### Pontos positivos do commit principal

- **Footprint snap "tipo Sims" implementado corretamente.** `snapVec3WithFootprint` em `snap.js:124-130` aplica a regra par/impar exatamente como esperado: footprint impar → centro do objeto cai no centro do tile; footprint par → centro cai em meia-tile, pra que objeto cubra N tiles inteiros sem sobrar borda. Comportamento bate com The Sims. Footprint `[1,1]` cai 100% no caminho antigo (compat retro intacta). `applySnapToObject` agora consome `userData.footprint` — primitivas com default `[1,1]` continuam exatamente como Fase 2. Pra leigo, o efeito visual eh: "sofa 2x1 entra cobrindo 2 tiles, nao com 1 tile cheio + meio tile sobrando." Decisao certa.
- **Catalog decora results com defaults antes de `setLastResults`.** `catalog-ui.js:137-152` faz `decorated = items.map(it => ({...it, anchor, footprint}))`. Drop, dblclick, e `dropAsset` via API herdam metadados sem que cada caminho precise lookup. **Excelente decisao arquitetural** — evita 3 implementacoes paralelas do mesmo enrich. Busca livre cai no fallback `[1,1]/floor` no `downloadAndPlace` (`search.js:237-242`).
- **`applyAnchor` chamavel pos-drop e pos-mudanca-no-inspector.** Funcao exportada em `search.js`, reusada pelo inspector quando user troca "apoio" pra recalcular Y. Sem duplicacao de logica. Ceiling fallback `2.7m` permite o user trabalhar com armario de teto / lampada **antes da Fase 4 (sala) existir** — engine nao trava. Wall sem sala marca `anchorApplied='wall-fallback'` (pre-fiacao pra UI futura sinalizar).
- **Dropdown custom de apoio (Principio 8 ok).** `anchorDropdown` em `inspector.js:280-340` eh button + popup + 3 options custom (`<button>` cada). Fecha clicando fora (`mousedown` em `document`, com guarda `setTimeout` pra nao fechar no mesmo click que abriu). `aria-haspopup="listbox"` + `aria-expanded` corretos. **Zero `<select>` nativo introduzido.** Inspector segue 100% custom.
- **API valida entrada estritamente.** `setObjectFootprint` rejeita nao-array, length != 2, nao-inteiro, < 1. `setObjectAnchor` rejeita fora do enum `floor|wall|ceiling`. Throw com mensagem em PT-BR. Bom pra debug de agente.
- **Persistencia robusta — compat retro com saves antigos.** `persist.js` serializa `anchor`/`footprint`/`freeTransform` no top-level do objeto E garante copia no `assetMeta` se faltou. `applySimsMeta` aplica os 3 campos no rehydrate sem mexer em transform. **Saves antigos (pre-Fase 3) carregam sem crash** — campos novos ficam `undefined` e caem nos defaults (`'floor'`, `[1,1]`). Verifiquei o codigo: nao ha `if (!saved.anchor) throw` em lugar nenhum.
- **Principio 1 intacto.** Zero build, zero dep nova, ES modules puros. Diff de 10 arquivos, +446/-24 linhas, 100% JS.
- **Principio 4 intacto.** `scene.js` continua dono dos singletons; `applyAnchor` ficou em `search.js` (modulo de drop) e nao em `scene.js`. Event bus intacto.
- **Zero regressao detectada por inspecao.** Snap-on-add usa o novo path com `footprint=undefined → [1,1]` (mesma matematica de antes). Inspector renderiza nova secao apos `tSec` (posicao/rotacao/escala), antes de material — adiciona, nao substitui.

### Pontos a corrigir (encaixar na Fase 4 — sem patch separado)

1. **Ceiling-fallback silencioso pode confundir leigo.**
   - **O que:** Sem sala, drop de "Lustre" (anchor=ceiling) cola a 2.7m de altura. Roteirista que nunca criou sala vai ver o objeto **acima do teto que ele imagina** (que eh `Ground` no 0). Pra leigo que abre app pela primeira vez e arrasta um lustre, o objeto "some" no espaco — ele nao sabe que existe um teto fictício a 2.7m.
   - **Por que critico:** Sims-mode promete "drop facil sem o user pensar". Silencio = leigo conclui "quebrou".
   - **Sugestao (entra na Fase 4):** Quando `applyAnchor` marcar `anchorApplied='ceiling-fallback'`, disparar toast em PT-BR: `"lustre pendurado em altura padrão (2.7m) — crie uma sala pra altura real"`. Mesma coisa pra `wall-fallback`: `"sem parede pra encostar — objeto colocado no chão"`. Toast ja existe (`toast.js`), aproveita. Nao bloqueia Fase 3 porque ate Fase 4 chegar a janela eh curta — mas obrigatorio ate Fase 4 fechar.

2. **Row label "tamanho" + cells "L"/"P" exige inferencia visual.**
   - **O que:** `inspector.js:243` usa `row('tamanho')` com cells `L` (Largura) e `P` (Profundidade). DEV justificou no commit: "label da row eh 'tamanho' porque coluna tem 56px". OK pra constraint tecnica, mas leigo le `Tamanho L=2 P=1` e pode achar que `L`=Length (ingles), `P`=Pixel, ou nem ler as letras.
   - **Por que:** Outras rows do inspector (`posição`, `rotação`, `escala`) usam `X/Y/Z` — convencao 3D consagrada. Pra footprint, `L/P` eh ad-hoc e nao tem precedente intuitivo pra roteirista.
   - **Sugestao (encaixar na Fase 4):** 2 opcoes equivalentes — (a) renomear row pra `na grade` + manter `L`/`P` (sinaliza "tile count", nao metro); (b) manter `tamanho` + trocar cells pra `larg.` / `prof.` (abreviacao mais clara que letra solta). PM prefere (a) — mais curto e o contexto da row resolve. Decisao final do DEV.

3. **Snap toggle no estado "off" — contraste pode ser fraco.**
   - **O que:** Fix C trocou texto dinamico por classe `.active` + cor cinza no off. CSS aplica `color: var(--text-2)` quando inactive. Pessoa que ve a topbar pela primeira vez vai distinguir "encaixar ligado" (azul forte) vs "encaixar desligado" (cinza)? Funciona, mas eh exatamente o padrao que o user **destreinado em UI de software** menos percebe.
   - **Por que:** O risco eh leigo arrastar 1 objeto, sentir "nao encaixou", olhar a topbar, ver o botao `📐 encaixar`, e nao perceber que esta off porque o icone+texto continuam la.
   - **Sugestao (encaixar na Fase 4 ou backlog):** Adicionar dot visual no botao (cor accent quando ON, cinza quando OFF, similar ao toggle do inspector da Fase 2). Ou trocar icone (`📐` quando on, `📐` riscado / outro quando off). Backlog leve — espera QA testar pra ver se o problema eh real. Nao bloqueia.

### Checagem dos demais criterios (apenas no diff)

- **A. Linguagem PT-BR:** secao "posicionamento", labels "tamanho", "apoio", opcoes "Chão/Parede/Teto" — tudo PT-BR. Sem jargao tecnico vazando ("anchor" virou "apoio", "footprint" virou "tamanho", "wall" virou "Parede"). Coerente com glossario.
- **B. Defaults sensatos:** `anchor='floor'`, `footprint=[1,1]` — defaults universais. Catalogo de Fase 1 ja declara overrides por folha. Busca livre cai em defaults sem o user pensar.
- **C. Hierarquia visual:** secao "posicionamento" entra entre transform e material. Nao explode no boot — so aparece quando objeto eh selecionado. Footprint cells (2 cols) + dropdown custom (1 row) — denso mas legivel.
- **D. Catalogo:** intacto. Decora results sem mexer na estrutura.
- **E. Footprint/anchor:** **entregue conforme spec.** Item de catalogo declara em `catalog.js`. Anchor wall faz raycast se ha sala; sem sala, comportamento atual (fallback marcado). Inspector tem secao "Posicionamento". Dropdown custom. **Criterio E completo.**
- **F. Modo Sala:** nao tocado (Fase 4). `ROOM_HEIGHT_DEFAULT=2.7` ja prepara o terreno — Fase 4 vai trocar isso por leitura real de `room:ceiling`.
- **G. API:** `setObjectFootprint`/`setObjectAnchor` + 2 state getters. Inspector tem `data-clag-action="anchor-menu-toggle"` no botao do dropdown. Cobertura UI → API mantida.
- **H. Principios:** zero build, zero dep, ES modules nativos, importmap intacto, providers nao tocados, scene.js continua dono dos singletons, localStorage intacto. **Principio 8: zero `<select>` nativo introduzido** (dropdown 100% custom). Inputs `type="number"` nas cells de footprint sao aceitaveis (number input estiliza bem).
- **I. Escopo:** zero animacao/fisica/IA. Footprint + anchor = exatamente o que SIMS-MODE.md prescreveu.

### Trade-offs declarados — avaliacao do PM

- **"Persistir anchor/footprint fora de `assetMeta` (no top-level)"** — **aceito**. Decisao certa porque primitivas (cube/sphere/light) nao tem `assetMeta`, e DEV optou por suportar footprint/anchor em primitivas tambem (consistencia). Compat retro testada por inspecao — saves antigos nao tem esses campos, codigo trata como undefined → fallback.
- **"Ceiling fallback 2.7m sem sala"** — **aceito com ressalva (ponto 1)**. Decisao funcional eh certa: nao trava. Decisao de UX (silencio) eh o que pediria revisar.
- **"Wall fallback chao sem sala (silencioso)"** — **mesma logica do ponto 1**. Anchor fica marcado `wall-fallback`, mas UI nao mostra. Pra leigo, "arrastei quadro, virou chao no lugar de parede" — confuso. Toast em PT-BR resolve.
- **"Label `L × P` em vez de `Largura × Profundidade`"** — **aceitavel sob constraint**. Constraint da coluna de 56px eh real. Trade-off recai em legibilidade pro leigo (ponto 2 acima).
- **"Inspector dropdown 3 opcoes 'Chão/Parede/Teto' em vez de 4 (com 'Auto')"** — **aceito**. Auto adicionaria complexidade — leigo escolhe explicitamente, sem mistério.

### Pergunta-mestra

"Footprint + anchor deixa roteirista mais rapido OU adiciona complexidade desnecessaria?" → **Mais rapido, com 1 reserva.**

**Pro:** Sofa 2x1 do catalogo entra cobrindo 2 tiles, sem o user precisar editar. Lustre cai a 2.7m sem o user precisar mover Y. Quadro arrastado em parede (com sala) cola sozinho. Sao 3 atalhos enormes pra montagem rapida de cena.

**Contra/reserva:** Sem sala, ceiling-fallback eh **invisivel** — primeiro contato com a feature pode parecer "objeto sumiu". A complexidade adicional do **inspector** ("tamanho", "apoio") eh opcional — leigo pode ignorar e usar so o que o catalogo ja sugeriu. So fica a duvida com os 2 labels (ponto 2).

Saldo liquido: **claramente mais rapido**. Os 3 pontos acima sao polish, nao impedimento.

### Bugs do QA — status

| Bug | Severidade | Status |
|---|---|---|
| 5 — Inspector toggle freeTransform nao reage a API | baixa | **FECHADO** em 4f553d8 (Fix A). |
| 3 — `selectByName` colisao de nome | baixa | Continua aberto (backlog, sem prioridade). |

### Decisao: **GO** pra Fase 4 (modo Sala)

DEV tem luz verde sem condicoes. Os 3 fix-ups foram fechados, o commit eh consistente, dropdown custom respeita principio 8, persistencia eh retro-compativel, zero regressao detectada por inspecao. As 3 ressalvas acima (ceiling-fallback silencioso, label "tamanho L/P", contraste do toggle off) **encaixam dentro da Fase 4** — sem patch separado:

- Fase 4 vai criar `room:ceiling` real → `ROOM_HEIGHT_DEFAULT` deixa de ser usado **na pratica** quando o user cria sala. Toast de fallback (ressalva 1) entra junto com o botao "Nova Sala" — mesmo modulo (room.js criando, search.js tostando).
- Inspector vai ganhar entradas relacionadas a sala (selecao de paredes, etc.) — renomear `tamanho` / `L`/`P` (ressalva 2) cabe no mesmo patch.
- Toggle off contrast (ressalva 3) eh independente; pode esperar QA pra ver se o problema eh real.

Backlog persistente (nao bloqueia, registra):
- Ressalva 1 — toast pra ceiling-fallback / wall-fallback (encaixa na Fase 4)
- Ressalva 2 — rename "tamanho" → "na grade" + cells `L`/`P` ou abrev. (encaixa na Fase 4)
- Ressalva 3 — visual mais forte pro snap toggle off (backlog leve)
- 14 folhas dependentes so de Sketchfab (politica pendente — aguarda QA)
- `<input type="color">` / `type="range"` nativos no inspector (obs 6 da QA, herdado)

---

## Revisao 2026-05-20 — commit c8d5596 (fix bloqueador Fase 3)

**Veredito:** **alinha com ressalvas pequenas** — bloqueador fechado, todos os 8 itens entregues, mas inspector ainda tem leftover EN nas labels de linha (so titulos de secao foram traduzidos) e categoria "Cozinha" ficou sem opcao de teto.

### Status item-por-item dos 8 entregaveis

| # | Item | Status | Notas |
|---|---|---|---|
| 1 | Bug 8 — `downloadAndPlaceFromMeta` retorna `obj` | **FECHADO** | `main.js:211` `return obj`. `persist.js:136` ja faz `if (placed && placed.userData) applySimsMeta(...)` — agora o ramo executa. Cadeia rehidrate→applySimsMeta restaurada. |
| 1b | Defesa em profundidade: propaga `meta.anchor/footprint` pro `userData` no rebuild | **FECHADO** | `main.js:195-198`. Pragmatica — NAO eh redundancia perigosa: se o save **NUNCA** persistiu `anchor` (cena pre-Fase 3) mas o catalogo declarou no `assetMeta`, o objeto rehidrata com defaults corretos sem precisar do `applySimsMeta` rodar. Vale documentar pro futuro mantenedor (sugestao no fim). |
| 2 | Bug 7 — `floor` e `wall-fallback` re-plantam no chao | **FECHADO** | `plantOnFloor()` reusa exatamente a math do `loader::finalize` (`obj.position.y -= box.min.y`). Branches `floor`, `wall-fallback (sem sala)`, e `wall-fallback (raycast falhou)` chamam antes de marcar. Sequencia ceiling→floor agora resolve. |
| 3 | Bug 6 — `setObjectFootprint` valida via `Number.isInteger` | **FECHADO** | `api.js:178-181` removeu `parseInt`, le valor cru, mensagem PT-BR "footprint deve ser dois inteiros >= 1". `1.5` agora throwa em vez de virar 1. |
| 4 | PM #1 — toasts PT-BR pra ceiling/wall-fallback | **FECHADO (com ressalva — ver achados)** | 3 chamadas de `toast(..., {kind:'warn'})` em `search.js:295,305,341`. |
| 5 | PM #2 — label "tamanho na grade" | **FECHADO** | `inspector.js:245`. Cells L/P mantidas com comentario explicativo. Sugestao do PM era (a) — entregue. |
| 6 | PM #3 — contraste do snap-toggle off | **FECHADO** | `styles.css:111-114`. `color: var(--text-1) + opacity 0.85` em vez de `text-2`. Melhor que antes, mas honestamente continua sutil — backlog leve mantido. |
| 7 | Bonus — 3 folhas anchor=ceiling | **PARCIAL** | Sala: `ceiling-light` + `chandelier`. Quarto: `pendant-lamp`. Catalogo 47→50. **Falta Cozinha** — ver achados. |
| 8 | Inspector titles PT-BR | **PARCIAL** | Secoes ok (`identidade`, `posição`, `material`, `luz`, `informações`, `posicionamento`). Mas as **linhas dentro de cada secao** continuam em EN — ver achados. |

### Achados novos

1. **Leftover EN em labels de linha do inspector (consequencia do escopo "titles" do bonus).**
   - **O que:** Secoes traduzidas, mas o conteudo dentro nao. `inspector.js` ainda tem: `row('name')`, `plainRow('type')`, `plainRow('source')`, `plainRow('license')`, `linkRow('view')`, `row('color')` (material e luz), `sliderRow('rough.')`, `sliderRow('metal.')`, `row('emissive')`, `sliderRow('intens.')`, `sliderRow('dist.')`, `plainRow('verts')`, `plainRow('tris')`, `plainRow('meshes')`.
   - **Por que:** Inconsistencia mestica — secao "identidade" abre com label "name". "luz" abre com "color" "intens." "dist.". Leigo le `identidade > name: cube` e a quebra de idioma eh imediata. Era exatamente o tipo de coisa que justificou todo o esforco de Fase 2-3.
   - **Sugestao (encaixa na Fase 4, mesmo arquivo):** `name→nome`, `type→tipo`, `source→origem`, `license→licença`, `view→ver`, `color→cor`, `rough.→aspereza`, `metal.→metalicidade`, `emissive→emissivo`, `intens.→intensidade`, `dist.→distância`, `verts→vértices`, `tris→triângulos`, `meshes→objetos`. Patch de 1 arquivo, 14 strings. Cabe no commit de Fase 4 que vai mexer em inspector pra adicionar entradas de sala.

2. **"Lustre" so em Sala, "Luminaria Pendente" so em Quarto, Cozinha sem nada de teto — assimetrico.**
   - **O que:** DEV reconheceu na proposta que "Luminaria Pendente" no Quarto eh arbitrario; cozinhas tambem usam pendentes (acima de bancada). E nenhuma das 3 folhas ceiling caiu em Cozinha.
   - **Por que:** Cozinha eh o ambiente mais associado a luminaria pendente na vida real (bancada, ilha). Pra roteirista montando "cena de cozinha de manha", a ausencia eh notavel. "Lustre" so em Sala eh defensavel (luminaria de gala associada a sala/jantar). Mas "Pendente" so em Quarto eh inverso da intuicao.
   - **Sugestao (backlog leve, nao bloqueia):** Mover `pendant-lamp` de Quarto pra Cozinha (ou duplicar — catalogo aceita query repetida agora que existe `decorate` com anchor por folha). Quarto ja tem `desk-lamp` (Abajur) e nao precisa de pendente. Cozinha ganha mais que perde. Decisao do DEV.

3. **Toast de fallback pode disparar repetido se user trocar anchor pelo inspector sem sala.**
   - **O que:** `inspector.js:332` chama `applyAnchor(obj, ref)` quando o user troca apoio no dropdown. Sem sala, cada troca pra ceiling/wall vai disparar toast warn. Se user clicar 3 vezes pra testar, 3 toasts em fila.
   - **Por que:** Sutil — nao quebra nada, so polui visualmente. Toasts hoje sao curtos (~3s), 3 em fila eh tolerável mas chama atencao.
   - **Sugestao (Fase 4 ou backlog):** Guardar `lastAnchorAppliedToast` no userData ou debouncer no toast.js. Backlog leve — pode esperar QA reportar antes de mexer.

4. **Tom dos toasts — avaliacao da pergunta do PM-anterior.**
   - **"sem sala — luz pendurada no teto virtual (2.7m)"** — Informativo, nao assusta. "luz" generico cobre lustre/pendente/ceiling-light. "(2.7m)" da numero concreto. **Aprovado.**
   - **"sem parede — objeto posicionado no chão"** — Direto, util. **Aprovado.**
   - Ambos em `kind: 'warn'` — cor amarela/laranja sinaliza "atencao, comportamento alterado", sem alarmismo.

5. **Defesa em profundidade do Bug 8 — comentario insuficiente.**
   - **O que:** `main.js:194-198` propaga `meta.anchor/footprint` pro `userData` no rebuild. Comentario diz "pra `applySimsMeta` + snap/inspector conseguirem ler". Mas a razao real eh **mais sutil**: cobre saves antigos (pre-Fase 3) que nao tem `anchor` no top-level mas tem dentro de `assetMeta`. Tecnicamente, se `applySimsMeta` rodar (e agora roda), ele sobrescreve com `saved.anchor` — entao essa propagacao parece redundante. So que **se `saved.anchor` for `undefined`** (caso de saves pre-Fase 3), `applySimsMeta` nao mexe em nada e o `userData` herdado da propagacao salva o dia. Resumo: nao eh redundancia, eh fallback retro-compat.
   - **Sugestao:** Reescrever o comentario com: "Fallback retro-compat: saves pre-Fase 3 nao tem anchor/footprint no top-level, mas catalogo pode ter declarado em assetMeta. Propaga aqui pra applySimsMeta nao precisar inventar default." Backlog leve — codigo funciona, so o comentario engana proximo mantenedor.

### Checagem dos demais criterios (apenas no diff)

- **A. Linguagem:** Avancou mais (toasts PT-BR + titulos de secao). Mas labels de linha do inspector continuam EN — achado 1 acima.
- **H. Principio 8:** zero `<select>`, zero `alert/confirm/prompt`, zero `title=""` introduzido. Toasts sao componente custom existente. **Intacto.**
- **H. Principio 1:** Zero build, zero dep, ES modules. **Intacto.**
- **H. Principio 4:** `scene.js` nao tocado. `plantOnFloor` ficou em `search.js` (junto com `applyAnchor`) — coerente. Event bus intacto.
- **I. Escopo:** Zero animacao/fisica/IA. Tudo dentro de footprint+anchor+persist.

### Pergunta-mestra

"O bloqueador fechado + ressalvas + toasts deixam o leigo mais seguro montando cena?" → **Sim, com reserva.**

**Pro:** F5 agora preserva anchor/footprint — cena que parecia "voltar quebrada" volta correta. Trocar apoio no inspector pra `floor` re-planta no chao (Bug 7) — antes ficava flutuando, intuicao quebrada. Toasts PT-BR explicam **por que** o objeto caiu fora do esperado quando nao ha sala. Catalogo ganha 3 fixtures de teto pra Sala/Quarto trabalharem com `ceiling-light` desde ja.

**Reserva:** Inspector continua mestico (titulos PT + labels EN) — exatamente a "duplicidade lado a lado" que o glossario do PM-NOTES bane. Pra ser justo, isso ja era assim antes do commit; o bonus de "titles PT-BR" foi um avanço incompleto, nao uma regressao.

### Bugs do QA — status

| Bug | Severidade | Status |
|---|---|---|
| 6 — `setObjectFootprint` aceita float | baixa | **FECHADO** em c8d5596. |
| 7 — Anchor floor/wall-fallback nao re-planta | media | **FECHADO** em c8d5596. |
| 8 — `downloadAndPlaceFromMeta` nao retorna obj (bloqueador persist) | **ALTA** | **FECHADO** em c8d5596. |
| 3 — `selectByName` colisao de nome | baixa | Continua aberto (backlog). |

### Decisao: **GO** pra Fase 4 (modo Sala)

DEV tem luz verde. O bloqueador foi fechado, os 3 bugs do ciclo anterior estao fechados, persist ↔ catalog ↔ inspector formam uma cadeia coerente agora, princípios 1/4/8 preservados, zero regressao detectada por inspecao. As 5 achadas acima sao **encaixaveis** na Fase 4 (toasts dedup, labels inspector PT-BR completos, mover pendant-lamp pra Cozinha, comentario de retrocompat) — nenhuma justifica novo patch isolado.

Fase 4 vai precisar:
- Modal custom "Nova Sala" (dimensoes 6×5×2.7 default, em metros, sem `prompt()`)
- `room:floor`, `room:wall` (4), `room:ceiling` gerados como mesh selecionavel
- Inspector ganha secao "sala" quando objeto eh `room:*` (material/dimensao)
- `actions.setRoom(opts)` + `actions.removeRoom()` + `state.room()` na API
- Toasts de fallback deixam de disparar quando sala existir (validar)
- Aproveitar pra fechar achados 1 (labels EN) e 2 (pendant-lamp em Cozinha) no mesmo commit

Backlog persistente (nao bloqueia, registra):
- Achado 1 — 14 labels EN no inspector (encaixa Fase 4)
- Achado 2 — `pendant-lamp` arbitrario em Quarto, falta em Cozinha (backlog)
- Achado 3 — toast de fallback duplicar em troca repetida pelo inspector (backlog leve)
- Achado 5 — comentario de defesa em profundidade do Bug 8 enganoso (cosmetico)
- Ressalva 3 anterior — contraste snap toggle off (parcialmente melhorado, ainda sutil)
- 14 folhas dependentes so de Sketchfab (politica pendente)
- `<input type="color">` / `type="range"` nativos (obs 6 QA, herdado)

---

## Revisao 2026-05-20 — commit 4043b70 (Fase 4 + backlog v1)

**Veredito:** **alinha com ressalvas pequenas** — ultima fase do SIMS-MODE entregue dentro do escopo, modal custom respeita Principio 8, persistencia robusta, backlog A-G praticamente todo fechado. 4 ressalvas cosmeticas que **nao bloqueiam empacotamento/deploy**.

### Status item-por-item

#### Fase 4 (modo Sala)

| Item | Status | Notas |
|---|---|---|
| `room.js` novo | **FECHADO** | 187 linhas. `createRoom/removeRoom/getRoomDimensions/hasRoom/isRoomPart/describeRoomPart`. Box finos (0.05/0.02m), `userData.kind='room:wall\|floor\|ceiling'`, `roomFace: 'north\|south\|east\|west'`, `freeTransform=true` (snap ignora). Sala anterior eh substituida antes de criar nova. |
| Modal custom Nova Sala | **FECHADO** | 3 inputs (largura/profundidade/altura), defaults 6/5/2.7m. Labels PT-BR (`largura (m)` etc.). Esc fecha, Enter confirma, click no overlay fora do card fecha. Subtitle explica em PT-BR ("paredes, piso e teto serão criados ao redor da origem..."). `aria-labelledby` no card. **Zero `prompt()/confirm()` introduzido.** |
| `applyAnchor` consome `room:ceiling/room:wall` reais | **FECHADO** | Branch ceiling usa `box.min.y` do teto (face inferior) — math correta. Wall via raycast nas 4 paredes. Fallback so quando sala nao existe. |
| Inspector esconde transform/posicionamento pra `room:*` | **FECHADO** | `if (!roomPart)` envolve tSec+positioningSection. `idSec` mostra "Parede Norte" / "Piso" / "Teto" + type='sala'. Nao deixa renomear (poderia quebrar lookup pelo kind). |
| Persist: campo `room` no JSON | **FECHADO** | `room` top-level, **nao** dentro de `objects`. `serializeScene` filtra `isRoomPart`. `restoreSceneFromLocal` recria sala **antes** de rehydrate dos assets — garante que anchor=ceiling/wall dos itens encontre `room:ceiling/wall` reais. |
| API `actions.room.{create,remove,openModal,dimensions,has}` | **FECHADO** | Namespace `room` coerente com `catalog`. `state.hasRoom()` + `state.roomDimensions()`. |
| `state.objectAnchorApplied(sceneId)` (Obs 13 QA) | **FECHADO** | Retorna `'ceiling' \| 'ceiling-fallback' \| 'wall' \| 'wall-fallback' \| 'floor' \| null`. |

#### Backlog A-G

| Letra | Item | Status |
|---|---|---|
| A | 14 labels inspector PT-BR | **FECHADO (com 1 ressalva)** | `ROW_LABELS` map em `inspector.js:15`. 14 strings centralizadas. **Achado:** `meshes: 'meshes'` ficou em ingles — provavelmente lapso (deveria ser "objetos" ou "malhas"). Ver ressalva 1. |
| B | `kitchen-pendant` em Cozinha | **FECHADO** | `catalog.js:48` — duplica em vez de mover. Decisao do DEV ok, mas exige cuidado de redacao no catalogo — ver ressalva 2. |
| C | `opts.silent` em `applyAnchor` | **FECHADO** | Signature `applyAnchor(obj, dropPos, opts={})`. Inspector + API setObjectAnchor passam `silent: true`. Toast so no drop inicial. Inspector mostra `.insp-anchor-warning` (texto sutil amarelo) — substitui spam de toast. **Solucao cirurgica e correta.** |
| D | Comentario do Bug 8 reescrito | **FECHADO** | `main.js:194-198`. Comentario novo: "fallback retro-compat: saves anteriores à Fase 3 não têm anchor/footprint no top-level mas têm em assetMeta — copia daqui pra userData garantir." Bate com o achado anterior. |
| E | Snap-toggle off com border dashed | **FECHADO** | `styles.css:107-110`. Borda tracejada + cor `text-2` no off, solida + accent-strong no on. Definicao visual melhor que antes — leigo nota o "estado vazado". |
| F | Ceiling Y = ceilingY - boxSize.y/2 (Obs 12 QA) | **FECHADO (avaliado abaixo)** | Centraliza topo do objeto no teto. Ver ressalva 3 — eh decisao de UX, nao bug. |
| G | `state.objectAnchorApplied(sceneId)` | **FECHADO** | Coberto na Fase 4 acima. |

### Achados novos (4 ressalvas — todas cosmeticas, nao bloqueiam deploy)

1. **`meshes: 'meshes'` ficou em EN no `ROW_LABELS`.**
   - **O que:** `inspector.js:29`. Outras 13 entradas traduzidas (`name→nome`, `tris→triângulos`, `verts→vértices`), mas `meshes` ficou identico ao ingles. Provavelmente esquecimento — minha sugestao original foi `meshes→objetos` na rev anterior.
   - **Por que:** Inspector mostra "informações > vértices: X, triângulos: Y, meshes: Z" — 2 em PT, 1 em EN. Mesmico exatamente onde a Fase 4 quis fechar.
   - **Sugestao:** `meshes: 'malhas'` ou `meshes: 'objetos'`. Fix de 1 palavra. Pode entrar em qualquer patch.

2. **Modal de Nova Sala "substitui anterior" — risco baixo, mas alertar leigo no momento.**
   - **O que:** Modal mostra subtitle `"já existir uma sala, ela é substituída"` (note: redacao gramatical defeituosa — falta "se"). Quando user clica "criar" pela segunda vez, a sala antiga (com cores/materiais editados via inspector) eh **silenciosamente** descartada. Modal nao confirma "tem certeza?".
   - **Por que:** Pra leigo que pintou paredes e quer so "redimensionar", perde tudo de uma vez sem aviso explicito (so subtitle pequeno). Mas: undo nao existe, "salvar/carregar" eh manual, e modal abre pre-preenchido com dimensoes atuais (o que mitiga). Provavelmente aceitavel pro v1.
   - **Sugestao (backlog leve):** Corrigir gramatica do subtitle pra `"se já existir uma sala, ela é substituída — material e cor das paredes serão resetados"`. Confirmacao "tem certeza?" pode esperar v1.1 com undo/redo.

3. **Cena starter (Ground + Cube + Sphere) coexiste com sala criada — visualmente estranho.**
   - **O que:** `main.js` cria Ground+Cube+Sphere no boot. Se user clica "🏠 sala" depois, a sala envolve esses 3 objetos. O `Ground` (plano y=0) sobrepoe o `Piso` da sala (que tem topo em y=0 tambem) — Z-fighting visual provavel. Cube e Sphere ficam dentro da sala (`cube.position=(-1.5, 0.5, 0)` cabe em sala 6×5).
   - **Por que:** Z-fighting Ground vs Piso eh visivel pro leigo — flicker no chao quando camera move. Solucao trivial: ao `createRoom`, remover/ocultar `Ground`. Mas pode quebrar cenas sem-sala que dependem do Ground como referencia visual. Trade-off declarado pelo DEV ("cena starter coexiste, nao remove").
   - **Sugestao:** No `createRoom`, esconder ou apagar o `Ground` (procurar por `name === 'Ground'` no `userRoot`). Em `removeRoom`, restaurar. Solucao alternativa: subir Piso 0.001m pra evitar Z-fight. PM recomenda **investigar Z-fight em QA visual antes de empacotar** — se nao ha flicker perceptivel, deixa como esta.

4. **Labels "Parede Norte/Sul/Leste/Oeste" — leigo orienta?**
   - **O que:** `FACE_LABEL_PT` em `room.js:43`. Roteirista que nunca abriu Blender precisa pensar "norte = onde? Z negativo?".
   - **Por que:** Convencao geografica eh **arbitraria** num app de pre-viz interna — nao ha bussola na cena, nao ha gnomon visivel. Pra "Pra qual parede arrasto o quadro?", o user prefere labels relativos a camera ou ao layout.
   - **Sugestao (v1.1):** "Parede 1/2/3/4" eh mais neutro mas remove semantica. "Parede do fundo / Parede esquerda / Parede direita / Parede da frente" exige uma camera padrao definida — complica. **Decisao do PM:** manter Norte/Sul/Leste/Oeste por enquanto — eh consistente com bussola 3D padrao (Z- = norte) e o user que precisar distinguir pode olhar a posicao. Eh suficiente pra v1. Reavaliar se QA reclamar.

### Avaliacao da decisao F (ceiling centraliza topo)

**Decisao certa.** Antes: `obj.position.y = ceilingY - objHeight`. Resultado: topo do objeto na altura do teto, mas como Three.js posiciona pelo **centro**, lustres com chain longa acabavam com a chain saindo no teto e o corpo abaixo — visual aceitavel. Depois: `obj.position.y = ceilingY - objHeight/2`. Resultado: centro do objeto na altura "teto menos metade da altura" — lustres ficam **plantados** com topo encostado.

**Regressao possivel?** Pra luminarias pequenas (altura < 0.3m), a diferenca eh imperceptivel. Pra chandelier alta (altura ~0.8m), o ganho eh visivel — fica realmente colado. Compativel com The Sims (que faz exatamente isso). **Aprovado.**

### Avaliacao de `kitchen-pendant` (decisao B)

DEV optou por **duplicar** (`pendant-lamp` em Quarto + `kitchen-pendant` em Cozinha, ambos com `query: 'pendant lamp'`). Resultado pratico: catalogo tem 2 folhas que retornam **o mesmo conjunto Sketchfab**. Pro leigo, "Luminária Pendente" em Quarto e "Luminária Pendente" em Cozinha sao folhas distintas mas funcionalmente clones.

**Aceitavel?** Sim — o ganho semantico (cozinha **tem** pendente, encontravel pela arvore) supera a duplicidade. Custo: zero (catalogo eh data). Alternativa "mover" perderia Quarto, alternativa "diferenciar query" exige `pendant lamp kitchen` vs `pendant lamp bedroom`, o que pode quebrar Sketchfab. **Mantem.**

### Cobertura UI → API (criterio G)

| Botao/UI | API equivalente |
|---|---|
| `btn-add-room` ("🏠 sala") | `actions.room.openModal()` |
| Modal "criar" | `actions.room.create({width, depth, height})` |
| Sem botao UI direto (mas previsivel) | `actions.room.remove()`, `actions.room.dimensions()`, `actions.room.has()` |
| (anchor mudanca via inspector) | `actions.setObjectAnchor()` agora com silent=true |

Cobertura 100% mantida. Pequena lacuna: nao ha botao UI pra "remover sala" — user precisa usar API ou criar sala 0x0 (nao funciona, validacao rejeita). **Sugestao v1.1:** adicionar `🚫 sala` ou botao "remover" dentro do inspector quando seleciona `room:*`. Backlog leve.

### Checagem dos demais criterios

- **A. Linguagem PT-BR:** Modal 100% PT. Inspector 13/14 labels (`meshes` resta). Botao topbar "🏠 sala". Toast `"sala criada (6×5×2.7m)"` em PT. `idSec` mostra "Parede Norte" / "sala" pra room:*. **Quase 100%.**
- **B. Defaults sensatos:** 6×5×2.7m — exatamente o que SIMS-MODE.md prescreveu. Modal pre-preenche com dimensoes atuais se sala existe.
- **C. Hierarquia visual:** Botao 🏠 sala fica entre `+ luz` e snap toggle — agrupado com primitivas. Posicao certa (eh acao de criacao). Modal eh sob demanda.
- **D. Catalogo:** Intacto, ganhou 1 folha. Total 51.
- **E. Footprint/anchor:** Anchor real agora roda quando ha sala. Fallbacks intactos.
- **F. Modo Sala:** **Entregue completo.** Modal custom, dimensoes em metros, defaults preenchidos, cena sem sala continua funcional (sala eh opcional — toggle implicito via `hasRoom`), paredes/piso/teto selecionaveis com material editavel.
- **G. API:** Cobertura mantida. Lacuna pequena: nao ha botao UI pra remover sala.
- **H. Principios:** Zero build, zero dep, ES modules nativos. **Principio 8: zero `<select>/<alert>/<confirm>/<prompt>` introduzido.** Modal eh 100% custom (overlay + card + inputs estilizados). `input type="number"` aceitavel (estiliza ok).
- **I. Escopo:** Zero animacao/fisica/IA. Build mode complexo (Sims-like tijolo-por-tijolo) nao entrou — so retangular. Curadoria manual nao entrou.

### Bugs do QA — status

| Bug | Severidade | Status |
|---|---|---|
| 3 — `selectByName` colisao de nome | baixa | **Continua aberto** (backlog, sem prioridade — pode esperar v1.1) |

### Pergunta-mestra

"Modo Sala + Fase 4 completa deixa o roteirista mais perto de uma cena util?" → **Sim, sem ressalva relevante.**

Pessoa abre app, clica "🏠 sala", aceita defaults 6×5×2.7m, ganha 4 paredes selecionaveis. Arrasta "Geladeira" pela arvore — entra no chao da cozinha. Arrasta "Lustre" — pendura no teto real. Arrasta "Quadro" — cola na parede (raycast). Cena montavel em ~30s sem o user pensar em coordenadas, anchors, ou snap. O snap "tipo Sims" garante alinhamento sem o user ter que ajustar. Inspector deixa pintar paredes via "cor" sem expor jargao. **Esse fluxo eh o produto.**

### Veredito final do SIMS-MODE v1

**PRONTO PRA EMPACOTAR/DEPLOYAR.** Fases 0-4 entregues conforme `SIMS-MODE.md`:

- Fase 0 (API programatica) ✓
- Fase 1 (catalogo semantico PT-BR) ✓
- Fase 2 (snap + grid default on) ✓
- Fase 3 (footprint + anchor + persist) ✓
- Fase 4 (modo Sala) ✓

Principios 1/4/8 preservados ao longo de 5 fases. Cobertura UI→API mantida em 100%. PT-BR consistente (1 lapso pontual em `meshes`). Zero regressao detectada por inspecao. Backlog persistente eh todo cosmetico/refinavel — nada quebra o fluxo principal.

**Recomendacao:** deploy em `clag.did.lu` apos:
1. **QA visual rapido** — confirmar nao ha Z-fight Ground vs Piso (ressalva 3) com camera em movimento.
2. **Fix de 1 palavra** — `meshes → malhas` ou `objetos` (ressalva 1).

Ambos sao opcionais — sem eles o app ainda fica funcional. Mas eh patch barato (~5 minutos DEV).

### Proximos passos sugeridos (v1.1, pos-deploy)

Em ordem de impacto pro roteirista:

1. **Export GLB/JSON** com manifest de creditos (licencas + URLs do Sketchfab/Polyhaven). Sem isso, equipe tecnica recebe a cena mas nao sabe a origem dos assets.
2. **Undo/redo basico** (Ctrl+Z). Modal de Nova Sala destrutivo + delete sem confirmacao = perda silenciosa. Undo cobre os dois.
3. **Botao "remover sala"** no inspector quando `room:*` selecionado. Fecha lacuna de cobertura UI→API.
4. **Camera presets** — "vista de cima" (planta baixa), "primeira pessoa", "olho de passaro". Roteirista visualiza enquadramento.
5. **Multiplas salas** ou layouts em L/U. v1 so faz retangulo unico — Sims real faz formas livres.
6. **Catalogo: refinar 14 folhas dependentes so de Sketchfab** quando QA mapear quais nao retornam resultado.
7. **`<input type="color">/range" nativos** no inspector (obs 6 QA) — substituir por componentes custom pra fechar Principio 8 100%.
8. **Marcadores narrativos** (boneco/camera/luz dramatica como atalho). Fora do escopo Sims-mode, mas eh onde clag se diferencia de Sweet Home 3D.

Backlog absorvido em v1.1:
- `meshes` PT-BR (ressalva 1)
- Modal: gramatica + reset de cor avisado (ressalva 2)
- Z-fight Ground vs Piso (ressalva 3, se confirmado em QA)
- Bug 3 (selectByName colisao)
- `pendant-lamp` duplicado eh aceitavel — mantem
- Labels Norte/Sul/Leste/Oeste — mantem ate QA reclamar

---

## Revisao 2026-05-20 — commit c9e026c (D.1 + D.2 + D.3 branch feat/surface-snap-gizmo)

**Veredito:** **AMARELO — nao mergear pra main antes de D.4+D.5.** Sub-fases D.1/D.2/D.3 funcionam como proof-of-concept, mas ha 3 problemas que tornam o merge prematuro: um bug de comportamento incorreto em anchor=ceiling durante drag, um problema de migracao de localStorage que quebra a promessa de default, e ausencia de qualquer discoverability do novo paradigma pra leigo.

### Metodologia desta revisao

Leitura completa de `physics.js`, `contextual-gizmo.js`, diffs de `scene.js`, `api.js`, `main.js`, `snap.js`, `styles.css`. Testes programaticos via `window.clag` no app em http://localhost:5045. Screenshots do estado visual.

---

### Avaliacao por criterio

**Aderência SIMS-MODE** ⚠

Anti-overlap XZ funciona: cubo desviou corretamente de X=-0.5 pra X=0.62 ao tentar sobrepor esfera. Cadeado travado (locked=true) por default — correto. Drag-to-translate XZ detectado via raycast + threshold 4px — correto. Cursor grab/grabbing implementado via CSS — correto.

Problema: objeto com `anchor='ceiling'` vai pra Y=0 durante drag via `dragObjectTo`. O `contextual-gizmo.js::_onPointerMove` chama apenas `physics.surfaceUnder` (raycast pra baixo, sem hit retorna y=0), sem verificar `obj.userData.anchor`. Lustre arrastado por cena de sala cai no chao. Edge case #6 da proposta ("anchor=ceiling funciona naturalmente") nao esta implementado. Testado: `setObjectAnchor(id, 'ceiling')` + `dragObjectTo` retornou posicao y=0, deveria ser ~1.7m (y teto - metade da altura).

**Principios** ✓ com ressalvas

- P1 (zero build): intacto. Dois arquivos ES novos, sem dep nova.
- P3 (pipeline simples): `physics.js` tem 215 linhas, bem comentadas, escopo limitado a AABB. Nao excede. `contextual-gizmo.js` tem 356 linhas — modular, responsabilidades claras. Nao polui.
- P6 (state explicito): `userData.freeTransform` continua sendo o switch unificado, conforme proposto. `_contextualMode` em `contextual-gizmo.js` é novo state interno — nao exposto ao scene graph (aceitavel). `_store` em `physics.js` eh derivado (recalculado); nao precisa persistir (correto, conforme proposta linha 564).
- P8 (componentes custom): cadeado eh `<div class="lock-overlay">` custom, 100%. Sem `title=""` nativo, sem `alert/confirm`. CSS custom com `position:fixed` + JS screen-space. Principio 8 ok.

Ressalva P3: `DEFAULT_ENABLED` de `snap.js` mudou de `true` pra `false`. A intencao eh "surface-snap eh o novo default, grid-snap vira opt-in". Mas ha um problema de migracao descrito abaixo.

**Edge cases** ⚠

| # | Edge case | Status |
|---|---|---|
| 1 — objeto minusculo | Nao tratado (sem bbox visual expandida) — confirmado "nao priorizamos" pra D.1-D.3. Backlog D.5. |
| 2 — objetos sobrepostos: qual recebe drag | Raycast pega o mais proximo da camera (hits[0]) — correto. |
| 3 — threshold 4px evita drag acidental | Implementado em `_dragCommitted`. Esc cancela e volta `_dragOrigin`. Correto. |
| 4 — drag rapido fora do plano XZ | `worldPointAtScreen` projeta no plano XZ — posicao deterministica mesmo fora da janela. Correto. |
| 5 — anchor='wall' durante drag | Drag XZ ignora anchor (objeto move livremente). Anchor NAO eh re-aplicado ao soltar. Bug: quadro ancorado em parede vai pro chao ao ser arrastado. `pointerup` chama apenas `notifySceneChanged`, sem `applyAnchor`. A proposta linha 491 especificava "ao soltar, re-aplica anchor". Nao implementado. |
| 6 — anchor='ceiling' durante drag | **Bug confirmado em teste.** Y cai pra 0. Proposta linha 493: "drag XZ funciona naturalmente, anchor re-aplicado ao soltar". Nao implementado. |
| 7 — room:* nao draggable | `_isRoomPart` filtra nos candidatos do raycast. Correto. |
| 8 — performance 200+ objetos | Raycast so no `pointerdown`, sweep O(N) no `pointermove`. Comentario documenta. Correto conforme proposta. |
| 9 — undo/redo | Snapshot apenas no `pointerup`. Correto. Undo/redo em si fora de escopo. |
| 10 — touch/mobile | Declarado fora de escopo. Pointer Events API unifica — arquitetura nao impede. |

**Compatibilidade reversa** ✓ parcial

- TransformControls W/E/R continuam funcionando: testado via API `setGizmoMode('translate/rotate/scale')` — correto. Esc nao volta pra contextual automaticamente (flag `_contextualMode=false` setada em keydown, mas nao ha mecanismo de reset apos Esc sem drag). Usuario que pressionar W fica preso em modo translate ate reload.
- Snap-to-grid: `DEFAULT_ENABLED` agora `false` — correto como intencao. Mas usuario com sessao pre-D.3 tem `clag:snap-enabled=true` em LS e vai continuar com grid snap ON. A promessa "surface-snap eh o novo default" so vale pra sessoes novas. Testado: LS tinha `clag:snap-enabled=true` da sessao anterior, `snapEnabled()` retornou `true` mesmo com DEFAULT=false. Nenhuma migracao de LS foi implementada. Nao e bloqueante se o usuario for novo, mas e inconsistente pra usuario existente.
- `setSurfaceSnapEnabled` nao esta exposto na API `window.clag`. Snap.js tem a funcao, mas api.js nao expoe. Leigo nao tem como desativar programaticamente.

---

### Achados novos (numerados e priorizados)

**ALTA**

1. **anchor='wall' e anchor='ceiling' nao sao re-aplicados apos drag (edge cases #5 e #6).**
   - O que: `contextual-gizmo.js::_onPointerUp` chama apenas `physics.update` + `notifySceneChanged`. Nao chama `applyAnchor`. Lustre (anchor=ceiling) vai pra y=0 ao ser arrastado. Quadro de parede vai pro chao.
   - Por que: quebra a promessa central de SIMS-MODE — "anchor=ceiling significa lustre no teto". Se o drag desfaz o anchor, o leigo nao sabe como recuperar (precisa usar inspector).
   - Sugestao (D.4 ou patch): no `_onPointerUp`, se `obj.userData.anchor !== 'floor'`, chamar `applyAnchor(obj, null, { silent: true })` apos o commit. Re-aplica o Y correto sem feedback de toast duplicado.

2. **Migracao de LS ausente: usuario com sessao pre-D.3 mantem grid snap ON.**
   - O que: `DEFAULT_ENABLED=false` nao sobrescreve LS existente. Um usuario que ja usou clag continua com snap de grid ligado.
   - Por que: a proposta GIZMO diz explicitamente "snap-to-grid vira opt-in secundario, surface-snap eh o default". Se o usuario existente nao experimenta o novo default, a proposta nao valida.
   - Sugestao: no boot de `snap.js`, verificar se `clag:surface-snap-enabled` foi gravado. Se nao foi (primeira vez no D.3), setar `clag:snap-enabled=false` explicitamente. Flag de migracao: `localStorage.getItem('clag:snap-migrated-d3')`.

**MEDIA**

3. **W/E/R nao voltam pra modo contextual ao soltar (sem Esc ativo).**
   - O que: `keydown` em W/E/R seta `_contextualMode=false`. Mas `scene.js` tem handler de Esc que chama `gizmo.detach()` — nao notifica `contextual-gizmo.js` pra resetar a flag. Usuario que pressiona W, move um objeto, e solta fica em modo translate pra sempre.
   - Por que: inconsistencia de estado. Leigo que "acidentalmente" aperta W fica preso sem saber como destravar (precisa pressionar Esc, mas Esc so cancela drag ativo, nao reseta modo).
   - Sugestao: no handler de Esc em `contextual-gizmo.js` (linha 62), tambem resetar `_contextualMode=true` quando nao ha drag ativo. Ou escutar o evento `gizmo.detach` de `scene.js`.

4. **surfaceUnder detecta topo de outros objetos como superficie — objeto pode "subir" ao colidir.**
   - O que: ao testar dois cubos no mesmo XZ, o segundo subiu pra y=0.956 (topo do primeiro cubo) apos o sweep desviar em X. O raycast pra baixo pegou o topo do cubo vizinho como superficie. O objeto ficou flutuando ao lado do primeiro.
   - Por que: o sweep XZ desviou o candidato pra ao lado do sofa1, mas o raycast capturou o topo do sofa1 como hit (o rayo passou pelo topo). Resultado: objeto ao lado, mas elevado.
   - Sugestao (D.4/D.5): apos sweep, excluir do `surfaceUnder` objetos cujo AABB XZ nao intersecta mais o candidato. Ou usar apenas `y=0` quando nao ha sobreposicao XZ confirmada.

5. **Discoverability zero do novo paradigma de drag.**
   - O que: o hint do viewport diz "arraste para orbitar · W mover · E girar · R escalar". Nao ha nenhuma indicacao de "arraste o objeto direto pra mover". Cadeado aparece so apos selecionar objeto — e mesmo assim sem tooltip explicativo de por que existe.
   - Por que: leigo abre o app e ve a mesma mensagem de antes. Sem tentar clicar num objeto, nunca descobre que pode arrastar. O `title="clique para alternar posicionamento livre"` do cadeado e tooltip nativo (regra: nunca usar `title=""` — Principio 8).
   - Sugestao: (a) adicionar ao hint "arraste objetos para mover"; (b) substituir `title=` do cadeado por tooltip custom (div CSS, como feito em outros elementos); (c) um toast discreto no primeiro drag bem-sucedido "👍 arrastar move o objeto — clique no 🔒 para liberar posicionamento".

**BAIXA**

6. **`setSurfaceSnapEnabled` existe em `snap.js` mas nao exposta na API `window.clag`.**
   - Sem bloqueador — surface snap nao tem UI dedicada ainda. Mas pra QA testar headless, faz falta.
   - Sugestao: expor `actions.setSurfaceSnapEnabled(bool)` e `state.surfaceSnapEnabled()` em `api.js`. Patch de 3 linhas.

7. **Variavel `blocked` calculada em `sweepXZ` mas nunca usada.**
   - `physics.js:193` seta `blocked=true` mas nao retorna esse valor. Proposta linha 569 menciona "cursor `not-allowed` brevemente quando slide ativo" — dependeria do `blocked`. Nao e bug, e feature pendente (D.5).

---

### Decisoes deliberadas do DEV — avaliacao do PM

- **AABB nao rotaciona com objeto (axis-aligned fixo):** aprovado para v1. A proposta declarou isso explicitamente como trade-off aceitavel. Sims classico funciona igual. AABB fica maior que o objeto real em diagonais — pode bloquear antes do visual. Aceitavel pra D.1-D.3.
- **Sweep apenas XZ (sem anti-overlap vertical em D.1-D.3):** aprovado, dentro do escopo declarado. D.4 fecha.
- **Nenhum toast introduzido pra informar o usuario sobre o novo modo de drag:** questionado. A transicao de "TransformControls como default" pra "contextual drag como default" e uma mudanca de paradigma. Usuario antigo nao tem sinal nenhum de que o app mudou. Pelo menos um toast de boas-vindas ao feature seria adequado.
- **`worldPointAtScreen` reusado de `scene.js`:** decisao correta. Reusar infraestrutura existente sem duplicar.
- **Cadeado como `position:fixed` em `document.body`:** decisao correta. Evita z-index wars com o canvas e garante que ficara sempre sobre o viewport independente do layout.

---

### Pontos de tensao entre principios

P3 (pipeline simples) vs completude do D.3: a sub-fase D.3 entregou o cadeado mas nao entregou re-aplicacao de anchor apos drag (achado 1). Isso cria uma situacao em que a feature parece completa mas quebra um caso central (lustre nao volta pro teto). A tensao e entre "entregar a sub-fase como combinado" e "entregar um comportamento coerente". PM avalia que o bug de anchor regressao (achado 1) e bloqueante — nao e polimento, e comportamento errado.

---

### Checagem de criterios do checklist de PM (diff apenas)

- **A. Linguagem PT-BR:** zero texto novo exposto ao usuario (modulos sao internos). Tooltip nativo `title=` no cadeado e violacao do Principio 8 — ver achado 5b.
- **B. Defaults sensatos:** DEFAULT_ENABLED=false correto na intencao. Problema de migracao — achado 2.
- **C. Hierarquia visual:** cadeado centralizado sobre objeto em screen-space, 20px acima do centro. Visual discreto, nao polui. Aprovado.
- **G. API:** `toggleLock`, `setObjectLock`, `dragObjectTo`, `isLocked`, `objectAABB` — todos funcionando conforme testado. `setSurfaceSnapEnabled` ausente — achado 6.
- **H. Principios:** P1 ok, P3 ok, P6 ok com ressalva, P8 quase ok (title= nativo no cadeado).
- **I. Escopo:** physics.js eh AABB-only, sem integracao de fisica real. Dentro do escopo.

---

### Bugs identificados nesta revisao

| # | Descricao | Severidade | Origem |
|---|---|---|---|
| GIZMO-1 | anchor=ceiling/wall nao re-aplicado apos pointerup | ALTA | achado 1 |
| GIZMO-2 | Migracao de LS snap ausente — usuario existente mantem grid snap ON | MEDIA | achado 2 |
| GIZMO-3 | W/E/R nao retornam a contextual apos Esc | MEDIA | achado 3 |
| GIZMO-4 | surfaceUnder eleva objeto ao colidir (topo do vizinho vira superficie) | MEDIA | achado 4 |
| GIZMO-5 | title= nativo no cadeado viola Principio 8 | BAIXA | achado 5b |
| GIZMO-6 | setSurfaceSnapEnabled ausente da API | BAIXA | achado 6 |

---

### Pergunta-mestra

"Se um roteirista nao-tecnico abrir o app hoje (branch feat), ele consegue montar uma cena simples com drag-to-move sem instrucao?"

**Parcialmente.** O drag-to-translate XZ funciona e o anti-overlap e uma melhoria real — nao ha mais sobreposicao involuntaria em plano XZ. O cadeado aparece visualmente e e clicavel. Porem:
- Usuario nao descobre o drag (hint nao menciona).
- Primeiro arraste de lustre vai pro chao (anchor nao re-aplicado).
- Usuario que ja usou o app antes nao experimenta o novo default de snap.

Saldo: feature tecnicamente funcional no nucleo (D.1+D.2+D.3 passam nos testes basicos), mas UX do produto ainda tem buracos que o leigo vai cair antes de chegar na diferenciacao.

---

### Decisao: **NAO mergear pra main ainda. Continuar em feat/surface-snap-gizmo.**

Fechar GIZMO-1 (re-aplicar anchor apos drag) e GIZMO-3 (retorno a contextual apos Esc) antes de qualquer outra coisa. Sao comportamentos errados, nao polish. D.4 (anti-overlap vertical) e D.5 (polish) podem entrar no mesmo branch. Criterio de merge do PM: roteirista arrasta lustre, ele vai pro teto, nao pro chao.

Backlog acumulado nao bloqueante:
- GIZMO-2 — migracao de LS (pode entrar junto com D.4 ou D.5)
- GIZMO-4 — objeto sobe ao colidir (D.4/D.5)
- GIZMO-5 — title= nativo no cadeado (D.5)
- GIZMO-6 — setSurfaceSnapEnabled na API (D.5)
- Discoverability do drag (hint + toast de boas-vindas) — D.5

---
