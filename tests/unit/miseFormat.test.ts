import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { draftToRecipe } from '../../src/domain/recipe';
import { prepNeeds } from '../../src/domain/prep';
import { isMiseText, parseMiseText } from '../../src/import/mise';
import { formatMinutes, recipeToMarkdown } from '../../src/lib/markdown';
import { fromText } from '../../src/state/importer';
import { library } from '../../src/state/library.svelte';

// The worked example in Recipes_Guide.md, word for word.
const TIKKA = `# Chicken tikka masala

Serves: 4
Prep: 20 min
Cook: 40 min
Total: 5 hr
Tags: indian, curry, make ahead
Collections: Weeknights
Source: https://example.com/chicken-tikka-masala
Author: Example Kitchen
Calories: 520
Protein: 38 g
Carbs: 18 g
Fat: 30 g

A mild, creamy curry. The chicken marinates for at least 4 hours, so start in the morning.

## Ingredients

### For the marinade
- 600 g boneless chicken thighs, cut into 3 cm pieces
- 150 g plain yoghurt
- 1 tbsp lemon juice
- 2 tsp garam masala
- 1 tsp salt

### For the sauce
- 2 tbsp neutral oil
- 1 large onion, finely chopped
- 3 cloves garlic, grated
- 1 tbsp ginger, grated
- 1 can chopped tomatoes (400 g)
- 150 ml double cream
- salt, to taste
- coriander, to serve (optional)

## Method

### Marinate
1. Mix the yoghurt, lemon juice, garam masala and salt in a bowl. Stir in the chicken thighs, cover and chill for at least 4 hours.

### Cook
2. Heat the grill to high. Spread the thighs on a lined tray and grill for 10 minutes, turning once, until charred at the edges.
3. Heat the oil in a large pan over a medium heat. Fry the onion for 8 minutes, until soft and golden.
4. Add the garlic and ginger and cook for 1 minute.
5. Pour in the tomatoes and simmer for 10 minutes.
6. Stir in the cream and the grilled thighs and simmer for 5 minutes. Season with salt.
7. Scatter with coriander and serve with rice.

## Notes

Keeps for 3 days in the fridge. Freezes well before the cream goes in.
`;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await library.init();
});

