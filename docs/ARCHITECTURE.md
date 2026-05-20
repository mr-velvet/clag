# Arquitetura — clag

Mapa dos módulos, contratos entre componentes, e por onde os dados fluem.

> Pré-requisito: ter lido [PRINCIPLES.md](./PRINCIPLES.md). Muitas decisões aqui são consequência direta dos princípios.

---

## Visão geral em 30 segundos

```
┌──────────────────────────────────────────────────────────────┐
│  index.html                                                  │
│  ├─ importmap CDN (three, lil-gui)                           │
│  └─ <link styles.css>                                        │
│                                                              │
│  src/main.js  ← entry point, amarra tudo                     │
│   │                                                          │
│   ├─ scene.js       singletons three.js + event bus          │
│   │     ├─ renderer, scene, camera, orbit, gizmo             │
│   │     ├─ userRoot (objetos do usuário)                     │
│   │     ├─ helpersRoot (grid, axes, luzes)                   │
│   │     └─ events: selectionChanged / sceneChanged / statsTick │
│   │                                                          │
│   ├─ primitives.js  addCube/Sphere/Plane/PointLight          │
│   ├─ loader.js      loadModelFromUrl(url, ext) + finalize    │
│   ├─ outliner.js    painel de hierarquia (re-render)         │
│   ├─ inspector.js   painel de propriedades (re-render)       │
│   ├─ search.js      busca + drag-to-scene + download         │
│   ├─ toast.js       notificações com progress bar            │
│   ├─ persist.js     save/load via localStorage               │
│   │                                                          │
│   └─ providers/                                              │
│        ├─ index.js       registry + searchAll()              │
│        ├─ khronos.js     catálogo curado github raw          │
│        ├─ polyhaven.js   API pública CC0                     │
│        └─ sketchfab.js   search anônima                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Convenções de estado

A engine não tem store centralizada. O estado vive em 3 lugares:

1. **`userRoot` do three.js** — todos os objetos do usuário, com seus transforms e materials. É o estado canônico de "o que está na cena".
2. **Ponteiro de seleção** (`selected` em `scene.js`) — referência ao objeto selecionado ou `null`.
3. **`userData` de cada objeto** — metadados que a engine usa pra serializar e identificar:

| Campo | Quem seta | Pra quê |
|---|---|---|
| `userData.sceneId` | `addToScene` | id único dentro da cena (`obj_3`, `light_a`, etc.). Estável durante a sessão. |
| `userData.kind` | `primitives.js` ou `search.js` | string `'primitive:cube'`, `'primitive:sphere'`, `'primitive:plane'`, `'light:point'`, `'asset'`. Outliner usa pro badge; persist usa pra reidratar. |
| `userData.assetMeta` | `search.js:downloadAndPlace` | só em objetos baixados de providers. Contém `{ source, sourceId, itemId, name, license, format, raw, thumb }`. Usado pelo persist pra rebaixar no `load`. |
| `userData.isHelper` | helpers internos (ex: esfera visual da luz) | flag pra raycast/inspector ignorarem. |

Mutações no estado da cena **sempre** passam pelas funções em `scene.js` (`addToScene`, `removeFromScene`, `setSelected`, `duplicateObject`). Editar `userRoot.children` direto é proibido — não dispara eventos.

Persistência em `localStorage`:

| Chave | Conteúdo |
|---|---|
| `clag:scene-v1` | JSON da cena atual (objetos com transform + meta) |
| `clag:keys:<provider-id>` | API token de um provider que exige auth (ex: `clag:keys:sketchfab`) |

---

## `scene.js` — núcleo

**Responsabilidade**: dono dos singletons three.js + event bus + seleção + helpers de adicionar/remover.

**Exporta**:
- Singletons: `scene`, `renderer`, `camera`, `orbit`, `gizmo`
- Grupos: `userRoot` (tudo que o usuário adiciona) e `helpersRoot` (grid, luzes, axes — não vai pro save)
- Funções: `bootViewport(container)`, `on(event, cb)`, `addToScene(object, opts)`, `removeFromScene(obj)`, `duplicateObject(obj)`, `getSelected()`, `setSelected(obj)`, `notifySceneChanged()`, `setGizmoMode(mode)`, `worldPointAtScreen(x, y)`, `frameSelected()`

**Por quê separar `userRoot` de `helpersRoot`**: save/load só serializa `userRoot.children`. Helpers (grid, sol, ambient) são propriedade do editor, não da cena do usuário. Quando o usuário pressionar "delete all", helpers continuam.

**Event bus**:
- `selectionChanged(obj | null)` — disparado por `setSelected`
- `sceneChanged()` — disparado por `addToScene`, `removeFromScene`, gizmo `objectChange`, e edições do inspector
- `statsTick({ fps, calls, tris })` — disparado a cada ~500ms pelo loop de render

Outliner e Inspector se inscrevem nesses eventos e **re-renderizam totalmente** (HTML.innerHTML = ''; rebuild). Não é otimizado intencionalmente — escala suficiente para N~10⁴ objetos. Acima disso, virtualizar.

**Atalhos de teclado** (também em `scene.js`, no `bootViewport`):

| Tecla | Ação |
|---|---|
| W / E / R | Gizmo: translate / rotate / scale |
| F | Frame na seleção |
| Del / Backspace | Remove seleção |
| Ctrl+D / ⌘+D | Duplica seleção |
| Esc | Deseleciona |

---

## `primitives.js`

**Responsabilidade**: criadores de objetos básicos (cube, sphere, plane, point light) com defaults sensatos.

Cada função retorna o objeto criado (já chamou `addToScene`, já está selecionado). Posicionamento default: centro do viewport, Y de acordo com a forma.

Convenção: cada objeto recebe `userData.kind = 'primitive:cube' | 'primitive:sphere' | 'primitive:plane' | 'light:point'`. O outliner usa isso pro badge de tipo. O persist usa isso pra reidratar no load.

---

## `loader.js`

**Responsabilidade**: dado uma URL (ou blob URL) e uma extensão, carrega o modelo e devolve um `Object3D` pronto pra cena.

```js
loadModelFromUrl(url, ext) → Promise<Object3D>
```

Suporta `glb`, `gltf`, `fbx`, `obj`. Default = glb.

**`finalize(root)`** (interna) faz:
1. Calcula bounding box do modelo
2. Centraliza no XZ (move pivot pra que centro fique em x=0, z=0)
3. Planta na origem Y (`box.min.y → 0`)
4. Se a diagonal estiver muito grande (>30u) ou muito pequena (<0.05u), escala pra ~2u — providers retornam modelos em escalas malucas

Isso garante que **todo asset chega na origem, plantado no chão, com tamanho útil**, independente do provider.

---

## `providers/` — contrato

Cada provider é um módulo ES que exporta um **contrato fixo**:

```js
export const id          = 'mysource';        // machine id, único
export const label       = 'My Source';       // display name
export const description = 'one-line text';
export const needsKey    = false;             // se precisa de API key
export const keyHint     = '...';             // opcional, msg pro user

