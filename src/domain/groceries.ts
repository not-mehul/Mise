// ============================================================
// The grocery list: one running list, grouped by aisle. Adding the
// same thing twice merges it, adding up quantities that share a
// kind of unit and keeping the rest side by side.
// ============================================================

import { singular, type Ingredient, type UnitMode } from './ingredient';
import { formatQuantity } from './quantity';
import { convertFor, unitById, unitLabel } from './units';

export const AISLES = ['produce', 'dairy', 'meat', 'bakery', 'pantry', 'frozen', 'other'] as const;
export type Aisle = (typeof AISLES)[number];

/** One quantity of an item: "200 g", "2 tbsp", "3", or just "a handful". */
export interface GroceryAmount {
  qty: number | null;
  qtyMax: number | null;
  /** A unit id from units.ts, or null for a count or an unknown unit. */
  unit: string | null;
  /** The unit as written when it isn't one Mise knows ("bunch"). */
  unitText: string | null;
}

export interface GroceryItem {
  id: string;
  /** As first written: "spring onions". */
  item: string;
  /** What items are matched by: "spring onion". */
  key: string;
  aisle: Aisle;
  amounts: GroceryAmount[];
  /** The recipes it was added from. */
  recipeIds: string[];
  ticked: boolean;
  addedAt: string;
  /** A note for the shop: "the big tin", "ripe ones". */
  note?: string;
}

/** Something to add: from a recipe's ingredient or typed in. */
export interface GroceryAddition extends GroceryAmount {
  item: string;
  recipeId: string | null;
}

// ---------- matching ----------

