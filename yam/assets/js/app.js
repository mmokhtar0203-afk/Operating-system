// YAM — application bootstrap and shell.
import { db } from '../../services/db.js';
import { bus } from '../../core/events.js';
import { route, startRouter, parseHash, resolve, navigate } from '../../core/router.js';
import { esc, initials, debounce } from '../../core/utils.js';
import { icon } from '../../components/icons.js';
import { toast } from '../../components/toast.js';
import { closeMenu } from '../../components/modal.js';
import { bindFileActions } from '../../components/files-ui.js';
import { FileService } from '../../services/file-service.js';
import { SearchService } from '../../services/search-service.js';
import { ProjectService } from '../../services/project-service.js';
import { settings } from '../../services/settings-service.js';
import { seedDemo, seedTemplates } from '../../data/seed.js';
import { Prefs } from '../../storage/local-store.js';

/* ---------------- Routes (pages are loaded on demand) ---------------- */
const P = (name) => () => import(`../../pages/${name}.js`);
route('/', P('dashboard'), { nav: 'dashboard' });
route('/projects', P('projects'), { nav: 'projects' });
route('/projects/:pid', P('project-overview'), { nav: 'projects', pnav: 'overview' });
route('/projects/:pid/spaces', P('project-spaces'), { nav: 'projects', pnav: 'spaces' });
route('/projects/:pid/spaces/:sid', P('space'), { nav: 'projects', pnav: 'spaces' });
route('/projects/:pid/measurements', P('project-measurements'), { nav: 'projects', pnav: 'measurements' });
route('/projects/:pid/specs', P('project-specs'), { nav: 'projects', pnav: 'specs' });
route('/projects/:pid/specs/:specId', P('spec'), { nav: 'projects', pnav: 'specs' });
route('/projects/:pid/schedules', P('schedules'), { nav: 'projects', pnav: 'schedules' });
route('/projects/:pid/schedules/:type', P('schedules'), { nav: 'projects', pnav: 'schedules' });
route('/projects/:pid/files', P('project-files'), { nav: 'projects', pnav: 'files' });
route('/library', P('library'), { nav: 'library' });
route('/library/:id', P('library-item'), { nav: 'library' });
route('/schedules', P('schedules'), { nav: 'schedules' });
route('/documents', P('documents'), { nav: 'documents' });
route('/templates', P('templates'), { nav: 'templates' });
route('/templates/:id', P('template'), { nav: 'templates' });
route('/settings', P('settings'), { nav: 'settings' });
route('/search', P('search'), { nav: 'search' });
route('/export/room/:sid', P('export-room'), { nav: 'documents', wide: true });
route('/export/board/:pid', P('export-board'), { nav: 'documents', wide: true });
route('/export/schedule/:pid/:type', P('export-schedule'), { nav: 'documents', wide: true });

const MAIN_NAV = [
  ['dashboard', '/', 'Dashboard', 'dashboard'],
  ['projects', '/projects', 'Projects', 'projects'],
  ['library', '/library', 'Material & Product Library', 'library'],
  ['schedules', '/schedules', 'Project Schedules', 'schedules'],
  ['documents', '/documents', 'Documents', 'documents'],
  ['templates', '/templates', 'Room Templates', 'templates'],
  ['settings', '/settings', 'Settings', 'settings'],
];
const PROJECT_NAV = [
  ['overview', '', 'Overview', 'home'],
  ['spaces', '/spaces', 'Spaces', 'layers'],
  ['measurements', '/measurements', 'Measurements', 'ruler'],
  ['specs', '/specs', 'Specifications', 'sheet'],
  ['schedules', '/schedules', 'Schedules', 'schedules'],
  ['files', '/files', 'Project Files', 'documents'],
];

/* ---------------- Shell ---------------- */
const app = document.getElementById('app');
let current = { match: null, page: null, path: '/', query: {} };
let renderSeq = 0;

