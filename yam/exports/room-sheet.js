// Technical Room Sheet — professional A4 documentation of one space.
import { esc, fmtNum } from '../core/utils.js';
import { db } from '../services/db.js';
import { ProjectService } from '../services/project-service.js';
import { SpecService, revLabel } from '../services/spec-service.js';
import { FileService, isImage } from '../services/file-service.js';
import { resolveMeasures } from '../services/measurement-service.js';
import { spaceCompleteness } from '../services/completeness-service.js';
import { SECTION_MAP, ATTR_PROFILES } from '../data/models.js';
import { sheetHead, sheetFoot, img, secHead } from './print-kit.js';

function fieldsKv(sec, cols = 4) {
  const filled = (sec.fields || []).filter((f) => sec.values?.[f.key] != null && String(sec.values[f.key]).trim() !== '');
  if (!filled.length) return '';
  return `<div class="kvs" style="grid-template-columns:repeat(${cols},1fr);margin-bottom:2.5mm">${filled.map((f) => `<div><span class="k">${esc(f.label)}</span><span class="v">${esc(sec.values[f.key])}</span></div>`).join('')}</div>`;
}

function itemTable(space, disc, { attrs = [], showImg = true } = {}) {
  const items = SpecService.spaceItems(space.id, disc);
  if (!items.length) return '<div style="color:#A8A196;font-size:7.5pt;padding:1mm 0">No items specified.</div>';
  const prof = Object.fromEntries((ATTR_PROFILES[disc === 'lighting' ? 'lighting' : 'electrical'] || []).map((a) => [a.key, a]));
  return `<table><thead><tr>${showImg ? '<th style="width:11mm"></th>' : ''}<th style="width:20mm">Code</th><th>Item</th>${attrs.length ? attrs.map((a) => `<th>${esc(prof[a]?.label || a)}</th>`).join('') : '<th>Colour / finish</th>'}<th class="num">Qty</th><th>Unit</th><th>Status</th></tr></thead><tbody>
    ${items.map(({ app, spec }) => {
      const d = spec.data;
      return `<tr>${showImg ? `<td>${(d.imageIds || [])[0] ? img(d.imageIds[0], 'tthumb') : ''}</td>` : ''}
        <td class="code">${esc(spec.code)}${spec.libraryCode ? `<br><span style="color:#A8A196">${esc(spec.libraryCode)}</span>` : ''}</td>
        <td><b>${esc(d.name)}</b><br><span style="color:#7F796F">${esc([d.manufacturer, d.reference].filter(Boolean).join(' · '))}${app.location ? ' — ' + esc(app.location) : ''}</span></td>
        ${attrs.length ? attrs.map((a) => `<td>${esc(d.attrs?.[a] ?? '—')}${prof[a]?.unit && d.attrs?.[a] != null ? ' ' + prof[a].unit : ''}</td>`).join('') : `<td>${esc([d.colour, d.finish].filter(Boolean).join(' · ') || '—')}</td>`}
        <td class="num">${fmtNum(SpecService.effectiveQty(app))}</td><td>${esc(app.unit)}</td><td><span class="pill">${esc(spec.status)} ${revLabel(spec.rev)}</span></td></tr>`;
    }).join('')}</tbody></table>`;
}

