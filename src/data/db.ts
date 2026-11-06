// The recipe library, in IndexedDB (the WebView's on Android). Photos are
// kept apart from recipes so the list loads without reading image bytes.

import Dexie, { type EntityTable } from 'dexie';
import type { Collection, Recipe } from '../domain/recipe';

export interface Photo {
  id: string;
  full: Blob;
  thumb: Blob;
}

export class MiseDb extends Dexie {
  recipes!: EntityTable<Recipe, 'id'>;
  collections!: EntityTable<Collection, 'id'>;
  photos!: EntityTable<Photo, 'id'>;

  constructor(name = 'mise') {
    super(name);
    this.version(1).stores({
      recipes: 'id, updatedAt',
      collections: 'id',
      photos: 'id',
    });
  }
}

export const db = new MiseDb();
