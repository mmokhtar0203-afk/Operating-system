// Projects list with search, status filter and project backup restore.
import { esc, matches } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { pageHead, empty } from '../components/ui.js';
import { projectCard, openProjectForm } from '../components/project-ui.js';
import { ProjectService } from '../services/project-service.js';
import { restoreProjectFlow } from './settings.js';

const state = { q: '', status: 'active' };

export function meta() { return { title: 'Projects', crumbs: [['Projects']] }; }

export function render(root, ctx) {
  const all = ProjectService.all();
  const list = all.filter((p) => (state.status === 'all' || (state.status === 'archived' ? p.status === 'archived' : p.status !== 'archived')) && matches([p.name, p.code, p.client, p.location, p.type], state.q));
  const n = (s) => all.filter((p) => (s === 'archived' ? p.status === 'archived' : p.status !== 'archived')).length;
  root.innerHTML = `
    ${pageHead({ eyebrow: 'Residential projects', title: 'Projects', lead: 'Each project holds its own floors, spaces, specifications and documentation.', actions: `<button class="btn" data-action="restore">${icon('restore')}Restore project backup</button><button class="btn btn-primary" data-action="new">${icon('plus')}New project</button>` })}
    <div class="row wrap gap-12 mb-24">
      <div class="searchbox grow" style="max-width:420px">${icon('search')}<input class="input" id="pq" placeholder="Search name, code, client…" value="${esc(state.q)}"/></div>
      <div class="seg" data-status>
        <button data-s="active" class="${state.status === 'active' ? 'active' : ''}">Active (${n('active')})</button>
        <button data-s="archived" class="${state.status === 'archived' ? 'active' : ''}">Archived (${n('archived')})</button>
        <button data-s="all" class="${state.status === 'all' ? 'active' : ''}">All</button>
      </div>
    </div>
    ${list.length ? `<div class="pgrid">${list.map(projectCard).join('')}</div>` : empty({ title: 'No projects found', text: state.q ? 'Try a different search.' : 'Create a project to begin.', action: '<button class="btn btn-primary" data-action="new">New project</button>' })}`;

  root.querySelector('#pq').addEventListener('input', (e) => { state.q = e.target.value; ctx.rerender(); });
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (a && a.dataset.action === 'new') openProjectForm();
    if (a && a.dataset.action === 'restore') restoreProjectFlow();
    const s = e.target.closest('[data-s]');
    if (s) { state.status = s.dataset.s; ctx.rerender(); }
  });
}