// busca: dado um termo, retorna lista de AssetResult
export async function search(query, { signal }) { ... }

// download: dado um AssetResult, baixa e retorna blob URL + extensão
export async function download(item, { onProgress, signal }) { ... }
```

**Estrutura `AssetResult`**:

```js
{
  id: 'polyhaven:boulder_01',   // único globalmente (provider:slug)
  source: 'polyhaven',          // == provider.id
  name: 'Boulder 01',           // display
  thumb: 'https://...',         // url de thumbnail
  license: 'CC0',               // string visível pro user
  format: 'gltf',               // gltf | glb | fbx | obj
  raw: { /* opaque */ },        // passado de volta pro download
}
```

**Retorno de `download`**:

```js
{
  url: 'blob:...',         // URL.createObjectURL do blob baixado
  blob: Blob,              // o blob (caso o caller queira reuse)
  contentType: '...',
  ext: 'gltf' | 'glb' | ..., // pode diferir do format se provider converte
}
```

Engine cuida de:
- Chamar `loadModelFromUrl(url, ext)` no resultado
- `URL.revokeObjectURL(url)` após carregar
- Tagear o objeto com `userData.assetMeta` pra persistência
- Toast de progress + erro

**Erros**: provider deve `throw new Error('...')` com mensagem clara. Engine mostra no toast com prefixo `failed: …`. Se o erro pode ser resolvido pelo user (faltando key, etc.), incluir instrução na mensagem.

**Cache**: provider pode manter cache em escopo de módulo (ex: Poly Haven carrega o índice uma vez e mantém em memória). Não há padrão obrigatório.

Detalhe completo de como adicionar um provider novo em [PROVIDERS.md](./PROVIDERS.md).

---

## `search.js`

**Responsabilidade**: UI do asset browser.

Fluxo:
1. User digita termo + Enter → `runSearch()`
2. `searchAll(query, { providerIds })` em paralelo via `Promise.allSettled`
3. Resultados vão pra `lastResults` (array global) e renderizam em `.results` como `.result-card`s
4. Cada card é `draggable=true` com `dataTransfer['application/x-scene-ide-asset']` = `item.id`
5. Viewport tem handlers `dragover`/`drop` que recuperam o item por id e chamam `downloadAndPlace(item, pos)`
6. Double-click no card também chama `downloadAndPlace`

Custom select de provider (não nativo) é botão + popup posicionado absolutamente. Estado em `activeProviderId`. Default `'all'`.

Toast de download tem progress bar atualizada via `onProgress(received, total)` callback que provider chama.

---

## `inspector.js`

**Responsabilidade**: painel de propriedades do objeto selecionado.

Re-render completo no `selectionChanged` e (throttled via RAF) no `sceneChanged`. Não há reactivity — quando user edita um vec3 input, faz `vec[ax] = parsed; notifySceneChanged()`.

Seções (todas opcionais, mostradas se objeto qualificar):
- **identity**: nome, type, e — se `userData.assetMeta` existir — source/license/URL
- **transform**: position, rotation (degrees), scale como vec3 com axis colorido (X vermelho / Y verde / Z azul)
- **material**: color, roughness, metalness, emissive — propaga edição pra TODAS as materials do objeto (não só a primeira)
- **light**: color, intensity, distance
- **info**: contagem de verts/tris/meshes

---

## `outliner.js`

Lista plana de `userRoot.children`. Re-render no `sceneChanged` + `selectionChanged`. Click seleciona. Item tem nome + badge de tipo (de `userData.kind`).

Não há tree hierárquica aninhada por enquanto — futuramente quando suportar grupos/parents.

---

## `persist.js`

**`serializeScene()`** percorre `userRoot.children` e serializa cada um pra JSON:
- Primitivas: salva `kind`, position/rotation/scale, e cor do primeiro material
- Lights: salva color/intensity/distance
- Assets: salva `assetMeta` (que tem provider id, item id, raw payload) + transform

**`saveSceneToLocal()`** escreve em `localStorage:clag:scene-v1`.

**`restoreSceneFromLocal(addPrimitive, downloadAndPlaceMeta)`** lê e reidrata:
- Primitivas: chama `addPrimitive(kind)` e aplica transform/cor
- Assets: chama `downloadAndPlaceMeta(meta, transform)` que **rebaixar** o asset (não armazenamos blob)

Por que rebaixar em vez de cachear blob: assets podem ser GBs, localStorage tem ~5MB de limite. Rebaixar é OK porque CDNs (Poly Haven, GitHub raw) são rápidos. Futuro IndexedDB pode mudar isso opcionalmente.

---

## `toast.js`

Stack de toasts no canto inferior-direito do viewport. Cada toast tem:
- Texto
- Kind: `info` / `success` / `error` / `warn` (cor da borda esquerda)
- Optional progress bar (0..1)
- Auto-dismiss em ~2.6s (configurável)

Provider de download passa `onProgress(received, total)` que o `search.js` traduz pra `toast.setProgress(received/total)`.

---

## `styles.css`

CSS único. Variáveis CSS no `:root` pra paleta dark.

Layout principal é grid:

```css
#app {
  grid-template-rows: var(--topbar-h) 1fr var(--bottom-h);
}
#main {
  grid-template-columns: var(--left-w) minmax(0, 1fr) var(--right-w);
}
```

`minmax(0, 1fr)` é crítico — sem isso, conteúdo do viewport ou painéis estoura horizontalmente em telas pequenas.

Media queries reduzem `--left-w` e `--right-w` em 1100 / 900 / 760px. Abaixo de 760 esconde painéis laterais (apenas toggles permitem reabrir).

Scrollbars custom (`::-webkit-scrollbar`). Nenhum componente nativo do SO/browser visível (nunca `<select>`, `confirm()`, focus ring padrão).

---

## Fluxo: do "user digita 'rock'" até "rock aparece na cena"

1. User digita `rock` + Enter → `search.js:runSearch()`
2. `searchAll(q, { signal })` → `Promise.allSettled([khronos.search(q), polyhaven.search(q), sketchfab.search(q)])`
3. Cada provider retorna `AssetResult[]` (ou rejeita; rejeição é logada mas não para os outros)
4. Resultados flatten em `lastResults` → render como `.result-card`s
5. User arrasta um card → `viewport-wrap` ouve `drop`, recupera item por id, calcula `worldPointAtScreen(clientX, clientY)`
6. `downloadAndPlace(item, pos)`:
   1. `toast(...)` com progress bar
   2. `provider.download(item, { onProgress })` → blob URL + ext
   3. `loadModelFromUrl(url, ext)` → `Object3D`
   4. `obj.userData.assetMeta = { source, sourceId, itemId, name, license, format, raw, thumb }`
   5. `addToScene(obj, { position: pos })` — gera `sceneId`, ativa shadows, dispara `sceneChanged`, seleciona
7. `selectionChanged` → outliner pinta linha selecionada, inspector preenche seções
8. `URL.revokeObjectURL(blobUrl)` (já carregou)

---

## O que NÃO está modular ainda (débito conhecido)

- **`search.js`** contém UI + lógica de drag-drop + download — vai ser bom partir em `search-ui.js` e `asset-pipeline.js` quando crescer
- **`scene.js`** mistura singletons + event bus + helpers — pode partir em `scene-state.js` (event bus) + `scene-helpers.js` (add/remove/duplicate)
- **Inspector** renderiza tudo via `innerHTML = ''` + recriação — fine pra escopo atual, mas vai precisar virar diff/keyed quando ficar mais rico
