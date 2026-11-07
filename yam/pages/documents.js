// Documents hub: generated documents per project + every stored file across the system.
import { esc, matches, relTime } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { pageHead } from '../components/ui.js';
import { toast } from '../components/toast.js';
import { pickFiles, ACCEPT_DOCS } from '../components/files-ui.js';
import { ProjectService } from '../services/project-service.js';
import { FileService } from '../services/file-service.js';
import { FILE_KINDS } from '../data/models.js';
import { filesTable, fileRowAction } from './project-files.js';
import { promptDialog } from '../components/modal.js';

const state = { q: '', kind: '', project: '' };

export function meta() { return { title: 'Documents', crumbs: [['Documents']] }; }

export function render(root, ctx) {
  if (ctx.query.q != null && ctx.query.q !== state.q) state.q = ctx.query.q;
  const projects = ProjectService.all();
  const pmap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const all = FileService.all().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const files = all.filter((f) => (!state.kind || f.kind === state.kind) && (!state.project || (state.project === '_global' ? !f.projectId : f.projectId === state.project)) && matches([f.name, f.caption, pmap[f.projectId]?.code], state.q));
  const recent = FileService.recent(6);

  root.innerHTML = `
    ${pageHead({ eyebrow: 'Sheets, boards, drawings & files', title: 'Documents', lead: 'Generate technical room sheets, visual material boards and schedule prints — and find every image, drawing, datasheet and approval record.', actions: `<button class="btn btn-primary" data-action="upload">${icon('upload')}Upload</button>` })}
    <div class="table-wrap mb-24"><table class="tbl stack">
      <thead><tr><th>Project</th><th>Material board</th><th>Technical room sheets</th><th>Schedules</th><th>Backup</th></tr></thead>
      <tbody>${projects.filter((p) => p.status !== 'archived').map((p) => `<tr>
        <td data-label="Project" class="no-label"><b>${esc(p.name)}</b> <span class="tiny muted">${esc(p.code)}</span></td>
        <td data-label="Board"><a class="btn btn-sm" href="#/export/board/${p.id}">${icon('board')}Open</a></td>
        <td data-label="Room sheets"><select class="select sm" data-room style="max-width:240px"><option value="">${ProjectService.spaces(p.id).length} spaces — choose…</option>${ProjectService.spaces(p.id).map((s) => `<option value="${s.id}">${esc(s.code)} ${esc(s.name)}</option>`).join('')}</select></td>
        <td data-label="Schedules"><a class="btn btn-sm" href="#/projects/${p.id}/schedules">${icon('schedules')}Schedules</a></td>
        <td data-label="Backup"><button class="btn btn-sm" data-action="backup" data-id="${p.id}">${icon('download')}JSON</button></td>
      </tr>`).join('')}</tbody></table></div>

    ${recent.length ? `<div class="rule-title"><span class="eyebrow">Recently accessed</span></div><div class="chips mb-24">${recent.map((r) => r.generated ? `<a class="chip" href="#${esc(r.href)}">${esc(r.label)} <span class="n">${relTime(r.at)}</span></a>` : `<button class="chip" data-action="file-open" data-id="${r.id}">${esc(r.meta.name)} <span class="n">${relTime(r.at)}</span></button>`).join('')}</div>` : ''}

    <div class="rule-title"><span class="eyebrow">All files (${all.length})</span></div>
    <div class="row wrap gap-8 mb-16">
      <div class="searchbox grow" style="max-width:320px">${icon('search')}<input class="input sm" id="dq" value="${esc(state.q)}" placeholder="Search files…"/></div>
      <select class="select sm" id="dp" style="width:auto"><option value="">All projects</option><option value="_global" ${state.project === '_global' ? 'selected' : ''}>Library / global</option>${projects.map((p) => `<option value="${p.id}" ${state.project === p.id ? 'selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select>
      <select class="select sm" id="dk" style="width:auto"><option value="">All types</option>${Object.entries(FILE_KINDS).map(([k, l]) => `<option value="${k}" ${state.kind === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <span class="tiny muted">${files.length} shown</span>
    </div>
    ${files.length ? filesTable(files, { showProject: true, projects: pmap }) : '<div class="empty sm">No files match.</div>'}`;

  root.querySelector('#dq').addEventListener('input', (e) => { state.q = e.target.value; ctx.rerender(); });
  root.querySelector('#dp').addEventListener('change', (e) => { state.project = e.target.value; ctx.rerender(); });
  root.querySelector('#dk').addEventListener('change', (e) => { state.kind = e.target.value; ctx.rerender(); });
  root.addEventListener('change', (e) => { if (e.target.matches('[data-room]') && e.target.value) ctx.navigate(`/export/room/${e.target.value}`); });
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'backup') {
      const { BackupService } = await import('../services/backup-service.js');
      await BackupService.downloadProject(a.dataset.id);
      toast('Project backup downloaded');
    } else if (a.dataset.action === 'upload') {
      const list = await pickFiles({ accept: ACCEPT_DOCS });
      if (!list.length) return;
      const v = await promptDialog({ title: 'Upload to…', fields: [{ name: 'projectId', label: 'Project', type: 'select', value: state.project && state.project !== '_global' ? state.project : '', options: [['', 'No project (global)'], ...projects.map((p) => [p.id, `${p.code} — ${p.name}`])] }, { name: 'kind', label: 'Type', type: 'select', value: 'document', options: Object.entries(FILE_KINDS) }], confirmText: 'Upload' });
      if (!v) return;
      const metas = [];
      for (const f of list) metas.push(await FileService.add(f, { kind: v.kind, projectId: v.projectId || null }));
      if (v.projectId) ProjectService.addProjectFiles(v.projectId, metas.map((m) => m.id));
      toast(`${metas.length} file(s) uploaded`);
    } else if (['caption', 'delete-file'].includes(a.dataset.action)) fileRowAction(a.dataset.action, a.dataset.id);
  });
}
