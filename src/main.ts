// ============================================================
// Mise — app entry point: applies preferences and mounts the UI.
// ============================================================

import { App as CapacitorApp } from '@capacitor/app';
import { mount } from 'svelte';
import App from './App.svelte';
import { detectLocale, setLocale } from './i18n/index.svelte';
import { listenForLinks } from './platform/incoming';
import { listenForShortcuts } from './platform/launcher';
import { listenForAlarms } from './platform/notify';
import { isNative } from './platform/output';
import { listenForShares, readShare, sharedFile } from './platform/shared';
import { applyTheme } from './platform/theme.svelte';
import { groceries } from './state/groceries.svelte';
import { library } from './state/library.svelte';
import { plan } from './state/plan.svelte';
import { tombstones } from './state/tombstones';
import { settings } from './state/settings.svelte';
import { sync } from './state/sync.svelte';
import { timers } from './state/timers.svelte';
import { autoBackupIfDue, importBytes } from './state/transfer.svelte';
import { ui } from './state/ui.svelte';
import { keepWidgetCurrent } from './state/widget.svelte';
import './styles/app.css';

async function start(): Promise<void> {
  // Apply preferences before the first paint; App.svelte keeps them in sync afterwards.
  const { theme, language } = settings.current;
  applyTheme(theme);
  await setLocale(language === 'system' ? detectLocale() : language).catch(() => undefined);

  mount(App, { target: document.getElementById('app')! });
  await tombstones.init();
  await Promise.all([library.init(), groceries.init(), plan.init()]);

  if (isNative) {
    // Android back: close the topmost overlay, then return to Recipes, then exit (style.md §14).
    void CapacitorApp.addListener('backButton', () => {
      if (!ui.back()) void CapacitorApp.exitApp();
    });
    void CapacitorApp.addListener('resume', () => {
      void autoBackupIfDue();
      void sync.now();
    });
    // Leaving Mise writes the sync folder's copy, so another phone sees the change.
    void CapacitorApp.addListener('pause', () => void sync.push());
    void sync.now();
    // The icon's shortcuts and the grocery widget.
    void listenForShortcuts((screen) => {
      if (screen === 'groceries') ui.go('groceries');
      else ui.newRecipe();
    });
    keepWidgetCurrent();
    // A timer's alarm opened from the notification: back to its step.
    void listenForAlarms((alarm) => timers.opened(alarm));
    void timers.rearm();
    // mise:// links from the other apps (style.md §14.1).
    void listenForLinks((link) => ui.openLink(link));
    // "Share to Mise" from other apps: a link, a caption or photos.
    void listenForShares((share) => {
      const file = sharedFile(share);
      if (file) {
        void importBytes(file.bytes, file.name, true).then((r) => r && ui.notify(r.message, r.ok ? 'success' : 'error'));
        return;
      }
      const incoming = readShare(share);
      if (incoming) ui.importFrom(incoming);
    });
  }
  void autoBackupIfDue();
}

void start();
