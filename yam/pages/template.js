// Room template editor. Edits are kept as a draft until saved; saving bumps the version.
import { esc, clone } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { TemplateService } from '../services/template-service.js';
import { SECTION_MAP, UNITS } from '../data/models.js';
import { validateFormula } from '../services/measurement-service.js';
import { navigate } from '../core/router.js';

let draft = null;
let draftFor = null;

export function meta(ctx) {
  const t = TemplateService.get(ctx.params.id);
  if (!t) return { redirect: '/templates' };
  return { title: t.name, crumbs: [['Room Templates', '/templates'], [t.name]] };
}
export const manualRender = true; // don't wipe the unsaved draft on unrelated data changes

const TYPES = [['text', 'Text'], ['number', 'Number'], ['textarea', 'Long text'], ['select', 'Choice list']];

export function render(root, ctx) {
  const t = TemplateService.get(ctx.params.id);
  if (draftFor !== t.id + ':' + t.version || !draft) { draft = clone(t); draftFor = t.id + ':' + t.version; }
  const usage = TemplateService.usage(t.id);
  const dirty = JSON.stringify(draft) !== JSON.stringify(t);

  root.innerHTML = `
    <div class="page-head"><div class="titles"><div class="eyebrow">Room template · v${t.version}${t.builtIn ? ' · Built-in' : ''}</div>
      <input class="input h2" id="tname" value="${esc(draft.name)}" style="font-family:var(--f-display);font-size:30px;height:auto;padding:4px 8px;margin-top:6px;background:transparent;border-color:transparent"/>
      <input class="input mt-8" id="tdesc" value="${esc(draft.description || '')}" placeholder="Short description" style="max-width:560px"/></div>
      <div class="actions">${!t.builtIn ? `<button class="btn btn-danger" data-action="delete">${icon('trash')}Delete</button>` : ''}<button class="btn" data-action="revert" ${dirty ? '' : 'disabled'}>Discard changes</button><button class="btn btn-primary" data-action="save" ${dirty ? '' : 'disabled'}>${icon('check')}Save as v${t.version + 1}</button></div></div>
    <div class="notice info mb-24">${icon('info')}<div>Used by <b>${usage}</b> space(s). Saving creates version ${t.version + 1}. Existing spaces keep their own documentation; they will be <i>offered</i> any new fields, never changed automatically.</div></div>
    ${draft.sections.map((s, si) => `
      <div class="tpl-sec">
        <div class="tpl-sec-head"><span class="num">${SECTION_MAP[s.key].num}</span><label class="check grow"><input type="checkbox" data-sec-on="${si}" ${s.enabled ? 'checked' : ''} ${s.key === 'general' ? 'disabled' : ''}/> <b>${esc(SECTION_MAP[s.key].label)}</b></label><span class="tiny muted">${s.fields.length} field(s)</span>
          ${s.key !== 'measurements' && s.key !== 'documents' ? `<button class="btn btn-ghost btn-xs" data-add-field="${si}">${icon('plus')}Field</button>` : ''}</div>
        ${s.fields.length ? `<div class="tpl-sec-body">${s.fields.map((f, fi) => `<div class="tpl-field">
          <input class="input sm" data-f="${si}:${fi}:label" data-fk="tf:${si}:${fi}:l" value="${esc(f.label)}" placeholder="Field label"/>
          <select class="select sm" data-f="${si}:${fi}:type" data-fk="tf:${si}:${fi}:t">${TYPES.map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <input class="input sm" data-f="${si}:${fi}:options" data-fk="tf:${si}:${fi}:o" value="${esc((f.options || []).join(', '))}" placeholder="${f.type === 'select' ? 'Choices, comma separated' : '—'}" ${f.type === 'select' ? '' : 'disabled'}/>
          <span class="row gap-4"><button class="btn btn-ghost btn-xs btn-icon" data-mv="${si}:${fi}:-1" title="Move up">${icon('chevronUp')}</button><button class="btn btn-ghost btn-xs btn-icon" data-mv="${si}:${fi}:1" title="Move down">${icon('chevronDown')}</button><button class="btn btn-ghost btn-xs btn-icon" data-rm="${si}:${fi}" title="Remove">${icon('x')}</button></span>
        </div>`).join('')}</div>` : ''}
        ${s.key === 'measurements' ? `<div class="tpl-sec-body"><div class="tiny muted mb-8">Standard measurements are always included. Add template-level custom measurements:</div>
          ${(draft.customMeasures || []).map((m, mi) => `<div class="tpl-field"><input class="input sm" data-cm="${mi}:label" data-fk="cm:${mi}:l" value="${esc(m.label)}"/><select class="select sm" data-cm="${mi}:unit" data-fk="cm:${mi}:u">${UNITS.map((u) => `<option ${u === m.unit ? 'selected' : ''}>${u}</option>`).join('')}</select><input class="input sm" data-cm="${mi}:formula" data-fk="cm:${mi}:f" value="${esc(m.formula || '')}" placeholder="Formula (optional), e.g. {perimeter} * 1.2"/><button class="btn btn-ghost btn-xs btn-icon" data-cmrm="${mi}">${icon('x')}</button></div>`).join('')}
          <button class="btn btn-xs mt-8" data-cm-add>${icon('plus')}Custom measurement</button></div>` : ''}
      </div>`).join('')}`;

  const rerender = () => ctx.rerender();
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'tname') draft.name = el.value;
    if (el.id === 'tdesc') draft.description = el.value;
    if (el.dataset.f) {
      const [si, fi, k] = el.dataset.f.split(':');
      const f = draft.sections[si].fields[fi];
      if (k === 'options') f.options = el.value.split(',').map((x) => x.trim()).filter(Boolean);
      else f[k] = el.value;
    }
    if (el.dataset.cm) { const [mi, k] = el.dataset.cm.split(':'); draft.customMeasures[mi][k] = el.value; draft.customMeasures[mi].mode = draft.customMeasures[mi].formula ? 'formula' : 'manual'; }
    root.querySelector('[data-action="save"]').disabled = false;
    root.querySelector('[data-action="revert"]').disabled = false;
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.secOn) { draft.sections[e.target.dataset.secOn].enabled = e.target.checked; rerender(); }
    if (e.target.dataset.f && e.target.dataset.f.endsWith(':type')) rerender();
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.addField) { const s = draft.sections[b.dataset.addField]; s.fields.push({ key: 'f_' + Date.now().toString(36), label: 'New field', type: 'text' }); return rerender(); }
    if (b.dataset.rm) { const [si, fi] = b.dataset.rm.split(':'); draft.sections[si].fields.splice(+fi, 1); return rerender(); }
    if (b.dataset.mv) { const [si, fi, d] = b.dataset.mv.split(':').map(Number); const arr = draft.sections[si].fields; const j = fi + d; if (j >= 0 && j < arr.length) [arr[fi], arr[j]] = [arr[j], arr[fi]]; return rerender(); }
    if (b.hasAttribute('data-cm-add')) { draft.customMeasures = draft.customMeasures || []; draft.customMeasures.push({ key: 'c_' + Date.now().toString(36), label: 'Custom measurement', unit: 'm²', mode: 'manual', formula: '' }); return rerender(); }
    if (b.dataset.cmrm) { draft.customMeasures.splice(+b.dataset.cmrm, 1); return rerender(); }
    const act = b.dataset.action;
    if (act === 'revert') { draft = clone(t); return rerender(); }
    if (act === 'save') {
      if (!draft.name.trim()) return toast('Template name is required', { error: true });
      for (const m of draft.customMeasures || []) {
        if (m.formula) { const err = validateFormula(m.formula, ['floor_area', 'ceiling_area', 'perimeter', 'ceiling_height', 'gross_wall_area', 'openings_area', 'net_wall_area', 'skirting_length', ...draft.customMeasures.map((x) => x.key)]); if (err) return toast(`${m.label}: ${err}`, { error: true }); }
      }
      for (const s of draft.sections) s.fields = s.fields.filter((f) => f.label.trim());
      const d = clone(draft);
      TemplateService.update(t.id, (x) => { x.name = d.name.trim(); x.description = d.description; x.sections = d.sections; x.customMeasures = d.customMeasures || []; });
      draft = null;
      toast(`Saved as v${t.version + 1}`);
      ctx.rerender();
    }
    if (act === 'delete') {
      if (await confirmDialog({ title: 'Delete template?', danger: true, confirmText: 'Delete', message: `Delete <b>${esc(t.name)}</b>?`, detail: `${usage} existing space(s) keep their documentation; they will simply no longer receive template updates.` })) {
        TemplateService.remove(t.id); navigate('/templates'); toast('Template deleted');
      }
    }
  });
}
