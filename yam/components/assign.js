// Assigning specifications to spaces (space applications) and editing quantities.
import { esc, fmtNum, matches, toNum } from '../core/utils.js';
import { icon } from './icons.js';
import { openModal, fieldHtml } from './modal.js';
import { toast } from './toast.js';
import { codeTag, statusBadge, thumb, swatch } from './ui.js';
import { openSpecEditor } from './spec-form.js';
import { db } from '../services/db.js';
import { SpecService } from '../services/spec-service.js';
import { LibraryService } from '../services/library-service.js';
import { ProjectService } from '../services/project-service.js';
import { resolveMeasures } from '../services/measurement-service.js';
import { FileService } from '../services/file-service.js';
import { DISCIPLINES, UNITS, LIB_CAT_MAP } from '../data/models.js';

function measureOptions(space) {
  const res = resolveMeasures(space.measure);
  return (space.measure?.items || []).map((it) => [it.key, `${it.label} — ${res[it.key]?.value != null ? fmtNum(res[it.key].value) + ' ' + it.unit : 'not measured'}`]);
}

function qtyFormHtml(space, spec, app = {}) {
  const mode = app.qtyMode || 'manual';
  const unit = app.unit || spec.data.unit || DISCIPLINES[spec.discipline]?.unit || 'pcs';
  return `
    <div class="row gap-12 mb-16" style="align-items:flex-start">
      ${thumb((spec.data.imageIds || [])[0], { size: 'lg' })}
      <div class="grow"><div class="row wrap gap-4">${codeTag(spec.code)} ${spec.libraryCode ? codeTag(spec.libraryCode, true) : ''} ${statusBadge(spec.status)}</div>
      <div class="strong mt-4">${esc(spec.data.name)}</div><div class="small muted">${esc([spec.data.manufacturer, spec.data.reference].filter(Boolean).join(' · '))}</div>
      <div class="small muted">Space: <b>${esc(space.code)} ${esc(space.name)}</b></div></div>
    </div>
    <div class="field mb-16"><label>Quantity source</label>
      <div class="seg" data-qmode>
        <button type="button" data-m="manual" class="${mode === 'manual' ? 'active' : ''}">Enter manually</button>
        <button type="button" data-m="measure" class="${mode === 'measure' ? 'active' : ''}">Link to measurement</button>
      </div>
      <input type="hidden" name="qtyMode" value="${mode}"/>
    </div>
    <div class="form-grid">
      <div data-manual class="${mode === 'manual' ? '' : 'hidden'}">${fieldHtml({ name: 'quantity', label: 'Quantity', type: 'number', value: app.quantity ?? '' })}</div>
      <div data-measure class="${mode === 'measure' ? '' : 'hidden'}">${fieldHtml({ name: 'measureKey', label: 'Measurement', type: 'select', value: app.measureKey || (spec.discipline === 'walls' ? 'net_wall_area' : spec.discipline === 'ceiling' ? 'ceiling_area' : 'floor_area'), options: measureOptions(space) })}</div>
      <div data-measure class="${mode === 'measure' ? '' : 'hidden'}">${fieldHtml({ name: 'wastePct', label: 'Waste / allowance', type: 'number', value: app.wastePct ?? 5, addon: '%' })}</div>
      ${fieldHtml({ name: 'unit', label: 'Unit', type: 'select', value: unit, options: UNITS.includes(unit) ? UNITS : [unit, ...UNITS] })}
      ${fieldHtml({ name: 'unitPrice', label: 'Unit price override (optional)', type: 'number', value: app.unitPrice ?? '', hint: spec.data.unitPrice != null ? `Spec rate: ${fmtNum(spec.data.unitPrice)} ${esc(spec.data.currency || '')}` : '' })}
      ${fieldHtml({ name: 'location', label: 'Location in room', value: app.location || '', placeholder: 'e.g. Feature wall, vanity wall' })}
      ${fieldHtml({ name: 'notes', label: 'Notes', value: app.notes || '' })}
    </div>`;
}

