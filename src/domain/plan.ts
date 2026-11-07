// ============================================================
// The week planner: recipes put on days, so a week's cooking can
// go to the grocery list in one go.
// ============================================================

export interface PlanEntry {
  id: string;
  /** The day, as YYYY-MM-DD in local time. */
  date: string;
  recipeId: string;
  /** Servings to cook, or null for the recipe's own. */
  servings: number | null;
  /** Its ingredients went to the grocery list. */
  listed: boolean;
}

/** A local date as YYYY-MM-DD. */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `count` days from `from`, as YYYY-MM-DD. */
export function planDays(from: Date, count = 7): string[] {
  return Array.from({ length: count }, (_, i) => isoDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)));
}

/** A YYYY-MM-DD day as a local Date at midnight. */
export function dayDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function normaliseEntry(value: unknown): PlanEntry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<PlanEntry>;
  if (typeof v.id !== 'string' || typeof v.recipeId !== 'string' || typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return null;
  return {
    id: v.id,
    date: v.date,
    recipeId: v.recipeId,
    servings: typeof v.servings === 'number' && v.servings > 0 && v.servings < 100 ? Math.round(v.servings) : null,
    listed: v.listed === true,
  };
}

/** Entries by day, in day order then the order they were planned. */
export function byDay(entries: PlanEntry[], days: string[]): { day: string; entries: PlanEntry[] }[] {
  return days.map((day) => ({ day, entries: entries.filter((e) => e.date === day) }));
}
