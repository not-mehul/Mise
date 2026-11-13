// ============================================================
// Prep ahead: steps that need starting long before you cook ("soak
// the beans overnight", "marinate for at least 4 hours", "make the
// dough the day before"), and when to be reminded of them for a
// planned meal. Meals are assumed to be cooked at 6 pm.
// ============================================================

import { dayDate, type PlanEntry } from "./plan";
import type { Recipe } from "./recipe";

export interface PrepNeed {
  stepId: string;
  text: string;
  /** How long before the meal it has to start. */
  hours: number;
  /** Overnight or the day before: remind the evening before. */
  overnight: boolean;
}

const OVERNIGHT =
  /\b(?:overnight|the night before|the day before|a day ahead|24 hours ahead|toda la noche|la noche anterior|el día anterior|une nuit|la veille|toute la nuit|über nacht|am vortag)\b/i;
const NUMBER =
  "(\\d+(?:[.,]\\d+)?|one|two|three|four|five|six|eight|ten|twelve|twenty-four)";
const WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  eight: 8,
  ten: 10,
  twelve: 12,
  "twenty-four": 24,
};
/** "at least 4 hours", "for 6–8 hours", "4 to 24 hours", "8 hrs or more". */
const HOURS = new RegExp(
  `(?:at least|minimum(?: of)?|for|up to)?\\s*${NUMBER}(?:\\s*(?:-|–|to|or)\\s*${NUMBER})?\\s*(?:hours?|hrs?)\\b`,
  "gi",
);
/** Words that make a long wait something to start ahead, not just a slow cook. */
const AHEAD =
  /\b(?:at least|soak|marinate|marinade|brine|chill|refrigerate|fridge|rest|prove|proof|rise|cure|steep|infuse|set|freeze|ahead|in advance)\w*/i;

const num = (s: string | undefined) =>
  s ? (WORDS[s.toLowerCase()] ?? Number(s.replace(",", "."))) : NaN;

/** What a step needs starting ahead, or null. Waits under 4 hours don't count. */
export function prepAhead(
  text: string,
): { hours: number; overnight: boolean } | null {
  if (OVERNIGHT.test(text)) return { hours: 12, overnight: true };
  if (!AHEAD.test(text)) return null;
  let hours = 0;
  for (const m of text.matchAll(HOURS)) {
    const first = num(m[1]);
    const atLeast = /^(?:at least|minimum)/i.test(m[0].trim());
    const value = atLeast ? first : Math.max(first, num(m[2]) || 0);
    if (value > hours) hours = value;
  }
  if (hours < 4) return null;
  return { hours, overnight: hours >= 10 };
}

export function prepNeeds(recipe: Recipe): PrepNeed[] {
  return recipe.steps.flatMap((s) => {
    const need = prepAhead(s.text);
    return need ? [{ stepId: s.id, text: s.text, ...need }] : [];
  });
}

export interface PrepReminder {
  /** A notification id, stable for the entry and step. */
  id: number;
  at: number;
  entryId: string;
  recipeId: string;
  title: string;
  step: string;
  overnight: boolean;
}

const MEAL_HOUR = 18;
const EVENING_HOUR = 20;
/** Notification ids for prep reminders live in their own range, clear of timer alarms. */
export const PREP_ID_BASE = 1_500_000_000;

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 400_000_000;
}

/** When to remind: the evening before for overnight steps, otherwise that many hours before 6 pm (but not before 7 am). */
export function remindAt(
  date: string,
  need: { hours: number; overnight: boolean },
): number {
  const day = dayDate(date);
  if (need.overnight)
    return new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate() - 1,
      EVENING_HOUR,
    ).getTime();
  const at = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    MEAL_HOUR - need.hours,
  );
  const morning = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    7,
  ).getTime();
  // Longer than the day allows: the evening before.
  return at.getTime() < morning
    ? new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate() - 1,
        EVENING_HOUR,
      ).getTime()
    : at.getTime();
}

/** Reminders still to come for the planned meals, soonest first. */
export function prepReminders(
  entries: readonly PlanEntry[],
  recipes: readonly Recipe[],
  now = Date.now(),
): PrepReminder[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const out: PrepReminder[] = [];
  for (const e of entries) {
    const recipe = byId.get(e.recipeId);
    if (!recipe) continue;
    for (const need of prepNeeds(recipe)) {
      const at = remindAt(e.date, need);
      if (at <= now) continue;
      out.push({
        id: PREP_ID_BASE + hash(`${e.id}:${need.stepId}`),
        at,
        entryId: e.id,
        recipeId: recipe.id,
        title: recipe.title,
        step: need.text,
        overnight: need.overnight,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
