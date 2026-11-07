// Project-wide schedules — always generated from specs + space applications (never stored).
import { db } from './db.js';
import { SpecService, revLabel } from './spec-service.js';
import { SCHEDULE_MAP, DISCIPLINES, ATTR_PROFILES } from '../data/models.js';
import { round, toNum, cmp, matches } from '../core/utils.js';

const BASE = [
  { key: 'code', label: 'Code', mono: true },
  { key: 'name', label: 'Item' },
];
const TAIL = [
  { key: 'quantity', label: 'Qty', num: true },
  { key: 'unit', label: 'Unit' },
  { key: 'unitPrice', label: 'Rate', num: true, money: true, optional: true },
  { key: 'total', label: 'Amount', num: true, money: true, optional: true },
  { key: 'status', label: 'Status', status: true },
];
const EXTRA = {
  lighting: ['wattage', 'cct', 'beam', 'cri', 'ip', 'dimming'],
  electrical: ['type', 'voltage', 'amperage', 'gangs'],
  furniture: ['dimensions', 'material', 'fabricator'],
  joinery: ['dimensions', 'material', 'fabricator'],
};
function attrLabel(profile, key) {
  const a = (ATTR_PROFILES[profile] || []).find((x) => x.key === key);
  return a ? (a.unit ? `${a.label} (${a.unit})` : a.label) : key;
}

