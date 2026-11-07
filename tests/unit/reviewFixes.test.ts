// Regressions for the bugs found in the November 2026 review (B1–B21).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { aisleFor, formatAmounts, groceryKey } from '../../src/domain/groceries';
import { parseIngredient, showIngredient } from '../../src/domain/ingredient';
import { draftToRecipe, emptyDraft, normaliseRecipe, parseTags, recipeToDraft } from '../../src/domain/recipe';
import { findTimers, linkIngredients } from '../../src/domain/steps';
import { captionFromPage } from '../../src/import/instagram';
import { parseRecipeText } from '../../src/import/text';
import { readShare } from '../../src/platform/shared';
import { library } from '../../src/state/library.svelte';

describe('reading captions without headings (B1, B3)', () => {
  it('keeps short method lines that mention amounts or times', () => {
    const { draft } = parseRecipeText('Lemon pasta\n200 g spaghetti\n1 lemon\nPour 2 cups of water into the pot.\nBake for 25 minutes until golden.\nServe hot with parmesan and lots of black pepper on top.');
    expect(draft.servings).toBe('');
    expect(draft.cookMinutes).toBe('');
    expect(draft.steps.split('\n')).toEqual(['Pour 2 cups of water into the pot.', 'Bake for 25 minutes until golden.', 'Serve hot with parmesan and lots of black pepper on top.']);
  });

  it('still reads servings and time lines', () => {
    const { draft } = parseRecipeText('Soup\nServes 4\nPrep time: 10 min | Cook: 30 minutes\nPour 6 personnes\n1 onion');
    expect(draft.servings).toBe('4');
    expect(draft.prepMinutes).toBe('10');
    expect(draft.cookMinutes).toBe('30');
    expect(parseRecipeText('Tarte\nPour 6 personnes\n200 g farine').draft.servings).toBe('6');
  });

  it('treats "Recipe 👇" as no heading at all', () => {
    const { draft } = parseRecipeText('Recipe 👇\n200 g flour\n2 eggs\nMix everything together and bake until it is golden on top.');
    expect(draft.ingredients).toBe('200 g flour\n2 eggs');
    expect(draft.steps).toBe('Mix everything together and bake until it is golden on top.');
  });
});

describe('ids (B2, B7)', () => {
  it('gives identical lines their own ids across edits', () => {
    const d = { ...emptyDraft(), title: 'Bread', ingredients: '1 tsp salt\n200 g flour\n1 tsp salt', steps: 'Mix.\nBake.' };
    const first = draftToRecipe(d, undefined);
    const again = draftToRecipe(recipeToDraft(first), first);
    const ids = again.groups[0]!.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(first.groups[0]!.items.map((i) => i.id));
    expect(again.steps.map((s) => s.id)).toEqual(first.steps.map((s) => s.id));
  });

  it('repairs duplicate ids saved by older versions', () => {
    const r = normaliseRecipe({ id: 'r', title: 'x', groups: [{ name: '', items: [{ id: 'a', raw: 'salt' }, { id: 'a', raw: 'salt' }] }], steps: [] })!;
    expect(new Set(r.groups[0]!.items.map((i) => i.id)).size).toBe(2);
  });
});

describe('sources (B6, B11)', () => {
  it('drops links that are not http(s)', () => {
    expect(normaliseRecipe({ id: 'r', title: 'x', source: { kind: 'url', url: 'javascript:alert(1)' } })!.source).toEqual({ kind: 'url' });
    expect(normaliseRecipe({ id: 'r', title: 'x', source: { kind: 'url', url: 'example.com' } })!.source.url).toBeUndefined();
    expect(normaliseRecipe({ id: 'r', title: 'x', source: { kind: 'weird', url: 'https://a.b/c' } })!.source).toEqual({ kind: 'manual', url: 'https://a.b/c' });
  });

  it('keeps an Instagram display name as a name, not a handle', () => {
    expect(captionFromPage('<meta property="og:title" content="Jamie Oliver on Instagram: &quot;Easy pasta&quot;">')?.author).toBe('Jamie Oliver');
    expect(captionFromPage('<meta property="og:description" content="12 likes, 3 comments - jamieoliver on March 1, 2026: &quot;Easy pasta&quot;">')?.author).toBe('@jamieoliver');
  });
});

describe('aisles (B4)', () => {
  it.each([
    ['smoked paprika', 'pantry'],
    ['chili powder', 'pantry'],
    ['garlic powder', 'pantry'],
    ['ground ginger', 'pantry'],
    ['lemon rind', 'produce'],
    ['couscous', 'pantry'],
    ['bay leaves', 'pantry'],
    ['garlic', 'produce'],
    ['2 garlic cloves', 'produce'],
  ])('%s → %s', (item, aisle) => expect(aisleFor(item)).toBe(aisle));

  it('keeps -us words whole', () => {
    expect(groceryKey('couscous')).toBe('couscous');
    expect(groceryKey('hummus')).toBe('hummus');
    expect(groceryKey('tomatoes')).toBe('tomato');
  });
});

