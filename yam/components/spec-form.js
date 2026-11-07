// Shared editor for library items and project specifications (same `data` shape).
import { esc, clone, toNum, uid } from '../core/utils.js';
import { icon } from './icons.js';
import { openModal, fieldHtml } from './modal.js';
import { toast } from './toast.js';
import { pickFiles, ACCEPT_IMAGES, ACCEPT_DOCS } from './files-ui.js';
import { FileService, isImage, extOf } from '../services/file-service.js';
import { ATTR_PROFILES, LIB_CATEGORIES, LIB_CAT_MAP, DISCIPLINES, UNITS, CURRENCIES, newSpecData } from '../data/models.js';
import { currency as defaultCurrency } from '../services/settings-service.js';

function attrsHtml(profile, attrs = {}) {
  const defs = ATTR_PROFILES[profile] || [];
  if (!defs.length) return '<div class="tiny faint">No discipline-specific attributes for this category.</div>';
  return `<div class="form-grid three">${defs.map((d) => fieldHtml({
    name: 'attr.' + d.key, label: d.label + (d.unit ? ` (${d.unit})` : ''), type: d.type === 'textarea' ? 'textarea' : d.type, value: attrs[d.key] ?? '',
    options: d.options ? ['', ...d.options] : undefined, full: d.type === 'textarea', rows: 2,
  })).join('')}</div>`;
}
function specRowsHtml(rows) {
  return rows.map((r, i) => `<div class="row gap-4 mb-8" data-specrow="${i}">
    <input class="input sm" style="flex:1" data-sk value="${esc(r.k)}" placeholder="Property (e.g. Fire class)"/>
    <input class="input sm" style="flex:1.4" data-sv value="${esc(r.v)}" placeholder="Value"/>
    <button type="button" class="btn btn-ghost btn-xs btn-icon" data-rmspec="${i}" title="Remove">${icon('x')}</button></div>`).join('');
}

/**
 * openSpecEditor({ mode:'library'|'spec', title, data, category, discipline, code, status, onSave })
 * onSave({ data, category, discipline, code, reason }) may be async; return false to keep open.
 */
