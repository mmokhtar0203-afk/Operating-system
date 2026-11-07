// Technical Room Sheet preview + print/PDF + standalone HTML.
import { esc } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { ProjectService } from '../services/project-service.js';
import { FileService } from '../services/file-service.js';
import { buildRoomSheet } from '../exports/room-sheet.js';
import { printStage, downloadStandalone, paginate, fitStage } from '../exports/print-kit.js';

const opts = { images: true };

export function meta(ctx) {
  const s = ProjectService.space(ctx.params.sid);
  if (!s) return { redirect: '/documents' };
  const p = ProjectService.get(s.projectId);
  return { title: `Room sheet — ${s.name}`, crumbs: [['Projects', '/projects'], [p.name, `/projects/${p.id}`], [s.name, `/projects/${p.id}/spaces/${s.id}`], ['Technical room sheet']] };
}

export function render(root, ctx) {
  const s = ProjectService.space(ctx.params.sid);
  const p = ProjectService.get(s.projectId);
  const spaces = ProjectService.spaces(p.id);
  FileService.trackGenerated({ href: `/export/room/${s.id}`, label: `Room sheet — ${p.code} ${s.name}`, kind: 'sheet' });
  root.innerHTML = `
    <div class="export-bar no-print">
      <a class="btn btn-ghost btn-sm" href="#/projects/${p.id}/spaces/${s.id}">${icon('arrowLeft')}Back to room</a>
      <span class="h4">Technical Room Sheet</span>
      <select class="select sm" id="room" style="width:auto">${spaces.map((x) => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${esc(x.code)} ${esc(x.name)}</option>`).join('')}</select>
      <label class="check small"><input type="checkbox" id="opt-img" ${opts.images ? 'checked' : ''}/> Images</label>
      <span class="grow"></span>
      <button class="btn btn-sm" data-action="html">${icon('download')}Download HTML</button>
      <button class="btn btn-primary btn-sm" data-action="print">${icon('print')}Print / Save as PDF</button>
    </div>
    <div class="tiny muted no-print" style="margin:-12px 0 16px">Tip: in the print dialog choose “Save as PDF”, paper A4, margins “None”, and enable “Background graphics”.</div>
    <div class="export-stage" id="stage">${buildRoomSheet(s.id, opts)}</div>`;
  const stage = root.querySelector('#stage');
  requestAnimationFrame(() => { paginate(stage); fitStage(stage); });
  root.querySelector('#room').addEventListener('change', (e) => ctx.navigate(`/export/room/${e.target.value}`));
  root.querySelector('#opt-img').addEventListener('change', (e) => { opts.images = e.target.checked; ctx.rerender(); });
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'print') printStage(stage);
    if (a.dataset.action === 'html') { await downloadStandalone(stage, `${p.code}_RoomSheet_${s.code}_${s.name}`); toast('Room sheet downloaded'); }
  });
}
