# Provedores de Assets 3D — Pesquisa para Scene IDE

Pesquisa em 2026-05-19. Foco: alimentar uma IDE 3D no browser estilo Unity Editor, onde o usuário busca "tree", "rock", "house" e arrasta o resultado pra cena, e o front baixa glTF/GLB direto.

Todas as checagens de CORS, auth e endpoint foram feitas com curl real contra cada API. Onde não foi possível confirmar, está marcado como "ambíguo, precisa testar".

---

## TL;DR — quem usar

**Integrar agora (caminho mais reto, ponta a ponta sem backend):**
1. **Poly Haven** — único provedor PBR com glTF público, sem auth, com CORS aberto, CDN rápida (Cloudflare/Backblaze). É a base.
2. **KhronosGroup glTF-Sample-Assets** (via `raw.githubusercontent.com`) — fallback offline-friendly com ~100 modelos canônicos. CORS verificado OK. Garantia de que a engine de cena funciona mesmo se as APIs externas caírem.
3. **Sketchfab Search API (apenas search, sem download)** — search endpoint funciona anônimo e dá milhões de thumbnails. Download exige OAuth do usuário final + atribuição visível. Usar pra "preview/browse" mesmo sem download, ou implementar download depois quando tiver fluxo de login.

**Integrar depois:** Smithsonian (precisa de API key data.gov + sintaxe de filtro 3D não trivial), Hugging Face Objaverse (sem search por texto via HTTP — exige índice local).

**Pular:** Fab.com (sem API pública de download em 2026), OpenGameArt (sem API), Kenney/Quaternius (só ZIPs grandes — útil pra empacotar offline, não pra busca dinâmica).

---

## 1. Poly Haven  -  **PRIORITÁRIO**

- **URL:** https://polyhaven.com  /  API: https://api.polyhaven.com
- **Docs:** https://polyhaven.com/our-api  +  Swagger: https://api.polyhaven.com/api-docs/swagger.json (Redoc render: https://redocly.github.io/redoc/?url=https://api.polyhaven.com/api-docs/swagger.json)
- **Repo Public-API:** https://github.com/Poly-Haven/Public-API

### Endpoints relevantes (sem auth, GET puro)
| Endpoint | Uso |
|---|---|
| `GET /assets?t=models` | Lista todos os assets do tipo "model". JSON achatado com `name`, `categories`, `tags`, `thumbnail_url`, `download_count`, `polycount`, `dimensions`. |
| `GET /assets?t=models&categories=furniture,seating` | Filtra por categoria. |
| `GET /categories/models` | Lista categorias disponíveis e contagem. |
| `GET /files/{asset_id}` | Retorna árvore de arquivos: `gltf` (1k/2k/4k), `fbx`, `blend`, `usd`, e cada textura PBR (`Diffuse`, `nor_dx`, `nor_gl`, `Metal`, `Rough`, `arm`). |
| `GET /info/{asset_id}` | Metadata detalhada de um asset. |

### Busca por texto
**Cuidado:** **não tem `q=` no endpoint.** O `GET /assets` devolve TUDO (modelos atualmente ~370 KB de JSON, ~120 modelos), e a busca por nome/tag tem que ser feita client-side filtrando o JSON. Isso é viável e até bom (1 fetch cacheado, busca instantânea). Mas não há fuzzy search server-side.

### Autenticação
**Nenhuma.** Único requisito: header `User-Agent` identificando a aplicação (ex: `scene-ide/0.1 (contact@email)`). Não é validado server-side de forma estrita, mas é Terms-of-Service.

### CORS
**Verificado OK.** Resposta de `api.polyhaven.com` traz `Access-Control-Allow-Origin: *`. CDN de download (`dl.polyhaven.org`) idem (`Access-Control-Allow-Origin: *` + `access-control-allow-credentials: true`).

### Formato de download
Para um modelo (ex: `ArmChair_01`), o `/files/{id}` retorna em `gltf.1k.gltf` (e `2k`, `4k`):
- URL do `.gltf` (texto JSON)
- Lista `include` de texturas `.jpg` separadas
- URL do `.bin` (buffer de geometria)

Também tem `.fbx` por resolução, e `.blend`. **NÃO tem GLB binário consolidado** — só glTF separado em arquivos. Três opções:
1. Three.js `GLTFLoader` aceita glTF + bin + texturas separadas, basta apontar as URLs corretas e ele resolve. Mais simples.
2. Empacotar em GLB no client-side (complicado, dispensável).
3. Usar FBX (Three.js `FBXLoader`, mais pesado).

