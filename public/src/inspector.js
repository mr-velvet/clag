import * as THREE from 'three';
import { on, getSelected, notifySceneChanged } from './scene.js';

let root;

export function initInspector(el) {
  root = el;
  render();
  on('selectionChanged', render);
  // re-render on transform changes so vec3 inputs reflect gizmo drag in real time
  on('sceneChanged', () => {
    // throttle to avoid spamming during drag
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => { renderPending = false; render(); });
  });
}

let renderPending = false;

function render() {
  if (!root) return;
  const obj = getSelected();
  if (!obj) {
    root.innerHTML = `<div class="empty">nenhum objeto selecionado</div>`;
    return;
  }
  root.innerHTML = '';

  // -- identity section
  const idSec = section('identity');
  const nameRow = row('name');
  const nameIn = document.createElement('input');
  nameIn.type = 'text';
  nameIn.className = 'insp-name-input';
  nameIn.value = obj.name || '';
  nameIn.addEventListener('input', () => { obj.name = nameIn.value; notifySceneChanged(); });
  nameRow.appendChild(nameIn);
  idSec.appendChild(nameRow);
  idSec.appendChild(plainRow('type', obj.userData.kind || obj.type || '—'));
  if (obj.userData.assetMeta) {
    const m = obj.userData.assetMeta;
    idSec.appendChild(plainRow('source', m.source || '—'));
    if (m.license) idSec.appendChild(plainRow('license', m.license));
    if (m.url) idSec.appendChild(linkRow('view', m.url, m.url));
  }
  root.appendChild(idSec);

  // -- transform section
  const tSec = section('posição');
  // toggle "posicionamento livre" — desliga snap so neste objeto (Fase 2 Sims-mode)
  tSec.appendChild(freeTransformToggle(obj));
  tSec.appendChild(vec3Row('posição', obj.position, 0.01, () => notifySceneChanged()));
  tSec.appendChild(vec3RowEuler('rotação', obj.rotation, () => notifySceneChanged()));
  tSec.appendChild(vec3Row('escala', obj.scale, 0.01, () => notifySceneChanged()));
  root.appendChild(tSec);

  // -- material section (if the object has at least one mesh with a material)
  const matInfo = firstMaterial(obj);
  if (matInfo) {
    const mSec = section('material');
    const mat = matInfo.material;
    if (mat.color) {
      const r = row('color');
      const wrap = document.createElement('div');
      wrap.className = 'insp-color-row';
      const c = document.createElement('input');
      c.type = 'color';
      c.value = '#' + mat.color.getHexString();
      c.addEventListener('input', () => {
        mat.color.set(c.value);
        for (const m of matInfo.materials) m.color?.set?.(c.value);
        notifySceneChanged();
      });
      const hex = document.createElement('span');
      hex.style.color = 'var(--text-2)';
      hex.style.fontFamily = 'ui-monospace, Menlo, monospace';
      hex.style.fontSize = '11px';
      hex.textContent = c.value.toUpperCase();
      c.addEventListener('input', () => hex.textContent = c.value.toUpperCase());
      wrap.append(c, hex);
      r.appendChild(wrap);
      mSec.appendChild(r);
    }
    if ('roughness' in mat) {
      mSec.appendChild(sliderRow('rough.', mat.roughness, 0, 1, 0.01, v => {
        for (const m of matInfo.materials) m.roughness = v;
        notifySceneChanged();
      }));
    }
    if ('metalness' in mat) {
      mSec.appendChild(sliderRow('metal.', mat.metalness, 0, 1, 0.01, v => {
        for (const m of matInfo.materials) m.metalness = v;
        notifySceneChanged();
      }));
    }
    if ('emissive' in mat && mat.emissive) {
      const r = row('emissive');
      const wrap = document.createElement('div');
      wrap.className = 'insp-color-row';
      const c = document.createElement('input');
      c.type = 'color';
      c.value = '#' + mat.emissive.getHexString();
      c.addEventListener('input', () => {
        for (const m of matInfo.materials) m.emissive?.set?.(c.value);
        notifySceneChanged();
      });
      wrap.append(c);
      r.appendChild(wrap);
      mSec.appendChild(r);
    }
    root.appendChild(mSec);
  }

  // -- light section
  const light = firstLight(obj);
  if (light) {
    const lSec = section('light');
    const r = row('color');
    const wrap = document.createElement('div');
    wrap.className = 'insp-color-row';
    const c = document.createElement('input');
    c.type = 'color';
    c.value = '#' + light.color.getHexString();
    c.addEventListener('input', () => { light.color.set(c.value); notifySceneChanged(); });
    wrap.append(c);
    r.appendChild(wrap);
    lSec.appendChild(r);
    if ('intensity' in light) {
      lSec.appendChild(sliderRow('intens.', light.intensity, 0, 30, 0.1, v => { light.intensity = v; notifySceneChanged(); }));
    }
    if ('distance' in light) {
      lSec.appendChild(sliderRow('dist.', light.distance, 0, 100, 0.1, v => { light.distance = v; notifySceneChanged(); }));
    }
    root.appendChild(lSec);
  }

  // -- info section
  const stats = gatherStats(obj);
  if (stats) {
    const iSec = section('info');
    iSec.appendChild(plainRow('verts', String(stats.verts)));
    iSec.appendChild(plainRow('tris', String(stats.tris)));
    iSec.appendChild(plainRow('meshes', String(stats.meshes)));
    root.appendChild(iSec);
  }
}

