// Library record detail: images, technical data, supplier, usage across projects, change log.
import { esc, fmtDateTime } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { codeTag, statusBadge } from '../components/ui.js';
import { confirmDialog, showMenu } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { openSpecEditor } from '../components/spec-form.js';
import { fileList } from '../components/files-ui.js';
import { LibraryService } from '../services/library-service.js';
import { SpecService } from '../services/spec-service.js';
import { LIB_CAT_MAP } from '../data/models.js';
import { navigate } from '../core/router.js';
import { dataKv } from './spec.js';

const ui = { img: 0 };

export function meta(ctx) {
  const l = LibraryService.get(ctx.params.id);
  if (!l) return { redirect: '/library' };
  return { title: `${l.code} ${l.data.name}`, crumbs: [['Library', '/library'], [LIB_CAT_MAP[l.category]?.label || '', `/library?cat=${l.category}`], [l.code]] };
}

export function render(root, ctx) {
  const l = LibraryService.get(ctx.params.id);
  const d = l.data;
  const cat = LIB_CAT_MAP[l.category] || {};
  const usage = LibraryService.usage(l.id);
  const imgs = d.imageIds || [];
  if (ui.img >= imgs.length) ui.img = 0;

  root.innerHTML = `
  <div class="page-head">
    <div class="titles">
      <div class="eyebrow">${esc(cat.label || '')} · ${cat.kind === 'product' ? 'Product' : 'Material'}</div>
      <div class="row gap-8 mt-8">${codeTag(l.code, true)} ${l.archived ? statusBadge('archived') : ''}</div>
      <h1 class="h1 mt-8">${esc(d.name)}</h1>
    </div>
    <div class="actions">
      <button class="btn btn-primary" data-action="edit">${icon('edit')}Edit</button>
      <button class="btn" data-action="duplicate">${icon('copy')}Duplicate</button>
      <button class="btn btn-icon" data-action="more" aria-label="More">${icon('more')}</button>
    </div>
  </div>
  ${l.archived ? `<div class="notice mb-24">${icon('archive')}<div>This record is archived. It is hidden from pickers but existing project specifications keep their data.</div></div>` : ''}
  <div class="detail">
    <div>
      <div class="media hero-media" ${imgs[ui.img] ? `data-action="file-open" data-id="${imgs[ui.img]}"` : ''}>${imgs[ui.img] ? `<img data-file="${esc(imgs[ui.img])}" data-thumb="full" alt=""/>` : icon('image')}</div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((id, i) => `<span class="thumb ${i === ui.img ? 'sel' : ''}" data-img="${i}"><img data-file="${esc(id)}" alt=""/></span>`).join('')}</div>` : ''}
      <div class="subhead"><div class="h4">Datasheets</div></div>
      ${fileList(d.datasheetIds || [], { emptyText: 'No datasheets attached.' })}
    </div>
    <div>
      ${d.description ? `<p class="display" style="font-size:19px;line-height:1.45;color:var(--ink-2)">${esc(d.description)}</p>` : ''}
      ${dataKv(d, cat.discipline)}
      ${(d.supplier && (d.supplier.name || d.supplier.contact)) ? `<div class="rule-title"><span class="eyebrow">Supplier</span></div><div class="kv">${[['Supplier', d.supplier.name], ['Contact', d.supplier.contact], ['Phone', d.supplier.phone], ['Email', d.supplier.email], ['Website', d.supplier.website]].filter((r) => r[1]).map(([k, v]) => `<div class="k">${k}</div><div class="v">${esc(v)}</div>`).join('')}</div>` : ''}
      ${d.notes ? `<div class="rule-title"><span class="eyebrow">Notes</span></div><p class="small pre-wrap">${esc(d.notes)}</p>` : ''}
    </div>
  </div>

  <div class="rule-title"><span class="h3">Where it is used</span><span class="tiny muted">${usage.length} project specification(s)</span></div>
  ${usage.length ? `<div class="table-wrap"><table class="tbl stack"><thead><tr><th>Project</th><th>Project code</th><th>Status</th><th>Spaces</th><th>Snapshot</th></tr></thead><tbody>
    ${usage.map((u) => `<tr><td data-label="Project"><a href="#/projects/${u.project.id}">${esc(u.project.name)}</a></td>
      <td data-label="Project code"><a href="#/projects/${u.project.id}/specs/${u.spec.id}">${codeTag(u.spec.code)}</a></td>
      <td data-label="Status">${statusBadge(u.spec.status)}</td>
      <td data-label="Spaces" class="small">${u.spaces.length ? [...new Map(u.spaces.map((s) => [s.id, s])).values()].map((s) => `<a href="#/projects/${u.project.id}/spaces/${s.id}">${esc(s.name)}</a>`).join(', ') : '<span class="faint">Not assigned</span>'}</td>
      <td data-label="Snapshot" class="small">${SpecService.libraryOutdated(u.spec) ? '<span class="badge warn">Differs from library</span>' : '<span class="badge approved">In sync</span>'}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="tiny muted mt-8">Editing this record never changes existing project specifications silently — each project is notified and decides whether to update (creating a revision if approved).</p>` : '<div class="empty sm">Not used in any project yet.</div>'}

  <div class="rule-title"><span class="h3">Change log</span></div>
  ${(l.changeLog || []).length ? `<div class="timeline">${l.changeLog.map((c) => `<div class="tl-item"><div class="tiny muted">${fmtDateTime(c.at).split(',')[0]}</div><div class="small"><b>${esc(c.by)}</b> changed ${c.changes.length} field(s)<div class="diff">${c.changes.slice(0, 6).map((x) => `<span class="muted">${esc(x.field)}</span><span><span class="old">${esc(String(x.from || '∅'))}</span> → <span class="new">${esc(String(x.to || '∅'))}</span></span>`).join('')}</div></div></div>`).join('')}</div>` : '<div class="small muted">No changes since creation.</div>'}`;

  root.addEventListener('click', (e) => {
    const im = e.target.closest('[data-img]');
    if (im) { ui.img = +im.dataset.img; ctx.rerender(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'edit') {
      openSpecEditor({
        mode: 'library', title: `Edit ${l.code}`, data: l.data, category: l.category, code: l.code,
        onSave({ data, category }) {
          LibraryService.update(l.id, data, { category });
          const n = LibraryService.usage(l.id).filter((u) => SpecService.libraryOutdated(SpecService.get(u.spec.id))).length;
          toast(n ? `Saved. ${n} project specification(s) were flagged for review — not changed.` : 'Library record saved');
        },
      });
    }
    if (act === 'duplicate') { const c = LibraryService.duplicate(l.id); toast(`Duplicated as ${c.code}`); navigate(`/library/${c.id}`); }
    if (act === 'more') {
      showMenu(a, [
        l.archived ? { label: 'Restore from archive', icon: 'restore', onClick: () => { LibraryService.archive(l.id, false); toast('Restored'); } }
          : { label: 'Archive record', icon: 'archive', onClick: () => { LibraryService.archive(l.id, true); toast('Archived'); } },
        '-',
        { label: 'Delete permanently…', icon: 'trash', danger: true, onClick: async () => {
          const ok = await confirmDialog({ title: 'Delete library record?', danger: true, confirmText: 'Delete', message: `Delete <b>${esc(l.code)} ${esc(d.name)}</b>?`, detail: usage.length ? `${usage.length} project specification(s) reference it. They keep their own copy of the data but lose the link. Consider archiving instead.` : 'Not used in any project.' });
          if (ok) { LibraryService.remove(l.id); toast('Record deleted'); navigate('/library'); }
        } },
      ]);
    }
  });
}
