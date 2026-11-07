// Floors & spaces management: add/rename/reorder floors, add/duplicate/move/delete spaces.
import { esc, fmtNum } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { progress } from '../components/ui.js';
import { projectHeader, projectMeta } from '../components/project-ui.js';
import { confirmDialog, promptDialog, showMenu, openModal, fieldHtml, readFields } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { ProjectService } from '../services/project-service.js';
import { TemplateService } from '../services/template-service.js';
import { SpecService } from '../services/spec-service.js';
import { spaceCompleteness } from '../services/completeness-service.js';
import { measureValue } from '../services/measurement-service.js';
import { navigate } from '../core/router.js';

export function meta(ctx) { return projectMeta(ctx, 'Spaces'); }

export function addSpaceDialog(projectId, floorId = null) {
  const floors = ProjectService.floors(projectId);
  if (!floors.length) { toast('Add a floor first.', { error: true }); return; }
  const tpls = TemplateService.all();
  openModal({
    title: 'Add space', eyebrow: 'From a room template', size: 'lg',
    body: `<form class="form-grid" onsubmit="return false">
      ${fieldHtml({ name: 'templateId', label: 'Room template', type: 'select', value: tpls[0]?.id, options: tpls.map((t) => [t.id, `${t.name} (v${t.version})`]) })}
      ${fieldHtml({ name: 'name', label: 'Space name', value: tpls[0]?.name || '', required: true, hint: 'Defaults to the template name.' })}
      ${fieldHtml({ name: 'floorId', label: 'Floor', type: 'select', value: floorId || floors[0].id, options: floors.map((f) => [f.id, f.name]) })}
      ${fieldHtml({ name: 'code', label: 'Space code', value: '', placeholder: 'Auto, e.g. GF-07' })}
    </form>
    <p class="tiny muted mt-12">The space receives its own copy of the template's sections and fields. You can customise this room without affecting the global template.</p>`,
    actions: [{ label: 'Cancel', action: 'cancel' }, { label: 'Add space', action: 'ok', kind: 'primary' }],
    onMount(el) {
      const t = el.querySelector('[name=templateId]'), n = el.querySelector('[name=name]');
      let touched = false;
      n.addEventListener('input', () => { touched = true; });
      t.addEventListener('change', () => { if (!touched) n.value = TemplateService.get(t.value)?.name || ''; });
    },
    onAction(id, el) {
      const v = readFields(el);
      if (!v.name.trim()) { el.querySelector('[name=name]').classList.add('invalid'); return false; }
      const s = ProjectService.addSpace(projectId, { floorId: v.floorId, name: v.name.trim(), templateId: v.templateId, code: v.code.trim() });
      toast(`${s.name} added`);
      navigate(`/projects/${projectId}/spaces/${s.id}`);
    },
  });
}

