// Project specifications register (ZED-FL-01…) grouped by discipline.
import { esc, matches } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { codeTag, statusBadge, thumb, qtyText, swatch, empty } from '../components/ui.js';
import { projectHeader, projectMeta } from '../components/project-ui.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { openSpecEditor } from '../components/spec-form.js';
import { ProjectService } from '../services/project-service.js';
import { SpecService } from '../services/spec-service.js';
import { LibraryService } from '../services/library-service.js';
import { FileService } from '../services/file-service.js';
import { DISCIPLINES, LIB_CAT_MAP, SPEC_STATUSES } from '../data/models.js';
import { navigate } from '../core/router.js';

const state = { q: '', status: '', disc: '' };

export function meta(ctx) { return projectMeta(ctx, 'Specifications'); }

export function newSpecDialog(projectId, discipline = 'flooring') {
  let q = '';
  const list = () => {
    const items = LibraryService.query({ q }).slice(0, 80);
    return `<div class="file-list">${items.map((l) => {
      const ex = SpecService.forProject(projectId).find((s) => s.libraryId === l.id);
      return `<div class="file-row" style="cursor:pointer" data-lib="${l.id}">${thumb((l.data.imageIds || [])[0])}<div class="grow"><div class="row gap-4">${codeTag(l.code, true)}<span class="tiny muted">${esc(LIB_CAT_MAP[l.category]?.label)}</span></div><div class="strong mt-4">${esc(l.data.name)}</div><div class="tiny muted">${esc(l.data.manufacturer)}</div></div>${ex ? `<span class="badge plain">${esc(ex.code)}</span>` : ''}</div>`;
    }).join('') || '<div class="empty sm">No match.</div>'}</div>`;
  };
  openModal({
    title: 'New project specification', size: 'lg',
    body: `<div class="row between wrap gap-12 mb-16"><p class="small muted" style="margin:0">Select a library item — its data is copied into the project as a snapshot — or create a custom project-only item.</p><button class="btn" data-custom>${icon('plus')}Custom item</button></div>
      <div class="searchbox mb-12">${icon('search')}<input class="input" data-q placeholder="Search library…"/></div><div data-list style="max-height:55vh;overflow:auto">${list()}</div>`,
    onMount(el, close) {
      FileService.hydrate(el);
      el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; el.querySelector('[data-list]').innerHTML = list(); FileService.hydrate(el); });
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-custom]')) {
          close();
          openSpecEditor({
            mode: 'spec', title: 'New custom specification', discipline, projectId, data: { unit: DISCIPLINES[discipline].unit },
            onSave({ data, discipline: d, code }) {
              if (code && SpecService.byCode(code)) { toast(`Code ${code} is already used.`, { error: true }); return false; }
              const s = SpecService.create(projectId, { discipline: d, data, code });
              toast(`${s.code} created`);
              navigate(`/projects/${projectId}/specs/${s.id}`);
            },
          });
          return;
        }
        const r = e.target.closest('[data-lib]');
        if (!r) return;
        close();
        const lib = LibraryService.get(r.dataset.lib);
        const ex = SpecService.forProject(projectId).find((s) => s.libraryId === lib.id);
        if (ex) { toast(`Already specified as ${ex.code}`); navigate(`/projects/${projectId}/specs/${ex.id}`); return; }
        const s = SpecService.create(projectId, { libraryId: lib.id });
        toast(`${s.code} created from ${lib.code}`);
        navigate(`/projects/${projectId}/specs/${s.id}`);
      });
    },
  });
}

