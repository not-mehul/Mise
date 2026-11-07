// ============================================================
// Sync through a folder: Mise keeps one full backup file in a folder the
// person picks, and a sync app (Syncthing, Drive, Nextcloud) keeps that
// folder the same across phones. On launch and on return Mise merges the
// file in (the newest copy of each recipe wins, and deletions stay
// deleted), then writes everything back; it writes again when it is left.
// ============================================================

import { base64ToBytes, bytesToBase64 } from '../lib/base64';
import { FolderSync, type SyncFolderIO } from '../platform/folder';
import { settings } from './settings.svelte';
import { backupBytes, mergeBackup } from './transfer.svelte';

export const SYNC_FILE = 'mise-sync.zip';

export type SyncResult = 'off' | 'synced' | 'failed';

class SyncState {
  busy = $state(false);
  /** When the file last changed, as this phone last saw it: unchanged files aren't read again. */
  private seen: number | undefined;
  private running: Promise<SyncResult> | null = null;

  constructor(private io: SyncFolderIO = FolderSync) {}

  get on(): boolean {
    return !!settings.current.syncFolder;
  }

  /** Reads and merges the folder's copy, then writes this one back. One sync at a time. */
  now(): Promise<SyncResult> {
    this.running ??= this.run(true).finally(() => (this.running = null));
    return this.running;
  }

  /** Writes this phone's copy, when Mise is left. */
  push(): Promise<SyncResult> {
    return this.running ?? this.run(false);
  }

  private async run(read: boolean): Promise<SyncResult> {
    const folder = settings.current.syncFolder;
    if (!folder) return 'off';
    this.busy = true;
    try {
      if (read) {
        const theirs = await this.io.read({ uri: folder.uri, file: SYNC_FILE, since: this.seen });
        if (theirs.data) {
          const { parseBackup } = await import('../lib/backup');
          await mergeBackup(await parseBackup(base64ToBytes(theirs.data)));
        }
      }
      const { modified } = await this.io.write({ uri: folder.uri, file: SYNC_FILE, data: bytesToBase64(await backupBytes()) });
      this.seen = modified || undefined;
      settings.update({ lastSyncAt: new Date().toISOString() });
      return 'synced';
    } catch (err) {
      console.error('Sync failed:', err);
      return 'failed';
    } finally {
      this.busy = false;
    }
  }

  /** Opens the folder picker; syncs straight away into the folder chosen. */
  async choose(): Promise<SyncResult> {
    const picked = await this.io.pick();
    if (!picked.uri) return 'off';
    const old = settings.current.syncFolder;
    if (old && old.uri !== picked.uri) await this.io.release({ uri: old.uri }).catch(() => undefined);
    this.seen = undefined;
    settings.update({ syncFolder: { uri: picked.uri, name: picked.name ?? '' } });
    return this.now();
  }

  /** Stops syncing. The file stays in the folder. */
  async stop(): Promise<void> {
    const old = settings.current.syncFolder;
    settings.update({ syncFolder: undefined, lastSyncAt: undefined });
    this.seen = undefined;
    if (old) await this.io.release({ uri: old.uri }).catch(() => undefined);
  }
}

export const sync = new SyncState();
/** For tests: a sync over a folder in memory. */
export const createSync = (io: SyncFolderIO) => new SyncState(io);
