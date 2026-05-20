let stack;

export function initToast(el) { stack = el; }

export function toast(message, { kind = 'info', timeout = 2600 } = {}) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  const line = document.createElement('div');
  line.className = 'toast-line';
  line.textContent = message;
  t.appendChild(line);
  stack.appendChild(t);
  if (timeout > 0) setTimeout(() => fade(t), timeout);
  return {
    el: t,
    update(msg) { line.textContent = msg; },
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