function shellHtml() {
  return `
  <div class="shell" id="shell">
    <aside class="sidebar" id="sidebar" aria-label="Main navigation"></aside>
    <div class="scrim" id="scrim"></div>
    <div class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon menu-btn" id="menu-btn" aria-label="Open navigation">${icon('menu')}</button>
        <nav class="crumbs" id="crumbs" aria-label="Breadcrumb"></nav>
        <div class="topsearch" id="topsearch">
          ${icon('search')}
          <input id="top-q" type="search" placeholder="Search projects, spaces, codes…" autocomplete="off" aria-label="Global search"/>
          <kbd>Ctrl K</kbd>
          <div class="search-pop hidden" id="search-pop"></div>
        </div>
        <a class="btn btn-ghost btn-icon hide-desktop" href="#/search" id="m-search" aria-label="Search" style="display:none">${icon('search')}</a>
        <span class="save-state" id="save-state"><span class="dot"></span><span class="label">Saved locally</span></span>
      </header>
      <main class="view" id="view"></main>
    </div>
    <nav class="tabbar" id="tabbar" aria-label="Mobile navigation"></nav>
  </div>`;
}

function renderSidebar() {
  const meta = current.match ? current.match.meta : {};
  const pid = current.match && current.match.params.pid;
  const project = pid ? ProjectService.get(pid) : null;
  const s = settings();
  const counts = { projects: db.count('projects', (p) => p.status !== 'archived'), library: db.count('library', (l) => !l.archived), templates: db.count('templates') };
  document.getElementById('sidebar').innerHTML = `
    <a class="brand" href="#/"><span class="brand-mark">YAM</span><span class="brand-sub">Construction<br/>Documentation</span></a>
    <nav class="nav">
      ${MAIN_NAV.map(([k, href, label, ic]) => `<a href="#${href}" class="${meta.nav === k ? 'active' : ''}">${icon(ic)}<span>${label}</span>${counts[k] != null ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('')}
    </nav>
    ${project ? `
    <div class="nav-project">
      <div class="nav-project-title"><span class="eyebrow">${esc(project.code)} · Project</span><span class="name">${esc(project.name)}</span></div>
      <nav class="nav">
        ${PROJECT_NAV.map(([k, suffix, label, ic]) => `<a href="#/projects/${project.id}${suffix}" class="${meta.pnav === k ? 'active' : ''}">${icon(ic)}<span>${label}</span></a>`).join('')}
      </nav>
    </div>` : ''}
    <div class="sidebar-foot">
      <span class="avatar">${esc(initials(s.user.name))}</span>
      <div class="grow" style="min-width:0"><div class="small strong truncate">${esc(s.user.name)}</div><div class="tiny muted truncate">${esc(s.user.role || 'YAM team')}</div></div>
      <a class="btn btn-ghost btn-icon btn-sm" href="#/settings" title="Settings">${icon('settings')}</a>
    </div>`;
}

function renderTabbar() {
  const nav = current.match ? current.match.meta.nav : '';
  const t = [['dashboard', '/', 'Home', 'home'], ['projects', '/projects', 'Projects', 'projects'], ['search', '/search', 'Search', 'search'], ['library', '/library', 'Library', 'library']];
  document.getElementById('tabbar').innerHTML = t.map(([k, href, label, ic]) => `<a href="#${href}" class="${nav === k ? 'active' : ''}">${icon(ic)}<span>${label}</span></a>`).join('') +
    `<button id="tab-more">${icon('menu')}<span>More</span></button>`;
}

function renderCrumbs(crumbs) {
  const list = crumbs || [];
  document.getElementById('crumbs').innerHTML = list.map((c, i) => {
    const last = i === list.length - 1;
    return (i ? '<span class="sep">/</span>' : '') + (last || !c[1] ? `<span class="current">${esc(c[0])}</span>` : `<a href="#${esc(c[1])}">${esc(c[0])}</a>`);
  }).join('');
}

/* ---------------- Rendering ---------------- */
async function onRoute() {
  closeMenu();
  document.getElementById('shell').classList.remove('nav-open');
  const { path, query } = parseHash();
  const match = resolve(path);
  const seq = ++renderSeq;
  if (!match) { current = { match: null, page: null, path, query }; renderNotFound(); return; }
  let mod;
  try { mod = await match.loader(); } catch (e) { console.error(e); renderError(e); return; }
  if (seq !== renderSeq) return;
  const samePage = current.path === path;
  current = { match, page: mod, path, query };
  renderPage({ keepScroll: false, samePage });
}

function ctx() {
  return { params: current.match.params, query: parseHash().query, rerender: scheduleRender, navigate };
}

function renderPage({ keepScroll = true } = {}) {
  const { match, page } = current;
  if (!page) return;
  const view = document.getElementById('view');
  view.classList.toggle('wide', !!match.meta.wide);

  // Preserve focus/selection and scroll across data-driven re-renders.
  const ae = document.activeElement;
  let focusSel = null, selStart = null, selEnd = null;
  if (keepScroll && ae && view.contains(ae)) {
    if (ae.id) focusSel = '#' + CSS.escape(ae.id);
    else if (ae.dataset && ae.dataset.fk) focusSel = `[data-fk="${CSS.escape(ae.dataset.fk)}"]`;
    try { selStart = ae.selectionStart; selEnd = ae.selectionEnd; } catch { /* not a text input */ }
  }
  const scrollY = window.scrollY;

  const c = ctx();
  let meta = {};
  try {
    meta = (page.meta && page.meta(c)) || {};
  } catch (e) { console.error(e); }
  if (meta.redirect) { navigate(meta.redirect, { replace: true }); return; }
  document.title = `${meta.title ? meta.title + ' — ' : ''}YAM`;
  renderSidebar();
  renderTabbar();
  renderCrumbs(meta.crumbs || [[meta.title || '']]);

  const root = document.createElement('div');
  root.className = 'page';
  view.replaceChildren(root);
  try {
    page.render(root, c);
  } catch (e) {
    console.error(e);
    root.innerHTML = errorHtml(e);
  }
  FileService.hydrate(root);

  if (keepScroll) {
    window.scrollTo(0, scrollY);
    if (focusSel) {
      const el = root.querySelector(focusSel);
      if (el) {
        el.focus({ preventScroll: true });
        try { if (selStart != null) el.setSelectionRange(selStart, selEnd); } catch { /* ignore */ }
      }
    }
  } else if (!c.query.sec) window.scrollTo(0, 0);
}

let renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => renderPage({ keepScroll: true }), 0);
}

function errorHtml(e) {
  return `<div class="empty"><div class="h3">Something went wrong</div><p>${esc(e && e.message ? e.message : String(e))}</p><a class="btn" href="#/">Back to dashboard</a></div>`;
}
function renderError(e) { document.getElementById('view').innerHTML = errorHtml(e); }
function renderNotFound() {
  renderSidebar(); renderTabbar(); renderCrumbs([['Not found']]);
  document.getElementById('view').innerHTML = `<div class="empty"><div class="h3">Page not found</div><p>The record may have been deleted.</p><a class="btn" href="#/">Back to dashboard</a></div>`;
}

/* ---------------- Global search (top bar) ---------------- */
function bindTopSearch() {
  const input = document.getElementById('top-q');
  const pop = document.getElementById('search-pop');
  let sel = -1;
  const show = debounce(() => {
    const q = input.value.trim();
    if (!q) { pop.classList.add('hidden'); return; }
    const r = SearchService.search(q, { limit: 5 });
    const groups = [
      ['Projects', r.projects.map((x) => [`/projects/${x.item.id}`, `<span class="code-tag">${esc(x.item.code)}</span> ${esc(x.item.name)}`, esc(x.item.client)])],
      ['Spaces', r.spaces.map((x) => [`/projects/${x.item.projectId}/spaces/${x.item.id}`, `<b>${esc(x.item.code)}</b> ${esc(x.item.name)}`, esc(x.project ? x.project.name : '')])],
      ['Project specifications', r.specs.map((x) => [`/projects/${x.item.projectId}/specs/${x.item.id}`, `<span class="code-tag">${esc(x.item.code)}</span> ${esc(x.item.data.name)}`, `${x.usedIn.length} space(s)`])],
      ['Library', r.library.map((x) => [`/library/${x.item.id}`, `<span class="code-tag lib">${esc(x.item.code)}</span> ${esc(x.item.data.name)}`, `used in ${x.usedIn.length} space(s)`])],
      ['Documents', r.files.map((x) => [`/documents?q=${encodeURIComponent(x.item.name)}`, esc(x.item.name), esc(x.project ? x.project.code : '')])],
    ].filter((g) => g[1].length);
    pop.innerHTML = groups.length
      ? groups.map(([t, items]) => `<div class="grp eyebrow">${t}</div>${items.map(([href, html, sub]) => `<a href="#${esc(href)}" data-sr><span class="grow truncate">${html}</span><span class="tiny muted nowrap">${sub}</span></a>`).join('')}`).join('') +
        `<div class="foot">Press Enter for all ${r.total} results</div>`
      : `<div class="foot">No results for “${esc(q)}”</div>`;
    pop.classList.remove('hidden');
    sel = -1;
  }, 120);
  input.addEventListener('input', show);
  input.addEventListener('focus', () => input.value && show());
  input.addEventListener('keydown', (e) => {
    const items = Array.from(pop.querySelectorAll('[data-sr]'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = Math.max(-1, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
      items.forEach((a, i) => a.classList.toggle('sel', i === sel));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sel >= 0 && items[sel]) location.hash = items[sel].getAttribute('href');
      else navigate(`/search?q=${encodeURIComponent(input.value.trim())}`);
      pop.classList.add('hidden'); input.blur();
    } else if (e.key === 'Escape') { pop.classList.add('hidden'); input.blur(); }
  });
  document.addEventListener('mousedown', (e) => { if (!document.getElementById('topsearch').contains(e.target)) pop.classList.add('hidden'); });
  pop.addEventListener('click', () => { pop.classList.add('hidden'); input.value = ''; });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) {
      e.preventDefault();
      if (window.innerWidth <= 720) navigate('/search'); else input.focus();
    }
  });
}

/* ---------------- Boot ---------------- */
async function boot() {
  window.__YAM_BOOTED = true;
  const bootText = document.getElementById('boot-text');
  let existed;
  try { existed = db.init(); } catch (e) { bootText.textContent = 'Could not open local storage: ' + e.message; return; }
  if (!existed) {
    try {
      await seedDemo((msg) => { bootText.textContent = `Preparing demonstration data — ${msg}`; });
      db.flush();
    } catch (e) {
      console.error(e);
      bootText.textContent = 'Could not create demonstration data: ' + e.message;
      return;
    }
  } else if (!db.count('templates')) {
    await seedTemplates();
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  app.innerHTML = shellHtml();
  bindTopSearch();
  bindFileActions(document.getElementById('view'));
  bindFileActions(document.getElementById('modal-root'));
  const shell = document.getElementById('shell');
  document.getElementById('menu-btn').addEventListener('click', () => shell.classList.toggle('nav-open'));
  document.getElementById('scrim').addEventListener('click', () => shell.classList.remove('nav-open'));
  document.getElementById('tabbar').addEventListener('click', (e) => { if (e.target.closest('#tab-more')) shell.classList.add('nav-open'); });
  document.getElementById('sidebar').addEventListener('click', (e) => { if (e.target.closest('a')) shell.classList.remove('nav-open'); });

  const saveEl = document.getElementById('save-state');
  bus.on('save:status', ({ status, error }) => {
    saveEl.className = 'save-state ' + (status === 'saved' ? '' : status);
    saveEl.querySelector('.label').textContent = status === 'saving' ? 'Saving…' : status === 'error' ? 'Save failed' : 'Saved locally';
    if (status === 'error') toast(`Could not save: ${error && error.name === 'QuotaExceededError' ? 'browser storage is full' : error && error.message}`, { error: true });
  });
  bus.on('data:changed', () => { if (current.page && !current.page.manualRender) scheduleRender(); });
  window.addEventListener('beforeunload', () => db.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) db.flush(); });

  Prefs.set('lastOpened', new Date().toISOString());
  startRouter(onRoute);
}

boot();
