import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { emptyDraft, recipeToDraft } from '../../src/domain/recipe';
import { buildBackupZip, buildJson, parseBackup, backupsToPrune, isBackupDue } from '../../src/lib/backup';
import { recipeToMarkdown } from '../../src/lib/markdown';
import { library } from '../../src/state/library.svelte';

const draft = (title: string, ingredients = '200 g flour\n2 eggs', steps = 'Mix.\nBake 20 minutes.') => ({ ...emptyDraft(), title, ingredients, steps });

beforeEach(async () => {
  await db.delete();
  await db.open();
  await library.init();
});

describe('the library', () => {
  it('saves, edits and keeps ingredient ids stable', async () => {
    const saved = await library.save(draft('Pancakes'));
    expect(library.recipes.map((r) => r.title)).toEqual(['Pancakes']);
    const flourId = saved.groups[0]!.items[0]!.id;

    const edited = await library.save({ ...recipeToDraft(saved), ingredients: '200 g flour\n3 eggs\n300 ml milk' });
    expect(edited.id).toBe(saved.id);
    expect(edited.groups[0]!.items[0]!.id).toBe(flourId);
    expect(edited.groups[0]!.items).toHaveLength(3);

    await library.init();
    expect(library.get(saved.id)?.groups[0]!.items).toHaveLength(3);
  });

  it('logs each cook, newest first, and keeps the log through edits and reloads', async () => {
    const saved = await library.save(draft('Pancakes'));
    await library.logCook(saved.id, { servings: 2, rating: 4, note: '  Less sugar  ' }, new Date('2026-01-01T10:00:00Z'));
    await library.logCook(saved.id, { servings: null, rating: null, note: '' }, new Date('2026-02-01T10:00:00Z'));
    const logged = library.get(saved.id)!;
    expect(logged.log.map((e) => e.at)).toEqual(['2026-02-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z']);
    expect(logged.log[1]).toEqual({ at: '2026-01-01T10:00:00.000Z', servings: 2, rating: 4, note: 'Less sugar' });
    expect(logged.updatedAt).toBe('2026-02-01T10:00:00.000Z');

    await library.save({ ...recipeToDraft(logged), title: 'Fluffy pancakes' });
    await library.init();
    expect(library.get(saved.id)?.log).toHaveLength(2);

    await library.setLog(saved.id, logged.log.slice(1));
    expect(library.get(saved.id)?.log).toHaveLength(1);
  });

  it('deletes with undo', async () => {
    const saved = await library.save(draft('Soup'));
    const { undo } = await library.remove(saved.id);
    expect(library.recipes).toHaveLength(0);
    expect(await db.recipes.count()).toBe(0);
    await undo();
    expect(library.get(saved.id)?.title).toBe('Soup');
    expect(await db.recipes.count()).toBe(1);
  });

  it('keeps collections in step with their recipes', async () => {
    const saved = await library.save(draft('Curry'));
    const c = (await library.addCollection('Weeknights'))!;
    expect(await library.addCollection('weeknights')).toEqual(c);
    await library.toggleCollection(saved.id, c.id);
    expect(library.get(saved.id)?.collectionIds).toEqual([c.id]);
    await library.removeCollection(c.id);
    expect(library.collections).toEqual([]);
    expect(library.get(saved.id)?.collectionIds).toEqual([]);
  });

  it('merges a backup: new recipes added, the newest copy wins', async () => {
    const a = await library.save(draft('A'));
    const json = buildJson([{ ...a, title: 'A (newer)', updatedAt: '2999-01-01T00:00:00.000Z' }, { ...a, id: 'other', title: 'B' }], []);
    const data = await parseBackup(new TextEncoder().encode(json));
    const summary = await library.merge(data.recipes, data.collections, data.photos);
    expect(summary).toEqual({ added: 1, updated: 1, unchanged: 0, removed: 0 });
    expect(library.get(a.id)?.title).toBe('A (newer)');
    expect(library.get('other')?.title).toBe('B');
  });
});

describe('backups', () => {
  it('round-trips recipes, collections and photos through a zip', async () => {
    const photo = { id: 'p1', full: new Blob([new Uint8Array([1, 2, 3])]), thumb: new Blob([new Uint8Array([4])]) };
    const r = await library.save({ ...draft('Bread'), photoIds: ['p1'] });
    const zip = await buildBackupZip([r], [{ id: 'c', name: 'Baking', createdAt: r.createdAt }], [photo]);
    const back = await parseBackup(zip);
    expect(back.recipes[0]!.title).toBe('Bread');
    expect(back.collections[0]!.name).toBe('Baking');
    expect(new Uint8Array(await back.photos.get('p1')!.full.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('refuses files that are not Mise backups', async () => {
    await expect(parseBackup(new TextEncoder().encode('{"app":"ledger","entries":[]}'))).rejects.toThrow();
    await expect(parseBackup(new TextEncoder().encode('hello'))).rejects.toThrow();
  });

  it('is due weekly and keeps the newest five', () => {
    const now = Date.parse('2026-11-06T12:00:00Z');
    expect(isBackupDue(undefined, now)).toBe(true);
    expect(isBackupDue('2026-11-01T12:00:00Z', now)).toBe(false);
    expect(isBackupDue('2026-10-30T12:00:00Z', now)).toBe(true);
    const names = ['01', '02', '03', '04', '05', '06', '07'].map((d) => `mise-backup-2026-10-${d}-0900.zip`);
    expect(backupsToPrune([...names, 'other.zip'])).toEqual([names[1], names[0]]);
  });
});

describe('markdown', () => {
  it('writes a readable recipe', async () => {
    const r = await library.save({ ...draft('Pancakes', 'Batter:\n200 g flour\n2 eggs'), servings: '4', tags: 'breakfast' });
    const md = recipeToMarkdown(r, {
      ingredients: 'Ingredients', method: 'Method', notes: 'Notes', source: 'Source',
      serves: (n) => `Serves ${n}`, minutes: (n) => `${n} min`,
    });
    expect(md).toBe('# Pancakes\n\nServes 4\n\n#breakfast\n\n## Ingredients\n\n### Batter\n\n- 200 g flour\n- 2 eggs\n\n## Method\n\n1. Mix.\n2. Bake 20 minutes.\n');
  });
});
