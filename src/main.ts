// ============================================================
// Mise — app entry point: applies preferences and mounts the UI.
// ============================================================

import { App as CapacitorApp } from '@capacitor/app';
import { mount } from 'svelte';
import App from './App.svelte';
import { detectLocale, setLocale } from './i18n/index.svelte';
import { listenForLinks } from './platform/incoming';
import { isNative } from './platform/output';
import { listenForShares, readShare } from './platform/shared';
import { applyTheme } from './platform/theme.svelte';
import { groceries } from './state/groceries.svelte';
import { library } from './state/library.svelte';
import { plan } from './state/plan.svelte';
import { settings } from './state/settings.svelte';
import { autoBackupIfDue } from './state/transfer';
import { ui } from './state/ui.svelte';
import './styles/app.css';

async function start(): Promise<void> {
  // Apply preferences before the first paint; App.svelte keeps them in sync afterwards.
  const { theme, language } = settings.current;
  applyTheme(theme);
  await setLocale(language === 'system' ? detectLocale() : language).catch(() => undefined);

  mount(App, { target: document.getElementById('app')! });
  await Promise.all([library.init(), groceries.init(), plan.init()]);

  if (isNative) {
    // Android back: close the topmost overlay, then return to Recipes, then exit (style.md §14).
    void CapacitorApp.addListener('backButton', () => {
      if (!ui.back()) void CapacitorApp.exitApp();
    });
    void CapacitorApp.addListener('resume', () => void autoBackupIfDue());
    // mise:// links from the other apps (style.md §14.1).
    void listenForLinks((link) => ui.openLink(link));
    // "Share to Mise" from other apps: a link, a caption or photos.
    void listenForShares((share) => {
      const incoming = readShare(share);
      if (incoming) ui.importFrom(incoming);
    });
  }
  void autoBackupIfDue();
}

void start();
