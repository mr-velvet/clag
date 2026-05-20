// KhronosGroup glTF Sample Assets — small curated catalog hardcoded for guaranteed availability.
// These ship at https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/<Name>/glTF-Binary/<Name>.glb
// Source: https://github.com/KhronosGroup/glTF-Sample-Assets — all redistributable, mostly CC0 / CC-BY.

export const id = 'khronos';
export const label = 'Khronos Samples';
export const description = 'Curated CC0/CC-BY glTF samples hosted by Khronos.';
export const needsKey = false;

// curated subset that all have glTF-Binary builds + thumbnail in screenshot/
const CATALOG = [
  { slug: 'DamagedHelmet', label: 'Damaged Helmet', tags: ['helmet','scifi','damaged','pbr'], license: 'CC-BY 4.0' },
  { slug: 'FlightHelmet', label: 'Flight Helmet', tags: ['helmet','aviator','pbr'], license: 'CC-BY 4.0' },
  { slug: 'Avocado', label: 'Avocado', tags: ['fruit','food','avocado'], license: 'CC0' },
  { slug: 'BarramundiFish', label: 'Barramundi Fish', tags: ['fish','animal'], license: 'CC-BY 4.0' },
  { slug: 'BoomBox', label: 'BoomBox', tags: ['radio','boombox','electronics'], license: 'CC0' },
  { slug: 'Corset', label: 'Corset', tags: ['clothing','garment'], license: 'CC0' },
  { slug: 'Duck', label: 'Duck', tags: ['duck','toy','rubber','animal'], license: 'SCEA' },
  { slug: 'Lantern', label: 'Lantern', tags: ['lantern','light','prop'], license: 'CC0' },
  { slug: 'WaterBottle', label: 'Water Bottle', tags: ['bottle','prop'], license: 'CC0' },
  { slug: 'Suzanne', label: 'Suzanne (Blender monkey)', tags: ['suzanne','blender','monkey','head'], license: 'CC0' },
  { slug: 'Box', label: 'Box', tags: ['box','cube'], license: 'CC0' },
  { slug: 'BoxTextured', label: 'Box Textured', tags: ['box','cube','textured'], license: 'CC0' },
  { slug: 'Sponza', label: 'Sponza (atrium)', tags: ['sponza','atrium','building','scene'], license: 'CC-BY 4.0' },
  { slug: 'Buggy', label: 'Buggy', tags: ['buggy','vehicle','car'], license: 'SCEA' },
  { slug: 'CesiumMilkTruck', label: 'Milk Truck', tags: ['truck','vehicle','car','cesium'], license: 'CC-BY 4.0' },
  { slug: 'GearboxAssy', label: 'Gearbox Assembly', tags: ['gearbox','mechanical','engine'], license: 'CC-BY-SA' },
  { slug: 'AntiqueCamera', label: 'Antique Camera', tags: ['camera','antique','vintage'], license: 'CC-BY 4.0' },
  { slug: 'IridescenceLamp', label: 'Iridescence Lamp', tags: ['lamp','light','iridescence'], license: 'CC-BY 4.0' },
  { slug: 'Fox', label: 'Fox', tags: ['fox','animal','character','animated'], license: 'CC0' },
  { slug: 'CesiumMan', label: 'Cesium Man', tags: ['man','character','animated','human'], license: 'CC-BY 4.0' },
  { slug: 'RiggedFigure', label: 'Rigged Figure', tags: ['figure','character','rigged','human'], license: 'CC-BY 4.0' },
  { slug: 'BrainStem', label: 'BrainStem', tags: ['robot','character','animated'], license: 'CC-BY 4.0' },
  { slug: 'GlamVelvetSofa', label: 'Glam Velvet Sofa', tags: ['sofa','couch','furniture','velvet'], license: 'CC-BY 4.0' },
  { slug: 'ToyCar', label: 'Toy Car', tags: ['car','toy','vehicle'], license: 'CC-BY 4.0' },
  { slug: 'MosquitoInAmber', label: 'Mosquito in Amber', tags: ['mosquito','insect','amber'], license: 'CC0' },
];

const RAW_BASE = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';

function thumbUrl(slug) {
  return `${RAW_BASE}/${slug}/screenshot/screenshot.jpg`;
}
function modelUrl(slug) {
  return `${RAW_BASE}/${slug}/glTF-Binary/${slug}.glb`;
}

export async function search(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return CATALOG.map(toResult);
  return CATALOG.filter(c => {
    if (c.slug.toLowerCase().includes(q)) return true;
    if (c.label.toLowerCase().includes(q)) return true;
    return c.tags.some(t => t.includes(q));
  }).map(toResult);
}

function toResult(c) {
  return {
    id: `khronos:${c.slug}`,
    source: 'khronos',
    name: c.label,
    thumb: thumbUrl(c.slug),
    license: c.license,
    format: 'glb',
    raw: { slug: c.slug, url: modelUrl(c.slug) },
  };
}

export async function download(item, { onProgress, signal } = {}) {
  const url = item.raw.url;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`khronos: HTTP ${r.status} for ${url}`);
  // stream + progress if Content-Length is present
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
  return { url: URL.createObjectURL(blob), blob, contentType: 'model/gltf-binary', ext: 'glb' };
}