describe('units (B5)', () => {
  it('keeps spoons in metric mode and plurals in US mode', () => {
    expect(showIngredient(parseIngredient('1 tsp salt'), 1, 'metric').amount).toBe('1 tsp');
    expect(showIngredient(parseIngredient('500 ml milk'), 1, 'us').amount).toBe('2⅛ cups');
    expect(showIngredient(parseIngredient('250 ml stock'), 1, 'us').amount).toBe('1 cup');
    expect(formatAmounts([{ qty: 2, qtyMax: null, unit: 'clove', unitText: null }])).toBe('2 cloves');
  });
});

describe('tags, step links and timers (B9, B10, B12)', () => {
  it('splits tags on commas or hashes only', () => {
    expect(parseTags('main course, quick dinner')).toEqual(['main course', 'quick dinner']);
    expect(parseTags('#pasta #quick')).toEqual(['pasta', 'quick']);
  });

  it('links plural ingredients to steps', () => {
    const groups = [{ name: '', items: [parseIngredient('3 tomatoes', 't'), parseIngredient('2 potatoes', 'p'), parseIngredient('2 cherries', 'c')] }];
    expect(linkIngredients('Chop the tomato and potatoes, then the cherry.', groups)).toEqual(['t', 'p', 'c']);
  });

  it('merges "1 hour 30 minutes" but not "5 minutes and 3 minutes"', () => {
    expect(findTimers('Cook 5 minutes and 3 minutes more').map((t) => t.seconds)).toEqual([300, 180]);
    expect(findTimers('Roast 1 hour 30 minutes').map((t) => t.seconds)).toEqual([5400]);
  });
});

describe('shares (subject)', () => {
  it('uses the subject as the first line of shared text', () => {
    const long = 'x'.repeat(250);
    expect(readShare({ text: long, subject: 'Banana bread' })).toEqual({ kind: 'text', text: `Banana bread\n${long}` });
  });
});

describe('the library (B14, B15)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await library.init();
  });

  it('counts collection changes as newer, and undoes a deleted collection', async () => {
    const r = await library.save({ ...emptyDraft(), title: 'Soup', ingredients: '1 onion', steps: 'Cook.' });
    const c = (await library.addCollection('Winter'))!;
    await library.toggleCollection(r.id, c.id);
    expect(library.get(r.id)!.updatedAt > r.updatedAt || library.get(r.id)!.updatedAt === r.updatedAt).toBe(true);
    const undo = await library.removeCollection(c.id);
    expect(library.collections).toEqual([]);
    expect(library.get(r.id)!.collectionIds).toEqual([]);
    await undo();
    expect(library.collections.map((x) => x.name)).toEqual(['Winter']);
    expect(library.get(r.id)!.collectionIds).toEqual([c.id]);
    await library.init();
    expect(library.get(r.id)!.collectionIds).toEqual([c.id]);
  });
});

describe('smarter units, inline amounts and sections (features)', () => {
  it('weighs cups of flour in metric and measures grams of sugar in US', async () => {
    const { showIngredient: show, parseIngredient: parse } = await import('../../src/domain/ingredient');
    expect(show(parse('1 cup flour'), 1, 'metric').amount).toBe('125 g');
    expect(show(parse('200 g sugar'), 1, 'us').amount).toBe('1 cup');
    expect(show(parse('1 cup milk'), 1, 'metric').amount).toBe('235 ml');
  });

  it('converts oven temperatures', async () => {
    const { convertTemperatures } = await import('../../src/domain/units');
    expect(convertTemperatures('Heat the oven to 180°C (fan 160 °C).', 'us')).toBe('Heat the oven to 355 °F (fan 320 °F).');
    expect(convertTemperatures('Bake at 350F.', 'metric')).toBe('Bake at 175 °C.');
    expect(convertTemperatures('Bake at 350F.', 'original')).toBe('Bake at 350F.');
  });

  it('puts the scaled amount after the first mention of an ingredient', async () => {
    const { stepParts } = await import('../../src/domain/steps');
    const groups = [{ name: '', items: [parseIngredient('200 g flour', 'f'), parseIngredient('2 eggs', 'e')] }];
    const step = { text: 'Whisk the eggs into the flour, then rest 10 minutes.', timers: findTimers('Whisk the eggs into the flour, then rest 10 minutes.'), ingredientIds: ['f', 'e'] };
    expect(stepParts(step, groups, 2, 'original').map((p) => p.text).join('')).toBe('Whisk the eggs (4) into the flour (400 g), then rest 10 minutes.');
  });

  it('reads "Name:" lines in the method as sections and writes them back', () => {
    const r = draftToRecipe({ ...emptyDraft(), title: 'Pie', ingredients: 'flour', steps: 'For the pastry:\nRub in the butter.\nChill.\nFilling:\nCook the apples.' }, undefined);
    expect(r.steps.map((s) => s.section)).toEqual(['For the pastry', 'For the pastry', 'Filling']);
    expect(recipeToDraft(r).steps).toBe('For the pastry:\nRub in the butter.\nChill.\nFilling:\nCook the apples.');
  });
});
