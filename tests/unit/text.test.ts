import { describe, expect, it } from 'vitest';
import { draftToRecipe } from '../../src/domain/recipe';
import { parseMinutes, parseRecipeText } from '../../src/import/text';

const BLOG = `Weeknight Tomato Pasta

A quick dinner from the pantry.

Serves 4
Prep time: 10 mins | Cook time: 20 mins

Ingredients
- 400 g spaghetti
- 2 tbsp olive oil
- 3 cloves garlic, sliced
For the sauce:
- 1 can (400 g) chopped tomatoes
- Salt and pepper to taste

Method
1. Boil the spaghetti for 10 minutes.
2. Fry the garlic in the oil for 1 minute, then add the tomatoes and simmer 15 minutes.
3. Toss with the pasta and season.

Notes
Keeps for 2 days in the fridge.`;

const CAPTION = `Crispy chilli oil eggs 🌶️🍳
Save this for breakfast tomorrow!

2 eggs
1 tbsp chilli oil
1 spring onion, sliced
Splash of soy sauce

Heat the chilli oil in a small pan over medium heat until it sizzles.
Crack in the eggs and fry for 3 minutes, spooning the oil over the whites.
Finish with soy sauce and spring onion and eat straight away.

#breakfast #eggs #chillioil
Link in bio for more!`;

describe('pasted recipe text', () => {
  it('reads a recipe with headings', () => {
    const { draft, structured } = parseRecipeText(BLOG);
    expect(structured).toBe(true);
    expect(draft.title).toBe('Weeknight Tomato Pasta');
    expect(draft.servings).toBe('4');
    expect(draft.prepMinutes).toBe('10');
    expect(draft.cookMinutes).toBe('20');
    expect(draft.ingredients.split('\n')).toEqual([
      '400 g spaghetti', '2 tbsp olive oil', '3 cloves garlic, sliced', 'For the sauce:', '1 can (400 g) chopped tomatoes', 'Salt and pepper to taste',
    ]);
    expect(draft.steps.split('\n')).toHaveLength(3);
    expect(draft.steps.split('\n')[0]).toBe('Boil the spaghetti for 10 minutes.');
    expect(draft.notes).toBe('A quick dinner from the pantry.\nKeeps for 2 days in the fridge.');
    expect(draft.unsorted).toEqual([]);

    const recipe = draftToRecipe(draft, undefined);
    expect(recipe.groups.map((g) => [g.name, g.items.length])).toEqual([['', 3], ['For the sauce', 2]]);
    expect(recipe.steps[1]!.timers.map((t) => t.seconds)).toEqual([60, 900]);
    expect(recipe.source.text).toBe(BLOG);
  });

  it('reads an Instagram-style caption without headings', () => {
    const { draft, structured } = parseRecipeText(CAPTION, 'instagram');
    expect(structured).toBe(false);
    expect(draft.title).toBe('Crispy chilli oil eggs');
    expect(draft.ingredients.split('\n')).toEqual(['2 eggs', '1 tbsp chilli oil', '1 spring onion, sliced']);
    expect(draft.steps.split('\n')).toHaveLength(3);
    // Not enough to place it: the person decides.
    expect(draft.unsorted).toEqual(['Splash of soy sauce']);
  });

  it('reads headings in the other languages', () => {
    const { draft } = parseRecipeText('Tortilla\n\nIngredientes:\n4 huevos\n2 patatas\n\nPreparación:\nPela las patatas.\nFríelas 20 minutos.');
    expect(draft.ingredients).toBe('4 huevos\n2 patatas');
    expect(draft.steps).toBe('Pela las patatas.\nFríelas 20 minutos.');
    const de = parseRecipeText('Kuchen\nZutaten\n200 g Mehl\nZubereitung\nAlles verrühren.').draft;
    expect(de.ingredients).toBe('200 g Mehl');
    expect(de.steps).toBe('Alles verrühren.');
  });

  it('splits a run-on method paragraph into steps', () => {
    const long = 'Method\n' + 'Heat the oven to 200C and line a tray. Toss the vegetables in oil and salt. Roast for 30 minutes, turning halfway. Scatter with herbs and serve warm with yoghurt and bread on the side for everyone.';
    expect(parseRecipeText(long).draft.steps.split('\n')).toHaveLength(4);
  });

  it('reads durations', () => {
    expect(parseMinutes('1 hr 20 mins')).toBe(80);
    expect(parseMinutes('45 minutes')).toBe(45);
    expect(parseMinutes('1h30')).toBe(90);
    expect(parseMinutes('soon')).toBeNull();
  });
});
