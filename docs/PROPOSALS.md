# Propostas — clag

> Documento de propostas pré-implementação. Cada seção tem: problema observado, tese, opções A/B/C com trade-offs, recomendação tentativa. NÃO é roadmap fechado — é munição pra próxima decisão de produto. Datas/prioridades ficam no `ROADMAP.md`; aqui só raciocínio.

> Leitura assumida: `PRINCIPLES.md`, `ARCHITECTURE.md`, `SIMS-MODE.md`, `PRODUCT-NOTES.md`. Especialmente os 9 princípios — eles enquadram todas as opções abaixo. Quando uma opção viola princípio, marco explicitamente.

---

## 1. CONFIG — keys de provider, persistência de cena, e como crescer sem virar painel de admin

### Problema observado hoje

A engine já acumula **5 chaves distintas** em `localStorage` (`clag:scene-v1`, `clag:keys:<provider-id>`, `clag:snap-enabled`, `clag:grid-size`, `clag:rot-step`), e a tendência é crescer: tema/idioma/preferência de provider/HDRI default/grid color/etc. Nada disso tem UI central.

A sessão de hoje fechou um buraco específico: o toast vermelho longo de Sketchfab — "API token not configured. Click the key icon in the provider menu and paste your token..." — não tinha botão de ação. Agora tem (`feat(config): toast com botão 'Configurar'`). Mas isso resolve **um** sintoma, não a pergunta de fundo: **onde o user vai pra configurar a chave do Sketchfab quando ele quer fazer isso fora do fluxo de erro?**

Hoje a resposta é: lugar nenhum. A chave só aparece como UI sob demanda (toast → painel). Se o user já tem token e quer guardar antes de tentar, **não tem caminho**. Se quer trocar uma chave válida por outra (testes, conta diferente), **também não tem caminho** — precisa abrir DevTools e mexer em `localStorage`. Isso é amador.

Outros itens no horizonte de configuração que ainda não têm UI alguma:
- Preferência de provider default (hoje sempre `'all'`)
- Idioma (PT-BR está hardcoded no código — sem switch)
- Tema (não temos light, mas plausível)
- Snap defaults globais vs por-objeto (hoje só global no popover ⚙)
- Dimensão default da sala (hardcoded 6×5×2.7 no modal)
- Export glb formato preferido (binary vs ASCII)
- Comportamento de save automático (hoje só manual via botão "salvar")

### Tese

Configuração em ferramenta criativa **deve ser invisível por default**. O roteirista não-técnico (target persona do `SIMS-MODE.md`) **não deve nem perceber que existe um painel de Configurações** até precisar de algo que esteja lá.

O modelo mental certo: configuração **emerge** quando uma ação a exige (asset Sketchfab → painel de chave; troca de provider default → menu de provider que já existe; mudança de dimensão padrão da sala → o modal de Nova Sala já é onde ela vive). A engenharia **resiste à tentação de fazer uma engrenagem ⚙ no topbar que abre um painel com 12 abas** — esse tipo de UI é o sintoma clássico de "design por acúmulo" e quebra o princípio P3 (pipeline simples acima de features).

A pergunta a fazer ao adicionar qualquer config nova: **"isso facilita o roteirista não-técnico montar cena rápido?"** — vinda direto do role do PM em `SIMS-MODE.md`. Se a resposta é "não, mas é importante pra user avançado", o caminho não é UI dedicada — é tornar discreto/contextual.

### Opção A — Painel "Configurações" único acessível por engrenagem ⚙ no topbar

**Forma:** botão ⚙ no topbar abre painel modal com seções colapsáveis:
- "Chaves de API" → lista todos os providers com `needsKey: true` + input + botão salvar/limpar
- "Encaixe" → grid size, rot step (hoje vive no popover do ⚙ atual — migra pra cá)
- "Cena padrão" → dimensões default da sala, primitivas iniciais
- "Aparência" → tema, idioma (quando existir)
- "Dados" → exportar/importar JSON do localStorage inteiro, limpar tudo

**Pros:**
- Padrão da indústria — todo software desktop tem um "Settings"
- Escalável: cada config nova encontra seu lugar
- User power encontra tudo num só ponto
- Bom pra debugging (limpar localStorage com botão)

**Cons:**
- Viola P3 — adiciona feature de gerenciamento que **não acelera montagem de cena**
- Cresce com itens que talvez ninguém use ("Exportar JSON" tem audiência de 0.5%)
- Quebra o modelo "configuração emerge sob demanda" — vira "configuração centralizada por convenção"
- Cria carga cognitiva pra leigo: "tenho que abrir Settings antes de começar?" (mesmo que não tenha — leigo vê o ícone e fica em dúvida)
- Snap config hoje fica no contexto certo (perto do botão Snap) — mover pra um menu central distancia da ação

### Opção B — Configuração 100% contextual

**Forma:** sem painel central. Cada config aparece **exatamente onde a ação relacionada acontece**:
- Chave Sketchfab → painel custom no momento do erro (feito hoje) + link "Configurar acesso" no rodapé do asset browser quando provider ativo é Sketchfab e ainda não tem chave
- Snap config → popover ⚙ ao lado do toggle Snap (já existe)
- Dimensão default da sala → modal de Nova Sala já tem inputs (já existe)
- Idioma → switch no rodapé do topbar (1 ícone, sem painel)
- Tema → switch no rodapé do topbar (1 ícone, sem painel) — quando virar caso
- Dados/limpar → não existe UI; user usa DevTools (caso de uso de 1% — debugging)

**Pros:**
- Coerente com filosofia Sims: ferramenta se apresenta progressivamente, leigo nunca encontra opção que ainda não precisou
- Cada config fica perto da ação que a usa — descoberta natural
- Não cresce em painel — cresce em "pequenos pontos contextuais" que estão sempre próximos do uso
- Honra P3 — nada é adicionado só pra ter

