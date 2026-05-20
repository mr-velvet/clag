# Princípios — clag

Princípios fundadores da engine. Tudo na arquitetura segue daqui. Se uma decisão técnica conflita com isso, é a decisão que está errada.

---

## 1. JavaScript-first, sem build step

**Não há `npm run dev`. Não há Vite. Não há esbuild.**

O navegador moderno entende ES modules nativos. `importmap` resolve dependências via CDN (jsdelivr). Editar `.js`, salvar, **F5 mostra o resultado**. Sem watcher, sem hot-reload-com-bug, sem source map quebrado, sem 200MB de `node_modules`.

**Trade-off aceito**: a engine não usa TypeScript, JSX, SCSS, ou nenhuma sintaxe que precise compilar. Aceita-se um pouco menos de açúcar sintático em troca de:
- Bootstrap de projeto novo em 0 segundos
- Debugging direto no Chrome DevTools, sem source map
- Zero dependência de toolchain Node
- Funciona em qualquer servidor estático

A engine se beneficia de **velocidade de iteração** mais do que de tipagem. Quem quiser tipagem usa JSDoc + `// @ts-check`.

**Implicações práticas:**
- Todo dependency externa entra no `importmap` no HTML, vinda de CDN
- Nenhum arquivo `.ts`, `.tsx`, `.jsx`, `.scss`
- Nenhum lockfile, nenhum `package.json` no root (só no servidor de produção, e ele só serve estático)

## 2. Assets públicos como cidadão de primeira classe

Buscar e adicionar um asset livre **deve ser tão fácil quanto desenhar um cubo**. Não é uma feature secundária; é a feature principal.

Toda biblioteca livre digna de nota — Poly Haven, Khronos Samples, Sketchfab CC, Smithsonian Open Access, OpenGameArt, Kenney, Quaternius, e o que mais surgir — entra na engine via um **provider plugin**. O usuário muda o dropdown ou deixa em "all providers" e digita um termo. Os resultados aparecem na grade. Arrasta pra cena, pronto.

**Implicações práticas:**
- Toda integração com fonte externa segue o **contrato de provider** (ver [ARCHITECTURE.md](./ARCHITECTURE.md))
- Provider é um módulo ES isolado em `public/src/providers/`. Adicionar não toca core
- Cada provider declara: auth necessária, formato dos arquivos, licença predominante
- Licença aparece visualmente em cada card de resultado
- Engine prefere **glTF/GLB** mas aceita FBX/OBJ quando provider não oferece glTF

## 3. Pipeline simples acima de features

Clag **não compete com Unity** em terreno aberto, sistema de animação rico, partículas, shader graph, gestão de cenas complexa, etc.

Clag compete em **velocidade pra montar uma cena boa o suficiente** — pra um mockup, uma vinheta, um screenshot pra apresentação, um cenário pra prototyping de mecânica de jogo, um background pra YouTube/podcast.

**Implicações práticas:**
- Sem editor de animação. Sem nodes-graph de shader. Sem renderer custom complexo.
- TransformControls + Inspector básico já é "feature completa" pra v1
- Cada feature nova exige justificativa contra **"isso atrapalha a velocidade de uso?"**
- Engine **não impede** o usuário de fazer coisas avançadas — só não dá UI dedicada pra elas
- Export glTF é a saída-padrão. Quem quiser refinar leva pro Blender/Unity/Three.js direto.

## 4. Cada provider é um plugin isolado

Adicionar uma fonte nova de assets **não pode exigir alterar o core da engine**. Sempre é: criar um arquivo `public/src/providers/<nome>.js`, exportar `{ id, label, search, download }`, registrar no `providers/index.js`.

Se um provider quebra (API caiu, mudou auth, etc.), os outros continuam funcionando. Erros em `search()` ou `download()` são contidos e reportados ao usuário via toast, sem derrubar a UI.

