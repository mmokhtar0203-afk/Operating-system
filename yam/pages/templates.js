// Global room templates list.
import { esc, fmtDate } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { pageHead } from '../components/ui.js';
import { promptDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { TemplateService } from '../services/template-service.js';
import { SECTION_MAP } from '../data/models.js';
import { navigate } from '../core/router.js';

export function meta() { return { title: 'Room Templates', crumbs: [['Room Templates']] }; }

export function render(root) {
  const tpls = TemplateService.all();
  root.innerHTML = `
    ${pageHead({ eyebrow: 'Global documentation structure', title: 'Room Templates', lead: 'Templates define the default sections and fields for each room type. New spaces receive a copy; later template changes never overwrite existing project documentation.', actions: `<button class="btn btn-primary" data-action="new">${icon('plus')}New template</button>` })}
    <div class="table-wrap"><table class="tbl stack">
      <thead><tr><th>Template</th><th>Enabled sections</th><th class="num">Fields</th><th class="num">Used by</th><th>Version</th><th>Updated</th><th></th></tr></thead>
      <tbody>${tpls.map((t) => {
        const on = t.sections.filter((s) => s.enabled);
        return `<tr class="clickable" data-href="/templates/${t.id}">
          <td data-label="Template" class="no-label"><b>${esc(t.name)}</b>${t.description ? `<div class="sub">${esc(t.description)}</div>` : ''}</td>
          <td data-label="Sections" class="small">${on.map((s) => `<span class="mono tiny" title="${esc(SECTION_MAP[s.key].label)}">${SECTION_MAP[s.key].num}</span>`).join(' ')} <span class="tiny muted">(${on.length}/12)</span></td>
          <td data-label="Fields" class="num">${t.sections.reduce((a, s) => a + s.fields.length, 0)}</td>
          <td data-label="Used by" class="num">${TemplateService.usage(t.id)} spaces</td>
          <td data-label="Version" class="mono small">v${t.version}</td>
          <td data-label="Updated" class="small">${fmtDate(t.updatedAt)}</td>
          <td class="actions-cell"><button class="btn btn-ghost btn-xs" data-action="dup" data-id="${t.id}">${icon('copy')}Duplicate</button></td></tr>`;
      }).join('')}</tbody></table></div>`;
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]');
    if (a && a.dataset.action === 'new') {
      const v = await promptDialog({ title: 'New room template', fields: [{ name: 'name', label: 'Template name', required: true, placeholder: 'e.g. Study, Laundry, Maid\'s room' }] });
      if (v) { const t = TemplateService.create(v.name.trim()); toast('Template created'); navigate(`/templates/${t.id}`); }
      return;
    }
    if (a && a.dataset.action === 'dup') { e.stopPropagation(); const t = TemplateService.duplicate(a.dataset.id); toast(`Created ${t.name}`); return; }
    const tr = e.target.closest('tr[data-href]');
    if (tr) navigate(tr.dataset.href);
  });
}