function bindQtyForm(el) {
  el.querySelector('[data-qmode]')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    el.querySelectorAll('[data-qmode] button').forEach((x) => x.classList.toggle('active', x === b));
    el.querySelector('[name="qtyMode"]').value = b.dataset.m;
    el.querySelectorAll('[data-manual]').forEach((x) => x.classList.toggle('hidden', b.dataset.m !== 'manual'));
    el.querySelectorAll('[data-measure]').forEach((x) => x.classList.toggle('hidden', b.dataset.m !== 'measure'));
  });
}
function readQty(el) {
  const g = (n) => el.querySelector(`[name="${n}"]`)?.value;
  return {
    qtyMode: g('qtyMode'), quantity: toNum(g('quantity')), measureKey: g('measureKey'), wastePct: toNum(g('wastePct')) || 0,
    unit: g('unit'), unitPrice: toNum(g('unitPrice')), location: g('location') || '', notes: g('notes') || '',
  };
}

/** Edit an existing application's quantity/unit/notes. */
export function editApplication(appId) {
  const app = db.get('applications', appId);
  const spec = app && db.get('specs', app.specId);
  const space = app && db.get('spaces', app.spaceId);
  if (!spec || !space) return;
  openModal({
    title: 'Edit quantity', eyebrow: 'Space application', body: qtyFormHtml(space, spec, app),
    actions: [{ label: 'Remove from space', action: 'remove', kind: 'danger', left: true }, { label: 'Cancel', action: 'cancel' }, { label: 'Save', action: 'save', kind: 'primary' }],
    onMount: bindQtyForm,
    onAction(id, el) {
      if (id === 'remove') { SpecService.removeApplication(appId); toast('Removed from space'); return; }
      const q = readQty(el);
      if (q.qtyMode === 'manual' && q.quantity == null) { el.querySelector('[name="quantity"]').classList.add('invalid'); return false; }
      SpecService.updateApplication(appId, q);
      toast('Quantity updated');
    },
  });
}

/** Ask quantity for a spec in a space and create the application. */
export function quantityStep(spec, space, onDone) {
  openModal({
    title: 'Add to space', eyebrow: DISCIPLINES[spec.discipline]?.label, body: qtyFormHtml(space, spec, { qtyMode: ['flooring', 'walls', 'ceiling'].includes(spec.discipline) ? 'measure' : 'manual', quantity: ['flooring', 'walls', 'ceiling'].includes(spec.discipline) ? null : 1 }),
    actions: [{ label: 'Cancel', action: 'cancel' }, { label: 'Add to space', action: 'save', kind: 'primary' }],
    onMount: bindQtyForm,
    onAction(id, el) {
      const q = readQty(el);
      if (q.qtyMode === 'manual' && q.quantity == null) { el.querySelector('[name="quantity"]').classList.add('invalid'); return false; }
      SpecService.addApplication(spec.id, space.id, q);
      toast(`${spec.code} added to ${space.name}`);
      onDone && onDone();
    },
  });
}

/**
 * Main entry from a room section: choose an existing project spec, a library item, or create a custom item.
 */
