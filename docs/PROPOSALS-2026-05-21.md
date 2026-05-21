# Propostas 2026-05-21 — análise pós gizmo D

Documento consolidado de uma revisão tripla disparada em paralelo na branch `feat/surface-snap-gizmo` (commit `055c5b4`):

1. **QA visual headless** — Playwright cobrindo 20 cenários do gizmo D, screenshots em `screenshots/qa-review-2026-05-21/`.
2. **Code review profundo** — 15 arquivos do branch (+1732/-29), foco em bugs, leaks, hot path, edge cases, acoplamento.
3. **Arquitetura geral** — princípios documentados vs realidade, mapa de módulos, estado, débito acumulado, escalabilidade.

Esse doc fica no repo como complemento de [PROPOSALS.md](./PROPOSALS.md) (que tem CONFIG + GIZMO propostas antes da implementação). Aqui é estado pós-implementação, com bug list priorizada e propostas de melhoria de arquitetura.

---

## TL;DR

- **Branch `feat/surface-snap-gizmo` NÃO está pronto pra merge fast-forward em main.** QA encontrou regressão ALTA no surface-snap × anti-overlap que era exatamente o cenário que o patch D.5 prometia cobrir.
- **Code review encontrou 3 ALTAs adicionais** (memory leak de AABBs em load, RAF infinito do cadeado alocando todo frame, listener Esc duplicado).
- **Arquitetura está saudável globalmente** (princípios respeitados, API headless completa, providers plug-in funcionam) mas tem 2 módulos-deus emergindo: `contextual-gizmo.js` (684 linhas) e `main.js` (468 linhas).
- **Estimativa de débito pra deixar D mergeavel + production-grade: 5-7h** focadas. Sem isso, opção é mergear com débito conhecido OU manter branch e atacar bugs antes.

---

## Bugs encontrados (priorizados)

### 🔴 ALTA — bloqueiam merge ou comprometem UX em uso comum

#### QA-1. Surface-snap "escala" obstáculos em drags de salto médio

- **Onde:** `contextual-gizmo.js::_onPointerMove` + `dragObjectTo` (sub-step loop).
- **Repro:** cubo em (0, 0.5, 0), sphere em (1.5, 0.6, 0). `dragObjectTo(cubeId, {x:1.5, z:0})` → cubo termina em **(1.5, 1.70, 0)** empilhado em cima da sphere.
- **Detalhe:** drag step-by-step (x=0.5/0.8/1.0/1.2/1.4/1.5) mostra Y subindo (1.43 → 1.69 → 1.70) enquanto XZ destrava. Sub-step intermediário ainda permite "escalar" o obstáculo apesar do patch D.5.
- **Por quê importa:** é exatamente o bug que `9cb63e1` ("patch D.5 — surface-snap só no step final") devia ter fechado. Não está fechado pra saltos médio/grandes.
- **Hipótese:** surface-snap pode estar rodando no step final, mas o sweep XZ no penúltimo step já permitiu entrar na coluna XZ do outro objeto. Quando o final step chega + surface-snap, o objeto está no XZ permitido **acima** do outro, e cola na superfície que é o topo do other. Falta um sweepXZ pós-surface-snap pra validar que ainda não overlap horizontalmente.
- **Evidência:** `screenshots/qa-review-2026-05-21/06-cube-blocked-by-sphere.png`.

#### QA-2. Anti-overlap vertical bloqueia onde não deveria

- **Onde:** `physics.js::sweepXZ` (yOverlap check).
- **Repro:** lustre em (3, 2.2, 0) drag pra x=2 → bloqueado em x=2.62 perto da sphere y=0.6. Ranges Y não sobrepõem (sphere 0–1.2 / lustre 1.7–2.7).
- **Detalhe:** quando o lustre passa exatamente alinhado com a sphere (x=1.5) ele PASSA; quando passa pela borda da sphere em XZ, BLOQUEIA. Comportamento inconsistente sugere que yOverlap está sendo calculado em ponto errado do sweep.
- **Por quê importa:** o D.4 inteiro era pra permitir esse cenário ("lustre passa sobre cubo"). Está parcialmente quebrado.
- **Evidência:** `screenshots/qa-review-2026-05-21/07-lustre-vertical-test.png`.

#### CR-1. Memory leak de AABBs em `persist.js::restoreSceneFromLocal`