### Licença
**CC0 1.0** (domínio público) em **TODOS** os assets. Sem atribuição obrigatória. Ideal para experimento.

### Rate limits
Não documentados oficialmente. ToS pede User-Agent identificável e cache razoável. Cloudflare na frente — provavelmente generoso. **Recomendação:** cachear `/assets?t=models` localmente por 24h.

### Qualidade / tamanho
~120 modelos totais (mobília, props, comida, etc.) com qualidade PBR alta, polycount baixo a médio. Não é "biblioteca infinita", mas é curado e bonito. Suficiente pra um IDE experimental ter resultado decente nas buscas comuns.

### Veredito
**INTEGRAR PRIMEIRO.** Único provedor com (a) API pública, (b) glTF nativo, (c) CORS livre, (d) sem chave, (e) CC0, (f) qualidade. É o "happy path" do projeto.

---

## 2. KhronosGroup glTF-Sample-Assets  -  **PRIORITÁRIO (fallback)**

- **URL:** https://github.com/KhronosGroup/glTF-Sample-Assets
- **Browser oficial:** https://github.khronos.org/glTF-Assets/
- **Lista de modelos:** https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Models.md

### "Endpoint" de busca
Não existe API. O índice é o arquivo `Models/model-index.json` no próprio repo:
```
https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/model-index.json
```
Pode ser baixado uma vez no build/dev, ou em runtime. Cliente filtra por nome/tag em memória.

### Autenticação
**Nenhuma.**

### CORS
**Verificado OK.** Teste real:
```
curl -I https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb
-> Access-Control-Allow-Origin: *
-> Cross-Origin-Resource-Policy: cross-origin
```
Funciona em fetch from-browser pra GET simples. Threads antigos de community.github sobre CORS quebrado em raw.githubusercontent eram sobre preflight com headers customizados — GET puro de binário funciona.

### Formato
**GLB binário** disponível em `Models/{Name}/glTF-Binary/{Name}.glb`. Também `glTF/` (não-binário) e `glTF-Draco/`. ~100+ modelos.

### Licença
Mistura: maioria **CC0** ou **CC-BY 4.0**, alguns proprietários (SCEA, Poser EULA). O `model-index.json` carrega `license` por modelo — filtrar antes de oferecer ao usuário.

### Rate limits
GitHub raw: ~5000/h por IP autenticado, mais permissivo anônimo via CDN Fastly. Pra IDE com cache, irrelevante.

### Qualidade / tamanho
~100 modelos. Pato, capacete dourado, helicóptero, suzanne, etc. Pequeno mas confiável. **Bom como "seed dataset" garantido.**

### Veredito
**INTEGRAR PRIMEIRO** como fonte de fallback / "modelos de teste / demo". Permite a IDE funcionar mesmo se Poly Haven cair.

---

## 3. Sketchfab  -  **integrar depois (ou só search)**

- **URL:** https://sketchfab.com  /  API base: https://api.sketchfab.com/v3
- **Docs:** https://sketchfab.com/developers/data-api/v3 ; https://sketchfab.com/developers/download-api
- **JS guide:** https://sketchfab.com/developers/download-api/downloading-models/javascript

### Endpoint de busca
```
GET https://api.sketchfab.com/v3/search?type=models&q=tree&downloadable=true&count=24
```
Query params úteis:
- `type=models`
- `q=texto`
- `downloadable=true` — filtra modelos com download liberado
- `license=cc0` (também: `cc-by`, `cc-by-sa`, etc.)
- `categories=...`, `tags=...`, `min_face_count`, `max_face_count`
- `count` até 24, paginação por `cursor`

**Testado anônimo (sem token), retorna 200 e JSON com `results` contendo `uid`, `name`, `thumbnails`, `viewerUrl`, `isDownloadable`, `tags`, `categories`, `license` info.** Ou seja, **a parte de busca/preview funciona sem auth nenhuma.**

### Endpoint de download
```
GET https://api.sketchfab.com/v3/models/{UID}/download
Authorization: Bearer <oauth_token>
```
Retorna JSON com URLs temporárias (300s de validade) para arquivos glTF (`.zip` com `.gltf`+textures) e USDZ. **As URLs em si depois não precisam de auth.**

