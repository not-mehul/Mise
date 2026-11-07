<script lang="ts">
  import { ingredientCount, totalTime, type Recipe } from '../domain/recipe';
  import { t, type MessageKey } from '../i18n/index.svelte';
  import Thumb from './Thumb.svelte';

  let { recipe, onopen }: { recipe: Recipe; onopen: () => void } = $props();
  const minutes = $derived(totalTime(recipe));
  const count = $derived(ingredientCount(recipe));
</script>

<button type="button" class="recipe-card" onclick={onopen}>
  <span class="card-photo"><Thumb photoId={recipe.photoId} /></span>
  <span class="card-text">
    <span class="t-card-title">{recipe.title}</span>
    <span class="t-data-small card-meta">
      {#if minutes}<span>{t('recipe.minutes', { count: minutes })}</span>{/if}
      {#if count}<span>{t('recipe.ingredientCount', { count })}</span>{/if}
      <span>{recipe.source.author ?? t(`recipe.kind.${recipe.source.kind}` as MessageKey)}</span>
    </span>
    {#if recipe.tags.length}
      <span class="card-tags">{recipe.tags.slice(0, 3).map((tag) => `#${tag}`).join(' ')}</span>
    {/if}
  </span>
</button>

<style>
  .recipe-card {
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: var(--space-4);
    align-items: center;
    width: 100%;
    padding: var(--space-3);
    text-align: left;
    background: var(--panel-bg);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
    color: inherit;
    transition: background-color var(--dur-hover);
  }
  .recipe-card:hover {
    background: var(--hover-bg);
  }
  .card-photo {
    width: 88px;
    height: 88px;
    border-radius: var(--radius);
    overflow: hidden;
  }
  .card-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-3);
    color: var(--text-dim);
  }
  .card-tags {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--accent-amber);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