- **Onde:** `public/src/persist.js:93`.
- **O quê:** `while (userRoot.children.length) userRoot.remove(userRoot.children[0])` bypassa `removeFromScene`, então `physics.unregister` nunca é chamado. O `_store` Map em `physics.js` mantém referências aos objetos antigos.
- **Por quê importa:** cada load vaza N objetos. Em sessão longa (load/save loop) `sweepXZ` itera AABBs fantasma, gerando colisores invisíveis que bloqueiam drag em pontos arbitrários.
- **Sugestão:** trocar pelo padrão usado em outros pontos (`removeFromScene` que já chama `physics.unregister`). Ou criar `physics.clear()` chamado antes do loop.

#### CR-2. RAF do cadeado nunca cancelado + aloca todo frame

- **Onde:** `contextual-gizmo.js::_animateLock` (~linha 277-280) e `_updateLockOverlay`.
- **O quê:** `requestAnimationFrame(_animateLock)` roda eternamente. `_updateLockOverlay` aloca `new THREE.Box3().setFromObject(sel)` + `new THREE.Vector3()` a cada frame mesmo sem seleção.
- **Por quê importa:** alocação contínua a 60Hz (garbage pressure). `Box3.setFromObject` é O(meshes_no_objeto) — pode pesar em models GLB grandes.
- **Sugestão:** integrar no RAF do render loop em `scene.js`; cachear Box3/Vector3 module-level; bail-out se `!sel`.

#### CR-3. Listener `keydown` duplicado capturando Esc

- **Onde:** `contextual-gizmo.js:92-111` registra `keydown` em window; `scene.js:194` também.
- **O quê:** dois handlers de Esc em window. Ordem indeterminada. Esc durante drag dispara `_cancelDrag()` mas TAMBÉM `setSelected(null)` → perde seleção sem precisar.
- **Por quê importa:** UX inconsistente. Esc é botão de "cancelar tudo" — perdeu seleção também é esperado por alguns, mas semântica D.5 era "Esc só cancela drag/sai do mode transform".
- **Sugestão:** consolidar handler único em `contextual-gizmo.js` ou propagar `stopPropagation()` quando consumir Esc.

### 🟡 MÉDIA — fixar antes de v1.1, não bloqueiam

#### CR-4. AABB stale após `duplicateObject` (Ctrl+D)

- **Onde:** `scene.js:266-275`.
- **O quê:** clone é adicionado direto via `userRoot.add(clone)` sem `physics.register(clone)`. Clone fica invisível ao sweep — outros objetos atravessam ele.
- **Sugestão:** chamar `physics.register(clone)` após o `add`.

#### CR-5. Alocações no hot path de pointermove

- **Onde:** `contextual-gizmo.js::_onPointerMove` (~382-426).
- **O quê:** ~3× `new THREE.Vector3` por movimento + `Box3` em `_applyDragStep`. Multiplica por 32 com sub-steps.
- **Sugestão:** Vector3/Box3/Raycaster reutilizáveis module-level. Cachear `baseOffset` no `_dragStart`, não em cada step.

#### CR-6. `physics.surfaceUnder` cria Raycaster a cada chamada

- **Onde:** `physics.js:80-82`.
- **Sugestão:** Raycaster singleton, `.set(origin, dir)` em vez de `new`.

#### CR-7. `surfaceUnder` ignora room:wall/ceiling — drag de objeto com anchor=ceiling cai

- **Onde:** `physics.js:88-90` (filtro `_isRoomPart`).
- **O quê:** durante drag, surface retorna Y=0 → objeto desce até o chão → patch em `_onPointerUp` reaplica `applyAnchor` no commit. UX feia (objeto pulsa).
- **Sugestão:** detectar `obj.userData.anchor === 'ceiling'|'wall'` cedo no drag e bypassar surface-snap.

#### CR-8. `sweepXZ` muta Vector3 com prop `.blocked`

- **Onde:** `physics.js:231-235`.
- **O quê:** anexar prop arbitrária num Vector3 quebra tipo. `.clone()` perde `.blocked` silenciosamente.
- **Sugestão:** retornar `{ position: Vector3, blocked: boolean }`.

#### CR-9. `freeTransform` consulta inconsistente em ≥4 arquivos

- **Onde:** `api.js:189/207/359`, `contextual-gizmo.js:360/565`.
- **O quê:** mistura `!!obj.userData.freeTransform` vs `obj.userData?.freeTransform === true`.
- **Sugestão:** helper único `isFreeTransform(obj)`.

#### CR-10. Dois caminhos pra setar lock/freeTransform divergem