function section(title) {
  const s = document.createElement('div');
  s.className = 'insp-section';
  const t = document.createElement('div');
  t.className = 'insp-section-title';
  t.textContent = title;
  s.appendChild(t);
  return s;
}

function row(label) {
  const r = document.createElement('div');
  r.className = 'insp-row';
  const l = document.createElement('label');
  l.textContent = label;
  r.appendChild(l);
  return r;
}

function plainRow(label, value) {
  const r = row(label);
  const span = document.createElement('span');
  span.style.color = 'var(--text-2)';
  span.style.fontFamily = 'ui-monospace, Menlo, monospace';
  span.style.fontSize = '11px';
  span.textContent = value;
  span.style.overflow = 'hidden';
  span.style.textOverflow = 'ellipsis';
  r.appendChild(span);
  return r;
}

function linkRow(label, text, href) {
  const r = row(label);
  const a = document.createElement('a');
  a.href = href; a.target = '_blank'; a.rel = 'noopener';
  a.textContent = text;
  a.style.color = 'var(--accent)';
  a.style.fontSize = '11px';
  a.style.overflow = 'hidden';
  a.style.textOverflow = 'ellipsis';
  a.style.whiteSpace = 'nowrap';
  r.appendChild(a);
  return r;
}

// botao-toggle de "posicionamento livre" — quando ativo, snap nao mexe no obj.
function freeTransformToggle(obj) {
  const r = document.createElement('div');
  r.className = 'insp-row';
  r.style.gridTemplateColumns = '1fr';
  r.style.marginBottom = '8px';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'insp-free-toggle';
  btn.dataset.clagAction = 'toggle-free-transform';
  function sync() {
    const isFree = !!obj.userData.freeTransform;
    btn.classList.toggle('active', isFree);
    btn.innerHTML = `<span class="toggle-dot"></span>${isFree ? 'posicionamento livre (ignora encaixe)' : 'encaixar na grade'}`;
    btn.title = isFree
      ? 'snap desligado para este objeto — clique para encaixar'
      : 'snap aplicado a este objeto — clique para liberar';
  }
  btn.addEventListener('click', () => {
    obj.userData.freeTransform = !obj.userData.freeTransform;
    sync();
    notifySceneChanged();
  });
  sync();
  r.appendChild(btn);
  return r;
}

function vec3Row(label, vec, step, onChange) {
  const r = row(label);
  const grid = document.createElement('div');
  grid.className = 'vec3-row';
  ['x', 'y', 'z'].forEach(ax => {
    const cell = document.createElement('div');
    cell.className = 'vec3-axis';
    const span = document.createElement('span');
    span.className = `ax ${ax}`;
    span.textContent = ax.toUpperCase();
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = step;
    inp.value = round(vec[ax]);
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v)) { vec[ax] = v; onChange(); }
    });
    cell.append(span, inp);
    grid.appendChild(cell);
  });
  r.appendChild(grid);
  return r;
}

function vec3RowEuler(label, euler, onChange) {
  const r = row(label);
  const grid = document.createElement('div');
  grid.className = 'vec3-row';
  ['x', 'y', 'z'].forEach(ax => {
    const cell = document.createElement('div');
    cell.className = 'vec3-axis';
    const span = document.createElement('span');
    span.className = `ax ${ax}`;
    span.textContent = ax.toUpperCase();
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = 1;
    inp.value = round(THREE.MathUtils.radToDeg(euler[ax]));
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v)) { euler[ax] = THREE.MathUtils.degToRad(v); onChange(); }
    });
    cell.append(span, inp);
    grid.appendChild(cell);
  });
  r.appendChild(grid);
  return r;
}

function sliderRow(label, value, min, max, step, onChange) {
  const r = row(label);
  const wrap = document.createElement('div');
  wrap.className = 'insp-slider';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = min; range.max = max; range.step = step; range.value = value;
  const num = document.createElement('input');
  num.type = 'number';
  num.min = min; num.max = max; num.step = step; num.value = round(value);
  range.addEventListener('input', () => {
    num.value = round(parseFloat(range.value));
    onChange(parseFloat(range.value));
  });
  num.addEventListener('input', () => {
    range.value = num.value;
    onChange(parseFloat(num.value));
  });
  wrap.append(range, num);
  r.appendChild(wrap);
  return r;
}

function round(v) { return Math.round(v * 1000) / 1000; }

function firstMaterial(root) {
  const materials = [];
  let primary = null;
  root.traverse(o => {
    if (o.isMesh && o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        materials.push(m);
        if (!primary) primary = m;
      }
    }
  });
  return primary ? { material: primary, materials } : null;
}

function firstLight(root) {
  let found = null;
  root.traverse(o => { if (o.isLight && !found) found = o; });
  return found;
}

function gatherStats(root) {
  let verts = 0, tris = 0, meshes = 0;
  root.traverse(o => {
    if (o.isMesh && o.geometry) {
      meshes++;
      const g = o.geometry;
      const pos = g.attributes?.position;
      if (pos) verts += pos.count;
      if (g.index) tris += g.index.count / 3;
      else if (pos) tris += pos.count / 3;
    }
  });
  if (meshes === 0) return null;
  return { verts, tris: Math.floor(tris), meshes };
}
