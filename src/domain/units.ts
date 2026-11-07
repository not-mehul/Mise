// ============================================================
// Units recipes use, in the four interface languages, with the
// factors that let quantities convert between metric and US.
// ============================================================

export type UnitKind = 'volume' | 'mass' | 'other';
export type UnitSystem = 'metric' | 'us' | 'any';

export interface Unit {
  id: string;
  kind: UnitKind;
  system: UnitSystem;
  /** Millilitres or grams in one of this unit; 0 for units that don't convert. */
  base: number;
  /** How the unit is written after a converted quantity. */
  short: string;
  /** The short form for more than one, when it differs ("cups"). */
  plural?: string;
  /** Spoons, cups and counts read best as fractions; grams as whole numbers. */
  style: 'fraction' | 'decimal';
  aliases: string[];
}

export const UNITS: Unit[] = [
  { id: 'ml', kind: 'volume', system: 'metric', base: 1, short: 'ml', style: 'decimal', aliases: ['ml', 'mL', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'mililitro', 'mililitros', 'millilitre', 'millilitres', 'Milliliter'] },
  { id: 'cl', kind: 'volume', system: 'metric', base: 10, short: 'cl', style: 'decimal', aliases: ['cl', 'centiliter', 'centilitre', 'centilitres', 'Zentiliter'] },
  { id: 'dl', kind: 'volume', system: 'metric', base: 100, short: 'dl', style: 'decimal', aliases: ['dl', 'deciliter', 'decilitre', 'décilitre', 'Deziliter'] },
  { id: 'l', kind: 'volume', system: 'metric', base: 1000, short: 'l', style: 'decimal', aliases: ['l', 'L', 'liter', 'liters', 'litre', 'litres', 'litro', 'litros', 'Liter'] },
  { id: 'tsp', kind: 'volume', system: 'any', base: 4.92892, short: 'tsp', style: 'fraction', aliases: ['tsp', 'tsps', 't', 'teaspoon', 'teaspoons', 'cdta', 'cdtas', 'cucharadita', 'cucharaditas', 'c. à c.', 'c.à.c.', 'càc', 'cac', 'cuillère à café', 'cuillères à café', 'TL', 'Teelöffel'] },
  { id: 'tbsp', kind: 'volume', system: 'any', base: 14.7868, short: 'tbsp', style: 'fraction', aliases: ['tbsp', 'tbsps', 'tbs', 'tbl', 'T', 'tablespoon', 'tablespoons', 'cda', 'cdas', 'cucharada', 'cucharadas', 'c. à s.', 'c.à.s.', 'càs', 'cas', 'cuillère à soupe', 'cuillères à soupe', 'EL', 'Esslöffel'] },
  { id: 'floz', kind: 'volume', system: 'us', base: 29.5735, short: 'fl oz', style: 'fraction', aliases: ['fl oz', 'fl. oz.', 'fluid ounce', 'fluid ounces'] },
  { id: 'cup', kind: 'volume', system: 'us', base: 236.588, short: 'cup', plural: 'cups', style: 'fraction', aliases: ['cup', 'cups', 'c', 'taza', 'tazas', 'tasse', 'tasses', 'Tasse', 'Tassen', 'Becher'] },
  { id: 'pint', kind: 'volume', system: 'us', base: 473.176, short: 'pt', style: 'fraction', aliases: ['pint', 'pints', 'pt'] },
  { id: 'quart', kind: 'volume', system: 'us', base: 946.353, short: 'qt', style: 'fraction', aliases: ['quart', 'quarts', 'qt'] },
  { id: 'g', kind: 'mass', system: 'metric', base: 1, short: 'g', style: 'decimal', aliases: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes', 'gramo', 'gramos', 'Gramm'] },
  { id: 'kg', kind: 'mass', system: 'metric', base: 1000, short: 'kg', style: 'decimal', aliases: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes', 'kilogramo', 'kilogramos', 'Kilogramm'] },
  { id: 'oz', kind: 'mass', system: 'us', base: 28.3495, short: 'oz', style: 'fraction', aliases: ['oz', 'ounce', 'ounces', 'onza', 'onzas', 'once', 'onces', 'Unze', 'Unzen'] },
  { id: 'lb', kind: 'mass', system: 'us', base: 453.592, short: 'lb', style: 'fraction', aliases: ['lb', 'lbs', 'pound', 'pounds', 'libra', 'libras', 'livre', 'livres', 'Pfund'] },
  { id: 'pinch', kind: 'other', system: 'any', base: 0, short: 'pinch', plural: 'pinches', style: 'fraction', aliases: ['pinch', 'pinches', 'pizca', 'pizcas', 'pincée', 'pincées', 'Prise', 'Prisen'] },
  { id: 'dash', kind: 'other', system: 'any', base: 0, short: 'dash', plural: 'dashes', style: 'fraction', aliases: ['dash', 'dashes', 'chorrito', 'trait', 'Schuss', 'Spritzer'] },
  { id: 'clove', kind: 'other', system: 'any', base: 0, short: 'clove', plural: 'cloves', style: 'fraction', aliases: ['clove', 'cloves', 'diente', 'dientes', 'gousse', 'gousses', 'Zehe', 'Zehen'] },
  { id: 'can', kind: 'other', system: 'any', base: 0, short: 'can', plural: 'cans', style: 'fraction', aliases: ['can', 'cans', 'tin', 'tins', 'lata', 'latas', 'boîte', 'boîtes', 'Dose', 'Dosen'] },
  { id: 'bunch', kind: 'other', system: 'any', base: 0, short: 'bunch', plural: 'bunches', style: 'fraction', aliases: ['bunch', 'bunches', 'manojo', 'manojos', 'botte', 'bottes', 'Bund', 'Bünde'] },
  { id: 'handful', kind: 'other', system: 'any', base: 0, short: 'handful', plural: 'handfuls', style: 'fraction', aliases: ['handful', 'handfuls', 'puñado', 'puñados', 'poignée', 'poignées', 'Handvoll'] },
  { id: 'slice', kind: 'other', system: 'any', base: 0, short: 'slice', plural: 'slices', style: 'fraction', aliases: ['slice', 'slices', 'rebanada', 'rebanadas', 'tranche', 'tranches', 'Scheibe', 'Scheiben'] },
  { id: 'sprig', kind: 'other', system: 'any', base: 0, short: 'sprig', plural: 'sprigs', style: 'fraction', aliases: ['sprig', 'sprigs', 'ramita', 'ramitas', 'brin', 'brins', 'Zweig', 'Zweige'] },
  { id: 'stick', kind: 'other', system: 'any', base: 0, short: 'stick', plural: 'sticks', style: 'fraction', aliases: ['stick', 'sticks'] },
  { id: 'package', kind: 'other', system: 'any', base: 0, short: 'pack', plural: 'packs', style: 'fraction', aliases: ['package', 'packages', 'pack', 'packs', 'packet', 'packets', 'paquete', 'paquetes', 'sachet', 'sachets', 'paquet', 'paquets', 'Packung', 'Packungen', 'Päckchen'] },
];

const BY_ID = new Map(UNITS.map((u) => [u.id, u]));

// Aliases whose case carries meaning (T is a tablespoon, t a teaspoon; EL, TL).
const CASE_SENSITIVE = new Set(['t', 'T', 'TL', 'EL', 'L']);
const exact = new Map<string, Unit>();
const folded = new Map<string, Unit>();
for (const u of UNITS) {
  for (const a of u.aliases) {
    if (CASE_SENSITIVE.has(a)) exact.set(a, u);
    else if (!folded.has(a.toLowerCase())) folded.set(a.toLowerCase(), u);
  }
}
// Longest first, so "fl oz" wins over "fl" and "cuillère à soupe" over "cuillère".
const PHRASES = [...new Set(UNITS.flatMap((u) => u.aliases))].sort((a, b) => b.length - a.length);

/** The unit as written after a quantity: "1 cup", "2 cups", "½ cup". */
export function unitLabel(unit: Unit, qty: number | null): string {
  // Just over one reads as "1" (formatQuantity rounds the last sixteenth away), so it stays singular.
  return qty !== null && qty >= 1.0625 && unit.plural ? unit.plural : unit.short;
}

export function unitById(id: string | null | undefined): Unit | undefined {
  return id ? BY_ID.get(id) : undefined;
}

function lookup(word: string): Unit | undefined {
  return exact.get(word) ?? (CASE_SENSITIVE.has(word) ? undefined : folded.get(word.toLowerCase()));
}

/** A unit at the start of `text`, with the words as written and what follows. */
export function parseLeadingUnit(text: string): { unit: Unit; written: string; rest: string } | null {
  for (const phrase of PHRASES) {
    if (text.length < phrase.length) continue;
    const head = text.slice(0, phrase.length);
    const unit = lookup(head);
    if (!unit) continue;
    // Whole words only, with an optional full stop: "g." or "tbsp." but not "garlic".
    const after = text.slice(phrase.length);
    const m = /^(\.?)(?=$|[\s,;:()/])/.exec(after);
    if (!m) continue;
    return { unit, written: head + m[1], rest: after.slice(m[1]!.length).trimStart() };
  }
  return null;
}

/** Converts `value` of `from` into the best unit of the other system, or null when it can't. */
export function convert(value: number, from: Unit, to: 'metric' | 'us'): { value: number; unit: Unit } | null {
  if (!from.base || from.system === to) return null;
  // Spoons read the same in metric and US kitchens: 1 tsp stays 1 tsp, never 4.9 ml.
  if (from.system === 'any') return null;
  const base = value * from.base;
  if (to === 'metric') {
    const unit = from.kind === 'mass' ? (base >= 1000 ? BY_ID.get('kg')! : BY_ID.get('g')!) : base >= 1000 ? BY_ID.get('l')! : BY_ID.get('ml')!;
    return { value: base / unit.base, unit };
  }
  if (from.kind === 'mass') {
    const unit = base >= 453.592 ? BY_ID.get('lb')! : BY_ID.get('oz')!;
    return { value: base / unit.base, unit };
  }
  const pick = base >= 59 ? 'cup' : base >= 14.7 ? 'tbsp' : 'tsp';
  const unit = BY_ID.get(pick)!;
  return { value: base / unit.base, unit };
}

// ---------- weighing what cups measure ----------

/**
 * Grams per millilitre for what recipes measure in cups, so metric mode can weigh it
 * ("1 cup flour" → 125 g) and US mode can measure what is weighed ("200 g sugar" → 1 cup).
 * The first pattern that matches the item wins, so the specific ones come first.
 */
const DENSITIES: [RegExp, number][] = [
  [/peanut butter|beurre de cacahu[eè]te|erdnussbutter|mantequilla de cacahuete/i, 1.08],
  [/brown sugar|az[uú]car moreno|cassonade|sucre roux|brauner zucker/i, 0.93],
  [/icing sugar|powdered sugar|confectioners.? sugar|az[uú]car glas|sucre glace|puderzucker/i, 0.51],
  [/almond flour|ground almonds?|harina de almendra|poudre d.amande|gemahlene mandeln/i, 0.4],
  [/whole ?wheat flour|wholemeal flour|harina integral|farine compl[eè]te|vollkornmehl/i, 0.51],
  [/cornstarch|cornflour|ma[ií]cena|fécule|speisestärke/i, 0.54],
  [/cocoa|cacao|kakao/i, 0.42],
  [/flour|harina|farine|mehl/i, 0.53],
  [/sugar|az[uú]car|sucre|zucker/i, 0.85],
  [/butter|mantequilla|beurre/i, 0.96],
  [/honey|miel|honig/i, 1.42],
  [/maple syrup|sirope de arce|sirop d.[ée]rable|ahornsirup/i, 1.32],
  [/oats|avena|flocons d.avoine|haferflocken/i, 0.38],
  [/\brice\b|arroz|\briz\b|\breis\b/i, 0.79],
  [/parmesan|parmigiano/i, 0.42],
  [/grated cheese|shredded cheese|cheddar|mozzarella|queso rallado|fromage r[âa]p[ée]|geriebener käse/i, 0.47],
  [/chocolate chips|pepitas de chocolate|pépites de chocolat|schokotropfen/i, 0.72],
  [/breadcrumbs|pan rallado|chapelure|semmelbrösel|paniermehl/i, 0.45],
];

/** Grams per millilitre for an ingredient, when Mise knows it. */
export function densityOf(item: string): number | null {
  return DENSITIES.find(([re]) => re.test(item))?.[1] ?? null;
}

function usVolume(ml: number): { value: number; unit: Unit } {
  const unit = BY_ID.get(ml >= 59 ? 'cup' : ml >= 14.7 ? 'tbsp' : 'tsp')!;
  return { value: ml / unit.base, unit };
}

/**
 * Like `convert`, but knowing what is measured: cups of flour become grams in metric
 * mode, and grams of sugar become cups in US mode. Anything else converts as usual.
 */
export function convertFor(value: number, from: Unit, to: 'metric' | 'us', item: string): { value: number; unit: Unit } | null {
  const density = densityOf(item);
  if (density && to === 'metric' && from.kind === 'volume' && from.system === 'us') {
    const grams = value * from.base * density;
    const unit = grams >= 1000 ? BY_ID.get('kg')! : BY_ID.get('g')!;
    return { value: grams / unit.base, unit };
  }
  if (density && to === 'us' && from.kind === 'mass' && from.system === 'metric') return usVolume((value * from.base) / density);
  return convert(value, from, to);
}

// ---------- oven temperatures ----------

const TEMPERATURE = /(\d{2,3})\s*(?:°|º|degrees?\s*)\s*([CF])\b|(\d{3})([CF])\b/g;

/** "180 °C" in a step, as the other scale wants it: 350 °F in US mode, 180 °C in metric. Rounded to 5. */
export function convertTemperatures(text: string, mode: 'original' | 'metric' | 'us'): string {
  if (mode === 'original') return text;
  return text.replace(TEMPERATURE, (whole, a: string | undefined, scaleA: string | undefined, b: string | undefined, scaleB: string | undefined) => {
    const value = Number(a ?? b);
    const scale = (scaleA ?? scaleB)!.toUpperCase();
    if (scale === 'C' && mode === 'us') return `${Math.round((value * 9) / 5 / 5 + 32 / 5) * 5} °F`;
    if (scale === 'F' && mode === 'metric') return `${Math.round(((value - 32) * 5) / 9 / 5) * 5} °C`;
    return whole;
  });
}
