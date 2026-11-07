<script lang="ts">
  // "Add to groceries": a recipe's ingredients at the chosen servings, all
  // ticked except what you always have in. Untick what you already have.
  import { untrack } from 'svelte';
  import { additionFrom, isStaple } from '../domain/groceries';
  import { showIngredient, type UnitMode } from '../domain/ingredient';
  import type { Recipe } from '../domain/recipe';
  import { locale, t } from '../i18n/index.svelte';
  import { groceries } from '../state/groceries.svelte';
  import { settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import Sheet from './ui/Sheet.svelte';

  let { recipe, factor, units, onclose }: { recipe: Recipe; factor: number; units: UnitMode; onclose: () => void } = $props();

  const all = $derived(recipe.groups.flatMap((g) => g.items));
  let picked = $state<Record<string, boolean>>(untrack(() => Object.fromEntries(recipe.groups.flatMap((g) => g.items).map((i) => [i.id, !isStaple(i.item, settings.current.staples)]))));
  const count = $derived(all.filter((i) => picked[i.id]).length);
  let busy = $state(false);

  async function add() {
    busy = true;
    try {
      const chosen = all.filter((i) => picked[i.id]);
      await groceries.add(chosen.map((i) => additionFrom(i, factor, units, recipe.id)));
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
  {#each recipe.groups as group, gi (gi)}
    {#if group.name}<h3 class="t-section-label group-name">{group.name}</h3>{/if}
    <ul class="pick" id={gi === 0 ? 'addGroceriesList' : undefined}>
      {#each group.items as ing (ing.id)}
        {@const shown = showIngredient(ing, factor, units, locale())}
        <li>
          <label class="pick-item">
            <input type="checkbox" bind:checked={picked[ing.id]} />
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
  <div class="btn-row">
    <button type="button" class="btn btn-primary" id="btnAddToList" disabled={!count || busy} onclick={add}>{t('groceries.addCount', { count })}</button>
  </div>
</Sheet>

<style>
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
    accent-color: var(--accent-bright);
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
