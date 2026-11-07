// ============================================================
// Export, import and backups, wired to app state.
// ============================================================

import type { Photo } from '../data/db';
import { t } from '../i18n/index.svelte';
import { BACKUP_PREFIX, backupsToPrune, isBackupDue } from '../lib/backup';
import { recipeToMarkdown, type MarkdownLabels } from '../lib/markdown';
import type { Recipe } from '../domain/recipe';
import { datedName, deleteOutput, isNative, listOutputs, saveFile, type OutputFile } from '../platform/output';
import { library } from './library.svelte';
import { settings } from './settings.svelte';

export const BACKUP_FOLDER = 'Mise/Backups';

/** fflate is only needed for backups, so it loads on demand. */
const backupLib = () => import('../lib/backup');

export function markdownLabels(): MarkdownLabels {
  return {
    ingredients: t('recipe.ingredients'),
    method: t('recipe.method'),
    notes: t('recipe.notes'),
    serves: (n) => t('recipe.serves', { count: n }),
    minutes: (n) => t('recipe.minutes', { count: n }),
    source: t('recipe.source'),
  };
}

export function recipeMarkdown(r: Recipe): string {
  return recipeToMarkdown(r, markdownLabels());
}

async function backupFile(now = new Date()): Promise<OutputFile> {
  const { buildBackupZip } = await backupLib();
  const photos = (await Promise.all(library.recipes.filter((r) => r.photoId).map((r) => library.photo(r.photoId!)))).filter((p): p is Photo => !!p);
  return {
    name: datedName(BACKUP_PREFIX, 'zip', now, true),
    data: await buildBackupZip(library.recipes, library.collections, photos, now),
    mime: 'application/zip',
  };
}

export type ExportFormat = 'markdown' | 'backup';

/** Returns a toast message. */
export async function exportAs(format: ExportFormat): Promise<{ message: string; ok: boolean }> {
  if (!library.recipes.length) return { message: t('data.nothing'), ok: false };
  try {
    const file: OutputFile =
      format === 'markdown'
        ? { name: datedName('mise', 'md'), data: library.recipes.map(recipeMarkdown).join('\n---\n\n'), mime: 'text/markdown' }
        : await backupFile();
    const { savedTo } = await saveFile(file);
    if (format === 'backup') settings.update({ lastBackupAt: new Date().toISOString() });
    return { message: savedTo ? t('data.saved', { path: savedTo }) : t('data.ready'), ok: true };
  } catch (err) {
    console.error('Export failed:', err);
    return { message: t('data.exportFailed'), ok: false };
  }
}

export async function importFile(file: File): Promise<{ message: string; ok: boolean }> {
  try {
    const { parseBackup } = await backupLib();
    const data = await parseBackup(new Uint8Array(await file.arrayBuffer()));
    if (!data.recipes.length) return { message: t('data.importNone'), ok: false };
    const s = await library.merge(data.recipes, data.collections, data.photos);
    return { message: t('data.imported', { added: s.added, updated: s.updated }), ok: true };
  } catch (err) {
    console.error('Import failed:', err);
    return { message: t('data.importFailed'), ok: false };
  }
}

/** Writes a backup to Documents/Mise/Backups and keeps the newest five. */
export async function backupNow(): Promise<string> {
  const now = new Date();
  const { savedTo } = await saveFile(await backupFile(now), { folder: BACKUP_FOLDER, share: false });
  settings.update({ lastBackupAt: now.toISOString() });
  for (const name of backupsToPrune(await listOutputs(BACKUP_FOLDER))) {
    await deleteOutput(BACKUP_FOLDER, name).catch(() => undefined);
  }
  return savedTo ?? `Documents/${BACKUP_FOLDER}`;
}

let running = false;

/** Called on launch and when the app returns to the foreground: a backup a week, on the phone. */
export async function autoBackupIfDue(): Promise<void> {
  if (!isNative || running || library.status !== 'ready' || !library.recipes.length) return;
  if (!isBackupDue(settings.current.lastBackupAt)) return;
  running = true;
  try {
    await backupNow();
  } catch (err) {
    console.warn('Automatic backup failed:', err);
  } finally {
    running = false;
  }
}
