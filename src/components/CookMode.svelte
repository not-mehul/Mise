<script lang="ts">
  // Cooking mode: one step at a time in large type, to be read from a metre
  // away. Swipe, tap the edges, use the arrow keys or (Android) the volume
  // keys to move. The screen stays on while it is open.
  import { untrack } from 'svelte';
  import { cookPages, resumePlace, stepIngredients, formatClock } from '../domain/cook';
  import { showIngredient, type UnitMode } from '../domain/ingredient';
  import type { Recipe } from '../domain/recipe';
  import { formatDuration, stepParts } from '../domain/steps';
  import { locale, t } from '../i18n/index.svelte';
  import { captureVolumeKeys, keepAwake, tick } from '../platform/device';
  import { voiceCommand } from '../domain/voice';
  import { isSpeaking, speak, stopSpeaking } from '../platform/speech';
  import { listen, voiceAvailable } from '../platform/voice';
  import { loadPlace, savePlace } from '../state/cookPlace';
  import { library } from '../state/library.svelte';
  import { settings } from '../state/settings.svelte';
  import { timers } from '../state/timers.svelte';
  import { ui } from '../state/ui.svelte';
  import TimerTray from './TimerTray.svelte';
  import Sheet from './ui/Sheet.svelte';

  let { recipe, servings: chosen, units }: { recipe: Recipe; servings: number; units: UnitMode } = $props();

  const pages = $derived(cookPages(recipe));
  const resumed = untrack(() => resumePlace(loadPlace(), recipe.id, pages.length));
  let page = $state(untrack(() => resumed?.page ?? 0));
  const servings = untrack(() => resumed?.servings ?? chosen);
  let gathered = $state<Record<string, boolean>>(untrack(() => Object.fromEntries((resumed?.gathered ?? []).map((id) => [id, true]))));
  const factor = $derived(recipe.servings ? servings / recipe.servings : 1);
  const current = $derived(pages[Math.min(page, pages.length - 1)]!);
  const step = $derived(current.kind === 'step' ? recipe.steps[current.index] : undefined);
  const stepNumber = $derived(current.kind === 'step' ? current.index + 1 : 0);
  const needs = $derived(step ? stepIngredients(recipe, step) : []);
  const progress = $derived(pages.length > 1 ? page / (pages.length - 1) : 1);

  let allSteps = $state(false);
  let rating = $state<number | null>(null);
  let note = $state('');
  let saving = $state(false);
  let pageEl: HTMLElement;

  untrack(() => {
    const at = resumed ? pages[resumed.page] : undefined;
    if (at?.kind === 'step') ui.notify(t('cook.resumed', { step: at.index + 1 }), 'info');
  });

  function go(next: number) {
    const clamped = Math.max(0, Math.min(pages.length - 1, next));
    if (clamped === page) return;
    page = clamped;
    tick();
    globalThis.scrollTo?.({ top: 0 });
  }

  // A timer's alarm was opened: turn to the step that set it.
  $effect(() => {
    const jump = ui.cookJump;
    if (!jump || jump.recipeId !== recipe.id) return;
    untrack(() => {
      const at = pages.findIndex((p) => p.kind === 'step' && recipe.steps[p.index]?.id === jump.stepId);
      if (at >= 0) {
        allSteps = false;
        go(at);
      }
      ui.cookJump = null;
    });
  });

  // Where you are is saved as you go, so leaving and coming back resumes there.
  $effect(() => {
    savePlace({ recipeId: recipe.id, page, servings, gathered: Object.keys(gathered).filter((id) => gathered[id]), at: Date.now() });
  });

  $effect(() => {
    void keepAwake(true);
    return () => {
      void keepAwake(false);
      stopSpeaking();
    };
  });

  $effect(() => {
    if (!settings.current.volumeKeys) return;
    return captureVolumeKeys((d) => untrack(() => go(page + d)));
  });

  $effect(() => {
    if (!settings.current.readAloud || !step) return;
    const text = `${t('cook.step', { step: stepNumber })}. ${step.text}`;
    untrack(() => void speak(text, locale()));
  });

  $effect(() => {
    if (!settings.current.readAloud) stopSpeaking();
  });

  // Hands-free: "next", "back", "repeat", "timer", "ingredients", "stop".
  let listening = $state(false);
  $effect(() => {
    if (!settings.current.handsFree || !voiceAvailable) return;
    let stop: (() => void) | null = null;
    let gone = false;
    void listen(locale(), (texts) => untrack(() => heard(texts)), () => {
      listening = false;
      settings.update({ handsFree: false });
      ui.notify(t('cook.handsFreeRefused'), 'error');
    }).then((off) => {
      if (gone) off();
      else {
        stop = off;
        listening = settings.current.handsFree;
      }
    });
    return () => {
      gone = true;
      listening = false;
      stop?.();
    };
  });

  function sayStep() {
    if (step) void speak(`${t('cook.step', { step: stepNumber })}. ${step.text}`, locale());
  }

  function heard(texts: string[]) {
    if (isSpeaking() && voiceCommand(texts) !== 'stop') return;
    switch (voiceCommand(texts)) {
      case 'next':
        go(page + 1);
        // Read aloud reads the new step by itself.
        if (!settings.current.readAloud) sayStep();
        break;
      case 'back':
        go(page - 1);
        if (!settings.current.readAloud) sayStep();
        break;
      case 'repeat':
        sayStep();
        break;
      case 'timer': {
        const i = step?.timers.findIndex((_, n) => !timerFor(n)) ?? -1;
        if (i >= 0) startTimer(i);
        break;
      }
      case 'ingredients': {
        const list = (current.kind === 'prep' ? recipe.groups.flatMap((g) => g.items) : needs).map((ing) => {
          const shown = showIngredient(ing, factor, units, locale());
          return [shown.amount, shown.item].filter(Boolean).join(' ');
        });
        if (list.length) void speak(list.join(', '), locale());
        break;
      }
      case 'stop':
        stopSpeaking();
        break;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (allSteps || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as Element | null)?.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1);
    else return;
    e.preventDefault();
  }

  // Swipe sideways, or tap the outer quarter of the page, to move.
  let from: { x: number; y: number } | null = null;
  let swiped = false;
  function down(e: PointerEvent) {
    from = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
    swiped = false;
  }
  function up(e: PointerEvent) {
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    from = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      swiped = true;
      go(page + (dx < 0 ? 1 : -1));
    }
  }
  function tap(e: MouseEvent) {
    if (swiped || (e.target as Element).closest('button, a, input, label, textarea, select, summary')) return;
    const box = pageEl.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    if (x < 0.25) go(page - 1);
    else if (x > 0.75) go(page + 1);
  }

  function close() {
    ui.openRecipe(recipe.id);
  }

  async function markCooked() {
    saving = true;
    try {
      await library.logCook(recipe.id, { servings: recipe.servings ? servings : null, rating, note });
      savePlace(null);
      ui.openRecipe(recipe.id);
      ui.notify(t('cook.logged'), 'success');
    } catch (err) {
      console.error('Logging the cook failed:', err);
      ui.notify(t('toast.saveFailed'), 'error');
    } finally {
      saving = false;
    }
  }

  function leave() {
    savePlace(null);
    ui.openRecipe(recipe.id);
  }

  function timerFor(index: number) {
    return step ? timers.forStep(step.id, index) : undefined;
  }

  function startTimer(index: number) {
    if (!step) return;
    const seconds = step.timers[index]!.seconds;
    void timers.start({ recipeId: recipe.id, stepId: step.id, index, seconds, label: t('timer.label', { step: stepNumber }) });
  }
