let stack;

export function initToast(el) { stack = el; }

// opts.action: { label, onClick } — botao opcional no lado direito do toast.
// Click executa onClick e dismiss. Estilizado custom (sem nativo).
export function toast(message, { kind = 'info', timeout = 2600, action = null } = {}) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  const line = document.createElement('div');
  line.className = 'toast-line';
  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  line.appendChild(text);
  if (action && typeof action.onClick === 'function') {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label || 'OK';
    btn.addEventListener('click', () => {
      try { action.onClick(); } finally { fade(t); }
    });
    line.appendChild(btn);
  }
  t.appendChild(line);
  stack.appendChild(t);
  if (timeout > 0) setTimeout(() => fade(t), timeout);
  return {
    el: t,
    update(msg) { text.textContent = msg; },
    setProgress(frac) {
      let bar = t.querySelector('.progress-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'progress-bar';
        const inner = document.createElement('div');
        bar.appendChild(inner);
        t.appendChild(bar);
      }
      bar.firstElementChild.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    },
    setKind(k) { t.className = `toast ${k}`; },
    dismiss() { fade(t); },
  };
}

function fade(t) {
  if (!t.parentNode) return;
  t.style.transition = 'opacity .2s, transform .2s';
  t.style.opacity = '0';
  t.style.transform = 'translateX(20px)';
  setTimeout(() => t.parentNode?.removeChild(t), 220);
}
