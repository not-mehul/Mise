import { describe, expect, it } from 'vitest';
import { cookPages, formatClock, normaliseLog, normalisePlace, resumePlace, RESUME_MS, stepIngredients, type CookPlace } from '../../src/domain/cook';
import { draftToRecipe, emptyDraft } from '../../src/domain/recipe';
import { stepPieces } from '../../src/domain/steps';

const recipe = draftToRecipe(
  { ...emptyDraft(), title: 'Pancakes', ingredients: '200 g flour\n2 eggs\n300 ml milk', steps: 'Whisk the flour and eggs.\nAdd the milk and rest 10 minutes.\nFry.' },
  undefined,
);

describe('cooking mode pages', () => {
  it('starts with mise en place, then each step, then the end', () => {
    expect(cookPages(recipe).map((p) => p.kind)).toEqual(['prep', 'step', 'step', 'step', 'done']);
  });

  it('skips mise en place when there is nothing to gather', () => {
    expect(cookPages({ groups: [], steps: recipe.steps }).map((p) => p.kind)).toEqual(['step', 'step', 'step', 'done']);
  });

  it('lists what each step needs', () => {
    expect(stepIngredients(recipe, recipe.steps[0]!).map((i) => i.item)).toEqual(['flour', 'eggs']);
    expect(stepIngredients(recipe, recipe.steps[1]!).map((i) => i.item)).toEqual(['milk']);
    expect(stepIngredients(recipe, recipe.steps[2]!)).toEqual([]);
  });

  it('cuts a step around its timers', () => {
    expect(stepPieces(recipe.steps[1]!)).toEqual([{ text: 'Add the milk and rest ' }, { text: '10 minutes', timer: 0 }, { text: '.' }]);
  });
});

describe('resuming', () => {
  const now = 1_800_000_000_000;
  const place: CookPlace = { recipeId: recipe.id, page: 2, servings: 4, gathered: ['a'], at: now - 60_000 };

  it('picks up where you left the same recipe', () => {
    expect(resumePlace(place, recipe.id, 5, now)).toEqual(place);
  });

  it('starts again for another recipe, after a few hours, or from the end', () => {
    expect(resumePlace(place, 'other', 5, now)).toBeNull();
    expect(resumePlace({ ...place, at: now - RESUME_MS - 1 }, recipe.id, 5, now)).toBeNull();
    expect(resumePlace({ ...place, page: 4 }, recipe.id, 5, now)).toBeNull();
    expect(resumePlace({ ...place, page: 9 }, recipe.id, 5, now)).toBeNull();
    expect(resumePlace(null, recipe.id, 5, now)).toBeNull();
  });

  it('reads a stored place defensively', () => {
    expect(normalisePlace({ recipeId: 'r', page: 1, at: 5, gathered: ['a', 3] })).toEqual({ recipeId: 'r', page: 1, servings: 1, gathered: ['a'], at: 5 });
    expect(normalisePlace({ recipeId: 'r', page: 1.5, at: 5 })).toBeNull();
    expect(normalisePlace('junk')).toBeNull();
  });
});

describe('the clock and the log', () => {
  it('counts down in minutes and seconds, and hours past the hour', () => {
    expect(formatClock(245_000)).toBe('4:05');
    expect(formatClock(244_100)).toBe('4:05');
    expect(formatClock(3_723_000)).toBe('1:02:03');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
  });

  it('keeps valid log entries, newest first', () => {
    expect(
      normaliseLog([
        { at: '2026-01-01T10:00:00.000Z', servings: 2, rating: 4, note: 'Good' },
        { at: '2026-03-01T10:00:00.000Z', servings: -1, rating: 9 },
        { at: 'not a date' },
        null,
      ]),
    ).toEqual([
      { at: '2026-03-01T10:00:00.000Z', servings: null, rating: null, note: '' },
      { at: '2026-01-01T10:00:00.000Z', servings: 2, rating: 4, note: 'Good' },
    ]);
    expect(normaliseLog(undefined)).toEqual([]);
  });
});
