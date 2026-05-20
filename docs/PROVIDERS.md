# Como adicionar um provider novo

> Pré-requisito: [ARCHITECTURE.md](./ARCHITECTURE.md) — em particular a seção `providers/ — contrato`.

Esse é o caminho mais comum de contribuir pra engine. Provider novo = arquivo novo em `public/src/providers/`, sem alterar nenhum outro arquivo do core. O `providers/index.js` registra a lista.

---

## Checklist mínimo

1. **Avaliar a API** — antes de codar, conferir:
   - [ ] Endpoint de busca por texto retorna JSON
   - [ ] CORS permite request from-browser (testar com `curl -I` ou no DevTools console)
   - [ ] Download é por URL pública direta OU via fluxo de auth realista
   - [ ] Formato é glTF/GLB (preferido) ou FBX/OBJ
   - [ ] Licença é clara — CC0, CC-BY, etc.
2. **Documentar achados** em [PROVIDERS-RESEARCH.md](./PROVIDERS-RESEARCH.md) (anexar seção)
3. **Implementar** o módulo `public/src/providers/<id>.js`
4. **Registrar** em `public/src/providers/index.js`
5. **Validar** local com 3 queries variadas (`tree`, `chair`, `helmet`)
6. **Atualizar** este doc se descobrir padrão útil

---

## Template

```js
// public/src/providers/<id>.js
export const id          = 'mysource';
export const label       = 'My Source';
export const description = 'short tagline for the dropdown';
export const needsKey    = false;   // true se precisa de API token

// se needsKey=true:
// export const keyHint = 'paste your token from <url>';
// export function getKey() { return localStorage.getItem('scene-ide:keys:mysource') || ''; }
// export function setKey(k) { ... }

export async function search(query, { signal } = {}) {
  const q = (query || '').trim();
  if (!q) return [];
  const url = new URL('https://api.mysource.com/v1/search');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '24');
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`mysource search: HTTP ${r.status}`);
  const json = await r.json();
  return (json.items || []).map(item => ({
    id: `mysource:${item.id}`,
    source: 'mysource',
    name: item.title || item.id,
    thumb: item.thumbnailUrl,
    license: item.license || 'see source',
    format: 'glb',
    raw: { id: item.id, downloadUrl: item.url },
  }));
}

export async function download(item, { onProgress, signal } = {}) {
  const url = item.raw.downloadUrl;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`mysource download: HTTP ${r.status}`);
  const total = parseInt(r.headers.get('Content-Length') || '0', 10);
  if (total && r.body && onProgress) {
    const reader = r.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress(received, total);
    }
    const blob = new Blob(chunks, { type: 'model/gltf-binary' });
    return { url: URL.createObjectURL(blob), blob, contentType: 'model/gltf-binary', ext: 'glb' };
  }
  const blob = await r.blob();
  return { url: URL.createObjectURL(blob), blob, ext: 'glb' };
}
```

Depois, em `providers/index.js`:

```js
import * as mysource from './mysource.js';
export const providers = [khronos, polyhaven, sketchfab, mysource];
```

E pronto.

---

## Padrões úteis (extraídos dos providers existentes)

### Cache de índice (Poly Haven)

Se o provider não tem search server-side e exige baixar um índice grande uma vez, faça cache em escopo de módulo:

```js
let _indexCache = null;
let _indexCachePromise = null;

async function loadIndex() {
  if (_indexCache) return _indexCache;
  if (_indexCachePromise) return _indexCachePromise;
  _indexCachePromise = (async () => {
    const r = await fetch('...');
    _indexCache = await r.json();
    return _indexCache;
  })();
  return _indexCachePromise;
}
```

Pattern garante que múltiplas chamadas concorrentes a `search()` durante o boot só fazem 1 fetch.

### Catálogo curado hardcoded (Khronos)

Se a fonte não tem API mas você sabe que os arquivos estão acessíveis via URL determinística (ex: GitHub raw), declare uma lista hardcoded:

```js
const CATALOG = [
  { slug: 'DamagedHelmet', label: 'Damaged Helmet', tags: ['helmet','scifi'], license: 'CC-BY 4.0' },
  ...
];
```

Search filtra essa lista. Download monta a URL. Resulta em provider 100% confiável (sem API external pra cair) com cobertura limitada.

### Texturas separadas com mapeamento custom (Poly Haven)

Se o `.gltf` referencia texturas com paths relativos mas o servidor as serve em um path diferente, faça **rewriting** do JSON do gltf antes de criar o blob:

```js
const patched = JSON.parse(text);
if (Array.isArray(patched.images)) {
  for (const im of patched.images) im.uri = resolve(im.uri);
}
const blob = new Blob([JSON.stringify(patched)], { type: 'model/gltf+json' });
```

Onde `resolve(uri)` consulta o mapa `include` da API do provider (ou um mapping próprio).

### Provider com OAuth (Sketchfab)

Quando download exige token:

1. Search funciona anônimo — retorna resultados, mas no download avalia se tem token salvo
2. Se não tem, lança erro com instrução clara: `throw new Error('mysource: API token not configured. Click the key icon in the provider menu and paste your token from <url>.')`
3. Engine não força o user a configurar antes de ver resultados — só quando ele tentar baixar

Storage: `localStorage:scene-ide:keys:<id>` (consistente entre providers).

### Download de .zip

Alguns providers (ex: Sketchfab) entregam o asset como `.zip` contendo `.gltf` + `.bin` + `textures/`. Pra suportar isso:

1. Detectar via `contentType: 'application/zip'` ou extensão da URL
2. Usar `fflate` via importmap pra unzip in-memory:
   ```js
   import { unzip } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.0/esm/browser.js';
   ```
3. Localizar o `.gltf` principal no zip + criar blob URLs pra cada arquivo dependente
4. Reescrever URIs no `.gltf` apontando pras blob URLs locais

Implementar isso uma vez em um helper compartilhado (`providers/_unzip-gltf.js`) — não dentro de cada provider que precisar.

---

## Smithsonian (esboço pra próximo provider)

Como dica pra quem for integrar:

- Base: https://api.si.edu/openaccess/api/v1.0
- API key data.gov é grátis em https://api.data.gov/signup
- Filtro pra 3D: `content.descriptiveNonRepeating.online_media.media[*].type='3D Images'` — sintaxe ainda precisa de testes
- Modelos no CDN público da Smithsonian (https://3d.si.edu)
- Licenças: maioria CC0 (Smithsonian Open Access)
- Não tem progress no download (Content-Length ausente em alguns casos)
- Espera: ~1-2h de exploração curl pra fechar
