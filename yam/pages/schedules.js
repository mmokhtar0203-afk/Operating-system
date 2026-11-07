// Project-wide schedules — generated live from specifications and space applications.
import { esc, fmtNum, safeFilename, todayStamp } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { statusBadge, codeTag, thumb, pageHead, empty } from '../components/ui.js';
import { projectHeader, projectMeta, rememberProject } from '../components/project-ui.js';
import { toast } from '../components/toast.js';
import { showMenu } from '../components/modal.js';
import { ProjectService } from '../services/project-service.js';
import { ScheduleService } from '../services/schedule-service.js';
import { FileService } from '../services/file-service.js';
import { SCHEDULES, SCHEDULE_MAP, SPEC_STATUSES } from '../data/models.js';
import { downloadCSV, downloadXLS } from '../exports/tabular.js';
import { navigate } from '../core/router.js';
import { Prefs } from '../storage/local-store.js';

const state = { mode: 'space', q: '', status: '', floor: '', group: '', sort: 'code', dir: 1, money: false };

export function meta(ctx) {
  if (!ctx.params.pid) {
    const last = Prefs.get('recentProjects', []).find((id) => ProjectService.get(id)) || (ProjectService.all({ includeArchived: false })[0] || {}).id;
    return { title: 'Project Schedules', crumbs: [['Project Schedules']], last };
  }
  const type = ctx.params.type || 'floor';
  return projectMeta(ctx, 'Schedules', { href: '/schedules', extra: [[SCHEDULE_MAP[type]?.label || 'Schedule']] });
}

export function exportRows(projectId, type, mode, rows) {
  const cols = ScheduleService.columns(type, mode).filter((c) => !c.optional || state.money || c.key === 'notes');
  return { cols, data: rows.map((r) => cols.map((c) => (r[c.key] ?? ''))) };
}

