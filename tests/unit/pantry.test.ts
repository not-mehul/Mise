import { describe, expect, it } from 'vitest';
import { averageRating, cookAgain, cookableWith, haveKeys, sortByLog } from '../../src/domain/pantry';
import { draftToRecipe, emptyDraft, type Recipe } from '../../src/domain/recipe';

const recipe = (title: string, ingredients: string, log: Recipe['log'] = []): Recipe => ({ ...draftToRecipe({ ...emptyDraft(), title, ingredients, steps: 'Cook.' }, undefined), log });
const entry = (at: string, rating: number | null) => ({ at, servings: null, rating, note: '' });

describe('what can I cook', () => {
  it('ranks recipes by how little is missing, counting staples as had', () => {
    const curry = recipe('Curry', '500 g chicken thighs\n1 onion\n1 tsp salt\n200 g rice');
    const salad = recipe('Salad', '1 lettuce\n2 tomatoes');
    const fried = recipe('Fried rice', '200 g rice\n2 eggs');
    const ranked = cookableWith([curry, salad, fried], haveKeys('Chicken, rice, onions'), ['salt']);
    expect(ranked.map((r) => [r.recipe.title, r.missing])).toEqual([
      ['Curry', []],
      ['Fried rice', ['eggs']],
    ]);
  });
});

describe('the cook log as a sort', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const a = recipe('A', '1 egg', [entry('2026-09-01T00:00:00Z', 5), entry('2026-08-01T00:00:00Z', 4)]);
  const b = recipe('B', '1 egg', [entry('2026-11-05T00:00:00Z', 3)]);
  const c = recipe('C', '1 egg');

  it('averages ratings and sorts by them, by count and by staleness', () => {
    expect(averageRating(a)).toBe(4.5);
    expect(sortByLog([c, b, a], 'rating').map((r) => r.title)).toEqual(['A', 'B', 'C']);
    expect(sortByLog([c, b, a], 'cooked').map((r) => r.title)).toEqual(['A', 'B', 'C']);
    expect(sortByLog([c, b, a], 'stale').map((r) => r.title)).toEqual(['A', 'B', 'C']);
  });

  it('suggests well-rated recipes not cooked in three weeks', () => {
    expect(cookAgain([a, b, c], now).map((r) => r.title)).toEqual(['A']);
  });
});
