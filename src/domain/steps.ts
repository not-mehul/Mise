// ============================================================
// Steps: the durations in their text become timers, and the
// ingredients they name are linked to them for cooking mode.
// ============================================================

import { keyWord, type IngredientGroup } from './ingredient';
import { parseNumber } from './quantity';

export interface StepTimer {
  /** Where the duration sits in the step's text. */
  start: number;
  end: number;
  seconds: number;
}

export interface Step {
  id: string;
  text: string;
  timers: StepTimer[];
  /** Ingredients this step names. */
  ingredientIds: string[];
}

const UNIT_SECONDS: [RegExp, number][] = [
  [/^(?:h|hr|hrs|hour|hours|hora|horas|heure|heures|std|stunde|stunden)$/i, 3600],
  [/^(?:m|min|mins|minute|minutes|minuto|minutos|minuten)$/i, 60],
  [/^(?:s|sec|secs|second|seconds|segundo|segundos|seconde|secondes|sek|sekunde|sekunden)$/i, 1],
];
const NUM = String.raw`\d+(?:[.,]\d+)?|\d*\s*[½¼¾⅓⅔]`;
const DURATION = new RegExp(
  String.raw`(?<![\p{L}\d])(${NUM})(?:\s*(?:-|–|—|to|a|à|bis)\s*(${NUM}))?\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|horas?|heures?|stunden|stunde|std|minutos?|minuten|segundos?|secondes?|sekunden|sekunde|sek)(?![\p{L}])`,
  'giu',
);

/** Each duration in a step: "simmer 10–12 minutes" gives one timer of 10 minutes. */
export function findTimers(text: string): StepTimer[] {
  const timers: StepTimer[] = [];
  for (const m of text.matchAll(DURATION)) {
    const value = parseNumber(m[1]!.replace(/\s+/g, ''));
    const per = UNIT_SECONDS.find(([re]) => re.test(m[3]!))?.[1];
    if (value === null || !per) continue;
    // A bare "m" or "s" only counts straight after a number ("10m"), not "10 s" in prose.
    if (/^[ms]$/i.test(m[3]!) && /\s/.test(m[0].slice(m[1]!.length, m[0].length - 1))) continue;
    const seconds = Math.round(value * per);
    if (seconds <= 0 || seconds > 48 * 3600) continue;
    const start = m.index!;
    const prev = timers.at(-1);
    // "1 hour 30 minutes" is one timer.
    if (prev && /^\s*(?:and|y|et|und)?\s*$/i.test(text.slice(prev.end, start)) && per < 3600) {
      prev.seconds += seconds;
      prev.end = start + m[0].length;
      continue;
    }
    timers.push({ start, end: start + m[0].length, seconds });
  }
  return timers;
}

/** The ingredients a step names, by each ingredient's key word. */
export function linkIngredients(text: string, groups: IngredientGroup[]): string[] {
  const lower = text.toLowerCase();
  const ids: string[] = [];
  for (const group of groups) {
    for (const ing of group.items) {
      const word = keyWord(ing.item);
      if (word.length < 3) continue;
      const stem = word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
      if (new RegExp(`(?<![\\p{L}])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(lower)) ids.push(ing.id);
    }
  }
  return ids;
}

/** "1 h 30 min", "45 min", "20 s". */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s && !h) parts.push(`${s} s`);
  return parts.join(' ') || '0 s';
}

/** A step's text cut around its timers, so the durations can be marked. */
export function stepPieces(step: Pick<Step, 'text' | 'timers'>): { text: string; timer?: number }[] {
  const out: { text: string; timer?: number }[] = [];
  let at = 0;
  step.timers.forEach((timer, i) => {
    if (timer.start > at) out.push({ text: step.text.slice(at, timer.start) });
    out.push({ text: step.text.slice(timer.start, timer.end), timer: i });
    at = timer.end;
  });
  if (at < step.text.length) out.push({ text: step.text.slice(at) });
  return out;
}
