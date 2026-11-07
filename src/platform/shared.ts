// ============================================================
// Things shared to Mise from other apps (ShareIntakePlugin.java):
// a link or some text, photos, or a recipe file. Each one opens the import sheet;
// nothing is saved until Save recipe.
// ============================================================

import { registerPlugin } from '@capacitor/core';
import { findUrl, isOnlyUrl } from '../import/web';
import { base64ToBytes } from '../lib/base64';
import { isNative } from './output';

export interface RawShare {
  text?: string;
  subject?: string;
  images?: string[];
  /** A recipe file sent or opened with Mise, its bytes in base64. */
  file?: { name: string; data: string };
}

interface ShareIntakePlugin {
  getPending(): Promise<{ share?: RawShare }>;
  addListener(event: 'shared', listener: (share: RawShare) => void): Promise<{ remove: () => Promise<void> }>;
}

const ShareIntake = registerPlugin<ShareIntakePlugin>('ShareIntake');

/** `ask`: the link came from another app's mise:// link, so it is shown before Mise fetches it. */
export type Incoming = { kind: 'link'; url: string; ask?: boolean } | { kind: 'text'; text: string } | { kind: 'photos'; photos: Blob[] };

/** A recipe file in a share, for src/state/transfer.svelte.ts to read. */
export function sharedFile(share: RawShare): { name: string; bytes: Uint8Array } | null {
  return share.file?.data ? { name: share.file.name ?? '', bytes: base64ToBytes(share.file.data) } : null;
}

/** What a share holds, as an import. Photos win over text: the text is usually just a caption for them. */
export function readShare(share: RawShare): Incoming | null {
  const photos = (share.images ?? []).map((b64) => new Blob([base64ToBytes(b64) as BlobPart], { type: 'image/jpeg' }));
  if (photos.length) return { kind: 'photos', photos };
  const text = (share.text ?? '').trim();
  if (!text) return null;
  // "Check this out https://…" is a link; a long caption with a link in it is text.
  const url = findUrl(text);
  if (url && (isOnlyUrl(text) || text.length < 200)) return { kind: 'link', url };
  // The subject is often the post or page title: it becomes the first line, which the parser reads as the title.
  const subject = (share.subject ?? '').trim();
  return { kind: 'text', text: subject && subject.length <= 120 && !text.includes(subject) ? `${subject}\n${text}` : text };
}

export async function listenForShares(onShare: (share: RawShare) => void): Promise<void> {
  if (!isNative) return;
  await ShareIntake.addListener('shared', onShare);
  const { share } = await ShareIntake.getPending().catch(() => ({ share: undefined }));
  if (share) onShare(share);
}
