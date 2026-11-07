<script lang="ts">
  import { showIngredient, type UnitMode } from '../domain/ingredient';
  import { linkHost, recipeToDraft, totalTime, type Recipe } from '../domain/recipe';
  import { formatDuration, stepPieces } from '../domain/steps';
  import type { CookEntry } from '../domain/cook';
  import { locale, relativeTime, t, type MessageKey } from '../i18n/index.svelte';
  import { shareText } from '../platform/share';
  import { library } from '../state/library.svelte';
  import { recipeMarkdown } from '../state/transfer';
  import { ui } from '../state/ui.svelte';
  import AddGroceries from './AddGroceries.svelte';
  import Thumb from './Thumb.svelte';

  let { recipe }: { recipe: Recipe } = $props();

  const base = $derived(recipe.servings ?? 0);
  let servings = $state(0);
  $effect.pre(() => {
    if (!servings) servings = base || 1;
  });
  const factor = $derived(base ? servings / base : 1);
  let units = $state<UnitMode>('original');
  let have = $state<Record<string, boolean>>({});
  let newCollection = $state('');
  let adding = $state(false);
  const total = $derived(totalTime(recipe));

  const UNIT_MODES: { value: UnitMode; key: MessageKey }[] = [
    { value: 'original', key: 'recipe.unitsOriginal' },
    { value: 'metric', key: 'recipe.unitsMetric' },
    { value: 'us', key: 'recipe.unitsUs' },
  ];

  async function share() {
    const result = await shareText(recipe.title, recipeMarkdown(recipe));
    if (result === 'copied') ui.notify(t('recipe.copied'), 'success');
  }

  async function remove() {
    const title = recipe.title;
    const { undo, forget } = await library.remove(recipe.id);
    ui.show({ kind: 'list' });
    ui.notify(t('recipe.deleted', { title }), 'info', { label: t('action.undo'), run: () => void undo(), dismissed: () => void forget() });
  }

  function cook() {
    ui.show({ kind: 'cook', id: recipe.id, servings: base ? servings : 1, units });
  }

  async function removeEntry(entry: CookEntry) {
    const before = recipe.log;
    await library.setLog(recipe.id, before.filter((e) => e !== entry));
    ui.notify(t('log.deleted'), 'info', { label: t('action.undo'), run: () => void library.setLog(recipe.id, before) });
  }

  const day = (iso: string) => new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

  async function addCollection() {
    const c = await library.addCollection(newCollection);
    newCollection = '';
    if (c && !recipe.collectionIds.includes(c.id)) await library.toggleCollection(recipe.id, c.id);
  }
</script>

