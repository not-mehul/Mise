// ============================================================
// The week planner, kept in IndexedDB beside the recipes.
// ============================================================

import { db } from '../data/db';
import { newId } from '../domain/ingredient';
import { normaliseEntry, type PlanEntry } from '../domain/plan';
import { tombstones } from './tombstones';

class Plan {
  list = $state.raw<PlanEntry[]>([]);

  async init(): Promise<void> {
    try {
      this.list = (await db.plan.toArray()).map(normaliseEntry).filter((e): e is PlanEntry => e !== null);
    } catch (err) {
      console.error('Opening the planner failed:', err);
    }
  }

  async add(recipeId: string, date: string, servings: number | null): Promise<PlanEntry> {
    const entry: PlanEntry = { id: newId(), date, recipeId, servings, listed: false };
    await db.plan.put(entry);
    this.list = [...this.list, entry];
    return entry;
  }

  /** Removes entries and returns what puts them back. */
  async remove(ids: string[]): Promise<() => Promise<void>> {
    const gone = this.list.filter((e) => ids.includes(e.id));
    await db.plan.bulkDelete(gone.map((e) => e.id));
    await tombstones.add(gone.map((e) => e.id));
    this.list = this.list.filter((e) => !ids.includes(e.id));
    return async () => {
      await tombstones.drop(gone.map((e) => e.id));
      await db.plan.bulkPut(gone);
      const known = new Set(this.list.map((e) => e.id));
      this.list = [...this.list, ...gone.filter((e) => !known.has(e.id))];
    };
  }

  async move(id: string, date: string): Promise<void> {
    await this.patch([id], (e) => ({ ...e, date }));
  }

  async setServings(id: string, servings: number | null): Promise<void> {
    await this.patch([id], (e) => ({ ...e, servings }));
  }

  async markListed(ids: string[]): Promise<void> {
    await this.patch(ids, (e) => ({ ...e, listed: true }));
  }

  /** Drops entries for a recipe that was deleted. */
  async forgetRecipe(recipeId: string): Promise<void> {
    const ids = this.list.filter((e) => e.recipeId === recipeId).map((e) => e.id);
    if (ids.length) await this.remove(ids);
  }

  /** Merges entries from a backup or a synced copy: ones not here (or deleted here) are added; ones it deleted go. */
  async merge(entries: PlanEntry[], deleted: { id: string }[] = []): Promise<number> {
    const gone = new Set(deleted.map((d) => d.id));
    const known = new Set(this.list.map((e) => e.id));
    const fresh = entries.filter((e) => !known.has(e.id) && !gone.has(e.id) && !tombstones.at(e.id));
    const removed = this.list.filter((e) => gone.has(e.id)).map((e) => e.id);
    if (fresh.length) await db.plan.bulkPut(fresh);
    if (removed.length) await db.plan.bulkDelete(removed);
    this.list = [...this.list.filter((e) => !gone.has(e.id)), ...fresh];
    return fresh.length;
  }

  private async patch(ids: string[], change: (e: PlanEntry) => PlanEntry): Promise<void> {
    const next = this.list.map((e) => (ids.includes(e.id) ? change(e) : e));
    await db.plan.bulkPut(next.filter((e) => ids.includes(e.id)));
    this.list = next;
  }
}

export const plan = new Plan();
