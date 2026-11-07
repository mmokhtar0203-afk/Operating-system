// Project-wide measurement register: every space × the standard measurements, editable inline.
import { esc, fmtNum, safeFilename, todayStamp } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { projectHeader, projectMeta } from '../components/project-ui.js';
import { toast } from '../components/toast.js';
import { ProjectService } from '../services/project-service.js';
import { MeasurementService, resolveMeasures } from '../services/measurement-service.js';
import { MEASURE_DEFS } from '../data/models.js';
import { downloadCSV } from '../exports/tabular.js';

export function meta(ctx) { return projectMeta(ctx, 'Measurements'); }

export function render(root, ctx) {
  const p = ProjectService.get(ctx.params.pid);
  const floors = ProjectService.floors(p.id);
  const totals = Object.fromEntries(MEASURE_DEFS.map((d) => [d.key, 0]));
  let missing = 0;

  const body = floors.map((f) => {
    const spaces = ProjectService.spaces(p.id, f.id);
    if (!spaces.length) return '';
    return `<tr class="group"><td colspan="${MEASURE_DEFS.length + 2}">${esc(f.name)}</td></tr>` + spaces.map((s) => {
      const r = resolveMeasures(s.measure);
      return `<tr>
        <td data-label="Space" class="no-label"><a href="#/projects/${p.id}/spaces/${s.id}?sec=measurements"><b>${esc(s.code)}</b> ${esc(s.name)}</a></td>
        ${MEASURE_DEFS.map((d) => {
          const it = s.measure.items.find((x) => x.key === d.key);
          const res = r[d.key] || {};
          if (res.value != null && d.unit !== 'm') totals[d.key] += res.value;
          if (res.value == null) missing++;
          const editable = it && it.mode === 'manual' && !res.overridden;
          return `<td data-label="${esc(d.label)} (${d.unit})" class="num">${editable
            ? `<input class="input sm num ghost" type="number" step="any" style="width:84px" data-sp="${s.id}" data-k="${d.key}" data-fk="pm:${s.id}:${d.key}" value="${it.value ?? ''}" placeholder="—"/>`
            : `<span class="mono ${res.overridden ? '' : 'muted'}" title="${res.overridden ? 'Overridden: ' + esc(it.override.reason) : res.calculated ? 'Calculated: ' + esc(it.formula) : ''}" style="${res.overridden ? 'color:var(--warn)' : ''}">${fmtNum(res.value)}</span>`}</td>`;
        }).join('')}
        <td data-label="Openings" class="num tiny muted">${(s.measure.openings || []).length}</td>
      </tr>`;
    }).join('');
  }).join('');

  root.innerHTML = `
    ${projectHeader(p, 'measurements', { actions: `<button class="btn" data-action="csv">${icon('download')}Export CSV</button>` })}
    <div class="row between wrap mb-16"><p class="small muted" style="margin:0">Manual values are editable here; derived values (grey) are calculated from each room's formulas and openings. Open a room for sources, overrides, custom measurements and drawings.</p>
      ${missing ? `<span class="badge warn">${missing} values missing</span>` : '<span class="badge approved">All measured</span>'}</div>
    <div class="table-wrap"><table class="tbl stack compact">
      <thead><tr><th>Space</th>${MEASURE_DEFS.map((d) => `<th class="num">${esc(d.label)}<br><span class="tiny" style="text-transform:none">${d.unit}</span></th>`).join('')}<th class="num">Openings</th></tr></thead>
      <tbody>${body || `<tr><td colspan="${MEASURE_DEFS.length + 2}" class="center muted">No spaces yet.</td></tr>`}</tbody>
      <tfoot><tr><td>Project total</td>${MEASURE_DEFS.map((d) => `<td class="num mono" data-label="${esc(d.label)}">${d.unit === 'm' ? '' : fmtNum(totals[d.key])}</td>`).join('')}<td></td></tr></tfoot>
    </table></div>`;

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.sp) MeasurementService.setValue(t.dataset.sp, t.dataset.k, t.value);
  });
  root.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="csv"]')) return;
    const rows = [];
    for (const s of ProjectService.spaces(p.id)) {
      const r = resolveMeasures(s.measure);
      const fl = floors.find((f) => f.id === s.floorId);
      rows.push({ Floor: fl ? fl.name : '', Code: s.code, Space: s.name, ...Object.fromEntries(MEASURE_DEFS.map((d) => [`${d.label} (${d.unit})`, r[d.key]?.value ?? ''])) });
    }
    downloadCSV(rows, `${safeFilename(p.code)}_measurements_${todayStamp()}.csv`);
    toast('Measurements exported');
  });
}