describe('the Mise text format', () => {
  it('reads every field of the guide example', () => {
    const { draft, collections } = parseMiseText(TIKKA)!;
    expect(draft.title).toBe('Chicken tikka masala');
    expect([draft.servings, draft.prepMinutes, draft.cookMinutes, draft.totalMinutes]).toEqual(['4', '20', '40', '300']);
    expect(draft.tags).toBe('indian, curry, make ahead');
    expect(collections).toEqual(['Weeknights']);
    expect(draft.source).toMatchObject({ kind: 'url', url: 'https://example.com/chicken-tikka-masala', author: 'Example Kitchen' });
    expect(draft.nutrition).toEqual({ calories: '520', protein: '38', carbs: '18', fat: '30' });
    expect(draft.notes).toBe('A mild, creamy curry. The chicken marinates for at least 4 hours, so start in the morning.\n\nKeeps for 3 days in the fridge. Freezes well before the cream goes in.');
    expect(draft.unsorted).toEqual([]);

    const r = draftToRecipe(draft, undefined);
    expect(r.groups.map((g) => [g.name, g.items.length])).toEqual([['For the marinade', 5], ['For the sauce', 8]]);
    const thighs = r.groups[0]!.items[0]!;
    expect(thighs).toMatchObject({ qty: 600, unit: 'g', item: 'boneless chicken thighs', note: 'cut into 3 cm pieces' });
    expect(r.groups[1]!.items[4]).toMatchObject({ qty: 1, unit: 'can', item: 'chopped tomatoes', note: '400 g' });
    expect(r.groups[1]!.items[6]).toMatchObject({ qty: null, item: 'salt', note: 'to taste' });
    expect(r.steps).toHaveLength(7);
    expect(r.steps.map((s) => s.section)).toEqual(['Marinate', 'Cook', 'Cook', 'Cook', 'Cook', 'Cook', 'Cook']);
    expect(r.steps[0]!.text.startsWith('Mix the yoghurt')).toBe(true);
    // Durations become timers, and the steps link the ingredients they name.
    expect(r.steps[1]!.timers.map((t) => t.seconds)).toEqual([600]);
    expect(r.steps[1]!.ingredientIds).toContain(thighs.id);
    // "At least 4 hours" is prep ahead.
    expect(prepNeeds(r).map((n) => n.hours)).toEqual([4]);
  });

  it('goes out as Markdown and comes back the same', () => {
    const first = draftToRecipe(parseMiseText(TIKKA)!.draft, undefined);
    const md = recipeToMarkdown(first, { ingredients: 'Ingredients', method: 'Method', notes: 'Notes', collections: () => ['Weeknights'] });
    expect(md).toContain('Total: 5 hr\nTags: indian, curry, make ahead\nCollections: Weeknights\n');
    const back = parseMiseText(md)!;
    expect(back.collections).toEqual(['Weeknights']);
    const again = draftToRecipe(back.draft, undefined);
    const shape = (r: typeof first) => ({
      title: r.title, servings: r.servings, prep: r.prepMinutes, cook: r.cookMinutes, total: r.totalMinutes, tags: r.tags,
      source: { url: r.source.url, author: r.source.author }, nutrition: r.nutrition, notes: r.notes,
      groups: r.groups.map((g) => [g.name, g.items.map((i) => i.raw)]), steps: r.steps.map((s) => [s.section, s.text]),
    });
    expect(shape(again)).toEqual(shape(first));
  });

  it('writes durations the way it reads them', () => {
    expect([formatMinutes(45), formatMinutes(60), formatMinutes(90)]).toEqual(['45 min', '1 hr', '1 hr 30 min']);
    const text = '# Stew\n\nPrep: 1 hr 30 min\nCook: 90\nTotal: 2h30\n\n## Method\n\n1. Stew.';
    const { draft } = parseMiseText(text)!;
    expect([draft.prepMinutes, draft.cookMinutes, draft.totalMinutes]).toEqual(['90', '90', '150']);
  });

  it('is only used for text that starts with a title and has an Ingredients or Method heading', () => {
    expect(isMiseText(TIKKA)).toBe(true);
    expect(isMiseText('Chilli eggs\n2 eggs\nFry the eggs for 3 minutes.')).toBe(false);
    expect(isMiseText('#pasta #quick\n## Ingredients\n- 200 g pasta')).toBe(false);
    expect(isMiseText('# Pasta\n\nJust a note, no sections.')).toBe(false);
    expect(parseMiseText('Pasta\n## Method\n1. Boil.')).toBeNull();
  });

  it('carries a wrapped step on, and reads bullets, "Step 1:" and plain lines', () => {
    const wrapped = parseMiseText('# Soup\n\n## Method\n\n1. Melt the butter\n   in a large pan.\n2. Add the leeks.')!.draft;
    expect(wrapped.steps).toBe('Melt the butter in a large pan.\nAdd the leeks.');
    const bullets = parseMiseText('# Soup\n\n## Steps\n\n- Melt the butter.\n- Add the leeks.')!.draft;
    expect(bullets.steps).toBe('Melt the butter.\nAdd the leeks.');
    const labelled = parseMiseText('# Soup\n\n## Instructions\n\nStep 1: Melt the butter.\nStep 2: Add the leeks.')!.draft;
    expect(labelled.steps).toBe('Melt the butter.\nAdd the leeks.');
    const plain = parseMiseText('# Soup\n\n## Directions\n\nMelt the butter.\nAdd the leeks.')!.draft;
    expect(plain.steps).toBe('Melt the butter.\nAdd the leeks.');
  });

  it('takes groups and sections written as "Name:" lines too', () => {
    const { draft } = parseMiseText('# Pie\n\n## Ingredients\n\nPastry:\n- 200 g flour\nFilling:\n- 3 apples\n\n## Method\n\nPastry:\n1. Rub in the butter.\nFilling:\n2. Slice the apples.')!;
    const r = draftToRecipe(draft, undefined);
    expect(r.groups.map((g) => g.name)).toEqual(['Pastry', 'Filling']);
    expect(r.steps.map((s) => s.section)).toEqual(['Pastry', 'Filling']);
  });

  it('keeps other sections in the notes under their name', () => {
    const { draft } = parseMiseText('# Bread\n\n## Ingredients\n\n- 500 g flour\n\n## Equipment\n\nA 900 g loaf tin.\n\n## Notes\n\nBest on the day.')!;
    expect(draft.notes).toBe('Equipment:\nA 900 g loaf tin.\n\nBest on the day.');
  });

  it('reads a source that is not a link as the author, and knows an Instagram link', () => {
    expect(parseMiseText('# Dal\n\nSource: Grandma\n\n## Method\n\n1. Cook.')!.draft.source).toEqual({ kind: 'text', author: 'Grandma', text: expect.any(String) });
    expect(parseMiseText('# Dal\n\nSource: https://www.instagram.com/p/abc/\nAuthor: @cook\n\n## Method\n\n1. Cook.')!.draft.source).toMatchObject({ kind: 'instagram', author: '@cook' });
    // javascript: and other schemes are never kept as a link.
    expect(parseMiseText('# Dal\n\nSource: javascript:alert(1)\n\n## Method\n\n1. Cook.')!.draft.source.url).toBeUndefined();
  });

  it('reads one Nutrition line, and field names in any case', () => {
    const { draft } = parseMiseText('# Bowl\n\nSERVES: 2 people\nprep time: 10 minutes\nNutrition: 450 kcal, 30 g protein, 40 g carbs, 12 g fat\n\n## Ingredients\n\n- 1 egg')!;
    expect(draft.servings).toBe('2');
    expect(draft.prepMinutes).toBe('10');
    expect(draft.nutrition).toEqual({ calories: '450', protein: '30', carbs: '40', fat: '12' });
  });

  it('reads the header and trailing source of exports from before the format', () => {
    const old = '# Pancakes\n\nServes 4 · 45 min\n\n#breakfast #sweet\n\nPer serving: 450 kcal · Protein 32.5 g\n\n## Ingredients\n\n- 200 g flour\n\n## Method\n\n1. Mix.\n\nSource: https://example.com/pancakes\n';
    const { draft } = parseMiseText(old)!;
    expect([draft.servings, draft.totalMinutes, draft.tags]).toEqual(['4', '45', 'breakfast, sweet']);
    expect(draft.nutrition).toMatchObject({ calories: '450', protein: '32.5' });
    expect(draft.steps).toBe('Mix.');
    expect(draft.source.url).toBe('https://example.com/pancakes');
  });

  it('files the recipe in existing collections, and makes new ones only when it is saved', async () => {
    const weeknights = (await library.addCollection('Weeknights'))!;
    const draft = fromText(TIKKA.replace('Collections: Weeknights', 'Collections: weeknights, Curries'));
    expect(draft.collectionIds).toEqual([weeknights.id]);
    expect(draft.newCollections).toEqual(['Curries']);
    expect(library.collections.map((c) => c.name)).toEqual(['Weeknights']);
    const saved = await library.save(draft);
    const curries = library.collections.find((c) => c.name === 'Curries')!;
    expect(saved.collectionIds).toEqual([weeknights.id, curries.id]);
  });

  it('leaves text in any other shape to the usual reader', () => {
    const draft = fromText('Chilli eggs\n2 eggs\n1 tbsp chilli oil\nFry the eggs in the chilli oil for 3 minutes.');
    expect(draft.title).toBe('Chilli eggs');
    expect(draft.ingredients).toBe('2 eggs\n1 tbsp chilli oil');
  });
});