- **Onde:** `api.js::setObjectFreeTransform` vs `api.js::toggleLock` (via `cgToggleLock`).
- **O quê:** `setObjectFreeTransform` chama `snap.applySnapToObject` quando volta a snapar; `toggleLock` não. Estados divergem dependendo do caminho.
- **Sugestão:** consolidar.

#### CR-11. `dragObjectTo` sem validação de input

- **Onde:** `api.js:214-219`.
- **O quê:** aceita `null`, `NaN`, objeto qualquer via `?? 0`. Mascara bug do chamador.
- **Sugestão:** rejeitar `!Number.isFinite(x) || !Number.isFinite(z)` com Error claro.

#### QA-3. `dragObjectTo` não aceita `name` (só `sceneId`)

- **Onde:** `api.js`.
- **O quê:** `dragObjectTo('Cube', ...)` lança `"objeto nao encontrado: Cube"`. Inconsistente com `selectByName` que aceita name.
- **Sugestão:** aceitar ambos OU documentar restrição.

#### CR-12. `registerAll` chamado em 3 sites com `updateMatrixWorld` precedendo

- **Onde:** `main.js:177-179`, `main.js:427-428`, `main.js:446`.
- **O quê:** ordem frágil. Bug 13 já apareceu uma vez. Próximo `load`-equivalente vai esquecer.
- **Sugestão:** helper centralizado `scene.syncAfterMutation()` (proposta E abaixo).

### 🟢 BAIXA — cosmético, débito, melhorias incrementais

- **CR-13.** `_isRoomPart` duplicado em `physics.js:246` e `contextual-gizmo.js:681`. Exportar de scene.js.
- **CR-14.** `_shouldSkip` em `physics.js:240-244` tem branch morta (`if (_isRoomPart) return false` é no-op).
- **CR-15.** `try/catch` engolindo localStorage em 6 lugares. Em dev, `console.warn` no catch.
- **CR-16.** `console.log` de boot em prod (`api.js:459`, `server.js:9,37`). Gate por flag.
- **CR-17.** Magic numbers sem const (`SIZE = 32`, raycaster `200/500`, `0.05`).
- **CR-18.** Hint LS key binária irreversível — user que viu uma vez não tem como ver de novo. `api.resetHint()` opcional.
- **QA-4.** Tooltip do cadeado tem classe `.tooltip-custom` (não `.lock-tooltip`). Só naming.
- **QA-5.** Hint banner aparece no chão da viewport (y≈609). Considerar centralizar pra discoverability.
- **QA-6.** `addPrimitive(kind)` API ignora `position`/`name`. Forçar workflow add+drag.

### Bugs pré-existentes (não regressão deste branch)

- **DEBT-1.** **41 `title=` nativos no DOM** (toolbar/inspector/outliner). Princípio 8 documentado e proibido. Tooltip custom existe (`contextual-gizmo.js:150`) mas só usado pro cadeado. Migrar em batch.
- **DEBT-2.** **Boot não restaura cena automaticamente** — usuário sempre clica Load. Viola implicitamente princípio 7 ("persistência leve").
- **DEBT-3.** Persistência v1 não cobre cor de paredes editadas, modificações de roughness em primitivas, câmera/orbit, layout de painéis.

---

## Plano de mitigação curto prazo (antes de mergear gizmo D)

### Wave 1 — fechar regressões críticas (~2-3h)

1. **QA-1 (escalar obstáculos)**: investigar sub-step loop. Hipótese: rodar `sweepXZ` pós surface-snap pra validar que objeto não está overlap horizontal no Y novo. Testar batch com QA Playwright mesmo cenário (cube → sphere x=1.5).
2. **QA-2 (yOverlap inconsistente)**: revisitar lógica de `sweepXZ` quando candidato Y é diferente. Adicionar teste com lustre + cube cruzando em pontos diversos.
3. **CR-1 (AABB leak)**: trocar loop de remoção em `persist.js:93` por chamadas via `removeFromScene` OU adicionar `physics.clear()` chamado antes.

### Wave 2 — robustez (~1.5h)

4. **CR-2 (RAF infinito)**: mover update do cadeado pro RAF de render em `scene.js`. Cachear Box3/Vector3 module-level. Bail-out sem seleção.
5. **CR-3 (Esc duplicado)**: consolidar handler. `contextual-gizmo.js` consome Esc com `stopPropagation()` durante drag/modo transform.
6. **CR-4 (duplicate sem register)**: 1 linha em `scene.js:266-275`.
7. **CR-12 (registerAll centralizado)**: criar `scene.syncAfterMutation()`. 3 call sites passam a usar.

