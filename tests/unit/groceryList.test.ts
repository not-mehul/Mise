import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { formatAmounts, type GroceryItem } from '../../src/domain/groceries';
import { groceries } from '../../src/state/groceries.svelte';
import { settings } from '../../src/state/settings.svelte';

beforeEach(async () => {
  await db.delete();
  await db.open();
  settings.update({ aisles: {}, staples: ['salt'] });
  await groceries.init();
});

describe('the grocery list', () => {
  it('adds typed items, merges them, and keeps them through a reload', async () => {
    await groceries.addTyped('2 lemons');
    await groceries.addTyped('1 lemon');
    await groceries.addTyped('kitchen roll');
    expect(groceries.list.map((g) => [g.item, formatAmounts(g.amounts), g.aisle])).toEqual([
      ['lemons', '3', 'produce'],
      ['kitchen roll', '', 'other'],
    ]);
    expect(groceries.history.slice(0, 2)).toEqual(['kitchen roll', 'lemon']);
    await groceries.init();
    expect(groceries.list).toHaveLength(2);
  });

  it('ticks, moves to another aisle for next time, and removes with undo', async () => {
    const roll = (await groceries.addTyped('kitchen roll'))!;
    await groceries.toggle(roll.id);
    expect(groceries.left).toBe(0);
    await groceries.move(roll.id, 'pantry');
    expect(settings.current.aisles['kitchen roll']).toBe('pantry');

    const undo = await groceries.remove([roll.id]);
    expect(groceries.list).toHaveLength(0);
    await groceries.addTyped('Kitchen rolls');
    expect(groceries.list[0]!.aisle).toBe('pantry');
    await groceries.remove([groceries.list[0]!.id]);
    await undo();
    expect(groceries.list.map((g) => g.item)).toEqual(['kitchen roll']);
    expect(await db.groceries.count()).toBe(1);
  });

  it('marks and unmarks staples by name', () => {
    groceries.setStaple('Olive Oil', true);
    expect(settings.current.staples).toContain('olive oil');
    groceries.setStaple('olive oil', false);
    expect(settings.current.staples).toEqual(['salt']);
  });

  it('edits an item, its amount and note, and merges it into a twin', async () => {
    await groceries.addTyped('2 lemons');
    await groceries.addTyped('200 g butter');
    const butter = groceries.list.find((g) => g.item === 'butter')!;
    await groceries.edit(butter.id, '300 g butter', 'unsalted');
    expect(groceries.list.find((g) => g.id === butter.id)).toMatchObject({ note: 'unsalted' });
    expect(formatAmounts(groceries.list.find((g) => g.id === butter.id)!.amounts)).toBe('300 g');
    await groceries.edit(butter.id, '1 lemon', '');
    expect(groceries.list.map((g) => [g.item, formatAmounts(g.amounts)])).toEqual([['lemons', '3']]);
    await groceries.init();
    expect(groceries.list).toHaveLength(1);
  });
});

describe('the home screen widget', () => {
  it('lists what is left to buy, in shop order, with amounts', async () => {
    const { widgetLines } = await import('../../src/state/widget.svelte');
    const item = (id: string, item: string, aisle: GroceryItem['aisle'], ticked = false, amounts: GroceryItem['amounts'] = []) =>
      ({ id, item, key: item, aisle, amounts, recipeIds: [], ticked, addedAt: '2026-11-01T00:00:00Z' }) as GroceryItem;
    const lines = widgetLines([item('a', 'bread', 'bakery'), item('b', 'lemons', 'produce', false, [{ qty: 2, qtyMax: null, unit: null }] as GroceryItem['amounts']), item('c', 'milk', 'dairy', true)]);
    expect(lines).toEqual(['lemons · 2', 'bread']);
  });
});
