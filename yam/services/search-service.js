// Global search across projects, spaces, library items, project specs, categories and documents.
import { db } from './db.js';
import { matches, norm } from '../core/utils.js';
import { LIB_CATEGORIES, DISCIPLINES } from '../data/models.js';

function score(fields, q) {
  const nq = norm(q).trim();
  const exact = fields.some((f) => norm(f) === nq);
  const starts = fields.some((f) => norm(f).startsWith(nq));
  return exact ? 3 : starts ? 2 : 1;
}

function spacesForSpec(specId) {
  return db.where('applications', (a) => a.specId === specId)
    .map((a) => ({ app: a, space: db.get('spaces', a.spaceId) }))
    .filter((x) => x.space);
}

export const SearchService = {
  search(q, { limit = 50 } = {}) {
    q = String(q || '').trim();
    const out = { projects: [], spaces: [], library: [], specs: [], categories: [], files: [], total: 0 };
    if (!q) return out;
    const projects = Object.fromEntries(db.all('projects').map((p) => [p.id, p]));

    for (const p of db.all('projects')) {
      const f = [p.name, p.code, p.client, p.type, p.location];
      if (matches(f, q)) out.projects.push({ item: p, score: score(f, q) });
    }
    for (const s of db.all('spaces')) {
      const p = projects[s.projectId];
      const f = [s.name, s.code, s.typeName, p && p.name, p && p.code];
      if (matches(f, q)) {
        const specs = db.where('applications', (a) => a.spaceId === s.id).map((a) => db.get('specs', a.specId)).filter(Boolean);
        out.spaces.push({ item: s, project: p, specs: [...new Map(specs.map((x) => [x.id, x])).values()], score: score([s.name, s.code], q) });
      }
    }
    for (const l of db.all('library')) {
      const d = l.data;
      const f = [l.code, d.name, d.manufacturer, d.brand, d.reference, d.colour, d.finish, d.category];
      if (matches(f, q)) {
        const specs = db.where('specs', (s) => s.libraryId === l.id);
        const usedIn = specs.flatMap((s) => spacesForSpec(s.id).map((x) => ({ ...x, spec: s, project: projects[s.projectId] })));
        out.library.push({ item: l, specs, usedIn, score: score([l.code, d.name, d.reference], q) });
      }
    }
    for (const s of db.all('specs')) {
      const d = s.data;
      const f = [s.code, s.libraryCode, d.name, d.manufacturer, d.reference, d.colour, d.finish, DISCIPLINES[s.discipline]?.label];
      if (matches(f, q)) out.specs.push({ item: s, project: projects[s.projectId], usedIn: spacesForSpec(s.id), score: score([s.code, s.libraryCode, d.name], q) });
    }
    for (const c of LIB_CATEGORIES) {
      if (matches([c.label, c.key], q)) out.categories.push({ item: c, count: db.count('library', (l) => l.category === c.key && !l.archived), score: 1 });
    }
    for (const f of db.all('files')) {
      if (matches([f.name, f.caption, f.kind], q)) out.files.push({ item: f, project: projects[f.projectId], score: score([f.name], q) });
    }
    for (const k of ['projects', 'spaces', 'library', 'specs', 'categories', 'files']) {
      out[k].sort((a, b) => b.score - a.score);
      out[k] = out[k].slice(0, limit);
      out.total += out[k].length;
    }
    return out;
  },
};
