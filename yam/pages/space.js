// Space documentation workspace — the heart of YAM.
import { esc, fmtNum, toNum, fmtDateTime } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { progress, codeTag, statusBadge, thumb, swatch, qtyText } from '../components/ui.js';
import { projectMeta } from '../components/project-ui.js';
import { confirmDialog, promptDialog, showMenu, openModal, fieldHtml, readFields } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { gallery, fileList, pickFiles, ACCEPT_IMAGES, ACCEPT_DOCS, bindDropzone } from '../components/files-ui.js';
import { addItemToSpace, editApplication } from '../components/assign.js';
import { ProjectService } from '../services/project-service.js';
import { TemplateService } from '../services/template-service.js';
import { SpecService } from '../services/spec-service.js';
import { FileService, isImage } from '../services/file-service.js';
import { MeasurementService, resolveMeasures, validateFormula, openingsTotals } from '../services/measurement-service.js';
import { spaceCompleteness } from '../services/completeness-service.js';
import { SECTION_MAP, DISCIPLINES, MEASURE_SOURCES, OPENING_TYPES, UNITS, FILE_KINDS, MEASURE_DEFS } from '../data/models.js';
import { navigate, setQuery } from '../core/router.js';
import { bus } from '../core/events.js';
import { addSpaceDialog } from './project-spaces.js';

const ui = { showHidden: false, scrolledFor: null };

export function meta(ctx) {
  const s = ProjectService.space(ctx.params.sid);
  if (!s) return { redirect: `/projects/${ctx.params.pid}/spaces` };
  return projectMeta(ctx, 'Spaces', { href: '/spaces', extra: [[s.name]] });
}

/* ---------- field rendering ---------- */
function fieldInput(sec, f, value) {
  const fk = `f:${sec.key}:${f.key}`;
  const common = `data-field="${esc(sec.key)}|${esc(f.key)}" data-fk="${esc(fk)}"`;
  let control;
  if (f.type === 'select') control = `<select class="select" ${common}><option value=""></option>${(f.options || []).map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}${value && !(f.options || []).includes(value) ? `<option selected>${esc(value)}</option>` : ''}</select>`;
  else if (f.type === 'textarea') control = `<textarea class="textarea" rows="2" ${common}>${esc(value || '')}</textarea>`;
  else control = `<input class="input ${f.type === 'number' ? 'num' : ''}" ${f.type === 'number' ? 'type="number" step="any"' : ''} value="${esc(value ?? '')}" ${common}/>`;
  return `<div class="field ${f.wide || f.type === 'textarea' ? 'wide' : ''}"><label class="row between"><span>${esc(f.label)}</span>${f.custom ? `<button class="link-btn tiny" data-action="rm-field" data-sec="${esc(sec.key)}" data-key="${esc(f.key)}" title="Remove custom field">remove</button>` : ''}</label>${control}</div>`;
}
function fieldsBlock(sec) {
  if (!sec.fields.length) return '';
  return `<div class="fields-grid">${sec.fields.map((f) => fieldInput(sec, f, sec.values[f.key])).join('')}</div>`;
}
function notesBlock(sec) {
  return `<div class="field mt-16"><label>Section notes</label><textarea class="textarea" rows="2" data-notes="${esc(sec.key)}" data-fk="n:${esc(sec.key)}" placeholder="Notes, coordination remarks, special requirements…">${esc(sec.notes || '')}</textarea></div>`;
}

