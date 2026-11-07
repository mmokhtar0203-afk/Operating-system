// Global Material & Product Library (MAT-0001 / PRD-0001 codes).
import { db } from './db.js';
import { clone, uid, matches, pad, nowISO } from '../core/utils.js';
import { LIB_CAT_MAP, newSpecData } from '../data/models.js';
import { currentUserName } from './settings-service.js';

export function diffData(a = {}, b = {}) {
  const changes = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === 'attrs' || k === 'supplier') {
      const ka = a[k] || {}, kb = b[k] || {};
      for (const sk of new Set([...Object.keys(ka), ...Object.keys(kb)])) {
        if (JSON.stringify(ka[sk] ?? '') !== JSON.stringify(kb[sk] ?? '')) changes.push({ field: `${k}.${sk}`, from: ka[sk] ?? '', to: kb[sk] ?? '' });
      }
    } else if (JSON.stringify(a[k] ?? '') !== JSON.stringify(b[k] ?? '')) {
      const fmt = (v) => (Array.isArray(v) ? (k.endsWith('Ids') ? `${v.length} file(s)` : v.map((x) => (x.k ? `${x.k}: ${x.v}` : JSON.stringify(x))).join('; ')) : v ?? '');
      changes.push({ field: k, from: fmt(a[k]), to: fmt(b[k]) });
    }
  }
  return changes;
}

export const LibraryService = {
  all() { return db.all('library'); },
  get(id) { return db.get('library', id); },
  byCode(code) { return db.find('library', (l) => l.code.toLowerCase() === String(code).toLowerCase()); },

  query({ q = '', category = '', archived = false, discipline = '' } = {}) {
    return db.all('library')
      .filter((l) => (archived === 'all' ? true : !!l.archived === !!archived))
      .filter((l) => !category || l.category === category)
      .filter((l) => !discipline || (LIB_CAT_MAP[l.category] && LIB_CAT_MAP[l.category].discipline === discipline))
      .filter((l) => matches([l.code, l.data.name, l.data.manufacturer, l.data.brand, l.data.reference, l.data.colour, l.data.finish, LIB_CAT_MAP[l.category]?.label, l.data.description], q))
      .sort((a, b) => a.code.localeCompare(b.code));
  },

  nextCode(category) {
    const series = (LIB_CAT_MAP[category] || {}).kind === 'product' ? 'PRD' : 'MAT';
    let n = db.nextCounter(series);
    while (db.find('library', (l) => l.code === `${series}-${pad(n, 4)}`)) n = db.nextCounter(series);
    return `${series}-${pad(n, 4)}`;
  },

  create(category, data = {}) {
    const cat = LIB_CAT_MAP[category];
    return db.insert('library', {
      id: uid('lib'), code: this.nextCode(category), category, kind: cat ? cat.kind : 'material', archived: false,
      data: newSpecData({ ...data, category: cat ? cat.label : '' }), changeLog: [],
    });
  },
  update(id, nextData, { category } = {}) {
    const prev = db.get('library', id);
    if (!prev) return null;
    const changes = diffData(prev.data, nextData);
    return db.update('library', id, (l) => {
      if (category && category !== l.category) { l.category = category; nextData.category = LIB_CAT_MAP[category]?.label || ''; }
      l.data = clone(nextData);
      if (changes.length) l.changeLog = [{ at: nowISO(), by: currentUserName(), changes }, ...(l.changeLog || [])].slice(0, 50);
    });
  },
  duplicate(id) {
    const src = db.get('library', id);
    if (!src) return null;
    return db.insert('library', {
      ...clone(src), id: uid('lib'), code: this.nextCode(src.category), archived: false, changeLog: [],
      data: { ...clone(src.data), name: `${src.data.name} (copy)` }, createdAt: nowISO(),
    });
  },
  archive(id, archived = true) { return db.update('library', id, { archived }); },
  remove(id) {
    db.batch(() => {
      for (const s of db.where('specs', (x) => x.libraryId === id)) db.update('specs', s.id, { libraryId: null }, { touch: false });
      db.remove('library', id);
    });
  },
  /** Project specifications that reference this library item, with their spaces. */
  usage(id) {
    return db.where('specs', (s) => s.libraryId === id).map((spec) => {
      const apps = db.where('applications', (a) => a.specId === spec.id);
      return { spec, project: db.get('projects', spec.projectId), spaces: apps.map((a) => db.get('spaces', a.spaceId)).filter(Boolean), apps };
    });
  },
};
