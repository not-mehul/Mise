// ============================================================
// One ingredient line, split into quantity · unit · item · note:
//   "1½ cups plain flour, sifted" → 1.5 · cup · plain flour · sifted
// The line as written is always kept, so a bad split never loses words.
// ============================================================

import { formatQuantity, parseLeadingQuantity } from './quantity';
import { convert, parseLeadingUnit, unitById, unitLabel, type Unit } from './units';

export interface Ingredient {
  id: string;
  /** The line as written, after list markers are stripped. */
  raw: string;
  qty: number | null;
  /** The top of a range ("2–3 cloves"), or null. */
  qtyMax: number | null;
  /** A unit id from units.ts, or null. */
  unit: string | null;
  /** The unit as the recipe wrote it ("tbsp", "Esslöffel"). */
  unitText: string | null;
  item: string;
  note: string;
}

export interface IngredientGroup {
  /** "For the sauce"; empty for a recipe's only or first group. */
  name: string;
  items: Ingredient[];
}

const LIST_MARKER = /^\s*(?:[-*•·▪◦‣–—+]|[▢☐□○●✓✔]|\d+[.)](?=\s))\s*/u;
const OF = /^(?:of|de|d'|d’|du|des)\s+/i;
const TO_TASTE = /\b(?:to taste|as needed|optional|al gusto|a gusto|opcional|selon le goût|au goût|facultatif|nach Geschmack|nach Belieben|optional)\b/i;

/** A line without its bullet or checkbox. Numbered lines ("1. ") lose the number too. */
export function stripListMarker(line: string): string {
  return line.replace(LIST_MARKER, '').trim();
}

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseIngredient(line: string, id: string = newId()): Ingredient {
  const raw = stripListMarker(line).replace(/\s+/g, ' ');
  let rest = raw;
  let qty: number | null = null;
  let qtyMax: number | null = null;
  let unit: Unit | undefined;
  let unitText: string | null = null;

  const q = parseLeadingQuantity(rest);
  if (q) {
    ({ qty, qtyMax } = q);
    rest = q.rest;
  }
  // "a pinch of salt": an article before a unit counts as one.
  const article = !q ? /^(?:a|an|un|una|une|ein|eine|einen)\s+/i.exec(rest) : null;
  const afterArticle = article ? rest.slice(article[0].length) : rest;
  const u = parseLeadingUnit(afterArticle);
  if (u && (q || article)) {
    unit = u.unit;
    unitText = u.written;
    rest = u.rest;
    if (article) qty = 1;
  } else if (u && !q && u.unit.kind === 'other') {
    // "pinch of salt" with no number.
    unit = u.unit;
    unitText = u.written;
    rest = u.rest;
  }
  rest = rest.replace(OF, '');

  // Notes: anything in brackets, then anything after the first comma.
  const notes: string[] = [];
  rest = rest.replace(/\s*\(([^)]*)\)\s*/g, (_, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return ' ';
  });
  const comma = rest.indexOf(',');
  if (comma >= 0) {
    notes.push(rest.slice(comma + 1).trim());
    rest = rest.slice(0, comma);
  }
  let item = rest.replace(/\s+/g, ' ').trim();
  const taste = TO_TASTE.exec(item);
  if (taste && taste.index > 0) {
    notes.unshift(item.slice(taste.index).trim());
    item = item.slice(0, taste.index).trim();
  }

  return { id, raw, qty, qtyMax, unit: unit?.id ?? null, unitText, item: item || raw, note: notes.filter(Boolean).join(', ') };
}

export type UnitMode = 'original' | 'metric' | 'us';

export interface ShownIngredient {
  /** "1½ cups", "200 g", "2–3", or '' for "salt, to taste". */
  amount: string;
  item: string;
  note: string;
}

/** An ingredient at `factor` times its quantity, in the chosen units. */
export function showIngredient(ing: Ingredient, factor: number, mode: UnitMode, locale = 'en'): ShownIngredient {
  if (ing.qty === null) return { amount: ing.unitText ?? '', item: ing.item, note: ing.note };
  let unit = unitById(ing.unit);
  let unitText = ing.unitText;
  let qty = ing.qty * factor;
  let max = ing.qtyMax !== null ? ing.qtyMax * factor : null;
  if (unit && mode !== 'original') {
    const c = convert(qty, unit, mode);
    if (c) {
      const ratio = c.value / qty;
      qty = c.value;
      max = max !== null ? max * ratio : null;
      unit = c.unit;
      unitText = unitLabel(c.unit, max ?? qty);
    }
  }
  const style = unit?.style ?? 'fraction';
  const n = formatQuantity(qty, style, locale);
  const range = max !== null ? `${n}–${formatQuantity(max, style, locale)}` : n;
  return { amount: unitText ? `${range} ${unitText}` : range, item: ing.item, note: ing.note };
}

/**
 * A word in the singular, for matching: "tomatoes" → "tomato", "cherries" → "cherry",
 * "leaves" → "leaf". Words ending in -us or -ss keep their s (couscous, hummus, glass).
 */
export function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:ea|oa|i)ves$/.test(word)) return `${word.slice(0, -3)}f`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(?:ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** The word a step would use for this ingredient: "plain flour" → "flour". */
export function keyWord(item: string): string {
  const words = item.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const meaningful = words.filter((w) => w.length > 2);
  return meaningful.at(-1) ?? words.at(-1) ?? '';
}