export const ScheduleService = {
  columns(scheduleKey, mode = 'space') {
    const sch = SCHEDULE_MAP[scheduleKey];
    const disc = sch.disciplines.length === 1 ? sch.disciplines[0] : null;
    const cols = [...BASE];
    if (!disc) cols.push({ key: 'discipline', label: 'Discipline' });
    if (mode === 'space') cols.push({ key: 'floor', label: 'Floor' }, { key: 'space', label: 'Space' });
    else cols.push({ key: 'spaces', label: 'Spaces' });
    if (disc && EXTRA[disc]) {
      for (const k of EXTRA[disc]) {
        if (k === 'dimensions') cols.push({ key: 'dimensions', label: 'Dimensions' });
        else cols.push({ key: 'a_' + k, label: attrLabel(disc, k), num: ['wattage', 'cct', 'beam', 'voltage', 'amperage'].includes(k) });
      }
    } else {
      cols.push({ key: 'manufacturer', label: 'Manufacturer' }, { key: 'colourFinish', label: 'Colour / finish' });
    }
    if (disc && EXTRA[disc]) cols.push({ key: 'manufacturer', label: 'Manufacturer' });
    cols.push({ key: 'reference', label: 'Reference' });
    return [...cols, ...TAIL, { key: 'notes', label: 'Notes', optional: true }];
  },

  /** Row per application (by space) or per spec+unit (consolidated). Includes unassigned specs. */
  rows(projectId, scheduleKey, mode = 'space') {
    const sch = SCHEDULE_MAP[scheduleKey];
    const specs = SpecService.forProject(projectId).filter((s) => sch.disciplines.includes(s.discipline));
    const floors = Object.fromEntries(db.where('floors', (f) => f.projectId === projectId).map((f) => [f.id, f]));
    const spaces = Object.fromEntries(db.where('spaces', (s) => s.projectId === projectId).map((s) => [s.id, s]));
    const rows = [];
    for (const spec of specs) {
      const d = spec.data || {};
      const base = {
        specId: spec.id, code: spec.code, name: d.name, discipline: DISCIPLINES[spec.discipline]?.label || spec.discipline,
        manufacturer: [d.manufacturer, d.brand && d.brand !== d.manufacturer ? d.brand : ''].filter(Boolean).join(' / '),
        reference: d.reference, colourFinish: [d.colour, d.finish].filter(Boolean).join(' · '), dimensions: d.dimensions,
        status: spec.status, rev: revLabel(spec.rev), libraryCode: spec.libraryCode || '',
        imageId: (d.imageIds || [])[0] || null,
      };
      for (const [k, v] of Object.entries(d.attrs || {})) base['a_' + k] = v;
      const apps = SpecService.applications({ specId: spec.id }).filter((a) => spaces[a.spaceId]);
      if (mode === 'space') {
        if (!apps.length) rows.push({ ...base, floor: '—', space: 'Not assigned', quantity: null, unit: d.unit, unitPrice: toNum(d.unitPrice), total: null, unassigned: true, notes: d.notes || '' });
        for (const a of apps) {
          const sp = spaces[a.spaceId];
          const fl = floors[sp.floorId];
          const q = SpecService.effectiveQty(a);
          const rate = SpecService.unitPrice(a, spec);
          rows.push({
            ...base, appId: a.id, spaceId: sp.id, floor: fl ? fl.name : '—', floorOrder: fl ? fl.order : 99, space: `${sp.code} ${sp.name}`,
            quantity: q, unit: a.unit, unitPrice: rate, total: q != null && rate != null ? round(q * rate, 2) : null,
            notes: [a.location, a.notes].filter(Boolean).join(' — '), linked: a.qtyMode === 'measure',
          });
        }
      } else {
        const byUnit = new Map();
        for (const a of apps) {
          if (!byUnit.has(a.unit)) byUnit.set(a.unit, []);
          byUnit.get(a.unit).push(a);
        }
        if (!byUnit.size) rows.push({ ...base, spaces: 'Not assigned', spaceCount: 0, quantity: null, unit: d.unit, unitPrice: toNum(d.unitPrice), total: null, unassigned: true, notes: d.notes || '' });
        for (const [unit, list] of byUnit) {
          let q = 0, t = 0, anyRate = false, anyQ = false;
          for (const a of list) {
            const v = SpecService.effectiveQty(a);
            const r = SpecService.unitPrice(a, spec);
            if (v != null) { q += v; anyQ = true; }
            if (v != null && r != null) { t += v * r; anyRate = true; }
          }
          const names = [...new Set(list.map((a) => spaces[a.spaceId].name))];
          rows.push({
            ...base, spaces: names.join(', '), spaceCount: names.length, quantity: anyQ ? round(q, 2) : null, unit,
            unitPrice: toNum(d.unitPrice), total: anyRate ? round(t, 2) : null, notes: d.notes || '',
          });
        }
      }
    }
    return rows;
  },

  filter(rows, { q = '', status = '', floor = '', space = '' } = {}) {
    return rows.filter((r) =>
      (!status || r.status === status) && (!floor || r.floor === floor) && (!space || r.space === space) &&
      matches([r.code, r.name, r.space, r.spaces, r.floor, r.manufacturer, r.reference, r.colourFinish, r.discipline, r.notes, r.libraryCode], q));
  },
  sort(rows, key, dir = 1) {
    if (!key) return rows;
    return rows.slice().sort((a, b) => cmp(a[key], b[key]) * dir || cmp(a.code, b.code));
  },
  group(rows, key) {
    if (!key) return [{ key: null, label: null, rows }];
    const m = new Map();
    for (const r of rows) {
      const k = r[key] ?? '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return [...m.entries()].map(([k, rs]) => ({ key: k, label: k, rows: rs }));
  },
  totals(rows) {
    const byUnit = {};
    let amount = 0, hasAmount = false;
    for (const r of rows) {
      if (r.quantity != null) byUnit[r.unit] = round((byUnit[r.unit] || 0) + r.quantity, 2);
      if (r.total != null) { amount += r.total; hasAmount = true; }
    }
    return { byUnit, amount: hasAmount ? round(amount, 2) : null };
  },
  counts(projectId) {
    const out = {};
    for (const k of Object.keys(SCHEDULE_MAP)) {
      const ds = SCHEDULE_MAP[k].disciplines;
      out[k] = db.count('specs', (s) => s.projectId === projectId && ds.includes(s.discipline));
    }
    return out;
  },
};
