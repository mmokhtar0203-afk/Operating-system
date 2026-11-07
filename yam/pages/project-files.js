// Project files: everything uploaded in or referenced by the project, plus generated documents.
import { esc, fmtBytes, fmtDate, matches } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { projectHeader, projectMeta } from '../components/project-ui.js';
import { confirmDialog, promptDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { pickFiles, ACCEPT_DOCS, bindDropzone, fileIcon } from '../components/files-ui.js';
import { ProjectService } from '../services/project-service.js';
import { FileService } from '../services/file-service.js';
import { FILE_KINDS, SCHEDULES } from '../data/models.js';

const state = { kind: '', q: '' };

export function meta(ctx) { return projectMeta(ctx, 'Project Files'); }

export function filesTable(files, { showProject = false, projects = {} } = {}) {
  return `<div class="table-wrap"><table class="tbl stack">
    <thead><tr><th></th><th>Name</th><th>Type</th>${showProject ? '<th>Project</th>' : ''}<th>Used in</th><th class="num">Size</th><th>Added</th><th></th></tr></thead>
    <tbody>${files.map((f) => {
      const refs = FileService.references(f.id);
      return `<tr>
        <td class="thumb-cell" style="width:44px">${fileIcon(f).replace('class="ico"', 'class="ico" style="width:36px;height:36px"')}</td>
        <td data-label="Name" class="no-label"><a href="javascript:void 0" data-action="file-open" data-id="${f.id}" class="strong">${esc(f.name)}</a>${f.caption ? `<div class="sub">${esc(f.caption)}</div>` : ''}</td>
        <td data-label="Type" class="small">${esc(FILE_KINDS[f.kind] || f.kind)}</td>
        ${showProject ? `<td data-label="Project" class="small">${f.projectId && projects[f.projectId] ? `<a href="#/projects/${f.projectId}/files">${esc(projects[f.projectId].code)}</a>` : '<span class="faint">Library / global</span>'}</td>` : ''}
        <td data-label="Used in" class="small">${refs.length ? refs.slice(0, 2).map((r) => `<a href="#${esc(r.href)}">${esc(r.label)}</a>`).join('<br>') + (refs.length > 2 ? `<div class="tiny muted">+${refs.length - 2} more</div>` : '') : '<span class="faint">Unlinked</span>'}</td>
        <td data-label="Size" class="num small">${fmtBytes(f.size)}</td>
        <td data-label="Added" class="small nowrap">${fmtDate(f.createdAt)}</td>
        <td class="actions-cell"><button class="btn btn-ghost btn-xs btn-icon" data-action="file-download" data-id="${f.id}" title="Download">${icon('download')}</button><button class="btn btn-ghost btn-xs btn-icon" data-action="caption" data-id="${f.id}" title="Rename / caption">${icon('edit')}</button><button class="btn btn-ghost btn-xs btn-icon" data-action="delete-file" data-id="${f.id}" title="Delete">${icon('trash')}</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

export async function fileRowAction(act, id) {
  const f = FileService.get(id);
  if (!f) return;
  if (act === 'caption') {
    const v = await promptDialog({ title: 'Edit file', fields: [{ name: 'name', label: 'File name', value: f.name, required: true }, { name: 'caption', label: 'Caption / description', value: f.caption || '' }, { name: 'kind', label: 'Type', type: 'select', value: f.kind, options: Object.entries(FILE_KINDS) }] });
    if (v) FileService.update(id, { name: v.name.trim(), caption: v.caption, kind: v.kind });
  }
  if (act === 'delete-file') {
    const refs = FileService.references(id);
    const ok = await confirmDialog({ title: 'Delete file?', danger: true, confirmText: 'Delete everywhere', message: `Delete <b>${esc(f.name)}</b>?`, detail: refs.length ? `It is used in ${refs.length} place(s): ${refs.slice(0, 4).map((r) => esc(r.label)).join('; ')}. It will be removed from all of them.` : 'This file is not referenced by any record.' });
    if (ok) { await FileService.purge(id); toast('File deleted'); }
  }
}

export function render(root, ctx) {
  const p = ProjectService.get(ctx.params.pid);
  const all = FileService.forProject(p.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const files = all.filter((f) => (!state.kind || f.kind === state.kind) && matches([f.name, f.caption], state.q));
  const spaces = ProjectService.spaces(p.id);

  root.innerHTML = `
    ${projectHeader(p, 'files', { actions: `<button class="btn btn-primary" data-action="upload">${icon('upload')}Upload files</button>` })}
    <div class="grid g-3 mb-24">
      <div class="card card-pad"><div class="eyebrow">Generate</div><div class="col gap-8 mt-12">
        <a class="btn" href="#/export/board/${p.id}">${icon('board')}Project material board</a>
        <a class="btn" href="#/export/schedule/${p.id}/general">${icon('schedules')}General material schedule</a>
      </div></div>
      <div class="card card-pad"><div class="eyebrow">Technical room sheets</div>
        <select class="select mt-12" data-action-change="room-sheet"><option value="">Choose a space…</option>${spaces.map((s) => `<option value="${s.id}">${esc(s.code)} ${esc(s.name)}</option>`).join('')}</select>
        <div class="tiny muted mt-8">Opens a printable A4 sheet (Save as PDF).</div></div>
      <div class="card card-pad"><div class="eyebrow">Schedules (print / PDF)</div>
        <select class="select mt-12" data-action-change="schedule"><option value="">Choose a schedule…</option>${SCHEDULES.map((s) => `<option value="${s.key}">${esc(s.label)}</option>`).join('')}</select></div>
    </div>
    <div class="dropzone mb-16" data-drop>${icon('upload')} Drop files to add them to the project</div>
    <div class="row wrap gap-12 mb-16">
      <div class="searchbox grow" style="max-width:320px">${icon('search')}<input class="input sm" id="fq" value="${esc(state.q)}" placeholder="Search files…"/></div>
      <div class="chips">${[['', 'All'], ...Object.entries(FILE_KINDS)].map(([k, l]) => `<button class="chip ${state.kind === k ? 'active' : ''}" data-kind="${k}">${esc(l)} <span class="n">${k ? all.filter((f) => f.kind === k).length : all.length}</span></button>`).join('')}</div>
    </div>
    ${files.length ? filesTable(files) : '<div class="empty sm">No files.</div>'}`;

  const upload = async (list) => {
    if (!list.length) return;
    const metas = [];
    for (const f of list) metas.push(await FileService.add(f, { kind: /^image\//.test(f.type) ? 'image' : /\.(dwg|dxf)$/i.test(f.name) ? 'drawing' : 'document', projectId: p.id }));
    ProjectService.addProjectFiles(p.id, metas.map((m) => m.id));
    toast(`${metas.length} file(s) uploaded`);
  };
  bindDropzone(root.querySelector('[data-drop]'), upload);
  root.querySelector('#fq').addEventListener('input', (e) => { state.q = e.target.value; ctx.rerender(); });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.actionChange === 'room-sheet' && e.target.value) ctx.navigate(`/export/room/${e.target.value}`);
    if (e.target.dataset.actionChange === 'schedule' && e.target.value) ctx.navigate(`/export/schedule/${p.id}/${e.target.value}`);
  });
  root.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-kind]');
    if (k) { state.kind = k.dataset.kind; ctx.rerender(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'upload') upload(await pickFiles({ accept: ACCEPT_DOCS }));
    else fileRowAction(a.dataset.action, a.dataset.id);
  });
}
