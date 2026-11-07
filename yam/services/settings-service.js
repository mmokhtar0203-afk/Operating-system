// Settings and current user (local identity — no authentication in the prototype).
import { db } from './db.js';

export function settings() { return db.meta().settings; }
export function currentUserName() {
  try { return settings().user.name || 'YAM team'; } catch { return 'YAM team'; }
}
export function currency() {
  try { return settings().currency || ''; } catch { return ''; }
}

export const SettingsService = {
  get: settings,
  update(patch) {
    db.setMeta((m) => { m.settings = { ...m.settings, ...patch }; });
  },
  setUser(user) {
    db.setMeta((m) => { m.settings.user = { ...m.settings.user, ...user }; });
  },
};
