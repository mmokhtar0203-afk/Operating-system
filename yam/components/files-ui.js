// File pickers, galleries and file lists.
import { esc, fmtBytes, fmtDate } from '../core/utils.js';
import { icon } from './icons.js';
import { FileService, isImage, extOf } from '../services/file-service.js';
import { FILE_KINDS } from '../data/models.js';

export function pickFiles({ accept = '', multiple = true } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.multiple = multiple;
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => { resolve(Array.from(inp.files || [])); inp.remove(); });
    // Some browsers never fire change on cancel; that's fine — the promise just stays pending.
    inp.click();
  });
}

export const ACCEPT_IMAGES = 'image/*';
export const ACCEPT_DOCS = 'image/*,application/pdf,.pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.txt,.csv';

/** Image gallery. opts.addAction: data-action for the add tile; opts.removeAction for delete buttons. */
export function gallery(ids, { addAction = '', removeAction = '', addLabel = 'Add image', ctx = '', captions = true } = {}) {
  const items = (ids || []).map((id) => {
    const m = FileService.get(id);
    if (!m) return '';
    return `<div class="item">
      <div class="media" data-action="file-open" data-id="${esc(id)}">${isImage(m) ? `<img data-file="${esc(id)}" alt="${esc(m.name)}"/>` : `<span class="mono">${esc(extOf(m))}</span>`}</div>
      ${captions ? `<div class="meta"><span class="name" title="${esc(m.name)}">${esc(m.name)}</span></div>` : ''}
      ${removeAction ? `<button class="btn btn-xs btn-icon del" data-action="${esc(removeAction)}" data-id="${esc(id)}" data-ctx="${esc(ctx)}" title="Remove">${icon('x')}</button>` : ''}
    </div>`;
  }).join('');
  const add = addAction ? `<button class="add" data-action="${esc(addAction)}" data-ctx="${esc(ctx)}">${icon('upload')}<span>${esc(addLabel)}</span></button>` : '';
  return `<div class="gallery">${items}${add}</div>`;
}

export function fileIcon(m) {
  return `<span class="ico">${isImage(m) ? `<img data-file="${esc(m.id)}" alt=""/>` : esc(extOf(m))}</span>`;
}

export function fileList(ids, { removeAction = '', ctx = '', emptyText = 'No files attached.', showKind = false } = {}) {
  const metas = (ids || []).map((id) => FileService.get(id)).filter(Boolean);
  if (!metas.length) return `<div class="empty sm">${esc(emptyText)}</div>`;
  return `<div class="file-list">${metas.map((m) => `
    <div class="file-row">
      ${fileIcon(m)}
      <div class="grow"><a href="javascript:void 0" data-action="file-open" data-id="${esc(m.id)}" class="strong truncate" style="display:block">${esc(m.name)}</a>
      <div class="tiny muted">${showKind ? esc(FILE_KINDS[m.kind] || m.kind) + ' · ' : ''}${fmtBytes(m.size)} · ${fmtDate(m.createdAt)}</div></div>
      <button class="btn btn-ghost btn-xs btn-icon" data-action="file-download" data-id="${esc(m.id)}" title="Download">${icon('download')}</button>
      ${removeAction ? `<button class="btn btn-ghost btn-xs btn-icon" data-action="${esc(removeAction)}" data-id="${esc(m.id)}" data-ctx="${esc(ctx)}" title="Remove">${icon('x')}</button>` : ''}
    </div>`).join('')}</div>`;
}

/** Global click handling for file open/download inside any container. */
export function bindFileActions(root) {
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action="file-open"], [data-action="file-download"]');
    if (!t || !root.contains(t)) return;
    e.preventDefault();
    if (t.dataset.action === 'file-open') FileService.open(t.dataset.id);
    else FileService.download(t.dataset.id);
  });
}

export function bindDropzone(el, onFiles) {
  if (!el) return;
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('over');
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onFiles(files);
  });
}
