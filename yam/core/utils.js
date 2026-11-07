// Core utilities — pure helpers with no knowledge of the domain or storage.

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => (s == null ? '' : String(s).replace(/[&<>"']/g, (c) => ESC[c]));

/** Join an array of strings produced by a mapper (template helper). */
export const each = (arr, fn) => (arr || []).map(fn).join('');

export const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
export const nowISO = () => new Date().toISOString();

export function fmtDate(iso, style = 'medium') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  if (style === 'short') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  if (style === 'long') return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmtDate(iso)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
export function relTime(iso) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}

export function toNum(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
export function round(n, d = 2) {
  if (n == null || !Number.isFinite(n)) return n;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
export function fmtNum(n, d = 2) {
  const v = toNum(n);
  if (v == null) return '—';
  return v.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
export function fmtMoney(n, cur = '') {
  const v = toNum(n);
  if (v == null) return '—';
  return `${cur ? cur + ' ' : ''}${v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
export function fmtBytes(b) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function debounce(fn, ms = 200) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}
export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + (toNum(fn(x)) || 0), 0);

export function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}
export function matches(haystackParts, query) {
  const q = norm(query).trim();
  if (!q) return true;
  const hay = norm(haystackParts.filter(Boolean).join(' '));
  return q.split(/\s+/).every((t) => hay.includes(t));
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export function downloadText(text, filename, type = 'text/plain') {
  downloadBlob(new Blob([text], { type }), filename);
}

export function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
export async function dataURLToBlob(url) {
  const res = await fetch(url);
  return res.blob();
}

export function safeFilename(s) {
  return String(s || 'file').replace(/[^\w\-. ]+/g, '').replace(/\s+/g, '_').slice(0, 80) || 'file';
}
export function initials(name) {
  return String(name || '?').split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0] || '')).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}
export function pad(n, w = 2) { return String(n).padStart(w, '0'); }
export function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
