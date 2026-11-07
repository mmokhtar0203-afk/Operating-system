import { esc } from '../core/utils.js';

/** toast('Saved'), toast('Failed', {error:true}), toast('Deleted', {action:{label:'Undo', onClick}}) */
export function toast(message, { error = false, ms = 3200, action = null } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = document.createElement('div');
  t.className = 'toast' + (error ? ' error' : '');
  t.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="t-action">${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('.t-action').addEventListener('click', () => { action.onClick(); t.remove(); });
  root.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .25s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 260); }, error ? ms * 1.6 : ms);
}