export function render(root, ctx) {
  const p = ProjectService.get(ctx.params.pid);
  const floors = ProjectService.floors(p.id);

  root.innerHTML = `
    ${projectHeader(p, 'spaces', { actions: `<button class="btn" data-action="add-floor">${icon('plus')}Add floor</button><button class="btn btn-primary" data-action="add-space">${icon('plus')}Add space</button>` })}
    ${floors.map((f, fi) => {
      const spaces = ProjectService.spaces(p.id, f.id);
      return `<section class="floor" data-floor="${f.id}">
        <div class="floor-head">
          <span class="lvl">${esc(f.code)}</span><span class="name grow">${esc(f.name)}</span>
          <span class="tiny muted">${spaces.length} space${spaces.length === 1 ? '' : 's'} · ${fmtNum(spaces.reduce((a, s) => a + (measureValue(s, 'floor_area') || 0), 0))} m²</span>
          <button class="btn btn-ghost btn-xs" data-action="add-space" data-floor="${f.id}">${icon('plus')}Space</button>
          <button class="btn btn-ghost btn-xs btn-icon" data-action="floor-menu" data-id="${f.id}" data-first="${fi === 0}" data-last="${fi === floors.length - 1}" aria-label="Floor actions">${icon('more')}</button>
        </div>
        ${spaces.length ? spaces.map((s, si) => {
          const c = spaceCompleteness(s);
          return `<div class="space-row">
            <span class="mono muted">${esc(s.code)}</span>
            <a href="#/projects/${p.id}/spaces/${s.id}"><span class="nm">${esc(s.name)}</span><br><span class="tiny muted">${esc(s.typeName)}</span></a>
            <span class="small hide-md">${c.missing.length ? `<span class="muted tiny">${esc(c.missing.slice(0, 2).join(', '))}</span>` : '<span class="tiny" style="color:var(--ok)">Fully documented</span>'}</span>
            <span class="mono small hide-md">${fmtNum(measureValue(s, 'floor_area'))} m²</span>
            <span class="tiny muted hide-md">${SpecService.applications({ spaceId: s.id }).length} items</span>
            <span class="hide-md">${progress(c.pct)}</span>
            <span class="row gap-4" style="justify-content:flex-end">
              <a class="btn btn-sm" href="#/projects/${p.id}/spaces/${s.id}">Open</a>
              <button class="btn btn-ghost btn-sm btn-icon" data-action="space-menu" data-id="${s.id}" data-first="${si === 0}" data-last="${si === spaces.length - 1}" aria-label="Space actions">${icon('more')}</button>
            </span>
          </div>`;
        }).join('') : `<div class="small muted" style="padding:14px 16px">No spaces yet. <button class="link-btn" data-action="add-space" data-floor="${f.id}">Add a space</button></div>`}
      </section>`;
    }).join('') || `<div class="empty"><div class="h3">No floors</div><p>Add the floors of this project, then add spaces from room templates.</p><button class="btn btn-primary" data-action="add-floor">Add floor</button></div>`}`;

  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'add-space') return addSpaceDialog(p.id, a.dataset.floor);
    if (act === 'add-floor') {
      const v = await promptDialog({ title: 'Add floor', fields: [{ name: 'name', label: 'Floor name', value: `Level ${floors.length}`, required: true }, { name: 'code', label: 'Short code', value: '', placeholder: 'e.g. L2, B1, RF', hint: 'Used to number spaces (L2-01).' }] });
      if (v) { ProjectService.addFloor(p.id, { name: v.name.trim(), code: v.code.trim().toUpperCase() }); toast('Floor added'); }
      return;
    }
    if (act === 'floor-menu') {
      const f = ProjectService.floors(p.id).find((x) => x.id === a.dataset.id);
      showMenu(a, [
        { label: 'Rename floor', icon: 'edit', onClick: async () => {
          const v = await promptDialog({ title: 'Rename floor', fields: [{ name: 'name', label: 'Floor name', value: f.name, required: true }, { name: 'code', label: 'Short code', value: f.code }] });
          if (v) ProjectService.updateFloor(f.id, { name: v.name.trim(), code: v.code.trim().toUpperCase() || f.code });
        } },
        ...(a.dataset.first === 'true' ? [] : [{ label: 'Move up', icon: 'chevronUp', onClick: () => ProjectService.moveFloor(f.id, -1) }]),
        ...(a.dataset.last === 'true' ? [] : [{ label: 'Move down', icon: 'chevronDown', onClick: () => ProjectService.moveFloor(f.id, 1) }]),
        '-',
        { label: 'Delete floor…', icon: 'trash', danger: true, onClick: () => deleteFloor(p, f) },
      ]);
      return;
    }
    if (act === 'space-menu') {
      const s = ProjectService.space(a.dataset.id);
      const others = ProjectService.floors(p.id).filter((f) => f.id !== s.floorId);
      showMenu(a, [
        { label: 'Open documentation', icon: 'arrowRight', onClick: () => navigate(`/projects/${p.id}/spaces/${s.id}`) },
        { label: 'Rename / recode', icon: 'edit', onClick: async () => {
          const v = await promptDialog({ title: 'Rename space', fields: [{ name: 'name', label: 'Space name', value: s.name, required: true }, { name: 'code', label: 'Space code', value: s.code, required: true }] });
          if (v) ProjectService.updateSpace(s.id, { name: v.name.trim(), code: v.code.trim() });
        } },
        { label: 'Duplicate (with items)', icon: 'copy', onClick: () => { const c = ProjectService.duplicateSpace(s.id, { withItems: true }); toast(`Duplicated as ${c.name}`); } },
        { label: 'Duplicate (documentation only)', icon: 'copy', onClick: () => { const c = ProjectService.duplicateSpace(s.id, { withItems: false }); toast(`Duplicated as ${c.name}`); } },
        ...(others.length ? [{ label: 'Move to floor…', icon: 'move', onClick: async () => {
          const v = await promptDialog({ title: `Move ${s.name}`, fields: [{ name: 'floorId', label: 'Destination floor', type: 'select', value: others[0].id, options: others.map((f) => [f.id, f.name]) }], confirmText: 'Move' });
          if (v) { ProjectService.moveSpace(s.id, v.floorId); toast('Space moved'); }
        } }] : []),
        ...(a.dataset.first === 'true' ? [] : [{ label: 'Move up', icon: 'chevronUp', onClick: () => ProjectService.reorderSpace(s.id, -1) }]),
        ...(a.dataset.last === 'true' ? [] : [{ label: 'Move down', icon: 'chevronDown', onClick: () => ProjectService.reorderSpace(s.id, 1) }]),
        '-',
        { label: 'Delete space…', icon: 'trash', danger: true, onClick: async () => {
          const n = SpecService.applications({ spaceId: s.id }).length;
          if (await confirmDialog({ title: 'Delete space?', danger: true, confirmText: 'Delete', message: `Delete <b>${esc(s.name)}</b> and its documentation?`, detail: `${n} item assignment(s) in this space will be removed. Project specifications themselves are kept.` })) {
            ProjectService.removeSpace(s.id); toast('Space deleted');
          }
        } },
      ]);
    }
  });
}

async function deleteFloor(p, f) {
  const spaces = ProjectService.spaces(p.id, f.id);
  const others = ProjectService.floors(p.id).filter((x) => x.id !== f.id);
  if (!spaces.length) {
    if (await confirmDialog({ title: 'Delete floor?', message: `Delete <b>${esc(f.name)}</b>?`, confirmText: 'Delete', danger: true })) ProjectService.removeFloor(f.id);
    return;
  }
  const v = await promptDialog({
    title: `Delete ${f.name}`, confirmText: 'Delete floor', size: '',
    intro: `This floor contains ${spaces.length} space(s). Choose what happens to them.`,
    fields: [{ name: 'moveTo', label: 'Spaces on this floor', type: 'select', value: others[0]?.id || '', options: [...others.map((x) => [x.id, `Move to ${x.name}`]), ['', 'Delete the spaces too']] }],
  });
  if (!v) return;
  if (!v.moveTo && !(await confirmDialog({ title: 'Delete spaces too?', danger: true, confirmText: 'Delete all', message: `${spaces.length} space(s) and their documentation will be deleted.` }))) return;
  ProjectService.removeFloor(f.id, { moveTo: v.moveTo || null });
  toast('Floor deleted');
}
