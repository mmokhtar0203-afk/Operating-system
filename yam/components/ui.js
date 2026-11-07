// Small presentational helpers returning HTML strings.
import { esc, fmtNum } from '../core/utils.js';
import { icon } from './icons.js';
import { level } from '../services/completeness-service.js';

export function progress(pct, { label = true } = {}) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return `<div class="progress ${level(p)}" title="Documentation completeness ${p}%"><div class="bar"><i style="width:${p}%"></i></div>${label ? `<span class="pct">${p}%</span>` : ''}</div>`;
}
export function ring(pct) {
  const p = Math.round(pct || 0);
  return `<div class="ring" style="--p:${p}" title="${p}% documented"><span>${p}%</span></div>`;
}
export function statusBadge(status) {
  const lbl = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected', archived: 'Archived', active: 'Active' }[status] || status;
  return `<span class="badge ${esc(status)}">${esc(lbl)}</span>`;
}
export function codeTag(code, lib = false) {
  return code ? `<span class="code-tag ${lib ? 'lib' : ''}">${esc(code)}</span>` : '';
}
export function swatch(hex) {
  return hex ? `<span class="swatch" style="background:${esc(hex)}"></span>` : '';
}
export function thumb(fileId, { size = '', fallback = 'image', full = false } = {}) {
  return `<span class="thumb ${size}">${fileId ? `<img data-file="${esc(fileId)}" ${full ? 'data-thumb="full"' : ''} alt="" loading="lazy"/>` : icon(fallback)}</span>`;
}
export function media(fileId, { fallback = 'image', cls = '', attrs = '', placeholder = '' } = {}) {
  return `<div class="media ${cls}" ${attrs}>${fileId ? `<img data-file="${esc(fileId)}" alt="" loading="lazy"/>` : placeholder || icon(fallback)}</div>`;
}
export function empty({ title, text = '', action = '' }) {
  return `<div class="empty"><div class="h3">${esc(title)}</div>${text ? `<p>${text}</p>` : ''}${action}</div>`;
}
export function qtyText(totals) {
  const e = Object.entries(totals || {});
  if (!e.length) return '<span class="faint">—</span>';
  return e.map(([u, q]) => `<span class="nowrap"><b>${fmtNum(q)}</b> <span class="pill-unit">${esc(u)}</span></span>`).join(' · ');
}
export function pageHead({ eyebrow = '', title, lead = '', actions = '' }) {
  return `<div class="page-head"><div class="titles">${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1 class="h1">${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
export function btn(label, { kind = '', ic = '', act = '', attrs = '', size = '', href = '' } = {}) {
  const cls = `btn ${kind ? 'btn-' + kind : ''} ${size ? 'btn-' + size : ''} ${!label ? 'btn-icon' : ''}`;
  const inner = `${ic ? icon(ic) : ''}${label ? esc(label) : ''}`;
  if (href) return `<a class="${cls}" href="#${esc(href)}" ${attrs}>${inner}</a>`;
  return `<button type="button" class="${cls}" ${act ? `data-action="${esc(act)}"` : ''} ${attrs}>${inner}</button>`;
}
