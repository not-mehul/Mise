// ============================================================
// Steps: the durations in their text become timers, and the
// ingredients they name are linked to them for cooking mode.
// ============================================================

import { keyWord, showIngredient, singular, type IngredientGroup, type UnitMode } from './ingredient';
import { convertTemperatures } from './units';
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
  /** The part of the method it belongs to ("For the sauce"), from a "Name:" line before it. */
  section?: string;
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
  let lastPer = Infinity;
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
    // "1 hour 30 minutes" is one timer; "5 minutes and 3 minutes" are two.
    if (prev && per < lastPer && /^\s*(?:and|y|et|und)?\s*$/i.test(text.slice(prev.end, start))) {
      prev.seconds += seconds;
      prev.end = start + m[0].length;
      lastPer = per;
      continue;
    }
    timers.push({ start, end: start + m[0].length, seconds });
    lastPer = per;
  }
  return timers;
}

/** Where a step names an ingredient: the whole word, from a match of its singular ("tomato" finds "tomatoes"). */
function mention(text: string, item: string): { start: number; end: number } | null {
  const word = keyWord(item);
  if (word.length < 3) return null;
  const stem = singular(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?<![\\p{L}])${stem}\\p{L}*`, 'iu').exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

/** The ingredients a step names, by each ingredient's key word. */
export function linkIngredients(text: string, groups: IngredientGroup[]): string[] {
  const ids: string[] = [];
  for (const group of groups) for (const ing of group.items) if (mention(text, ing.item)) ids.push(ing.id);
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

export interface StepPart {
  text: string;
  /** Which of the step's timers this is, when it is one. */
  timer?: number;
  /** An amount shown after an ingredient's name: "flour (200 g)". */
  amount?: boolean;
}

/**
 * A step ready to show: cut around its timers, with each named ingredient's amount after
 * its first mention (scaled and in the chosen units), and oven temperatures converted.
 */
export function stepParts(
  step: Pick<Step, 'text' | 'timers' | 'ingredientIds'>,
  groups: IngredientGroup[],
  factor: number,
  mode: UnitMode,
  locale = 'en',
): StepPart[] {
  const inserts: { at: number; text: string }[] = [];
  const wanted = new Set(step.ingredientIds);
  for (const ing of groups.flatMap((g) => g.items)) {
    if (!wanted.has(ing.id)) continue;
    const at = mention(step.text, ing.item);
    if (!at || step.timers.some((t) => at.end > t.start && at.start < t.end) || inserts.some((i) => i.at === at.end)) continue;
    const { amount } = showIngredient(ing, factor, mode, locale);
    if (amount) inserts.push({ at: at.end, text: ` (${amount})` });
  }
  inserts.sort((a, b) => a.at - b.at);
  const out: StepPart[] = [];
  const plain = (from: number, to: number) => {
    let at = from;
    for (const ins of inserts) {
      if (ins.at < at || ins.at > to) continue;
      if (ins.at > at) out.push({ text: convertTemperatures(step.text.slice(at, ins.at), mode) });
      out.push({ text: ins.text, amount: true });
      at = ins.at;
    }
    if (to > at) out.push({ text: convertTemperatures(step.text.slice(at, to), mode) });
  };
  let at = 0;
  step.timers.forEach((timer, i) => {
    plain(at, timer.start);
    out.push({ text: step.text.slice(timer.start, timer.end), timer: i });
    at = timer.end;
  });
  plain(at, step.text.length);
  return out;
}