function bespokeTable(space, disc) {
  const items = SpecService.spaceItems(space.id, disc);
  if (!items.length) return '<div style="color:#A8A196;font-size:7.5pt;padding:1mm 0">No items specified.</div>';
  return `<table><thead><tr><th style="width:16mm"></th><th style="width:20mm">Code</th><th>Item</th><th>Dimensions</th><th>Material / finish</th><th>Maker</th><th class="num">Qty</th></tr></thead><tbody>
    ${items.map(({ app, spec }) => {
      const d = spec.data, a = d.attrs || {};
      const jn = disc === 'joinery' ? ['elevations', 'sections', 'internal', 'hardware', 'edges', 'finishSpec'].filter((k) => a[k]).map((k) => `<b>${esc(ATTR_PROFILES.joinery.find((x) => x.key === k).label)}:</b> ${esc(a[k])}`).join('<br>') : '';
      return `<tr><td>${(d.imageIds || [])[0] ? img(d.imageIds[0], 'tthumb').replace('class="tthumb"', 'class="tthumb" style="width:14mm;height:14mm"') : ''}</td>
        <td class="code">${esc(spec.code)}</td>
        <td><b>${esc(d.name)}</b>${d.description ? `<br><span style="color:#7F796F">${esc(d.description)}</span>` : ''}${jn ? `<div style="margin-top:1mm;font-size:7pt;line-height:1.5">${jn}</div>` : ''}</td>
        <td>${esc(d.dimensions || '—')}</td><td>${esc([a.material, d.finish].filter(Boolean).join(' / ') || '—')}</td><td>${esc(a.fabricator || d.manufacturer || '—')}</td>
        <td class="num">${fmtNum(SpecService.effectiveQty(app))} ${esc(app.unit)}</td></tr>`;
    }).join('')}</tbody></table>`;
}

function notes(sec) { return sec && sec.notes ? `<div class="notes-box" style="margin-top:2mm">${esc(sec.notes)}</div>` : ''; }