**Cons:**
- Power user reclama: "onde eu mudo X?" — precisa achar o contexto certo
- Trocar chave Sketchfab quando **não está em erro** fica sem caminho (a menos que ofereçamos link "Configurar acesso" no asset browser, como mencionado acima)
- Risco de configs órfãs: idioma, por exemplo, não tem ação natural perto da qual viver (acaba virando ícone no topbar mesmo assim — quase um mini-painel)
- Manutenção: cada feature nova precisa pensar onde mora sua config, em vez de "joga em Settings"

### Opção C — Híbrida (graduação)

**Forma:** começa como Opção B (contextual), e quando passar de N (proposto: 5+) itens **que não conseguiram lugar contextual natural**, gradua pra Opção A — engrenagem ⚙ no topbar agrupando só o que sobrou.

**Critério de graduação (proposta):**
- Se um item tem ação natural perto da qual viver (snap config perto do toggle Snap, dimensão de sala dentro do modal Nova Sala) → fica contextual sempre
- Se um item é **global** sem ação natural (idioma, tema, dados/limpar tudo, perfil de gerenciamento de chaves) → vira candidato a entrar no painel
- Quando 3-5 candidatos juntarem → cria engrenagem ⚙ no topbar **só com eles**
- Itens com ação natural **nunca** migram pra ⚙ (snap continua no popover, etc.) — ⚙ é só pra o que não tem lugar

**Pros:**
- Honestidade evolutiva: começa simples, complica só quando complica de verdade
- Não cria painel vazio no dia 1 (que vira "lugar pra colocar coisa") — cria painel quando há coisa real pra ele agrupar
- Mantém princípio "configuração emerge sob demanda" o máximo possível

**Cons:**
- Decidir quando graduar é subjetivo — risco de "deixar pra depois" indefinidamente
- 2 padrões coexistindo (contextual + central) pode confundir: "eu mudo snap aqui mas tema acolá?"

### Persistência: o que vive no localStorage hoje

| Chave | Conteúdo | Categoria |
|---|---|---|
| `clag:scene-v1` | JSON da cena atual (objetos + sala + transforms) | dados |
| `clag:keys:sketchfab` | Token da API do Sketchfab | credencial |
| `clag:keys:<id>` | Tokens de providers futuros | credencial |
| `clag:snap-enabled` | Toggle do snap (boolean) | preferência |
| `clag:grid-size` | Tamanho do grid em metros | preferência |
| `clag:rot-step` | Passo de rotação em graus | preferência |

**Diagnóstico:** dois grupos misturados sob namespace `clag:` sem separação clara. `scene-v1` é **dados de trabalho** (a cena do user); o resto é **configuração de comportamento** (como a engine se comporta).

**Proposta de refactor (não bloqueador):**
- `clag:scene-v1` continua igual — é o produto-dado, separado
- `clag:keys:<id>` continua igual — credenciais merecem chave separada por questão de segurança/clareza
- `clag:snap-enabled` + `clag:grid-size` + `clag:rot-step` + futuras preferências viram **um único objeto JSON** em `clag:preferences-v1`:
  ```js
  {
    version: 1,
    snap: { enabled: true, gridSize: 0.5, rotStep: 15 },
    room: { defaultWidth: 6, defaultDepth: 5, defaultHeight: 2.7 },
    ui: { lang: 'pt-BR', theme: 'dark' },
    providers: { defaultId: 'all' },
  }
  ```
- Migration automática no boot: se vê `clag:snap-enabled` solto, lê + escreve no objeto novo + deleta os soltos. Migration roda 1 vez.

**Justificativa:** 
- Menos chaves órfãs no localStorage do browser do user
- Fácil pra export/import futuro ("baixe suas preferências de clag")
- Versionamento (`version: 1`) abre caminho pra schema evolution sem quebrar saves antigos — mesmo padrão que `scene-v1` já usa
- Não muda nada da UI hoje — é mudança interna que prepara terreno

**Custo:** ~40 linhas em `prefs.js` novo (get/set/migrate). Cada módulo que hoje usa `localStorage.getItem('clag:snap-enabled')` passa a chamar `prefs.get('snap.enabled')`. Mecânico.

**Trade-off honesto:** essa refatoração é "preparação pra futuro", não resolve dor de hoje. Pode esperar até o 3º item entrar no namespace de preferências (ou seja: pode ser feito junto com a primeira config nova fora das que já existem).

### Áreas que vão precisar de config nos próximos meses (inventário)

Antes de decidir entre A/B/C, é útil mapear **o que vai precisar de UI de config** num horizonte de 6 meses, pra ter ideia da carga:

1. **Keys de provider** (1 hoje — Sketchfab; v2 traz mais — Smithsonian provavelmente não precisa, mas Hyper3D/Hunyuan/Meshy sim)
2. **Preferência de provider default** — usuário que só quer Poly Haven não quer cada busca cair em `'all'`
3. **Snap defaults globais** — já existe popover ⚙
4. **Snap por-objeto (freeTransform)** — já existe botão no inspector
5. **Dimensão default da sala** — hoje hardcoded `6×5×2.7`; modal sempre abre com isso. Aceitável.
6. **Idioma** — hoje só PT-BR. Se internacionalizar (PT-BR + EN), precisa switch. Sem urgência.
7. **Tema** — sem caso de uso real (dark é correto pra editor 3D — viewport dark deixa cor de asset evidente). Provavelmente nunca.
8. **Export glb format** — binary vs ASCII. Bem técnico; pode ficar como toggle no momento do export, não como preference.
9. **Auto-save** — hoje só manual. Auto-save a cada N segundos viraria item de config — mas provavelmente decisão deveria ser "sempre on", sem opção.
10. **CREDITS.txt formato** — TXT/MD/JSON. Decisão de uma vez, sem precisar de UI.

**Conclusão do inventário:** itens 5/7/8/9/10 provavelmente **não precisam de UI de config** — são decisões hardcoded com defaults sensatos. Itens 1/2/3/4/6 têm UI hoje (ou caminho hoje) e ficam contextuais bem. Sobra **0 itens** que precisam de "painel central novo" hoje.

