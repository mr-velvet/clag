# scene-ide — notas de produto

Última atualização: 2026-05-19
Autor: agente de produto (avaliação para o Manu)

---

## 1. O que é

Protótipo de IDE 3D rodando no browser, no espírito de um Unity Editor enxuto: viewport com TransformControls, hierarchy, inspector. O traço distintivo é uma **barra de busca multi-provider de assets 3D gratuitos** (Sketchfab, Poly Haven e, em tese, outras fontes CC0/CC-BY) embutida no editor: o usuário digita "tree", vê resultados agregados, arrasta pra cena, o editor baixa + converte + posiciona, e o inspector permite editar transform/props. Hoje é PoC local em `python -m http.server`, sem persistência nem multi-user.

---

## 2. Comparáveis diretos

| Ferramenta | O que faz | Modelo | Asset library | Busca multi-provider? |
|---|---|---|---|---|
| **PlayCanvas Editor** | Editor 3D web colaborativo voltado a jogos/AR/VR/configuradores. Collab tipo Google Docs, version control, hot-reload. | Free + planos pagos (Personal/Org). | Asset Store **próprio** (free + premium, modelos/materiais/scripts). | **Não.** Loja proprietária. |
| **Babylon.js Editor** | Editor desktop (Win/Mac/Linux) open-source mantido pela comunidade. Editor visual para projetos Babylon.js 9.x. | Open-source, grátis. | Asset management interno; sem marketplace embutido. | **Não.** Importa via filesystem. |
| **Spline** | Design 3D interativo no browser. Foco em landing pages, micro-interações, animação. Spline AI gera mesh/textura. | Free + $12–25/seat/mês + AI add-on $5. | Library própria de materiais/áudio; gera via Spline AI. | **Não.** Tudo proprietário. |
| **Womp** | Modelagem 3D "Goop" (mesh líquido) no browser. Foco em estética/design/3D print. | Free + Pro $9.99/mês + Team. | 500+ "Super Materials" próprios; IA integrada (Flux/Hunyuan/Trellis). | **Não.** Tudo proprietário. |
| **Vectary** | Editor 3D no-code no browser pra produto/AR/web. Hotspots, animação, viewer API. | Free (5 projetos) + planos pagos. | Library própria; CAD import; GenAI integrada. | **Não.** |
| **Polycam** | Captura 3D mobile (LiDAR/photogrammetry/Gaussian Splats). Não é editor; é pipeline de scan→asset. | Free (limitado a glTF) + $12.99–26.99/mês. | N/A — produz assets, não consome. | N/A. |
| **Threekit** | Configurador 3D de produto para e-commerce enterprise (Crate&Barrel etc.). | A partir de $500/mês, custom. | Pipeline de assets do cliente. | Não — outro mercado. |
| **3Dassets.one** | **Search engine** agregando Poly Haven, ambientCG e outros creators. API v2. | Grátis. | Não hospeda; redireciona pro creator. | **Sim — mas é apenas busca, sem editor.** |

**Leitura crítica:** o quadrante "editor 3D no browser + busca agregada de assets externos" está vazio. Spline/Womp/Vectary apostaram em **fechar** o jardim (lib própria + IA própria), porque libs proprietárias prendem usuário e justificam o preço. PlayCanvas tem loja própria mas é jogos-first. 3Dassets.one resolve a busca mas não tem cena. A nossa diferenciação **existe no papel**.

---

## 3. Para quem isso seria útil

Filtrando pela dor concreta que **só** essa combinação resolve (editor leve + busca agregada de assets livres):

- **Dev indie de jogos/web cedo no protótipo**: precisa popular uma cena rapidamente pra testar gameplay/feel, sem abrir Blender ou comprar pack. Hoje: tab de Sketchfab + tab de Poly Haven + Itch.io packs + drag manual pro Unity. Persona real, dor real, mas o output dele precisa ir pra Unity/Unreal/Godot — não pro browser. **Útil se exportarmos glTF bem.**
- **Educador/curso de three.js/WebGL**: monta cenas-exemplo rápido pra aula. PlayCanvas já cobre bem; nossa vantagem só aparece se a curva de entrada for radicalmente menor.
- **Arquiteto/designer fazendo mood board 3D ou layout rápido**: hoje usam SketchUp + 3D Warehouse. 3D Warehouse já é um Sketchfab dele. Concorrência forte e estabelecida.
- **Artista 3D**: **não é o público.** Eles querem Blender + Poly Haven Asset Browser (já existe, é melhor que o nosso vai ser). Não vão trocar Blender por web app.
- **Desenvolvedor que precisa colocar 3D numa landing/produto web**: mas aí é Spline. Spline ganha em polimento, animação, export pra React.
- **Hobbyist/curioso fazendo cenas decorativas pra postar**: existe, mas LTV ~zero.

