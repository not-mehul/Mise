import { describe, expect, it } from 'vitest';
import { additionFrom } from '../../src/domain/groceries';
import { joinAmount, parseIngredient, splitAmount } from '../../src/domain/ingredient';
import { draftToRecipe, emptyDraft, normaliseNutrition, normaliseRecipe, recipeToDraft } from '../../src/domain/recipe';
import { draftFromSchema } from '../../src/import/schema';
import { captionFromTikTokOembed, captionFromYouTube, youTubeId } from '../../src/import/social';
import { parseRecipeText, readMacros } from '../../src/import/text';
import { importLink } from '../../src/import/web';
import { recipeToMarkdown } from '../../src/lib/markdown';

describe('ingredient amounts', () => {
  it('keeps the 0 in "0% fat" and never reads it as an amount', () => {
    const ing = parseIngredient('0% fat free yoghurt, 250g');
    expect(ing.item).toBe('0% fat free yoghurt');
    expect([ing.qty, ing.unit]).toEqual([250, 'g']);
    expect(additionFrom(ing, 1, 'original', null).item).toBe('0% fat free yoghurt');
  });

  it('reads an amount written after the item', () => {
    const chicken = parseIngredient('Chicken breast, approx. 21.2 oz / 1.3 lbs, diced - 600g');
    expect([chicken.qty, chicken.unit, chicken.item, chicken.note]).toEqual([600, 'g', 'Chicken breast', 'approx. 21.2 oz / 1.3 lbs, diced']);
    const rice = parseIngredient('Basmati rice - 200g, uncooked, approx. 7 oz / 1 cup');
    expect([rice.qty, rice.unit, rice.item, rice.note]).toEqual([200, 'g', 'Basmati rice', 'uncooked, approx. 7 oz / 1 cup']);
    const yoghurt = parseIngredient('Greek yoghurt (0% fat) - 150g');
    expect([yoghurt.qty, yoghurt.item, yoghurt.note]).toEqual([150, 'Greek yoghurt', '0% fat']);
  });

  it('leaves lines without a weight or volume alone', () => {
    expect(parseIngredient('Salt, to taste').qty).toBeNull();
    expect(parseIngredient('Eggs, 3 of them').qty).toBeNull();
  });

  it('splits a line into the editor boxes and back', () => {
    expect(splitAmount('1½ cups plain flour, sifted')).toEqual({ amount: '1½ cups', name: 'plain flour, sifted' });
    expect(splitAmount('Basmati rice - 200g, uncooked')).toEqual({ amount: '200 g', name: 'Basmati rice, uncooked' });
    expect(splitAmount('0% fat yoghurt')).toEqual({ amount: '', name: '0% fat yoghurt' });
    expect(splitAmount('0% fat free yoghurt, 250g')).toEqual({ amount: '250 g', name: '0% fat free yoghurt' });
    expect(splitAmount('2 eggs')).toEqual({ amount: '2', name: 'eggs' });
    const joined = joinAmount('200 g', 'Basmati rice');
    expect([parseIngredient(joined).qty, parseIngredient(joined).item]).toEqual([200, 'Basmati rice']);
  });

  it('sorts a trailing-amount line into the ingredients on import', () => {
    const { draft } = parseRecipeText('Biryani\nChicken breast, diced - 600g\nBasmati rice - 200g, uncooked\n\nCook the rice in plenty of salted water for 20 minutes.');
    expect(draft.unsorted).toEqual([]);
    expect(draft.ingredients.split('\n')).toHaveLength(2);
  });
});

