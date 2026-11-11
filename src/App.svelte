<script lang="ts">
  import { ThemeToggle, Toast, celebrate, konami, play, secretTaps } from 'dusk-dawn';
  import CookMode from './components/CookMode.svelte';
  import GroceriesView from './components/GroceriesView.svelte';
  import IdlePot from './components/IdlePot.svelte';
  import AppTabs from './components/ui/AppTabs.svelte';
  import IdleDock from './components/ui/IdleDock.svelte';
  import type { IconName } from './components/ui/Icon.svelte';
  import PlanView from './components/PlanView.svelte';
  import RecipesView from './components/RecipesView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import TimerTray from './components/TimerTray.svelte';
  import { KITCHEN, hatch } from './lib/delight';
  import { detectLocale, locale, setLocale, t, type MessageKey } from './i18n/index.svelte';
  import { applyTheme, shown, toggledTheme } from './platform/theme.svelte';
  import { groceries } from './state/groceries.svelte';
  import { library } from './state/library.svelte';
  import { settings } from './state/settings.svelte';
  import { ui, type Tab } from './state/ui.svelte';

  const TABS: { id: Tab; dom: string; panel: string; key: MessageKey; icon: IconName }[] = [
    { id: 'recipes', dom: 'tabRecipes', panel: 'viewRecipes', key: 'tabs.recipes', icon: 'recipes' },
    { id: 'plan', dom: 'tabPlan', panel: 'viewPlan', key: 'tabs.plan', icon: 'plan' },
    { id: 'groceries', dom: 'tabGroceries', panel: 'viewGroceries', key: 'tabs.groceries', icon: 'groceries' },
    { id: 'settings', dom: 'tabSettings', panel: 'viewSettings', key: 'tabs.settings', icon: 'settings' },
  ];
  const tabs = $derived(
    TABS.map((tab) => ({
      id: tab.id,
      domId: tab.dom,
      controls: tab.panel,
      label: t(tab.key),
      icon: tab.icon,
      badge: tab.id === 'recipes' ? library.recipes.length || undefined : tab.id === 'groceries' ? groceries.left || undefined : undefined,
    })),
  );
  const cooking = $derived(ui.tab === 'recipes' && ui.screen.kind === 'cook' ? ui.screen : null);
  const cookRecipe = $derived(cooking ? library.get(cooking.id) : undefined);
  // The full header (date, title, tagline) greets you on the recipe list; everywhere
  // else it shrinks to one line so the screen goes to what you opened.
  const compact = $derived(!(ui.tab === 'recipes' && ui.screen.kind === 'list'));
  // Ticks each minute, so the date in the header turns over at midnight with the app left open.
  let clock = $state(new Date());
  $effect(() => {
    const id = setInterval(() => {
      const now = new Date();
      if (now.getDate() !== clock.getDate()) clock = now;
    }, 60_000);
    return () => clearInterval(id);
  });
  const today = $derived(clock.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }));

  $effect(() => applyTheme(settings.current.theme));

  // Easter eggs (style.md §11.3). The Konami code bakes a batch of cookies;
  // tapping the title seven times puts everything in its place.
  let title = $state<HTMLElement>();
  $effect(() =>
    konami(() => {
      void celebrate({ ...KITCHEN, shapes: ['cookie-9', 'cookie-12', 'cookie-7'], count: 90, spread: 1.4 });
      hatch('konami', t('egg.konami'));
    }),
  );
  function miseEnPlace() {
    play(title, 'jelly');
    for (const [i, el] of [...document.querySelectorAll('.tab-rail [role="tab"]')].entries()) setTimeout(() => play(el, 'pop'), 60 * i);
    hatch('title', t('egg.title'));
  }
  $effect(() => {
    const lang = settings.current.language;
    const next = lang === 'system' ? detectLocale() : lang;
    if (next !== locale()) void setLocale(next);
  });
</script>

<!-- Edge to edge: a strip behind the status bar so text never scrolls under the clock. -->
<div class="status-scrim" aria-hidden="true"></div>

<div class="glow-layer" aria-hidden="true">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="glow glow-3"></div>
</div>

{#if cooking && cookRecipe}
  {#key cookRecipe.id}
    <CookMode recipe={cookRecipe} servings={cooking.servings} units={cooking.units} />
  {/key}
{:else}
  <div class="container">
    <header class="site-header" class:compact>
      <div class="site-title">
        {#if !compact}<p class="eyebrow">{today}</p>{/if}
        <h1 class="t-page-title" bind:this={title} use:secretTaps={{ count: 7, onunlock: miseEnPlace }}><em>Mise</em></h1>
      </div>
      <ThemeToggle dawn={!shown.dark} label={t('settings.dawnSwitch')} ontoggle={() => settings.update({ theme: toggledTheme() })} />
      {#if !compact}<p class="t-tagline">{t('app.tagline')}</p>{/if}
    </header>

    <nav class="app-tabs">
      <AppTabs {tabs} value={ui.tab} label={t('tabs.sections')} onselect={(id) => (id === 'recipes' && ui.tab === 'recipes' ? ui.show({ kind: 'list' }) : ui.go(id))} />
    </nav>

    <main>
      <div class="timers-pinned"><TimerTray showRecipe /></div>
      {#if ui.tab === 'recipes'}
        <RecipesView />
      {:else if ui.tab === 'plan'}
        <PlanView />
      {:else if ui.tab === 'groceries'}
        <GroceriesView />
      {:else}
        <SettingsView />
      {/if}
    </main>
  </div>
{/if}

<IdleDock label={t('idle.label')} disabled={!!cooking}><IdlePot /></IdleDock>

<Toast toast={ui.toast} onpause={() => ui.pauseToast()} onresume={() => ui.resumeToast()} onaction={() => ui.actOnToast()} />

<style>
  .timers-pinned:not(:empty) {
    position: sticky;
    top: var(--inset-top);
    z-index: 2;
    margin-bottom: var(--space-5);
  }
</style>