<article class="recipe-page" id="recipePage">
  <button type="button" class="btn btn-muted back" id="btnBack" onclick={() => ui.show({ kind: 'list' })}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
    {t('recipe.back')}
  </button>

  {#if recipe.photoId}
    <div class="hero"><Thumb photoId={recipe.photoId} alt={recipe.title} full /></div>
  {/if}

  <header class="recipe-head">
    <h2 class="t-section-heading" id="recipeTitle">{recipe.title}</h2>
    <p class="t-data-small meta">
      {#if recipe.prepMinutes}<span>{t('recipe.prep')} {t('recipe.minutes', { count: recipe.prepMinutes })}</span>{/if}
      {#if recipe.cookMinutes}<span>{t('recipe.cook')} {t('recipe.minutes', { count: recipe.cookMinutes })}</span>{/if}
      {#if total && total !== recipe.cookMinutes}<span>{t('recipe.total')} {t('recipe.minutes', { count: total })}</span>{/if}
      {#if recipe.log.length}<span id="cookedCount">{t('log.count', { count: recipe.log.length })} · {t('log.last', { when: relativeTime(recipe.log[0]!.at) })}</span>{/if}
    </p>
    {#if recipe.tags.length}
      <div class="chip-row">
        {#each recipe.tags as tag (tag)}<span class="chip chip-tag">#{tag}</span>{/each}
      </div>
    {/if}
  </header>

  <div class="btn-row actions">
    {#if recipe.steps.length}
      <button type="button" class="btn btn-primary" id="btnCook" onclick={cook}>
        <!-- Lucide "chef-hat" -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" /><path d="M6 17h12" /></svg>
        {t('cook.start')}
      </button>
    {/if}
    {#if recipe.groups.length}
      <button type="button" class="btn btn-secondary" id="btnAddGroceries" onclick={() => (adding = true)}>{t('groceries.addFromRecipe')}</button>
    {/if}
  </div>
  <div class="tools">
    <button type="button" class="btn btn-muted" id="btnEdit" onclick={() => ui.edit(recipeToDraft(recipe), 'edit')}>{t('recipe.edit')}</button>
    <button type="button" class="btn btn-muted" id="btnShare" onclick={share}>{t('recipe.share')}</button>
    <button type="button" class="btn btn-muted" id="btnDelete" onclick={remove}>{t('recipe.delete')}</button>
  </div>

  {#if recipe.groups.length}
    <section class="panel" aria-labelledby="ingredientsHead">
      <div class="section-head"><h3 id="ingredientsHead">{t('recipe.ingredients')}</h3></div>
      <div class="controls">
        {#if base}
          <div class="stepper">
            <span class="t-field-label" id="servingsLabel">{t('recipe.servings')}</span>
            <div class="stepper-row" role="group" aria-labelledby="servingsLabel">
              <button type="button" class="btn-icon" aria-label={t('recipe.fewer')} disabled={servings <= 1} onclick={() => (servings = Math.max(1, servings - 1))}>−</button>
              <output class="t-data tabular" id="servingsValue" aria-live="polite">{servings}</output>
              <button type="button" class="btn-icon" aria-label={t('recipe.more')} disabled={servings >= 99} onclick={() => (servings = Math.min(99, servings + 1))}>+</button>
            </div>
          </div>
        {/if}
        <div class="stepper">
          <span class="t-field-label" id="unitsLabel">{t('recipe.units')}</span>
          <div class="segmented" role="radiogroup" aria-labelledby="unitsLabel">
            {#each UNIT_MODES as m (m.value)}
              <button type="button" role="radio" aria-checked={units === m.value} data-units={m.value} onclick={() => (units = m.value)}>{t(m.key)}</button>
            {/each}
          </div>
        </div>
      </div>
      {#each recipe.groups as group, gi (gi)}
        {#if group.name}<h4 class="t-section-label group-name">{group.name}</h4>{/if}
        <ul class="ingredients">
          {#each group.items as ing (ing.id)}
            {@const shown = showIngredient(ing, factor, units, locale())}
            <li>
              <label class="ingredient" class:have={have[ing.id]}>
                <input type="checkbox" bind:checked={have[ing.id]} />
                <span>
                  {#if shown.amount}<span class="amount t-data">{shown.amount}</span>{/if}
                  <span class="item">{shown.item}</span>{#if shown.note}<span class="note">, {shown.note}</span>{/if}
                </span>
              </label>
            </li>
          {/each}
        </ul>
      {/each}
    </section>
  {/if}

  {#if recipe.steps.length}
    <section class="panel" aria-labelledby="methodHead">
      <div class="section-head"><h3 id="methodHead">{t('recipe.method')}</h3></div>
      <ol class="steps">
        {#each recipe.steps as step (step.id)}
          <li>
            {#each stepPieces(step) as piece, pi (pi)}
              {#if piece.timer !== undefined}<span class="timer" title={t('recipe.timer', { time: formatDuration(step.timers[piece.timer]!.seconds) })}>{piece.text}</span>{:else}{piece.text}{/if}
            {/each}
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if recipe.notes}
    <section class="panel" aria-labelledby="notesHead">
      <div class="section-head"><h3 id="notesHead">{t('recipe.notes')}</h3></div>
      <p class="notes">{recipe.notes}</p>
    </section>
  {/if}

  {#if recipe.log.length}
    <section class="panel" aria-labelledby="logHead">
      <div class="section-head"><h3 id="logHead">{t('log.title')}</h3></div>
      <ul class="cook-log" id="cookLog">
        {#each recipe.log as entry (entry.at)}
          <li>
            <div class="log-head">
              <span class="t-data-small">{day(entry.at)}</span>
              {#if entry.servings}<span class="t-data-small dim">{t('log.servings', { count: entry.servings })}</span>{/if}
              {#if entry.rating}<span class="stars" role="img" aria-label={t('cook.ratingValue', { count: entry.rating })}>{'★'.repeat(entry.rating)}<span class="dim">{'★'.repeat(5 - entry.rating)}</span></span>{/if}
              <button type="button" class="btn btn-muted log-delete" aria-label={t('log.delete', { date: day(entry.at) })} onclick={() => removeEntry(entry)}>{t('recipe.delete')}</button>
            </div>
            {#if entry.note}<p class="log-note">{entry.note}</p>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="panel" aria-labelledby="collectionsHead">
    <div class="section-head"><h3 id="collectionsHead">{t('recipe.collections')}</h3></div>
    {#if library.collections.length}
      <div class="chip-row collections">
        {#each library.collections as c (c.id)}
          <button type="button" class="chip" aria-pressed={recipe.collectionIds.includes(c.id)} onclick={() => library.toggleCollection(recipe.id, c.id)}>{c.name}</button>
        {/each}
      </div>
    {/if}
    <form
      class="new-collection"
      onsubmit={(e) => {
        e.preventDefault();
        void addCollection();
      }}
    >
      <input class="input" id="newCollection" placeholder={t('recipe.newCollection')} aria-label={t('recipe.collectionName')} enterkeyhint="done" maxlength="60" bind:value={newCollection} />
      <button type="submit" class="btn btn-muted" disabled={!newCollection.trim()}>{t('recipe.addCollection')}</button>
    </form>
  </section>

  <footer class="source t-hint">
    <b>{t('recipe.source')}.</b>
    {#if recipe.source.url}
      <a href={recipe.source.url} target="_blank" rel="noopener noreferrer">{recipe.source.author ?? linkHost(recipe.source.url)}</a>
    {:else}
      {recipe.source.author ?? t(`recipe.kind.${recipe.source.kind}` as MessageKey)}
    {/if}
  </footer>
  {#if recipe.source.text}
    <details class="original">
      <summary class="t-field-label">{t('recipe.original')}</summary>
      <pre>{recipe.source.text}</pre>
    </details>
  {/if}
</article>

{#if adding}
  <AddGroceries {recipe} {factor} {units} onclose={() => (adding = false)} />
{/if}

<style>
  .recipe-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .back {
    align-self: flex-start;
    padding-left: 0.75rem;
  }
  .hero {
    aspect-ratio: 16 / 10;
    border-radius: var(--radius);
    overflow: hidden;
  }
  .recipe-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .recipe-head h2 {
    color: var(--text-heading);
    margin: 0;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-4);
    color: var(--text-dim);
  }
  .actions:empty {
    display: none;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: calc(-1 * var(--space-3));
  }
  .panel {
    margin: 0;
  }
  .section-head h3 {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 400;
    font-style: italic;
    color: var(--text-heading);
    margin: 0;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    margin-bottom: var(--space-5);
  }
  .stepper {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .stepper-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .stepper-row output {
    min-width: 2ch;
    text-align: center;
    color: var(--text-heading);
  }
  .group-name {
    margin: var(--space-5) 0 var(--space-3);
  }
  .ingredients {
    list-style: none;
    display: flex;
    flex-direction: column;
  }
  .ingredient {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    min-height: 44px;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border-faint);
    color: var(--text-strong);
    line-height: 1.45;
  }
  .ingredient input {
    margin-top: 0.2rem;
    width: 20px;
    height: 20px;
    accent-color: var(--accent-bright);
    flex-shrink: 0;
  }
  .ingredient.have {
    color: var(--text-dim);
    text-decoration: line-through;
  }
  .amount {
    color: var(--accent-amber);
    margin-right: 0.4em;
  }
  .note {
    color: var(--text-dim);
  }
  .steps {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-left: 1.5rem;
    color: var(--text-strong);
    font-family: var(--font-serif);
    font-size: 1.0625rem;
    line-height: 1.6;
  }
  .steps li::marker {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--accent-amber);
  }
  .timer {
    color: var(--accent-amber);
    border-bottom: 1px dotted currentColor;
  }
  .notes {
    white-space: pre-line;
    color: var(--text-strong);
    line-height: 1.6;
  }
  .collections {
    margin-bottom: var(--space-4);
  }
  .cook-log {
    list-style: none;
  }
  .cook-log li {
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border-faint);
  }
  .log-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    color: var(--text-strong);
  }
  .dim {
    color: var(--text-faint);
  }
  .stars {
    color: var(--accent-amber);
    letter-spacing: 0.05em;
  }
  .log-delete {
    margin-left: auto;
  }
  .log-note {
    margin-top: var(--space-2);
    color: var(--text-strong);
    white-space: pre-line;
    line-height: 1.5;
  }
  .new-collection {
    display: flex;
    gap: var(--space-2);
  }
  .source a {
    color: var(--accent-amber);
  }
  .original pre {
    white-space: pre-wrap;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--text-dim);
    margin: var(--space-3) 0 0;
  }
  .original summary {
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
</style>
