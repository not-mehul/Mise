// ============================================================
// Writing user-visible files.
// Native: saves to Documents/<folder>/ (apps may create files there
// without storage permission on Android 11+; on iOS it's the app's
// Files folder) and optionally opens the share sheet. If the public
// write fails — e.g. a same-named file left by a previous install —
// the file goes to the cache and is shared from there.
// Web: triggers a download.
// ============================================================

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { bytesToBase64 } from '../lib/base64';

export interface OutputFile {
  name: string;
  data: string | Uint8Array;
  mime: string;
}

export interface OutputResult {
  /** Human-readable location, or null if the file only went to the share sheet. */
  savedTo: string | null;
}

export const isNative = Capacitor.isNativePlatform();

/** "mise-2026-10-30.md", or with `withTime` "mise-backup-2026-10-30-1435.zip" (sorts chronologically). */
export function datedName(prefix: string, ext: string, now = new Date(), withTime = false): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = withTime ? `-${pad(now.getHours())}${pad(now.getMinutes())}` : '';
  return `${prefix}-${date}${time}.${ext}`;
}

function download(file: OutputFile): void {
  const blob = new Blob([file.data as BlobPart], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function payload(file: OutputFile) {
  return typeof file.data === 'string'
    ? { data: file.data, encoding: Encoding.UTF8 }
    : { data: bytesToBase64(file.data) };
}

export async function saveFile(
  file: OutputFile,
  { folder = 'Mise', share = true }: { folder?: string; share?: boolean } = {},
): Promise<OutputResult> {
  if (!isNative) {
    download(file);
    return { savedTo: `Downloads/${file.name}` };
  }

  let uri: string;
  let savedTo: string | null;
  try {
    ({ uri } = await Filesystem.writeFile({
      path: `${folder}/${file.name}`,
      directory: Directory.Documents,
      recursive: true,
      ...payload(file),
    }));
    savedTo = `Documents/${folder}/${file.name}`;
  } catch (err) {
    if (!share) throw err;
    console.warn('Could not write to Documents, sharing from cache instead:', err);
    ({ uri } = await Filesystem.writeFile({ path: file.name, directory: Directory.Cache, ...payload(file) }));
    savedTo = null;
  }

  if (share) {
    try {
      await Share.share({ title: file.name, files: [uri] });
    } catch {
      // The user dismissed the share sheet — not an error.
    }
  }
  return { savedTo };
}

/** Shares a generated file without keeping a copy. */
export async function shareFile(file: OutputFile, title: string): Promise<void> {
  if (!isNative) {
    download(file);
    return;
  }
  const { uri } = await Filesystem.writeFile({ path: file.name, directory: Directory.Cache, ...payload(file) });
  try {
    await Share.share({ title, files: [uri] });
  } catch {
    // Dismissed.
  }
}

/** Lists files in Documents/<folder>/ that this app created. */
export async function listOutputs(folder: string): Promise<string[]> {
  try {
    const { files } = await Filesystem.readdir({ path: folder, directory: Directory.Documents });
    return files.filter((f) => f.type === 'file').map((f) => f.name);
  } catch {
    return [];
  }
}

export async function deleteOutput(folder: string, name: string): Promise<void> {
  await Filesystem.deleteFile({ path: `${folder}/${name}`, directory: Directory.Documents });
}
