// ============================================================
// The home screen's ways into Mise (LauncherPlugin.java): the icon's
// long-press shortcuts open a new recipe or the grocery list, and the
// grocery widget shows what is still to buy. Android only.
// ============================================================

import { registerPlugin } from '@capacitor/core';
import { isNative } from './output';

export type LauncherScreen = 'new' | 'groceries';

interface LauncherPlugin {
  getPending(): Promise<{ screen?: string }>;
  addListener(event: 'open', listener: (e: { screen: string }) => void): Promise<{ remove: () => Promise<void> }>;
  setGroceries(options: { items: string[] }): Promise<void>;
}

const Launcher = registerPlugin<LauncherPlugin>('Launcher');

const screen = (s: string | undefined): LauncherScreen | null => (s === 'new' || s === 'groceries' ? s : null);

/** Calls back when a shortcut or the widget opens Mise, including the one that started it. */
export async function listenForShortcuts(onOpen: (screen: LauncherScreen) => void): Promise<void> {
  if (!isNative) return;
  await Launcher.addListener('open', (e) => {
    const s = screen(e.screen);
    if (s) onOpen(s);
  });
  const pending = screen((await Launcher.getPending().catch(() => ({ screen: undefined }))).screen);
  if (pending) onOpen(pending);
}

/** The grocery widget's lines. */
export async function showOnWidget(items: string[]): Promise<void> {
  if (!isNative) return;
  await Launcher.setGroceries({ items }).catch(() => undefined);
}
