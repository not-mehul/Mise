<script lang="ts">
  import { TabRail, ThemeToggle, Toast } from 'dusk-dawn';
  import GroceriesView from './components/GroceriesView.svelte';
  import RecipesView from './components/RecipesView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import { detectLocale, locale, setLocale, t, type MessageKey } from './i18n/index.svelte';
  import { applyTheme, shown, toggledTheme } from './platform/theme.svelte';
  import { library } from './state/library.svelte';
import { settings } from './state/settings.svelte';
  import { ui, type Tab } from './state/ui.svelte';

  const TABS: { id: Tab; dom: string; panel: string; key: MessageKey }[] = [
    { id: 'recipes', dom: 'tabRecipes', panel: 'viewRecipes', key: 'tabs.recipes' },
    { id: 'groceries', dom: 'tabGroceries', panel: 'viewGroceries', key: 'tabs.groceries' },
    { id: 'settings', dom: 'tabSettings', panel: 'viewSettings', key: 'tabs.settings' },
  ];
  const tabs = $derived(
    TABS.map((tab) => ({
      id: tab.id,
      domId: tab.dom,
      controls: tab.panel,
      label: t(tab.key),
      badge: tab.id === 'recipes' && library.recipes.length ? library.recipes.length : undefined,
    })),
  );
  const today = $derived(new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }));

  $effect(() => applyTheme(settings.current.theme));
  $effect(() => {
    const lang = settings.current.language;
    const next = lang === 'system' ? detectLocale() : lang;
    if (next !== locale()) void setLocale(next);
  });
</script>

<div class="glow-layer" aria-hidden="true">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="glow glow-3"></div>
</div>

<div class="container">
  <header class="site-header">
    <div class="site-title">
      <p class="eyebrow">{today}</p>
      <h1 class="t-page-title"><em>Mise</em></h1>
      <p class="t-tagline">{t('app.tagline')}</p>
    </div>
    <ThemeToggle dawn={!shown.dark} label={t('settings.dawnSwitch')} ontoggle={() => settings.update({ theme: toggledTheme() })} />
  </header>

  <nav class="app-tabs">
    <TabRail {tabs} value={ui.tab} label={t('tabs.sections')} onselect={(id) => (id === 'recipes' && ui.tab === 'recipes' ? ui.show({ kind: 'list' }) : ui.go(id))} />
  </nav>

  <main>
    {#if ui.tab === 'recipes'}
      <RecipesView />
    {:else if ui.tab === 'groceries'}
      <GroceriesView />
    {:else}
      <SettingsView />
    {/if}
  </main>
</div>

<Toast toast={ui.toast} onpause={() => ui.pauseToast()} onresume={() => ui.resumeToast()} onaction={() => ui.actOnToast()} />
