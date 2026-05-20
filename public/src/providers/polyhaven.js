// Poly Haven — CC0 PBR assets. Public API at https://api.polyhaven.com (no key, CORS-friendly).
// Docs: https://api-docs.polyhaven.com/
//
// Endpoints used here:
//   GET /assets?t=models[&categories=<comma>]      -> all models index
//   GET /files/<slug>                              -> file URLs per asset
//
// CORS: api.polyhaven.com allows browser fetch.
// Files served from dl.polyhaven.org (also CORS-friendly).

export const id = 'polyhaven';
export const label = 'Poly Haven';
export const description = 'CC0 PBR assets (models, HDRIs, textures).';
export const needsKey = false;

let _indexCache = null;
let _indexCachePromise = null;

async function loadIndex() {
  if (_indexCache) return _indexCache;
  if (_indexCachePromise) return _indexCachePromise;
  _indexCachePromise = (async () => {
    const r = await fetch('https://api.polyhaven.com/assets?t=models');
    if (!r.ok) throw new Error(`polyhaven index: HTTP ${r.status}`);
    const json = await r.json();
    // json is an object { slug: { name, categories, tags, ... } }
    _indexCache = Object.entries(json).map(([slug, meta]) => ({
      slug,
      name: meta.name || slug,
      tags: meta.tags || [],
      categories: meta.categories || [],
      authors: Object.keys(meta.authors || {}),
    }));
    return _indexCache;
  })();
  return _indexCachePromise;
}

export async function search(query, { signal } = {}) {
  const q = (query || '').trim().toLowerCase();
  let list;
  try {
    list = await loadIndex();
  } catch (e) {
    console.warn('polyhaven: index load failed', e);
    return [];
  }
  if (signal?.aborted) return [];
  if (!q) list = list.slice(0, 40);
  else {
    list = list.filter(a => {
      if (a.slug.includes(q)) return true;
      if (a.name.toLowerCase().includes(q)) return true;
      if (a.categories.some(c => c.includes(q))) return true;
      return a.tags.some(t => String(t).toLowerCase().includes(q));
    }).slice(0, 40);
  }
  return list.map(a => ({
    id: `polyhaven:${a.slug}`,
    source: 'polyhaven',
    name: a.name,
    thumb: `https://cdn.polyhaven.com/asset_img/thumbs/${a.slug}.png?width=128&height=128`,
    license: 'CC0',
    format: 'gltf',
    raw: { slug: a.slug },
  }));
}

export async function download(item, { onProgress, signal } = {}) {
  const slug = item.raw.slug;
  // get files index
  const fr = await fetch(`https://api.polyhaven.com/files/${slug}`, { signal });
  if (!fr.ok) throw new Error(`polyhaven files: HTTP ${fr.status}`);
  const files = await fr.json();
  // pick gltf/<lowest resolution available>/<slug>.gltf  (smaller = faster preview)
  const gltf = files.gltf;
  if (!gltf) throw new Error(`polyhaven: asset "${slug}" has no glTF build`);
  const resolutions = Object.keys(gltf);
  const preferred = ['1k', '2k', '4k', '8k', '16k'];
  const res = preferred.find(p => resolutions.includes(p)) || resolutions[0];
  const gltfEntry = gltf[res]?.gltf;
  if (!gltfEntry) throw new Error(`polyhaven: no gltf entry at ${res}`);
  // gltfEntry: { url, md5, size, include: { '<relativePath>': { url, ... } } }
  // The .gltf file uses relative URIs (e.g. 'textures/foo.jpg' or 'foo.bin') and the API gives
  // us an explicit `include` map from those paths to absolute URLs (which may live in a different
  // path tree — Poly Haven stores textures under /jpg/ not /gltf/, so naive base-prefix fails with 404).
  const gltfUrl = gltfEntry.url;
  const includeMap = gltfEntry.include || {};
  const r = await fetch(gltfUrl, { signal });
  if (!r.ok) throw new Error(`polyhaven gltf: HTTP ${r.status}`);
  const text = await r.text();
  const patched = JSON.parse(text);
  const baseDir = gltfUrl.replace(/\/[^/]+$/, '/');
  const resolve = uri => {
    if (!uri || /^https?:|^data:/.test(uri)) return uri;
    if (includeMap[uri]?.url) return includeMap[uri].url;
    // fallback: try without 'textures/' prefix; otherwise concatenate baseDir
    const key = Object.keys(includeMap).find(k => k.endsWith('/' + uri) || k === uri);
    if (key) return includeMap[key].url;
    return baseDir + uri;
  };
  if (Array.isArray(patched.buffers)) {
    for (const b of patched.buffers) b.uri = resolve(b.uri);
  }
  if (Array.isArray(patched.images)) {
    for (const im of patched.images) im.uri = resolve(im.uri);
  }
  const blob = new Blob([JSON.stringify(patched)], { type: 'model/gltf+json' });
  if (onProgress) onProgress(1, 1);
  return { url: URL.createObjectURL(blob), blob, contentType: 'model/gltf+json', ext: 'gltf' };
}
