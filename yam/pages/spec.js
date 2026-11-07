// Project specification detail: data snapshot, space applications, approval & revision control.
import { esc, fmtNum, fmtDate, fmtDateTime, round } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { codeTag, statusBadge, swatch, qtyText } from '../components/ui.js';
import { projectMeta } from '../components/project-ui.js';
import { confirmDialog, showMenu, openModal, fieldHtml } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { openSpecEditor } from '../components/spec-form.js';
import { assignSpecToSpaces, editApplication } from '../components/assign.js';
import { fileList, gallery, pickFiles, ACCEPT_DOCS } from '../components/files-ui.js';
import { db } from '../services/db.js';
import { SpecService, revLabel } from '../services/spec-service.js';
import { LibraryService, diffData } from '../services/library-service.js';
import { ProjectService } from '../services/project-service.js';
import { FileService } from '../services/file-service.js';
import { DISCIPLINES, ATTR_PROFILES } from '../data/models.js';
import { navigate } from '../core/router.js';

const ui = { img: 0 };

export function meta(ctx) {
  const s = SpecService.get(ctx.params.specId);
  if (!s) return { redirect: `/projects/${ctx.params.pid}/specs` };
  return projectMeta(ctx, 'Specifications', { href: '/specs', extra: [[s.code]] });
}

export function dataKv(d, discipline) {
  const attrDefs = ATTR_PROFILES[DISCIPLINES[discipline]?.profile] || [];
  const rows = [
    ['Manufacturer', d.manufacturer], ['Brand / collection', d.brand], ['Product reference', d.reference], ['Dimensions', d.dimensions],
    ['Colour', d.colour ? `${swatch(d.colourHex)} ${esc(d.colour)}` : '', true], ['Finish', d.finish],
    ...attrDefs.filter((a) => d.attrs && d.attrs[a.key] != null && d.attrs[a.key] !== '').map((a) => [a.label, `${d.attrs[a.key]}${a.unit ? ' ' + a.unit : ''}`]),
    ...(d.specs || []).map((s) => [s.k, s.v]),
    ['Default unit', d.unit], ['Unit price', d.unitPrice != null ? `${fmtNum(d.unitPrice)} ${d.currency || ''}` : ''],
  ].filter((r) => r[1] != null && r[1] !== '');
  return `<div class="kv">${rows.map(([k, v, raw]) => `<div class="k">${esc(k)}</div><div class="v ${/\n/.test(v) ? 'pre-wrap' : ''}">${raw ? v : esc(v)}</div>`).join('')}</div>`;
}

