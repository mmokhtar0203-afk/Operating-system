// Project specifications (ZED-FL-01) and their space applications.
// A spec stores a *snapshot* of library data so later library edits never silently change it.
// Editing an approved spec archives the approved revision and starts a new draft revision.
import { db } from './db.js';
import { clone, uid, nowISO, pad, toNum, round } from '../core/utils.js';
import { DISCIPLINES, newSpecData, LIB_CAT_MAP } from '../data/models.js';
import { currentUserName } from './settings-service.js';
import { measureValue } from './measurement-service.js';
import { diffData } from './library-service.js';
import { FileService } from './file-service.js';

export const revLabel = (n) => `R${pad(n || 0, 2)}`;

function log(spec, action, note = '') {
  spec.history = [{ at: nowISO(), by: currentUserName(), action, note, rev: spec.rev }, ...(spec.history || [])].slice(0, 100);
}
function touchProject(pid) { if (pid) db.update('projects', pid, {}); }

export const SpecService = {
  get(id) { return db.get('specs', id); },
  byCode(code) { return db.find('specs', (s) => s.code.toLowerCase() === String(code).toLowerCase()); },
  forProject(projectId, discipline = null) {
    return db.where('specs', (s) => s.projectId === projectId && (!discipline || s.discipline === discipline))
      .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
  },

  nextCode(projectId, discipline) {
    const p = db.get('projects', projectId);
    const prefix = `${p ? p.code : 'PRJ'}-${(DISCIPLINES[discipline] || DISCIPLINES.general).prefix}-`;
    const nums = db.where('specs', (s) => s.projectId === projectId && s.code.startsWith(prefix))
      .map((s) => parseInt(s.code.slice(prefix.length), 10)).filter(Number.isFinite);
    return prefix + pad((nums.length ? Math.max(...nums) : 0) + 1);
  },

  /** Create from a library item (snapshot) or as a custom project-only product. */
  create(projectId, { discipline, libraryId = null, data = {}, code = '' }) {
    const lib = libraryId ? db.get('library', libraryId) : null;
    const disc = discipline || (lib && LIB_CAT_MAP[lib.category] ? LIB_CAT_MAP[lib.category].discipline : 'general');
    const base = lib ? clone(lib.data) : newSpecData();
    const d = { ...base, ...data };
    if (!d.unit) d.unit = (DISCIPLINES[disc] || {}).unit || 'pcs';
    const spec = {
      id: uid('spe'), projectId, discipline: disc, code: code || this.nextCode(projectId, disc),
      libraryId: lib ? lib.id : null, libraryCode: lib ? lib.code : null, librarySyncedAt: lib ? lib.updatedAt : null,
      status: 'draft', rev: 0, data: d, approvals: [], revisions: [], history: [],
    };
    log(spec, lib ? `Created from library ${lib.code}` : 'Created as custom project item');
    const rec = db.insert('specs', spec);
    touchProject(projectId);
    return rec;
  },

  /**
   * Update spec data. If the spec is approved, the current revision is frozen
   * (data + status + approval evidence) and a new draft revision starts.
   */
  updateData(id, nextData, { reason = '', meta = {} } = {}) {
    const cur = db.get('specs', id);
    if (!cur) return null;
    const changes = diffData(cur.data, nextData);
    const metaChanged = Object.keys(meta).some((k) => meta[k] !== cur[k]);
    if (!changes.length && !metaChanged) return { spec: cur, revised: false, changes };
    let revised = false;
    const next = db.update('specs', id, (s) => {
      Object.assign(s, meta);
      if (changes.length && s.status === 'approved') {
        s.revisions = [{
          rev: s.rev, revLabel: revLabel(s.rev), data: clone(s.data), status: s.status, approvals: clone(s.approvals || []),
          closedAt: nowISO(), closedBy: currentUserName(), reason, changes,
        }, ...(s.revisions || [])];
        s.rev = (s.rev || 0) + 1;
        s.status = 'draft';
        s.approvals = [];
        revised = true;
        log(s, `Revised to ${revLabel(s.rev)} — approval required`, reason);
      } else if (changes.length) {
        log(s, `Edited (${changes.length} field${changes.length > 1 ? 's' : ''})`, reason);
      }
      s.data = clone(nextData);
    });
    touchProject(cur.projectId);
    return { spec: next, revised, changes };
  },

  setStatus(id, status, { note = '', fileIds = [] } = {}) {
    const cur = db.get('specs', id);
    if (!cur) return null;
    const next = db.update('specs', id, (s) => {
      s.status = status;
      s.approvals = [...(s.approvals || []), { id: uid('apr'), status, note, fileIds, by: currentUserName(), at: nowISO(), rev: s.rev }];
      log(s, `Status → ${status}`, note);
    });
    touchProject(cur.projectId);
    return next;
  },
  addEvidence(id, fileIds, note = '') {
    return db.update('specs', id, (s) => {
      s.approvals = [...(s.approvals || []), { id: uid('apr'), status: 'evidence', note, fileIds, by: currentUserName(), at: nowISO(), rev: s.rev }];
      log(s, 'Approval evidence attached', note);
    });
  },

  libraryOutdated(spec) {
    if (!spec.libraryId) return false;
    const lib = db.get('library', spec.libraryId);
    return !!(lib && spec.librarySyncedAt && lib.updatedAt > spec.librarySyncedAt && diffData(spec.data, { ...lib.data, unit: spec.data.unit, unitPrice: spec.data.unitPrice, notes: spec.data.notes, currency: spec.data.currency }).length);
  },
  /** Explicitly pull the latest library data into the spec (creates a revision if approved). */
  syncFromLibrary(id) {
    const spec = db.get('specs', id);
    const lib = spec && db.get('library', spec.libraryId);
    if (!lib) return null;
    const next = { ...clone(lib.data), unit: spec.data.unit, unitPrice: spec.data.unitPrice, currency: spec.data.currency, notes: spec.data.notes };
    const res = this.updateData(id, next, { reason: `Updated from library ${lib.code}` });
    db.update('specs', id, { librarySyncedAt: lib.updatedAt });
    return res;
  },
  acknowledgeLibrary(id) {
    const spec = db.get('specs', id);
    const lib = spec && db.get('library', spec.libraryId);
    if (lib) db.update('specs', id, (s) => { s.librarySyncedAt = lib.updatedAt; log(s, `Kept current data (library ${lib.code} changes ignored)`); });
  },

  duplicate(id) {
    const src = db.get('specs', id);
    if (!src) return null;
    const c = clone(src);
    const rec = db.insert('specs', {
      ...c, id: uid('spe'), code: this.nextCode(src.projectId, src.discipline), status: 'draft', rev: 0, approvals: [], revisions: [],
      history: [{ at: nowISO(), by: currentUserName(), action: `Duplicated from ${src.code}`, rev: 0 }],
      data: { ...c.data, name: `${c.data.name} (copy)` }, createdAt: nowISO(),
    });
    return rec;
  },
  remove(id) {
    const s = db.get('specs', id);
    if (!s) return;
    const fileIds = [...(s.data.imageIds || []), ...(s.data.datasheetIds || []), ...(s.data.drawingIds || []), ...(s.approvals || []).flatMap((a) => a.fileIds || [])];
    db.batch(() => {
      db.removeWhere('applications', (a) => a.specId === id);
      db.remove('specs', id);
      touchProject(s.projectId);
    });
    fileIds.forEach((f) => FileService.collect(f));
  },

  /* ---------------- Applications ---------------- */
  applications(filter = {}) {
    return db.where('applications', (a) =>
      (!filter.projectId || a.projectId === filter.projectId) &&
      (!filter.specId || a.specId === filter.specId) &&
      (!filter.spaceId || a.spaceId === filter.spaceId));
  },
  /** Applications in a space for a discipline (joined with spec). */
  spaceItems(spaceId, discipline) {
    return this.applications({ spaceId })
      .map((a) => ({ app: a, spec: db.get('specs', a.specId) }))
      .filter((x) => x.spec && (!discipline || x.spec.discipline === discipline))
      .sort((a, b) => a.spec.code.localeCompare(b.spec.code, 'en', { numeric: true }));
  },
  addApplication(specId, spaceId, { quantity = null, unit, unitPrice = null, notes = '', qtyMode = 'manual', measureKey = '', wastePct = 0, location = '' } = {}) {
    const spec = db.get('specs', specId);
    if (!spec) return null;
    const a = db.insert('applications', {
      id: uid('app'), projectId: spec.projectId, specId, spaceId, quantity: toNum(quantity), unit: unit || spec.data.unit || 'pcs',
      unitPrice: toNum(unitPrice), notes, qtyMode, measureKey, wastePct: toNum(wastePct) || 0, location,
    });
    touchProject(spec.projectId);
    return a;
  },
  updateApplication(id, patch) {
    const a = db.update('applications', id, patch);
    if (a) touchProject(a.projectId);
    return a;
  },
  removeApplication(id) {
    const a = db.get('applications', id);
    db.remove('applications', id);
    if (a) touchProject(a.projectId);
  },

  /** Quantity actually used: manual, or linked to a space measurement (+ waste %). */
  effectiveQty(app) {
    if (app.qtyMode === 'measure' && app.measureKey) {
      const v = measureValue(db.get('spaces', app.spaceId), app.measureKey);
      if (v == null) return null;
      return round(v * (1 + (toNum(app.wastePct) || 0) / 100), 2);
    }
    return toNum(app.quantity);
  },
  unitPrice(app, spec) {
    return toNum(app.unitPrice) ?? toNum((spec || db.get('specs', app.specId) || { data: {} }).data.unitPrice);
  },
  /** Totals per unit — quantities with different units are never added together. */
  totals(specId) {
    const out = {};
    for (const a of this.applications({ specId })) {
      const q = this.effectiveQty(a);
      if (q == null) continue;
      out[a.unit] = round((out[a.unit] || 0) + q, 3);
    }
    return out;
  },
};
