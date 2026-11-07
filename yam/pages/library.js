// Global Material & Product Library — browse, search, filter, create.
import { esc, matches } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { pageHead, codeTag, swatch, empty } from '../components/ui.js';
import { toast } from '../components/toast.js';
import { openSpecEditor } from '../components/spec-form.js';
import { LibraryService } from '../services/library-service.js';
import { LIB_CATEGORIES, LIB_CAT_MAP } from '../data/models.js';
import { navigate } from '../core/router.js';

const state = { q: '', cat: '', archived: false, view: 'grid', kind: '' };

export function meta() { return { title: 'Material & Product Library', crumbs: [['Library']] }; }

export function newLibraryItem(category = 'flooring') {
  openSpecEditor({
    mode: 'library', title: 'New library record', eyebrow: 'Material & Product Library', category,
    onSave({ data, category: cat }) {
      const item = LibraryService.create(cat, data);
      toast(`${item.code} created`);
      navigate(`/library/${item.id}`);
    },
  });
}

export function render(root, ctx) {
  if (ctx.query.cat && LIB_CAT_MAP[ctx.query.cat]) state.cat = ctx.query.cat;
  const active = LibraryService.query({ archived: state.archived });
  const items = active.filter((l) => (!state.cat || l.category === state.cat) && (!state.kind || l.kind === state.kind) &&
    matches([l.code, l.data.name, l.data.manufacturer, l.data.brand, l.data.reference, l.data.colour, l.data.finish, l.data.description, l.data.supplier?.name], state.q));

  root.innerHTML = `
    ${pageHead({ eyebrow: 'Global & reusable', title: 'Material & Product Library', lead: 'Reusable records with global codes (MAT- materials, PRD- products). Selecting an item in a project creates a project specification snapshot.', actions: `<button class="btn btn-primary" data-action="new">${icon('plus')}New record</button>` })}
    <div class="lib-layout">
      <nav class="lib-cats" aria-label="Categories">
        <button class="${!state.cat ? 'active' : ''}" data-cat=""><span>All categories</span><span class="n">${active.length}</span></button>
        ${LIB_CATEGORIES.map((c) => `<button class="${state.cat === c.key ? 'active' : ''}" data-cat="${c.key}"><span>${esc(c.label)}</span><span class="n">${active.filter((l) => l.category === c.key).length}</span></button>`).join('')}
      </nav>
      <div style="min-width:0">
        <div class="row wrap gap-8 mb-16">
          <div class="searchbox grow" style="max-width:380px">${icon('search')}<input class="input" id="lq" placeholder="Search code, name, manufacturer, reference…" value="${esc(state.q)}"/></div>
          <select class="select" id="lk" style="width:auto"><option value="">Materials & products</option><option value="material" ${state.kind === 'material' ? 'selected' : ''}>Materials (MAT)</option><option value="product" ${state.kind === 'product' ? 'selected' : ''}>Products (PRD)</option></select>
          <div class="seg"><button data-arch="0" class="${!state.archived ? 'active' : ''}">Active</button><button data-arch="1" class="${state.archived ? 'active' : ''}">Archived</button></div>
          <span class="grow"></span>
          <div class="seg"><button data-view="grid" class="${state.view === 'grid' ? 'active' : ''}" aria-label="Grid view">${icon('grid').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-3px"')}</button><button data-view="list" class="${state.view === 'list' ? 'active' : ''}" aria-label="List view">${icon('list').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-3px"')}</button></div>
        </div>
        ${!items.length ? empty({ title: 'No records', text: state.q || state.cat ? 'Try another search or category.' : 'Add your first material or product.', action: '<button class="btn btn-primary" data-action="new">New record</button>' })
          : state.view === 'grid'
            ? `<div class="lgrid">${items.map((l) => `<a class="lcard ${l.archived ? 'archived' : ''}" href="#/library/${l.id}">
                <div class="media">${(l.data.imageIds || [])[0] ? `<img data-file="${esc(l.data.imageIds[0])}" alt=""/>` : icon('image')}</div>
                <div class="body"><div class="row between">${codeTag(l.code, true)}<span class="tiny muted truncate">${esc(LIB_CAT_MAP[l.category]?.label || '')}</span></div>
                <div class="nm">${esc(l.data.name)}</div><div class="mf truncate">${swatch(l.data.colourHex)} ${esc(l.data.manufacturer || '—')}</div></div></a>`).join('')}</div>`
            : `<div class="table-wrap"><table class="tbl stack"><thead><tr><th></th><th>Code</th><th>Name</th><th>Category</th><th>Manufacturer</th><th>Reference</th><th>Colour / finish</th><th>Used in</th></tr></thead><tbody>
              ${items.map((l) => { const u = LibraryService.usage(l.id); return `<tr class="clickable" data-href="/library/${l.id}"><td class="thumb-cell"><span class="thumb">${(l.data.imageIds || [])[0] ? `<img data-file="${esc(l.data.imageIds[0])}" alt=""/>` : ''}</span></td>
                <td data-label="Code">${codeTag(l.code, true)}</td><td data-label="Name" class="no-label"><b>${esc(l.data.name)}</b></td><td data-label="Category" class="small">${esc(LIB_CAT_MAP[l.category]?.label || '')}</td>
                <td data-label="Manufacturer" class="small">${esc(l.data.manufacturer || '')}</td><td data-label="Reference" class="small mono">${esc(l.data.reference || '')}</td>
                <td data-label="Colour / finish" class="small">${swatch(l.data.colourHex)} ${esc([l.data.colour, l.data.finish].filter(Boolean).join(' · '))}</td>
                <td data-label="Used in" class="small">${u.length ? `${u.length} project spec(s)` : '<span class="faint">—</span>'}</td></tr>`; }).join('')}
              </tbody></table></div>`}
      </div>
    </div>`;

  root.querySelector('#lq').addEventListener('input', (e) => { state.q = e.target.value; ctx.rerender(); });
  root.querySelector('#lk').addEventListener('change', (e) => { state.kind = e.target.value; ctx.rerender(); });
  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) { state.cat = c.dataset.cat; ctx.navigate(state.cat ? `/library?cat=${state.cat}` : '/library'); return; }
    const ar = e.target.closest('[data-arch]');
    if (ar) { state.archived = ar.dataset.arch === '1'; ctx.rerender(); return; }
    const v = e.target.closest('[data-view]');
    if (v) { state.view = v.dataset.view; ctx.rerender(); return; }
    if (e.target.closest('[data-action="new"]')) return newLibraryItem(state.cat || 'flooring');
    const tr = e.target.closest('tr[data-href]');
    if (tr) navigate(tr.dataset.href);
  });
}
