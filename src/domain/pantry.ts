// ============================================================
// "What can I cook?" and the cook log as a way to choose: which
// recipes need the fewest things you don't have, which ones you
// rate highest, and which you haven't made in a while.
// ============================================================

import { groceryKey, isStaple } from './groceries';
import type { Recipe } from './recipe';

/** Words you typed ("chicken, rice, lime") as keys to match by. */
export function haveKeys(text: string): string[] {
  return [...new Set(text.split(/[,;\n]+/).map(groceryKey).filter(Boolean))];
}

export function has(key: string, have: string[]): boolean {
  const words = ` ${key} `;
  return have.some((h) => words.includes(` ${h} `) || ` ${h} `.includes(words));
}

/** The ingredients a recipe needs that you don't have; staples count as had. */
export function missingFor(recipe: Recipe, have: string[], staples: readonly string[]): string[] {
  const missing: string[] = [];
  for (const g of recipe.groups) {
    for (const i of g.items) {
      if (isStaple(i.item, staples) || has(groceryKey(i.item), have)) continue;
      missing.push(i.item);
    }
  }
  return missing;
}

/** Recipes that use at least one thing you have, fewest missing first. */
export function cookableWith(recipes: Recipe[], have: string[], staples: readonly string[]): { recipe: Recipe; missing: string[] }[] {
  if (!have.length) return [];
  return recipes
    .map((recipe) => ({ recipe, missing: missingFor(recipe, have, staples), uses: recipe.groups.some((g) => g.items.some((i) => has(groceryKey(i.item), have))) }))
    .filter((r) => r.uses)
    .sort((a, b) => a.missing.length - b.missing.length || a.recipe.title.localeCompare(b.recipe.title))
    .map(({ recipe, missing }) => ({ recipe, missing }));
}

/** The average rating in the cook log, or null when it was never rated. */
export function averageRating(r: Recipe): number | null {
  const rated = r.log.filter((e) => e.rating !== null);
  return rated.length ? rated.reduce((n, e) => n + e.rating!, 0) / rated.length : null;
}

/** When it was last cooked (ms), or null. The log is newest first. */
export function lastCooked(r: Recipe): number | null {
  return r.log.length ? Date.parse(r.log[0]!.at) : null;
}

export type LogSort = 'rating' | 'cooked' | 'stale';

/** The list sorted by the cook log: top rated, most cooked, or longest since cooked (never cooked last). */
export function sortByLog(recipes: Recipe[], sort: LogSort): Recipe[] {
  const list = [...recipes];
  if (sort === 'rating') return list.sort((a, b) => (averageRating(b) ?? -1) - (averageRating(a) ?? -1) || b.log.length - a.log.length);
  if (sort === 'cooked') return list.sort((a, b) => b.log.length - a.log.length || (lastCooked(b) ?? 0) - (lastCooked(a) ?? 0));
  return list.sort((a, b) => (lastCooked(a) ?? Infinity) - (lastCooked(b) ?? Infinity));
}

const DAY = 86_400_000;

/** Favourites you haven't made in three weeks: rated 4 or more, newest-rated first, up to six. */
export function cookAgain(recipes: Recipe[], now = Date.now()): Recipe[] {
  return recipes
    .filter((r) => (averageRating(r) ?? 0) >= 4 && now - (lastCooked(r) ?? now) >= 21 * DAY)
    .sort((a, b) => (averageRating(b) ?? 0) - (averageRating(a) ?? 0) || (lastCooked(a) ?? 0) - (lastCooked(b) ?? 0))
    .slice(0, 6);
}
