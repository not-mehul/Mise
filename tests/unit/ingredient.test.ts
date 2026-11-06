import { describe, expect, it } from 'vitest';
import { keyWord, parseIngredient, showIngredient, type Ingredient } from '../../src/domain/ingredient';
import { formatQuantity, parseLeadingQuantity } from '../../src/domain/quantity';

const parse = (line: string) => {
  const rest: Partial<Ingredient> = parseIngredient(line, 'x');
  delete rest.id;
  return rest;
};

describe('quantities', () => {
  it('reads the ways recipes write numbers', () => {
    expect(parseLeadingQuantity('2 eggs')).toMatchObject({ qty: 2, qtyMax: null, rest: 'eggs' });
    expect(parseLeadingQuantity('1½ cups')).toMatchObject({ qty: 1.5, rest: 'cups' });
    expect(parseLeadingQuantity('1 ½ cups')?.qty).toBe(1.5);
    expect(parseLeadingQuantity('1 1/2 cups')?.qty).toBe(1.5);
    expect(parseLeadingQuantity('3/4 cup')?.qty).toBe(0.75);
    expect(parseLeadingQuantity('1,5 kg')?.qty).toBe(1.5);
    expect(parseLeadingQuantity('2–3 cloves')).toMatchObject({ qty: 2, qtyMax: 3, rest: 'cloves' });
    expect(parseLeadingQuantity('2 to 3 cloves')).toMatchObject({ qty: 2, qtyMax: 3 });
    expect(parseLeadingQuantity('1 apple')).toMatchObject({ qty: 1, qtyMax: null, rest: 'apple' });
    expect(parseLeadingQuantity('salt')).toBeNull();
  });

  it('formats for the kitchen', () => {
    expect(formatQuantity(1.5, 'fraction')).toBe('1½');
    expect(formatQuantity(0.33, 'fraction')).toBe('⅓');
    expect(formatQuantity(2.98, 'fraction')).toBe('3');
    expect(formatQuantity(453.6, 'decimal')).toBe('455');
    expect(formatQuantity(28.35, 'decimal')).toBe('28');
    expect(formatQuantity(2.25, 'decimal', 'de')).toBe('2,3');
  });
});

describe('ingredient lines', () => {
  it('splits quantity, unit, item and note', () => {
    expect(parse('1½ cups plain flour, sifted')).toEqual({
      raw: '1½ cups plain flour, sifted', qty: 1.5, qtyMax: null, unit: 'cup', unitText: 'cups', item: 'plain flour', note: 'sifted',
    });
    expect(parse('- 200g butter (softened)')).toMatchObject({ qty: 200, unit: 'g', unitText: 'g', item: 'butter', note: 'softened' });
    expect(parse('2 tbsp. olive oil')).toMatchObject({ qty: 2, unit: 'tbsp', unitText: 'tbsp.', item: 'olive oil' });
    expect(parse('3 cloves of garlic, minced')).toMatchObject({ qty: 3, unit: 'clove', item: 'garlic', note: 'minced' });
    expect(parse('2 large eggs')).toMatchObject({ qty: 2, unit: null, item: 'large eggs' });
    expect(parse('1 T sugar')).toMatchObject({ unit: 'tbsp' });
    expect(parse('1 t sugar')).toMatchObject({ unit: 'tsp' });
  });

  it('handles lines without a number', () => {
    expect(parse('Salt and pepper to taste')).toMatchObject({ qty: null, unit: null, item: 'Salt and pepper', note: 'to taste' });
    expect(parse('a pinch of salt')).toMatchObject({ qty: 1, unit: 'pinch', item: 'salt' });
    expect(parse('pinch of chilli flakes')).toMatchObject({ qty: null, unit: 'pinch', item: 'chilli flakes' });
    expect(parse('▢ garlic')).toMatchObject({ qty: null, unit: null, item: 'garlic' });
  });

  it('reads the other interface languages', () => {
    expect(parse('2 cucharadas de aceite')).toMatchObject({ qty: 2, unit: 'tbsp', item: 'aceite' });
    expect(parse('1 c. à s. de miel')).toMatchObject({ qty: 1, unit: 'tbsp', item: 'miel' });
    expect(parse('2 EL Olivenöl')).toMatchObject({ qty: 2, unit: 'tbsp', item: 'Olivenöl' });
    expect(parse('250 Gramm Mehl')).toMatchObject({ qty: 250, unit: 'g', item: 'Mehl' });
  });

  it('does not take the start of a word for a unit', () => {
    expect(parse('2 garlic bulbs')).toMatchObject({ unit: null, item: 'garlic bulbs' });
    expect(parse('1 large onion')).toMatchObject({ unit: null, item: 'large onion' });
  });
});

describe('showing an ingredient', () => {
  it('scales and keeps the unit as written', () => {
    expect(showIngredient(parseIngredient('1½ cups flour'), 2, 'original').amount).toBe('3 cups');
    expect(showIngredient(parseIngredient('2–3 cloves garlic'), 2, 'original').amount).toBe('4–6 cloves');
    expect(showIngredient(parseIngredient('salt, to taste'), 2, 'original')).toMatchObject({ amount: '', item: 'salt', note: 'to taste' });
  });

  it('converts between metric and US', () => {
    expect(showIngredient(parseIngredient('1 cup milk'), 1, 'metric').amount).toBe('235 ml');
    expect(showIngredient(parseIngredient('1 lb beef'), 1, 'metric').amount).toBe('455 g');
    expect(showIngredient(parseIngredient('500 g beef'), 1, 'us').amount).toBe('1⅛ lb');
    expect(showIngredient(parseIngredient('250 ml stock'), 1, 'us').amount).toBe('1 cup');
    // Spoons stay spoons in US mode; grams stay grams in metric mode.
    expect(showIngredient(parseIngredient('2 tbsp oil'), 1, 'us').amount).toBe('2 tbsp');
    expect(showIngredient(parseIngredient('200 g sugar'), 1, 'metric').amount).toBe('200 g');
  });

  it('picks the word a step would use', () => {
    expect(keyWord('plain flour')).toBe('flour');
    expect(keyWord('Olivenöl')).toBe('olivenöl');
  });
});