describe('macros', () => {
  it('reads macro lines in the usual shapes', () => {
    expect(readMacros('Macros: 520 kcal | 45g P | 50g C | 12g F')).toEqual({ calories: '520', protein: '45', carbs: '50', fat: '12' });
    expect(readMacros('Protein: 40g, Carbs: 50g, Fat: 12g, Calories: 450')).toEqual({ protein: '40', carbs: '50', fat: '12', calories: '450' });
    expect(readMacros('📊 Per serving: 480 calories, 52g protein, 45g carbs, 9g fat')).toEqual({ calories: '480', protein: '52', carbs: '45', fat: '9' });
    expect(readMacros('450 kcal')).toEqual({ calories: '450' });
  });

  it('does not mistake recipe lines for macros', () => {
    for (const line of ['2 tbsp olive oil', 'Bake at 180 C for 20 minutes', 'Add 40 g of fat', '2 C flour', 'Chicken breast - 600g']) expect(readMacros(line)).toBeNull();
  });

  it('takes macros out of a caption into the recipe', () => {
    const { draft } = parseRecipeText('Biryani\nServes 4\n600g chicken\n200g rice\nMacros per serving: 520 kcal, 45g protein, 50g carbs, 12g fat\n\nCook the rice for 20 minutes.');
    expect(draft.nutrition).toEqual({ calories: '520', protein: '45', carbs: '50', fat: '12' });
    expect(draft.ingredients).toBe('600g chicken\n200g rice');
  });

  it('saves, reloads and exports them', () => {
    const draft = { ...emptyDraft(), title: 'Bowl', ingredients: '1 egg', nutrition: { calories: '450', protein: '32,5 g', carbs: '', fat: 'x' } };
    const recipe = draftToRecipe(draft, undefined);
    expect(recipe.nutrition).toEqual({ calories: 450, protein: 32.5, carbs: null, fat: null });
    expect(normaliseRecipe(JSON.parse(JSON.stringify(recipe)))!.nutrition).toEqual(recipe.nutrition);
    expect(recipeToDraft(recipe).nutrition).toEqual({ calories: '450', protein: '32.5', carbs: '', fat: '' });
    // A recipe saved before macros existed has none.
    const old: Partial<typeof recipe> = { ...recipe };
    delete old.nutrition;
    expect(normaliseRecipe(old)!.nutrition).toEqual(normaliseNutrition(undefined));
    const md = recipeToMarkdown(recipe, { ingredients: 'Ingredients', method: 'Method', notes: 'Notes', serves: String, minutes: String, source: 'Source', macros: () => 'Per serving: 450 kcal · Protein 32.5 g' });
    expect(md).toContain('Per serving: 450 kcal · Protein 32.5 g');
    expect(parseRecipeText(md).draft.nutrition).toMatchObject({ calories: '450', protein: '32.5' });
  });

  it('reads schema.org nutrition', () => {
    const { draft } = draftFromSchema({ '@type': 'Recipe', name: 'Bowl', recipeIngredient: ['1 egg'], nutrition: { calories: '450 kcal', proteinContent: '30 g', carbohydrateContent: '40g', fatContent: '12.5 g' } }, 'https://example.com', null);
    expect(draft.nutrition).toEqual({ calories: '450', protein: '30', carbs: '40', fat: '12.5' });
  });
});

describe('other apps', () => {
  const CAPTION = 'Chilli eggs\n2 eggs\n1 tbsp chilli oil\nFry the eggs in the chilli oil for 3 minutes.';

  it('finds YouTube video ids in every link shape', () => {
    expect(youTubeId('https://youtu.be/abc123XYZ?si=x')).toBe('abc123XYZ');
    expect(youTubeId('https://www.youtube.com/shorts/abc123XYZ')).toBe('abc123XYZ');
    expect(youTubeId('https://m.youtube.com/watch?v=abc123XYZ&t=4')).toBe('abc123XYZ');
  });

  it('reads a TikTok caption through oEmbed', async () => {
    const oembed = JSON.stringify({ title: CAPTION, author_unique_id: 'cook', thumbnail_url: 'https://p.tiktokcdn.com/x.jpg' });
    expect(captionFromTikTokOembed(oembed)?.author).toBe('@cook');
    const result = await importLink('https://www.tiktok.com/@cook/video/123', async (url) => (url.includes('/oembed') ? oembed : null));
    expect(result.ok && result.draft.ingredients).toBe('2 eggs\n1 tbsp chilli oil');
    expect(result.ok && result.draft.title).toBe('Chilli eggs');
  });

  it('reads a YouTube description under its title', async () => {
    const html = `<meta property="og:title" content="Chilli eggs"><script>var x = {"shortDescription":"2 eggs\\n1 tbsp chilli oil\\nFry the eggs in the chilli oil for 3 minutes.","ownerChannelName":"Cook"};</script>`;
    expect(captionFromYouTube(html)?.caption.split('\n')[0]).toBe('Chilli eggs');
    const result = await importLink('https://youtu.be/abc123XYZ', async (url) => (url === 'https://www.youtube.com/watch?v=abc123XYZ' ? html : null));
    expect(result.ok && result.draft.ingredients).toBe('2 eggs\n1 tbsp chilli oil');
  });

  it('reads a post from its link preview (Facebook, Threads, Pinterest)', async () => {
    const html = `<meta property="og:title" content="Chilli eggs"><meta property="og:description" content="${CAPTION.split('\n').slice(1).join('&#10;')}">`;
    const result = await importLink('https://www.facebook.com/share/p/abc/', async () => html);
    expect(result.ok && result.draft.ingredients).toBe('2 eggs\n1 tbsp chilli oil');
  });
});
