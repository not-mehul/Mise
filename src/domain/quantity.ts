// ============================================================
// Quantities as recipes write them: 2, 1.5, 1,5, ½, 1 ½, 1½, 1/2,
// 1 1/2, and ranges (2-3, 2–3, 2 to 3). Parsing is the start of a
// line only; the rest of the line is left to the caller.
// ============================================================

const VULGAR: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5,
  '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
};
const VULGAR_CLASS = Object.keys(VULGAR).join('');

// One number: "1 1/2", "1½", "1 ½", "3/4", "½", "1.5", "1,5", "12".
const NUMBER = `(?:\\d+\\s*[${VULGAR_CLASS}]|\\d+\\s+\\d+\\s*[/⁄]\\s*\\d+|\\d+\\s*[/⁄]\\s*\\d+|[${VULGAR_CLASS}]|\\d+(?:[.,]\\d+)?)`;
const RANGE_SEP = `\\s*(?:-|–|—|to|a|à|bis)\\s*`;
const LEADING = new RegExp(`^(${NUMBER})(?:${RANGE_SEP}(${NUMBER}))?(?![\\d/])`, 'i');

/** The value of one number token, or null. */
export function parseNumber(token: string): number | null {
  const t = token.trim().replace('⁄', '/');
  let m = /^(\d+)\s*([^\d\s./,])$/.exec(t);
  if (m && VULGAR[m[2]!] !== undefined) return Number(m[1]) + VULGAR[m[2]!]!;
  if (VULGAR[t] !== undefined) return VULGAR[t]!;
  m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;
  m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  if (/^\d+(?:[.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return null;
}

export interface LeadingQuantity {
  qty: number;
  /** The top of a range, or null. */
  qtyMax: number | null;
  /** What is left of the text after the quantity. */
  rest: string;
}

/** Reads a quantity at the start of `text`. */
export function parseLeadingQuantity(text: string): LeadingQuantity | null {
  const m = LEADING.exec(text.trim());
  if (!m) return null;
  const qty = parseNumber(m[1]!);
  if (qty === null) return null;
  const max = m[2] ? parseNumber(m[2]) : null;
  return {
    qty,
    qtyMax: max !== null && max > qty ? max : null,
    rest: text.trim().slice(m[0].length).trimStart(),
  };
}

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
];

/**
 * A quantity for reading in a kitchen: fractions for spoons, cups and
 * counts (1½, ⅔), rounded whole numbers for grams and millilitres.
 */
export function formatQuantity(value: number, style: 'fraction' | 'decimal', locale = 'en'): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (style === 'decimal') {
    const rounded = value >= 100 ? Math.round(value / 5) * 5 : value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return rounded.toLocaleString(locale, { maximumFractionDigits: 1 });
  }
  const whole = Math.floor(value);
  const frac = value - whole;
  if (frac < 0.0625) return String(whole || NICE_FRACTIONS[0]![1]);
  if (frac > 0.9375) return String(whole + 1);
  let best = NICE_FRACTIONS[0]!;
  for (const f of NICE_FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  return whole ? `${whole}${best[1]}` : best[1];
}