export function addItemToSpace(spaceId, discipline) {
  const space = db.get('spaces', spaceId);
  const projectId = space.projectId;
  const state = { tab: 'project', q: '', all: false };
  const libCats = Object.values(LIB_CAT_MAP).filter((c) => c.discipline === discipline).map((c) => c.key);

  const list = () => {
    if (state.tab === 'project') {
      const specs = SpecService.forProject(projectId).filter((s) => (state.all || s.discipline === discipline) && matches([s.code, s.libraryCode, s.data.name, s.data.manufacturer, s.data.reference], state.q));
      if (!specs.length) return `<div class="empty sm">No ${state.all ? '' : DISCIPLINES[discipline].label.toLowerCase() + ' '}specifications in this project yet. Pick from the library or create a custom item.</div>`;
      return `<div class="file-list">${specs.map((s) => {
        const already = SpecService.applications({ specId: s.id, spaceId }).length;
        return `<div class="file-row" style="cursor:pointer" data-pick-spec="${s.id}">${thumb((s.data.imageIds || [])[0])}
          <div class="grow"><div class="row gap-4 wrap">${codeTag(s.code)} ${s.libraryCode ? codeTag(s.libraryCode, true) : ''} ${statusBadge(s.status)}</div><div class="strong mt-4">${esc(s.data.name)}</div><div class="tiny muted">${esc([s.data.manufacturer, s.data.colour, s.data.finish].filter(Boolean).join(' · '))}</div></div>
          ${already ? `<span class="badge plain">In this space</span>` : ''}${icon('chevronRight', 'faint')}</div>`;
      }).join('')}</div>`;
    }
    if (state.tab === 'library') {
      const items = LibraryService.query({ q: state.q }).filter((l) => state.all || libCats.includes(l.category));
      if (!items.length) return `<div class="empty sm">No library items match. <a href="#/library">Open the library</a> to add one.</div>`;
      return `<div class="file-list">${items.map((l) => {
        const existing = db.find('specs', (s) => s.projectId === projectId && s.libraryId === l.id);
        return `<div class="file-row" style="cursor:pointer" data-pick-lib="${l.id}">${thumb((l.data.imageIds || [])[0])}
          <div class="grow"><div class="row gap-4">${codeTag(l.code, true)} <span class="tiny muted">${esc(LIB_CAT_MAP[l.category]?.label || '')}</span></div><div class="strong mt-4">${esc(l.data.name)}</div><div class="tiny muted">${swatch(l.data.colourHex)} ${esc([l.data.manufacturer, l.data.colour, l.data.finish].filter(Boolean).join(' · '))}</div></div>
          ${existing ? `<span class="badge plain" title="Already specified in this project">${esc(existing.code)}</span>` : ''}${icon('chevronRight', 'faint')}</div>`;
      }).join('')}</div>`;
    }
    return '';
  };
  const body = () => `
    <div class="row between wrap gap-12 mb-16">
      <div class="seg" data-tabs>
        <button type="button" data-t="project" class="${state.tab === 'project' ? 'active' : ''}">Project specifications</button>
        <button type="button" data-t="library" class="${state.tab === 'library' ? 'active' : ''}">From library</button>
        <button type="button" data-t="custom">New custom item</button>
      </div>
      <label class="check tiny"><input type="checkbox" data-all ${state.all ? 'checked' : ''}/> Show all disciplines</label>
    </div>
    <div class="searchbox mb-16">${icon('search')}<input class="input" data-q placeholder="Search code, name, manufacturer…" value="${esc(state.q)}"/></div>
    <div data-list style="max-height:52vh;overflow:auto">${list()}</div>`;

  const m = openModal({
    title: `Add ${DISCIPLINES[discipline].label.toLowerCase()} item`, eyebrow: `${space.code} · ${space.name}`, size: 'lg', body: body(),
    onMount(el, close) {
      const refresh = () => { el.querySelector('[data-list]').innerHTML = list(); FileService.hydrate(el); };
      FileService.hydrate(el);
      el.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { state.q = e.target.value; refresh(); } });
      el.addEventListener('change', (e) => { if (e.target.matches('[data-all]')) { state.all = e.target.checked; refresh(); } });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-t]');
        if (t) {
          if (t.dataset.t === 'custom') { close(); return createCustom(); }
          state.tab = t.dataset.t;
          el.querySelectorAll('[data-tabs] button').forEach((b) => b.classList.toggle('active', b === t));
          return refresh();
        }
        const ps = e.target.closest('[data-pick-spec]');
        if (ps) { close(); return quantityStep(db.get('specs', ps.dataset.pickSpec), space); }
        const pl = e.target.closest('[data-pick-lib]');
        if (pl) {
          close();
          const lib = db.get('library', pl.dataset.pickLib);
          let spec = db.find('specs', (s) => s.projectId === projectId && s.libraryId === lib.id);
          if (spec) toast(`Using existing project specification ${spec.code}`);
          else {
            const disc = state.all ? (LIB_CAT_MAP[lib.category]?.discipline || discipline) : discipline;
            spec = SpecService.create(projectId, { libraryId: lib.id, discipline: disc });
            toast(`Created ${spec.code} from ${lib.code}`);
          }
          return quantityStep(spec, space);
        }
      });
    },
  });
  void m;

  function createCustom() {
    openSpecEditor({
      mode: 'spec', title: 'New custom item', eyebrow: 'Project-specific specification', discipline, projectId,
      data: { unit: DISCIPLINES[discipline].unit },
      onSave({ data, discipline: disc, code }) {
        if (code && SpecService.byCode(code)) { toast(`Code ${code} is already used.`, { error: true }); return false; }
        const spec = SpecService.create(projectId, { discipline: disc, data, code });
        setTimeout(() => quantityStep(spec, space), 50);
      },
    });
  }
}

