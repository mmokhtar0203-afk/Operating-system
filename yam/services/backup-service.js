// Full and per-project JSON backups (structured data + embedded files as data URLs).
import { db, SCHEMA_VERSION } from './db.js';
import { BlobStore } from '../storage/blob-store.js';
import { FileService } from './file-service.js';
import { blobToDataURL, dataURLToBlob, uid, nowISO, clone, todayStamp, safeFilename, downloadText } from '../core/utils.js';

async function packFiles(ids) {
  const out = [];
  for (const id of ids) {
    const meta = db.get('files', id);
    if (!meta) continue;
    const blob = await BlobStore.get(id);
    if (!blob) continue;
    const thumb = meta.hasThumb ? await BlobStore.get(id + ':thumb') : null;
    out.push({ meta, data: await blobToDataURL(blob), thumb: thumb ? await blobToDataURL(thumb) : null });
  }
  return out;
}
async function unpackFiles(files, { skipExisting = true } = {}) {
  const entries = [];
  const metas = [];
  for (const f of files || []) {
    if (!f || !f.meta || !f.data) continue;
    if (skipExisting && db.get('files', f.meta.id)) continue;
    entries.push([f.meta.id, await dataURLToBlob(f.data)]);
    if (f.thumb) entries.push([f.meta.id + ':thumb', await dataURLToBlob(f.thumb)]);
    metas.push(f.meta);
  }
  if (entries.length) await BlobStore.putMany(entries);
  return metas;
}

/** Replace every string value equal to an old id with its new id (structure-aware, no regex on JSON). */
function remap(value, map) {
  if (typeof value === 'string') return map.has(value) ? map.get(value) : value;
  if (Array.isArray(value)) return value.map((v) => remap(v, map));
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = remap(v, map);
    return o;
  }
  return value;
}

export const BackupService = {
  async exportAll() {
    const snap = db.snapshot();
    const files = await packFiles(snap.tables.files.map((f) => f.id));
    return { app: 'YAM', type: 'full-backup', schema: SCHEMA_VERSION, exportedAt: nowISO(), db: snap, files };
  },
  async downloadAll() {
    const data = await this.exportAll();
    downloadText(JSON.stringify(data), `YAM_backup_${todayStamp()}.json`, 'application/json');
    return data;
  },
  validateFull(obj) {
    if (!obj || obj.app !== 'YAM') return 'This file is not a YAM backup.';
    if (obj.type === 'project-backup') return 'This is a single-project backup. Use "Restore project" instead.';
    if (!obj.db || !obj.db.tables || !Array.isArray(obj.db.tables.projects)) return 'Backup is missing its database section.';
    return null;
  },
  async importAll(obj) {
    const err = this.validateFull(obj);
    if (err) throw new Error(err);
    await BlobStore.clear();
    FileService.clearCaches();
    const metas = await unpackFiles(obj.files, { skipExisting: false });
    const next = clone(obj.db);
    // keep only file metadata whose blob was restored
    const restored = new Set(metas.map((m) => m.id));
    next.tables.files = (next.tables.files || []).filter((f) => restored.has(f.id));
    db.replaceAll(next);
    return { projects: next.tables.projects.length, files: restored.size };
  },

  /* ---------- Single project ---------- */
  async exportProject(projectId) {
    const project = db.get('projects', projectId);
    if (!project) throw new Error('Project not found');
    const specs = db.where('specs', (s) => s.projectId === projectId);
    const spaces = db.where('spaces', (s) => s.projectId === projectId);
    const libIds = new Set(specs.map((s) => s.libraryId).filter(Boolean));
    const tplIds = new Set(spaces.map((s) => s.templateId).filter(Boolean));
    const fileIds = FileService.forProject(projectId).map((f) => f.id);
    const library = db.all('library').filter((l) => libIds.has(l.id));
    for (const l of library) [...(l.data.imageIds || []), ...(l.data.datasheetIds || [])].forEach((f) => fileIds.includes(f) || fileIds.push(f));
    for (const s of specs) for (const r of s.revisions || []) {
      [...(r.data.imageIds || []), ...(r.data.datasheetIds || []), ...(r.approvals || []).flatMap((a) => a.fileIds || [])].forEach((f) => fileIds.includes(f) || fileIds.push(f));
    }
    return {
      app: 'YAM', type: 'project-backup', schema: SCHEMA_VERSION, exportedAt: nowISO(),
      project, floors: db.where('floors', (f) => f.projectId === projectId), spaces, specs,
      applications: db.where('applications', (a) => a.projectId === projectId),
      library, templates: db.all('templates').filter((t) => tplIds.has(t.id)),
      files: await packFiles(fileIds),
    };
  },
  async downloadProject(projectId) {
    const data = await this.exportProject(projectId);
    downloadText(JSON.stringify(data), `YAM_${safeFilename(data.project.code)}_${todayStamp()}.json`, 'application/json');
    return data;
  },
  validateProject(obj) {
    if (!obj || obj.app !== 'YAM') return 'This file is not a YAM backup.';
    if (obj.type !== 'project-backup') return 'This is a full backup. Use "Restore full backup" in Settings instead.';
    if (!obj.project || !Array.isArray(obj.spaces)) return 'Project backup is incomplete.';
    return null;
  },
  /**
   * mode 'replace': overwrite the existing project with the same id.
   * mode 'copy': import as a new project (all project ids are regenerated).
   */
  async importProject(obj, mode = 'copy') {
    const err = this.validateProject(obj);
    if (err) throw new Error(err);
    let b = clone(obj);
    const exists = !!db.get('projects', b.project.id);
    if (mode === 'copy' && exists) {
      const map = new Map();
      map.set(b.project.id, uid('prj'));
      b.floors.forEach((x) => map.set(x.id, uid('flr')));
      b.spaces.forEach((x) => map.set(x.id, uid('spc')));
      b.specs.forEach((x) => map.set(x.id, uid('spe')));
      b.applications.forEach((x) => map.set(x.id, uid('app')));
      b = { ...b, project: remap(b.project, map), floors: remap(b.floors, map), spaces: remap(b.spaces, map), specs: remap(b.specs, map), applications: remap(b.applications, map) };
      b.project.name = `${b.project.name} (restored)`;
    }
    const metas = await unpackFiles(b.files);
    db.batch(() => {
      if (mode === 'replace' && exists) {
        const pid = b.project.id;
        db.removeWhere('applications', (a) => a.projectId === pid);
        db.removeWhere('specs', (s) => s.projectId === pid);
        db.removeWhere('spaces', (s) => s.projectId === pid);
        db.removeWhere('floors', (f) => f.projectId === pid);
        db.remove('projects', pid);
      }
      for (const m of metas) if (!db.get('files', m.id)) db.insertMany('files', [m]);
      for (const l of b.library || []) if (!db.get('library', l.id)) db.insertMany('library', [l]);
      for (const t of b.templates || []) if (!db.get('templates', t.id)) db.insertMany('templates', [t]);
      db.insertMany('projects', [{ ...b.project, updatedAt: nowISO() }]);
      db.insertMany('floors', b.floors);
      db.insertMany('spaces', b.spaces);
      db.insertMany('specs', b.specs);
      db.insertMany('applications', b.applications);
    });
    return b.project;
  },
};
