// LocalStorage adapter for structured records (the whole document database is one JSON blob)
// plus a small key/value area for per-device UI preferences.
const DB_KEY = 'yam:db:v1';
const PREF_PREFIX = 'yam:pref:';

export const LocalStore = {
  read() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[LocalStore] could not parse database', e);
      return null;
    }
  },
  /** Throws on quota errors so callers can surface them. */
  write(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  },
  clear() { localStorage.removeItem(DB_KEY); },
  exists() { return localStorage.getItem(DB_KEY) != null; },
  sizeBytes() {
    const raw = localStorage.getItem(DB_KEY) || '';
    return raw.length * 2; // UTF-16
  },
};

export const Prefs = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREF_PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREF_PREFIX + key, JSON.stringify(value)); } catch (e) { console.warn('[Prefs]', e); }
  },
  clearAll() {
    Object.keys(localStorage).filter((k) => k.startsWith(PREF_PREFIX)).forEach((k) => localStorage.removeItem(k));
  },
};
