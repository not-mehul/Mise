// ============================================================
// The grocery list, kept in IndexedDB beside the recipes.
// ============================================================

import { db } from '../data/db';
import { addToList, aisleFor, groceryKey, mergeAmount, normaliseItem, type Aisle, type GroceryAddition, type GroceryItem } from '../domain/groceries';
import { newId, parseIngredient } from '../domain/ingredient';
import { settings } from './settings.svelte';
import { tombstones } from './tombstones';

const HISTORY_KEY = 'mise.groceryHistory';
const HISTORY_MAX = 300;

function loadHistory(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

class Groceries {
  list = $state.raw<GroceryItem[]>([]);
  /** Items added before, most recent first, for the add field's suggestions. */
  history = $state.raw<string[]>(loadHistory());

  async init(): Promise<void> {
    try {
      this.list = (await db.groceries.toArray()).map(normaliseItem).filter((g): g is GroceryItem => g !== null);
    } catch (err) {
      console.error('Opening the grocery list failed:', err);
    }
  }

  get left(): number {
    return this.list.filter((g) => !g.ticked).length;
  }

  /** Adds items, merging any already on the list. Returns how many lines it touched. */
  async add(additions: GroceryAddition[]): Promise<number> {
    const before = new Map(this.list.map((g) => [g.id, g]));
    const next = addToList(this.list, additions, settings.current.aisles, newId);
    const changed = next.filter((g) => before.get(g.id) !== g);
    await db.groceries.bulkPut(changed.map((g) => $state.snapshot(g) as GroceryItem));
    this.list = next;
    this.remember(additions.map((a) => a.item));
    return changed.length;
  }

  /** A typed line: "2 lemons", "kitchen roll". */
  async addTyped(text: string): Promise<GroceryItem | null> {
    const line = text.trim().slice(0, 200);
    if (!line) return null;
    const ing = parseIngredient(line);
    await this.add([{ item: ing.item, qty: ing.qty, qtyMax: ing.qtyMax, unit: ing.unit, unitText: ing.unit ? null : ing.unitText, recipeId: null }]);
    return this.list.find((g) => g.key === groceryKey(ing.item)) ?? null;
  }

  /**
   * Rewrites an item from a typed line ("300 g butter") and a note. If it now names
   * something already on the list, the two become one line.
   */
  async edit(id: string, text: string, note: string): Promise<void> {
    const g = this.list.find((x) => x.id === id);
    const line = text.trim().slice(0, 200);
    if (!g || !line) return;
    const ing = parseIngredient(line);
    const key = groceryKey(ing.item);
    const amount = { qty: ing.qty, qtyMax: ing.qtyMax, unit: ing.unit, unitText: ing.unit ? null : ing.unitText };
    const hasAmount = amount.qty !== null || !!amount.unit || !!amount.unitText;
    const cleanNote = note.trim().slice(0, 200);
    const next: GroceryItem = {
      ...g,
      item: ing.item,
      key,
      aisle: key === g.key ? g.aisle : aisleFor(ing.item, settings.current.aisles, ing.unit),
      amounts: hasAmount ? [amount] : [],
    };
    if (cleanNote) next.note = cleanNote;
    else delete next.note;
    const twin = this.list.find((x) => x.id !== id && x.key === key);
    if (!twin) return this.patch(id, () => next);
    const merged: GroceryItem = {
      ...twin,
      ticked: twin.ticked && g.ticked,
      amounts: next.amounts.reduce(mergeAmount, twin.ticked ? [] : twin.amounts),
      recipeIds: [...new Set([...twin.recipeIds, ...g.recipeIds])],
      ...(cleanNote || twin.note ? { note: cleanNote || twin.note } : {}),
    };
    await db.transaction('rw', db.groceries, async () => {
      await db.groceries.delete(id);
      await db.groceries.put($state.snapshot(merged) as GroceryItem);
    });
    this.list = this.list.filter((x) => x.id !== id).map((x) => (x.id === twin.id ? merged : x));
  }

  async toggle(id: string): Promise<void> {
    await this.patch(id, (g) => ({ ...g, ticked: !g.ticked }));
  }

  /** Moves an item to another aisle, and remembers it for next time. */
  async move(id: string, aisle: Aisle): Promise<void> {
    const g = this.list.find((x) => x.id === id);
    if (!g) return;
    settings.update({ aisles: { ...settings.current.aisles, [g.key]: aisle } });
    await this.patch(id, (x) => ({ ...x, aisle }));
  }

  /** Removes items and returns what puts them back. */
  async remove(ids: string[]): Promise<() => Promise<void>> {
    const gone = this.list.filter((g) => ids.includes(g.id));
    await db.groceries.bulkDelete(gone.map((g) => g.id));
    await tombstones.add(gone.map((g) => g.id));
    this.list = this.list.filter((g) => !ids.includes(g.id));
    return async () => {
      await tombstones.drop(gone.map((g) => g.id));
      await db.groceries.bulkPut(gone);
      const known = new Set(this.list.map((g) => g.id));
      this.list = [...this.list, ...gone.filter((g) => !known.has(g.id))];
    };
  }

  /**
   * Merges a list from a backup or a synced copy: items not here (by id or by name) are
   * added unless deleted here, and items the other copy deleted go. Ours win otherwise.
   */
  async merge(items: GroceryItem[], deleted: { id: string }[] = [], history: string[] = []): Promise<void> {
    const gone = new Set(deleted.map((d) => d.id));
    const keys = new Set(this.list.map((g) => g.key));
    const ids = new Set(this.list.map((g) => g.id));
    const fresh = items.filter((g) => !ids.has(g.id) && !keys.has(g.key) && !tombstones.at(g.id) && !gone.has(g.id));
    const removed = this.list.filter((g) => gone.has(g.id)).map((g) => g.id);
    await db.transaction('rw', db.groceries, async () => {
      if (fresh.length) await db.groceries.bulkPut(fresh);
      if (removed.length) await db.groceries.bulkDelete(removed);
    });
    this.list = [...this.list.filter((g) => !gone.has(g.id)), ...fresh];
    if (history.length) {
      const known = new Set(this.history.map(groceryKey));
      this.history = [...this.history, ...history.filter((h) => !known.has(groceryKey(h)))].slice(0, HISTORY_MAX);
      this.saveHistory();
    }
  }

  setStaple(item: string, on: boolean): void {
    const key = groceryKey(item);
    const rest = settings.current.staples.filter((s) => s !== key);
    settings.update({ staples: on ? [...rest, key] : rest });
  }

  private async patch(id: string, change: (g: GroceryItem) => GroceryItem): Promise<void> {
    const g = this.list.find((x) => x.id === id);
    if (!g) return;
    const next = change(g);
    await db.groceries.put($state.snapshot(next) as GroceryItem);
    this.list = this.list.map((x) => (x.id === id ? next : x));
  }

  private remember(items: string[]): void {
    const names = [...new Map(items.map((i) => i.trim()).filter(Boolean).map((i) => [groceryKey(i), i])).values()];
    if (!names.length) return;
    const keys = new Set(names.map(groceryKey));
    this.history = [...names, ...this.history.filter((h) => !keys.has(groceryKey(h)))].slice(0, HISTORY_MAX);
    this.saveHistory();
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      // Private mode: suggestions last until the app closes.
    }
  }
}

export const groceries = new Groceries();