### Wave 3 — performance + consistência (~1.5h)

8. **CR-5/CR-6**: Vector3/Box3/Raycaster module-level em physics.js + contextual-gizmo.js.
9. **CR-7**: bypass surface-snap quando anchor=ceiling/wall.
10. **CR-8**: retorno tipado de `sweepXZ`.
11. **CR-9/CR-10**: helper `isFreeTransform` + consolidar paths.
12. **CR-11**: validar input de `dragObjectTo`.

### Wave 4 — cosmético (opcional, ~30min)

CR-13/14/17 + QA-4/5 + DEBT-2 (boot auto-load).

**Após Wave 1+2:** re-rodar QA Playwright completo. Se verde, merge fast-forward + deploy. Wave 3+4 podem ir como follow-up.

---

## Propostas de melhoria de arquitetura

### Proposta 1 — `prefs.js` unificado (já desenhada em PROPOSALS.md §1)

**Problema:** 6 chaves localStorage com owner difuso. Gizmo D adicionou 3 novas (`clag:surface-snap-enabled`, `clag:snap-migration-v2`, `clag:hint-seen`). Próxima feature adiciona a 7ª.

**Proposta:** Implementar a Opção C de PROPOSALS.md §1 — `clag:preferences-v1` JSON único + migration silenciosa + `prefs.get/set/on(key, fn)`. Pré-requisito de qualquer painel de config futuro.

**Esforço:** S (~40 linhas + migrations one-shot).
**Risco:** Baixo. Migration é one-shot.
**Quando:** já. Está bloqueando crescimento.

### Proposta 2 — Quebrar `contextual-gizmo.js` (684 linhas)

**Problema:** Módulo-deus misturando 8 responsabilidades. Adicionar 1 feature de interação hoje toca esse arquivo inteiro.

**Proposta:** 4 módulos < 200 linhas cada:
- `gizmo-drag.js` — pointer handlers, sweepXZ+surfaceUnder calls, sub-steps.
- `gizmo-overlays.js` — cadeado HTML, tooltip custom, hint banner.
- `gizmo-hover.js` — Box3Helper hover, cursor states.
- `gizmo-mode.js` — flag `_contextualMode`, W/E/R toggle.

Todos importam `physics.js` direto. Sem dep circular nova.

**Esforço:** M.
**Risco:** Médio — refactor de arquivo crítico recém-mergeado. Validação Playwright obrigatória.
**Quando:** depois de Wave 1+2 fecharem bugs. Quebrar com bugs dentro só amplifica.

### Proposta 3 — Extrair UI factories de `main.js`

**Problema:** `main.js` (468 linhas) mistura wiring de listeners com construção de modais (Sala, painel chave, popover snap). Adicionar modal novo (export glb, undo history, painel licenças) vai inchar mais.

**Proposta:** `ui/room-modal.js`, `ui/key-panel.js`, `ui/snap-popover.js`, cada um exportando `open(opts)/close()`. `main.js` vira só wiring (< 200 linhas).

**Esforço:** S–M.
**Risco:** Baixo. Refactor mecânico.
**Quando:** quando próximo modal entrar (provavelmente export glb v1.1).

### Proposta 4 — Helper `syncSceneAfterMutation()`

**Problema:** Padrão `updateMatrixWorld(true) → physics.registerAll(userRoot)` aparece em 3 sites (boot, btn-load, api.load). Cada um adicionado depois de Bug 13. Próximo `load`-like vai esquecer.

**Proposta:** `scene.js` exporta `syncSceneAfterMutation()`. 3 call sites usam. Documentar em ARCHITECTURE.md como ponto obrigatório após mutação em batch.

**Esforço:** S.
**Risco:** Baixo.
**Quando:** já, como parte de Wave 2.

### Proposta 5 — Migrar 41 `title=` pra tooltip custom

**Problema:** Princípio 8 explicitamente proíbe `title=""`. Tooltip custom existe mas só pro cadeado. 41 elementos no DOM violam.

**Proposta:** Generalizar tooltip do cadeado num módulo `ui/tooltip.js`. Substituir todos `title="..."` por `data-tooltip="..."`. Listener global em `tooltip.js` faz mouseenter/leave + positioning.

**Esforço:** M (componente novo + 41 substituições, com risco de strings PT-BR já existirem em diversos arquivos).
**Risco:** Baixo. Refactor mecânico, fácil de testar visualmente.
**Quando:** v1.1 ou junto com Proposta 3.

