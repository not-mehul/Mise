// ============================================================
// Mise — app entry point: applies preferences and mounts the UI.
// ============================================================

import { App as CapacitorApp } from '@capacitor/app';
import { mount } from 'svelte';
import App from './App.svelte';
import { detectLocale, setLocale } from './i18n/index.svelte';
import { listenForLinks } from './platform/incoming';
import { isNative } from './platform/output';
import { applyTheme } from './platform/theme.svelte';
import { library } from './state/library.svelte';
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
  await library.init();

  if (isNative) {
    // Android back: close the topmost overlay, then return to Recipes, then exit (style.md §14).
    void CapacitorApp.addListener('backButton', () => {
      if (!ui.back()) void CapacitorApp.exitApp();
    });
    void CapacitorApp.addListener('resume', () => void autoBackupIfDue());
    // mise:// links from the other apps (style.md §14.1).
    void listenForLinks((link) => ui.openLink(link));
  }
  void autoBackupIfDue();
}

void start();