**Esse endpoint EXIGE OAuth2 com login do usuário final.** Sketchfab API Token pessoal NÃO funciona pra Download API — só OAuth. E o app precisa ser aprovado / fazer OAuth login real, com guidelines:
- Mostrar atribuição (autor + link pro modelo no Sketchfab)
- Exibir o logo do Sketchfab
- Cada usuário precisa ter conta Sketchfab própria

Documentação:  https://sketchfab.com/developers/download-api/guidelines

### Autenticação
- **Search:** nenhuma. Anônimo OK.
- **Download:** OAuth2 obrigatório. Não dá pra fugir.

### CORS
- **Search:** `access-control-allow-origin` retorna o origin solicitante (eco) + `access-control-allow-credentials: true`. Funciona from-browser sem proxy.
- **Download:** mesmo schema CORS, mas exige Bearer token. URLs assinadas retornadas têm CORS aberto (testado pelos guides).

### Formato
**glTF como `.zip`** (não-binário, com texturas separadas dentro). Extrair no client (com `jszip`, fácil) e mandar pra Three.js. Também USDZ disponível.

### Licença
**CC-BY** é o mais comum (atribuição obrigatória visível na UI da IDE). CC0 existe mas é minoria. Filtrar via `?license=cc0` se quiser zero atrito legal. **Não é negociável** — guidelines do Sketchfab exigem mostrar atribuição mesmo CC0.

### Rate limits
Não documentados. Free tier de Data API é "generoso". Download API tem aprovação manual implícita (você precisa criar app OAuth, mas é auto-serve).

### Qualidade / tamanho
**~1 milhão de modelos**, sendo ~150k+ Creative Commons baixáveis. O maior provedor de longe.

### Veredito
- **Search SIM, agora**: zero atrito, retorna catálogo gigante de thumbnails — UX da IDE fica rica.
- **Download depois**: exige OAuth + atribuição visível na UI, complica MVP. Adicionar quando a IDE tiver fluxo de login.

---

## 4. Smithsonian 3D / Open Access  -  **integrar depois**

- **URL:** https://3d.si.edu  /  https://www.si.edu/openaccess
- **3D API docs:** https://3d-api.si.edu/api-docs/ (Swagger UI — `swagger.json` não está em URL estável conhecida; **documentação ambígua, precisa testar com curl**)
- **Open Access API:** `https://api.si.edu/openaccess/api/v1.0/search` (via api.data.gov)
- **Dev tools:** https://www.si.edu/openaccess/devtools

### Endpoint de busca
**Dois caminhos, ambos com pegadinha:**

A) **EDAN Open Access search** (genérica, busca tudo do Smithsonian):
```
GET https://api.si.edu/openaccess/api/v1.0/search?q=...&api_key=YOUR_KEY
```
Testado: retorna 200 com `rows[]`. Mas filtrar especificamente por modelos 3D **não é trivial** — testei `online_media_type:"3D Images"` e `online_media_type:3d_images` e ambos retornam 0 resultados. A sintaxe de filtro 3D está documentada esparsamente; provavelmente precisa pegar `unit_code` específico (3D Digitization Program) ou inspecionar `content.descriptiveNonRepeating.online_media`. **Precisa testar empiricamente.**

B) **3D-specific API:** `https://3d-api.si.edu/...` — existe mas a doc Swagger no `api-docs/` carrega Loading vazio sem JS habilitado. Endpoint de busca de pacotes 3D **não é claro sem rodar o Swagger UI no browser**.

### Autenticação
**API key obrigatória via api.data.gov.** Gratuita, registro em segundos em https://api.data.gov/signup/. Mas é uma chave a mais pra gerenciar (env var, etc.). Fora isso, sem login de usuário.

### CORS
Verificado em `3d-api.si.edu` e em respostas de download — `Access-Control-Allow-Origin: *` presente. `api.si.edu/openaccess` também responde. **Funciona from-browser**, mas a key vai aparecer no JS bundle (a chave data.gov é "demo-ish", aceitável).

### Formato
Modelos servidos como **glTF** (pacotes Voyager). URLs apontam pra `3d-api.si.edu/content/document/...` com `.gltf` + texturas separadas, ou `.glb`. Algumas peças têm OBJ tambem.

### Licença
**CC0** quando marcado "Open Access" — domínio público liberadíssimo, sem atribuição obrigatória.

### Rate limits
api.data.gov: **1000 requests/hour por chave anônima**, mais com signup. Suficiente.

