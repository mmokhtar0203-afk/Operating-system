// Files: metadata in the `files` table, binary content in IndexedDB.
// Records reference files by id (imageIds, datasheetIds, drawingIds, fileIds…).
// A blob is physically deleted only when no record references it any more.
import { db } from './db.js';
import { BlobStore } from '../storage/blob-store.js';
import { Prefs } from '../storage/local-store.js';
import { uid, nowISO } from '../core/utils.js';
import { currentUserName } from './settings-service.js';

const urlCache = new Map(); // id(:thumb) -> objectURL
const MAX_FILE = 25 * 1024 * 1024;

async function makeThumb(blob, max = 520) {
  try {
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * s));
    c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.84));
  } catch { return null; }
}

export const isImage = (meta) => !!meta && /^image\//.test(meta.type || '');
export function extOf(meta) {
  const m = /\.([a-z0-9]{1,5})$/i.exec((meta && meta.name) || '');
  return m ? m[1].toUpperCase() : (meta && meta.type ? meta.type.split('/')[1].slice(0, 4).toUpperCase() : 'FILE');
}

export const FileService = {
  get(id) { return db.get('files', id); },
  all() { return db.all('files'); },

  /** Store a File/Blob. Returns the metadata record. */
  async add(blob, { name, kind = 'document', projectId = null, caption = '' } = {}) {
    if (blob.size > MAX_FILE) throw new Error(`"${name || blob.name}" is larger than 25 MB.`);
    const id = uid('fil');
    const type = blob.type || 'application/octet-stream';
    await BlobStore.put(id, blob);
    let hasThumb = false;
    if (/^image\//.test(type) && !/svg/.test(type) && blob.size > 120 * 1024) {
      const t = await makeThumb(blob);
      if (t) { await BlobStore.put(id + ':thumb', t); hasThumb = true; }
    }
    return db.insert('files', {
      id, name: name || blob.name || 'file', type, size: blob.size, kind, projectId, caption,
      hasThumb, createdBy: currentUserName(),
    });
  },
  async addMany(fileList, opts) {
    const out = [];
    for (const f of fileList) out.push(await this.add(f, { ...opts, name: f.name }));
    return out;
  },
  update(id, patch) { return db.update('files', id, patch); },

  async blob(id) { return BlobStore.get(id); },
  async url(id, { thumb = false } = {}) {
    if (!id) return null;
    const meta = db.get('files', id);
    const key = thumb && meta && meta.hasThumb ? id + ':thumb' : id;
    if (urlCache.has(key)) return urlCache.get(key);
    const blob = await BlobStore.get(key);
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urlCache.set(key, u);
    return u;
  },
  async dataURL(id, { thumb = false } = {}) {
    const meta = db.get('files', id);
    const key = thumb && meta && meta.hasThumb ? id + ':thumb' : id;
    const blob = await BlobStore.get(key);
    if (!blob) return null;
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); });
  },

  /** Fill <img data-file="id"> and [data-file-bg="id"] inside root. */
  hydrate(root = document) {
    root.querySelectorAll('img[data-file]:not([data-hydrated])').forEach(async (img) => {
      img.setAttribute('data-hydrated', '1');
      const u = await this.url(img.dataset.file, { thumb: img.dataset.thumb !== 'full' });
      if (u) img.src = u; else img.replaceWith(Object.assign(document.createElement('span'), { className: 'faint tiny', textContent: 'Missing' }));
    });
    root.querySelectorAll('[data-file-bg]:not([data-hydrated])').forEach(async (el) => {
      el.setAttribute('data-hydrated', '1');
      const u = await this.url(el.dataset.fileBg, { thumb: true });
      if (u) el.style.backgroundImage = `url("${u}")`;
    });
  },

  /** Every record that points at this file. */
  references(id) {
    const refs = [];
    for (const p of db.all('projects')) {
      if (p.coverImageId === id) refs.push({ type: 'project', id: p.id, label: `${p.name} — cover`, href: `/projects/${p.id}` });
      if ((p.fileIds || []).includes(id)) refs.push({ type: 'project', id: p.id, label: `${p.name} — project files`, href: `/projects/${p.id}/files` });
    }
    for (const s of db.all('spaces')) {
      const p = db.get('projects', s.projectId);
      const lbl = `${p ? p.code + ' · ' : ''}${s.name}`;
      if (s.coverImageId === id) refs.push({ type: 'space', id: s.id, label: `${lbl} — cover`, href: `/projects/${s.projectId}/spaces/${s.id}` });
      if ((s.fileIds || []).includes(id)) refs.push({ type: 'space', id: s.id, label: `${lbl} — documents`, href: `/projects/${s.projectId}/spaces/${s.id}?sec=documents` });
      if (((s.measure && s.measure.drawingIds) || []).includes(id)) refs.push({ type: 'space', id: s.id, label: `${lbl} — measurement drawing`, href: `/projects/${s.projectId}/spaces/${s.id}?sec=measurements` });
    }
    const inData = (d) => d && [...(d.imageIds || []), ...(d.datasheetIds || []), ...(d.drawingIds || [])].includes(id);
    for (const l of db.all('library')) if (inData(l.data)) refs.push({ type: 'library', id: l.id, label: `${l.code} ${l.data.name}`, href: `/library/${l.id}` });
    for (const sp of db.all('specs')) {
      const href = `/projects/${sp.projectId}/specs/${sp.id}`;
      if (inData(sp.data)) refs.push({ type: 'spec', id: sp.id, label: `${sp.code} ${sp.data.name}`, href });
      if ((sp.approvals || []).some((a) => (a.fileIds || []).includes(id))) refs.push({ type: 'spec', id: sp.id, label: `${sp.code} — approval evidence`, href });
      for (const r of sp.revisions || []) {
        if (inData(r.data) || (r.approvals || []).some((a) => (a.fileIds || []).includes(id))) { refs.push({ type: 'spec', id: sp.id, label: `${sp.code} — revision ${r.revLabel}`, href }); break; }
      }
    }
    return refs;
  },

  /** Files belonging to (uploaded in or referenced by) a project. */
  forProject(projectId) {
    const ids = new Set();
    const p = db.get('projects', projectId);
    if (!p) return [];
    if (p.coverImageId) ids.add(p.coverImageId);
    (p.fileIds || []).forEach((x) => ids.add(x));
    for (const s of db.where('spaces', (x) => x.projectId === projectId)) {
      if (s.coverImageId) ids.add(s.coverImageId);
      (s.fileIds || []).forEach((x) => ids.add(x));
      ((s.measure && s.measure.drawingIds) || []).forEach((x) => ids.add(x));
    }
    for (const sp of db.where('specs', (x) => x.projectId === projectId)) {
      const d = sp.data || {};
      [...(d.imageIds || []), ...(d.datasheetIds || []), ...(d.drawingIds || [])].forEach((x) => ids.add(x));
      (sp.approvals || []).forEach((a) => (a.fileIds || []).forEach((x) => ids.add(x)));
    }
    db.where('files', (f) => f.projectId === projectId).forEach((f) => ids.add(f.id));
    return [...ids].map((id) => db.get('files', id)).filter(Boolean);
  },

  /** Delete metadata + blob if nothing references the file any more. */
  async collect(id) {
    if (!id || this.references(id).length) return false;
    db.remove('files', id);
    try { await BlobStore.delete(id); await BlobStore.delete(id + ':thumb'); } catch (e) { console.warn(e); }
    for (const k of [id, id + ':thumb']) if (urlCache.has(k)) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); }
    return true;
  },
  /** Force delete: removes references everywhere, then the file. */
  async purge(id) {
    db.batch(() => {
      for (const p of db.all('projects')) {
        if (p.coverImageId === id || (p.fileIds || []).includes(id)) db.update('projects', p.id, (x) => { if (x.coverImageId === id) x.coverImageId = null; x.fileIds = (x.fileIds || []).filter((f) => f !== id); });
      }
      for (const s of db.all('spaces')) {
        const hit = s.coverImageId === id || (s.fileIds || []).includes(id) || ((s.measure && s.measure.drawingIds) || []).includes(id);
        if (hit) db.update('spaces', s.id, (x) => {
          if (x.coverImageId === id) x.coverImageId = null;
          x.fileIds = (x.fileIds || []).filter((f) => f !== id);
          if (x.measure) x.measure.drawingIds = (x.measure.drawingIds || []).filter((f) => f !== id);
        });
      }
      const strip = (d) => { if (!d) return; for (const k of ['imageIds', 'datasheetIds', 'drawingIds']) d[k] = (d[k] || []).filter((f) => f !== id); };
      for (const l of db.all('library')) db.update('library', l.id, (x) => strip(x.data), { touch: false });
      for (const sp of db.all('specs')) db.update('specs', sp.id, (x) => { strip(x.data); (x.approvals || []).forEach((a) => { a.fileIds = (a.fileIds || []).filter((f) => f !== id); }); }, { touch: false });
    });
    return this.collect(id);
  },

  async open(id) {
    const meta = db.get('files', id);
    if (!meta) return;
    this.trackOpen(id);
    const u = await this.url(id);
    if (!u) return;
    if (isImage(meta)) {
      const { lightbox } = await import('../components/modal.js');
      lightbox(u, meta.name);
    } else {
      const w = window.open(u, '_blank');
      if (!w) this.download(id);
    }
  },
  async download(id) {
    const meta = db.get('files', id);
    const blob = await BlobStore.get(id);
    if (!meta || !blob) return;
    this.trackOpen(id);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = meta.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  },

  /* Recently accessed documents (per device) */
  trackOpen(id, extra = null) {
    const list = Prefs.get('recentDocs', []).filter((r) => r.id !== id);
    list.unshift({ id, at: nowISO(), ...(extra || {}) });
    Prefs.set('recentDocs', list.slice(0, 20));
  },
  trackGenerated(entry) {
    const id = `gen:${entry.href}`;
    this.trackOpen(id, { generated: true, label: entry.label, href: entry.href, kind: entry.kind });
  },
  recent(limit = 8) {
    return Prefs.get('recentDocs', [])
      .map((r) => (r.generated ? r : { ...r, meta: db.get('files', r.id) }))
      .filter((r) => r.generated || r.meta)
      .slice(0, limit);
  },
  clearCaches() {
    for (const u of urlCache.values()) URL.revokeObjectURL(u);
    urlCache.clear();
  },
};
