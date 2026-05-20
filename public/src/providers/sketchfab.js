// Sketchfab — huge catalog, but download requires OAuth.
// Without a token, we can SEARCH (public endpoint, CORS OK) but cannot download.
//
// Search endpoint:
//   https://api.sketchfab.com/v3/search?type=models&downloadable=true&q=<query>&count=24
//
// Download endpoint (requires Authorization: Bearer <token>):
//   GET https://api.sketchfab.com/v3/models/<uid>/download
//   -> returns { gltf: { url, expires } } (signed S3 URL valid ~30s)
//
// Token can be obtained from https://sketchfab.com/settings/password (API token).
// User pastes it once, we store in localStorage as clag:keys:sketchfab.
//
// In the PoC we surface results without a token (clickable through to Sketchfab page),
// and only attempt download if the user provided a token.

export const id = 'sketchfab';
export const label = 'Sketchfab';
export const description = 'Massive 3D catalog. Downloads require a free Sketchfab API token.';
export const needsKey = true;
export const keyHint = 'paste a Sketchfab API token (sketchfab.com/settings/password) to enable downloads';

const KEY_STORAGE = 'clag:keys:sketchfab';

export function getKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function setKey(k) {
  if (k) localStorage.setItem(KEY_STORAGE, k);
  else localStorage.removeItem(KEY_STORAGE);
}

export async function search(query, { signal } = {}) {
  const q = (query || '').trim();
  if (!q) return [];
  const url = new URL('https://api.sketchfab.com/v3/search');
  url.searchParams.set('type', 'models');
  url.searchParams.set('downloadable', 'true');
  url.searchParams.set('archives_flavours', 'false');
  url.searchParams.set('q', q);
  url.searchParams.set('count', '24');
  let r;
  try {
    r = await fetch(url, { signal });
  } catch (e) {
    console.warn('sketchfab fetch failed (likely CORS / network)', e);
    return [];
  }
  if (!r.ok) return [];
  const json = await r.json();
  const items = json.results || [];
  return items.map(m => ({
    id: `sketchfab:${m.uid}`,
    source: 'sketchfab',
    name: m.name || m.uid,
    thumb: m.thumbnails?.images?.find(i => i.width >= 200)?.url || m.thumbnails?.images?.[0]?.url,
    license: m.license?.label || 'see Sketchfab',
    format: 'glb',
    raw: {
      uid: m.uid,
      viewerUrl: m.viewerUrl,
    },
  }));
}

export async function download(item, { onProgress, signal } = {}) {
  const token = getKey();
  if (!token) {
    // mensagem curta em PT-BR — search.js detecta esse padrao e abre painel
    // custom de configuracao via toast com botao "Configurar".
    throw new Error('sketchfab: token de API nao configurado');
  }
  const r = await fetch(`https://api.sketchfab.com/v3/models/${item.raw.uid}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (r.status === 401) throw new Error('sketchfab: token rejected (401)');
  if (r.status === 403) throw new Error('sketchfab: model not downloadable for this account (403)');
  if (!r.ok) throw new Error(`sketchfab: HTTP ${r.status}`);
  const json = await r.json();
  const gltf = json.gltf;
  if (!gltf?.url) throw new Error('sketchfab: no gltf url in download response');
  // The signed url usually points to a .zip with gltf+bin+textures.
  // For PoC simplicity we fetch as blob and hand it to the gltf loader via URL — but most sketchfab
  // downloads are zipped, so this will likely require unzipping. We surface a clear error if so.
  const dl = await fetch(gltf.url, { signal });
  if (!dl.ok) throw new Error(`sketchfab dl: HTTP ${dl.status}`);
  const contentType = dl.headers.get('Content-Type') || '';
  if (contentType.includes('zip') || gltf.url.endsWith('.zip')) {
    throw new Error('sketchfab: download is a .zip — extraction not implemented in PoC. (Will be added with fflate.)');
  }
  const total = parseInt(dl.headers.get('Content-Length') || '0', 10);
  if (total && dl.body && onProgress) {
    const reader = dl.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress(received, total);
    }
    const blob = new Blob(chunks, { type: contentType || 'model/gltf-binary' });
    return { url: URL.createObjectURL(blob), blob, contentType, ext: 'glb' };
  }
  const blob = await dl.blob();
  return { url: URL.createObjectURL(blob), blob, contentType, ext: 'glb' };
}