/** From a spec page: assign to several spaces at once. */
export function assignSpecToSpaces(specId) {
  const spec = db.get('specs', specId);
  const spaces = ProjectService.spaces(spec.projectId);
  const floors = Object.fromEntries(ProjectService.floors(spec.projectId).map((f) => [f.id, f]));
  const defMeasure = spec.discipline === 'walls' ? 'net_wall_area' : spec.discipline === 'ceiling' ? 'ceiling_area' : 'floor_area';
  const areaBased = ['flooring', 'walls', 'ceiling'].includes(spec.discipline);
  const body = `
    <p class="muted small">Tick the spaces where <b>${esc(spec.code)} ${esc(spec.data.name)}</b> is used. Area-based items can link quantity to the room measurement so totals update automatically.</p>
    <div class="table-wrap"><table class="tbl compact"><thead><tr><th></th><th>Space</th><th>Quantity</th><th>Unit</th></tr></thead><tbody>
    ${spaces.map((s) => {
      const has = SpecService.applications({ specId, spaceId: s.id }).length;
      const res = resolveMeasures(s.measure);
      const mv = res[defMeasure]?.value;
      return `<tr><td style="width:30px"><input type="checkbox" data-sp="${s.id}" ${has ? 'disabled checked' : ''}/></td>
        <td><b>${esc(s.code)}</b> ${esc(s.name)}<div class="tiny muted">${esc(floors[s.floorId]?.name || '')}${has ? ' · already assigned' : ''}</div></td>
        <td style="width:220px">${areaBased ? `<select class="select sm" data-qm="${s.id}" ${has ? 'disabled' : ''}><option value="measure">Linked: ${mv != null ? fmtNum(mv) : '—'} (+5%)</option><option value="manual">Manual…</option></select><input class="input sm num mt-4 hidden" data-qv="${s.id}" type="number" step="any" placeholder="Qty"/>` : `<input class="input sm num" data-qv="${s.id}" type="number" step="any" value="1" ${has ? 'disabled' : ''}/>`}</td>
        <td class="tiny">${esc(spec.data.unit || '')}</td></tr>`;
    }).join('')}
    </tbody></table></div>`;
  openModal({
    title: 'Assign to spaces', eyebrow: spec.code, size: 'lg', body,
    actions: [{ label: 'Cancel', action: 'cancel' }, { label: 'Assign', action: 'ok', kind: 'primary' }],
    onMount(el) {
      el.addEventListener('change', (e) => {
        if (e.target.matches('[data-qm]')) el.querySelector(`[data-qv="${e.target.dataset.qm}"]`).classList.toggle('hidden', e.target.value !== 'manual');
      });
    },
    onAction(id, el) {
      let n = 0;
      db.batch(() => {
        el.querySelectorAll('[data-sp]:checked:not(:disabled)').forEach((cb) => {
          const sid = cb.dataset.sp;
          const qm = el.querySelector(`[data-qm="${sid}"]`);
          const qv = toNum(el.querySelector(`[data-qv="${sid}"]`)?.value);
          if (qm && qm.value === 'measure') SpecService.addApplication(specId, sid, { qtyMode: 'measure', measureKey: defMeasure, wastePct: 5 });
          else SpecService.addApplication(specId, sid, { quantity: qv ?? 1 });
          n++;
        });
      });
      if (n) toast(`Assigned to ${n} space${n > 1 ? 's' : ''}`);
    },
  });
}