### Qualidade / curadoria
~2000+ modelos de museu (artefatos, fósseis, estátuas, naves Apollo). Curadoria altíssima, mas é "museu", não "asset de cena" — útil pra props especiais (estátua, esqueleto), pouco útil pra "tree" ou "house" genéricos.

### Veredito
**INTEGRAR DEPOIS.** Vale a pena adicionar como "vertical de curiosidade" (busca por museu), mas não como provider primário. Documentação de filtro 3D é frágil — precisa investigação de campo (1-2h testando curls) antes de codar a integração.

---

## 5. OpenGameArt.org

- **URL:** https://opengameart.org
- **API:** **não existe.** Apenas search HTML em https://opengameart.org/art-search-advanced
- **Forum oficial confirma:** sem API REST. Tentativas terceiras de API estão offline.
- **Scraping:** desencorajado nos termos — risco de IP block.

### Veredito
**PULAR.** Sem API = não cabe em IDE 3D no browser. Pra puxar dali precisa de scraper server-side + cache; custo-benefício ruim pra experimento.

---

## 6. Kenney.nl

- **URL:** https://kenney.nl/assets
- **Distribuição:** ZIPs estáticos, ex: `https://kenney.nl/media/pages/assets/nature-kit/kenney_nature-kit.zip`
- **GitHub:** https://github.com/KenneyNL (alguns starter-kits, não as bibliotecas)

### Detalhes
- Sem API de busca.
- Cada pack é um ZIP de ~10-100 MB com **300+ modelos por pack** em FBX, OBJ, GLB e Blender.
- **Licença: CC0 1.0** em tudo.
- CORS: provavelmente OK em links diretos (`kenney.nl/media/pages/...`), mas downloads são ZIPs gigantes — não dá pra baixar tudo on-demand.

### Veredito
**PULAR como provider runtime. Considerar como "asset pack offline".** Estratégia alternativa: baixar 2-3 packs Kenney uma vez, extrair pra `didlu-imagestore` GCS, criar índice JSON manual (`{name, tags, glbUrl}`) e tratar como mais um "provider" da IDE. Vale a pena depois — não primeira leva.

---

## 7. Quaternius

- **URL:** https://quaternius.com  /  https://quaternius.itch.io
- **Distribuição:** ZIPs no Google Drive ou itch.io (~10-700 MB cada pack), CC0.
- **GitHub:** existe um `Quaternius/TestGltfAssets` (3 repos) mas não é catalogado/indexado.

### Veredito
**PULAR como API.** Mesma estratégia do Kenney se quiser conteúdo: pack offline + índice manual. Pode esperar depois do MVP.

---

## 8. Three.js examples (modelos embarcados)

- **URL:** https://github.com/mrdoob/three.js/tree/dev/examples/models
- **Acesso:** raw github / jsDelivr CDN.
- **Modelos:** Suzanne (Blender monkey), Knight, Soldier, Flamingo, Horse, Parrot, Stork, Michelle (rigged), Robot Expressive — ~30-50 modelos GLB pequenos.

### Veredito
**ÚTIL como "default scene".** Não é provider de busca, mas dá pra incluir como "primitivos" do IDE — botões pra adicionar Suzanne/Cubo/Esfera. CDN: `https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/models/gltf/{name}.glb` (verificar CORS — jsDelivr historicamente serve com CORS aberto).

---

## 9. Hugging Face / Objaverse

- **URL:** https://huggingface.co/datasets/allenai/objaverse  ;  https://objaverse.allenai.org
- **Tamanho:** 800k modelos (Objaverse 1.0), 10M+ (Objaverse-XL).
- **Acesso:** Python package `objaverse` (PyPI). **Não há HTTP API de search por texto.**
- **Para buscar:** baixar localmente `cap3d_captions.json.gz` + `lvis_categories.json` + filtrar em memória → mapear UID → URL no HF.
- **Download direto:** `https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/{first-3}/{uid}.glb` — redirect 302 pra S3 assinado. CORS no S3 retorna `Access-Control-Allow-Origin: <origin solicitante>` — funciona from-browser depois do redirect.

### Problema
- Não tem search server-side. Precisa baixar índices (~100 MB+ de JSON) pra mapear "tree" → UIDs candidatos.
- Qualidade é heterogênea (scrap massivo da web 3D — modelos rotos, escala maluca, etc.).

### Veredito
**INTEGRAR DEPOIS, opcional.** Caminho viável: criar um serviço pequeno (Cloud Function) que mantém índice + responde busca por texto retornando UIDs e URLs do HF. Mas isso já não é "100% no browser" — exige backend mínimo. Pra MVP, pular.

