// ============================================================
// Backups: a .zip holding mise.json (every recipe and collection,
// and since version 2 the grocery list, the planner, the pantry
// staples and aisles, settings and what was deleted) and
// photos/<id>.jpg. Import also takes the bare JSON.
// ============================================================

import { strFromU8, strToU8, unzip, zip, type AsyncZippable, type Unzipped } from 'fflate';
import type { Photo, Tombstone } from '../data/db';
import { normaliseItem, type GroceryItem } from '../domain/groceries';
import { normaliseEntry, type PlanEntry } from '../domain/plan';
import { normaliseRecipe, type Collection, type Recipe } from '../domain/recipe';
import type { Settings } from '../domain/settings';

export const BACKUP_VERSION = 2;

/** Everything in a backup besides recipes, collections and photos (version 2). Older backups have none of it. */
export interface BackupExtras {
  groceries?: GroceryItem[];
  plan?: PlanEntry[];
  /** Preferences, staples and aisle moves; lastBackupAt is never carried. */
  settings?: Partial<Settings>;
  /** Grocery items typed before, for suggestions. */
  history?: string[];
  /** What was deleted, so a merge doesn't bring it back. */
  deleted?: Tombstone[];
}

export interface BackupData extends BackupExtras {
  recipes: Recipe[];
  collections: Collection[];
  photos: Map<string, Photo>;
}

export function buildJson(recipes: Recipe[], collections: Collection[], now = new Date(), extras: BackupExtras = {}): string {
  const out: Record<string, unknown> = { app: 'mise', version: BACKUP_VERSION, exportedAt: now.toISOString(), recipes, collections, ...extras };
  if (extras.settings) {
    const settings = { ...extras.settings };
    // Per-device: when this phone last backed up or synced, and the folder it syncs through.
    delete settings.lastBackupAt;
    delete settings.lastSyncAt;
    delete settings.syncFolder;
    out.settings = settings;
  }
  return JSON.stringify(out, null, 2);
}

export async function buildBackupZip(recipes: Recipe[], collections: Collection[], photos: Photo[], now = new Date(), extras: BackupExtras = {}): Promise<Uint8Array> {
  const files: AsyncZippable = { 'mise.json': strToU8(buildJson(recipes, collections, now, extras)) };
  for (const p of photos) {
    files[`photos/${p.id}.jpg`] = new Uint8Array(await p.full.arrayBuffer());
    files[`photos/${p.id}.thumb.jpg`] = new Uint8Array(await p.thumb.arrayBuffer());
  }
  // Photos are already compressed; storing them is faster and no bigger. The async zip works off
  // the main thread, so a large library doesn't freeze the screen.
  return new Promise((resolve, reject) => zip(files, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data))));
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function readExtras(d: Record<string, unknown>): BackupExtras {
  const extras: BackupExtras = {};
  if (Array.isArray(d.groceries)) extras.groceries = d.groceries.map(normaliseItem).filter((g): g is GroceryItem => g !== null);
  if (Array.isArray(d.plan)) extras.plan = d.plan.map(normaliseEntry).filter((e): e is PlanEntry => e !== null);
  if (d.settings && typeof d.settings === 'object') extras.settings = d.settings as Partial<Settings>;
  if (Array.isArray(d.history)) extras.history = strings(d.history).slice(0, 300);
  if (Array.isArray(d.deleted)) {
    extras.deleted = (d.deleted as Partial<Tombstone>[]).filter((x): x is Tombstone => !!x && typeof x.id === 'string' && typeof x.at === 'string' && !Number.isNaN(Date.parse(x.at)));
  }
  return extras;
}

function readJson(text: string): Omit<BackupData, 'photos'> {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Not a Mise backup');
  const d = data as { app?: unknown; recipes?: unknown; collections?: unknown } & Record<string, unknown>;
  if (d.app !== 'mise' || !Array.isArray(d.recipes)) throw new Error('Not a Mise backup');
  const collections = Array.isArray(d.collections)
    ? d.collections.filter((c): c is Collection => !!c && typeof c.id === 'string' && typeof c.name === 'string').map((c) => ({ id: c.id, name: c.name, createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString() }))
    : [];
  return { recipes: d.recipes.map(normaliseRecipe).filter((r): r is Recipe => r !== null), collections, ...readExtras(d) };
}

function unzipped(bytes: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => unzip(bytes, (err, files) => (err ? reject(err) : resolve(files))));
}

export async function parseBackup(bytes: Uint8Array): Promise<BackupData> {
  if (!isZip(bytes)) return { ...readJson(new TextDecoder().decode(bytes)), photos: new Map() };
  const files = await unzipped(bytes);
  const json = files['mise.json'];
  if (!json) throw new Error('Not a Mise backup');
  const data = readJson(strFromU8(json));
  const photos = new Map<string, Photo>();
  for (const r of data.recipes) {
    // Photos missing from the zip are dropped from the recipe rather than left dangling.
    r.photoIds = r.photoIds.filter((id) => {
      const full = files[`photos/${id}.jpg`];
      if (!full) return false;
      const thumb = files[`photos/${id}.thumb.jpg`] ?? full;
      photos.set(id, { id, full: new Blob([full as BlobPart], { type: 'image/jpeg' }), thumb: new Blob([thumb as BlobPart], { type: 'image/jpeg' }) });
      return true;
    });
    r.photoId = r.photoIds[0] ?? null;
  }
  return { ...data, photos };
}

export const BACKUP_PREFIX = 'mise-backup';
export const KEEP_BACKUPS = 5;
const WEEK_MS = 7 * 86_400_000;

export function isBackupDue(lastBackupAt: string | undefined, now = Date.now()): boolean {
  // An hour of slack so the weekly backup doesn't drift later each week.
  return !lastBackupAt || now - Date.parse(lastBackupAt) >= WEEK_MS - 3_600_000;
}

/** Backup file names to delete so only the newest `keep` remain. */
export function backupsToPrune(names: readonly string[], keep = KEEP_BACKUPS): string[] {
  return names
    .filter((n) => n.startsWith(`${BACKUP_PREFIX}-`) && n.endsWith('.zip'))
    .sort()
    .reverse()
    .slice(keep);
}
