import { describe, expect, it } from 'vitest';
import { addToList, additionFrom, aisleFor, byAisle, formatAmounts, groceryKey, isStaple, listToText, mergeAmount, normaliseItem, type GroceryAddition } from '../../src/domain/groceries';
import { parseIngredient } from '../../src/domain/ingredient';

let n = 0;
const id = () => `g${++n}`;
const add = (line: string, recipeId: string | null = 'r1', factor = 1): GroceryAddition => additionFrom(parseIngredient(line), factor, 'original', recipeId);
const now = new Date('2026-11-07T10:00:00Z');

describe('matching items', () => {
  it('matches singular and plural, case and spacing', () => {
    expect(groceryKey('Spring  Onions')).toBe('spring onion');
    expect(groceryKey('eggs')).toBe(groceryKey('egg'));
    expect(groceryKey('tomatoes')).toBe('tomato');
    expect(groceryKey('berries')).toBe('berry');
    expect(groceryKey('glass')).toBe('glass');
  });
});

describe('aisles', () => {
  it('sorts by the word lists in each language', () => {
    expect(aisleFor('spring onions')).toBe('produce');
    expect(aisleFor('chilli oil')).toBe('pantry');
    expect(aisleFor('unsalted butter')).toBe('dairy');
    expect(aisleFor('chicken thighs')).toBe('meat');
    expect(aisleFor('sourdough bread')).toBe('bakery');
    expect(aisleFor('frozen peas')).toBe('frozen');
    expect(aisleFor('coconut milk')).toBe('pantry');
    expect(aisleFor('red pepper')).toBe('produce');
    expect(aisleFor('black pepper')).toBe('pantry');
    expect(aisleFor('cebollas')).toBe('produce');
    expect(aisleFor('Zwiebeln')).toBe('produce');
    expect(aisleFor('Eier')).toBe('dairy');
    expect(aisleFor('farine')).toBe('pantry');
    expect(aisleFor('washing-up liquid')).toBe('other');
  });

  it('puts tins in the pantry and remembers a move', () => {
    expect(aisleFor('chickpeas', {}, 'can')).toBe('pantry');
    expect(aisleFor('Feta', { feta: 'other' })).toBe('other');
  });
});

describe('amounts', () => {
  it('adds the same unit and units of one kind', () => {
    const a = mergeAmount([{ qty: 200, qtyMax: null, unit: 'g', unitText: null }], { qty: 900, qtyMax: null, unit: 'g', unitText: null });
    expect(formatAmounts(a)).toBe('1.1 kg');
    const b = mergeAmount([{ qty: 1, qtyMax: null, unit: 'tbsp', unitText: null }], { qty: 1, qtyMax: null, unit: 'tbsp', unitText: null });
    expect(formatAmounts(b)).toBe('2 tbsp');
    const c = mergeAmount([{ qty: 1, qtyMax: null, unit: 'kg', unitText: null }], { qty: 250, qtyMax: null, unit: 'g', unitText: null });
    expect(formatAmounts(c)).toBe('1.3 kg');
  });

  it('keeps what can’t be combined side by side', () => {
    let a = mergeAmount([], { qty: 200, qtyMax: null, unit: 'g', unitText: null });
    a = mergeAmount(a, { qty: 2, qtyMax: null, unit: 'tbsp', unitText: null });
    a = mergeAmount(a, { qty: null, qtyMax: null, unit: 'pinch', unitText: null });
    a = mergeAmount(a, { qty: null, qtyMax: null, unit: 'pinch', unitText: null });
    expect(formatAmounts(a)).toBe('200 g + 2 tbsp + pinch');
  });

  it('adds counts and ranges', () => {
    const a = mergeAmount([{ qty: 2, qtyMax: 3, unit: null, unitText: null }], { qty: 1, qtyMax: null, unit: null, unitText: null });
    expect(formatAmounts(a)).toBe('3–4');
  });
});

describe('the list', () => {
  it('merges matching items from several recipes', () => {
    let list = addToList([], [add('200 g butter'), add('2 eggs'), add('1 spring onion, sliced')], {}, id, now);
    list = addToList(list, [add('2 tbsp butter', 'r2'), add('1 egg', 'r2')], {}, id, now);
    expect(list).toHaveLength(3);
    const butter = list.find((g) => g.key === 'butter')!;
    expect(formatAmounts(butter.amounts)).toBe('200 g + 2 tbsp');
    expect(butter.recipeIds).toEqual(['r1', 'r2']);
    expect(formatAmounts(list.find((g) => g.key === 'egg')!.amounts)).toBe('3');
    expect(list.find((g) => g.key === 'spring onion')!.aisle).toBe('produce');
  });

  it('scales from the chosen servings and units', () => {
    expect(formatAmounts([additionFrom(parseIngredient('1 cup milk'), 2, 'metric', null)])).toBe('475 ml');
  });

  it('brings a ticked item back with just the new amount', () => {
    let list = addToList([], [add('2 lemons')], {}, id, now);
    list = list.map((g) => ({ ...g, ticked: true }));
    list = addToList(list, [add('1 lemon', 'r9')], {}, id, now);
    expect(list[0]!.ticked).toBe(false);
    expect(formatAmounts(list[0]!.amounts)).toBe('1');
    expect(list[0]!.recipeIds).toEqual(['r9']);
  });

  it('takes typed items without an amount', () => {
    const list = addToList([], [add('kitchen roll', null), add('Kitchen roll', null)], {}, id, now);
    expect(list).toHaveLength(1);
    expect(list[0]!.amounts).toEqual([]);
    expect(list[0]!.recipeIds).toEqual([]);
  });

  it('groups by aisle with ticked items last, and shares what is left', () => {
    let list = addToList([], [add('2 onions'), add('200 g butter'), add('1 lemon')], {}, id, now);
    list = list.map((g) => (g.key === 'onion' ? { ...g, ticked: true } : g));
    expect(byAisle(list).map((s) => [s.aisle, s.items.map((g) => g.item)])).toEqual([
      ['produce', ['lemon', 'onions']],
      ['dairy', ['butter']],
    ]);
    expect(listToText(list, 'Groceries', (a) => a.toUpperCase())).toBe('Groceries\n\nPRODUCE\n- 1 lemon\n\nDAIRY\n- 200 g butter');
  });

  it('knows staples and reads stored items defensively', () => {
    expect(isStaple('Salt', ['salt'])).toBe(true);
    expect(isStaple('sea salt', ['salt'])).toBe(false);
    expect(normaliseItem({ id: 'a', item: 'Leeks', aisle: 'nowhere', amounts: [{ qty: 2 }] })).toMatchObject({ key: 'leek', aisle: 'produce', amounts: [{ qty: 2, qtyMax: null, unit: null, unitText: null }], ticked: false });
    expect(normaliseItem({ id: 'a', item: ' ' })).toBeNull();
    expect(normaliseItem(null)).toBeNull();
  });
});