</script>

<svelte:window onkeydown={onKey} />

<main class="cook" id="cookMode" aria-labelledby="cookTitle">
  <header class="cook-bar">
    <button type="button" class="btn btn-muted" id="btnCookClose" onclick={close}>
      <!-- Lucide "x" -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      {t('action.close')}
    </button>
    <span class="spacer"></span>
    <button type="button" class="btn-icon" id="btnReadAloud" aria-pressed={settings.current.readAloud} aria-label={t('cook.readAloud')} onclick={() => settings.update({ readAloud: !settings.current.readAloud })}>
      <!-- Lucide "volume-2" -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /><path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.364 18.364a9 9 0 0 0 0-12.728" /></svg>
    </button>
    {#if voiceAvailable}
      <button type="button" class="btn-icon" id="btnHandsFree" class:listening aria-pressed={settings.current.handsFree} aria-label={t('cook.handsFree')} onclick={() => settings.update({ handsFree: !settings.current.handsFree })}>
        <!-- Lucide "mic" -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
      </button>
    {/if}
    <button type="button" class="btn btn-muted" id="btnAllSteps" onclick={() => (allSteps = true)}>{t('cook.allSteps')}</button>
  </header>
  <div class="cook-where">
    <h1 class="t-section-label cook-title" id="cookTitle">{recipe.title}</h1>
    <p class="t-data-small" id="cookProgress" aria-live="polite">
      {#if current.kind === 'prep'}{t('cook.prepTitle')}{:else if current.kind === 'step'}{t('cook.progress', { step: stepNumber, count: recipe.steps.length })}{:else}{t('cook.doneTitle')}{/if}
    </p>
  </div>
  <div class="meter" role="progressbar" aria-label={t('cook.progressLabel')} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)}>
    <div class="meter-fill" class:is-complete={current.kind === 'done'} style:transform="scaleX({progress})"></div>
  </div>

  <TimerTray />

  <!-- Taps and swipes are shortcuts; every move also has a button and a key. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <section class="cook-page" bind:this={pageEl} onpointerdown={down} onpointerup={up} onclick={tap}>
    {#if current.kind === 'prep'}
      <h2 class="page-title">{t('cook.prepTitle')}</h2>
      <p class="t-hint">
        {t('cook.prepHint')}
        {#if recipe.servings}{t('cook.prepFor', { count: servings })}{/if}
      </p>
      {#each recipe.groups as group, gi (gi)}
        {#if group.name}<h3 class="t-section-label group-name">{group.name}</h3>{/if}
        <ul class="gather">
          {#each group.items as ing (ing.id)}
            {@const shown = showIngredient(ing, factor, units, locale())}
            <li>
              <label class="gather-item" class:have={gathered[ing.id]}>
                <input type="checkbox" bind:checked={gathered[ing.id]} />
                <span>
                  {#if shown.amount}<span class="amount t-data">{shown.amount}</span>{/if}
                  {shown.item}{#if shown.note}<span class="note">, {shown.note}</span>{/if}
                </span>
              </label>
            </li>
          {/each}
        </ul>
      {/each}
    {:else if step}
      <div class="step-layout">
        <div class="step-main">
          <h2 class="t-section-label step-number">{t('cook.step', { step: stepNumber })}{#if step.section}<span class="step-section"> · {step.section}</span>{/if}</h2>
          <p class="t-step" id="stepText">
            {#each stepParts(step, recipe.groups, factor, units, locale()) as piece, pi (pi)}{#if piece.timer !== undefined}<mark class="duration">{piece.text}</mark>{:else if piece.amount}<span class="inline-amount">{piece.text}</span>{:else}{piece.text}{/if}{/each}
          </p>
          {#if step.timers.length}
            <div class="step-timers">
              {#each step.timers as timer, i (i)}
                {@const running = timerFor(i)}
                {#if running}
                  <span class="chip chip-status is-active timer-running">{running.done ? t('timer.rang') : formatClock(timers.left(running))}</span>
                {:else}
                  <button type="button" class="btn btn-secondary start-timer" onclick={() => startTimer(i)}>
                    <!-- Lucide "timer" -->
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="10" x2="14" y1="2" y2="2" /><line x1="12" x2="15" y1="14" y2="11" /><circle cx="12" cy="14" r="8" /></svg>
                    {t('timer.start', { time: formatDuration(timer.seconds) })}
                  </button>
                {/if}
              {/each}
            </div>
          {/if}
          {#if needs.length}
            <div class="needs">
              <h3 class="t-section-label">{t('cook.needs')}</h3>
              <ul>
                {#each needs as ing (ing.id)}
                  {@const shown = showIngredient(ing, factor, units, locale())}
                  <li>{#if shown.amount}<span class="amount t-data">{shown.amount}</span>{/if} {shown.item}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
        <!-- On a tablet or a wide screen, every ingredient sits beside the step, with this step's lit. -->
        <aside class="step-side" aria-label={t('recipe.ingredients')}>
          {#each recipe.groups as group, gi (gi)}
            {#if group.name}<h3 class="t-section-label group-name">{group.name}</h3>{/if}
            <ul>
              {#each group.items as ing (ing.id)}
                {@const shown = showIngredient(ing, factor, units, locale())}
                <li class:now={step.ingredientIds.includes(ing.id)}>{#if shown.amount}<span class="amount t-data">{shown.amount}</span>{/if} {shown.item}</li>
              {/each}
            </ul>
          {/each}
        </aside>
      </div>
    {:else}
      <h2 class="page-title">{t('cook.doneTitle')}</h2>
      <p class="t-hint">{t('cook.doneHint')}</p>
      <div class="field">
        <span class="t-field-label" id="ratingLabel">{t('cook.rating')}</span>
        <div class="segmented rating" role="radiogroup" aria-labelledby="ratingLabel">
          {#each [1, 2, 3, 4, 5] as n (n)}
            <button type="button" role="radio" aria-checked={rating === n} aria-label={t('cook.ratingValue', { count: n })} onclick={() => (rating = rating === n ? null : n)}>{'★'.repeat(n)}</button>
          {/each}
        </div>
      </div>
      <label class="field">
        <span class="t-field-label">{t('cook.note')}</span>
        <textarea class="textarea" id="cookNote" rows="3" maxlength="2000" placeholder={t('cook.notePlaceholder')} bind:value={note}></textarea>
      </label>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="btnMarkCooked" disabled={saving} onclick={markCooked}>{t('cook.markCooked')}</button>
        <button type="button" class="btn btn-muted" id="btnLeaveCook" onclick={leave}>{t('cook.closeWithout')}</button>
      </div>
    {/if}
  </section>

  {#if current.kind !== 'done'}
    <nav class="cook-nav" aria-label={t('cook.steps')}>
      <button type="button" class="btn btn-muted" id="btnPrevStep" disabled={page === 0} onclick={() => go(page - 1)}>{t('cook.prev')}</button>
      <button type="button" class="btn btn-primary" id="btnNextStep" onclick={() => go(page + 1)}>
        {#if current.kind === 'prep'}{t('cook.begin')}{:else if page === pages.length - 2}{t('cook.finish')}{:else}{t('cook.next')}{/if}
      </button>
    </nav>
  {/if}
</main>

{#if allSteps}
  <Sheet title={t('cook.allSteps')} onclose={() => (allSteps = false)}>
    <ol class="all-steps">
      {#each pages as p, i (i)}
        {#if p.kind !== 'done'}
          <li>
            <button
              type="button"
              class="jump"
              aria-current={i === page ? 'step' : undefined}
              onclick={() => {
                allSteps = false;
                go(i);
              }}
            >
              <span class="t-section-label">{p.kind === 'prep' ? t('cook.prepTitle') : t('cook.step', { step: p.index + 1 })}</span>
              {#if p.kind === 'step'}<span class="jump-text">{recipe.steps[p.index]!.text}</span>{/if}
            </button>
          </li>
        {/if}
      {/each}
    </ol>
  </Sheet>
{/if}

<style>
  .cook {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: var(--max-width);
    min-height: calc(100dvh - var(--inset-top) - var(--inset-bottom));
    margin: 0 auto;
    padding: var(--space-4) 1.25rem 0;
  }
  .cook-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .cook-bar > .btn:first-child {
    padding-left: 0.75rem;
  }
  .spacer {
    flex: 1;
  }
  .cook-where {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: calc(-1 * var(--space-2));
  }
  .cook-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cook-where p {
    flex-shrink: 0;
    color: var(--text-dim);
  }
  #btnReadAloud[aria-pressed='true'],
  #btnHandsFree[aria-pressed='true'] {
    color: var(--accent-bright);
  }
  #btnHandsFree.listening svg {
    animation: listening 2s var(--ease-settle) infinite;
  }
  @keyframes listening {
    50% {
      opacity: 0.55;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    #btnHandsFree.listening svg {
      animation: none;
    }
  }
  .meter-fill {
    transition: transform var(--dur-settle) var(--ease-settle);
  }
  .cook-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-4) 0 var(--space-6);
    touch-action: pan-y;
  }
  .page-title {
    font-family: var(--font-serif);
    font-size: 2.25rem;
    font-weight: 400;
    font-style: italic;
    color: var(--text-heading);
    line-height: 1.15;
  }
  .step-number {
    color: var(--accent-amber);
  }
  .step-section {
    color: var(--text-dim);
  }
  .inline-amount {
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.6em;
    white-space: nowrap;
  }
  .duration {
    background: none;
    color: var(--accent-amber);
    border-bottom: 2px dotted currentColor;
  }
  .step-timers {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .start-timer svg {
    width: 18px;
    height: 18px;
  }
  .timer-running {
    min-height: 44px;
    font-family: var(--font-mono);
    font-size: 1rem;
  }
  .needs {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-faint);
  }
  .needs ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: 1.125rem;
    color: var(--text-strong);
  }
  .amount {
    color: var(--accent-amber);
    margin-right: 0.4em;
  }
  .note {
    color: var(--text-dim);
  }
  .group-name {
    margin-top: var(--space-3);
  }
  .gather {
    list-style: none;
  }
  .gather-item {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    min-height: 52px;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border-faint);
    color: var(--text-strong);
    font-size: 1.125rem;
    line-height: 1.45;
  }
  .gather-item input {
    margin-top: 0.25rem;
    width: 22px;
    height: 22px;
    accent-color: var(--accent-bright);
    flex-shrink: 0;
  }
  .gather-item.have {
    color: var(--text-dim);
    text-decoration: line-through;
  }
  .rating button {
    letter-spacing: -0.1em;
  }
  .step-layout,
  .step-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .step-side {
    display: none;
  }
  /* Tablets and wide screens: the step on the left, the ingredients beside it. */
  @media (min-width: 900px) {
    .cook {
      max-width: 1200px;
    }
    .step-layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
      align-items: start;
      gap: var(--space-6);
    }
    .step-main .needs {
      display: none;
    }
    .step-side {
      display: block;
      position: sticky;
      top: var(--space-4);
      padding-left: var(--space-5);
      border-left: 1px solid var(--border-faint);
    }
    .step-side ul {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
      font-size: 1.0625rem;
      color: var(--text-dim);
    }
    .step-side li.now {
      color: var(--text-strong);
    }
  }
  .cook-nav {
    position: sticky;
    bottom: 0;
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--space-3);
    padding: var(--space-3) 0 calc(var(--space-4) + var(--inset-bottom));
    background: linear-gradient(to bottom, transparent, var(--bg-grad-bot) 30%);
  }
  .cook-nav .btn {
    min-height: 56px;
    font-size: 1.0625rem;
  }
  .all-steps {
    list-style: none;
    display: flex;
    flex-direction: column;
  }
  .jump {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 100%;
    min-height: 52px;
    padding: var(--space-3) 0;
    font: inherit;
    text-align: left;
    color: var(--text-strong);
    background: none;
    border: 0;
    border-bottom: 1px solid var(--border-faint);
    cursor: pointer;
  }
  .jump[aria-current='step'] .t-section-label {
    color: var(--accent-bright);
  }
  .jump-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--text-dim);
  }
</style>