**Persona mais defensável:** dev indie/web em fase de mood/blocking, que valoriza velocidade e CC0/CC-BY explícito, e exporta pra outra engine. Mercado pequeno mas com dor real e sem ferramenta dedicada hoje.

---

## 4. Por que faz sentido AGORA

A narrativa "convergência" tem três peças verificáveis:

1. **Geração 3D virou commodity em 2026**: Meshy (~30s/asset), Tripo (~10s), Hunyuan 3.0/3.1 com 4K PBR maps, Rodin/Hyper3D enterprise-grade. APIs maduras, preço por crédito caindo. Faz sentido um editor que **gera sob demanda** quando a busca não retorna nada.
2. **Bibliotecas livres explodiram**: Poly Haven CC0 com API pública, Sketchfab com filtros de licença CC, ambientCG, Quaternius, Kenney. O agregador 3Dassets.one prova que faz sentido cruzar fontes.
3. **WebGPU + three.js r150+ + import maps** tornaram editor 3D no browser plausível sem stack pesada.

**Onde a narrativa é frouxa:** pontos 1 e 2 favorecem **qualquer** ferramenta nova, não especificamente a nossa. O argumento "ninguém integrou tudo num editor leve" é verdadeiro mas frágil — Spline pode adicionar busca externa em um sprint se quiser, e Womp já tem 5 modelos de IA integrados. A janela existe mas não é exclusiva.

Vale dizer? **Sim, com a ressalva** de que "agora é o momento" só importa se a execução acontecer em meses, não anos. Se a roadmap pra MVP cobrável é >12 meses, a janela fecha.

---

## 5. Riscos e dores honestos

- **Licenças misturadas viram pesadelo**: CC0 (Poly Haven) é uso livre; Sketchfab tem CC-BY, CC-BY-NC, CC-BY-SA, proprietário. Se o usuário fizer um jogo comercial misturando, o atribuição/restrição vira responsabilidade dele — e ele vai culpar a ferramenta. **Mitigação:** filtro por licença visível, badge no asset na cena, export gera `CREDITS.txt`. Mas não elimina o risco legal.
- **Sketchfab pode cortar/limitar API**: termos exigem login do usuário final com conta Sketchfab dentro do app, atribuição no asset everywhere, menção explícita de que é "powered by Sketchfab". Implementar isso direito = fricção pro usuário (mais um login). Não implementar = TOS violation. Poly Haven é mais permissivo (CC0) mas exige User-Agent único e API é "free for non-commercial" — uso comercial requer sponsorship.
- **Cliente pesado no browser**: três.js + loaders + decodificadores DRACO/KTX2 + cena complexa = facilmente >100MB de mem, jank no mobile. Editor 3D web tem teto natural de complexidade.
- **Conversão de formato é dor crônica**: FBX no browser é frágil (loader oficial é "best effort"), OBJ perde material, GLB com KTX2 quebra em Three antigos. Cada provider entrega formato diferente. Vai consumir tempo perpetuamente.
- **Auth + storage = primeira parede pra virar produto**: hoje é PoC local. "Salvar projeto" exige backend, conta, billing. Quando isso entra, o projeto deixa de ser experimento leve e vira startup.
- **Concorrente óbvio reage rápido**: PlayCanvas pode plugar Poly Haven em um sprint. Spline pode lançar "asset search". Nenhum deles fez ainda, mas é defesa rasa.
- **Geração via IA muda o problema**: se Meshy/Tripo/Hyper3D ficarem ainda mais rápidos e baratos, "buscar asset" perde valor relativo frente a "gerar exato o que preciso". Nossa diferenciação envelhece.

---

## 6. MVP de produto (pós-PoC)

Pra sair de "experimento legal" pra "produto cobrável":

