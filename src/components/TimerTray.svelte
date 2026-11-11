<script lang="ts">
  // The running timers, pinned at the top of cooking mode and of the app
  // while any is left (style.md §8: chips, tabular figures).
  import { formatClock } from '../domain/cook';
  import { t } from '../i18n/index.svelte';
  import { library } from '../state/library.svelte';
  import { timers } from '../state/timers.svelte';

  let { showRecipe = false }: { showRecipe?: boolean } = $props();
</script>

{#if timers.list.length}
  <section class="timer-tray" class:wide={showRecipe} id="timerTray" aria-label={t('timer.tray')}>
    {#each timers.list as tm (tm.id)}
      {@const paused = !tm.done && tm.endsAt === null}
      <div class="timer-chip" class:is-done={tm.done} class:is-paused={paused}>
        <span class="timer-chip-label">
          {#if showRecipe}<span class="timer-recipe">{library.get(tm.recipeId)?.title}</span>{/if}
          {tm.label}
        </span>
        <span class="timer-chip-time" role="timer">{tm.done ? t('timer.rang') : formatClock(timers.left(tm))}</span>
        {#if !tm.done}
          <button type="button" class="btn-icon" aria-label={t(paused ? 'timer.resume' : 'timer.pause', { label: tm.label })} onclick={() => timers.toggle(tm.id)}>
            {#if paused}
              <!-- Lucide "play" -->
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3" /></svg>
            {:else}
              <!-- Lucide "pause" -->
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></svg>
            {/if}
          </button>
        {/if}
        <button type="button" class="btn-icon plus" onclick={() => timers.extend(tm.id)}><span aria-hidden="true">+1</span><span class="visually-hidden">{t('timer.addMinute', { label: tm.label })}</span></button>
        <button type="button" class="btn-icon" aria-label={t(tm.done ? 'timer.clear' : 'timer.stop', { label: tm.label })} onclick={() => timers.stop(tm.id)}>
          <!-- Lucide "x" -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      </div>
    {/each}
  </section>
{/if}

<style>
  /* The chip itself is dusk-dawn's .timer-chip (style.md §8.19). */
  .timer-tray {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  /* A chip never pushes the page wider than the screen: the label gives way. */
  .timer-tray :global(.timer-chip) {
    max-width: 100%;
    min-width: 0;
  }
  .timer-tray.wide :global(.timer-chip) {
    flex: 1 1 100%;
  }
  .timer-tray :global(.timer-chip-label) {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
  }
  .timer-tray :global(.timer-chip-label),
  .timer-tray :global(.timer-chip-time) {
    white-space: nowrap;
  }
  .timer-recipe {
    color: var(--text-strong);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .plus {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
  }
</style>
