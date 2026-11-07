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
  <section class="timer-tray" id="timerTray" aria-label={t('timer.tray')}>
    {#each timers.list as tm (tm.id)}
      {@const paused = !tm.done && tm.endsAt === null}
      <div class="timer-chip" class:done={tm.done} class:paused>
        <span class="timer-label">
          {#if showRecipe}<span class="timer-recipe">{library.get(tm.recipeId)?.title}</span>{/if}
          {tm.label}
        </span>
        <span class="timer-clock t-data tabular" role="timer">{tm.done ? t('timer.rang') : formatClock(timers.left(tm))}</span>
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
  .timer-tray {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .timer-chip {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 44px;
    padding: 0 var(--space-1) 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--chip-bg);
    color: var(--text-strong);
  }
  .timer-label {
    display: flex;
    flex-direction: column;
    font-size: 0.8125rem;
    color: var(--text-dim);
    margin-right: var(--space-2);
    line-height: 1.2;
  }
  .timer-recipe {
    color: var(--text-strong);
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timer-clock {
    min-width: 4ch;
    color: var(--accent-amber);
    font-size: 1.125rem;
  }
  .paused .timer-clock {
    color: var(--text-dim);
  }
  .done {
    border-color: var(--accent-bright);
    background: rgba(var(--accent-bright-rgb), 0.14);
  }
  .done .timer-clock {
    color: var(--accent-bright);
  }
  .plus {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .done {
      animation: ring 1.2s var(--ease-standard) infinite alternate;
    }
  }
  @keyframes ring {
    from {
      background: rgba(var(--accent-bright-rgb), 0.06);
    }
    to {
      background: rgba(var(--accent-bright-rgb), 0.22);
    }
  }
</style>