Isso fortalece a Opção C: **não há motivo pra criar painel agora**. Quando houver 3 itens sem lugar contextual (provavelmente: trocar chave fora de erro + idioma + dados/limpar), aí cria.

### Recomendação

**Opção C — graduação.** Começa contextual, gradua quando passar de 3-5 itens órfãos. Critério explícito (definido acima). 

Próximos passos concretos:
1. **Já feito hoje** — botão "Configurar" no toast (caminho contextual pra chave Sketchfab no erro)
2. **Próximo (curto)** — adicionar link "configurar acesso" no rodapé do asset browser quando provider ativo é um que `needsKey: true` e ainda não tem chave (cobre caso "trocar chave fora de erro" sem precisar de painel central)
3. **Médio** — refactor leve do localStorage pra `clag:preferences-v1` (quando primeira preferência nova entrar, junto)
4. **Longo** — quando idioma virar caso real (PT-BR + EN), abrir engrenagem ⚙ no topbar com 2-3 itens que sobraram

Confiança nessa direção: **alta** — está alinhada com P3 (pipeline simples), P9 (documentar pra IA — convenção contextual é mais simples de propagar), e com a missão do `SIMS-MODE.md` (leigo nunca encontra opção desnecessária).

Risco: **baixo** — todo trabalho é incremental, nada é "decisão arquitetural" irreversível. Se virar Opção A no futuro, é só migrar os itens pra dentro do painel novo.

### Comparação rápida com produtos análogos

Útil pra calibrar a decisão:

- **Blender** tem `Preferences` central com ~10 abas. Target: técnico avançado. **Não é nossa referência** — viola P3 (pipeline simples).
- **Figma** tem só **3 itens de config global**: tema, preferências de canvas, conta. Resto é contextual (alinhamento na toolbar, snap no menu de view, atalhos no submenu). **É nossa referência** — ferramenta visual escalou pra milhões sem virar painel de admin.
- **The Sims 4** tem aba "Opções de Jogo" enorme — mas Sims é jogo, não ferramenta de produtividade. Não tira lição direta daí; tira só do paradigma de **objeto-como-handle** (próxima proposta).
- **Tinkercad** tem 1 ícone de gear escondido no canto que abre 4 toggles. Funciona porque o produto é deliberadamente minimalista. **É um exemplo da Opção A funcionando bem quando há poucos itens reais.**

A conclusão se mantém: começa contextual, gradua se justificar.

### Caso de uso específico não coberto hoje: trocar chave fora do fluxo de erro

Esse caso merece atenção específica porque é o caso em que Opção B "puramente contextual" rachuna.

**Cenário:** user já configurou token Sketchfab há 1 semana. Hoje quer trocar pelo token de uma conta diferente (testes, conta corporativa, etc.). Sem painel central, **como ele chega ao formulário?**

Opções:
1. **Botão "Configurar" no asset browser quando provider ativo é Sketchfab** — visível na faixa do header ou rodapé, com mini-indicador "token configurado ✓". Click reabre o mesmo painel custom de hoje, pré-populado com o token atual (mascarado).
2. **Botão "🔑" pequeno no menu de provider** — no dropdown atual de providers, ao lado do nome de cada provider com `needsKey: true`, um ícone-chave que abre o painel. Não polui se feito com sutileza.
3. **Reabrir via console** (`window.clag.actions.openProviderKeyPanel('sketchfab')`) — funciona pra dev/QA mas não pra usuário final.

Recomendação concreta: **opção 2** (ícone-chave no menu de provider) — é onde o user mentalmente já associa Sketchfab. Custo: ~10 linhas em `search.js::buildProviderMenu`. Sem painel central, caso resolvido.

### Ganchos pra implementação futura

Se essa direção for adotada, deixar pronto:

- `public/src/prefs.js` (NOVO) — abstrai localStorage com namespace `clag:preferences-v1`. API:
  ```js
  prefs.get('snap.gridSize') → number
  prefs.set('snap.gridSize', 0.5)
  prefs.on('changed', (path) => ...)
  prefs.migrate() // chama 1x no boot, move chaves órfãs pro objeto v1
  ```
- `public/src/config-ui.js` (FUTURO) — quando painel central existir, vive aqui. Vazio por enquanto.
- `clag.actions.config.set(path, value)` / `clag.actions.config.get(path)` — superfície programática uniforme pra QA + automação
- Convenção: provider que precisa de key declara `keyHint: { label, url }` em vez de string solta (hoje Sketchfab tem string `keyHint`; refatorar pra objeto facilita reutilização no painel custom — hoje o mapa `PROVIDER_KEY_HINTS` em `main.js` é hardcoded por provider, o que não escala bem se forem 4-5 providers needsKey)
- Convenção: cada provider que faz parte do "ecosistema needsKey" exporta `getKey()` / `setKey(k)` (Sketchfab já faz). Painel custom poderia usar `provider.setKey(v)` em vez de tocar `localStorage` direto — mais coerente com P4 (cada provider é plugin isolado).

---

## 2. GIZMO — uma alternativa mais leiga ao TransformControls, mantendo W/E/R como avançado

### Problema observado hoje

O gizmo atual é o `TransformControls` do three.js (lib oficial). Ele é poderoso e correto, mas tem 3 eixos coloridos (X vermelho, Y verde, Z azul) + handles abstratos:

- Translate: 3 setas + 3 planos transparentes
- Rotate: 3 anéis coloridos concêntricos
- Scale: 3 handles cúbicos nas pontas + handle uniforme no centro

Pra quem **sabe 3D**, é uma ferramenta clássica. Pra **roteirista não-técnico** (target persona explícita em `SIMS-MODE.md`), os 3 eixos são abstratos: "qual é X mesmo?", "Y é altura ou Z?" — e a primeira interação tende a ser confusa porque o gizmo aparece sobre o objeto e parece poluído.

A engine fez muito bem em mitigar isso:
- Snap on por default (P3 SIMS-MODE, Fase 2)
- Rotação discreta em 15° (Fase 2)
- Modos W/E/R com atalho de teclado
- Anchor system (chão/parede/teto) que evita ajuste manual de Y na maioria dos casos (Fase 3-4)

