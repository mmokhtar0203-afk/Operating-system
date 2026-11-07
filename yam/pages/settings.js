// Settings: user & team, defaults, local data (backup / restore / demo data / reset), storage usage.
import { esc, fmtBytes, fmtDateTime, initials } from '../core/utils.js';
import { icon } from '../components/icons.js';
import { pageHead } from '../components/ui.js';
import { confirmDialog, openModal, fieldHtml, readFields } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { pickFiles } from '../components/files-ui.js';
import { db } from '../services/db.js';
import { SettingsService, settings } from '../services/settings-service.js';
import { BackupService } from '../services/backup-service.js';
import { FileService } from '../services/file-service.js';
import { LocalStore, Prefs } from '../storage/local-store.js';
import { BlobStore } from '../storage/blob-store.js';
import { seedDemo, DEMO_PROJECT_IDS } from '../data/seed.js';
import { CURRENCIES } from '../data/models.js';
import { navigate } from '../core/router.js';

export function meta() { return { title: 'Settings', crumbs: [['Settings']] }; }

async function readJsonFile() {
  const [f] = await pickFiles({ accept: 'application/json,.json', multiple: false });
  if (!f) return null;
  try { return JSON.parse(await f.text()); } catch { toast('This file is not valid JSON.', { error: true }); return null; }
}

export async function restoreProjectFlow() {
  const obj = await readJsonFile();
  if (!obj) return;
  const err = BackupService.validateProject(obj);
  if (err) return toast(err, { error: true });
  const exists = !!db.get('projects', obj.project.id);
  openModal({
    title: 'Restore project backup', eyebrow: obj.project.code,
    body: `<p><b>${esc(obj.project.name)}</b> — exported ${fmtDateTime(obj.exportedAt)}</p>
      <p class="small muted">${obj.spaces.length} spaces · ${obj.specs.length} specifications · ${obj.applications.length} applications · ${obj.files.length} files</p>
      ${exists ? `<div class="notice warn mt-12">${icon('alert')}<div>This project already exists. <b>Import as copy</b> keeps your current project untouched. <b>Replace</b> overwrites it with the backup.</div></div>` : ''}`,
    actions: exists ? [{ label: 'Cancel', action: 'cancel' }, { label: 'Replace existing', action: 'replace', kind: 'danger' }, { label: 'Import as copy', action: 'copy', kind: 'primary' }]
      : [{ label: 'Cancel', action: 'cancel' }, { label: 'Restore project', action: 'copy', kind: 'primary' }],
    async onAction(id) {
      if (id === 'replace' && !(await confirmDialog({ title: 'Replace project?', danger: true, confirmText: 'Replace', message: `The current <b>${esc(obj.project.name)}</b> data will be overwritten by the backup.` }))) return false;
      try {
        const p = await BackupService.importProject(obj, id);
        toast('Project restored');
        navigate(`/projects/${p.id}`);
      } catch (e) { toast(e.message, { error: true }); return false; }
    },
  });
}