export function render(root, ctx) {
  const p = ProjectService.get(ctx.params.pid);
  if (ctx.query.d && state.disc !== ctx.query.d) state.disc = ctx.query.d;
  const all = SpecService.forProject(p.id);
  const list = all.filter((s) => (!state.status || s.status === state.status) && (!state.disc || s.discipline === state.disc) &&
    matches([s.code, s.libraryCode, s.data.name, s.data.manufacturer, s.data.reference, s.data.colour, s.data.finish], state.q));
  const groups = Object.keys(DISCIPLINES).map((k) => [k, list.filter((s) => s.discipline === k)]).filter(([, l]) => l.length);

  root.innerHTML = `
    ${projectHeader(p, 'specs', { actions: `<a class="btn" href="#/export/board/${p.id}">${icon('board')}Material board</a><button class="btn btn-primary" data-action="new">${icon('plus')}New specification</button>` })}
    <div class="row wrap gap-12 mb-24">
      <div class="searchbox grow" style="max-width:360px">${icon('search')}<input class="input" id="sq" placeholder="Search code, name, manufacturer…" value="${esc(state.q)}"/></div>
      <select class="select" id="sd" style="width:auto"><option value="">All disciplines</option>${Object.entries(DISCIPLINES).map(([k, d]) => `<option value="${k}" ${state.disc === k ? 'selected' : ''}>${esc(d.label)} (${all.filter((s) => s.discipline === k).length})</option>`).join('')}</select>
      <div class="chips">${['', ...SPEC_STATUSES.map((s) => s.key)].map((k) => `<button class="chip ${state.status === k ? 'active' : ''}" data-st="${k}">${k ? esc(SPEC_STATUSES.find((x) => x.key === k).label) : 'All'} <span class="n">${k ? all.filter((s) => s.status === k).length : all.length}</span></button>`).join('')}</div>
    </div>
    ${groups.length ? groups.map(([k, specs]) => `
      <div class="rule-title"><span class="code-tag">${DISCIPLINES[k].prefix}</span><span class="h3">${esc(DISCIPLINES[k].label)}</span><span class="tiny muted">${specs.length}</span></div>
      <div class="table-wrap"><table class="tbl stack">
        <thead><tr><th></th><th>Code</th><th>Specification</th><th>Colour / finish</th><th>Spaces</th><th class="num">Total quantity</th><th>Status</th><th>Rev.</th></tr></thead>
        <tbody>${specs.map((s) => {
          const apps = SpecService.applications({ specId: s.id });
          const out = SpecService.libraryOutdated(s);
          return `<tr class="clickable" data-href="/projects/${p.id}/specs/${s.id}">
            <td class="thumb-cell">${thumb((s.data.imageIds || [])[0])}</td>
            <td data-label="Code">${codeTag(s.code)}${s.libraryCode ? `<div class="mt-4">${codeTag(s.libraryCode, true)}</div>` : '<div class="tiny faint mt-4">Custom</div>'}</td>
            <td data-label="Specification" class="no-label"><div class="strong">${esc(s.data.name)}</div><div class="sub">${esc([s.data.manufacturer, s.data.reference].filter(Boolean).join(' · '))}</div>${out ? '<div class="tiny" style="color:var(--warn)">Library record changed</div>' : ''}</td>
            <td data-label="Colour / finish" class="small">${swatch(s.data.colourHex)} ${esc([s.data.colour, s.data.finish].filter(Boolean).join(' · ') || '—')}</td>
            <td data-label="Spaces" class="small">${apps.length ? `${new Set(apps.map((a) => a.spaceId)).size}` : '<span class="faint">Not assigned</span>'}</td>
            <td data-label="Total" class="num small">${qtyText(SpecService.totals(s.id))}</td>
            <td data-label="Status">${statusBadge(s.status)}</td>
            <td data-label="Rev." class="mono small">R${String(s.rev).padStart(2, '0')}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`).join('')
      : empty({ title: all.length ? 'No specifications match' : 'No specifications yet', text: all.length ? 'Adjust the filters.' : 'Create specifications from the library or as custom items, then assign them to spaces.', action: '<button class="btn btn-primary" data-action="new">New specification</button>' })}`;

  root.querySelector('#sq').addEventListener('input', (e) => { state.q = e.target.value; ctx.rerender(); });
  root.querySelector('#sd').addEventListener('change', (e) => { state.disc = e.target.value; ctx.navigate(`/projects/${p.id}/specs${state.disc ? '?d=' + state.disc : ''}`, { replace: true }); });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="new"]')) return newSpecDialog(p.id, state.disc || 'flooring');
    const st = e.target.closest('[data-st]');
    if (st) { state.status = st.dataset.st; ctx.rerender(); return; }
    const tr = e.target.closest('tr[data-href]');
    if (tr) navigate(tr.dataset.href);
  });
}