**Implicações práticas:**
- Provider expõe **apenas** `search` e `download` — nenhuma outra API
- Resultado de `search` é uma estrutura única e bem definida (ver ARCHITECTURE)
- Provider que precise de chave usa `localStorage:scene-ide:keys:<id>` — engine fornece UI pra inserir
- Provider que precise de proxy (CORS hostil) **não é integrado**. Se chega no ponto de precisar de backend, vira issue de discussão de produto.

## 5. Licença explícita em todo lugar

Mistura de licenças é problema legal real pra usuário. A engine não esconde isso.

**Implicações práticas:**
- Cada `AssetResult` carrega `license: string`
- Card de resultado mostra a licença em letra menor mas visível
- Inspector mostra licença + autor + URL fonte pro asset selecionado
- Export `.glb` da cena inclui `CREDITS.txt` com lista de assets, fonte, autor, licença
- Se um provider não retorna licença explícita, marcar `'see source'` e linkar pra página original

## 6. State explícito, comportamento previsível

Sem reactivity framework. Sem signals. Sem RxJS. **Event bus interno** (`on(event, cb)`) e re-render imperativo.

A engine tem 3 eventos globais:
- `selectionChanged` — algo entrou/saiu de seleção
- `sceneChanged` — algo foi adicionado, removido, ou transformado
- `statsTick` — métricas de render (fps, draw calls, tris) — emit a cada ~500ms

Outliner e Inspector re-renderizam totalmente quando esses eventos disparam. Não é otimizado, é simples. Se ficar lento em N=10000, a gente otimiza ali, não antes.

**Implicações práticas:**
- Mutações no estado da cena passam por `addToScene`, `removeFromScene`, `setSelected`, `notifySceneChanged`
- UI nunca lê estado direto do three.js scene graph — sempre via getters do `scene.js`
- Não há "redux", "store", "context". A scene three.js + ponteiros de seleção + `userData.assetMeta` SÃO o estado.

## 7. Persistência leve e portável

Save/load funciona via `localStorage` em JSON. Estrutura versionada (`version: 1`).

Assets baixados são re-baixados na hora do `load` (não armazenamos blobs binários). Isso mantém o save pequeno (~1KB por objeto) e portátil: o JSON pode ser commitado, compartilhado, exportado.

**Implicações práticas:**
- Save futuro pode ir pra IndexedDB se precisar de blobs cacheados — mas formato JSON principal continua texto
- Export `.glb` é separado de save de scene (são propósitos diferentes)
- Compartilhar uma cena = compartilhar o JSON (que referencia URLs públicas dos providers)

## 8. Componentes da UI são custom — nunca do sistema

Combina com a regra global de produto (`~/.claude/CLAUDE.md`): nunca `<select>` nativo, `confirm()` nativo, ou janela do SO.

A IDE inteira é dark mode, com paleta consistente, componentes custom em `styles.css`. Scrollbars estilizadas. Dropdown de provider é botão + popup posicionado via CSS.

## 9. Documentar **pra IA, não pra humano**

Toda documentação da engine assume que vai ser lida por **um agente futuro** (humano ou LLM) que precisa entender rapidamente o que fazer. Linguagem de alto nível, sem hand-holding, sem snippets desnecessários, sem "neste tutorial vamos aprender…".

**Documentos curtos. Linguagem direta. Convenções em vez de explicação.**

---

## O que clag NÃO é

- **Não é uma game engine.** Sem physics, sem audio, sem input system. Se vai virar jogo, exporta `.glb` e leva pro Three.js/Unity/etc.
- **Não é um modelador.** Sem ferramenta de criar mesh do zero, escultura, etc. É montagem de coisas prontas.
- **Não é um renderer de produção.** Render é o do three.js, com SSAO opcional. Quem quer pathtracing usa Cycles ou Blender via export.
- **Não é multi-usuário.** Cena vive no browser do usuário. Colaboração em tempo real fica fora do escopo do MVP.
- **Não é um marketplace.** Apenas indexa o que já está livre publicamente. Sem upload, sem venda.