Tudo isso é "pintar o problema de forma diferente" — o gizmo continua técnico. **O Sims, referência decorada na missão, não tem gizmo.** Lá o user pega o objeto e arrasta. Rotação é tecla R ou ícone discreto. Altura aparece só quando necessário.

### Tese

Leigo deve **pegar objeto e arrastar** — sem clicar em handle, sem entender eixo X/Y/Z. Rotação aparece como anel sutil ao hover ou ícone discreto na seleção. Altura aparece quando relevante (objetos com freeTransform=true ou anchor que permite ajuste vertical), senão fica oculta.

**TransformControls + W/E/R continua existindo** como "modo precisão" pra quem quer. Não removemos nada — adicionamos uma camada mais simples por cima. Atalho de teclado funciona como hoje.

**Pacto importante:** essa nova camada **respeita o snap por default** (assim como o TransformControls hoje respeita via `objectChange` hook). User não precisa pensar em snap — ele acontece naturalmente.

### Análise rápida de referências

**The Sims 4** (referência decorada)
- Drag direto no objeto pra translate
- Rotação por tecla Tab/comma/period (mouse-only mode é estranho)
- Altura via Ctrl+arrasta (em Sims 4)
- Sem handles abstratos visíveis no objeto
- **Lição:** o objeto **é** o handle. O gizmo é a ausência de gizmo.

**Spline** (3D web design tool)
- Gizmo padrão three.js stylized (3 eixos coloridos)
- Target: designers que já entendem 3D
- **Lição:** não é nossa referência. Mesma tela que clag tem hoje.

**Womp** (3D design tool no browser)
- Drag direto no objeto pra translate
- Quando selecionado, handles aparecem **ao redor** do bounding box (não dentro): seta vertical pra altura, anel pra rotação, cantos pra scale
- **Lição:** "context handles" — selecionar revela handles posicionados em volta do objeto, não dentro. Reduz oclusão visual e fica claro qual ação cada handle faz.

**PlayCanvas Editor** (Unity-like web editor)
- Gizmo padrão Unity (W/E/R + handles)
- Target: gamedev técnico
- **Lição:** não é nossa referência (mesmo perfil que Unity-style).

**Figma** (2D, mas paradigma de "ferramenta-pra-todos")
- Click+drag no objeto = translate
- Quando selecionado, handles nos cantos = scale (uniforme se Shift, anisotropic sem)
- Handle externo no canto = rotate (cursor curvo aparece ao hover)
- **Lição:** Figma é o **gold standard** de "ferramenta visual que leigo aprende em 5min". Padrão é exatamente "objeto é o handle, contexto revela operações secundárias".

**Tinkercad** (3D pra educação)
- Drag direto no objeto pra translate XZ
- Handle vertical claro com seta = altura
- Setas em "esticar/encolher" nos cantos = scale
- Rotação por handles arc-style nos lados (3 anéis)
- **Lição:** Tinkercad atinge target ainda mais leigo que Sims (crianças). O gizmo é "didático" — cada handle é um ícone reconhecível em vez de eixo abstrato.

**Síntese:** ferramentas pra leigo convergem em "objeto como handle primário + handles contextuais ao redor". Ferramentas pra técnico convergem em "gizmo Unity-style". clag mira leigo → primeira referência.

### Opção A — Drag direto no mesh + handles contextuais ao selecionar (modo "contextual")

**Forma proposta:**

- Click no objeto seleciona (como hoje)
- Click+drag **no mesh do objeto** = translate XZ
  - Snap aplica como hoje, se `freeTransform=false` (default)
  - Y é fixado pelo anchor do objeto (não muda em drag XZ)
- Quando selecionado, aparece **ao redor** do bounding box do objeto:
  - **Anel verde sutil** no chão sob o objeto = rotate Y (drag rotaciona)
  - **Seta cinza pra cima**, posicionada acima do bounding box = adjust height (visível só se `freeTransform=true` ou anchor='ceiling' que permite ajuste de altura no anel teto)
  - **4 cantos quadrados** discretos = scale uniforme (drag em qualquer canto escala)
- Esc deseleciona (como hoje)
- TransformControls W/E/R continua disponível: pressionar W/E/R liga gizmo técnico atual, Esc volta pra contextual

**Ponto técnico crucial:** como **distinguir** "drag pra orbitar câmera (no espaço vazio)" de "drag pra mover objeto (no mesh)"?

**Resolução natural:**
- `pointerdown` no canvas faz raycast contra `userRoot.children` (excluindo `room:*`)
- Se hit → modo "drag-translate XZ"
- Se miss → `OrbitControls` faz seu trabalho (orbit como hoje)
- Threshold de movimento (ex: 4px) antes de começar drag — evita "click acidental vira drag"

Isso já é compatível com o paradigma atual (OrbitControls já lida com click vazio). A novidade é interceptar pointerdown **com hit** e converter em translate.

**Pros:**
- Alinha com Sims (referência decorada)
- Alinha com Figma/Womp (gold standard de "ferramenta visual leiga")
- TransformControls fica como "modo precisão" — não destruímos investimento técnico
- Snap continua respeitado naturalmente
- Sem handles abstratos no objeto — limpa visualmente
- Honra missão `SIMS-MODE.md`: roteirista monta cena rápido, não precisa entender 3D

**Cons:**
- Implementação tem complexidade real: raycast por frame durante drag, ghost preview do snap, lidar com objetos pequenos onde mesh é difícil de pegar
- Existem casos onde "drag pra mover" vs "drag pra orbitar" pode confundir: se user tenta orbitar a câmera e acerta um mesh sem perceber, vai mover o objeto. Mitigação: cursor diferente ao hover em mesh (visual feedback claro).
- Handles contextuais em screen-space (sprites/HTML overlay) precisam ser sincronizados com o objeto via update por frame — não é grátis
- Pode parecer "menos profissional" pra técnico que abre clag esperando gizmo padrão. Mitigação: W/E/R continua valido — quem vê e pressiona W ganha gizmo familiar.

