// Project header, project card, and create/edit project dialog.
import { esc, fmtDate, relTime } from '../core/utils.js';
import { icon } from './icons.js';
import { openModal, fieldHtml, readFields } from './modal.js';
import { toast } from './toast.js';
import { pickFiles, ACCEPT_IMAGES } from './files-ui.js';
import { progress, statusBadge } from './ui.js';
import { ProjectService, deriveCode } from '../services/project-service.js';
import { FileService } from '../services/file-service.js';
import { projectCompleteness } from '../services/completeness-service.js';
import { PROJECT_TYPES } from '../data/models.js';
import { navigate } from '../core/router.js';

const TABS = [['overview', '', 'Overview'], ['spaces', '/spaces', 'Spaces'], ['measurements', '/measurements', 'Measurements'], ['specs', '/specs', 'Specifications'], ['schedules', '/schedules', 'Schedules'], ['files', '/files', 'Project Files']];

export function projectTabs(project, active) {
  return `<nav class="tabs" aria-label="Project sections">${TABS.map(([k, s, l]) => `<a href="#/projects/${project.id}${s}" class="${k === active ? 'active' : ''}">${l}</a>`).join('')}</nav>`;
}

export function projectHeader(project, active, { actions = '' } = {}) {
  const comp = projectCompleteness(project.id);
  return `
  <div class="phead">
    <div style="min-width:0">
      <div class="eyebrow">${esc(project.type)} · ${esc(project.code)} ${project.status === 'archived' ? '· ' + statusBadge('archived') : ''}</div>
      <h1 class="h1" style="margin-top:6px">${esc(project.name)}</h1>
      <div class="meta"><span>Client <b>${esc(project.client || '—')}</b></span><span>${esc(project.location || '')}</span>
        <span style="min-width:180px;display:inline-flex;gap:8px;align-items:center">Documented ${progress(comp.pct)}</span></div>
    </div>
    <div class="row wrap">${actions}</div>
  </div>
  <div class="mt-24">${projectTabs(project, active)}</div>`;
}

export function projectCard(p) {
  const st = ProjectService.stats(p.id);
  const comp = projectCompleteness(p.id);
  return `<a class="pcard" href="#/projects/${p.id}">
    <div class="media">${p.coverImageId ? `<img data-file="${esc(p.coverImageId)}" alt=""/>` : `<div class="cover-ph">${esc(p.code)}</div>`}
      ${p.status === 'archived' ? statusBadge('archived') : ''}</div>
    <div class="body">
      <div class="eyebrow">${esc(p.type)} · ${esc(p.code)}</div>
      <div class="name">${esc(p.name)}</div>
      <div class="client">${esc(p.client || 'No client set')}</div>
      <div class="metrics"><div><b>${st.floors}</b><span>Floors</span></div><div><b>${st.spaces}</b><span>Spaces</span></div><div><b>${st.specs}</b><span>Specs</span></div></div>
      <div><div class="tiny muted mb-8" style="letter-spacing:.06em;text-transform:uppercase">Documentation</div>${progress(comp.pct)}</div>
      <div class="foot"><span>Updated ${relTime(p.updatedAt)}</span><span>${fmtDate(p.updatedAt)}</span></div>
    </div></a>`;
}

