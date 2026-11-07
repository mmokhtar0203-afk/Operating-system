// Documentation completeness — how much of a space/project is *documented*, not built.
import { db } from './db.js';
import { resolveMeasures } from './measurement-service.js';
import { CORE_MEASURE_KEYS, SECTION_MAP } from '../data/models.js';

const SPEC_SECTIONS = ['flooring', 'walls', 'ceiling', 'electrical', 'lighting', 'furniture', 'joinery', 'plumbing', 'equipment'];

export function spaceCompleteness(space) {
  if (!space) return { pct: 0, missing: [] };
  const missing = [];
  // 1. Measurements (30%)
  const res = resolveMeasures(space.measure);
  const measured = CORE_MEASURE_KEYS.filter((k) => res[k] && res[k].value != null).length;
  const mScore = measured / CORE_MEASURE_KEYS.length;
  if (measured < CORE_MEASURE_KEYS.length) missing.push(`${CORE_MEASURE_KEYS.length - measured} measurement(s)`);

  const enabled = (space.doc?.sections || []).filter((s) => s.enabled);
  // 2. Documentation fields (25%)
  let fTotal = 0, fDone = 0;
  for (const s of enabled) for (const f of s.fields || []) {
    fTotal++;
    const v = s.values?.[f.key];
    if (v != null && String(v).trim() !== '') fDone++;
  }
  const fScore = fTotal ? fDone / fTotal : 1;
  if (fTotal && fDone < fTotal) missing.push(`${fTotal - fDone} field(s)`);

  // 3. Specified sections (45%) — every enabled spec section has at least one item
  const apps = db.where('applications', (a) => a.spaceId === space.id);
  const discs = new Set(apps.map((a) => db.get('specs', a.specId)?.discipline).filter(Boolean));
  const secs = enabled.filter((s) => SPEC_SECTIONS.includes(s.key));
  const sDone = secs.filter((s) => discs.has(s.key)).length;
  const sScore = secs.length ? sDone / secs.length : 1;
  for (const s of secs) if (!discs.has(s.key)) missing.push(`no ${SECTION_MAP[s.key].label.toLowerCase()}`);

  const pct = Math.round((mScore * 0.3 + fScore * 0.25 + sScore * 0.45) * 100);
  return { pct, missing, measured, fieldsDone: fDone, fieldsTotal: fTotal, sectionsDone: sDone, sectionsTotal: secs.length };
}

export function projectCompleteness(projectId) {
  const spaces = db.where('spaces', (s) => s.projectId === projectId);
  if (!spaces.length) return { pct: 0, spaces: 0, complete: 0 };
  const scores = spaces.map(spaceCompleteness);
  const pct = Math.round(scores.reduce((a, s) => a + s.pct, 0) / scores.length);
  return { pct, spaces: spaces.length, complete: scores.filter((s) => s.pct >= 90).length };
}

export function level(pct) { return pct >= 75 ? '' : pct >= 40 ? 'mid' : 'lo'; }