### Opção B — Manter TransformControls mas com hint visual contextual

**Forma:**
- TransformControls continua renderizando handles padrão
- Adicionamos overlay HTML/sprite que **rotula** cada handle: ícone "←→ horizontal" no eixo X, "↕ altura" no eixo Y, "↑↓ profundidade" no eixo Z
- Cores ficam, ícones explicam
- Pode incluir mini-tutorial ao primeiro uso: "X (vermelho) = horizontal, Y (verde) = altura, Z (azul) = profundidade"

**Pros:**
- Mudança técnica mínima — só overlay
- Ensina o user sobre o paradigma 3D (educacional)
- Mantém ferramenta familiar pra quem já conhece three.js / Unity / Blender

**Cons:**
- Leigo continua precisando **entender 3D antes de mexer** — só facilita a curva, não elimina a curva
- Não atende a missão: roteirista não quer aprender 3D, quer montar cena
- Hint visual em cima de handles abstratos ainda é menos elegante que "objeto como handle"

### Opção D — Snap-to-surface + anti-overlap + cadeado (proposta do user)

**Forma proposta:**

A tese central: **snap-to-grid não é o snap certo pra clag.** O snap certo é **snap-to-surface** (o objeto sempre tenta grudar a pelo menos uma superfície — chão, parede, teto, ou outro objeto). E objetos **não se sobrepõem por default** — colisão AABB (axis-aligned bounding box) impede que cadeira atravesse mesa.

Concretamente:
- Click no objeto seleciona
- Click+drag no objeto = move objeto livremente seguindo o cursor, mas com **2 restrições constantes**:
  1. **Snap-to-surface:** posição final tenta encostar em uma superfície (chão por default; parede mais próxima se anchor='wall'; outro objeto se hit). Cursor "puxa" o objeto pra superfície sob ele.
  2. **Anti-overlap:** sweep test antes de cada update — se nova posição faz AABB do objeto intersectar AABB de qualquer outro, **clampa** ou **slide** ao longo da face de colisão (mesma lógica de "wall sliding" em FPS games).
- Quando objeto está selecionado, aparece **1 ícone-cadeado no centro do bounding box** (HTML overlay em screen-space):
  - Cadeado fechado (default): snap-to-surface + anti-overlap ativos
  - Cadeado aberto (clique no ícone): libera TUDO — `freeTransform=true` + ignora colisão. Objeto vira fantasma manipulável, pode sobrepor, pode flutuar.
  - Clique de novo: re-trava.
- Rotação ainda é necessária — pode ficar como anel sutil no chão (Opção A) ou tecla R + setas. Decisão fácil de adiar.
- Snap-to-grid (snap atual da Fase 2) continua existindo mas como **opt-in secundário**: cadeado destravado + botão "Snap" do topbar ON = ajuda de grade. Default não usa grade.

**Por que isso é forte:**

Resolve **três problemas de UX leigo de uma vez**:
1. Não precisa entender eixos — objeto cola onde o cursor aponta
2. Não precisa configurar grid — superfície dita posição
3. Não erra "cadeira atravessa mesa" — impossível por default

**Casa naturalmente com Fase 4 (Modo Sala):** paredes e teto já existem como `room:*` com AABB calculável. Lustre cola no teto, quadro cola na parede, sofá cola no chão — tudo sem o user precisar mexer no anchor manualmente. **O sistema de anchor atual passa a ser implícito** em vez de explícito.

**Cadeado** é o resumo gráfico de "destravar" — ícone universalmente entendido. Substitui dois conceitos atuais (`freeTransform` por objeto + `snap toggle` global) num único gesto contextual. Power user usa cadeado quando precisa; leigo nunca toca.

**Análise técnica:**

Anti-overlap via AABB sweep test é **realizável sem engine de física**. Não é Bullet, não é Cannon. Algoritmo:
1. No `addToScene`, calcular `userData.aabb = new THREE.Box3().setFromObject(obj)` e armazenar
2. No move (cada frame de drag), calcular AABB candidato (na posição target)
3. Pra cada objeto outro com AABB registrado, testar `aabb.intersectsBox(otherAabb)`
4. Se intersecta com **algum**, calcular qual eixo (X ou Z) está penetrando menos — slide naquela direção (clampa penetração no eixo "mais bloqueado", permite movimento no eixo "mais livre")
5. Se está completamente bloqueado, fica parado na última posição válida

Performance: O(N) por frame de drag. Pra N ≤ 100 objetos, 10k checks/seg num laptop é trivial. Pra N > 100, virtualizar com bounding hierarchy (spatial hash, octree) — fora de escopo de v1.

Snap-to-surface via raycast vertical:
1. Do AABB candidato, raycast pra baixo (Y-) até hit em chão ou topo de outro objeto
2. Se hit: ajusta Y do objeto pra `hit.point.y` (planta na superfície)
3. Se anchor='wall': raycast horizontal (4 direções cardinais) pra parede mais próxima — cola
4. Se anchor='ceiling': raycast pra cima, prende no teto

Edge cases comparáveis aos da Opção A (objeto minúsculo, objetos sobrepostos pra seleção, etc.) — mesma análise se aplica.

**Pros:**
- **Diferenciação real:** Spline, Womp, Tinkercad **não têm** anti-overlap. clag teria um superpoder.
- Cobre paradigma Sims (móvel não vaza parede, lustre cola no teto, etc.) **sem precisar curar cada asset com anchor explícito** — a engine descobre por raycast/AABB.
- Cadeado unifica 2 toggles atuais em 1 gesto contextual — UX mais simples
- Snap-to-surface é mais robusto que snap-to-grid pra cenas com escala variável (grid 0.5m fica grosseiro pra detalhe, fino pra geral; superfície dimensiona-se sozinha)
- Casa com missão `SIMS-MODE.md`: roteirista monta cena em segundos sem pensar em coordenadas

