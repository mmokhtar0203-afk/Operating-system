// Project overview: cover, description, key facts, floors & spaces summary, specification summary.
import { esc, fmtDate } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { progress, ring, statusBadge } from '../components/ui.js';
import { projectHeader, openProjectForm, projectMeta } from '../components/project-ui.js';
import { confirmDialog, showMenu } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { pickFiles, ACCEPT_IMAGES } from '../components/files-ui.js';
import { ProjectService } from '../services/project-service.js';
import { SpecService } from '../services/spec-service.js';
import { FileService } from '../services/file-service.js';
import { BackupService } from '../services/backup-service.js';
import { spaceCompleteness, projectCompleteness } from '../services/completeness-service.js';
import { ScheduleService } from '../services/schedule-service.js';
import { DISCIPLINES, SCHEDULES } from '../data/models.js';
import { navigate } from '../core/router.js';

export function meta(ctx) { return projectMeta(ctx, ''); }

export function render(root, ctx) {
  const p = ProjectService.get(ctx.params.pid);
  const floors = ProjectService.floors(p.id);
  const specs = SpecService.forProject(p.id);
  const comp = projectCompleteness(p.id);
  const st = ProjectService.stats(p.id);
  const byStatus = (s) => specs.filter((x) => x.status === s).length;
  const schedCounts = ScheduleService.counts(p.id);

  root.innerHTML = `
    ${projectHeader(p, 'overview', { actions: `
      <button class="btn" data-action="edit">${icon('edit')}Edit</button>
      <a class="btn" href="#/export/board/${p.id}">${icon('board')}Material board</a>
      <button class="btn btn-icon" data-action="more" aria-label="More actions">${icon('more')}</button>` })}
    <div class="overview-grid">
      <div class="col gap-24">
        <div class="cover-hero media">${p.coverImageId ? `<img data-file="${esc(p.coverImageId)}" data-thumb="full" alt=""/>` : `<div class="cover-ph">${esc(p.code)}</div>`}
          <button class="btn btn-sm" data-action="cover">${icon('image')}${p.coverImageId ? 'Change cover' : 'Upload cover'}</button></div>
        ${p.description ? `<p class="display" style="font-size:21px;line-height:1.4;color:var(--ink-2)">${esc(p.description)}</p>` : `<p class="muted">No description. <button class="link-btn" data-action="edit">Add one</button></p>`}

        <div>
          <div class="panel-title"><h2 class="h3">Floors & spaces</h2><a class="btn btn-sm" href="#/projects/${p.id}/spaces">${icon('layers')}Manage spaces</a></div>
          ${floors.map((f) => {
            const spaces = ProjectService.spaces(p.id, f.id);
            return `<div class="floor"><div class="floor-head"><span class="lvl">${esc(f.code)}</span><span class="name grow">${esc(f.name)}</span><span class="tiny muted">${spaces.length} space${spaces.length === 1 ? '' : 's'}</span></div>
              ${spaces.length ? spaces.map((s) => { const c = spaceCompleteness(s); return `<a class="space-row" href="#/projects/${p.id}/spaces/${s.id}" style="grid-template-columns:70px minmax(0,1fr) 140px 150px"><span class="mono muted">${esc(s.code)}</span><span><span class="nm">${esc(s.name)}</span> <span class="tiny muted">${esc(s.typeName)}</span></span><span class="tiny muted hide-md">${SpecService.applications({ spaceId: s.id }).length} items</span><span>${progress(c.pct)}</span></a>`; }).join('') : '<div class="small muted" style="padding:12px 16px">No spaces on this floor.</div>'}
            </div>`;
          }).join('') || '<div class="empty sm">No floors yet.</div>'}
        </div>
      </div>

      <aside class="col gap-24">
        <div class="card card-pad">
          <div class="row gap-16">${ring(comp.pct)}<div><div class="strong">Documentation ${comp.pct}%</div><div class="tiny muted">${comp.complete} of ${comp.spaces} spaces ≥ 90 % documented</div></div></div>
          <div class="divider" style="margin:16px 0"></div>
          <div class="kv">
            <div class="k">Code</div><div class="v"><span class="code-tag">${esc(p.code)}</span></div>
            <div class="k">Type</div><div class="v">${esc(p.type)}</div>
            <div class="k">Client</div><div class="v">${esc(p.client || '—')}</div>
            <div class="k">Location</div><div class="v">${esc(p.location || '—')}</div>
            <div class="k">Status</div><div class="v">${statusBadge(p.status === 'archived' ? 'archived' : 'active')}</div>
            <div class="k">Created</div><div class="v">${fmtDate(p.createdAt)}</div>
            <div class="k">Last updated</div><div class="v">${fmtDate(p.updatedAt)}</div>
          </div>
        </div>
        <div class="stats" style="grid-template-columns:repeat(2,1fr)">
          <div class="stat" style="border-bottom:1px solid var(--line)"><div class="eyebrow">Floors</div><div class="value">${st.floors}</div></div>
          <div class="stat" style="border-right:0;border-bottom:1px solid var(--line)"><div class="eyebrow">Spaces</div><div class="value">${st.spaces}</div></div>
          <div class="stat"><div class="eyebrow">Specifications</div><div class="value">${st.specs}</div></div>
          <div class="stat" style="border-right:0"><div class="eyebrow">Applications</div><div class="value">${st.applications}</div></div>
        </div>
        <div class="card">
          <div class="card-head"><span class="title">Specification status</span><a class="tiny" href="#/projects/${p.id}/specs">Open</a></div>
          <div class="card-body"><div class="col gap-8">
            ${['approved', 'submitted', 'draft', 'rejected'].map((s) => `<div class="row between">${statusBadge(s)}<span class="mono">${byStatus(s)}</span></div>`).join('')}
          </div></div>
        </div>
        <div class="card">
          <div class="card-head"><span class="title">Schedules</span></div>
          <div class="card-body" style="padding-top:6px;padding-bottom:6px"><div class="list-plain">
            ${SCHEDULES.map((s) => `<a href="#/projects/${p.id}/schedules/${s.key}"><span class="grow">${esc(s.label)}</span><span class="mono tiny muted">${schedCounts[s.key]}</span>${icon('chevronRight', 'faint')}</a>`).join('')}
          </div></div>
        </div>
        <div class="card">
          <div class="card-head"><span class="title">Specifications by discipline</span></div>
          <div class="card-body" style="padding-top:6px;padding-bottom:6px"><div class="list-plain">
            ${Object.entries(DISCIPLINES).map(([k, d]) => { const n = specs.filter((s) => s.discipline === k).length; return n ? `<a href="#/projects/${p.id}/specs?d=${k}"><span class="code-tag">${d.prefix}</span><span class="grow">${esc(d.label)}</span><span class="mono tiny muted">${n}</span></a>` : ''; }).join('') || '<div class="small muted">None yet.</div>'}
          </div></div>
        </div>
      </aside>
    </div>`;

  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'edit') openProjectForm(p);
    if (act === 'cover') {
      const [f] = await pickFiles({ accept: ACCEPT_IMAGES, multiple: false });
      if (!f) return;
      const old = p.coverImageId;
      const m = await FileService.add(f, { kind: 'image', projectId: p.id });
      ProjectService.update(p.id, { coverImageId: m.id });
      if (old) FileService.collect(old);
      toast('Cover updated');
    }
    if (act === 'more') {
      showMenu(a, [
        { label: 'Export project backup (JSON)', icon: 'download', onClick: async () => { await BackupService.downloadProject(p.id); toast('Project backup downloaded'); } },
        { label: 'Material board', icon: 'board', onClick: () => navigate(`/export/board/${p.id}`) },
        '-',
        p.status === 'archived'
          ? { label: 'Restore from archive', icon: 'restore', onClick: () => { ProjectService.archive(p.id, false); toast('Project restored'); } }
          : { label: 'Archive project', icon: 'archive', onClick: async () => { if (await confirmDialog({ title: 'Archive project?', message: `${esc(p.name)} will be hidden from active lists. Its documentation is kept and can be restored at any time.`, confirmText: 'Archive' })) { ProjectService.archive(p.id, true); toast('Project archived'); } } },
        { label: 'Delete project…', icon: 'trash', danger: true, onClick: async () => {
          const ok = await confirmDialog({ title: 'Delete project permanently?', danger: true, confirmText: 'Delete project', message: `This deletes <b>${esc(p.name)}</b> with all floors, spaces, measurements, specifications and applications.`, detail: 'This cannot be undone. Export a project backup first if you may need it.' });
          if (!ok) return;
          await ProjectService.remove(p.id);
          toast('Project deleted');
          navigate('/projects');
        } },
      ]);
    }
  });
}
