// Visual Material Board — editorial landscape presentation of project selections.
import { esc } from '../core/utils.js';
import { db } from '../services/db.js';
import { ProjectService } from '../services/project-service.js';
import { SpecService, revLabel } from '../services/spec-service.js';
import { DISCIPLINES, ATTR_PROFILES } from '../data/models.js';
import { sheetHead, sheetFoot, img } from './print-kit.js';

const CAP = { 3: 3, 4: 8, 5: 10 };

function techLine(spec) {
  const d = spec.data, a = d.attrs || {};
  const prof = ATTR_PROFILES[DISCIPLINES[spec.discipline]?.profile] || [];
  if (spec.discipline === 'lighting') return [a.wattage && `${a.wattage} W`, a.cct && `${a.cct} K`, a.beam && `${a.beam}°`, a.cri && `CRI ${a.cri}`, a.ip, a.dimming].filter(Boolean).join(' · ');
  if (spec.discipline === 'electrical') return [a.type, a.voltage && `${a.voltage} V`, a.amperage && `${a.amperage} A`, a.gangs].filter(Boolean).join(' · ');
  const first = prof.filter((p) => a[p.key] && p.type !== 'textarea').slice(0, 2).map((p) => a[p.key]);
  return [d.dimensions, ...first, ...(d.specs || []).slice(0, 1).map((s) => `${s.k}: ${s.v}`)].filter(Boolean).join(' · ');
}

/**
 * opts: { spaceId?, disciplines: [], cols: 3|4|5, cover: bool }
 */
export function buildMaterialBoard(projectId, opts) {
  const project = ProjectService.get(projectId);
  const space = opts.spaceId ? ProjectService.space(opts.spaceId) : null;
  let specs = SpecService.forProject(projectId).filter((s) => opts.disciplines.includes(s.discipline));
  if (space) {
    const ids = new Set(SpecService.applications({ spaceId: space.id }).map((a) => a.specId));
    specs = specs.filter((s) => ids.has(s.id));
  }
  const cols = opts.cols || 4;
  const cap = CAP[cols];
  const head = sheetHead({ docType: 'Material Board', docNo: `${project.code}-MB${space ? '-' + space.code : ''}`, meta: [space ? `${space.name}` : 'Project selection'] });
  const sheets = [];

  if (opts.cover) {
    const hero = space?.coverImageId || project.coverImageId;
    const counts = Object.entries(DISCIPLINES).map(([k, d]) => [d.label, specs.filter((s) => s.discipline === k).length]).filter(([, n]) => n);
    sheets.push(`${head}<div class="b-cover">
      <div class="img" ${hero ? `data-file-bg="${esc(hero)}"` : ''}>${hero ? img(hero).replace('<img', '<img style="width:100%;height:100%;object-fit:cover"') : ''}</div>
      <div style="display:flex;flex-direction:column;justify-content:flex-end">
        <div class="s-eyebrow">${esc(project.type)} · ${esc(project.code)}</div>
        <div class="s-title" style="font-size:40pt;margin-top:3mm">${esc(space ? space.name : project.name)}</div>
        <div class="s-sub" style="font-size:11pt">${space ? esc(project.name) + ' · ' : ''}${esc(project.client || '')}</div>
        <div class="s-sub">${esc(project.location || '')}</div>
        <div style="margin-top:10mm;border-top:0.5pt solid #1E1C19;padding-top:3mm">
          ${counts.map(([l, n]) => `<div style="display:flex;justify-content:space-between;padding:1.2mm 0;border-bottom:0.3pt solid #E2DCD1"><span>${esc(l)}</span><span class="code">${n}</span></div>`).join('')}
          <div style="display:flex;justify-content:space-between;padding:1.6mm 0;font-weight:600"><span>Selections</span><span class="code">${specs.length}</span></div>
        </div>
      </div></div>`);
  }

  const groups = Object.keys(DISCIPLINES).map((k) => [k, specs.filter((s) => s.discipline === k)]).filter(([, l]) => l.length);
  for (const [disc, list] of groups) {
    for (let i = 0; i < list.length; i += cap) {
      const chunk = list.slice(i, i + cap);
      sheets.push(`${head}
        <div class="b-group"><span>${esc(DISCIPLINES[disc].label)}</span><span class="code" style="font-size:8pt">${DISCIPLINES[disc].prefix} · ${list.length} item${list.length > 1 ? 's' : ''}${list.length > cap ? ` · ${Math.floor(i / cap) + 1}/${Math.ceil(list.length / cap)}` : ''}</span></div>
        <div class="b-grid c${cols}">${chunk.map((s) => {
          const d = s.data;
          const spaces = [...new Set(SpecService.applications({ specId: s.id }).map((a) => db.get('spaces', a.spaceId)?.name).filter(Boolean))];
          return `<div class="b-card">${(d.imageIds || [])[0] ? img(d.imageIds[0]).replace('<img', `<img style="aspect-ratio:${cols === 3 ? '1' : '4/3'}"`) : `<div class="ph" style="aspect-ratio:${cols === 3 ? '1' : '4/3'};background:${esc(d.colourHex || '#F0ECE4')}"></div>`}
            <div class="b-code"><span>${esc(s.code)}</span><span style="color:#A8A196">${esc(s.libraryCode || 'Custom')}</span></div>
            <div class="b-name">${esc(d.name)}</div>
            <div class="b-meta">${d.colour ? `<span>Colour</span> ${esc(d.colour)}<br>` : ''}${d.finish ? `<span>Finish</span> ${esc(d.finish)}<br>` : ''}${d.manufacturer ? `<span>By</span> ${esc(d.manufacturer)}${d.reference ? ' — ' + esc(d.reference) : ''}<br>` : ''}${techLine(s) ? `<span>Tech</span> ${esc(techLine(s))}<br>` : ''}${!space && spaces.length ? `<span>In</span> ${esc(spaces.slice(0, 4).join(', '))}${spaces.length > 4 ? ` +${spaces.length - 4}` : ''}<br>` : ''}<span>Status</span> ${esc(s.status)} ${revLabel(s.rev)}</div>
          </div>`;
        }).join('')}</div>`);
    }
  }
  if (!groups.length) sheets.push(`${head}<div style="padding:30mm 0;text-align:center;color:#A8A196;font-size:12pt">No selections match the chosen options.</div>`);
  const footL = `${project.code} · ${project.name}${space ? ' · ' + space.name : ''}`;
  return sheets.map((h, i) => `<div class="sheet board">${h}${sheetFoot(footL, i + 1, sheets.length)}</div>`).join('');
}