**Cons:**
- **Custa implementação real:** sweep test não é trivial, especialmente edge cases (tunneling em alta velocidade, AABB que ficou desatualizado após scale do objeto, etc.). Realista: ~2 semanas pra protótipo decente.
- **Pode prender o user em arranjos não-intencionais** — ex: cubo "preso" entre dois móveis sem caminho de saída. Mitigação: cadeado libera; ou auto-detect "sem saída" e log aviso.
- **Assets com bounding box exagerado** (lustres com cordão longo, candelabros, etc.) podem colidir cedo demais. Mitigação: usar `box` com tolerância (-0.05u por face), ou bounding box manual no `userData.aabbHint` que provider/catalog pode declarar.
- **AABB axis-aligned não rotaciona com objeto** — se user rotaciona sofá 30°, AABB continua alinhado. Aproximação aceitável pra v1 (estilo Sims clássico — móveis rotacionam em passos discretos onde AABB é coerente).
- **Acumula débito conceitual:** "por que esse cubo não atravessa esse outro?" pode confundir power user que vem de Blender. Mitigação: tutorial first-run de 1 toast ("clag mantém objetos sem sobreposição — clique no cadeado pra liberar").

**Comparação direta A vs D:**

| Aspecto | A (drag direto) | D (surface+colisão+cadeado) |
|---|---|---|
| Aprende em 30s? | Sim | Sim |
| Anti-overlap | Não | **Sim** |
| Snap natural a paredes | Anchor explícito (Fase 3-4) | Implícito por raycast |
| Custo implementação | 1 semana | 2 semanas |
| Diferenciação vs concorrência | Média | **Alta** |
| Risco de "prender" o user | Baixo | Médio (cadeado mitiga) |
| Compatível com TransformControls existente | Sim | Sim |
| Cobre 90% dos casos de Sims | Parcial | **Quase total** |

### Opção C — Gizmo "tap to move" totalmente teclado/mouse-free

**Forma:**
- Leigo clica no objeto pra selecionar
- Clica no destino no chão (raycast) → objeto teleporta pro destino (com snap)
- Rotação com setas teclado (← → rotaciona Y em passos de 15°)
- Altura com PageUp/PageDown
- Inspirado em jogos de estratégia (Civ, Stellaris)

**Pros:**
- Máximo de simplicidade conceitual
- Zero risco de "movimentos parasitas" (orbitar vs mover)
- Funciona em qualquer device sem precisar dragging suave

**Cons:**
- Frustrante pra ajuste fino contínuo (cada movimento = 2 clicks)
- Não permite "arrastar uma cadeira pra perto da mesa e ir vendo o resultado" — feedback ruim
- 2 clicks por movimento quebra fluidez que Sims tem
- Rotação por teclado em mouse-only mode é estranho

### Análise pelos princípios

Checando cada opção contra os 9 princípios:

| Princípio | A (drag direto) | B (hint) | C (tap-to-move) | D (surface+colisão+cadeado) |
|---|---|---|---|---|
| P1 zero build | OK | OK | OK | OK |
| P3 pipeline simples | **vence** (acelera leigo) | parcial | OK | **vence** (acelera leigo) |
| P6 state explícito | precisa novo handler de drag | sem mudança | OK | precisa AABB store novo |
| P7 persistência leve | OK | OK | OK | AABB serializável (Box3 → array) |
| P8 componentes custom | OK (handles via sprite/HTML) | OK | OK | OK (cadeado é HTML overlay) |
| Missão SIMS-MODE | **vence** (parcial — anchor explícito) | parcial | OK | **vence forte** (cobre paradigma Sims inteiro) |

Nenhuma opção viola princípio. Opção D acrescenta um módulo novo (`physics.js` light, AABB-only) — não viola P3 porque o módulo serve diretamente à velocidade de montagem (objeto cola onde deve, sem o user pensar).

### Recomendação

**Opção D — Snap-to-surface + anti-overlap + cadeado.**

A intuição central — "o snap certo pra clag não é grid, é superfície; e o paradigma certo é objetos que não se sobrepõem por default" — vai ao **coração da missão SIMS-MODE.md** mais diretamente que qualquer outra opção:

- Diferenciação real vs Spline/Womp/Tinkercad (nenhum tem anti-overlap)
- Resolve **três pontos de fricção do leigo de uma vez**: sem eixos, sem grid pra configurar, sem "vazei a parede"
- Cadeado é o resumo gráfico unificado de "destravar" — substitui 2 conceitos atuais (snap global + freeTransform por-obj) por 1 gesto contextual perto do objeto
- Casa naturalmente com Modo Sala (Fase 4) — paredes/teto/piso viram superfícies de cola automáticas, o sistema de `anchor` explícito vira fallback em vez de obrigatório
- Preserva TransformControls (W/E/R) como escape hatch técnico
- Compatível com snap-to-grid existente — vira opt-in secundário (mantém Fase 2)

**Por que não A:** Opção A é boa mas não cobre anti-overlap. clag perderia diferenciação real. A complexidade extra de D vs A (1 semana extra de implementação) compra um produto **categoricamente diferente** — não só "mais bonito".

**Confiança:** alta na direção; média no prazo (sweep test tem edge cases). Risco de prender o user mitigado pelo cadeado.

**Validação proposta antes de ir pra main:**
- Branch separado (`feat/surface-snap-gizmo`)
- Implementação de ~2 semanas: AABB store + sweep test + surface raycast + cadeado overlay
- User testa pessoalmente: montar 3 cenas (sala simples, cozinha completa, escritório com lustre+quadros) só com surface-snap
- Critério de merge: leigo consegue montar cena de Sala em <2 minutos sem ler instrução nenhuma
- Se sweep test mostrar limites (tunneling, performance) → fallback pra Opção A no mesmo branch

