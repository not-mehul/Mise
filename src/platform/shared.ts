// ============================================================
// Things shared to Mise from other apps (ShareIntakePlugin.java):
// a link or some text, or photos. Each one opens the import sheet;
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
}

interface ShareIntakePlugin {
  getPending(): Promise<{ share?: RawShare }>;
  addListener(event: 'shared', listener: (share: RawShare) => void): Promise<{ remove: () => Promise<void> }>;
}

const ShareIntake = registerPlugin<ShareIntakePlugin>('ShareIntake');

export type Incoming = { kind: 'link'; url: string } | { kind: 'text'; text: string } | { kind: 'photos'; photos: Blob[] };

/** What a share holds, as an import. Photos win over text: the text is usually just a caption for them. */
export function readShare(share: RawShare): Incoming | null {
  const photos = (share.images ?? []).map((b64) => new Blob([base64ToBytes(b64) as BlobPart], { type: 'image/jpeg' }));
  if (photos.length) return { kind: 'photos', photos };
  const text = (share.text ?? '').trim();
  if (!text) return null;
  // "Check this out https://…" is a link; a long caption with a link in it is text.
  const url = findUrl(text);
  if (url && (isOnlyUrl(text) || text.length < 200)) return { kind: 'link', url };
  return { kind: 'text', text };
}

export async function listenForShares(onShare: (share: RawShare) => void): Promise<void> {
  if (!isNative) return;
  await ShareIntake.addListener('shared', onShare);
  const { share } = await ShareIntake.getPending().catch(() => ({ share: undefined }));
  if (share) onShare(share);
}
