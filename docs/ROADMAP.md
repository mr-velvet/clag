# Roadmap — clag

Em ordem aproximada de prioridade. Sem datas — clag é projeto pessoal, próxima parada depende de sinal/interesse.

---

## v1 — feature parity com o PoC

Já está, mas listado por completude:
- [x] Viewport 3D + TransformControls + OrbitControls
- [x] Outliner reativo
- [x] Inspector editável (transform, material, light)
- [x] 3 providers: Khronos, Poly Haven, Sketchfab (search anônima)
- [x] Drag-to-scene + double-click
- [x] Save/load via localStorage
- [x] Toast com progress bar
- [x] Layout responsivo (800px+)

## v1.1 — polish próximo

- [ ] **Multi-resolução Poly Haven**: dropdown 1k/2k/4k no card de resultado
- [ ] **Unzip handling pro Sketchfab**: integrar `fflate` em um helper compartilhado
- [ ] **Galleria offline**: opção `provider: 'gallery'` listando uma curadoria local (zip Kenney + Quaternius hospedados no GCS)
- [ ] **Inspector visual feedback**: highlight no objeto selecionado (outline pass)
- [ ] **Painel de licenças**: lista das licenças dos assets presentes na cena (modal acessível por botão)
- [ ] **Export `.glb` da cena inteira** via `GLTFExporter` + `CREDITS.txt` empacotado em zip
- [ ] **Shortcut "duplicate"** via Alt+drag no gizmo
- [ ] **Undo/redo** básico (snapshot stack de scene JSON)

## v2 — providers expandidos

- [ ] **Smithsonian Open Access** (modelos de museu — ver esboço em PROVIDERS.md)
- [ ] **Sketchfab download** com OAuth flow + storage de token
- [ ] **Hugging Face / Objaverse** — viável só com índice pré-processado hospedado por nós
- [ ] **Hyper3D / Hunyuan / Tripo / Meshy** — geração via IA como provider especial: input é texto/imagem, output é o asset

## v3 — IDE features avançadas

- [ ] **Grupos / parents** — drag no outliner pra criar hierarquia
- [ ] **Multi-select** — Shift+click no outliner ou marquee no viewport
- [ ] **Snap to grid** + alinhamento
- [ ] **Câmera presets** — top, front, right, perspective com botões
- [ ] **Iluminação dinâmica** — preset de mood (sunset, studio, night)
- [ ] **HDR environment** via Poly Haven HDRIs (já tem na API)
- [ ] **Live preview de licenças misturadas** com alerta "esta cena tem 3 licenças: CC0, CC-BY 4.0, see-source"
- [ ] **Asset cache em IndexedDB** opcional (controlar via toggle de "trabalhar offline")

## v4 — pensar produto (depois de validar com PoC público)

Decisão de virar produto depende de sinais reais — ver [PRODUCT-NOTES.md](./PRODUCT-NOTES.md).

Se for adiante:
- [ ] Conta de usuário (Logto via did.lu já tem)
- [ ] Cenas salvas no servidor (não só localStorage)
- [ ] URL pública pra cada cena ("preview link")
- [ ] Export pra Unity package / Unreal datasmith
- [ ] Marketplace de cenas (não de assets — assets continuam vindo dos providers livres)
- [ ] Plano free + plano paid (paid: cenas privadas + export sem watermark + mais providers)

## Coisas que NÃO vão entrar (decisões já tomadas)

- ❌ Build step (Vite, Webpack, etc.) — viola princípio 1
- ❌ Renderer custom (pathtracing, etc.) — fora do escopo
- ❌ Editor de animação — fora do escopo
- ❌ Shader graph — fora do escopo (sliders já dão pra mexer no básico)
- ❌ Multi-usuário real-time — fora do escopo do MVP
- ❌ Upload de assets pelo user — clag não é repositório, só indexa

## Ideias soltas (não comprometidas)

- **AI captioning** dos resultados: gerar tags semânticas mais ricas que as oficiais via Gemini ou Claude Vision
- **Asset stylizer**: aplicar shader stylized (toon, pixel art, hand-drawn) por cima dos assets carregados
- **Cena → vídeo curto**: turntable animation export com `OrbitControls.autoRotate` + MediaRecorder
- **Cena → screenshot HD**: alta resolução offscreen render pra wallpaper/preview
- **AR preview**: WebXR mode pra ver a cena no celular