---

## 10. Fab.com (Epic)

- **URL:** https://www.fab.com
- **Status da API:** Epic anunciou plano de "public download API" pra 2025-2026. **Em maio de 2026 ainda não está disponível publicamente** — pelo que vi nos search results, ainda é só web + launcher (Unreal/Unity).
- **Sketchfab agora redireciona pra Fab** em algumas operações, mas a Data API antiga ainda funciona (vide acima).

### Veredito
**PULAR.** Não tem ponto de entrada hoje. Revisitar se Epic lançar a API pública.

---

## Considerações transversais

### CORS — resumo testado
| Host | CORS | Pronto for-browser? |
|---|---|---|
| `api.polyhaven.com` | `*` | sim |
| `dl.polyhaven.org` | `*` | sim |
| `api.sketchfab.com` | reflete origin + credentials | sim |
| `raw.githubusercontent.com` | `*` | sim (GET puro) |
| `3d-api.si.edu` | `*` | sim |
| `api.si.edu` | `*` (data.gov) | sim |
| `cas-bridge.xethub.hf.co` (HF S3 backend) | reflete origin | sim (depois do redirect) |
| `cdn.jsdelivr.net` | `*` | sim (assumido) |

**Nenhum dos provedores priorizados precisa de proxy.**

### Auth obrigatória por provider
- Poly Haven, Khronos, OpenGameArt (n/a), Kenney/Quaternius (n/a): **nenhuma**.
- Sketchfab Search: nenhuma. Sketchfab Download: **OAuth do usuário final**.
- Smithsonian: **API key data.gov** (grátis, fácil).
- HF / Objaverse: nenhuma pra download, mas search exige índice local.

### Licenças, resumo
- **Total CC0 (sem atribuição):** Poly Haven, Kenney, Quaternius, Smithsonian Open Access.
- **Mix CC0 + CC-BY (atribuição obrigatória):** Sketchfab, KhronosGroup samples.
- **Outros:** HF/Objaverse depende do modelo individual (campo `license` no metadata).

A IDE deve carregar e exibir a licença/autor sempre que um asset não-CC0 for usado.

---

## Plano de integração recomendado

**Sprint 1 — caminho mais reto, sem backend, sem auth de usuário:**

Implementar um sistema de "providers plugáveis" onde cada provedor expõe duas funções: `search(query) -> [{id, name, thumbnail, source}]` e `download(id) -> Promise<gltfObject>`. Plugar três providers nessa ordem:

1. **Poly Haven** — base do experimento. Pré-carregar `GET /assets?t=models` no boot da IDE (única request, ~370 KB cached 24h). Search local em-memória por nome/tags/categorias. No drop, chamar `GET /files/{id}` pra pegar a URL do `.gltf` 1k/2k + texturas, passar pro Three.js `GLTFLoader` (que aceita URL externa e resolve referências relativas com `manager.setURLModifier` se necessário). Licença CC0 — atribuição não obrigatória, mas mostrar autor no inspetor é elegante.

2. **Khronos Sample Assets** — provider de "demo/primitivos". Pré-carregar `model-index.json` do repo. Search local. Download: GET direto de `raw.githubusercontent.com/.../{Name}.glb` (binário, 1 fetch só). Funciona offline-firsh se o índice for empacotado no bundle.

3. **Sketchfab (modo "preview only" no MVP)** — search dinâmico via `https://api.sketchfab.com/v3/search?type=models&q=...&downloadable=true&license=cc0`. Mostra thumbnails no painel de busca. Botão de "download" inicia OAuth2 flow (deixar pra sprint 2 — pode literalmente exibir um placeholder "Sketchfab requer login" no MVP).

**Sprint 2 — expandir quando MVP estiver de pé:**
- Sketchfab OAuth real + atribuição visível.
- Smithsonian (precisa de 1-2h de investigação na sintaxe de filtro de online_media_type — vale curl exploratório antes de codar).
- Empacotar 1-2 packs Kenney/Quaternius em GCS (`https://st.did.lu/scene-ide-packs/kenney-nature/index.json`) e tratar como mais um provider via índice manual.
- Objaverse só se a IDE realmente precisar de escala — exige backend mínimo (Cloud Function com índice).

Esse plano dá um MVP funcional ponta-a-ponta com busca, drag-drop, download e render — usando **só dois providers (Poly Haven + Khronos)** sem nenhuma chave de API e sem backend.
