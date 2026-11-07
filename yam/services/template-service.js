// Global room templates. Spaces receive a snapshot; editing a template never rewrites existing spaces.
import { db } from './db.js';
import { clone, uid } from '../core/utils.js';
import { SECTIONS } from '../data/models.js';
import { FIELD_BANK } from '../data/templates.js';

export const TemplateService = {
  all() { return db.all('templates').sort((a, b) => a.name.localeCompare(b.name)); },
  get(id) { return db.get('templates', id); },

  create(name) {
    return db.insert('templates', {
      id: uid('tpl'), name: name || 'New template', description: '', version: 1, builtIn: false,
      sections: SECTIONS.map((s) => ({ key: s.key, enabled: true, fields: clone(FIELD_BANK[s.key] || []) })),
      customMeasures: [],
    });
  },
  duplicate(id) {
    const t = this.get(id);
    if (!t) return null;
    return db.insert('templates', { ...clone(t), id: uid('tpl'), name: `${t.name} (copy)`, version: 1, builtIn: false });
  },
  /** Every saved change increments the template version. */
  update(id, fn) {
    return db.update('templates', id, (t) => { fn(t); t.version = (t.version || 1) + 1; });
  },
  remove(id) { db.remove('templates', id); },
  usage(id) { return db.count('spaces', (s) => s.templateId === id); },

  /** Deep-copied documentation structure for a new space. */
  snapshot(templateId) {
    const t = this.get(templateId);
    const base = t ? clone(t.sections) : SECTIONS.map((s) => ({ key: s.key, enabled: true, fields: clone(FIELD_BANK[s.key] || []) }));
    // make sure every standard section exists, in standard order
    const sections = SECTIONS.map((s) => {
      const found = base.find((x) => x.key === s.key) || { key: s.key, enabled: false, fields: [] };
      return { key: s.key, enabled: !!found.enabled, fields: found.fields || [], values: {}, notes: '' };
    });
    return { sections, customMeasures: t ? clone(t.customMeasures || []) : [] };
  },

  /** Fields/sections in the current template version that a space doesn't have yet (non-destructive sync). */
  pendingAdditions(space) {
    const t = this.get(space.templateId);
    if (!t || !space.doc || (space.templateVersion || 0) >= t.version) return null;
    const additions = [];
    for (const ts of t.sections) {
      const ss = space.doc.sections.find((x) => x.key === ts.key);
      if (!ss) continue;
      for (const f of ts.fields) if (!ss.fields.some((x) => x.key === f.key)) additions.push({ section: ts.key, field: f });
    }
    return { version: t.version, additions };
  },
};
