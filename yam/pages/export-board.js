// Visual Material Board preview + print/PDF + standalone HTML.
import { esc } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { ProjectService } from '../services/project-service.js';
import { SpecService } from '../services/spec-service.js';
import { FileService } from '../services/file-service.js';
import { buildMaterialBoard } from '../exports/material-board.js';
import { printStage, downloadStandalone, paginate, fitStage } from '../exports/print-kit.js';
import { DISCIPLINES } from '../data/models.js';
import { setQuery } from '../core/router.js';

const opts = { disciplines: ['flooring', 'walls', 'ceiling', 'joinery', 'furniture', 'lighting', 'plumbing', 'general'], cols: 4, cover: true };

export function meta(ctx) {
  const p = ProjectService.get(ctx.params.pid);
  if (!p) return { redirect: '/documents' };
  return { title: `Material board — ${p.name}`, crumbs: [['Projects', '/projects'], [p.name, `/projects/${p.id}`], ['Material board']] };
}

export function render(root, ctx) {
  const p = ProjectService.get(ctx.params.pid);
  const spaceId = ctx.query.space || '';
  const space = spaceId ? ProjectService.space(spaceId) : null;
  const specs = SpecService.forProject(p.id);
  FileService.trackGenerated({ href: `/export/board/${p.id}${spaceId ? '?space=' + spaceId : ''}`, label: `Material board — ${p.code}${space ? ' ' + space.name : ''}`, kind: 'board' });
  root.innerHTML = `<style>@page { size: A4 landscape; margin: 0; } @media print { .sheet.board, .sheet.land { page: auto !important; } }</style>
    <div class="export-bar no-print">
      <a class="btn btn-ghost btn-sm" href="#/projects/${p.id}${space ? '/spaces/' + space.id : ''}">${icon('arrowLeft')}Back</a>
      <span class="h4">Visual Material Board</span>
      <select class="select sm" id="scope" style="width:auto"><option value="">Whole project</option>${ProjectService.spaces(p.id).map((s) => `<option value="${s.id}" ${s.id === spaceId ? 'selected' : ''}>${esc(s.code)} ${esc(s.name)}</option>`).join('')}</select>
      <select class="select sm" id="cols" style="width:auto">${[[3, 'Large · 3 per sheet'], [4, 'Standard · 8 per sheet'], [5, 'Compact · 10 per sheet']].map(([v, l]) => `<option value="${v}" ${opts.cols === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label class="check small"><input type="checkbox" id="cover" ${opts.cover ? 'checked' : ''}/> Cover sheet</label>
      <span class="grow"></span>
      <button class="btn btn-sm" data-action="html">${icon('download')}Download HTML</button>
      <button class="btn btn-primary btn-sm" data-action="print">${icon('print')}Print / Save as PDF</button>
    </div>
    <div class="chips no-print mb-16">${Object.entries(DISCIPLINES).map(([k, d]) => { const n = specs.filter((s) => s.discipline === k).length; return n ? `<button class="chip ${opts.disciplines.includes(k) ? 'active' : ''}" data-d="${k}">${esc(d.label)} <span class="n">${n}</span></button>` : ''; }).join('')}</div>
    <div class="tiny muted no-print mb-16">Landscape A4. In the print dialog choose “Save as PDF”, margins “None” and enable “Background graphics”.</div>
    <div class="export-stage" id="stage">${buildMaterialBoard(p.id, { ...opts, spaceId })}</div>`;
  const stage = root.querySelector('#stage');
  requestAnimationFrame(() => { paginate(stage); fitStage(stage); });
  root.querySelector('#scope').addEventListener('change', (e) => { setQuery({ space: e.target.value }); ctx.rerender(); });
  root.querySelector('#cols').addEventListener('change', (e) => { opts.cols = +e.target.value; ctx.rerender(); });
  root.querySelector('#cover').addEventListener('change', (e) => { opts.cover = e.target.checked; ctx.rerender(); });
  root.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-d]');
    if (d) { const k = d.dataset.d; opts.disciplines = opts.disciplines.includes(k) ? opts.disciplines.filter((x) => x !== k) : [...opts.disciplines, k]; ctx.rerender(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'print') printStage(stage);
    if (a.dataset.action === 'html') { await downloadStandalone(stage, `${p.code}_MaterialBoard${space ? '_' + space.code : ''}`); toast('Material board downloaded'); }
  });
}
