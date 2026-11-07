import 'fake-indexeddb/auto';
import { gzipSync, strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/data/db';
import { emptyDraft } from '../../src/domain/recipe';
import { readRecipeFile } from '../../src/import/files';
import { parseBackup } from '../../src/lib/backup';
import { groceries } from '../../src/state/groceries.svelte';
import { library } from '../../src/state/library.svelte';
import { plan } from '../../src/state/plan.svelte';
import { settings } from '../../src/state/settings.svelte';
import { tombstones } from '../../src/state/tombstones';
import { backupBytes, mergeBackup } from '../../src/state/transfer.svelte';

async function fresh() {
  await db.delete();
  await db.open();
  await tombstones.init();
  await Promise.all([library.init(), groceries.init(), plan.init()]);
}

beforeEach(async () => {
  settings.update({ aisles: {}, staples: ['salt'], theme: 'system' });
  await fresh();
});

describe('full backups (version 2)', () => {
  it('carries groceries, the plan, settings and history, and restores them into an empty Mise', async () => {
    const r = await library.save({ ...emptyDraft(), title: 'Soup', ingredients: '1 onion', steps: 'Cook.' });
    await groceries.addTyped('2 lemons');
    await plan.add(r.id, '2026-11-09', 2);
    settings.update({ staples: ['salt', 'rice'], aisles: { 'kitchen roll': 'pantry' }, theme: 'light' });
    const bytes = await backupBytes();

    settings.update({ staples: ['salt'], aisles: {}, theme: 'dark' });
    await fresh();
    await mergeBackup(await parseBackup(bytes));
    expect(library.recipes.map((x) => x.title)).toEqual(['Soup']);
    expect(groceries.list.map((g) => g.item)).toEqual(['lemons']);
    expect(plan.list.map((e) => [e.recipeId, e.servings])).toEqual([[r.id, 2]]);
    expect(settings.current.staples).toEqual(['salt', 'rice']);
    expect(settings.current.aisles).toEqual({ 'kitchen roll': 'pantry' });
    expect(settings.current.theme).toBe('light');
    expect(groceries.history).toContain('2 lemons'.replace('2 ', ''));
  });

  it('never brings back what was deleted, on either side', async () => {
    const a = await library.save({ ...emptyDraft(), title: 'A', ingredients: 'x', steps: 'y' });
    const b = await library.save({ ...emptyDraft(), title: 'B', ingredients: 'x', steps: 'y' });
    const old = await parseBackup(await backupBytes());
    // Deleted here after the backup: merging the old backup must not restore it.
    const { forget } = await library.remove(a.id);
    await forget();
    await mergeBackup(old);
    expect(library.recipes.map((x) => x.title)).toEqual(['B']);
    // Another copy deleted B later than it was changed: B goes here too.
    await mergeBackup({ ...old, recipes: [], deleted: [{ id: b.id, at: new Date(Date.now() + 1000).toISOString() }] });
    expect(library.recipes).toEqual([]);
  });

  it('keeps reading version 1 backups', async () => {
    const v1 = JSON.stringify({ app: 'mise', version: 1, recipes: [{ id: 'r', title: 'Old', groups: [], steps: [], updatedAt: '2026-01-01T00:00:00Z' }], collections: [] });
    await mergeBackup(await parseBackup(strToU8(v1)));
    expect(library.recipes.map((x) => x.title)).toEqual(['Old']);
  });
});

describe('recipe files from elsewhere', () => {
  it('reads a Paprika export', async () => {
    const one = { name: 'Banana bread', ingredients: '3 bananas\n200 g flour', directions: 'Mash.\nBake 1 hr.', servings: '8 slices', prep_time: '15 mins', cook_time: '1 hr', source_url: 'https://example.com/bb', categories: ['Baking'], notes: 'Freezes well' };
    const zip = zipSync({ 'Banana bread.paprikarecipe': gzipSync(strToU8(JSON.stringify(one))) });
    const file = await readRecipeFile(zip, 'export.paprikarecipes');
    expect(file.kind).toBe('recipes');
    const { draft } = file.kind === 'recipes' ? file.recipes[0]! : { draft: emptyDraft() };
    expect(draft).toMatchObject({ title: 'Banana bread', servings: '8', prepMinutes: '15', cookMinutes: '60', tags: 'Baking', notes: 'Freezes well', source: { kind: 'url', url: 'https://example.com/bb' } });
  });

  it('reads schema.org and Mealie JSON', async () => {
    const mealie = { name: 'Dal', recipeYield: '4', recipeIngredient: [{ display: '200 g red lentils' }, { note: '1 onion' }], recipeInstructions: [{ text: 'Simmer 20 minutes.' }] };
    const file = await readRecipeFile(strToU8(JSON.stringify(mealie)));
    expect(file.kind === 'recipes' && file.recipes[0]!.draft).toMatchObject({ title: 'Dal', servings: '4', ingredients: '200 g red lentils\n1 onion', steps: 'Simmer 20 minutes.' });
    await expect(readRecipeFile(strToU8('{"hello":1}'))).rejects.toThrow();
  });
});

describe('recipe files shared from another app', () => {
  it('waits for Import before adding several recipes', async () => {
    const { importBytes } = await import('../../src/state/transfer.svelte');
    const { ui } = await import('../../src/state/ui.svelte');
    const { sharedFile } = await import('../../src/platform/shared');
    const list = [{ name: 'A', recipeIngredient: ['1 egg'], recipeInstructions: 'Fry.' }, { name: 'B', recipeIngredient: ['1 pear'], recipeInstructions: 'Eat.' }];
    const shared = sharedFile({ file: { name: 'r.json', data: btoa(JSON.stringify(list)) } })!;
    expect(await importBytes(shared.bytes, shared.name, true)).toBeNull();
    expect(library.recipes).toEqual([]);
    ui.toast!.action!.run();
    await vi.waitFor(() => expect(library.recipes.map((r) => r.title).sort()).toEqual(['A', 'B']));
  });
});
