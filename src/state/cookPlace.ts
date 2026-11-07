// Where cooking mode was left: one place, for the recipe last cooked.

import { normalisePlace, type CookPlace } from '../domain/cook';

const KEY = 'mise.cook';

export function loadPlace(): CookPlace | null {
  try {
    return normalisePlace(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export function savePlace(place: CookPlace | null): void {
  try {
    if (place) localStorage.setItem(KEY, JSON.stringify(place));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: cooking mode starts from the top next time.
  }
}
