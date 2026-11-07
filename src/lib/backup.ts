// ============================================================
// Backups: a .zip holding mise.json (every recipe and collection)
// and photos/<id>.jpg. Import also takes the bare JSON.
// ============================================================

import { strFromU8, strToU8, unzip, zip, type AsyncZippable, type Unzipped } from 'fflate';
import type { Photo } from '../data/db';
import { normaliseRecipe, type Collection, type Recipe } from '../domain/recipe';

export const BACKUP_VERSION = 1;

export interface BackupData {
  recipes: Recipe[];
  collections: Collection[];
  photos: Map<string, Photo>;
}

export function buildJson(recipes: Recipe[], collections: Collection[], now = new Date()): string {
  return JSON.stringify({ app: 'mise', version: BACKUP_VERSION, exportedAt: now.toISOString(), recipes, collections }, null, 2);
}

export async function buildBackupZip(recipes: Recipe[], collections: Collection[], photos: Photo[], now = new Date()): Promise<Uint8Array> {
  const files: AsyncZippable = { 'mise.json': strToU8(buildJson(recipes, collections, now)) };
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

function readJson(text: string): Omit<BackupData, 'photos'> {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Not a Mise backup');
  const d = data as { app?: unknown; recipes?: unknown; collections?: unknown };
  if (d.app !== 'mise' || !Array.isArray(d.recipes)) throw new Error('Not a Mise backup');
  const collections = Array.isArray(d.collections)
    ? d.collections.filter((c): c is Collection => !!c && typeof c.id === 'string' && typeof c.name === 'string').map((c) => ({ id: c.id, name: c.name, createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString() }))
    : [];
  return { recipes: d.recipes.map(normaliseRecipe).filter((r): r is Recipe => r !== null), collections };
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
    if (!r.photoId) continue;
    const full = files[`photos/${r.photoId}.jpg`];
    if (!full) {
      r.photoId = null;
      continue;
    }
    const thumb = files[`photos/${r.photoId}.thumb.jpg`] ?? full;
    photos.set(r.photoId, {
      id: r.photoId,
      full: new Blob([full as BlobPart], { type: 'image/jpeg' }),
      thumb: new Blob([thumb as BlobPart], { type: 'image/jpeg' }),
    });
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