/* ---------- items (applications) ---------- */
function itemsTable(space, discipline) {
  const items = SpecService.spaceItems(space.id, discipline);
  const extra = discipline === 'lighting' ? [['wattage', 'W'], ['cct', 'K'], ['beam', '°'], ['ip', 'IP'], ['dimming', 'Dimming']]
    : discipline === 'electrical' ? [['type', 'Type'], ['voltage', 'V'], ['amperage', 'A'], ['mounting', 'Mounting']] : [];
  if (!items.length) return `<div class="empty sm">No ${DISCIPLINES[discipline].label.toLowerCase()} items specified for this space. <button class="link-btn" data-action="add-item" data-disc="${discipline}">Add the first item</button></div>`;
  const totals = {};
  const rows = items.map(({ app, spec }) => {
    const q = SpecService.effectiveQty(app);
    if (q != null) totals[app.unit] = (totals[app.unit] || 0) + q;
    const d = spec.data;
    return `<tr>
      <td class="thumb-cell">${thumb((d.imageIds || [])[0])}</td>
      <td data-label="Code"><a href="#/projects/${space.projectId}/specs/${spec.id}">${codeTag(spec.code)}</a>${spec.libraryCode ? `<div class="tiny faint mt-4">${esc(spec.libraryCode)}</div>` : ''}</td>
      <td data-label="Item" class="no-label"><div class="strong">${esc(d.name)}</div><div class="sub">${esc([d.manufacturer, d.reference].filter(Boolean).join(' · '))}</div>${app.location ? `<div class="sub">↳ ${esc(app.location)}</div>` : ''}</td>
      ${extra.length ? extra.map(([k, l]) => `<td data-label="${l}" class="small">${esc(d.attrs?.[k] ?? '—')}</td>`).join('') : `<td data-label="Colour / finish" class="small">${swatch(d.colourHex)} ${esc([d.colour, d.finish].filter(Boolean).join(' · ') || '—')}</td>`}
      <td data-label="Qty" class="num"><b>${fmtNum(q)}</b>${app.qtyMode === 'measure' ? `<div class="tiny muted" title="Linked to ${esc(app.measureKey)}">${icon('link', '').replace('<svg', '<svg style="width:11px;height:11px;vertical-align:-1px"')} ${esc((space.measure.items.find((x) => x.key === app.measureKey) || {}).label || app.measureKey)}${app.wastePct ? ` +${app.wastePct}%` : ''}</div>` : ''}</td>
      <td data-label="Unit" class="small">${esc(app.unit)}</td>
      <td data-label="Status">${statusBadge(spec.status)}</td>
      <td class="actions-cell"><button class="btn btn-ghost btn-xs" data-action="edit-app" data-id="${app.id}">${icon('edit')}Qty</button></td>
    </tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="tbl stack">
    <thead><tr><th></th><th>Code</th><th>Item</th>${extra.length ? extra.map(([, l]) => `<th>${l}</th>`).join('') : '<th>Colour / finish</th>'}<th class="num">Qty</th><th>Unit</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="${3 + (extra.length || 1)}" class="no-label">${items.length} item${items.length > 1 ? 's' : ''}</td><td colspan="4" class="num">${qtyText(Object.fromEntries(Object.entries(totals).map(([u, v]) => [u, Math.round(v * 100) / 100])))}</td></tr></tfoot>
  </table></div>`;
}
function itemCards(space, discipline) {
  const items = SpecService.spaceItems(space.id, discipline);
  if (!items.length) return `<div class="empty sm">No ${DISCIPLINES[discipline].label.toLowerCase()} specified for this space. <button class="link-btn" data-action="add-item" data-disc="${discipline}">Add an item</button></div>`;
  return `<div class="icards">${items.map(({ app, spec }) => {
    const d = spec.data;
    const a = d.attrs || {};
    return `<div class="icard">
      <a class="media" href="#/projects/${space.projectId}/specs/${spec.id}">${(d.imageIds || [])[0] ? `<img data-file="${esc(d.imageIds[0])}" alt=""/>` : icon(discipline === 'joinery' ? 'cabinet' : 'sofa')}</a>
      <div class="body"><div class="row between">${codeTag(spec.code)}${statusBadge(spec.status)}</div>
        <div class="nm">${esc(d.name)}</div>
        <div class="muted">${esc(d.dimensions || '—')}</div>
        <div><span class="faint">Material</span> ${esc(a.material || d.colour || '—')}</div>
        <div><span class="faint">Finish</span> ${esc(d.finish || '—')}</div>
        <div><span class="faint">${discipline === 'joinery' ? 'Fabricator' : 'Maker'}</span> ${esc(a.fabricator || d.manufacturer || '—')}</div>
        ${discipline === 'joinery' && a.hardware ? `<div class="tiny muted clamp-2"><span class="faint">Hardware</span> ${esc(a.hardware)}</div>` : ''}
      </div>
      <div class="foot"><span><b>${fmtNum(SpecService.effectiveQty(app))}</b> ${esc(app.unit)}</span><button class="btn btn-ghost btn-xs" data-action="edit-app" data-id="${app.id}">${icon('edit')}Qty</button></div>
    </div>`;
  }).join('')}</div>`;
}

/* ---------- measurements ---------- */
function measurementsBlock(space) {
  const m = space.measure;
  const res = resolveMeasures(m);
  const ops = openingsTotals(m);
  const rows = m.items.map((it) => {
    const r = res[it.key] || {};
    const fk = `m:${it.key}`;
    let valueCell;
    if (it.mode === 'formula') {
      valueCell = `<div class="mval ${r.overridden ? 'ov' : ''}">${fmtNum(r.value, 3)}</div>
        <div class="calc">= ${esc(it.formula)}${r.overridden ? ` <span title="Calculated ${fmtNum(r.computed, 3)}">(calc. ${fmtNum(r.computed, 3)})</span>` : ''}</div>${r.error ? `<div class="err">${esc(r.error)}</div>` : ''}`;
    } else if (r.overridden) {
      valueCell = `<div class="mval ov">${fmtNum(r.value, 3)}</div>`;
    } else {
      valueCell = `<input class="input sm num" type="number" step="any" data-mval="${esc(it.key)}" data-fk="${fk}" value="${it.value ?? ''}" placeholder="—" style="max-width:120px"/>`;
    }
    return `<tr>
      <td data-label="Measurement"><b>${esc(it.label)}</b>${it.core ? '' : ' <span class="badge plain">custom</span>'}
        ${r.overridden ? `<div class="tiny" style="color:var(--warn)">Overridden: ${esc(it.override.reason || 'no reason')} — ${esc(it.override.by || '')}</div>` : ''}</td>
      <td data-label="Value" class="num">${valueCell}</td>
      <td data-label="Unit" class="small">${esc(it.unit)}</td>
      <td data-label="Method"><select class="select sm" data-mmode="${esc(it.key)}" data-fk="mm:${esc(it.key)}"><option value="manual" ${it.mode === 'manual' ? 'selected' : ''}>Manual</option><option value="formula" ${it.mode === 'formula' ? 'selected' : ''}>Formula</option></select></td>
      <td data-label="Source"><select class="select sm" data-msrc="${esc(it.key)}" data-fk="ms:${esc(it.key)}"><option value=""></option>${MEASURE_SOURCES.map((s) => `<option ${s === it.source ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td data-label="Notes"><input class="input sm" data-mnote="${esc(it.key)}" data-fk="mn:${esc(it.key)}" value="${esc(it.notes || '')}" placeholder="—"/></td>
      <td class="actions-cell"><button class="btn btn-ghost btn-xs btn-icon" data-action="m-menu" data-key="${esc(it.key)}" aria-label="Measurement options">${icon('more')}</button></td>
    </tr>`;
  }).join('');
  const opRows = m.openings.map((o) => `<tr>
      <td data-label="Type"><select class="select sm" data-op="${o.id}" data-opk="type" data-fk="op:${o.id}:type">${OPENING_TYPES.map((t) => `<option ${t === o.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td data-label="Label"><input class="input sm" data-op="${o.id}" data-opk="label" data-fk="op:${o.id}:label" value="${esc(o.label || '')}" style="max-width:110px"/></td>
      <td data-label="Width (m)"><input class="input sm num" type="number" step="any" data-op="${o.id}" data-opk="width" data-fk="op:${o.id}:w" value="${o.width ?? ''}" style="max-width:90px"/></td>
      <td data-label="Height (m)"><input class="input sm num" type="number" step="any" data-op="${o.id}" data-opk="height" data-fk="op:${o.id}:h" value="${o.height ?? ''}" style="max-width:90px"/></td>
      <td data-label="Qty"><input class="input sm num" type="number" step="1" data-op="${o.id}" data-opk="qty" data-fk="op:${o.id}:q" value="${o.qty ?? 1}" style="max-width:70px"/></td>
      <td data-label="Area" class="num mono">${fmtNum((toNum(o.width) || 0) * (toNum(o.height) || 0) * (toNum(o.qty) || 0), 3)} m²</td>
      <td class="actions-cell"><button class="btn btn-ghost btn-xs btn-icon" data-action="rm-op" data-id="${o.id}" aria-label="Remove opening">${icon('x')}</button></td></tr>`).join('');
  return `
    <div class="mini-stats">
      <div><b>${fmtNum(res.floor_area?.value)} m²</b>Floor</div>
      <div><b>${fmtNum(res.net_wall_area?.value)} m²</b>Net wall</div>
      <div><b>${fmtNum(res.ceiling_height?.value)} m</b>Height</div>
      <div><b>${fmtNum(res.skirting_length?.value)} lm</b>Skirting</div>
    </div>
    <div class="table-wrap mtable"><table class="tbl stack compact">
      <thead><tr><th>Measurement</th><th class="num">Value</th><th>Unit</th><th>Method</th><th>Source</th><th>Notes</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="row mt-12"><button class="btn btn-sm" data-action="add-measure">${icon('plus')}Custom measurement</button><span class="tiny muted">Formulas reference other measurements, e.g. <code>{perimeter} * {ceiling_height}</code>. Derived values recalculate automatically.</span></div>

    <div class="subhead"><div class="h4">Openings <span class="tiny muted">— doors & windows deducted from wall area (Σ ${fmtNum(ops.openings_total, 3)} m²; door widths ${fmtNum(ops.door_widths)} m deducted from skirting)</span></div><button class="btn btn-sm" data-action="add-op">${icon('plus')}Opening</button></div>
    ${m.openings.length ? `<div class="table-wrap"><table class="tbl stack compact"><thead><tr><th>Type</th><th>Label</th><th>Width (m)</th><th>Height (m)</th><th>Qty</th><th class="num">Area</th><th></th></tr></thead><tbody>${opRows}</tbody></table></div>` : '<div class="empty sm">No openings recorded. Openings area will remain empty until openings are entered or the value is set manually.</div>'}

    <div class="subhead"><div class="h4">Measurement drawings</div></div>
    ${gallery(m.drawingIds || [], { addAction: 'add-drawing', removeAction: 'rm-drawing', addLabel: 'Attach drawing' })}
    <div class="tiny muted mt-8">Last updated ${fmtDateTime(m.updatedAt)}</div>`;
}

/* ---------- documents ---------- */
function documentsBlock(space) {
  const files = (space.fileIds || []).map((id) => FileService.get(id)).filter(Boolean);
  const imgs = files.filter((f) => isImage(f)).map((f) => f.id);
  const docs = files.filter((f) => !isImage(f)).map((f) => f.id);
  return `
    <div class="dropzone mb-16" data-drop>${icon('upload')} Drop images, drawings or documents here, or <button class="link-btn" data-action="upload-docs">browse</button></div>
    <div class="subhead"><div class="h4">Reference images & drawings <span class="tiny muted">(${imgs.length})</span></div></div>
    ${imgs.length ? gallery(imgs, { removeAction: 'rm-file' }) : '<div class="empty sm">No images yet.</div>'}
    ${imgs.length ? `<div class="row wrap mt-8 tiny muted">Room cover: ${imgs.map((id) => `<button class="chip ${space.coverImageId === id ? 'active' : ''}" data-action="set-cover" data-id="${id}">${esc(FileService.get(id).name.slice(0, 18))}</button>`).join('')}</div>` : ''}
    <div class="subhead"><div class="h4">Documents <span class="tiny muted">(${docs.length})</span></div></div>
    ${fileList(docs, { removeAction: 'rm-file', emptyText: 'No documents attached.', showKind: true })}`;
}

/* ---------- page ---------- */
export function render(root, ctx) {
  const space = ProjectService.space(ctx.params.sid);
  const project = ProjectService.get(space.projectId);
  const floors = ProjectService.floors(project.id);
  const floor = floors.find((f) => f.id === space.floorId);
  const comp = spaceCompleteness(space);
  const res = resolveMeasures(space.measure);
  const pending = TemplateService.pendingAdditions(space);
  const secs = space.doc.sections;
  const visible = secs.filter((s) => s.enabled || ui.showHidden);
  const itemsCount = SpecService.applications({ spaceId: space.id }).length;

  const sectionHtml = (sec) => {
    const meta = SECTION_MAP[sec.key];
    let body = '';
    let headActions = '';
    if (sec.key === 'general') {
      body = fieldsBlock(sec) + `<div class="subhead"><div class="h4">Other materials <span class="tiny muted">(general / ancillary specifications)</span></div><button class="btn btn-sm" data-action="add-item" data-disc="general">${icon('plus')}Add</button></div>${itemsTable(space, 'general')}` + notesBlock(sec);
    } else if (sec.key === 'measurements') {
      body = measurementsBlock(space);
    } else if (sec.key === 'documents') {
      body = documentsBlock(space) + notesBlock(sec);
    } else {
      const disc = meta.discipline;
      headActions = `<button class="btn btn-sm" data-action="add-item" data-disc="${disc}">${icon('plus')}Add item</button>`;
      body = fieldsBlock(sec) + (['furniture', 'joinery'].includes(disc) ? itemCards(space, disc) : itemsTable(space, disc)) + notesBlock(sec);
    }
    return `<section class="wsec ${sec.enabled ? '' : 'off'}" id="sec-${sec.key}" data-sec="${sec.key}">
      <div class="wsec-head"><span class="num">${meta.num}</span><h2 class="h2">${esc(meta.label)}</h2>
        ${sec.enabled ? '' : '<span class="badge plain">Hidden for this room</span>'}
        <div class="row gap-4">${headActions}${sec.key !== 'measurements' ? `<button class="btn btn-ghost btn-sm btn-icon" data-action="sec-menu" data-sec="${sec.key}" aria-label="Section options">${icon('more')}</button>` : ''}</div></div>
      <div class="wsec-body">${body}</div></section>`;
  };

  root.innerHTML = `
  <div class="ws">
    <aside class="ws-nav" aria-label="Rooms and sections">
      ${floors.map((f) => `<div class="grp"><div class="eyebrow" style="padding:0 8px 6px">${esc(f.name)}</div>
        ${ProjectService.spaces(project.id, f.id).map((s) => `<a href="#/projects/${project.id}/spaces/${s.id}" class="${s.id === space.id ? 'active' : ''}"><span class="truncate">${esc(s.name)}</span><span class="pct">${spaceCompleteness(s).pct}%</span></a>`).join('')}</div>`).join('')}
      <button class="btn btn-ghost btn-sm" data-action="add-space">${icon('plus')}Add space</button>
      <div class="grp mt-24"><div class="eyebrow" style="padding:0 8px 6px">This room</div>
        ${secs.map((s) => `<a href="javascript:void 0" data-goto="${s.key}" class="${s.enabled ? '' : 'off'}"><span class="secnum">${SECTION_MAP[s.key].num}</span>${esc(SECTION_MAP[s.key].label)}</a>`).join('')}
      </div>
    </aside>

    <div style="min-width:0">
      <div class="ws-mobile-bar">
        <select class="select sm" data-action-change="goto-space" style="max-width:220px;flex:none">${floors.map((f) => `<optgroup label="${esc(f.name)}">${ProjectService.spaces(project.id, f.id).map((s) => `<option value="${s.id}" ${s.id === space.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`).join('')}</select>
        ${visible.map((s) => `<button class="chip" data-goto="${s.key}">${esc(SECTION_MAP[s.key].label)}</button>`).join('')}
      </div>

      <div class="ws-hero">
        <div style="min-width:0">
          <div class="eyebrow">${esc(project.code)} · ${esc(floor ? floor.name : '')} · ${esc(space.code)} · ${esc(space.typeName)}</div>
          <h1 class="h1 mt-8">${esc(space.name)}</h1>
          <div class="mini-stats mt-16" style="margin-bottom:0">
            <div><b>${fmtNum(res.floor_area?.value)} m²</b>Floor area</div>
            <div><b>${fmtNum(res.ceiling_height?.value)} m</b>Ceiling height</div>
            <div><b>${itemsCount}</b>Specified items</div>
            <div style="min-width:150px"><b>${comp.pct}%</b>Documented${progress(comp.pct, { label: false })}</div>
          </div>
          <div class="row wrap mt-16">
            <a class="btn btn-primary" href="#/export/room/${space.id}">${icon('sheet')}Technical room sheet</a>
            <a class="btn" href="#/export/board/${project.id}?space=${space.id}">${icon('board')}Room material board</a>
            <button class="btn" data-action="customise">${icon('templates')}Customise sections</button>
            <button class="btn btn-icon" data-action="space-menu" aria-label="More">${icon('more')}</button>
          </div>
        </div>
        <div class="media" ${space.coverImageId ? `data-action="file-open" data-id="${space.coverImageId}" style="cursor:zoom-in"` : ''}>${space.coverImageId ? `<img data-file="${esc(space.coverImageId)}" alt=""/>` : `<button class="btn btn-sm" data-action="upload-cover">${icon('image')}Add room image</button>`}</div>
      </div>

      ${pending && pending.additions.length ? `<div class="notice info mt-16">${icon('sync')}<div class="grow">Template <b>${esc(space.typeName)}</b> has been updated to v${pending.version} with ${pending.additions.length} new field(s): ${esc(pending.additions.map((a) => a.field.label).join(', '))}. Existing documentation is never changed automatically.</div><button class="btn btn-sm" data-action="apply-tpl">Add new fields</button><button class="btn btn-ghost btn-sm" data-action="dismiss-tpl">Ignore</button></div>` : ''}
      ${comp.missing.length ? `<div class="tiny muted mt-16">To complete: ${esc(comp.missing.join(' · '))}</div>` : ''}

      ${visible.map(sectionHtml).join('')}
      <div class="row mt-24"><label class="check small"><input type="checkbox" data-action-change="show-hidden" ${ui.showHidden ? 'checked' : ''}/> Show hidden sections (${secs.filter((s) => !s.enabled).length})</label></div>
    </div>
  </div>`;

  bind(root, space, project, ctx);

  // jump to a requested section once
  const sec = ctx.query.sec;
  if (sec && ui.scrolledFor !== space.id + sec) {
    ui.scrolledFor = space.id + sec;
    setTimeout(() => root.querySelector(`#sec-${sec}`)?.scrollIntoView({ block: 'start' }), 60);
  }
}

function bind(root, space, project, ctx) {
  const sid = space.id;
  bindDropzone(root.querySelector('[data-drop]'), (files) => uploadDocs(sid, project.id, files));

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.field) {
      const [sec, key] = t.dataset.field.split('|');
      ProjectService.setFieldValue(sid, sec, key, t.value);
    } else if (t.dataset.notes) ProjectService.setSectionNotes(sid, t.dataset.notes, t.value);
    else if (t.dataset.mval) MeasurementService.setValue(sid, t.dataset.mval, t.value);
    else if (t.dataset.msrc) MeasurementService.setItem(sid, t.dataset.msrc, { source: t.value });
    else if (t.dataset.mnote) MeasurementService.setItem(sid, t.dataset.mnote, { notes: t.value });
    else if (t.dataset.mmode) {
      const key = t.dataset.mmode;
      const it = space.measure.items.find((x) => x.key === key);
      if (t.value === 'formula' && !it.formula) { editFormula(sid, key, true); return; }
      MeasurementService.setItem(sid, key, { mode: t.value });
    } else if (t.dataset.op) {
      const k = t.dataset.opk;
      MeasurementService.updateOpening(sid, t.dataset.op, { [k]: ['width', 'height', 'qty'].includes(k) ? toNum(t.value) : t.value });
    } else if (t.dataset.actionChange === 'show-hidden') { ui.showHidden = t.checked; ctx.rerender(); }
    else if (t.dataset.actionChange === 'goto-space') navigate(`/projects/${project.id}/spaces/${t.value}`);
  });

  root.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); root.querySelector(`#sec-${g.dataset.goto}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setQuery({ sec: g.dataset.goto }); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    const s = ProjectService.space(sid);
    switch (act) {
      case 'add-item': return addItemToSpace(sid, a.dataset.disc);
      case 'edit-app': return editApplication(a.dataset.id);
      case 'add-space': return addSpaceDialog(project.id, s.floorId);
      case 'customise': return customiseSections(sid);
      case 'apply-tpl': { const n = ProjectService.applyTemplateAdditions(sid); return toast(`${n} field(s) added from template`); }
      case 'dismiss-tpl': return ProjectService.dismissTemplateUpdate(sid);
      case 'rm-field': {
        if (await confirmDialog({ title: 'Remove field?', message: 'The field and its value are removed from this room only.', confirmText: 'Remove', danger: true })) ProjectService.removeField(sid, a.dataset.sec, a.dataset.key);
        return;
      }
      case 'sec-menu': {
        const key = a.dataset.sec;
        const sec = s.doc.sections.find((x) => x.key === key);
        return showMenu(a, [
          { label: 'Add custom field', icon: 'plus', onClick: () => addField(sid, key) },
          { label: sec.enabled ? 'Hide section for this room' : 'Show section for this room', icon: 'eye', onClick: () => ProjectService.toggleSection(sid, key, !sec.enabled) },
        ]);
      }
      case 'add-measure': return addMeasure(sid);
      case 'm-menu': return measureMenu(a, sid, a.dataset.key);
      case 'add-op': return MeasurementService.addOpening(sid, { type: 'Door', label: `O${(s.measure.openings.length || 0) + 1}`, width: 0.9, height: 2.2, qty: 1 });
      case 'rm-op': return MeasurementService.removeOpening(sid, a.dataset.id);
      case 'add-drawing': {
        const files = await pickFiles({ accept: ACCEPT_DOCS });
        for (const f of files) { const m = await FileService.add(f, { kind: 'drawing', projectId: project.id }); MeasurementService.addDrawing(sid, m.id); }
        if (files.length) toast(`${files.length} drawing(s) attached`);
        return;
      }
      case 'rm-drawing': MeasurementService.removeDrawing(sid, a.dataset.id); FileService.collect(a.dataset.id); return;
      case 'upload-docs': { const files = await pickFiles({ accept: ACCEPT_DOCS }); return uploadDocs(sid, project.id, files); }
      case 'upload-cover': {
        const [f] = await pickFiles({ accept: ACCEPT_IMAGES, multiple: false });
        if (!f) return;
        const m = await FileService.add(f, { kind: 'image', projectId: project.id });
        ProjectService.mutateSpace(sid, (x) => { x.coverImageId = m.id; x.fileIds = [...(x.fileIds || []), m.id]; });
        return;
      }
      case 'set-cover': return ProjectService.updateSpace(sid, { coverImageId: a.dataset.id });
      case 'rm-file': {
        if (await confirmDialog({ title: 'Remove file?', message: 'The file is detached from this room. It is deleted only if nothing else uses it.', confirmText: 'Remove' })) ProjectService.removeSpaceFile(sid, a.dataset.id);
        return;
      }
      case 'space-menu': {
        const others = ProjectService.floors(project.id).filter((f) => f.id !== s.floorId);
        return showMenu(a, [
          { label: 'Rename / recode', icon: 'edit', onClick: async () => {
            const v = await promptDialog({ title: 'Rename space', fields: [{ name: 'name', label: 'Space name', value: s.name, required: true }, { name: 'code', label: 'Space code', value: s.code, required: true }] });
            if (v) ProjectService.updateSpace(sid, { name: v.name.trim(), code: v.code.trim() });
          } },
          { label: 'Duplicate space', icon: 'copy', onClick: () => { const c = ProjectService.duplicateSpace(sid); toast('Space duplicated'); navigate(`/projects/${project.id}/spaces/${c.id}`); } },
          ...(others.length ? [{ label: 'Move to floor…', icon: 'move', onClick: async () => {
            const v = await promptDialog({ title: 'Move space', fields: [{ name: 'floorId', label: 'Destination floor', type: 'select', value: others[0].id, options: others.map((f) => [f.id, f.name]) }], confirmText: 'Move' });
            if (v) { ProjectService.moveSpace(sid, v.floorId); toast('Space moved'); }
          } }] : []),
          '-',
          { label: 'Delete space…', icon: 'trash', danger: true, onClick: async () => {
            if (await confirmDialog({ title: 'Delete space?', danger: true, confirmText: 'Delete', message: `Delete <b>${esc(s.name)}</b> with its measurements and documentation?`, detail: 'Item assignments for this room are removed; project specifications are kept.' })) {
              ProjectService.removeSpace(sid); toast('Space deleted'); navigate(`/projects/${project.id}/spaces`);
            }
          } },
        ]);
      }
    }
  });
}

async function uploadDocs(sid, pid, files) {
  if (!files || !files.length) return;
  try {
    const metas = [];
    for (const f of files) metas.push(await FileService.add(f, { kind: /^image\//.test(f.type) ? 'image' : /\.(dwg|dxf)$/i.test(f.name) ? 'drawing' : 'document', projectId: pid }));
    ProjectService.addSpaceFiles(sid, metas.map((m) => m.id));
    toast(`${metas.length} file(s) attached`);
  } catch (e) { toast(e.message, { error: true }); }
}

function customiseSections(sid) {
  const s = ProjectService.space(sid);
  openModal({
    title: 'Customise room sections', eyebrow: `${s.code} · ${s.name}`,
    body: `<p class="small muted">Turn sections on or off for this room only. The global “${esc(s.typeName)}” template is not changed.</p>
      <div class="col gap-8 mt-12">${s.doc.sections.map((sec) => `<label class="check"><input type="checkbox" name="${sec.key}" ${sec.enabled ? 'checked' : ''} ${sec.key === 'general' ? 'disabled' : ''}/> <span class="mono tiny faint">${SECTION_MAP[sec.key].num}</span> ${esc(SECTION_MAP[sec.key].label)} <span class="tiny faint">${sec.fields.length} fields</span></label>`).join('')}</div>`,
    actions: [{ label: 'Cancel', action: 'cancel' }, { label: 'Apply', action: 'ok', kind: 'primary' }],
    onAction(id, el) {
      ProjectService.mutateSpace(sid, (x) => { for (const sec of x.doc.sections) { const cb = el.querySelector(`[name="${sec.key}"]`); if (cb && !cb.disabled) sec.enabled = cb.checked; } });
      toast('Room sections updated');
    },
  });
}

async function addField(sid, sec) {
  const v = await promptDialog({
    title: 'Add custom field', eyebrow: SECTION_MAP[sec].label, intro: 'Added to this room only.',
    fields: [{ name: 'label', label: 'Field label', required: true }, { name: 'type', label: 'Type', type: 'select', value: 'text', options: [['text', 'Text'], ['number', 'Number'], ['textarea', 'Long text'], ['select', 'Choice list']] }, { name: 'options', label: 'Choices (comma separated, for choice lists)', value: '' }],
  });
  if (!v) return;
  ProjectService.addCustomField(sid, sec, { label: v.label.trim(), type: v.type, options: v.options.split(',').map((x) => x.trim()).filter(Boolean) });
  toast('Field added');
}

async function addMeasure(sid) {
  const s = ProjectService.space(sid);
  const v = await promptDialog({
    title: 'Custom measurement', size: '',
    fields: [
      { name: 'label', label: 'Label', required: true, placeholder: 'e.g. Feature wall area, Shower wall tiling' },
      { name: 'unit', label: 'Unit', type: 'select', value: 'm²', options: UNITS },
      { name: 'mode', label: 'Method', type: 'select', value: 'manual', options: [['manual', 'Manual value'], ['formula', 'Formula']] },
      { name: 'value', label: 'Value (manual)', type: 'number' },
      { name: 'formula', label: 'Formula', placeholder: '{gross_wall_area} * 0.5', hint: `Available: ${s.measure.items.map((x) => `{${x.key}}`).join(' ')} {openings_total} {door_widths}` },
      { name: 'source', label: 'Source', type: 'select', value: '', options: ['', ...MEASURE_SOURCES] },
    ],
  });
  if (!v) return;
  if (v.mode === 'formula') {
    const err = validateFormula(v.formula, s.measure.items.map((x) => x.key));
    if (err) { toast(`Formula error: ${err}`, { error: true }); return; }
  }
  MeasurementService.addCustom(sid, v);
  toast('Measurement added');
}

function editFormula(sid, key, switching = false) {
  const s = ProjectService.space(sid);
  const it = s.measure.items.find((x) => x.key === key);
  const def = MEASURE_DEFS.find((d) => d.key === key);
  openModal({
    title: `Formula — ${it.label}`, size: '',
    body: `${fieldHtml({ name: 'formula', label: 'Formula', value: it.formula || (def && def.formula) || '' })}
      <div class="tiny muted mt-8">References: ${s.measure.items.filter((x) => x.key !== key).map((x) => `<code>{${x.key}}</code>`).join(' ')} <code>{openings_total}</code> <code>{door_widths}</code><br>Functions: min(), max(), round(x, d), abs(), ceil(), floor().</div>
      <div class="tiny mt-8" data-err style="color:var(--bad)"></div>`,
    actions: [...(def && def.formula ? [{ label: 'Reset to default', action: 'reset', left: true }] : []), { label: 'Cancel', action: 'cancel' }, { label: 'Save formula', action: 'ok', kind: 'primary' }],
    onAction(id, el) {
      if (id === 'reset') { MeasurementService.setItem(sid, key, { mode: 'formula', formula: def.formula }); return; }
      const f = el.querySelector('[name=formula]').value.trim();
      const err = validateFormula(f, s.measure.items.map((x) => x.key));
      if (err) { el.querySelector('[data-err]').textContent = err; return false; }
      MeasurementService.setItem(sid, key, { mode: 'formula', formula: f });
    },
    onClose() { if (switching) bus.emit('data:changed'); },
  });
}

function measureMenu(anchor, sid, key) {
  const s = ProjectService.space(sid);
  const it = s.measure.items.find((x) => x.key === key);
  const res = resolveMeasures(s.measure)[key] || {};
  showMenu(anchor, [
    { label: 'Edit formula', icon: 'edit', onClick: () => editFormula(sid, key) },
    it.override
      ? { label: 'Clear override', icon: 'restore', onClick: () => { MeasurementService.setOverride(sid, key, null); toast('Override cleared'); } }
      : { label: 'Override value…', icon: 'alert', onClick: async () => {
        const v = await promptDialog({
          title: `Override ${it.label}`, intro: `Current value: <b>${fmtNum(res.value, 3)} ${esc(it.unit)}</b>. Overrides keep the calculated value for reference and must record a reason.`,
          fields: [{ name: 'value', label: `Override value (${it.unit})`, type: 'number', required: true }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'e.g. Measured on site after wall cladding' }],
        });
        if (v) { MeasurementService.setOverride(sid, key, v.value, v.reason); toast('Override recorded'); }
      } },
    ...(it.core && MEASURE_DEFS.find((d) => d.key === key)?.formula ? [{ label: 'Reset to default method', icon: 'restore', onClick: () => MeasurementService.resetToDefault(sid, key) }] : []),
    ...(!it.core ? ['-', { label: 'Delete custom measurement', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog({ title: 'Delete measurement?', message: `Delete <b>${esc(it.label)}</b>? Item quantities linked to it will show as unmeasured.`, danger: true, confirmText: 'Delete' })) MeasurementService.removeCustom(sid, key); } }] : []),
  ]);
}

export { FILE_KINDS };