export function render(root, ctx) {
  // Global entry: pick a project
  if (!ctx.params.pid) {
    const projects = ProjectService.all({ includeArchived: false });
    root.innerHTML = `${pageHead({ eyebrow: 'Consolidated from all rooms', title: 'Project Schedules', lead: 'Schedules are generated from project specifications and their space applications — never typed twice. Choose a project.' })}
      ${projects.length ? `<div class="table-wrap"><table class="tbl stack"><thead><tr><th>Project</th>${SCHEDULES.slice(0, 9).map((s) => `<th class="num">${esc(s.label.replace(' Schedule', ''))}</th>`).join('')}</tr></thead><tbody>
      ${projects.map((p) => { const c = ScheduleService.counts(p.id); return `<tr><td data-label="Project" class="no-label"><a href="#/projects/${p.id}/schedules"><b>${esc(p.name)}</b></a> <span class="tiny muted">${esc(p.code)}</span></td>${SCHEDULES.slice(0, 9).map((s) => `<td class="num" data-label="${esc(s.label)}"><a href="#/projects/${p.id}/schedules/${s.key}">${c[s.key]}</a></td>`).join('')}</tr>`; }).join('')}
      </tbody></table></div>` : empty({ title: 'No active projects', text: 'Create a project first.' })}`;
    return;
  }

  const p = ProjectService.get(ctx.params.pid);
  rememberProject(p.id);
  const type = ctx.params.type || 'floor';
  const sch = SCHEDULE_MAP[type];
  if (!sch) { navigate(`/projects/${p.id}/schedules`, { replace: true }); return; }
  const counts = ScheduleService.counts(p.id);
  const allRows = ScheduleService.rows(p.id, type, state.mode);
  const floors = [...new Set(allRows.map((r) => r.floor).filter((f) => f && f !== '—'))];
  let rows = ScheduleService.filter(allRows, { q: state.q, status: state.status, floor: state.mode === 'space' ? state.floor : '' });
  rows = ScheduleService.sort(rows, state.sort, state.dir);
  const groups = ScheduleService.group(rows, state.group);
  const cols = ScheduleService.columns(type, state.mode).filter((c) => !c.optional || state.money || c.key === 'notes');
  const totals = ScheduleService.totals(rows);
  const groupOpts = state.mode === 'space' ? [['', 'No grouping'], ['floor', 'Floor'], ['space', 'Space'], ['code', 'Specification'], ['status', 'Status'], ['manufacturer', 'Manufacturer']] : [['', 'No grouping'], ['status', 'Status'], ['manufacturer', 'Manufacturer'], ['discipline', 'Discipline']];

  const cellHtml = (c, r) => {
    const v = r[c.key];
    if (c.key === 'code') return `<a href="#/projects/${p.id}/specs/${r.specId}">${codeTag(v)}</a>`;
    if (c.key === 'name') return `<div class="row gap-8">${thumb(r.imageId)}<span><b>${esc(v)}</b>${r.libraryCode ? `<div class="tiny faint">${esc(r.libraryCode)}</div>` : ''}</span></div>`;
    if (c.status) return statusBadge(v);
    if (c.key === 'quantity') return v == null ? '<span class="faint">—</span>' : `<b>${fmtNum(v)}</b>${r.linked ? ' <span class="tiny faint" title="Linked to room measurement">↔</span>' : ''}`;
    if (c.key === 'space' && r.spaceId) return `<a href="#/projects/${p.id}/spaces/${r.spaceId}">${esc(v)}</a>`;
    if (c.num) return v == null || v === '' ? '—' : fmtNum(v);
    if (r.unassigned && (c.key === 'space' || c.key === 'spaces')) return '<span class="badge warn">Not assigned</span>';
    return esc(v ?? '—');
  };

  root.innerHTML = `
    ${projectHeader(p, 'schedules', { actions: `
      <a class="btn" href="#/export/schedule/${p.id}/${type}">${icon('print')}Print / PDF</a>
      <button class="btn" data-action="export" aria-haspopup="menu">${icon('download')}Export</button>` })}
    <div class="row wrap gap-8 mb-24">${SCHEDULES.map((s) => `<a class="chip ${s.key === type ? 'active' : ''}" href="#/projects/${p.id}/schedules/${s.key}">${esc(s.label.replace(' Schedule', ''))} <span class="n">${counts[s.key]}</span></a>`).join('')}</div>
    <div class="panel-title"><h2 class="h2 grow">${esc(sch.label)}</h2>
      <div class="seg" data-mode><button data-m="space" class="${state.mode === 'space' ? 'active' : ''}">By space</button><button data-m="consolidated" class="${state.mode === 'consolidated' ? 'active' : ''}">Consolidated</button></div></div>
    <div class="row wrap gap-8 mb-16">
      <div class="searchbox grow" style="max-width:300px">${icon('search')}<input class="input sm" id="sch-q" placeholder="Search schedule…" value="${esc(state.q)}"/></div>
      <select class="select sm" id="sch-status" style="width:auto"><option value="">All statuses</option>${SPEC_STATUSES.map((s) => `<option value="${s.key}" ${state.status === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
      ${state.mode === 'space' ? `<select class="select sm" id="sch-floor" style="width:auto"><option value="">All floors</option>${floors.map((f) => `<option ${state.floor === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>` : ''}
      <select class="select sm" id="sch-group" style="width:auto">${groupOpts.map(([k, l]) => `<option value="${k}" ${state.group === k ? 'selected' : ''}>${k ? 'Group: ' + l : l}</option>`).join('')}</select>
      <label class="check small"><input type="checkbox" id="sch-money" ${state.money ? 'checked' : ''}/> Show pricing</label>
      <span class="grow"></span><span class="tiny muted">${rows.length} row${rows.length === 1 ? '' : 's'}</span>
    </div>
    ${rows.length ? `<div class="table-wrap"><table class="tbl stack compact">
      <thead><tr>${cols.map((c) => `<th class="sortable ${c.num ? 'num' : ''}" data-sort="${c.key}">${esc(c.label)}${state.sort === c.key ? `<span class="arrow">${state.dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${groups.map((g) => {
        const gt = ScheduleService.totals(g.rows);
        return (g.label != null ? `<tr class="group"><td colspan="${cols.length}" class="no-label">${esc(state.group === 'status' ? (SPEC_STATUSES.find((s) => s.key === g.label)?.label || g.label) : g.label)} <span class="tiny muted" style="font-weight:400">· ${g.rows.length} · ${Object.entries(gt.byUnit).map(([u, q]) => `${fmtNum(q)} ${esc(u)}`).join(' · ')}</span></td></tr>` : '') +
          g.rows.map((r) => `<tr>${cols.map((c) => `<td data-label="${esc(c.label)}" class="${c.num ? 'num' : ''} ${c.key === 'name' ? 'no-label' : ''} ${c.key === 'notes' ? 'small muted' : ''}">${cellHtml(c, r)}</td>`).join('')}</tr>`).join('');
      }).join('')}</tbody>
      <tfoot><tr><td colspan="${cols.length}"><div class="row wrap gap-16"><span>Totals by unit:</span>${Object.entries(totals.byUnit).map(([u, q]) => `<span class="mono">${fmtNum(q)} ${esc(u)}</span>`).join('') || '—'}${state.money && totals.amount != null ? `<span class="grow"></span><span>Amount: <span class="mono">${fmtNum(totals.amount)}</span></span>` : ''}</div></td></tr></tfoot>
    </table></div>` : empty({ title: allRows.length ? 'No rows match the filters' : 'Nothing scheduled yet', text: allRows.length ? '' : 'Add specifications of this discipline and assign them to spaces — they appear here automatically.' })}
    <p class="tiny faint mt-12">Generated ${new Date().toLocaleString('en-GB')} from ${new Set(allRows.map((r) => r.specId)).size} specification(s). Edit quantities in each room or specification — this schedule updates automatically.</p>`;

  const set = (patch) => { Object.assign(state, patch); ctx.rerender(); };
  root.querySelector('#sch-q')?.addEventListener('input', (e) => set({ q: e.target.value }));
  root.querySelector('#sch-status')?.addEventListener('change', (e) => set({ status: e.target.value }));
  root.querySelector('#sch-floor')?.addEventListener('change', (e) => set({ floor: e.target.value }));
  root.querySelector('#sch-group')?.addEventListener('change', (e) => set({ group: e.target.value }));
  root.querySelector('#sch-money')?.addEventListener('change', (e) => set({ money: e.target.checked }));
  root.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]');
    if (m) return set({ mode: m.dataset.m, group: '', floor: '' });
    const th = e.target.closest('[data-sort]');
    if (th) return set(state.sort === th.dataset.sort ? { dir: -state.dir } : { sort: th.dataset.sort, dir: 1 });
    const ex = e.target.closest('[data-action="export"]');
    if (ex) {
      const base = `${safeFilename(p.code)}_${type}_schedule_${state.mode}_${todayStamp()}`;
      const { cols: ecols, data } = exportRows(p.id, type, state.mode, rows);
      const plain = rows.map((r) => Object.fromEntries(ecols.map((c) => [c.label, r[c.key] ?? ''])));
      showMenu(ex, [
        { label: 'CSV (.csv)', icon: 'download', onClick: () => { downloadCSV(plain, base + '.csv'); FileService.trackGenerated({ href: `/projects/${p.id}/schedules/${type}`, label: `${p.code} — ${sch.label}`, kind: 'schedule' }); toast('CSV exported'); } },
        { label: 'Excel (.xls)', icon: 'download', onClick: () => {
          downloadXLS([{ name: sch.label, title: `${p.name} — ${sch.label} (${state.mode === 'space' ? 'by space' : 'consolidated'})`, headers: ecols.map((c) => c.label), rows: data, totals: Object.entries(totals.byUnit).map(([u, q]) => ['Total', u, q]) }], base + '.xls');
          FileService.trackGenerated({ href: `/projects/${p.id}/schedules/${type}`, label: `${p.code} — ${sch.label}`, kind: 'schedule' });
          toast('Excel file exported');
        } },
        { label: 'All schedules → Excel workbook', icon: 'download', onClick: () => {
          const sheets = SCHEDULES.map((s) => {
            const rs = ScheduleService.rows(p.id, s.key, 'consolidated');
            const cs = ScheduleService.columns(s.key, 'consolidated');
            const t = ScheduleService.totals(rs);
            return { name: s.label.replace(' Schedule', ''), title: `${p.name} — ${s.label}`, headers: cs.map((c) => c.label), rows: rs.map((r) => cs.map((c) => r[c.key] ?? '')), totals: Object.entries(t.byUnit).map(([u, q]) => ['Total', u, q]) };
          });
          downloadXLS(sheets, `${safeFilename(p.code)}_all_schedules_${todayStamp()}.xls`);
          toast('Workbook exported');
        } },
      ]);
    }
  });
}
