// ============================================================
// Runs an import: a link or photos → a draft for the review screen.
// A picture found on the page, or the first photo, comes along as the
// recipe's photo; the editor drops it again if the recipe isn't saved.
// ============================================================

import { CapacitorHttp } from '@capacitor/core';
import type { Recipe, RecipeDraft } from '../domain/recipe';
import { photosToText } from '../import/photo';
import { parseRecipeText } from '../import/text';
import { importLink, normaliseUrl, type LinkResult } from '../import/web';
import { base64ToBytes } from '../lib/base64';
import { processPhoto } from '../platform/images';
import { recognise } from '../platform/ocr';
import { isNative } from '../platform/output';
import { library } from './library.svelte';

/** A recipe already saved from this link, if there is one. */
export function savedFrom(url: string): Recipe | undefined {
  const key = normaliseUrl(url);
  return library.recipes.find((r) => r.source.url && normaliseUrl(r.source.url) === key);
}

async function download(url: string): Promise<Blob | null> {
  try {
    if (isNative) {
      const res = await CapacitorHttp.get({ url, responseType: 'blob', connectTimeout: 15000, readTimeout: 15000 });
      if (res.status < 200 || res.status >= 300 || typeof res.data !== 'string') return null;
      return new Blob([base64ToBytes(res.data) as BlobPart]);
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

async function attachPhoto(draft: RecipeDraft, file: Blob | null): Promise<void> {
  if (!file) return;
  try {
    const { full, thumb } = await processPhoto(file);
    draft.photoId = await library.addPhoto(full, thumb);
  } catch (err) {
    // The recipe still imports, without a picture.
    console.warn('Keeping the imported picture failed:', err);
  }
}

export async function fromLink(url: string): Promise<LinkResult> {
  const result = await importLink(url);
  if (result.ok && result.imageUrl) await attachPhoto(result.draft, await download(result.imageUrl));
  return result;
}

export type PhotoResult = { ok: true; draft: RecipeDraft } | { ok: false; reason: 'nothing' | 'failed' };

/** Several photos read as one recipe, in the order they were picked. */
export async function fromPhotos(photos: Blob[]): Promise<PhotoResult> {
  const pages = [];
  try {
    for (const photo of photos) pages.push(await recognise(photo));
  } catch (err) {
    console.warn('Reading the photos failed:', err);
    return { ok: false, reason: 'failed' };
  }
  const text = photosToText(pages);
  if (!text.trim()) return { ok: false, reason: 'nothing' };
  const { draft } = parseRecipeText(text, 'photo');
  await attachPhoto(draft, photos[0] ?? null);
  return { ok: true, draft };
}
