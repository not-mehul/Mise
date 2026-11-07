/* eslint-disable svelte/prefer-svelte-reactivity -- plain locals here, nothing reads them reactively */
// ============================================================
// Export, import and backups, wired to app state.
// ============================================================

import type { Photo } from '../data/db';
import { t } from '../i18n/index.svelte';
import { BACKUP_PREFIX, backupsToPrune, isBackupDue, type BackupData, type BackupExtras } from '../lib/backup';
import { recipeToMarkdown, type MarkdownLabels } from '../lib/markdown';
import type { Recipe } from '../domain/recipe';
import { datedName, deleteOutput, isNative, listOutputs, saveFile, shareFile, type OutputFile } from '../platform/output';
import { DEFAULT_SETTINGS, normaliseSettings } from '../domain/settings';
import { recipeToDraft } from '../domain/recipe';
import { groceries } from './groceries.svelte';
import { attachPhoto } from './importer';
import { library, type MergeSummary } from './library.svelte';
import { plan } from './plan.svelte';
import { tombstones } from './tombstones';
import { ui } from './ui.svelte';
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

/** Everything besides recipes that a full backup carries. */
function extras(): BackupExtras {
  return {
    groceries: groceries.list,
    plan: plan.list,
    settings: settings.current,
    history: groceries.history,
    deleted: tombstones.list(),
  };
}

/** A full backup as zip bytes: recipes, photos, groceries, the plan, settings and deletions. */
export async function backupBytes(now = new Date()): Promise<Uint8Array> {
  const { buildBackupZip } = await backupLib();
  const ids = [...new Set(library.recipes.flatMap((r) => r.photoIds))];
  const photos = (await Promise.all(ids.map((id) => library.photo(id)))).filter((p): p is Photo => !!p);
  return buildBackupZip(library.recipes, library.collections, photos, now, $state.snapshot(extras()) as BackupExtras);
}

async function backupFile(now = new Date()): Promise<OutputFile> {
  return { name: datedName(BACKUP_PREFIX, 'zip', now, true), data: await backupBytes(now), mime: 'application/zip' };
}

/**
 * Merges a backup or a synced copy into everything: recipes (newest wins), the grocery
 * list, the plan, staples and aisle moves (ours win), and deletions on both sides.
 * Preferences (theme, language, cooking switches) come along only into an empty Mise,
 * a new phone being set up, so restoring never flips the look of one in use.
 */
export async function mergeBackup(data: BackupData): Promise<MergeSummary> {
  const fresh = !library.recipes.length;
  const summary = await library.merge(data.recipes, data.collections, data.photos, data.deleted ?? []);
  await groceries.merge(data.groceries ?? [], data.deleted ?? [], data.history ?? []);
  await plan.merge(data.plan ?? [], data.deleted ?? []);
  const theirs = data.settings ? normaliseSettings({ ...DEFAULT_SETTINGS, ...data.settings }) : null;
  if (theirs) {
    const mine = settings.current;
    settings.update({
      ...(fresh ? { theme: theirs.theme, language: theirs.language, readAloud: theirs.readAloud, volumeKeys: theirs.volumeKeys, listAwake: theirs.listAwake, handsFree: theirs.handsFree } : {}),
      staples: [...new Set([...mine.staples, ...theirs.staples])],
      aisles: { ...theirs.aisles, ...mine.aisles },
    });
  }
  return summary;
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

/**
 * Imports a file: a Mise backup is merged; recipes from elsewhere (Paprika, schema.org
 * JSON, a recipe shared from another Mise) open for checking when there is one, and
 * are saved straight away when there are several.
 */
export async function importBytes(bytes: Uint8Array, name = ''): Promise<{ message: string; ok: boolean }> {
  try {
    const { readRecipeFile } = await import('../import/files');
    const file = await readRecipeFile(bytes, name);
    if (file.kind === 'mise') {
      const { data } = file;
      if (!data.recipes.length && !data.groceries?.length && !data.plan?.length) return { message: t('data.importNone'), ok: false };
      if (data.recipes.length === 1 && !data.groceries && !library.get(data.recipes[0]!.id)) {
        // A single shared recipe: check it like an import, keeping its photos.
        const recipe = data.recipes[0]!;
        const photoIds: string[] = [];
        for (const id of recipe.photoIds) {
          const photo = data.photos.get(id);
          if (photo) photoIds.push(await library.addPhoto(photo.full, photo.thumb));
        }
        ui.edit({ ...recipeToDraft(recipe), id: null, photoIds }, 'check');
        return { message: t('data.openedRecipe', { title: recipe.title }), ok: true };
      }
      const s = await mergeBackup(data);
      return { message: t('data.imported', { added: s.added, updated: s.updated }), ok: true };
    }
    if (file.recipes.length === 1) {
      const { draft, photo } = file.recipes[0]!;
      await attachPhoto(draft, photo);
      ui.edit(draft, 'check');
      return { message: t('data.openedRecipe', { title: draft.title }), ok: true };
    }
    let added = 0;
    for (const { draft, photo } of file.recipes) {
      if (!draft.title.trim() || (!draft.ingredients.trim() && !draft.steps.trim())) continue;
      await attachPhoto(draft, photo);
      await library.save(draft);
      added++;
    }
    return added ? { message: t('data.imported', { added, updated: 0 }), ok: true } : { message: t('data.importNone'), ok: false };
  } catch (err) {
    console.error('Import failed:', err);
    return { message: t('data.importFailed'), ok: false };
  }
}

export async function importFile(file: File): Promise<{ message: string; ok: boolean }> {
  return importBytes(new Uint8Array(await file.arrayBuffer()), file.name);
}

/** One recipe as a small Mise file (.zip with its photos), through the share sheet; another Mise opens it. */
export async function shareRecipeFile(recipe: Recipe): Promise<void> {
  const { buildBackupZip } = await backupLib();
  const photos = (await Promise.all(recipe.photoIds.map((id) => library.photo(id)))).filter((p): p is Photo => !!p);
  const slug = recipe.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'recipe';
  const data = await buildBackupZip([$state.snapshot(recipe) as Recipe], [], photos);
  await shareFile({ name: `${slug}.mise.zip`, data, mime: 'application/zip' }, recipe.title);
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
