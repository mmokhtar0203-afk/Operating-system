// Projects, floors and spaces.
import { db } from './db.js';
import { clone, uid, nowISO } from '../core/utils.js';
import { newProject, newMeasureSet, MEASURE_DEFS } from '../data/models.js';
import { TemplateService } from './template-service.js';
import { FileService } from './file-service.js';

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

export function deriveCode(name) {
  const w = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!w.length) return 'PRJ';
  return (w[0].length >= 3 ? w[0].slice(0, 3) : w.map((x) => x[0]).join('').slice(0, 3)).padEnd(3, 'X');
}

export const ProjectService = {
  /* ---------- Projects ---------- */
  all({ includeArchived = true } = {}) {
    return db.all('projects').filter((p) => includeArchived || p.status !== 'archived')
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },
  get(id) { return db.get('projects', id); },
  codeTaken(code, exceptId) { return db.all('projects').some((p) => p.code === code && p.id !== exceptId); },

  create(data, { floors = ['Ground Floor'] } = {}) {
    return db.batch(() => {
      const p = db.insert('projects', newProject({ ...data, code: (data.code || deriveCode(data.name)).toUpperCase() }));
      floors.forEach((name, i) => this.addFloor(p.id, { name, level: i }));
      return p;
    });
  },
  update(id, patch) { return db.update('projects', id, patch); },
  touch(id) { if (id) db.update('projects', id, {}); },
  archive(id, archived = true) { return db.update('projects', id, { status: archived ? 'archived' : 'active' }); },
  async remove(id) {
    const fileIds = FileService.forProject(id).map((f) => f.id);
    db.batch(() => {
      db.removeWhere('applications', (a) => a.projectId === id);
      db.removeWhere('specs', (s) => s.projectId === id);
      db.removeWhere('spaces', (s) => s.projectId === id);
      db.removeWhere('floors', (f) => f.projectId === id);
      db.remove('projects', id);
      for (const f of fileIds) { const m = db.get('files', f); if (m && m.projectId === id) db.update('files', f, { projectId: null }, { touch: false }); }
    });
    for (const f of fileIds) await FileService.collect(f);
  },

  /* ---------- Floors ---------- */
  floors(projectId) { return db.where('floors', (f) => f.projectId === projectId).sort(byOrder); },
  addFloor(projectId, { name, level = null, code = '' }) {
    const existing = this.floors(projectId);
    const lv = level ?? existing.length;
    const autoCode = code || (lv < 0 ? `B${-lv}` : lv === 0 ? 'GF' : `L${lv}`);
    const f = db.insert('floors', { id: uid('flr'), projectId, name: name || `Level ${lv}`, level: lv, code: autoCode, order: existing.length });
    this.touch(projectId);
    return f;
  },
  updateFloor(id, patch) { const f = db.update('floors', id, patch); if (f) this.touch(f.projectId); return f; },
  moveFloor(id, dir) {
    const f = db.get('floors', id);
    const list = this.floors(f.projectId);
    const i = list.findIndex((x) => x.id === id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    db.batch(() => {
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((x, k) => db.update('floors', x.id, { order: k }, { touch: false }));
    });
  },
  /** Delete a floor; its spaces are moved to `moveTo` or deleted. */
  removeFloor(id, { moveTo = null } = {}) {
    const f = db.get('floors', id);
    if (!f) return;
    db.batch(() => {
      for (const s of this.spaces(f.projectId, id)) {
        if (moveTo) this.moveSpace(s.id, moveTo); else this.removeSpace(s.id);
      }
      db.remove('floors', id);
      this.touch(f.projectId);
    });
  },

  /* ---------- Spaces ---------- */
  spaces(projectId, floorId = null) {
    const floors = this.floors(projectId);
    const fIndex = Object.fromEntries(floors.map((f, i) => [f.id, i]));
    return db.where('spaces', (s) => s.projectId === projectId && (!floorId || s.floorId === floorId))
      .sort((a, b) => (fIndex[a.floorId] ?? 99) - (fIndex[b.floorId] ?? 99) || byOrder(a, b));
  },
  space(id) { return db.get('spaces', id); },
  nextSpaceCode(projectId, floorId) {
    const fl = db.get('floors', floorId);
    const prefix = (fl && fl.code) || 'SP';
    const nums = this.spaces(projectId, floorId).map((s) => parseInt(String(s.code || '').split('-').pop(), 10)).filter(Number.isFinite);
    return `${prefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`;
  },
  addSpace(projectId, { floorId, name, templateId, code }) {
    const tpl = TemplateService.get(templateId);
    const snap = TemplateService.snapshot(templateId);
    const measure = newMeasureSet();
    for (const cm of snap.customMeasures || []) measure.items.push({ ...clone(cm), value: null, override: null, core: false, source: '', notes: '' });
    const s = db.insert('spaces', {
      id: uid('spc'), projectId, floorId, name: name || (tpl ? tpl.name : 'New space'),
      code: code || this.nextSpaceCode(projectId, floorId),
      typeName: tpl ? tpl.name : 'Custom', templateId: tpl ? tpl.id : null, templateVersion: tpl ? tpl.version : 0,
      order: this.spaces(projectId, floorId).length,
      coverImageId: null, fileIds: [], doc: { sections: snap.sections }, measure,
    });
    this.touch(projectId);
    return s;
  },
  updateSpace(id, patch) { const s = db.update('spaces', id, patch); if (s) this.touch(s.projectId); return s; },
  mutateSpace(id, fn) { const s = db.update('spaces', id, fn); if (s) this.touch(s.projectId); return s; },

  duplicateSpace(id, { withItems = true } = {}) {
    const src = db.get('spaces', id);
    if (!src) return null;
    return db.batch(() => {
      const copy = clone(src);
      copy.id = uid('spc');
      copy.name = `${src.name} (copy)`;
      copy.code = this.nextSpaceCode(src.projectId, src.floorId);
      copy.order = this.spaces(src.projectId, src.floorId).length;
      delete copy.createdAt;
      const s = db.insert('spaces', copy);
      if (withItems) {
        for (const a of db.where('applications', (x) => x.spaceId === id)) {
          const c = clone(a);
          delete c.createdAt;
          db.insert('applications', { ...c, id: uid('app'), spaceId: s.id });
        }
      }
      this.touch(src.projectId);
      return s;
    });
  },
  moveSpace(id, floorId) {
    const s = db.get('spaces', id);
    if (!s || s.floorId === floorId) return s;
    return db.update('spaces', id, { floorId, order: this.spaces(s.projectId, floorId).length });
  },
  reorderSpace(id, dir) {
    const s = db.get('spaces', id);
    const list = this.spaces(s.projectId, s.floorId);
    const i = list.findIndex((x) => x.id === id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    db.batch(() => {
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((x, k) => db.update('spaces', x.id, { order: k }, { touch: false }));
    });
  },
  removeSpace(id) {
    const s = db.get('spaces', id);
    if (!s) return;
    const fileIds = [...(s.fileIds || []), ...((s.measure && s.measure.drawingIds) || []), s.coverImageId].filter(Boolean);
    db.batch(() => {
      db.removeWhere('applications', (a) => a.spaceId === id);
      db.remove('spaces', id);
      this.touch(s.projectId);
    });
    fileIds.forEach((f) => FileService.collect(f));
  },

  /* ---------- Space documentation (snapshot, editable per space) ---------- */
  setFieldValue(spaceId, sectionKey, fieldKey, value) {
    return this.mutateSpace(spaceId, (s) => {
      const sec = s.doc.sections.find((x) => x.key === sectionKey);
      if (sec) sec.values[fieldKey] = value;
    });
  },
  setSectionNotes(spaceId, sectionKey, notes) {
    return this.mutateSpace(spaceId, (s) => { const sec = s.doc.sections.find((x) => x.key === sectionKey); if (sec) sec.notes = notes; });
  },
  toggleSection(spaceId, sectionKey, enabled) {
    return this.mutateSpace(spaceId, (s) => { const sec = s.doc.sections.find((x) => x.key === sectionKey); if (sec) sec.enabled = enabled; });
  },
  addCustomField(spaceId, sectionKey, { label, type = 'text', options = [] }) {
    return this.mutateSpace(spaceId, (s) => {
      const sec = s.doc.sections.find((x) => x.key === sectionKey);
      if (!sec) return;
      const key = 'cf_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20) + '_' + uid('').slice(-4);
      sec.fields.push({ key, label, type, options, custom: true });
    });
  },
  removeField(spaceId, sectionKey, fieldKey) {
    return this.mutateSpace(spaceId, (s) => {
      const sec = s.doc.sections.find((x) => x.key === sectionKey);
      if (!sec) return;
      sec.fields = sec.fields.filter((f) => f.key !== fieldKey);
      delete sec.values[fieldKey];
    });
  },
  /** Apply new fields from a newer template version without touching existing values. */
  applyTemplateAdditions(spaceId) {
    const s = db.get('spaces', spaceId);
    const pending = TemplateService.pendingAdditions(s);
    if (!pending) return 0;
    this.mutateSpace(spaceId, (x) => {
      for (const add of pending.additions) {
        const sec = x.doc.sections.find((y) => y.key === add.section);
        if (sec && !sec.fields.some((f) => f.key === add.field.key)) sec.fields.push(clone(add.field));
      }
      x.templateVersion = pending.version;
    });
    return pending.additions.length;
  },
  dismissTemplateUpdate(spaceId) {
    const s = db.get('spaces', spaceId);
    const t = TemplateService.get(s.templateId);
    if (t) this.updateSpace(spaceId, { templateVersion: t.version });
  },
  addSpaceFiles(spaceId, ids) { return this.mutateSpace(spaceId, (s) => { s.fileIds = [...(s.fileIds || []), ...ids]; }); },
  removeSpaceFile(spaceId, id) {
    this.mutateSpace(spaceId, (s) => { s.fileIds = (s.fileIds || []).filter((x) => x !== id); if (s.coverImageId === id) s.coverImageId = null; });
    FileService.collect(id);
  },
  addProjectFiles(projectId, ids) { return db.update('projects', projectId, (p) => { p.fileIds = [...(p.fileIds || []), ...ids]; }); },
  removeProjectFile(projectId, id) {
    db.update('projects', projectId, (p) => { p.fileIds = (p.fileIds || []).filter((x) => x !== id); if (p.coverImageId === id) p.coverImageId = null; });
    FileService.collect(id);
  },

  stats(projectId) {
    return {
      floors: db.count('floors', (f) => f.projectId === projectId),
      spaces: db.count('spaces', (s) => s.projectId === projectId),
      specs: db.count('specs', (s) => s.projectId === projectId),
      applications: db.count('applications', (a) => a.projectId === projectId),
    };
  },
  measureDefs: MEASURE_DEFS,
  now: nowISO,
};