/** Create or edit a project. */
export function openProjectForm(project = null) {
  const isNew = !project;
  const p = project || { name: '', code: '', type: 'Villa', client: '', location: '', description: '' };
  let coverFile = null;
  const body = `
    <form class="form-grid" onsubmit="return false">
      ${fieldHtml({ name: 'name', label: 'Project name', value: p.name, required: true, full: true, autofocus: true })}
      ${fieldHtml({ name: 'code', label: 'Project code', value: p.code, hint: 'Prefix for project-specific codes, e.g. ZED → ZED-FL-01' })}
      ${fieldHtml({ name: 'type', label: 'Project type', type: 'select', value: p.type, options: PROJECT_TYPES })}
      ${fieldHtml({ name: 'client', label: 'Client', value: p.client })}
      ${fieldHtml({ name: 'location', label: 'Location', value: p.location })}
      ${fieldHtml({ name: 'description', label: 'Description', type: 'textarea', value: p.description, full: true })}
      ${isNew ? fieldHtml({ name: 'floors', label: 'Floors (one per line)', type: 'textarea', value: 'Ground Floor\nFirst Floor', full: true, rows: 3, hint: 'You can add, rename and reorder floors later.' }) : ''}
      <div class="field full"><label>Cover image</label><div class="row" data-cover>
        <button type="button" class="btn btn-sm" data-pick>${icon('image')}${p.coverImageId ? 'Replace cover' : 'Upload cover'}</button><span class="tiny muted" data-cover-name></span></div></div>
    </form>`;
  openModal({
    title: isNew ? 'New project' : 'Edit project', eyebrow: isNew ? 'Projects' : p.code, size: 'lg', body,
    actions: [{ label: 'Cancel', action: 'cancel' }, { label: isNew ? 'Create project' : 'Save changes', action: 'save', kind: 'primary' }],
    onMount(el) {
      const nameI = el.querySelector('[name=name]'), codeI = el.querySelector('[name=code]');
      let codeTouched = !isNew;
      codeI.addEventListener('input', () => { codeTouched = true; });
      nameI.addEventListener('input', () => { if (!codeTouched) codeI.value = deriveCode(nameI.value); });
      el.querySelector('[data-pick]').addEventListener('click', async () => {
        const [f] = await pickFiles({ accept: ACCEPT_IMAGES, multiple: false });
        if (f) { coverFile = f; el.querySelector('[data-cover-name]').textContent = f.name; }
      });
    },
    async onAction(id, el) {
      const v = readFields(el);
      if (!v.name.trim()) { el.querySelector('[name=name]').classList.add('invalid'); return false; }
      const code = (v.code || deriveCode(v.name)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (ProjectService.codeTaken(code, project && project.id)) { toast(`Project code ${code} is already used.`, { error: true }); el.querySelector('[name=code]').classList.add('invalid'); return false; }
      let coverImageId = p.coverImageId || null;
      const data = { name: v.name.trim(), code, type: v.type, client: v.client, location: v.location, description: v.description };
      if (isNew) {
        const floors = String(v.floors || '').split('\n').map((s) => s.trim()).filter(Boolean);
        const created = ProjectService.create(data, { floors: floors.length ? floors : ['Ground Floor'] });
        if (coverFile) { const m = await FileService.add(coverFile, { kind: 'image', projectId: created.id }); ProjectService.update(created.id, { coverImageId: m.id }); }
        toast('Project created');
        navigate(`/projects/${created.id}`);
      } else {
        if (coverFile) { const m = await FileService.add(coverFile, { kind: 'image', projectId: project.id }); coverImageId = m.id; }
        const old = project.coverImageId;
        ProjectService.update(project.id, { ...data, coverImageId });
        if (old && old !== coverImageId) FileService.collect(old);
        toast('Project updated');
      }
    },
  });
}

import { Prefs } from '../storage/local-store.js';
/** Remember the project in the "recent projects" list (per device). */
export function rememberProject(pid) {
  const list = Prefs.get('recentProjects', []).filter((x) => x !== pid);
  list.unshift(pid);
  Prefs.set('recentProjects', list.slice(0, 10));
}

/** Common meta for project-scoped pages; redirects if the project is missing.
 *  projectMeta(ctx, 'Spaces', { href: '/spaces', extra: [['Master Bedroom']] }) */
export function projectMeta(ctx, label, { href = '', extra = [] } = {}) {
  const p = ProjectService.get(ctx.params.pid);
  if (!p) return { redirect: '/projects' };
  rememberProject(p.id);
  const crumbs = [['Projects', '/projects'], [p.name, `/projects/${p.id}`]];
  if (label) crumbs.push([label, extra.length ? `/projects/${p.id}${href}` : null]);
  return { title: `${extra.length ? extra[extra.length - 1][0] + ' — ' : label ? label + ' — ' : ''}${p.name}`, crumbs: [...crumbs, ...extra], project: p };
}
