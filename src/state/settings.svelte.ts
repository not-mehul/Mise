// The person's preferences. Kept in localStorage for now; the recipe library
// (IndexedDB) arrives with the collection and will hold them alongside it.

import { DEFAULT_SETTINGS, normaliseSettings, type Settings } from '../domain/settings';

const KEY = 'mise.settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normaliseSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

class SettingsState {
  current = $state<Settings>(load());

  update(patch: Partial<Settings>): void {
    this.current = normaliseSettings({ ...this.current, ...patch });
    try {
      localStorage.setItem(KEY, JSON.stringify(this.current));
    } catch {
      // Private mode: the change holds until the app closes.
    }
  }
}

export const settings = new SettingsState();
