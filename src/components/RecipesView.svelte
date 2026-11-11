<script lang="ts">
  import Icon from './ui/Icon.svelte';
  import { matchesSearch, totalTime, type Recipe } from '../domain/recipe';
  import { locale, t } from '../i18n/index.svelte';
  import { cookAgain, cookableWith, haveKeys, sortByLog, type LogSort } from '../domain/pantry';
  import { library } from '../state/library.svelte';
  import { settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import NewRecipe from './NewRecipe.svelte';
  import RecipeCard from './RecipeCard.svelte';
  import RecipeEditor from './RecipeEditor.svelte';
  import RecipePage from './RecipePage.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import { LoadingIndicator } from 'dusk-dawn';
  import { hatch } from '../lib/delight';

  type Sort = 'recent' | 'name' | 'time' | LogSort;
  let query = $state('');
  let collection = $state<string>('');
  let sort = $state<Sort>('recent');

  const shown = $derived.by(() => {
    let list = library.recipes.filter((r) => (!collection || r.collectionIds.includes(collection)) && (!query.trim() || matchesSearch(r, query)));
    const collator = new Intl.Collator(locale());
    if (sort === 'name') list = [...list].sort((a, b) => collator.compare(a.title, b.title));
    if (sort === 'time') list = [...list].sort((a, b) => (totalTime(a) ?? 1e9) - (totalTime(b) ?? 1e9));
    if (sort === 'rating' || sort === 'cooked' || sort === 'stale') list = sortByLog(list, sort);
    return list;
  });
  // "What can I cook?": recipes ranked by how few things you'd still need.
  let pantryOpen = $state(false);
  let haveText = $state('');
  const have = $derived(haveKeys(haveText));
  const cookable = $derived(cookableWith(library.recipes, have, settings.current.staples));
  const again = $derived(!query.trim() && !collection && sort === 'recent' && !pantryOpen ? cookAgain(library.recipes) : []);
  const recipe = $derived(ui.screen.kind === 'recipe' ? library.get(ui.screen.id) : undefined);

  // An easter egg: call to the pass, and the kitchen answers.
  let heard = false;
  $effect(() => {
    const said = /^\s*yes,?\s+chef\.?\s*$/i.test(query);
    if (said && !heard) hatch('chef', t('egg.chef'));
    heard = said;
  });

  // A collection that was deleted stops filtering.
  $effect(() => {
    if (collection && !library.collections.some((c) => c.id === collection)) collection = '';
  });

  function open(r: Recipe) {
    ui.openRecipe(r.id);
  }
</script>

<div id="viewRecipes" role="tabpanel" aria-labelledby="tabRecipes">
  {#if ui.screen.kind === 'editor'}
    {#key ui.screen.draft}
      <RecipeEditor draft={ui.screen.draft} mode={ui.screen.mode} owned={ui.screen.owned} />
    {/key}
  {:else if ui.screen.kind === 'recipe' && recipe}
    {#key recipe.id}
      <RecipePage {recipe} />
    {/key}
  {:else if library.status === 'loading'}
    <div class="loading"><LoadingIndicator label={t('status.loading')} /></div>
  {:else if library.status === 'failed'}
    <p class="field-error" role="alert">{t('status.failed')}</p>
  {:else if !library.recipes.length}
    <h2 class="visually-hidden">{t('recipes.label')}</h2>
    <EmptyState title={t('recipes.emptyTitle')} text={t('recipes.emptyBody')}>
      {#snippet icon()}
        <!-- Lucide "chef-hat" -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
          <path d="M6 17h12" />
        </svg>
      {/snippet}
      <button type="button" class="btn btn-primary" id="btnNewRecipe" onclick={() => (ui.newOpen = true)}>{t('recipes.new')}</button>
    </EmptyState>
  {:else}
    <div class="section-head">
      <h2>{t('recipes.label')}</h2>
      <button type="button" class="btn btn-primary" id="btnNewRecipe" onclick={() => (ui.newOpen = true)}><Icon name="plus" size={16} />{t('recipes.new')}</button>
    </div>

    <div class="list-tools">
      <input
        class="input"
        type="search"
        id="recipeSearch"
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        placeholder={t('recipes.search')}
        aria-label={t('recipes.search')}
        bind:value={query}
      />
      <div class="tool-row">
        {#if library.collections.length}
          <div class="chip-row" role="radiogroup" aria-label={t('recipes.filter')}>
            <button type="button" class="chip" role="radio" aria-checked={!collection} onclick={() => (collection = '')}>{t('recipes.all')}</button>
            {#each library.collections as c (c.id)}
              <button type="button" class="chip" role="radio" aria-checked={collection === c.id} onclick={() => (collection = c.id)}>{c.name}</button>
            {/each}
          </div>
        {/if}
        <label class="sort">
          <span class="t-field-label">{t('recipes.sort')}</span>
          <select class="select" id="recipeSort" bind:value={sort}>
            <option value="recent">{t('recipes.sortRecent')}</option>
            <option value="name">{t('recipes.sortName')}</option>
            <option value="time">{t('recipes.sortTime')}</option>
            <option value="rating">{t('recipes.sortRating')}</option>
            <option value="cooked">{t('recipes.sortCooked')}</option>
            <option value="stale">{t('recipes.sortStale')}</option>
          </select>
        </label>
      </div>
    </div>

    <div class="pantry">
      <button type="button" class="btn btn-muted" id="btnWhatCanICook" aria-expanded={pantryOpen} onclick={() => (pantryOpen = !pantryOpen)}>{t('pantry.open')}</button>
      {#if pantryOpen}
        <label class="field">
          <span class="t-field-label">{t('pantry.have')}</span>
          <input class="input" id="pantryInput" autocomplete="off" enterkeyhint="search" placeholder={t('pantry.placeholder')} bind:value={haveText} />
          <p class="field-hint">{t('pantry.hint')}</p>
        </label>
      {/if}
    </div>

    {#if again.length}
      <section class="again" aria-labelledby="againHead">
        <h3 class="t-section-label" id="againHead">{t('recipes.cookAgain')}</h3>
        <div class="chip-row">
          {#each again as r (r.id)}<button type="button" class="chip" onclick={() => open(r)}>{r.title}</button>{/each}
        </div>
      </section>
    {/if}

    {#if pantryOpen && have.length}
      {#if cookable.length}
        <ul class="recipe-list dd-stagger" id="cookableList">
          {#each cookable as c (c.recipe.id)}
            <li>
              <RecipeCard recipe={c.recipe} onopen={() => open(c.recipe)} />
              <p class="t-hint missing">{c.missing.length ? t('pantry.missing', { count: c.missing.length, items: c.missing.slice(0, 4).join(', ') }) : t('pantry.all')}</p>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="t-hint">{t('pantry.none')}</p>
      {/if}
    {:else if shown.length}
      <ul class="recipe-list dd-stagger" id="recipeList">
        {#each shown as r (r.id)}
          <li><RecipeCard recipe={r} onopen={() => open(r)} /></li>
        {/each}
      </ul>
    {:else}
      <div class="empty-match">
        <p class="empty-title">{t('recipes.noMatch')}</p>
        <p class="empty-text">{t('recipes.noMatchHint')}</p>
        <button type="button" class="btn btn-muted" onclick={() => ((query = ''), (collection = ''))}>{t('recipes.clear')}</button>
      </div>
    {/if}
  {/if}
</div>

{#if ui.newOpen}
  <NewRecipe onclose={() => (ui.newOpen = false)} />
{/if}

<style>
  .loading {
    display: flex;
    justify-content: center;
    padding: var(--space-6) 0;
  }
  .list-tools {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }
  .tool-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  .sort {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-left: auto;
  }
  .sort .select {
    width: auto;
  }
  .pantry {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .pantry .field {
    width: 100%;
  }
  .again {
    margin-bottom: var(--space-5);
  }
  .again h3 {
    margin-bottom: var(--space-2);
  }
  .missing {
    margin-top: var(--space-1);
  }
  .recipe-list {
    list-style: none;
    display: grid;
    gap: var(--space-3);
  }
  @media (min-width: 640px) {
    .pantry {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .pantry .field {
    width: 100%;
  }
  .again {
    margin-bottom: var(--space-5);
  }
  .again h3 {
    margin-bottom: var(--space-2);
  }
  .missing {
    margin-top: var(--space-1);
  }
  .recipe-list {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
