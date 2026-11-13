<script lang="ts">
  // "Add to groceries": one or several recipes' ingredients (a planned week) at the
  // chosen servings, all ticked except what you always have in. Untick what you have.
  import { untrack } from 'svelte';
  import { additionFrom, isStaple } from '../domain/groceries';
  import { showIngredient, type Ingredient, type UnitMode } from '../domain/ingredient';
  import type { Recipe } from '../domain/recipe';
  import { locale, t } from '../i18n/index.svelte';
  import { groceries } from '../state/groceries.svelte';
  import { settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import Sheet from './ui/Sheet.svelte';

  interface Source {
    recipe: Recipe;
    factor: number;
  }
  let { sources, units, onclose, onadded }: { sources: Source[]; units: UnitMode; onclose: () => void; onadded?: () => void } = $props();

  const many = $derived(sources.length > 1);
  const key = (si: number, ing: Ingredient) => `${si}:${ing.id}`;
  const all = $derived(sources.flatMap((s, si) => s.recipe.groups.flatMap((g) => g.items.map((ing) => ({ si, ing })))));
  let picked = $state<Record<string, boolean>>(
    untrack(() => Object.fromEntries(sources.flatMap((s, si) => s.recipe.groups.flatMap((g) => g.items.map((i) => [key(si, i), !isStaple(i.item, settings.current.staples)]))))),
  );
  const count = $derived(all.filter(({ si, ing }) => picked[key(si, ing)]).length);
  let busy = $state(false);

  async function add() {
    busy = true;
    try {
      const chosen = all.filter(({ si, ing }) => picked[key(si, ing)]);
      await groceries.add(chosen.map(({ si, ing }) => additionFrom(ing, sources[si]!.factor, units, sources[si]!.recipe.id)));
      onadded?.();
      onclose();
      ui.notify(t('groceries.added', { count: chosen.length }), 'success', { label: t('groceries.view'), run: () => ui.go('groceries') });
    } catch (err) {
      console.error('Adding to the grocery list failed:', err);
      ui.notify(t('toast.saveFailed'), 'error');
    } finally {
      busy = false;
    }
  }
</script>

<Sheet title={t('groceries.addTitle')} {onclose}>
  <p class="t-hint">{t('groceries.addHint')}</p>
  {#each sources as source, si (si)}
    {#if many}<h3 class="recipe-name">{source.recipe.title}</h3>{/if}
    {#each source.recipe.groups as group, gi (gi)}
      {#if group.name}<h3 class="t-section-label group-name">{group.name}</h3>{/if}
      <ul class="pick" id={si === 0 && gi === 0 ? 'addGroceriesList' : undefined}>
        {#each group.items as ing (ing.id)}
          {@const shown = showIngredient(ing, source.factor, units, locale())}
          <li>
            <label class="pick-item">
              <input type="checkbox" class="check" bind:checked={picked[key(si, ing)]} />
              <span>
                {#if shown.amount}<span class="amount t-data">{shown.amount}</span>{/if}
                {shown.item}
                {#if isStaple(ing.item, settings.current.staples)}<span class="chip chip-tag staple">{t('groceries.stapleTag')}</span>{/if}
              </span>
            </label>
          </li>
        {/each}
      </ul>
    {/each}
  {/each}
  <div class="btn-row">
    <button type="button" class="btn btn-primary" id="btnAddToList" disabled={!count || busy} onclick={add}>{t('groceries.addCount', { count })}</button>
  </div>
</Sheet>

<style>
  .recipe-name {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--text-heading);
    margin: var(--space-5) 0 var(--space-2);
  }
  .group-name {
    margin: var(--space-4) 0 var(--space-2);
  }
  .pick {
    list-style: none;
    margin-bottom: var(--space-4);
  }
  .pick-item {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    min-height: 48px;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border-faint);
    color: var(--text-strong);
    line-height: 1.45;
    cursor: pointer;
  }
  .pick-item input {
    margin-top: 0.2rem;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  .amount {
    color: var(--accent-amber);
    margin-right: 0.4em;
  }
  .staple {
    margin-left: var(--space-2);
  }
</style>
