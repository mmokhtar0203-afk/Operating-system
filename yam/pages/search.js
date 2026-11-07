// Global search results page.
import { esc, fmtNum } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { codeTag, statusBadge, thumb, swatch, qtyText, progress } from '../components/ui.js';
import { SearchService } from '../services/search-service.js';
import { SpecService } from '../services/spec-service.js';
import { spaceCompleteness } from '../services/completeness-service.js';
import { measureValue } from '../services/measurement-service.js';
import { FILE_KINDS, DISCIPLINES } from '../data/models.js';
import { setQuery } from '../core/router.js';

export function meta(ctx) { return { title: ctx.query.q ? `Search: ${ctx.query.q}` : 'Search', crumbs: [['Search']] }; }

function usedIn(list) {
  if (!list.length) return '<span class="tiny faint">Not assigned to any space</span>';
  return `<div class="used">${list.slice(0, 12).map((u) => `<a class="chip" href="#/projects/${u.space.projectId}/spaces/${u.space.id}">${u.project ? `<span class="n">${esc(u.project.code)}</span>` : ''}${esc(u.space.name)} <span class="n">${fmtNum(SpecService.effectiveQty(u.app))} ${esc(u.app.unit)}</span></a>`).join('')}${list.length > 12 ? `<span class="tiny muted">+${list.length - 12} more</span>` : ''}</div>`;
}

export function render(root, ctx) {
  const q = ctx.query.q || '';
  const r = SearchService.search(q);
  const sec = (title, n, body) => (n ? `<div class="rule-title"><span class="h3">${title}</span><span class="tiny muted">${n}</span></div>${body}` : '');

  root.innerHTML = `
    <div class="page-head"><div class="titles"><div class="eyebrow">Global search</div><h1 class="h1">Search</h1></div></div>
    <div class="searchbox mb-24" style="max-width:640px">${icon('search')}<input class="input" id="sq" type="search" value="${esc(q)}" placeholder="Room, project, material code (MAT-0001), project code (ZED-FL-01), product, category, document…" style="height:44px;font-size:15px;padding-left:34px" autofocus/></div>
    ${!q ? '<p class="muted">Try <a href="#/search?q=ZED-FL-01">ZED-FL-01</a>, <a href="#/search?q=MAT-0001">MAT-0001</a>, <a href="#/search?q=master%20bedroom">master bedroom</a>, <a href="#/search?q=lighting">lighting</a> or <a href="#/search?q=oak">oak</a>.</p>'
      : !r.total ? `<div class="empty"><div class="h3">No results for “${esc(q)}”</div><p>Check the spelling or search a code, product or room name.</p></div>` : ''}

    ${sec('Library items', r.library.length, r.library.map((x) => `<div class="sres">${thumb((x.item.data.imageIds || [])[0], { size: 'lg' })}<div class="grow">
      <div class="row gap-8">${codeTag(x.item.code, true)}<a href="#/library/${x.item.id}" class="strong">${esc(x.item.data.name)}</a></div>
      <div class="small muted mt-4">${swatch(x.item.data.colourHex)} ${esc([x.item.data.category, x.item.data.manufacturer, x.item.data.reference].filter(Boolean).join(' · '))}</div>
      ${x.specs.length ? `<div class="tiny muted mt-8">Specified as ${x.specs.map((s) => `<a href="#/projects/${s.projectId}/specs/${s.id}">${esc(s.code)}</a>`).join(', ')}</div>` : ''}
      ${usedIn(x.usedIn)}</div></div>`).join(''))}

    ${sec('Project specifications', r.specs.length, r.specs.map((x) => `<div class="sres">${thumb((x.item.data.imageIds || [])[0], { size: 'lg' })}<div class="grow">
      <div class="row wrap gap-8">${codeTag(x.item.code)}${x.item.libraryCode ? codeTag(x.item.libraryCode, true) : ''}<a href="#/projects/${x.item.projectId}/specs/${x.item.id}" class="strong">${esc(x.item.data.name)}</a>${statusBadge(x.item.status)}</div>
      <div class="small muted mt-4">${esc(x.project ? x.project.name : '')} · ${esc(DISCIPLINES[x.item.discipline]?.label)} · Total ${qtyText(SpecService.totals(x.item.id))}</div>
      ${usedIn(x.usedIn.map((u) => ({ ...u, project: x.project })))}</div></div>`).join(''))}

    ${sec('Spaces', r.spaces.length, r.spaces.map((x) => { const c = spaceCompleteness(x.item); return `<div class="sres"><span class="thumb lg">${x.item.coverImageId ? `<img data-file="${esc(x.item.coverImageId)}" alt=""/>` : icon('layers')}</span><div class="grow">
      <div class="row wrap gap-8"><a href="#/projects/${x.item.projectId}/spaces/${x.item.id}" class="strong">${esc(x.item.name)}</a><span class="tiny muted">${esc(x.item.code)} · ${esc(x.project?.name || '')} · ${fmtNum(measureValue(x.item, 'floor_area'))} m²</span><span style="width:120px">${progress(c.pct)}</span></div>
      ${x.specs.length ? `<div class="used">${x.specs.slice(0, 16).map((s) => `<a class="chip" href="#/projects/${s.projectId}/specs/${s.id}"><span class="n">${esc(s.code)}</span>${esc(s.data.name)}</a>`).join('')}</div>` : '<div class="tiny faint mt-8">No specifications yet</div>'}
      <div class="row gap-8 mt-8"><a class="btn btn-xs" href="#/projects/${x.item.projectId}/spaces/${x.item.id}">${icon('arrowRight')}Documentation</a><a class="btn btn-xs" href="#/export/room/${x.item.id}">${icon('sheet')}Room sheet</a></div></div></div>`; }).join(''))}

    ${sec('Projects', r.projects.length, r.projects.map((x) => `<div class="sres"><span class="thumb lg">${x.item.coverImageId ? `<img data-file="${esc(x.item.coverImageId)}" alt=""/>` : icon('projects')}</span><div class="grow"><div class="row gap-8">${codeTag(x.item.code)}<a class="strong" href="#/projects/${x.item.id}">${esc(x.item.name)}</a></div><div class="small muted mt-4">${esc(x.item.type)} · ${esc(x.item.client)} · ${esc(x.item.location)}</div></div></div>`).join(''))}

    ${sec('Categories', r.categories.length, `<div class="chips">${r.categories.map((x) => `<a class="chip" href="#/library?cat=${x.item.key}">${esc(x.item.label)} <span class="n">${x.count}</span></a>`).join('')}</div>`)}

    ${sec('Documents', r.files.length, r.files.map((x) => `<div class="sres"><span class="thumb lg">${/^image/.test(x.item.type) ? `<img data-file="${esc(x.item.id)}" alt=""/>` : icon('file')}</span><div class="grow"><a href="javascript:void 0" data-action="file-open" data-id="${x.item.id}" class="strong">${esc(x.item.name)}</a><div class="small muted mt-4">${esc(FILE_KINDS[x.item.kind] || x.item.kind)}${x.project ? ' · ' + esc(x.project.name) : ''}</div></div></div>`).join(''))}`;

  const input = root.querySelector('#sq');
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { setQuery({ q: input.value }); ctx.rerender(); }, 180); });
}
