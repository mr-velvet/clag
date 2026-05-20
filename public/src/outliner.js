import { on, getSelected, setSelected, getUserObjects } from './scene.js';

let root;

export function initOutliner(el) {
  root = el;
  render();
  on('sceneChanged', render);
  on('selectionChanged', render);
}

function render() {
  if (!root) return;
  const sel = getSelected();
  root.innerHTML = '';
  const items = getUserObjects();
  if (items.length === 0) {
    root.innerHTML = `<div style="padding:14px;color:var(--text-2);font-style:italic;text-align:center">empty scene</div>`;
    return;
  }
  for (const obj of items) {
    const row = document.createElement('div');
    row.className = 'outliner-item' + (obj === sel ? ' selected' : '');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = obj.name || obj.userData.sceneId || '(unnamed)';
    name.title = name.textContent;
    const kind = obj.userData.kind || (obj.isLight ? 'light' : 'mesh');
    const badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.textContent = kind.split(':')[0];
    row.append(name, badge);
    row.addEventListener('click', () => setSelected(obj));
    root.appendChild(row);
  }
}
