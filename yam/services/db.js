// Data access layer.
// ---------------------------------------------------------------------------
// All services read/write through this module; nothing else touches storage.
// It keeps an in-memory, local-first cache of every table and persists it to
// LocalStorage (debounced). A future Supabase adapter can hydrate the same
// cache on load and write-through on commit without changing any UI code.
// ---------------------------------------------------------------------------
import { LocalStore } from '../storage/local-store.js';
import { bus } from '../core/events.js';
import { clone, nowISO, debounce } from '../core/utils.js';

export const SCHEMA_VERSION = 1;
export const TABLES = ['projects', 'floors', 'spaces', 'templates', 'library', 'specs', 'applications', 'files'];

let state = null;
let batchDepth = 0;
let dirty = false;

export function emptyState() {
  return {
    schema: SCHEMA_VERSION,
    meta: {
      createdAt: nowISO(),
      seededAt: null,
      counters: { MAT: 0, PRD: 0 },
      settings: {
        user: { name: 'Mariam Mokhtar', role: 'Interior Architect' },
        team: ['Mariam Mokhtar', 'Omar Adel', 'Salma Youssef'],
        company: { name: 'YAM', tagline: 'Architecture & Interiors' },
        currency: 'EGP',
      },
    },
    tables: Object.fromEntries(TABLES.map((t) => [t, []])),
  };
}

function migrate(s) {
  if (!s.tables) s.tables = {};
  for (const t of TABLES) if (!Array.isArray(s.tables[t])) s.tables[t] = [];
  s.meta = s.meta || emptyState().meta;
  s.meta.counters = s.meta.counters || { MAT: 0, PRD: 0 };
  s.meta.settings = { ...emptyState().meta.settings, ...(s.meta.settings || {}) };
  s.schema = SCHEMA_VERSION;
  return s;
}

const persist = debounce(() => {
  try {
    LocalStore.write(state);
    bus.emit('save:status', { status: 'saved', at: nowISO() });
  } catch (e) {
    console.error('[db] save failed', e);
    bus.emit('save:status', { status: 'error', error: e });
  }
}, 250);

function commit() {
  if (batchDepth > 0) { dirty = true; return; }
  bus.emit('save:status', { status: 'saving' });
  persist();
  bus.emit('data:changed');
}

export const db = {
  /** Load from local storage. Returns true if an existing database was found. */
  init() {
    const raw = LocalStore.read();
    if (raw && raw.tables) { state = migrate(raw); return true; }
    state = emptyState();
    return false;
  },
  flush() { if (state) persist.flush(); },
  snapshot() { return clone(state); },
  replaceAll(next) {
    state = migrate(clone(next));
    LocalStore.write(state);
    bus.emit('data:changed');
    bus.emit('save:status', { status: 'saved', at: nowISO() });
  },
  reset() { state = emptyState(); LocalStore.write(state); bus.emit('data:changed'); },

  /** Group several writes into a single save + re-render. */
  batch(fn) {
    batchDepth++;
    try { return fn(); } finally {
      batchDepth--;
      if (batchDepth === 0 && dirty) { dirty = false; commit(); }
    }
  },

  all(table) { return state.tables[table].slice(); },
  get(table, id) { return id ? state.tables[table].find((r) => r.id === id) || null : null; },
  where(table, pred) { return state.tables[table].filter(pred); },
  find(table, pred) { return state.tables[table].find(pred) || null; },
  count(table, pred) { return pred ? state.tables[table].filter(pred).length : state.tables[table].length; },

  insert(table, rec) {
    const r = { createdAt: nowISO(), ...rec, updatedAt: nowISO() };
    state.tables[table].push(r);
    commit();
    return r;
  },
  insertMany(table, recs) {
    const ts = nowISO();
    for (const rec of recs) state.tables[table].push({ createdAt: ts, ...rec, updatedAt: rec.updatedAt || ts });
    commit();
  },
  /** patch may be an object (shallow-merged) or a function that mutates a draft copy. */
  update(table, id, patch, { touch = true } = {}) {
    const arr = state.tables[table];
    const i = arr.findIndex((r) => r.id === id);
    if (i < 0) return null;
    let next;
    if (typeof patch === 'function') { next = clone(arr[i]); patch(next); }
    else next = { ...arr[i], ...patch };
    if (touch) next.updatedAt = nowISO();
    arr[i] = next;
    commit();
    return next;
  },
  remove(table, id) {
    const arr = state.tables[table];
    const i = arr.findIndex((r) => r.id === id);
    if (i >= 0) { arr.splice(i, 1); commit(); }
  },
  removeWhere(table, pred) {
    const before = state.tables[table].length;
    state.tables[table] = state.tables[table].filter((r) => !pred(r));
    if (state.tables[table].length !== before) commit();
  },

  meta() { return state.meta; },
  setMeta(fn) { fn(state.meta); commit(); },
  nextCounter(series) {
    state.meta.counters[series] = (state.meta.counters[series] || 0) + 1;
    commit();
    return state.meta.counters[series];
  },
};
