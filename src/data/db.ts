// The recipe library, in IndexedDB (the WebView's on Android). Photos are
// kept apart from recipes so the list loads without reading image bytes.

import Dexie, { type EntityTable } from 'dexie';
import type { GroceryItem } from '../domain/groceries';
import type { PlanEntry } from '../domain/plan';
import type { Collection, Recipe } from '../domain/recipe';

export interface Photo {
  id: string;
  full: Blob;
  thumb: Blob;
}

/** A recipe that was deleted, and when: a sync or a backup merge must not bring it back. */
export interface Tombstone {
  id: string;
  at: string;
}

export class MiseDb extends Dexie {
  recipes!: EntityTable<Recipe, 'id'>;
  collections!: EntityTable<Collection, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  groceries!: EntityTable<GroceryItem, 'id'>;
  plan!: EntityTable<PlanEntry, 'id'>;
  deleted!: EntityTable<Tombstone, 'id'>;

  constructor(name = 'mise') {
    super(name);
    this.version(1).stores({
      recipes: 'id, updatedAt',
      collections: 'id',
      photos: 'id',
    });
    // The grocery list (phase 4).
    this.version(2).stores({ groceries: 'id' });
    // The week planner, and what was deleted (so a synced copy doesn't bring it back).
    this.version(3).stores({ plan: 'id, date', deleted: 'id' });
  }
}

export const db = new MiseDb();
