// ============================================================
// Cooking mode: the pages it steps through, where you left off,
// and the log of each time a recipe was cooked.
// ============================================================

import type { Ingredient } from './ingredient';
import type { Recipe } from './recipe';
import type { Step } from './steps';

/** One time a recipe was cooked. */
export interface CookEntry {
  /** When it was marked as cooked (ISO time). */
  at: string;
  servings: number | null;
  /** 1 to 5, or null when not rated. */
  rating: number | null;
  note: string;
}

/** A screen of cooking mode: gathering the ingredients, one step, or the end. */
export type CookPage = { kind: 'prep' } | { kind: 'step'; index: number } | { kind: 'done' };

/** Mise en place first when there is anything to gather, then each step, then the end. */
export function cookPages(recipe: Pick<Recipe, 'groups' | 'steps'>): CookPage[] {
  const pages: CookPage[] = [];
  if (recipe.groups.some((g) => g.items.length)) pages.push({ kind: 'prep' });
  recipe.steps.forEach((_, index) => pages.push({ kind: 'step', index }));
  pages.push({ kind: 'done' });
  return pages;
}

/** The ingredients a step names, in the recipe's order. */
export function stepIngredients(recipe: Pick<Recipe, 'groups'>, step: Pick<Step, 'ingredientIds'>): Ingredient[] {
  const wanted = new Set(step.ingredientIds);
  return recipe.groups.flatMap((g) => g.items.filter((i) => wanted.has(i.id)));
}

/** Where cooking mode was left, so reopening it soon after picks up there. */
export interface CookPlace {
  recipeId: string;
  page: number;
  servings: number;
  /** Ingredients ticked off on the mise en place page. */
  gathered: string[];
  /** When it was left (ms since epoch). */
  at: number;
}

/** How long a place is kept: an afternoon's cooking. */
export const RESUME_MS = 4 * 3600_000;

/** The place to resume for this recipe, or null to start from the top. */
export function resumePlace(place: CookPlace | null, recipeId: string, pageCount: number, now = Date.now()): CookPlace | null {
  if (!place || place.recipeId !== recipeId) return null;
  if (now - place.at > RESUME_MS || now < place.at) return null;
  // The last page is the end; landing there again would skip the cooking.
  if (place.page < 0 || place.page >= pageCount - 1) return null;
  return place;
}

export function normalisePlace(value: unknown): CookPlace | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<CookPlace>;
  if (typeof v.recipeId !== 'string' || !Number.isInteger(v.page) || typeof v.at !== 'number') return null;
  return {
    recipeId: v.recipeId,
    page: v.page!,
    servings: typeof v.servings === 'number' && v.servings > 0 ? v.servings : 1,
    gathered: Array.isArray(v.gathered) ? v.gathered.filter((g): g is string => typeof g === 'string') : [],
    at: v.at,
  };
}

/** A countdown: "4:05", or "1:02:03" past the hour. Rounds up, so it reads 0:00 only at the end. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** A cook log read back from storage or a backup, newest first. */
export function normaliseLog(value: unknown): CookEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is Partial<CookEntry> => !!e && typeof e === 'object' && typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)))
    .map((e) => ({
      at: e.at!,
      servings: typeof e.servings === 'number' && e.servings > 0 ? e.servings : null,
      rating: typeof e.rating === 'number' && Number.isInteger(e.rating) && e.rating >= 1 && e.rating <= 5 ? e.rating : null,
      note: typeof e.note === 'string' ? e.note.slice(0, 2000) : '',
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}
