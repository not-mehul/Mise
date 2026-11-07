// ============================================================
// What was deleted, and when: recipes, grocery items and plan
// entries. A backup or a synced copy carries these, so merging
// it never brings back something you deleted on purpose.
// ============================================================

import { db, type Tombstone } from '../data/db';

const KEEP_MS = 180 * 86_400_000;

class Tombstones {
  private byId = new Map<string, string>();

  async init(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - KEEP_MS).toISOString();
      const all = await db.deleted.toArray();
      // Half a year is longer than any copy is left unsynced; older ones are let go.
      const old = all.filter((t) => t.at < cutoff).map((t) => t.id);
      if (old.length) await db.deleted.bulkDelete(old);
      this.byId = new Map(all.filter((t) => t.at >= cutoff).map((t) => [t.id, t.at]));
    } catch (err) {
      console.error('Reading deletions failed:', err);
    }
  }

  /** When it was deleted (ISO), or undefined. */
  at(id: string): string | undefined {
    return this.byId.get(id);
  }

  list(): Tombstone[] {
    return [...this.byId].map(([id, at]) => ({ id, at }));
  }

  async add(ids: string[], now = new Date()): Promise<void> {
    if (!ids.length) return;
    const at = now.toISOString();
    await db.deleted.bulkPut(ids.map((id) => ({ id, at })));
    for (const id of ids) this.byId.set(id, at);
  }

  /** Undo: it isn't deleted after all. */
  async drop(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await db.deleted.bulkDelete(ids);
    for (const id of ids) this.byId.delete(id);
  }

  /** Takes in deletions from a backup or a synced copy; the later time wins. */
  async merge(stones: Tombstone[]): Promise<void> {
    const fresh = stones.filter((t) => (this.byId.get(t.id) ?? '') < t.at);
    if (!fresh.length) return;
    await db.deleted.bulkPut(fresh);
    for (const t of fresh) this.byId.set(t.id, t.at);
  }
}

export const tombstones = new Tombstones();