**Sequência interna de D (priorizar fase a fase):**
1. **Sub-fase D.1** — surface raycast (objeto cola na superfície sob cursor, sem anti-overlap ainda). 3 dias.
2. **Sub-fase D.2** — AABB store + sweep test horizontal (anti-overlap XZ apenas). 4 dias.
3. **Sub-fase D.3** — cadeado HTML overlay + toggle de freeTransform unificado. 2 dias.
4. **Sub-fase D.4** — anti-overlap vertical (lustre não atravessa lustre, etc.). 2 dias.
5. **Sub-fase D.5** — polish + edge cases (tolerância de AABB, tunneling mitigation). 2 dias.

Cada sub-fase mergeable independentemente — produto **degrada graciosamente** se algo der errado no meio.

### Edge cases que precisam decisão na implementação

Se Opção D (ou A) for adotada, esses casos vão aparecer e merecem decisão prévia:

1. **Objeto minúsculo (escala < 0.1u)** — bounding box pequeno demais pra ser hit fácil. Solução: raycaster com tolerância (already supported via `raycaster.params.Line/Points.threshold`), ou bbox visual sempre desenhado em torno do selecionado pra hover (clicar no bbox conta como hit). Recomendação: bbox visual ao hover, transparente, expande a área clicável visualmente.

2. **Objetos sobrepostos** — dois objetos no mesmo XZ. Qual recebe o drag? Solução: raycaster retorna lista ordenada por distância da câmera; pega o mais perto. Esperado.

3. **Drag começa em mesh A mas user quer orbitar** — sem querer clicou no mesh. Solução: Esc cancela drag (volta posição original); ou threshold de movimento (>4px) antes de "commit" ao drag. Recomendação: ambos.

4. **Drag rápido fora do plano XZ** — user arrasta pra fora da janela. Solução: continuar no plano XZ infinito; objeto pode sair da câmera, mas posição final é determinística. Esperado.

5. **Objeto com anchor='wall'** (parede) — drag XZ não faz sentido (o objeto deveria deslizar AO LONGO da parede). Solução fase 1: drag-XZ ignora anchor (livre), e ao soltar, re-aplica anchor (cola na parede mais perto). Solução fase 2 (mais sofisticada): drag desliza ao longo da parede em que está ancorado.

6. **Objeto com anchor='ceiling'** — drag XZ funciona naturalmente (lustre desliza no plano do teto). Anchor é re-aplicado ao soltar pra garantir Y=ceiling.

7. **Objeto sala (room:wall/floor/ceiling)** — não deveria ser draggable em modo contextual (você não move uma parede arrastando ela). Solução: raycast ignora `room:*` por padrão (já tem `userData.kind` pra filtrar). Selecionar parede via outliner continua válido (pra editar cor/material no inspector).

8. **Performance com 200+ objetos** — raycast por frame durante drag é custoso. Solução: raycaster só roda no `pointerdown` (decide hit ou miss); durante `pointermove`, projeta movimento no plano XZ direto sem novo raycast. Implementação simples e rápida.

9. **Undo/redo** — drag-translate cria 1 entrada no undo stack? Ou cada frame de drag? Solução: snapshot só ao `pointerup` (commit final). Drag em si não vai pro stack. Igual Figma.

10. **Touch/mobile** — pointerdown unifica mouse + touch. Mas pinch-to-zoom (2 dedos) vs 1-finger-drag-pra-orbitar vs 1-finger-drag-em-mesh-pra-mover precisa coordenação. Recomendação: deixar fora do escopo de v1 (clag é browser desktop por enquanto).

### Risco assumido: regressão pra power user

Power user que abre clag esperando comportamento Unity-like (W/E/R imediatamente disponível, gizmo padrão sempre visível) vai estranhar a tela vazia ao selecionar objeto. Mitigação:

- Atalho W/E/R continua funcional desde o primeiro segundo (sem precisar configurar nada)
- Indicador visual sutil "pressione W/E/R pra ajuste fino" no inspector quando objeto está selecionado em modo contextual
- Modo contextual mostra TransformControls **transparente** (alpha 0.1) por trás dos handles contextuais — power user vê eixos fantasma e sabe que estão lá

Risco real: **médio**. clag não tem base de power users instalada ainda; o reposicionamento é mais barato agora que daqui a 6 meses.

### Ganchos pra implementação futura

Se Opção D for adotada:

1. **Modo de gizmo passa a ter 4 estados** (hoje tem 3):
   - `'contextual'` (NOVO, default) — drag direto + surface snap + anti-overlap
   - `'translate'` (TransformControls W)
   - `'rotate'` (TransformControls E)
   - `'scale'` (TransformControls R)
   
   API atual `setGizmoMode(mode)` em `api.js` aceita o novo valor. `getGizmoMode()` retorna `'contextual'` por padrão.

2. **Novo módulo `public/src/physics.js`** (~150 linhas, AABB-only — não é Bullet/Cannon):
   ```js
   physics.register(obj)        // calcula AABB e armazena por sceneId
   physics.unregister(obj)
   physics.update(obj)          // recalcula AABB (chamado em sceneChanged)
   physics.sweep(obj, target)   // testa nova posição contra todos AABBs, retorna posição clamped
   physics.surfaceUnder(obj)    // raycast pra baixo, retorna superfície + Y de snap
   physics.surfaceForward(obj, dir) // raycast horizontal pra anchor='wall'
   ```
   `scene.js` chama `physics.register(obj)` no `addToScene`, `physics.unregister` no remove, `physics.update` quando transform muda.

3. **Novo módulo `public/src/contextual-gizmo.js`** com:
   - Handler `pointerdown` no canvas — raycast no `userRoot.children` (exclui `room:*`)
   - Se hit em objeto e cadeado fechado: modo "drag-to-surface" — calcula target seguindo cursor, chama `physics.surfaceUnder(target)` pra snap Y, chama `physics.sweep` pra anti-overlap
   - `pointermove` enquanto drag → atualiza `obj.position` com result do sweep+surface
   - `pointerup` → finaliza, dispara `sceneChanged`
   - OrbitControls fica desabilitado **durante drag**

