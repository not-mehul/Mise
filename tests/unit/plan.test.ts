import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { byDay, isoDay, normaliseEntry, planDays } from '../../src/domain/plan';
import { plan } from '../../src/state/plan.svelte';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await plan.init();
});

describe('the week planner', () => {
  it('lists the next days in local time', () => {
    expect(planDays(new Date(2026, 11, 30), 4)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('adds, moves, marks and removes entries with undo, and keeps them through a reload', async () => {
    const a = await plan.add('r1', '2026-11-09', 4);
    const b = await plan.add('r2', '2026-11-10', null);
    await plan.move(b.id, '2026-11-09');
    await plan.markListed([a.id]);
    expect(byDay(plan.list, ['2026-11-09', '2026-11-10']).map((d) => d.entries.length)).toEqual([2, 0]);
    const undo = await plan.remove([a.id]);
    expect(plan.list.map((e) => e.recipeId)).toEqual(['r2']);
    await undo();
    await plan.init();
    expect(plan.list.find((e) => e.id === a.id)).toMatchObject({ listed: true, servings: 4 });
    await plan.forgetRecipe('r2');
    expect(plan.list.map((e) => e.recipeId)).toEqual(['r1']);
  });

  it('refuses entries that are not plan entries', () => {
    expect(normaliseEntry({ id: 'x', recipeId: 'r', date: 'tomorrow' })).toBeNull();
    expect(normaliseEntry({ id: 'x', recipeId: 'r', date: '2026-11-09', servings: -2 })).toMatchObject({ servings: null, listed: false });
  });
});
