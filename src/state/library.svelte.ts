// ============================================================
// The recipe library: every recipe and collection, loaded once and
// kept in step with IndexedDB.
// ============================================================

import { db, type Photo } from '../data/db';
import type { CookEntry } from '../domain/cook';
import { newId } from '../domain/ingredient';
import { draftToRecipe, normaliseRecipe, type Collection, type Recipe, type RecipeDraft } from '../domain/recipe';

export type Status = 'loading' | 'ready' | 'failed';

export interface MergeSummary {
  added: number;
  updated: number;
  unchanged: number;
}

const byNewest = (a: Recipe, b: Recipe) => b.updatedAt.localeCompare(a.updatedAt);

class Library {
  status = $state<Status>('loading');
  recipes = $state.raw<Recipe[]>([]);
  collections = $state.raw<Collection[]>([]);
  private thumbs = new Map<string, string>();

  async init(): Promise<void> {
    try {
      const [recipes, collections] = await Promise.all([db.recipes.toArray(), db.collections.toArray()]);
      this.recipes = recipes.map(normaliseRecipe).filter((r): r is Recipe => r !== null).sort(byNewest);
      this.collections = collections.sort((a, b) => a.name.localeCompare(b.name));
      this.status = 'ready';
    } catch (err) {
      console.error('Opening the library failed:', err);
      this.status = 'failed';
    }
  }

  get(id: string | null | undefined): Recipe | undefined {
    return id ? this.recipes.find((r) => r.id === id) : undefined;
  }

  /** Saves the editor's draft as a new or updated recipe. */
  async save(draft: RecipeDraft): Promise<Recipe> {
    const existing = this.get(draft.id);
    const recipe = draftToRecipe(draft, existing);
    await db.recipes.put($state.snapshot(recipe) as Recipe);
    if (existing?.photoId && existing.photoId !== recipe.photoId) await this.dropPhoto(existing.photoId);
    this.recipes = [recipe, ...this.recipes.filter((r) => r.id !== recipe.id)];
    return recipe;
  }

  async update(id: string, patch: Partial<Pick<Recipe, 'collectionIds' | 'notes' | 'tags'>>): Promise<void> {
    const current = this.get(id);
    if (!current) return;
    const next = { ...current, ...patch };
    await db.recipes.put($state.snapshot(next) as Recipe);
    this.recipes = this.recipes.map((r) => (r.id === id ? next : r));
  }

  /**
   * Sets a recipe's cook log. It counts as a change to the recipe, so the
   * newer copy wins when a backup is merged in.
   */
  async setLog(id: string, log: CookEntry[], now = new Date()): Promise<void> {
    const current = this.get(id);
    if (!current) return;
    const next: Recipe = { ...current, log: [...log].sort((a, b) => b.at.localeCompare(a.at)), updatedAt: now.toISOString() };
    await db.recipes.put($state.snapshot(next) as Recipe);
    this.recipes = [next, ...this.recipes.filter((r) => r.id !== id)];
  }

  /** Adds a time it was cooked to the recipe's log. */
  async logCook(id: string, entry: Omit<CookEntry, 'at'>, now = new Date()): Promise<void> {
    const current = this.get(id);
    if (!current) return;
    const clean: CookEntry = { at: now.toISOString(), servings: entry.servings, rating: entry.rating, note: entry.note.trim().slice(0, 2000) };
    await this.setLog(id, [clean, ...current.log], now);
  }

  /**
   * Removes a recipe and returns what undoes it. Its photo is kept until
   * `forget` is called, when the undo toast goes away.
   */
  async remove(id: string): Promise<{ undo: () => Promise<void>; forget: () => Promise<void> }> {
    const recipe = this.get(id);
    if (!recipe) return { undo: async () => {}, forget: async () => {} };
    await db.recipes.delete(id);
    this.recipes = this.recipes.filter((r) => r.id !== id);
    return {
      undo: async () => {
        await db.recipes.put(recipe);
        this.recipes = [...this.recipes, recipe].sort(byNewest);
      },
      forget: async () => {
        if (recipe.photoId && !this.recipes.some((r) => r.photoId === recipe.photoId)) await this.dropPhoto(recipe.photoId);
      },
    };
  }