export function render(root, ctx) {
  const spec = SpecService.get(ctx.params.specId);
  const p = ProjectService.get(spec.projectId);
  const d = spec.data;
  const lib = spec.libraryId ? LibraryService.get(spec.libraryId) : null;
  const outdated = SpecService.libraryOutdated(spec);
  const apps = SpecService.applications({ specId: spec.id });
  const imgs = d.imageIds || [];
  if (ui.img >= imgs.length) ui.img = 0;
  const floors = Object.fromEntries(ProjectService.floors(p.id).map((f) => [f.id, f]));
  let amount = 0, hasAmount = false;

  const appRows = apps.map((a) => {
    const s = db.get('spaces', a.spaceId);
    const q = SpecService.effectiveQty(a);
    const rate = SpecService.unitPrice(a, spec);
    const amt = q != null && rate != null ? round(q * rate, 2) : null;
    if (amt != null) { amount += amt; hasAmount = true; }
    return `<tr>
      <td data-label="Space" class="no-label"><a href="#/projects/${p.id}/spaces/${s.id}"><b>${esc(s.code)}</b> ${esc(s.name)}</a><div class="sub">${esc(floors[s.floorId]?.name || '')}${a.location ? ' · ' + esc(a.location) : ''}</div></td>
      <td data-label="Quantity" class="num"><b>${fmtNum(q)}</b>${a.qtyMode === 'measure' ? `<div class="tiny muted">linked · ${esc((s.measure.items.find((x) => x.key === a.measureKey) || {}).label || a.measureKey)}${a.wastePct ? ' +' + a.wastePct + '%' : ''}</div>` : ''}</td>
      <td data-label="Unit">${esc(a.unit)}</td>
      <td data-label="Rate" class="num small">${rate != null ? fmtNum(rate) : '—'}</td>
      <td data-label="Amount" class="num small">${amt != null ? fmtNum(amt) : '—'}</td>
      <td data-label="Notes" class="small muted">${esc(a.notes || '')}</td>
      <td class="actions-cell"><button class="btn btn-ghost btn-xs" data-action="edit-app" data-id="${a.id}">${icon('edit')}Edit</button></td></tr>`;
  }).join('');

  const approvalsHtml = (list) => (list || []).length ? `<div class="timeline">${list.slice().reverse().map((a) => `
    <div class="tl-item"><div>${a.status === 'evidence' ? '<span class="badge plain">Evidence</span>' : statusBadge(a.status)}</div>
    <div><div class="small"><b>${esc(a.by)}</b> · ${fmtDateTime(a.at)} · ${revLabel(a.rev)}</div>${a.note ? `<div class="small mt-4">${esc(a.note)}</div>` : ''}
    ${(a.fileIds || []).length ? `<div class="mt-8">${fileList(a.fileIds)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="small muted">No status changes recorded for this revision.</div>';

  root.innerHTML = `
  <div class="page-head">
    <div class="titles">
      <div class="eyebrow">${esc(DISCIPLINES[spec.discipline]?.label)} · ${esc(p.name)}</div>
      <div class="row wrap gap-8 mt-8">${codeTag(spec.code)} ${lib ? `<a href="#/library/${lib.id}">${codeTag(spec.libraryCode, true)}</a>` : spec.libraryCode ? codeTag(spec.libraryCode, true) + ' <span class="tiny faint">(library item deleted)</span>' : '<span class="badge plain">Custom project item</span>'} ${statusBadge(spec.status)} <span class="mono small">${revLabel(spec.rev)}</span></div>
      <h1 class="h1 mt-8">${esc(d.name)}</h1>
    </div>
    <div class="actions">
      ${spec.status === 'draft' || spec.status === 'rejected' ? `<button class="btn" data-action="status" data-s="submitted">${icon('arrowRight')}Submit for approval</button>` : ''}
      ${spec.status !== 'approved' ? `<button class="btn" data-action="status" data-s="approved">${icon('check')}Approve</button>` : ''}
      ${spec.status === 'submitted' ? `<button class="btn btn-danger" data-action="status" data-s="rejected">${icon('x')}Reject</button>` : ''}
      <button class="btn btn-primary" data-action="edit">${icon('edit')}Edit specification</button>
      <button class="btn btn-icon" data-action="more" aria-label="More">${icon('more')}</button>
    </div>
  </div>

  ${outdated ? `<div class="notice warn mb-24">${icon('sync')}<div class="grow"><b>The library record ${esc(spec.libraryCode)} has changed</b> since this specification was created. The project specification has <u>not</u> been modified. Review the differences and decide whether to update it${spec.status === 'approved' ? ' (this will create a new revision requiring approval)' : ''}.</div><button class="btn btn-sm" data-action="review-lib">Review changes</button><button class="btn btn-ghost btn-sm" data-action="ack-lib">Keep current</button></div>` : ''}
  ${spec.status === 'approved' ? `<div class="notice info mb-24">${icon('check')}<div>Approved revision ${revLabel(spec.rev)}. Editing the data will archive this revision with its approval evidence and start ${revLabel(spec.rev + 1)} as a draft.</div></div>` : ''}

  <div class="detail">
    <div>
      <div class="media hero-media" ${imgs[ui.img] ? `data-action="file-open" data-id="${imgs[ui.img]}"` : ''}>${imgs[ui.img] ? `<img data-file="${esc(imgs[ui.img])}" data-thumb="full" alt=""/>` : icon('image')}</div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((id, i) => `<span class="thumb ${i === ui.img ? 'sel' : ''}" data-img="${i}"><img data-file="${esc(id)}" alt=""/></span>`).join('')}</div>` : ''}
      <div class="subhead"><div class="h4">Datasheets & drawings</div></div>
      ${fileList(d.datasheetIds || [], { emptyText: 'No datasheets. Use Edit to attach.' })}
    </div>
    <div>
      ${d.description ? `<p class="display" style="font-size:19px;line-height:1.45;color:var(--ink-2)">${esc(d.description)}</p>` : ''}
      ${dataKv(d, spec.discipline)}
      ${spec.discipline === 'joinery' && d.attrs ? '' : ''}
      ${(d.supplier && (d.supplier.name || d.supplier.contact)) ? `<div class="rule-title"><span class="eyebrow">Supplier</span></div><div class="kv">
        ${[['Supplier', d.supplier.name], ['Contact', d.supplier.contact], ['Phone', d.supplier.phone], ['Email', d.supplier.email], ['Website', d.supplier.website]].filter((r) => r[1]).map(([k, v]) => `<div class="k">${k}</div><div class="v">${esc(v)}</div>`).join('')}</div>` : ''}
      ${d.notes ? `<div class="rule-title"><span class="eyebrow">Notes</span></div><p class="pre-wrap small">${esc(d.notes)}</p>` : ''}
    </div>
  </div>

  <div class="rule-title"><span class="h3">Space applications</span><span class="tiny muted">${apps.length} · ${qtyText(SpecService.totals(spec.id))}</span></div>
  <div class="row mb-16"><button class="btn btn-sm" data-action="assign">${icon('plus')}Assign to spaces</button><span class="tiny muted">One specification, many spaces — quantities with different units are totalled separately.</span></div>
  ${apps.length ? `<div class="table-wrap"><table class="tbl stack">
    <thead><tr><th>Space</th><th class="num">Quantity</th><th>Unit</th><th class="num">Rate</th><th class="num">Amount</th><th>Notes</th><th></th></tr></thead>
    <tbody>${appRows}</tbody>
    <tfoot><tr><td>Project total</td><td colspan="2" class="num">${qtyText(SpecService.totals(spec.id))}</td><td></td><td class="num">${hasAmount ? fmtNum(amount) + ' ' + esc(d.currency || '') : '—'}</td><td colspan="2"></td></tr></tfoot>
  </table></div>` : '<div class="empty sm">Not assigned to any space yet.</div>'}

  <div class="grid g-2 mt-32" style="gap:32px">
    <div>
      <div class="panel-title"><h2 class="h3">Approval — ${revLabel(spec.rev)}</h2><button class="btn btn-sm" data-action="evidence">${icon('upload')}Attach evidence</button></div>
      ${approvalsHtml(spec.approvals)}
    </div>
    <div>
      <div class="panel-title"><h2 class="h3">Revision history</h2></div>
      <div class="timeline">
        <div class="tl-item"><div class="rev">${revLabel(spec.rev)}</div><div><div class="row gap-8">${statusBadge(spec.status)}<span class="tiny muted">Current revision</span></div></div></div>
        ${(spec.revisions || []).map((r) => `<div class="tl-item"><div class="rev">${esc(r.revLabel)}</div><div>
          <div class="row wrap gap-8">${statusBadge(r.status)}<span class="tiny muted">Superseded ${fmtDate(r.closedAt)} by ${esc(r.closedBy)}</span></div>
          ${r.reason ? `<div class="small mt-4">“${esc(r.reason)}”</div>` : ''}
          ${r.changes && r.changes.length ? `<div class="diff">${r.changes.slice(0, 8).map((c) => `<span class="muted">${esc(c.field)}</span><span><span class="old">${esc(String(c.from || '∅'))}</span> → <span class="new">${esc(String(c.to || '∅'))}</span></span>`).join('')}</div>` : ''}
          <div class="row gap-8 mt-8"><button class="btn btn-xs" data-action="view-rev" data-rev="${r.rev}">${icon('eye')}View ${esc(r.revLabel)}</button>${(r.approvals || []).length ? `<span class="tiny muted">${r.approvals.length} approval record(s) preserved</span>` : ''}</div>
        </div></div>`).join('')}
      </div>
      <div class="panel-title mt-32"><h2 class="h3">Activity</h2></div>
      <div class="timeline">${(spec.history || []).slice(0, 12).map((h) => `<div class="tl-item"><div class="mono tiny muted">${revLabel(h.rev)}</div><div class="small"><b>${esc(h.action)}</b>${h.note ? ` — ${esc(h.note)}` : ''}<div class="tiny muted">${esc(h.by)} · ${fmtDateTime(h.at)}</div></div></div>`).join('')}</div>
    </div>
  </div>`;

  root.addEventListener('click', async (e) => {
    const im = e.target.closest('[data-img]');
    if (im) { ui.img = +im.dataset.img; ctx.rerender(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'edit') {
      openSpecEditor({
        mode: 'spec', title: `Edit ${spec.code}`, eyebrow: DISCIPLINES[spec.discipline].label, data: spec.data, discipline: spec.discipline, code: spec.code, status: spec.status, projectId: p.id, existing: true,
        onSave({ data, discipline, code, reason }) {
          const meta = {};
          if (code && code !== spec.code) {
            if (SpecService.byCode(code)) { toast(`Code ${code} is already used.`, { error: true }); return false; }
            meta.code = code;
          }
          if (discipline && discipline !== spec.discipline) meta.discipline = discipline;
          const r = SpecService.updateData(spec.id, data, { reason, meta });
          toast(r.revised ? `Saved as ${revLabel(r.spec.rev)} — re-approval required` : 'Specification saved');
        },
      });
    }
    if (act === 'status') approvalDialog(spec, a.dataset.s);
    if (act === 'evidence') {
      const files = await pickFiles({ accept: ACCEPT_DOCS });
      if (!files.length) return;
      const metas = [];
      for (const f of files) metas.push(await FileService.add(f, { kind: 'approval', projectId: p.id }));
      SpecService.addEvidence(spec.id, metas.map((m) => m.id));
      toast('Evidence attached');
    }
    if (act === 'assign') assignSpecToSpaces(spec.id);
    if (act === 'edit-app') editApplication(a.dataset.id);
    if (act === 'ack-lib') { SpecService.acknowledgeLibrary(spec.id); toast('Kept current specification data'); }
    if (act === 'review-lib') reviewLibrary(spec);
    if (act === 'view-rev') viewRevision(spec, +a.dataset.rev);
    if (act === 'more') {
      showMenu(a, [
        { label: 'Duplicate specification', icon: 'copy', onClick: () => { const c = SpecService.duplicate(spec.id); toast(`Duplicated as ${c.code}`); navigate(`/projects/${p.id}/specs/${c.id}`); } },
        ...(lib ? [{ label: `Open library item ${lib.code}`, icon: 'library', onClick: () => navigate(`/library/${lib.id}`) }] : []),
        '-',
        { label: 'Delete specification…', icon: 'trash', danger: true, onClick: async () => {
          if (await confirmDialog({ title: 'Delete specification?', danger: true, confirmText: 'Delete', message: `Delete <b>${esc(spec.code)} ${esc(d.name)}</b>?`, detail: `It is removed from ${apps.length} space(s) and from all schedules. Revision history is lost.` })) {
            SpecService.remove(spec.id); toast('Specification deleted'); navigate(`/projects/${p.id}/specs`);
          }
        } },
      ]);
    }
  });
}

function approvalDialog(spec, status) {
  const label = { submitted: 'Submit for approval', approved: 'Approve specification', rejected: 'Reject specification' }[status];
  let files = [];
  openModal({
    title: label, eyebrow: `${spec.code} · ${revLabel(spec.rev)}`,
    body: `${fieldHtml({ name: 'note', label: status === 'rejected' ? 'Reason for rejection' : 'Note', type: 'textarea', value: '', placeholder: status === 'approved' ? 'e.g. Approved by client at design review, sample signed.' : '' })}
      ${status !== 'submitted' ? `<div class="field mt-12"><label>Approval evidence (optional)</label><div class="row"><button type="button" class="btn btn-sm" data-pick>${icon('upload')}Attach files</button><span class="tiny muted" data-names></span></div><div class="hint">Signed sample board, email, meeting minutes…</div></div>` : ''}`,
    actions: [{ label: 'Cancel', action: 'cancel' }, { label, action: 'ok', kind: status === 'rejected' ? 'danger solid' : 'primary' }],
    onMount(el) {
      el.querySelector('[data-pick]')?.addEventListener('click', async () => {
        files = await pickFiles({ accept: ACCEPT_DOCS });
        el.querySelector('[data-names]').textContent = files.map((f) => f.name).join(', ');
      });
    },
    async onAction(id, el) {
      const note = el.querySelector('[name=note]').value.trim();
      if (status === 'rejected' && !note) { el.querySelector('[name=note]').classList.add('invalid'); return false; }
      const ids = [];
      for (const f of files) ids.push((await FileService.add(f, { kind: 'approval', projectId: spec.projectId })).id);
      SpecService.setStatus(spec.id, status, { note, fileIds: ids });
      toast(`${spec.code} ${status}`);
    },
  });
}

function reviewLibrary(spec) {
  const lib = LibraryService.get(spec.libraryId);
  const next = { ...lib.data, unit: spec.data.unit, unitPrice: spec.data.unitPrice, currency: spec.data.currency, notes: spec.data.notes };
  const changes = diffData(spec.data, next);
  openModal({
    title: `Library changes — ${lib.code}`, eyebrow: spec.code, size: 'lg',
    body: `<p class="small muted">Differences between this project specification and the current library record. Project-only fields (unit, price, notes) are kept.</p>
      <div class="table-wrap"><table class="tbl compact"><thead><tr><th>Field</th><th>Project (current)</th><th>Library (new)</th></tr></thead><tbody>
      ${changes.map((c) => `<tr><td class="small muted">${esc(c.field)}</td><td class="small"><span class="diff"><span class="old" style="grid-column:auto">${esc(String(c.from || '∅'))}</span></span></td><td class="small" style="color:var(--ok)">${esc(String(c.to || '∅'))}</td></tr>`).join('')}
      </tbody></table></div>
      ${spec.status === 'approved' ? `<div class="notice warn mt-16">${icon('history')}<div>This specification is approved. Updating will archive ${revLabel(spec.rev)} and create ${revLabel(spec.rev + 1)} requiring approval.</div></div>` : ''}`,
    actions: [{ label: 'Keep current', action: 'keep', left: true }, { label: 'Cancel', action: 'cancel' }, { label: 'Update specification', action: 'ok', kind: 'primary' }],
    onAction(id) {
      if (id === 'keep') { SpecService.acknowledgeLibrary(spec.id); return; }
      const r = SpecService.syncFromLibrary(spec.id);
      toast(r && r.revised ? `Updated — new revision ${revLabel(r.spec.rev)}` : 'Specification updated from library');
    },
  });
}

function viewRevision(spec, rev) {
  const r = (spec.revisions || []).find((x) => x.rev === rev);
  if (!r) return;
  openModal({
    title: `${spec.code} — ${r.revLabel}`, eyebrow: `Superseded ${fmtDateTime(r.closedAt)}`, size: 'lg',
    body: `<div class="row gap-8 mb-16">${statusBadge(r.status)}<span class="small muted">Closed by ${esc(r.closedBy)}${r.reason ? ' — ' + esc(r.reason) : ''}</span></div>
      <div class="detail" style="gap:24px"><div>${(r.data.imageIds || []).length ? gallery(r.data.imageIds, { captions: false }) : ''}</div>
      <div><div class="h3 mb-8">${esc(r.data.name)}</div>${dataKv(r.data, spec.discipline)}</div></div>
      <div class="rule-title"><span class="eyebrow">Approval evidence preserved with ${esc(r.revLabel)}</span></div>
      ${(r.approvals || []).length ? r.approvals.map((a) => `<div class="small mb-8">${a.status === 'evidence' ? '<span class="badge plain">Evidence</span>' : statusBadge(a.status)} <b>${esc(a.by)}</b> · ${fmtDateTime(a.at)} ${a.note ? '— ' + esc(a.note) : ''}${(a.fileIds || []).length ? `<div class="mt-8">${fileList(a.fileIds)}</div>` : ''}</div>`).join('') : '<div class="small muted">No approval records.</div>'}`,
    actions: [{ label: 'Close', action: 'cancel' }],
    onMount: (el) => FileService.hydrate(el),
  });
}
