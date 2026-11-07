// Printable schedule (landscape A4), paginated, generated from live data.
import { esc, fmtNum } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { ProjectService } from '../services/project-service.js';
import { ScheduleService } from '../services/schedule-service.js';
import { FileService } from '../services/file-service.js';
import { SCHEDULES, SCHEDULE_MAP } from '../data/models.js';
import { sheetHead, sheetFoot, printStage, downloadStandalone, paginate, fitStage } from '../exports/print-kit.js';

const opts = { mode: 'consolidated' };
const ROWS_PER_SHEET = 22;

export function meta(ctx) {
  const p = ProjectService.get(ctx.params.pid);
  if (!p || !SCHEDULE_MAP[ctx.params.type]) return { redirect: '/documents' };
  return { title: `${SCHEDULE_MAP[ctx.params.type].label} — ${p.name}`, crumbs: [['Projects', '/projects'], [p.name, `/projects/${p.id}`], ['Schedules', `/projects/${p.id}/schedules/${ctx.params.type}`], ['Print']] };
}

export function render(root, ctx) {
  const p = ProjectService.get(ctx.params.pid);
  const type = ctx.params.type;
  const sch = SCHEDULE_MAP[type];
  FileService.trackGenerated({ href: `/export/schedule/${p.id}/${type}`, label: `${p.code} — ${sch.label} (print)`, kind: 'schedule' });
  const rows = ScheduleService.sort(ScheduleService.rows(p.id, type, opts.mode), opts.mode === 'space' ? 'floorOrder' : 'code', 1);
  const cols = ScheduleService.columns(type, opts.mode).filter((c) => !c.optional);
  const totals = ScheduleService.totals(rows);
  const head = sheetHead({ docType: sch.label, docNo: `${p.code}-SCH-${type.toUpperCase()}`, meta: [p.name, opts.mode === 'space' ? 'By space' : 'Consolidated'] });
  const chunks = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += ROWS_PER_SHEET) chunks.push(rows.slice(i, i + ROWS_PER_SHEET));
  const sheets = chunks.map((chunk, i) => `<div class="sheet land">${head}
    ${i === 0 ? `<h1 class="s-title" style="font-size:22pt">${esc(sch.label)}</h1><div class="s-sub" style="margin-bottom:4mm">${esc(p.name)} · ${esc(p.client || '')} · ${rows.length} line(s)</div>` : ''}
    <table><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
    ${chunk.map((r) => `<tr>${cols.map((c) => { const v = r[c.key]; return `<td class="${c.num ? 'num' : ''} ${c.key === 'code' ? 'code' : ''}">${c.num ? (v == null || v === '' ? '—' : fmtNum(v)) : c.key === 'name' ? `<b>${esc(v)}</b>` : esc(v ?? '—')}</td>`; }).join('')}</tr>`).join('')}
    </tbody>${i === chunks.length - 1 ? `<tfoot><tr><td colspan="${cols.length}" style="font-weight:600;border-top:0.6pt solid #1E1C19;padding-top:2mm">Totals by unit: ${Object.entries(totals.byUnit).map(([u, q]) => `${fmtNum(q)} ${esc(u)}`).join(' · ') || '—'}</td></tr></tfoot>` : ''}</table>
    ${sheetFoot(`${p.code} · ${sch.label}`, i + 1, chunks.length)}</div>`).join('');

  root.innerHTML = `<style>@page { size: A4 landscape; margin: 0; } @media print { .sheet.board, .sheet.land { page: auto !important; } }</style>
    <div class="export-bar no-print">
      <a class="btn btn-ghost btn-sm" href="#/projects/${p.id}/schedules/${type}">${icon('arrowLeft')}Back to schedule</a>
      <select class="select sm" id="type" style="width:auto">${SCHEDULES.map((s) => `<option value="${s.key}" ${s.key === type ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
      <div class="seg"><button data-m="consolidated" class="${opts.mode === 'consolidated' ? 'active' : ''}">Consolidated</button><button data-m="space" class="${opts.mode === 'space' ? 'active' : ''}">By space</button></div>
      <span class="grow"></span>
      <button class="btn btn-sm" data-action="html">${icon('download')}Download HTML</button>
      <button class="btn btn-primary btn-sm" data-action="print">${icon('print')}Print / Save as PDF</button>
    </div>
    <div class="export-stage" id="stage">${sheets}</div>`;
  const stage = root.querySelector('#stage');
  requestAnimationFrame(() => { paginate(stage); fitStage(stage); });
  root.querySelector('#type').addEventListener('change', (e) => ctx.navigate(`/export/schedule/${p.id}/${e.target.value}`));
  root.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-m]');
    if (m) { opts.mode = m.dataset.m; ctx.rerender(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'print') printStage(stage);
    if (a.dataset.action === 'html') { await downloadStandalone(stage, `${p.code}_${sch.label}`); toast('Schedule downloaded'); }
  });
}