  // ---------- collections ----------

  async addCollection(name: string): Promise<Collection | null> {
    const clean = name.trim().slice(0, 60);
    if (!clean) return null;
    const found = this.collections.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (found) return found;
    const collection: Collection = { id: newId(), name: clean, createdAt: new Date().toISOString() };
    await db.collections.put(collection);
    this.collections = [...this.collections, collection].sort((a, b) => a.name.localeCompare(b.name));
    return collection;
  }

  async removeCollection(id: string): Promise<void> {
    await db.transaction('rw', db.collections, db.recipes, async () => {
      await db.collections.delete(id);
      for (const r of this.recipes.filter((r) => r.collectionIds.includes(id))) {
        await db.recipes.put({ ...r, collectionIds: r.collectionIds.filter((c) => c !== id) });
      }
    });
    this.collections = this.collections.filter((c) => c.id !== id);
    this.recipes = this.recipes.map((r) => (r.collectionIds.includes(id) ? { ...r, collectionIds: r.collectionIds.filter((c) => c !== id) } : r));
  }

  async toggleCollection(recipeId: string, collectionId: string): Promise<void> {
    const r = this.get(recipeId);
    if (!r) return;
    const ids = r.collectionIds.includes(collectionId) ? r.collectionIds.filter((c) => c !== collectionId) : [...r.collectionIds, collectionId];
    await this.update(recipeId, { collectionIds: ids });
  }

  // ---------- photos ----------

  async addPhoto(full: Blob, thumb: Blob): Promise<string> {
    const id = newId();
    await db.photos.put({ id, full, thumb });
    return id;
  }

  async dropPhoto(id: string): Promise<void> {
    await db.photos.delete(id).catch(() => undefined);
    const url = this.thumbs.get(id);
    if (url) URL.revokeObjectURL(url);
    this.thumbs.delete(id);
  }

  /** An object URL for a photo's thumbnail, cached for the session. */
  async thumbUrl(id: string): Promise<string | null> {
    const cached = this.thumbs.get(id);
    if (cached) return cached;
    const photo = await db.photos.get(id).catch(() => undefined);
    if (!photo) return null;
    const url = URL.createObjectURL(photo.thumb);
    this.thumbs.set(id, url);
    return url;
  }

  async photo(id: string): Promise<Photo | undefined> {
    return db.photos.get(id).catch(() => undefined);
  }

  // ---------- backups ----------

  /** Merges a backup in: new recipes are added, and the most recently saved copy of each wins. */
  async merge(recipes: Recipe[], collections: Collection[], photos: Map<string, Photo>): Promise<MergeSummary> {
    const summary: MergeSummary = { added: 0, updated: 0, unchanged: 0 };
    // A working copy for the merge, not reactive state.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const next = new Map(this.recipes.map((r) => [r.id, r]));
    await db.transaction('rw', db.recipes, db.collections, db.photos, async () => {
      for (const c of collections) if (!this.collections.some((x) => x.id === c.id)) await db.collections.put(c);
      for (const r of recipes) {
        const current = next.get(r.id);
        if (current && current.updatedAt >= r.updatedAt) {
          summary.unchanged++;
          continue;
        }
        if (current) summary.updated++;
        else summary.added++;
        await db.recipes.put(r);
        next.set(r.id, r);
        const photo = r.photoId ? photos.get(r.photoId) : undefined;
        if (photo) await db.photos.put(photo);
      }
    });
    this.recipes = [...next.values()].sort(byNewest);
    const known = new Set(this.collections.map((c) => c.id));
    this.collections = [...this.collections, ...collections.filter((c) => !known.has(c.id))].sort((a, b) => a.name.localeCompare(b.name));
    return summary;
  }
}

export const library = new Library();