export function render(root, ctx) {
  const s = settings();
  const counts = Object.fromEntries(['projects', 'spaces', 'library', 'specs', 'applications', 'files', 'templates'].map((t) => [t, db.count(t)]));
  const demoPresent = DEMO_PROJECT_IDS.filter((id) => db.get('projects', id)).length;

  root.innerHTML = `
    ${pageHead({ eyebrow: 'Workspace', title: 'Settings' })}
    <div class="grid g-2" style="gap:24px;align-items:start">
      <div class="card"><div class="card-head"><span class="title">Current user</span></div><div class="card-body">
        <div class="row gap-12 mb-16"><span class="avatar" style="width:42px;height:42px;font-size:14px">${esc(initials(s.user.name))}</span><div><div class="strong">${esc(s.user.name)}</div><div class="small muted">${esc(s.user.role || '')}</div></div></div>
        <form class="form-grid" data-form="user" onsubmit="return false">
          ${fieldHtml({ name: 'name', label: 'Name (recorded on revisions & approvals)', value: s.user.name, required: true })}
          ${fieldHtml({ name: 'role', label: 'Role', value: s.user.role })}
        </form>
        <div class="field mt-16"><label>Switch to team member</label><div class="chips">${(s.team || []).map((n) => `<button class="chip ${n === s.user.name ? 'active' : ''}" data-member="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>
        <div class="field mt-12">${fieldHtml({ name: 'team', label: 'Team members (comma separated)', value: (s.team || []).join(', ') })}</div>
        <p class="tiny faint mt-12">The prototype has no login — this identity is stored on this device only and stamped on revisions, approvals and change logs.</p>
        <div class="row end mt-16"><button class="btn btn-primary" data-action="save-user">Save</button></div>
      </div></div>

      <div class="card"><div class="card-head"><span class="title">Defaults</span></div><div class="card-body">
        <form class="form-grid" onsubmit="return false">
          ${fieldHtml({ name: 'company', label: 'Studio name (on exports)', value: s.company?.name || 'YAM' })}
          ${fieldHtml({ name: 'tagline', label: 'Tagline (on exports)', value: s.company?.tagline || '' })}
          ${fieldHtml({ name: 'currency', label: 'Default currency', type: 'select', value: s.currency, options: CURRENCIES })}
        </form>
        <div class="row end mt-16"><button class="btn btn-primary" data-action="save-defaults">Save</button></div>
      </div></div>

      <div class="card span-all"><div class="card-head"><span class="title">Local data & backup</span><span class="tiny muted" data-usage>Calculating storage…</span></div><div class="card-body">
        <div class="stats mb-24" style="grid-template-columns:repeat(7,1fr)">${Object.entries(counts).map(([k, v]) => `<div class="stat" style="padding:12px 14px"><div class="eyebrow">${k}</div><div class="value" style="font-size:26px">${v}</div></div>`).join('')}</div>
        <div class="grid g-3">
          <div class="col gap-8"><div class="h4">Full backup</div><p class="small muted">Everything — projects, library, templates, settings and all files — in one JSON file.</p>
            <button class="btn" data-action="export-all">${icon('download')}Export full backup</button>
            <button class="btn" data-action="import-all">${icon('upload')}Restore full backup…</button></div>
          <div class="col gap-8"><div class="h4">Single project</div><p class="small muted">Export from a project's menu, or restore a project backup here (as a copy or replacing the existing one).</p>
            <button class="btn" data-action="import-project">${icon('restore')}Restore project backup…</button></div>
          <div class="col gap-8"><div class="h4">Demonstration data</div><p class="small muted">${demoPresent}/3 sample projects present. Loading never overwrites your own records.</p>
            <button class="btn" data-action="load-demo" ${demoPresent === 3 ? 'disabled' : ''}>${icon('database')}Load missing sample projects</button>
            <button class="btn btn-danger" data-action="reset-demo">${icon('restore')}Reset to demonstration data…</button>
            <button class="btn btn-danger" data-action="wipe">${icon('trash')}Erase all local data…</button></div>
        </div>
        <p class="tiny faint mt-24">Data is saved automatically in this browser (LocalStorage for records, IndexedDB for files) and survives refreshes. Clearing browser data removes it — export backups regularly. Last database write: ${LocalStore.exists() ? 'saved' : 'not yet saved'} · ${fmtBytes(LocalStore.sizeBytes())} structured data.</p>
      </div></div>
    </div>`;

  BlobStore.estimate().then((e) => { const el = root.querySelector('[data-usage]'); if (el && e) el.textContent = `Browser storage used ${fmtBytes(e.usage)} of ~${fmtBytes(e.quota)}`; }).catch(() => {});

  root.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-member]');
    if (m) { SettingsService.setUser({ name: m.dataset.member }); toast(`Now working as ${m.dataset.member}`); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'save-user') {
      const v = readFields(a.closest('.card'));
      if (!v.name.trim()) return toast('Name is required', { error: true });
      const team = v.team.split(',').map((x) => x.trim()).filter(Boolean);
      if (!team.includes(v.name.trim())) team.unshift(v.name.trim());
      SettingsService.update({ user: { name: v.name.trim(), role: v.role }, team });
      toast('Saved');
    }
    if (act === 'save-defaults') {
      const v = readFields(a.closest('.card'));
      SettingsService.update({ company: { name: v.company || 'YAM', tagline: v.tagline }, currency: v.currency });
      toast('Defaults saved');
    }
    if (act === 'export-all') {
      a.disabled = true;
      try { const d = await BackupService.downloadAll(); toast(`Backup exported (${d.files.length} files)`); } catch (err) { toast(err.message, { error: true }); }
      a.disabled = false;
    }
    if (act === 'import-all') {
      const obj = await readJsonFile();
      if (!obj) return;
      const err = BackupService.validateFull(obj);
      if (err) return toast(err, { error: true });
      const ok = await confirmDialog({ title: 'Restore full backup?', danger: true, confirmText: 'Replace all data', message: `Backup from ${fmtDateTime(obj.exportedAt)} with ${obj.db.tables.projects.length} project(s) and ${obj.files.length} file(s).`, detail: 'ALL current local data (projects, library, templates, files) will be replaced. Export a backup of the current state first if needed.' });
      if (!ok) return;
      try { const r = await BackupService.importAll(obj); toast(`Restored ${r.projects} project(s), ${r.files} file(s)`); navigate('/'); } catch (e2) { toast(e2.message, { error: true }); }
    }
    if (act === 'import-project') restoreProjectFlow();
    if (act === 'load-demo') {
      a.disabled = true; toast('Loading sample projects…');
      await seedDemo(); toast('Sample projects loaded');
    }
    if (act === 'reset-demo') {
      const ok = await confirmDialog({ title: 'Reset to demonstration data?', danger: true, confirmText: 'Erase & reset', message: 'All projects, library records, templates and files on this device will be erased and replaced by the original demonstration data.', detail: 'This cannot be undone. Export a full backup first if you want to keep your work.' });
      if (!ok) return;
      await wipe();
      toast('Preparing demonstration data…');
      await seedDemo();
      db.flush();
      toast('Demonstration data restored');
      navigate('/');
    }
    if (act === 'wipe') {
      const ok = await confirmDialog({ title: 'Erase all local data?', danger: true, confirmText: 'Erase everything', message: 'Every project, library record, template, file and setting on this device will be permanently deleted.', detail: 'This cannot be undone.' });
      if (!ok) return;
      await wipe();
      const { seedTemplates } = await import('../data/seed.js');
      await seedTemplates();
      db.flush();
      toast('All data erased. Default room templates were kept.');
      navigate('/');
    }
  });
  void ctx;
}

async function wipe() {
  FileService.clearCaches();
  await BlobStore.clear();
  Prefs.clearAll();
  db.reset();
}
