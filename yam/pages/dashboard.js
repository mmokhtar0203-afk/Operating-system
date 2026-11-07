// Dashboard: welcome, search, quick access, active & recent projects, recent documents, completeness.
import { esc, fmtDate, relTime } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { progress, empty } from '../components/ui.js';
import { projectCard, openProjectForm } from '../components/project-ui.js';
import { ProjectService } from '../services/project-service.js';
import { FileService } from '../services/file-service.js';
import { projectCompleteness, spaceCompleteness } from '../services/completeness-service.js';
import { settings } from '../services/settings-service.js';
import { db } from '../services/db.js';
import { Prefs } from '../storage/local-store.js';
import { navigate } from '../core/router.js';
import { FILE_KINDS } from '../data/models.js';

export function meta() { return { title: 'Dashboard', crumbs: [['Dashboard']] }; }

export function render(root) {
  const s = settings();
  const first = (s.user.name || '').split(' ')[0];
  const active = ProjectService.all({ includeArchived: false });
  const recentIds = Prefs.get('recentProjects', []);
  const recent = recentIds.map((id) => ProjectService.get(id)).filter(Boolean).slice(0, 5);
  const docs = FileService.recent(7);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Spaces needing documentation across active projects
  const gaps = [];
  for (const p of active) for (const sp of ProjectService.spaces(p.id)) {
    const c = spaceCompleteness(sp);
    if (c.pct < 60) gaps.push({ p, sp, c });
  }
  gaps.sort((a, b) => a.c.pct - b.c.pct);

  root.innerHTML = `
  <section class="welcome">
    <div>
      <div class="date">${fmtDate(new Date().toISOString(), 'long')}</div>
      <h1 class="h1 mt-8">${greet}, ${esc(first)}.</h1>
      <p class="muted mt-8" style="max-width:520px">${active.length} active project${active.length === 1 ? '' : 's'} · ${db.count('spaces')} documented spaces · ${db.count('library', (l) => !l.archived)} library records.</p>
    </div>
    <div>
      <div class="searchbox dash-search">${icon('search')}<input class="input" id="dash-q" type="search" placeholder="Search a room, code (e.g. ZED-FL-01, MAT-0001) or product…"/></div>
      <div class="quick mt-12">
        <a href="javascript:void 0" data-action="new-project">${icon('plus')}New project<span class="sub">Floors & spaces</span></a>
        <a href="#/library">${icon('library')}Library<span class="sub">Materials & products</span></a>
        <a href="#/schedules">${icon('schedules')}Schedules<span class="sub">Project-wide</span></a>
        <a href="#/documents">${icon('documents')}Documents<span class="sub">Sheets & boards</span></a>
      </div>
    </div>
  </section>

  <div class="dash-cols">
    <div>
      <div class="panel-title"><h2 class="h2 grow">Active projects</h2><a class="btn btn-sm" href="#/projects">All projects ${icon('arrowRight')}</a></div>
      ${active.length ? `<div class="pgrid">${active.map(projectCard).join('')}</div>` : empty({ title: 'No active projects', text: 'Create your first residential project to start documenting.', action: '<button class="btn btn-primary" data-action="new-project">New project</button>' })}

      <div class="rule-title"><span class="eyebrow">Documentation completeness</span></div>
      <div class="table-wrap"><table class="tbl stack">
        <thead><tr><th>Project</th><th>Spaces</th><th>≥ 90 % documented</th><th style="width:34%">Completeness</th></tr></thead>
        <tbody>${active.map((p) => { const c = projectCompleteness(p.id); return `<tr class="clickable" data-href="/projects/${p.id}"><td data-label="Project"><b>${esc(p.name)}</b> <span class="tiny muted">${esc(p.code)}</span></td><td data-label="Spaces">${c.spaces}</td><td data-label="Complete">${c.complete}</td><td data-label="Completeness">${progress(c.pct)}</td></tr>`; }).join('')}</tbody>
      </table></div>
      <p class="tiny faint mt-8">Completeness measures documented information — measurements, room fields and specified finishes/systems — not construction progress.</p>
    </div>

    <aside class="col gap-24">
      <div class="card">
        <div class="card-head"><span class="title">Recent projects</span></div>
        <div class="card-body" style="padding-top:4px;padding-bottom:4px">
          ${recent.length ? `<div class="list-plain">${recent.map((p) => `<a href="#/projects/${p.id}"><span class="code-tag">${esc(p.code)}</span><span class="grow truncate">${esc(p.name)}</span><span class="tiny muted">${relTime(p.updatedAt)}</span></a>`).join('')}</div>` : '<div class="small muted" style="padding:12px 0">Projects you open appear here.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span class="title">Recently accessed documents</span><a class="tiny" href="#/documents">View all</a></div>
        <div class="card-body" style="padding-top:4px;padding-bottom:4px">
          ${docs.length ? `<div class="list-plain">${docs.map((d) => d.generated
            ? `<a href="#${esc(d.href)}"><span class="thumb">${icon(d.kind === 'board' ? 'board' : d.kind === 'schedule' ? 'schedules' : 'sheet')}</span><span class="grow truncate">${esc(d.label)}</span><span class="tiny muted">${relTime(d.at)}</span></a>`
            : `<a href="javascript:void 0" data-action="file-open" data-id="${esc(d.id)}"><span class="thumb">${/^image/.test(d.meta.type) ? `<img data-file="${esc(d.id)}" alt=""/>` : icon('file')}</span><span class="grow" style="min-width:0"><span class="truncate" style="display:block">${esc(d.meta.name)}</span><span class="tiny muted">${esc(FILE_KINDS[d.meta.kind] || '')}</span></span><span class="tiny muted">${relTime(d.at)}</span></a>`).join('')}</div>` : '<div class="small muted" style="padding:12px 0">Open or generate a document to see it here.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span class="title">Spaces needing documentation</span></div>
        <div class="card-body" style="padding-top:4px;padding-bottom:4px">
          ${gaps.length ? `<div class="list-plain">${gaps.slice(0, 6).map(({ p, sp, c }) => `<a href="#/projects/${p.id}/spaces/${sp.id}"><span class="grow" style="min-width:0"><span class="truncate strong" style="display:block">${esc(sp.name)}</span><span class="tiny muted truncate" style="display:block">${esc(p.code)} · ${esc(c.missing.slice(0, 2).join(', '))}</span></span><span style="width:90px">${progress(c.pct)}</span></a>`).join('')}</div>` : '<div class="small muted" style="padding:12px 0">All spaces are well documented.</div>'}
        </div>
      </div>
    </aside>
  </div>`;

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="new-project"]')) return openProjectForm();
    const tr = e.target.closest('tr[data-href]');
    if (tr) navigate(tr.dataset.href);
  });
  root.querySelector('#dash-q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
  });
}