export function openSpecEditor(opts) {
  const mode = opts.mode || 'spec';
  const d = { ...newSpecData(), ...clone(opts.data || {}) };
  d.supplier = { name: '', contact: '', phone: '', email: '', website: '', ...(d.supplier || {}) };
  d.attrs = { ...(d.attrs || {}) };
  let specs = clone(d.specs || []);
  let images = [...(d.imageIds || [])];
  let sheets = [...(d.datasheetIds || [])];
  let pendImg = []; // {key, file, url}
  let pendDoc = [];
  const profileOf = (val) => (mode === 'library' ? LIB_CAT_MAP[val]?.profile : DISCIPLINES[val]?.profile) || '';
  let profile = profileOf(mode === 'library' ? opts.category : opts.discipline);
  const approved = mode === 'spec' && opts.status === 'approved';

  const identity = `
    <div class="form-grid">
      ${fieldHtml({ name: 'name', label: 'Name', value: d.name, required: true, full: true, autofocus: true })}
      ${mode === 'library'
        ? fieldHtml({ name: '_category', label: 'Category', type: 'select', value: opts.category || 'flooring', options: LIB_CATEGORIES.map((c) => [c.key, `${c.label} (${c.kind === 'product' ? 'PRD' : 'MAT'})`]) })
        : fieldHtml({ name: '_discipline', label: 'Discipline / schedule', type: 'select', value: opts.discipline || 'general', options: Object.entries(DISCIPLINES).map(([k, v]) => [k, `${v.label} (${v.prefix})`]) })}
      ${mode === 'spec' ? fieldHtml({ name: '_code', label: 'Project code', value: opts.code || '', hint: 'Leave blank to auto-number.' }) : fieldHtml({ name: '_code', label: 'Global code', value: opts.code || 'Assigned on save', hint: 'MAT for materials, PRD for products.' }).replace('<input', '<input disabled')}
      ${fieldHtml({ name: 'manufacturer', label: 'Manufacturer / fabricator', value: d.manufacturer })}
      ${fieldHtml({ name: 'brand', label: 'Brand / collection', value: d.brand })}
      ${fieldHtml({ name: 'reference', label: 'Product reference', value: d.reference })}
      ${fieldHtml({ name: 'dimensions', label: 'Dimensions', value: d.dimensions })}
      <div class="field"><label>Colour</label><div class="row gap-4"><input class="input" name="colour" value="${esc(d.colour)}" style="flex:1"/>
        <input type="color" name="colourHex" value="${esc(d.colourHex || '#d9cfc0')}" title="Swatch colour" style="width:40px;height:34px;border:1px solid var(--line-2);border-radius:2px;padding:2px;background:var(--surface)"/>
        <label class="check tiny" title="No swatch"><input type="checkbox" name="noHex" ${d.colourHex ? '' : 'checked'}/>none</label></div></div>
      ${fieldHtml({ name: 'finish', label: 'Finish', value: d.finish })}
      ${fieldHtml({ name: 'description', label: 'Description', type: 'textarea', value: d.description, full: true })}
    </div>`;

  const body = `
    ${approved ? `<div class="notice warn mb-16">${icon('history')}<div><b>This specification is approved.</b> Saving data changes will freeze the current revision with its approval evidence, create a new draft revision and require re-approval.</div></div>` : ''}
    <form onsubmit="return false" class="col gap-16">
      <div class="eyebrow">Identity</div>${identity}
      <div class="rule-title" style="margin:8px 0 0"><span class="eyebrow">Technical attributes</span></div>
      <div data-attrs>${attrsHtml(profile, d.attrs)}</div>
      <div class="rule-title" style="margin:8px 0 0"><span class="eyebrow">Technical specifications</span></div>
      <div><div data-specrows>${specRowsHtml(specs)}</div><button type="button" class="btn btn-sm" data-addspec>${icon('plus')}Add property</button></div>
      <div class="rule-title" style="margin:8px 0 0"><span class="eyebrow">Images & datasheets</span></div>
      <div class="grid g-2">
        <div><div class="label tiny muted mb-8">REFERENCE IMAGES</div><div data-imgs></div></div>
        <div><div class="label tiny muted mb-8">DATASHEETS / DRAWINGS</div><div data-docs></div></div>
      </div>
      <div class="rule-title" style="margin:8px 0 0"><span class="eyebrow">Supplier & pricing</span></div>
      <div class="form-grid three">
        ${fieldHtml({ name: 'supplier.name', label: 'Supplier', value: d.supplier.name })}
        ${fieldHtml({ name: 'supplier.contact', label: 'Contact person', value: d.supplier.contact })}
        ${fieldHtml({ name: 'supplier.phone', label: 'Phone', value: d.supplier.phone })}
        ${fieldHtml({ name: 'supplier.email', label: 'Email', value: d.supplier.email })}
        ${fieldHtml({ name: 'supplier.website', label: 'Website', value: d.supplier.website })}
        ${fieldHtml({ name: 'unit', label: 'Default unit', type: 'select', value: d.unit || '', options: ['', ...UNITS] })}
        ${fieldHtml({ name: 'unitPrice', label: 'Unit price (optional)', type: 'number', value: d.unitPrice ?? '' })}
        ${fieldHtml({ name: 'currency', label: 'Currency', type: 'select', value: d.currency || defaultCurrency(), options: CURRENCIES })}
      </div>
      ${fieldHtml({ name: 'notes', label: 'Notes', type: 'textarea', value: d.notes })}
      ${approved ? fieldHtml({ name: '_reason', label: 'Reason for change (recorded in revision history)', type: 'textarea', rows: 2, value: '' }) : mode === 'spec' && opts.existing ? fieldHtml({ name: '_reason', label: 'Change note (optional)', value: '' }) : ''}
    </form>`;

  const renderImgs = (el) => {
    const box = el.querySelector('[data-imgs]');
    box.innerHTML = `<div class="gallery" style="grid-template-columns:repeat(auto-fill,minmax(84px,1fr))">
      ${images.map((id) => `<div class="item"><div class="media" style="aspect-ratio:1"><img data-file="${esc(id)}" alt=""/></div><button type="button" class="btn btn-xs btn-icon del" data-rmimg="${esc(id)}">${icon('x')}</button></div>`).join('')}
      ${pendImg.map((p) => `<div class="item"><div class="media" style="aspect-ratio:1"><img src="${p.url}" alt=""/></div><button type="button" class="btn btn-xs btn-icon del" data-rmpend="${p.key}">${icon('x')}</button></div>`).join('')}
      <button type="button" class="add" data-addimg>${icon('upload')}<span>Add</span></button></div>`;
    FileService.hydrate(box);
  };
  const renderDocs = (el) => {
    const box = el.querySelector('[data-docs]');
    const rows = [
      ...sheets.map((id) => { const m = FileService.get(id); return m ? `<div class="file-row"><span class="ico">${esc(extOf(m))}</span><span class="grow truncate">${esc(m.name)}</span><button type="button" class="btn btn-ghost btn-xs btn-icon" data-rmdoc="${esc(id)}">${icon('x')}</button></div>` : ''; }),
      ...pendDoc.map((p) => `<div class="file-row"><span class="ico">NEW</span><span class="grow truncate">${esc(p.file.name)}</span><button type="button" class="btn btn-ghost btn-xs btn-icon" data-rmpdoc="${p.key}">${icon('x')}</button></div>`),
    ].join('');
    box.innerHTML = `${rows ? `<div class="file-list mb-8">${rows}</div>` : ''}<button type="button" class="btn btn-sm" data-adddoc>${icon('upload')}Attach file</button>`;
  };
  const syncSpecs = (el) => {
    specs = Array.from(el.querySelectorAll('[data-specrow]')).map((r) => ({ k: r.querySelector('[data-sk]').value, v: r.querySelector('[data-sv]').value }));
  };

  return openModal({
    title: opts.title || 'Edit', eyebrow: opts.eyebrow || '', size: 'lg', body,
    actions: [{ label: 'Cancel', action: 'cancel' }, { label: approved ? 'Save as new revision' : 'Save', action: 'save', kind: 'primary' }],
    onMount(el) {
      renderImgs(el); renderDocs(el);
      const sel = el.querySelector('[name="_category"], [name="_discipline"]');
      sel.addEventListener('change', () => {
        const cur = {};
        el.querySelectorAll('[name^="attr."]').forEach((i) => { cur[i.name.slice(5)] = i.value; });
        Object.assign(d.attrs, cur);
        profile = profileOf(sel.value);
        el.querySelector('[data-attrs]').innerHTML = attrsHtml(profile, d.attrs);
        const unitSel = el.querySelector('[name="unit"]');
        if (mode === 'spec' && !unitSel.value) unitSel.value = DISCIPLINES[sel.value]?.unit || '';
      });
      el.addEventListener('click', async (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.hasAttribute('data-addspec')) { syncSpecs(el); specs.push({ k: '', v: '' }); el.querySelector('[data-specrows]').innerHTML = specRowsHtml(specs); }
        else if (t.dataset.rmspec != null) { syncSpecs(el); specs.splice(+t.dataset.rmspec, 1); el.querySelector('[data-specrows]').innerHTML = specRowsHtml(specs); }
        else if (t.hasAttribute('data-addimg')) {
          const files = await pickFiles({ accept: ACCEPT_IMAGES });
          for (const f of files) if (/^image\//.test(f.type)) pendImg.push({ key: uid('p'), file: f, url: URL.createObjectURL(f) });
          renderImgs(el);
        } else if (t.dataset.rmimg) { images = images.filter((x) => x !== t.dataset.rmimg); renderImgs(el); }
        else if (t.dataset.rmpend) { pendImg = pendImg.filter((x) => x.key !== t.dataset.rmpend); renderImgs(el); }
        else if (t.hasAttribute('data-adddoc')) {
          const files = await pickFiles({ accept: ACCEPT_DOCS });
          for (const f of files) pendDoc.push({ key: uid('p'), file: f });
          renderDocs(el);
        } else if (t.dataset.rmdoc) { sheets = sheets.filter((x) => x !== t.dataset.rmdoc); renderDocs(el); }
        else if (t.dataset.rmpdoc) { pendDoc = pendDoc.filter((x) => x.key !== t.dataset.rmpdoc); renderDocs(el); }
      });
    },
    async onAction(id, el) {
      if (id !== 'save') return;
      const v = {};
      el.querySelectorAll('form [name]').forEach((i) => { v[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
      if (!v.name.trim()) { el.querySelector('[name="name"]').classList.add('invalid'); el.querySelector('[name="name"]').focus(); return false; }
      if (approved && !String(v._reason || '').trim()) {
        const r = el.querySelector('[name="_reason"]'); r.classList.add('invalid'); r.focus();
        toast('Please record a reason for changing an approved specification.', { error: true });
        return false;
      }
      syncSpecs(el);
      let newImgIds = [], newDocIds = [];
      try {
        newImgIds = (await Promise.all(pendImg.map((p) => FileService.add(p.file, { name: p.file.name, kind: 'image', projectId: opts.projectId || null })))).map((m) => m.id);
        newDocIds = (await Promise.all(pendDoc.map((p) => FileService.add(p.file, { name: p.file.name, kind: isImage({ type: p.file.type }) ? 'drawing' : 'datasheet', projectId: opts.projectId || null })))).map((m) => m.id);
      } catch (err) { toast(err.message, { error: true }); return false; }
      const attrs = { ...d.attrs };
      el.querySelectorAll('[name^="attr."]').forEach((i) => { const def = (ATTR_PROFILES[profile] || []).find((x) => x.key === i.name.slice(5)); attrs[i.name.slice(5)] = def && def.type === 'number' ? toNum(i.value) : i.value; });
      const data = {
        ...d,
        name: v.name.trim(), manufacturer: v.manufacturer, brand: v.brand, reference: v.reference, dimensions: v.dimensions,
        colour: v.colour, colourHex: v.noHex ? '' : v.colourHex, finish: v.finish, description: v.description,
        attrs, specs: specs.filter((s) => s.k || s.v),
        supplier: { name: v['supplier.name'], contact: v['supplier.contact'], phone: v['supplier.phone'], email: v['supplier.email'], website: v['supplier.website'] },
        unit: v.unit, unitPrice: toNum(v.unitPrice), currency: v.currency, notes: v.notes,
        imageIds: [...images, ...newImgIds], datasheetIds: [...sheets, ...newDocIds],
      };
      pendImg.forEach((p) => URL.revokeObjectURL(p.url));
      const r = await opts.onSave({ data, category: v._category, discipline: v._discipline, code: (v._code || '').trim(), reason: v._reason || '' });
      // release files that were removed from the record (if nothing else references them)
      for (const fid of [...(d.imageIds || []), ...(d.datasheetIds || [])]) if (!data.imageIds.includes(fid) && !data.datasheetIds.includes(fid)) FileService.collect(fid);
      return r;
    },
  });
}
