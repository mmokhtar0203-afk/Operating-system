// Hash router: "#/projects/:pid/spaces/:sid?tab=x"
const routes = [];
let onRoute = () => {};

export function route(pattern, loader, meta = {}) {
  const keys = [];
  const re = new RegExp(
    '^' + pattern.replace(/\/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$'
  );
  routes.push({ pattern, re, keys, loader, meta });
}

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qstr = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qstr));
  return { path: path || '/', query };
}

export function resolve(path) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { ...r, params };
    }
  }
  return null;
}

export function navigate(path, { replace = false } = {}) {
  const target = '#' + path;
  if (location.hash === target) { onRoute(); return; }
  if (replace) history.replaceState(null, '', target), onRoute();
  else location.hash = path;
}

/** Update query string without adding history noise and without full re-render loops. */
export function setQuery(patch) {
  const { path, query } = parseHash();
  const q = { ...query, ...patch };
  Object.keys(q).forEach((k) => (q[k] === '' || q[k] == null) && delete q[k]);
  const qs = new URLSearchParams(q).toString();
  history.replaceState(null, '', '#' + path + (qs ? '?' + qs : ''));
}

export function startRouter(handler) {
  onRoute = handler;
  window.addEventListener('hashchange', () => onRoute());
  onRoute();
}