/** The name items are matched by: lower case, single spaces, each word singular. */
export function groceryKey(item: string): string {
  return item
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

// ---------- aisles ----------

/** Phrases that beat their last word: coconut milk is not dairy. */
const PHRASES: [string, Aisle][] = [
  ['coconut milk', 'pantry'],
  ['coconut cream', 'pantry'],
  ['black pepper', 'pantry'],
  ['bell pepper', 'produce'],
  ['red pepper', 'produce'],
  ['green pepper', 'produce'],
  ['yellow pepper', 'produce'],
  ['sweet pepper', 'produce'],
  ['white pepper', 'pantry'],
  ['peanut butter', 'pantry'],
  ['tomato paste', 'pantry'],
  ['tomato puree', 'pantry'],
  ['chopped tomato', 'pantry'],
  ['tinned tomato', 'pantry'],
  ['canned tomato', 'pantry'],
  ['ice cream', 'frozen'],
  ['baking powder', 'pantry'],
  ['baking soda', 'pantry'],
  ['bay leaf', 'pantry'],
  ['lemon juice', 'produce'],
  ['pimienta negra', 'pantry'],
  ['poivre noir', 'pantry'],
  ['schwarzer pfeffer', 'pantry'],
  ['pomme de terre', 'produce'],
  ['crème fraîche', 'dairy'],
  ['creme fraiche', 'dairy'],
];

/** Words in English, Spanish, French and German, singular. A word also matches its plural (or German -n, -en) ending. */
const WORDS: Record<Exclude<Aisle, 'other'>, string[]> = {
  frozen: ['frozen', 'congelado', 'congelada', 'surgelé', 'surgelée', 'tiefkühl', 'tk'],
  produce: [
    'apple', 'asparagus', 'avocado', 'banana', 'basil', 'beetroot', 'berry', 'blueberry', 'broccoli', 'cabbage', 'carrot', 'cauliflower', 'celery', 'cherry', 'chilli', 'chili', 'chive', 'cilantro', 'coriander', 'courgette', 'cucumber', 'dill', 'eggplant', 'aubergine', 'fennel', 'garlic', 'ginger', 'grape', 'herb', 'kale', 'leek', 'lemon', 'lettuce', 'lime', 'mango', 'mint', 'mushroom', 'onion', 'orange', 'parsley', 'pea', 'peach', 'pear', 'plum', 'potato', 'pumpkin', 'radish', 'raspberry', 'rocket', 'arugula', 'rosemary', 'sage', 'salad', 'scallion', 'shallot', 'spinach', 'squash', 'strawberry', 'thyme', 'tomato', 'zucchini', 'capsicum', 'jalapeño', 'jalapeno', 'sweetcorn',
    'cebolla', 'ajo', 'tomate', 'patata', 'papa', 'zanahoria', 'limón', 'pimiento', 'perejil', 'lechuga', 'manzana', 'plátano', 'champiñón', 'seta', 'pepino', 'calabacín', 'espinaca', 'puerro', 'albahaca',
    'oignon', 'ail', 'carotte', 'citron', 'poivron', 'persil', 'laitue', 'champignon', 'concombre', 'échalote', 'épinard', 'poireau', 'pomme', 'basilic', 'ciboulette',
    'zwiebel', 'knoblauch', 'kartoffel', 'möhre', 'karotte', 'zitrone', 'paprikaschote', 'petersilie', 'salat', 'apfel', 'pilz', 'gurke', 'spinat', 'lauch', 'schnittlauch', 'ingwer',
  ],
  dairy: [
    'milk', 'butter', 'cream', 'cheese', 'yogurt', 'yoghurt', 'egg', 'parmesan', 'mozzarella', 'feta', 'ricotta', 'mascarpone', 'buttermilk', 'cheddar', 'halloumi',
    'leche', 'mantequilla', 'nata', 'queso', 'yogur', 'huevo',
    'lait', 'beurre', 'crème', 'fromage', 'yaourt', 'œuf', 'oeuf',
    'milch', 'sahne', 'käse', 'joghurt', 'ei', 'quark', 'schmand',
  ],
  meat: [
    'chicken', 'beef', 'pork', 'lamb', 'bacon', 'ham', 'sausage', 'mince', 'steak', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'cod', 'prawn', 'shrimp', 'anchovy', 'chorizo', 'pancetta', 'prosciutto', 'mussel', 'squid', 'thigh', 'drumstick',
    'pollo', 'carne', 'cerdo', 'ternera', 'cordero', 'jamón', 'salchicha', 'pescado', 'salmón', 'atún', 'gamba', 'langostino',
    'poulet', 'bœuf', 'boeuf', 'porc', 'agneau', 'jambon', 'lardon', 'saucisse', 'poisson', 'saumon', 'thon', 'crevette',
    'hähnchen', 'huhn', 'rindfleisch', 'rinderhack', 'schwein', 'lamm', 'speck', 'schinken', 'wurst', 'hackfleisch', 'fisch', 'lachs', 'thunfisch', 'garnele',
  ],
  bakery: ['bread', 'baguette', 'bun', 'tortilla', 'pita', 'naan', 'brioche', 'croissant', 'loaf', 'sourdough', 'bagel', 'pan', 'pain', 'brot', 'brötchen'],
  pantry: [
    'flour', 'sugar', 'salt', 'pepper', 'peppercorn', 'oil', 'vinegar', 'rice', 'pasta', 'spaghetti', 'noodle', 'lentil', 'chickpea', 'bean', 'stock', 'broth', 'sauce', 'honey', 'syrup', 'oat', 'yeast', 'cocoa', 'chocolate', 'vanilla', 'spice', 'cumin', 'cinnamon', 'nutmeg', 'oregano', 'mustard', 'ketchup', 'mayonnaise', 'soy', 'tahini', 'peanut', 'nut', 'almond', 'walnut', 'cashew', 'seed', 'sesame', 'cornflour', 'cornstarch', 'breadcrumb', 'couscous', 'quinoa', 'raisin', 'coffee', 'tea', 'wine', 'miso', 'curry', 'paprika', 'turmeric', 'cardamom', 'allspice', 'chickpea', 'hummus',
    'harina', 'azúcar', 'sal', 'aceite', 'vinagre', 'arroz', 'caldo', 'miel', 'levadura', 'especia', 'comino', 'canela', 'garbanzo', 'lenteja',
    'farine', 'sucre', 'sel', 'huile', 'vinaigre', 'riz', 'pâte', 'bouillon', 'levure', 'cannelle', 'poivre', 'moutarde',
    'mehl', 'zucker', 'salz', 'öl', 'essig', 'reis', 'nudel', 'brühe', 'honig', 'hefe', 'zimt', 'pfeffer', 'senf',
  ],
};
const SPICE = /(?:^|\s)(?:powder|ground|dried|flake|seasoning|spice|pulver|gemahlen|getrocknet|polvo|molido|seco|en poudre|moulu|séché)(?:$|\s)/;
const ORDER: Exclude<Aisle, 'other'>[] = ['frozen', 'meat', 'dairy', 'bakery', 'produce', 'pantry'];

function wordAisle(word: string): Aisle | null {
  for (const aisle of ORDER) {
    for (const w of WORDS[aisle]) {
      if (word === w) return aisle;
      // Plurals and German endings: "zwiebeln", "eier", "tomates".
      if (word.startsWith(w) && word.length - w.length <= 2 && /^(?:s|es|n|en|er|e)$/.test(word.slice(w.length))) return aisle;
    }
  }
  return null;
}

/** The aisle an item goes in: a move you made before, then the word lists, then Other. */
export function aisleFor(item: string, overrides: Record<string, Aisle> = {}, unit: string | null = null): Aisle {
  const key = groceryKey(item);
  const remembered = overrides[key];
  if (remembered) return remembered;
  for (const [phrase, aisle] of PHRASES) if (key.includes(phrase)) return aisle;
  if (unit === 'can') return 'pantry';
  // Dried and ground things are spices, whatever plant they came from: chilli powder, ground ginger.
  if (SPICE.test(key)) return 'pantry';
  const words = key.split(' ');
  if (words.includes('frozen') || words.some((w) => wordAisle(w) === 'frozen')) return 'frozen';
  // The last word names the thing ("chilli oil" is oil), the others describe it.
  const last = words.at(-1);
  const byLast = last ? wordAisle(last) : null;
  if (byLast) return byLast;
  for (const w of words) {
    const a = wordAisle(w);
    if (a) return a;
  }
  return 'other';
}

// ---------- amounts ----------

/** An ingredient as a grocery amount, at `factor` times and in the chosen units. */
export function additionFrom(ing: Ingredient, factor: number, mode: UnitMode, recipeId: string | null): GroceryAddition {
  let qty = ing.qty === null ? null : ing.qty * factor;
  let qtyMax = ing.qtyMax === null ? null : ing.qtyMax * factor;
  let unit = ing.unit;
  const known = unitById(ing.unit);
  if (known && qty !== null && mode !== 'original') {
    const c = convertFor(qty, known, mode, ing.item);
    if (c) {
      const ratio = c.value / qty;
      qty = c.value;
      qtyMax = qtyMax === null ? null : qtyMax * ratio;
      unit = c.unit.id;
    }
  }
  return { item: ing.item, qty, qtyMax, unit, unitText: unit ? null : ing.unitText, recipeId };
}

const same = (a: string | null, b: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

/** Grams over a kilo read as kilos, millilitres over a litre as litres, and back. */
function tidy(a: GroceryAmount): GroceryAmount {
  const unit = unitById(a.unit);
  if (!unit || a.qty === null || unit.system !== 'metric' || !unit.base) return a;
  const base = a.qty * unit.base;
  const target = unit.kind === 'mass' ? (base >= 1000 ? 'kg' : 'g') : base >= 1000 ? 'l' : 'ml';
  if (target === unit.id) return a;
  const to = unitById(target)!;
  const r = unit.base / to.base;
  return { ...a, qty: a.qty * r, qtyMax: a.qtyMax === null ? null : a.qtyMax * r, unit: to.id };
}

/** Adds one amount into a list of them: summed with one it can join, or kept beside them. */
export function mergeAmount(amounts: GroceryAmount[], add: GroceryAmount): GroceryAmount[] {
  const addUnit = unitById(add.unit);
  if (add.qty === null) {
    // "a handful", "to taste": kept once.
    if (amounts.some((a) => a.qty === null && same(a.unit, add.unit) && same(a.unitText, add.unitText))) return amounts;
    return [...amounts, add];
  }
  const i = amounts.findIndex((a) => {
    if (a.qty === null) return false;
    if (a.unit === add.unit && (a.unit !== null || same(a.unitText, add.unitText))) return true;
    const u = unitById(a.unit);
    return !!u && !!addUnit && u.base > 0 && addUnit.base > 0 && u.kind === addUnit.kind && u.system === addUnit.system;
  });
  if (i < 0) return [...amounts, tidy(add)];
  const into = amounts[i]!;
  const r = into.unit === add.unit ? 1 : addUnit!.base / unitById(into.unit)!.base;
  const lo = (into.qty ?? 0) + add.qty * r;
  const hasMax = into.qtyMax !== null || add.qtyMax !== null;
  const hi = hasMax ? (into.qtyMax ?? into.qty ?? 0) + (add.qtyMax ?? add.qty) * r : null;
  const merged = tidy({ ...into, qty: lo, qtyMax: hi });
  return amounts.map((a, j) => (j === i ? merged : a));
}

/** "200 g + 2 tbsp", "2–3", or '' when there is nothing to say. */
export function formatAmounts(amounts: GroceryAmount[], locale = 'en'): string {
  return amounts
    .map((a) => {
      const unit = unitById(a.unit);
      const words = unit ? unitLabel(unit, a.qtyMax ?? a.qty) : (a.unitText ?? '');
      if (a.qty === null) return words;
      const style = unit?.style ?? 'fraction';
      const n = formatQuantity(a.qty, style, locale);
      const range = a.qtyMax !== null && a.qtyMax > a.qty ? `${n}–${formatQuantity(a.qtyMax, style, locale)}` : n;
      return words ? `${range} ${words}` : range;
    })
    .filter(Boolean)
    .join(' + ');
}

// ---------- the list ----------

/**
 * Adds to the list. An item already on it gains the amount and the recipe;
 * one already ticked off is bought, so it comes back with just the new amount.
 */
export function addToList(
  list: GroceryItem[],
  additions: GroceryAddition[],
  overrides: Record<string, Aisle>,
  makeId: () => string,
  now = new Date(),
): GroceryItem[] {
  const next = [...list];
  for (const add of additions) {
    const name = add.item.trim();
    if (!name) continue;
    const key = groceryKey(name);
    const amount: GroceryAmount = { qty: add.qty, qtyMax: add.qtyMax, unit: add.unit, unitText: add.unitText };
    const hasAmount = amount.qty !== null || !!amount.unit || !!amount.unitText;
    const i = next.findIndex((g) => g.key === key);
    if (i >= 0) {
      const g = next[i]!;
      const amounts = g.ticked ? [] : g.amounts;
      const ids = g.ticked ? [] : g.recipeIds;
      next[i] = {
        ...g,
        ticked: false,
        amounts: hasAmount ? mergeAmount(amounts, amount) : amounts,
        recipeIds: add.recipeId && !ids.includes(add.recipeId) ? [...ids, add.recipeId] : ids,
      };
      continue;
    }
    next.push({
      id: makeId(),
      item: name,
      key,
      aisle: aisleFor(name, overrides, add.unit),
      amounts: hasAmount ? [tidy(amount)] : [],
      recipeIds: add.recipeId ? [add.recipeId] : [],
      ticked: false,
      addedAt: now.toISOString(),
    });
  }
  return next;
}

/** The list by aisle, in shop order, with ticked items at the bottom of each. */
export function byAisle(list: GroceryItem[]): { aisle: Aisle; items: GroceryItem[] }[] {
  return AISLES.map((aisle) => ({
    aisle,
    items: list.filter((g) => g.aisle === aisle).sort((a, b) => Number(a.ticked) - Number(b.ticked) || a.addedAt.localeCompare(b.addedAt)),
  })).filter((s) => s.items.length);
}

/** What is left to buy, as plain text for the share sheet. */
export function listToText(list: GroceryItem[], title: string, aisleName: (a: Aisle) => string, locale = 'en'): string {
  const lines = [title];
  for (const { aisle, items } of byAisle(list.filter((g) => !g.ticked))) {
    lines.push('', aisleName(aisle));
    for (const g of items) {
      const amount = formatAmounts(g.amounts, locale);
      lines.push(`- ${amount ? `${amount} ` : ''}${g.item}${g.note ? ` (${g.note})` : ''}`);
    }
  }
  return lines.join('\n');
}

/** True when the item is one you always have in, by its key. */
export function isStaple(item: string, staples: readonly string[]): boolean {
  return staples.includes(groceryKey(item));
}

export const DEFAULT_STAPLES = ['salt', 'black pepper', 'pepper', 'water', 'olive oil'];

/** A grocery item read back from storage; null if it isn't one. */
export function normaliseItem(value: unknown): GroceryItem | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<GroceryItem>;
  if (typeof v.id !== 'string' || typeof v.item !== 'string' || !v.item.trim()) return null;
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null);
  const str = (s: unknown) => (typeof s === 'string' && s ? s : null);
  return {
    id: v.id,
    item: v.item,
    key: groceryKey(v.item),
    aisle: AISLES.includes(v.aisle as Aisle) ? (v.aisle as Aisle) : aisleFor(v.item),
    amounts: Array.isArray(v.amounts) ? v.amounts.filter((a) => a && typeof a === 'object').map((a) => ({ qty: num(a.qty), qtyMax: num(a.qtyMax), unit: str(a.unit), unitText: str(a.unitText) })) : [],
    recipeIds: Array.isArray(v.recipeIds) ? v.recipeIds.filter((r): r is string => typeof r === 'string') : [],
    ticked: v.ticked === true,
    addedAt: typeof v.addedAt === 'string' ? v.addedAt : new Date().toISOString(),
    ...(typeof v.note === 'string' && v.note.trim() ? { note: v.note.trim().slice(0, 200) } : {}),
  };
}