/** Returns HTML for all sheets of the room sheet. */
export function buildRoomSheet(spaceId, opts = { images: true }) {
  const space = ProjectService.space(spaceId);
  const project = ProjectService.get(space.projectId);
  const floor = db.get('floors', space.floorId);
  const res = resolveMeasures(space.measure);
  const comp = spaceCompleteness(space);
  const sec = Object.fromEntries(space.doc.sections.map((s) => [s.key, s]));
  const on = (k) => sec[k] && sec[k].enabled;
  const docNo = `${project.code}-RS-${space.code}`;
  const head = sheetHead({ docType: 'Technical Room Sheet', docNo, meta: [`${project.name}`] });
  const footL = `${project.code} · ${space.code} ${space.name}`;
  const files = (space.fileIds || []).map((id) => FileService.get(id)).filter(Boolean);
  const images = [space.coverImageId, ...files.filter(isImage).map((f) => f.id)].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 8);

  const pages = [];
  // Page 1 — identity, measurements, finishes
  pages.push(`
    <div class="s-eyebrow">${esc(project.code)} · ${esc(floor ? floor.name : '')} · ${esc(space.code)}</div>
    <h1 class="s-title" style="margin-top:2mm">${esc(space.name)}</h1>
    <div class="s-sub">${esc(project.name)} — ${esc(project.type)} for ${esc(project.client || '—')}</div>
    <div class="kvs" style="margin-top:5mm">
      <div><span class="k">Project</span><span class="v">${esc(project.name)}</span></div>
      <div><span class="k">Location</span><span class="v">${esc(project.location || '—')}</span></div>
      <div><span class="k">Floor</span><span class="v">${esc(floor ? floor.name : '—')}</span></div>
      <div><span class="k">Room type</span><span class="v">${esc(space.typeName)}</span></div>
      <div><span class="k">Space code</span><span class="v">${esc(space.code)}</span></div>
      <div><span class="k">Floor area</span><span class="v">${fmtNum(res.floor_area?.value)} m²</span></div>
      <div><span class="k">Ceiling height</span><span class="v">${fmtNum(res.ceiling_height?.value)} m</span></div>
      <div><span class="k">Documented</span><span class="v">${comp.pct}%</span></div>
    </div>
    ${fieldsKv(sec.general) ? `<div class="s-sec">${secHead('01', 'General Information')}${fieldsKv(sec.general)}${notes(sec.general)}</div>` : ''}
    ${opts.images && images.length ? `<div class="s-sec"><div class="s-imgs">${images.slice(0, 4).map((id) => `<figure>${img(id)}<figcaption>${esc(FileService.get(id)?.name || '')}</figcaption></figure>`).join('')}</div></div>` : ''}
    <div class="s-sec">${secHead('02', 'Measurements')}
      <table><thead><tr><th>Measurement</th><th class="num">Value</th><th>Unit</th><th>Method</th><th>Source</th><th>Notes</th></tr></thead><tbody>
      ${space.measure.items.map((it) => { const r = res[it.key] || {}; return `<tr><td>${esc(it.label)}</td><td class="num"><b>${fmtNum(r.value, 3)}</b></td><td>${esc(it.unit)}</td><td>${r.overridden ? `Override — ${esc(it.override.reason)}` : it.mode === 'formula' ? `= ${esc(it.formula)}` : 'Manual'}</td><td>${esc(it.source || '—')}</td><td>${esc(it.notes || '')}</td></tr>`; }).join('')}
      </tbody></table>
      ${(space.measure.openings || []).length ? `<div style="margin-top:2mm;font-size:7.2pt;color:#45413B"><b>Openings:</b> ${space.measure.openings.map((o) => `${esc(o.label || o.type)} ${esc(o.type)} ${fmtNum(o.width)}×${fmtNum(o.height)} m${o.qty > 1 ? ' ×' + o.qty : ''}`).join(' · ')}</div>` : ''}
    </div>
    ${['flooring', 'walls', 'ceiling'].filter(on).map((k) => `<div class="s-sec">${secHead(SECTION_MAP[k].num, SECTION_MAP[k].label)}${fieldsKv(sec[k])}${itemTable(space, k, { showImg: opts.images })}${notes(sec[k])}</div>`).join('')}
  `);
  // Page 2 — services
  const services = ['electrical', 'lighting', 'plumbing', 'equipment'].filter(on);
  if (services.length) pages.push(services.map((k) => `<div class="s-sec">${secHead(SECTION_MAP[k].num, SECTION_MAP[k].label)}${fieldsKv(sec[k])}${itemTable(space, k, { attrs: k === 'lighting' ? ['wattage', 'cct', 'beam', 'cri', 'ip', 'dimming'] : k === 'electrical' ? ['type', 'voltage', 'amperage', 'mounting'] : [], showImg: opts.images })}${notes(sec[k])}</div>`).join('') +
    (SpecService.spaceItems(space.id, 'general').length ? `<div class="s-sec">${secHead('—', 'Other materials')}${itemTable(space, 'general', { showImg: opts.images })}</div>` : ''));
  // Page 3 — furniture & joinery, documents, notes
  const bespoke = ['furniture', 'joinery'].filter(on);
  const docs = files.filter((f) => !isImage(f));
  const p3 = bespoke.map((k) => `<div class="s-sec flow">${secHead(SECTION_MAP[k].num, SECTION_MAP[k].label)}${fieldsKv(sec[k])}${bespokeTable(space, k)}${notes(sec[k])}</div>`).join('') +
    (opts.images && images.length > 4 ? `<div class="s-sec">${secHead('12', 'Reference Images & Drawings')}<div class="s-imgs">${images.slice(4).map((id) => `<figure>${img(id)}<figcaption>${esc(FileService.get(id)?.name || '')}</figcaption></figure>`).join('')}</div></div>` : '') +
    (docs.length || (space.measure.drawingIds || []).length ? `<div class="s-sec">${secHead('12', 'Documents')}<table><tbody>${[...docs, ...(space.measure.drawingIds || []).map((id) => FileService.get(id)).filter(Boolean)].map((f) => `<tr><td>${esc(f.name)}</td><td>${esc(f.kind)}</td><td class="num">${new Date(f.createdAt).toLocaleDateString('en-GB')}</td></tr>`).join('')}</tbody></table>${notes(sec.documents)}</div>` : '');
  if (p3.trim()) pages.push(p3);

  return pages.map((body, i) => `<div class="sheet">${head}${body}${sheetFoot(footL, i + 1, pages.length)}</div>`).join('');
}