### Proposta 6 — `state.js` centralizado (longo prazo)

**Problema:** Estado vive em userData de Object3D + variáveis-módulo + LS + DOM classes. Princípio 6 promete "state explícito" mas a prática viola. Bugs recentes (5/8/10/13) são todos sobre sincronização.

**Proposta:** `state.js` exporta `getObjectState(obj)/setObjectState(obj, patch)` com schema documentado. userData vira *implementação*. API uniforme: `state.setAnchor(obj, 'wall')` dispara `sceneChanged`, atualiza userData, sincroniza inspector.

**Esforço:** L. Toca todo módulo que lê userData.
**Risco:** Alto. Só vale se features novas estão chegando (undo/redo, multi-select, colaboração).
**Quando:** **adiar.** Não vale custo a menos que v1.1 traga undo/redo (que parece prováivel pelo ROADMAP).

### Proposta 7 — Boot auto-load de cena salva (DEBT-2)

**Problema:** Usuário sempre clica Load manual. Princípio 7 desejava persistência transparente.

**Proposta:** No boot, se `clag:scene-v1` existe em LS, carregar automaticamente. Adicionar toast PT-BR discreto ("cena anterior carregada — botão limpar pra zerar"). Botão "Limpar" já existe no UI.

**Esforço:** XS (~20 linhas em `main.js`).
**Risco:** Baixo. Único cuidado: usuário com save quebrado fica em loop — adicionar try/catch + fallback pra starter scene + toast de erro.
**Quando:** já, junto com Wave 4.

---

## Scores arquiteturais (1–5)

| Dimensão | Score | Notas |
|---|---|---|
| Princípios | 4 | 9 princípios respeitados na prática. Único desvio: 41 `title=` nativos (P8 parcial). |
| Modularização | 3 | 20 módulos bem nomeados, 4 deles >400 linhas (`contextual-gizmo` 684, `inspector` 522, `search` 414, `main` 468). |
| Estado | 2 | Espalhado por userData + módulo-vars + LS + DOM. Bugs recentes (5/8/10/13) todos sobre sync. |
| Testabilidade | 4 | `window.clag` cobre ~95% da UI. Gap: pintar cor via API, abrir/fechar modais. |
| Performance | 4 | Importmap CDN pinned. Render loop limpo. AABBs O(N) fine pra N<100. Hot path em pointermove melhorável (CR-5/6). |
| UX | 4 | PT-BR consistente, componentes custom, surface-snap é diferencial. Hint discoverability fraco; boot não auto-load. |
| Escalabilidade | 3 | Provider plugin escala. Inspector vai virar O(N) por `sceneChanged`. Estado quebra primeiro em undo/redo. |
| Documentação | 5 | ARCHITECTURE+PRINCIPLES+PROPOSALS+ROADMAP+PROGRESS coerentes. PROPOSALS.md exemplar. |

---

## Veredito final e recomendação

**Status atual da branch:** não-mergeavel sem fix de QA-1 e QA-2 (regressões ALTA do gizmo). CR-1/2/3 também devem ir antes (~3h total na Wave 1+2).

**Recomendação:**
1. Atacar Wave 1 (QA-1, QA-2, CR-1) — 2-3h.
2. Re-rodar QA Playwright. Se verde, atacar Wave 2 (1.5h).
3. Re-rodar Playwright leve. Merge fast-forward + deploy em https://clag.did.lu.
4. Wave 3+4 viram backlog v1.1.
5. Propostas 1, 4, 7 entram já. Propostas 2, 3, 5 viram backlog v1.1 ou início de v1.2. Proposta 6 fica em hold até decisão sobre undo/redo.

**Sobre futuro do projeto:** projeto está em saúde boa pra um PoC de 4 dias. O risco real não é técnico — é desenhar o painel de config (PROPOSALS.md §1) sem matar a discoverability contextual que o gizmo D recém entregou. Decisão de produto, não de código.

---

## Artefatos desta análise

- **Screenshots QA:** `screenshots/qa-review-2026-05-21/` (15 imagens).
- **Output bruto dos 3 agentes:** transcripts em `C:\Users\manu\AppData\Local\Temp\claude\...` (descartar após consolidação).
- **Este doc:** `docs/PROPOSALS-2026-05-21.md`.

Próxima sessão: ler PROGRESS.md + este doc + escolher Wave 1.