- **Persistência**: salvar/abrir projeto (cloud, com versionamento básico). Sem isso, ferramenta é demo.
- **Auth + plano free/paid**: Logto + Stripe. Free com limite de projetos/assets/storage, paid removendo limites + IA.
- **Export robusto pra glTF/GLB** (mínimo viável) e idealmente packages prontos pra Unity (.unitypackage com prefabs) e Unreal (folder + datasmith ou USD). Esse é o **diferencial real** pro persona indie.
- **Geração via IA integrada**: pelo menos um provider (Tripo é o mais rápido/barato; Meshy é o mais completo). "Não achei na busca → gera". Crédito embutido no plano pago.
- **Compliance de licença automatizado**: filtros, badges, `CREDITS.txt` no export, modo "only CC0" pra evitar dor de cabeça.
- **Asset cache server-side**: não puxar Sketchfab/Poly Haven toda vez; CDN próprio + thumbnails normalizados. Necessário pra UX e pra não estourar rate limit dos providers.
- **Multi-user/collab**: opcional pra MVP, mas é tabela-stakes contra PlayCanvas/Spline. Adicionar depois.
- **Templates de cena**: "platformer block-out", "arch viz room", "product showcase". Reduz cold-start.

**Preço plausível:** free com watermark + limite, $9–15/mês individual, $25–40/seat team. Threekit ($500+) é outro mercado.

---

## 7. Veredito honesto

**O conceito é defensável mas a janela é estreita e o mercado é nicho.**

O que joga a favor:
- Quadrante "editor leve no browser + busca agregada de assets livres" está genuinamente vazio.
- Stack técnico está maduro (three.js, WebGPU, APIs de gen-3D commoditizadas).
- Persona dev indie/web em fase de mood/blocking tem dor real e nenhuma ferramenta dedicada.

O que joga contra:
- TAM pequeno e price-sensitive (indie dev paga $10/mês com relutância).
- Concorrentes (Spline, PlayCanvas) podem fechar a brecha rápido se virarem ameaça.
- Compliance de licença + manutenção de loaders de formato é dívida técnica perpétua, não one-time.
- Geração via IA está canibalizando "busca de asset" como problema central — em 2–3 anos, "buscar mesh pronto" pode ser tão relevante quanto "buscar foto no Getty" hoje.
- Pra virar produto cobrável precisa de auth, storage, billing, export pra engines reais — sai do escopo "experimento leve".

**Recomendação concreta pro Manu:**

Não tratar como linha de produto. Tratar como **prova-de-conceito tecnológica** que vale **um próximo passo pequeno e baratíssimo** pra validar a única hipótese que importa:

> "Dev indie/web prefere editor web com busca agregada + export glTF a workflow atual (tab Sketchfab + drag manual pro Unity)?"

**Próximo passo concreto (1–2 dias de trabalho, não mais):**
1. Fazer o PoC exportar `.glb` direito com TODOS os assets da cena empacotados + `CREDITS.txt` com licenças.
2. Deploy em `scene-ide.did.lu` ou `st.did.lu/scene-ide/v1/` com 3 providers funcionando (Poly Haven CC0 + Sketchfab downloadable filter + Kenney/Quaternius via JSON manifest).
3. Postar em 2–3 lugares onde o persona vive: r/threejs, r/gamedev (Show & Tell), HN "Show HN", Twitter três.js community.
4. Métrica única: número de usuários que voltam dia 2 e dia 7. Se for >5–10 retentivos, vale investir mais. Se for ~0, arquivar com aprendizado.

**Não** investir em backend, auth, billing, multi-user, IA integrada **até ter sinal de retenção**. Esses são caros e matam o "experimento leve" se construídos no escuro.

Se quiser apostar mais alto sem essa validação, o caminho é ir direto pra **Unity Asset Browser plugin** (extensão do Unity Editor que faz busca multi-provider dentro do Unity) — mesmo problema, persona mais clara, monetização via Unity Asset Store. Mais simples de validar comercialmente do que browser-editor SaaS.

---

## Fontes consultadas

- Spline pricing: https://spline.design/pricing
- PlayCanvas Editor: https://playcanvas.com/products/editor
- Womp pricing: https://www.womp.com/pricing
- Babylon.js Editor: https://editor.babylonjs.com/
- Vectary pricing: https://www.vectary.com/pricing/
- Polycam pricing: https://poly.cam/pricing
- Threekit: https://www.threekit.com/pricing
- Sketchfab API guidelines: https://sketchfab.com/developers/guidelines
- Poly Haven API: https://polyhaven.com/our-api
- 3Dassets.one: https://3dassets.one/about-site
- Comparativo gen-3D 2026: https://www.3daistudio.com/blog/best-3d-model-generation-apis-2026
