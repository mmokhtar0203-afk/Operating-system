// Modal dialogs, confirmations, prompts, context menus and the image lightbox.
import { esc } from '../core/utils.js';
import { icon } from './icons.js';

const root = () => document.getElementById('modal-root');
const stack = [];

/**
 * openModal({ title, eyebrow, body, size, actions:[{label, kind, action:'id', left}], onMount(el, close), onAction(id, el, close) })
 * Returns { el, close }. onAction may return false to keep the modal open.
 */
export function openModal({ title = '', eyebrow = '', body = '', size = '', actions = [], onMount, onAction, onClose, dismissable = true } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <div class="grow">${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<div class="h3">${esc(title)}</div></div>
        <button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${actions.length ? `<div class="modal-foot">${actions.map((a) => `<button class="btn ${a.kind ? 'btn-' + a.kind : ''} ${a.left ? 'left' : ''}" data-act="${esc(a.action)}" ${a.type === 'submit' ? 'type="submit"' : 'type="button"'}>${a.icon ? icon(a.icon) : ''}${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
  root().appendChild(back);
  const el = back.querySelector('.modal');
  let closed = false;
  const prevFocus = document.activeElement;
  const close = (result) => {
    if (closed) return;
    closed = true;
    back.remove();
    stack.splice(stack.indexOf(entry), 1);
    if (onClose) onClose(result);
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
  };
  const entry = { close, dismissable };
  stack.push(entry);
  back.addEventListener('mousedown', (e) => { if (e.target === back && dismissable) close(); });
  el.querySelector('[data-close]').addEventListener('click', () => close());
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !el.contains(b)) return;
    e.preventDefault();
    const id = b.dataset.act;
    if (id === 'cancel') return close();
    if (onAction) {
      b.disabled = true;
      try {
        const r = await onAction(id, el, close);
        if (r !== false) close(id);
      } finally { b.disabled = false; }
    } else close(id);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') {
      const primary = el.querySelector('.modal-foot .btn-primary');
      if (primary) { e.preventDefault(); primary.click(); }
    }
  });
  if (onMount) onMount(el, close);
  setTimeout(() => {
    const first = el.querySelector('.modal-body [autofocus], .modal-body input:not([type=hidden]):not([type=checkbox]):not([type=file]), .modal-body select, .modal-body textarea');
    // never steal focus from a field the user (or autofill) is already in
    if (first && !el.contains(document.activeElement)) first.focus();
  }, 30);
  return { el, close };
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    const top = stack[stack.length - 1];
    if (top.dismissable) { e.preventDefault(); top.close(); }
  }
});

export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false, detail = '' } = {}) {
  return new Promise((resolve) => {
    openModal({
      title, size: 'sm',
      body: `<p>${message}</p>${detail ? `<div class="notice ${danger ? 'bad' : ''} mt-12">${icon('alert')}<div>${detail}</div></div>` : ''}`,
      actions: [{ label: 'Cancel', action: 'cancel' }, { label: confirmText, action: 'ok', kind: danger ? 'danger solid' : 'primary' }],
      onClose: (r) => resolve(r === 'ok'),
    });
  });
}

/** Simple single/multi-field prompt. fields: [{name,label,value,type,options,required,placeholder,hint}] */
export function promptDialog({ title, eyebrow = '', fields, confirmText = 'Save', size = 'sm', intro = '' }) {
  return new Promise((resolve) => {
    let result = null;
    const body = `${intro ? `<p class="muted">${intro}</p>` : ''}<form class="col gap-12" onsubmit="return false">${fields.map(fieldHtml).join('')}</form>`;
    openModal({
      title, eyebrow, size, body,
      actions: [{ label: 'Cancel', action: 'cancel' }, { label: confirmText, action: 'ok', kind: 'primary' }],
      onAction: (id, el) => {
        const values = readFields(el);
        const missing = fields.filter((f) => f.required && !String(values[f.name] ?? '').trim());
        el.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
        if (missing.length) { missing.forEach((f) => el.querySelector(`[name="${f.name}"]`)?.classList.add('invalid')); return false; }
        result = values;
      },
      onClose: () => resolve(result),
    });
  });
}

export function fieldHtml(f) {
  const v = f.value ?? '';
  const id = `f_${f.name}_${Math.random().toString(36).slice(2, 6)}`;
  let control;
  if (f.type === 'select') {
    control = `<select class="select" id="${id}" name="${esc(f.name)}">${(f.options || []).map((o) => {
      const [val, lab] = Array.isArray(o) ? o : typeof o === 'object' ? [o.value, o.label] : [o, o];
      return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
    }).join('')}</select>`;
  } else if (f.type === 'textarea') {
    control = `<textarea class="textarea" id="${id}" name="${esc(f.name)}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  } else if (f.type === 'checkbox') {
    return `<label class="check"><input type="checkbox" name="${esc(f.name)}" ${v ? 'checked' : ''}/> ${esc(f.label)}</label>`;
  } else {
    control = `<input class="input ${f.type === 'number' ? 'num' : ''}" id="${id}" name="${esc(f.name)}" type="${f.type === 'number' ? 'number' : f.type || 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.autofocus ? 'autofocus' : ''}/>`;
    if (f.addon) control = `<div class="input-group">${control}<span class="addon">${esc(f.addon)}</span></div>`;
  }
  return `<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>${control}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
}

export function readFields(el) {
  const out = {};
  el.querySelectorAll('[name]').forEach((i) => {
    if (i.type === 'checkbox') out[i.name] = i.checked;
    else if (i.type === 'file') return;
    else out[i.name] = i.value;
  });
  return out;
}

/* ---------- Context menu ---------- */
let openMenuEl = null;
export function closeMenu() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; } }
/** items: [{label, icon, danger, onClick} | '-' ] */
export function showMenu(anchor, items) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon) : ''}${esc(it.label)}</button>`)).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = Math.min(r.right - mw, window.innerWidth - mw - 8);
  if (left < 8) left = 8;
  let top = r.bottom + 4;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  m.style.left = left + 'px';
  m.style.top = top + 'px';
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const it = items[+b.dataset.i];
    closeMenu();
    it.onClick && it.onClick();
  });
  openMenuEl = m;
  setTimeout(() => document.addEventListener('mousedown', function h(e) { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener('mousedown', h); } }), 0);
}
window.addEventListener('hashchange', closeMenu);
window.addEventListener('resize', closeMenu);

/* ---------- Lightbox ---------- */
export function lightbox(src, caption = '') {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<button class="btn btn-icon close" aria-label="Close">${icon('x')}</button><img src="${esc(src)}" alt="${esc(caption)}"/><div class="cap">${esc(caption)}</div>`;
  const close = () => { lb.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.close')) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(lb);
}