4. **Cadeado overlay (HTML, não THREE.Sprite):**
   - HTML `<div class="lock-overlay">` posicionado em screen-space via `vec3.project(camera)` (recalculado por frame, overhead mínimo)
   - 2 estados visuais: 🔒 (fechado, snap+colisão ativos) e 🔓 (aberto, freeTransform=true)
   - Click → toggle `obj.userData.freeTransform` + update visual
   - Quando `freeTransform=true`, `physics.sweep` é bypassado nesse objeto (mas continua bloqueando outros)
   - Sumiu quando objeto não está selecionado

5. **TransformControls fica instanciado mas hidden** quando em modo contextual. Pressionar W/E/R liga e mostra. Esc volta pra contextual.

6. **Compatibilidade com Fase 2/3/4 existente:**
   - Snap-to-grid (Fase 2) continua existindo: aplica **só quando** cadeado destravado E botão "Snap" do topbar ON. Default não usa grid.
   - Sistema `userData.anchor` (Fase 3) vira fallback explícito — physics.surfaceUnder/Forward descobre superfície automaticamente quando possível; `anchor` só "força" quando user editou no inspector.
   - Modo Sala (Fase 4) — `room:wall/floor/ceiling` viram superfícies registradas em `physics` automaticamente. Lustre cola no teto por hit, não por anchor.

7. **API programática:**
   - `clag.actions.setGizmoMode('contextual')` (default)
   - `clag.actions.toggleLock(sceneId)` — abre/fecha cadeado programaticamente
   - `clag.state.gizmoMode()` retorna o modo atual
   - `clag.state.objectAABB(sceneId)` retorna `[min, max]` pra inspeção via QA
   - `clag.state.isLocked(sceneId)` retorna `!obj.userData.freeTransform` (aliased pra leitura natural)

8. **Persistência:** AABB é derivado (recalculado no boot), não precisa ir pro JSON. Estado do cadeado já é `userData.freeTransform` que persist.js já serializa (Fase 3).

9. **Cursor visual:**
   - Hover em mesh (selecionável, cadeado fechado) → cursor `grab`
   - Drag em curso → cursor `grabbing`
   - Drag bloqueado por colisão (slide ativo) → cursor `not-allowed` brevemente (feedback)
   - Hover fora de mesh → cursor padrão (orbita)
   - Hover no cadeado → cursor `pointer`

10. **Mobile/touch:** Pointer Events API unifica. Fora de escopo de v1, mas a arquitetura não impede.

---

## Relação entre as duas propostas

CONFIG e GIZMO parecem ortogonais — uma é sobre estado/preferências, outra é sobre interação direta. Mas há um fio que une:

**Ambas perguntam "qual quantidade de fricção é aceitável pro target persona?"**

CONFIG: pra leigo, fricção é "tenho que aprender onde mexer no app antes de usar". A resposta proposta (Opção C) diz: zero fricção de descoberta — config emerge quando ação a exige.

GIZMO: pra leigo, fricção é "tenho que entender X/Y/Z antes de mover um sofá". A resposta proposta (Opção A) diz: zero fricção 3D — objeto é o handle, eixos somem.

**Princípio implícito unificador:** ferramenta criativa deve **transferir o mínimo possível de carga conceitual da engenharia pra o usuário**. Cada vez que uma UI exige que o user "aprenda algo antes de usar", a ferramenta perdeu — o user vai pra outra.

clag tem vantagem competitiva real porque é **gratuito, no browser, com providers livres** — mas isso só importa se a barreira de uso for baixa. As duas propostas são sobre baixar barreira.

**Implicação tática:** se vier a escolher só uma das duas pra investir nas próximas 2 semanas, escolher GIZMO. CONFIG hoje já está num estado aceitável (com o toast-action de hoje); GIZMO Opção D ainda é o ponto que separa "ferramenta-de-modelagem-de-mais-uma" de "ferramenta-de-bloqueio-de-cena com diferenciação real" (anti-overlap é diferencial técnico real vs Spline/Womp/Tinkercad).

**Implicação estratégica:** as duas propostas reforçam que clag deveria começar a **testar com roteiristas reais** antes de continuar adicionando features. Ambas têm "validação por user real" como passo de Definition of Done — não é decisão que se toma sentado.

---

## Sequência sugerida (não compromisso)

Em ordem aproximada de impacto vs custo:

1. **CONFIG fase 1 (curto, 1 dia):** já feito hoje — toast com botão "Configurar". Próximo passo natural: ícone-chave 🔑 no menu de provider pra reabrir painel fora do fluxo de erro. Cobre caso "trocar chave" sem painel central.

2. **GIZMO fase 1 (médio, 2 semanas):** protótipo Opção D num branch (`feat/surface-snap-gizmo`). Sub-fase D.1 (surface raycast) → D.2 (anti-overlap XZ) → D.3 (cadeado overlay). Decisão de merge depende de teste pessoal: leigo monta cena de sala em <2min sem instrução? Se sim → merge. Se sweep test mostrar limites técnicos → fallback pra Opção A no mesmo branch (drag direto sem colisão).

3. **CONFIG fase 2 (curto, 0.5 dia):** refactor de localStorage pra `clag:preferences-v1` (quando primeira nova preferência entrar). Migration silenciosa no boot.

4. **v1.1 do `ROADMAP.md` em paralelo:** export glb, undo/redo, painel de licenças — todos independentes das propostas acima, podem rodar em paralelo. Especial atenção: **undo/redo é dependência implícita do gizmo Opção D** (se sweep test prender o user em arranjo, undo é a saída natural além do cadeado).

5. **CONFIG fase 3 (futuro):** se idioma virar caso real (EN+PT-BR), criar engrenagem ⚙ no topbar com 2-3 itens órfãos. Só nesse momento.

---

## Histórico

- **2026-05-20:** documento criado. Propostas CONFIG e GIZMO escritas em parceria com o user (sessão tarde-noite, pós-deploy clag.did.lu). Recomendações tentativas: CONFIG → Opção C (graduação contextual→central quando justificar); GIZMO → Opção D (surface-snap + anti-overlap + cadeado, absorvendo a tese do user de `docs/_inbox-gizmo-user-2026-05-20.md`). Implementação pendente — discutir antes.
