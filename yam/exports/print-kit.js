// Shared building blocks for printable YAM documents + standalone HTML download.
import { esc, fmtDate, safeFilename, blobToDataURL } from '../core/utils.js';
import { FileService } from '../services/file-service.js';
import { settings } from '../services/settings-service.js';

export function sheetHead({ docType, docNo = '', meta = [] }) {
  const s = settings();
  return `<div class="s-head">
    <div class="s-brand">${esc((s.company && s.company.name) || 'YAM')}<small>${esc((s.company && s.company.tagline) || 'Architecture & Interiors')}</small></div>
    <div class="s-doc"><b>${esc(docType)}</b><br>${docNo ? `${esc(docNo)}<br>` : ''}${meta.map((m) => esc(m)).join('<br>')}</div>
  </div>`;
}
export function sheetFoot(left, page, total) {
  return `<div class="s-foot"><span>${esc(left)}</span><span>Issued ${fmtDate(new Date().toISOString())}</span><span>${page && total ? `Sheet ${page} / ${total}` : ''}</span></div>`;
}
export function img(fileId, cls = '') {
  return fileId ? `<img class="${cls}" data-file="${esc(fileId)}" data-thumb="full" alt=""/>` : `<div class="ph ${cls}"></div>`;
}
export function secHead(n, t) {
  return `<div class="s-sec-h"><span class="n">${esc(n)}</span><span class="t">${esc(t)}</span></div>`;
}

/** Wait until all images in el are loaded (so print captures them). */
export async function imagesReady(el, timeout = 4000) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.race([
    Promise.all(imgs.map((i) => (i.complete && i.src ? null : new Promise((r) => { i.onload = r; i.onerror = r; })))),
    new Promise((r) => setTimeout(r, timeout)),
  ]);
}

/** Download the rendered sheets as a self-contained HTML file (images embedded, CSS inlined). */
export async function downloadStandalone(stage, title) {
  const clone = stage.cloneNode(true);
  for (const im of clone.querySelectorAll('img[data-file]')) {
    const u = await FileService.dataURL(im.dataset.file, { thumb: false });
    if (u) im.src = u;
    im.removeAttribute('data-hydrated');
  }
  let css = '';
  for (const href of ['assets/css/base.css', 'assets/css/print.css']) {
    try { css += await (await fetch(href)).text(); } catch { /* offline: skip */ }
  }
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${css}
body{background:#ECE7DE;margin:0;padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:24px}
.sheet{box-shadow:0 4px 30px rgba(0,0,0,.12)}
@media print{body{background:#fff;padding:0;display:block}.sheet{box-shadow:none;page-break-after:always;break-after:page}}
</style></head><body>${clone.innerHTML}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = safeFilename(title) + '.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function printStage(stage) {
  FileService.hydrate(stage);
  await imagesReady(stage);
  window.print();
}

/**
 * Split overflowing sheets: trailing blocks move to continuation sheets that repeat
 * the header and footer. Heights are deterministic (fixed aspect-ratio images), so this
 * runs synchronously after render. Footers are renumbered "Sheet n / N".
 */
export function paginate(stage) {
  const PX_PER_MM = 96 / 25.4;
  const sheets = Array.from(stage.querySelectorAll('.sheet'));
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    const land = sh.classList.contains('board') || sh.classList.contains('land');
    const maxH = (land ? 210 : 297) * PX_PER_MM + 1;
    let guard = 0;
    sh.dataset.chain = sh.dataset.chain || 'c' + i + '_' + Math.random().toString(36).slice(2, 7);
    while (sh.offsetHeight > maxH && guard++ < 60) {
      const movable = Array.from(sh.children).filter((c) => !c.classList.contains('s-head') && !c.classList.contains('s-foot'));
      if (movable.length <= 1) break;
      let next = sheets[i + 1];
      if (!next || next.dataset.cont !== sh.dataset.chain) {
        next = document.createElement('div');
        next.className = sh.className;
        next.dataset.cont = sh.dataset.chain;
        next.dataset.chain = sh.dataset.chain;
        const head = sh.querySelector(':scope > .s-head');
        const foot = sh.querySelector(':scope > .s-foot');
        if (head) next.appendChild(head.cloneNode(true));
        if (foot) next.appendChild(foot.cloneNode(true));
        sh.after(next);
        sheets.splice(i + 1, 0, next);
      }
      const anchor = next.querySelector(':scope > .s-head');
      next.insertBefore(movable[movable.length - 1], anchor ? anchor.nextSibling : next.firstChild);
    }
  }
  sheets.forEach((sh, k) => {
    const spans = sh.querySelectorAll(':scope > .s-foot span');
    if (spans.length) spans[spans.length - 1].textContent = `Sheet ${k + 1} / ${sheets.length}`;
  });
  return sheets.length;
}

/** Scale sheets to fit narrow screens (screen only — print uses real size). Call after paginate. */
export function fitStage(stage) {
  const sheet = stage.querySelector('.sheet');
  if (!sheet) return;
  const avail = stage.clientWidth;
  const w = sheet.offsetWidth;
  const s = w > avail && avail > 0 ? Math.max(0.3, (avail - 4) / w) : 1;
  stage.style.setProperty('--fit', String(s));
}
