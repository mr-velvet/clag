// provider registry — each provider is a self-contained module exporting:
//   id: string (machine id)
//   label: string (display name)
//   description: string
//   needsKey: boolean
//   search(query, { signal }): Promise<AssetResult[]>
//   download(item, { onProgress, signal }): Promise<{ url, contentType, ext, blob?, displayMeta }>
//
// AssetResult: { id, source, name, thumb?, license?, format, raw }
//   - source: copy of provider.id
//   - format: 'gltf' | 'glb' | 'fbx' | 'obj' | 'dae'  (loader picks based on this)
//   - raw: opaque payload passed back to provider.download
//
// All providers must be browser-safe (no Node-only APIs, no API keys hardcoded).
// If a provider needs a key, store/read from localStorage under `clag:keys:<id>`.

import * as khronos from './khronos.js';
import * as polyhaven from './polyhaven.js';
import * as sketchfab from './sketchfab.js';

export const providers = [khronos, polyhaven, sketchfab];
export const providerMap = Object.fromEntries(providers.map(p => [p.id, p]));

export async function searchAll(query, { signal, providerIds } = {}) {
  const list = providerIds && providerIds.length ? providerIds.map(id => providerMap[id]).filter(Boolean) : providers;
  const results = await Promise.allSettled(list.map(p => p.search(query, { signal })));
  const all = [];
  results.forEach((r, i) => {
    const prov = list[i];
    if (r.status === 'fulfilled') {
      for (const item of r.value) {
        item.source ||= prov.id;
        all.push(item);
      }
    } else {
      console.warn(`[${prov.id}] search failed`, r.reason);
    }
  });
  return all;
}
