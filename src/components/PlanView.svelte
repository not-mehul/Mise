<script lang="ts">
  // The week planner: what you'll cook on each of the next seven days, and the
  // whole week's ingredients to the grocery list in one go.
  import { byDay, dayDate, planDays, type PlanEntry } from '../domain/plan';
  import { matchesSearch } from '../domain/recipe';
  import { locale, t } from '../i18n/index.svelte';
  import { library } from '../state/library.svelte';
  import { plan } from '../state/plan.svelte';
  import { ui } from '../state/ui.svelte';
  import AddGroceries from './AddGroceries.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import Sheet from './ui/Sheet.svelte';

  let week = $state(0);
  const start = $derived.by(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + week * 7);
  });
  const days = $derived(planDays(start, 7));
  const today = planDays(new Date(), 1)[0]!;
  const sections = $derived(byDay(plan.list, days));
  const inWeek = $derived(plan.list.filter((e) => days.includes(e.date) && library.get(e.recipeId)));
  const toList = $derived(inWeek.filter((e) => !e.listed && e.date >= today));
  const hasAny = $derived(plan.list.some((e) => library.get(e.recipeId)));

  let pickFor = $state<string | null>(null);
  let query = $state('');
  let adding = $state(false);
  const choices = $derived(library.recipes.filter((r) => !query.trim() || matchesSearch(r, query)).slice(0, 50));
  const sources = $derived(
    toList.map((e) => {
      const recipe = library.get(e.recipeId)!;
      return { recipe, factor: recipe.servings && e.servings ? e.servings / recipe.servings : 1 };
    }),
  );

  const label = (day: string) => {
    if (day === today) return t('plan.today');
    return dayDate(day).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });
  };

  async function pick(recipeId: string) {
    const day = pickFor;
    pickFor = null;
    query = '';
    if (day) await plan.add(recipeId, day, library.get(recipeId)?.servings ?? null);
  }

  async function remove(e: PlanEntry) {
    const title = library.get(e.recipeId)?.title ?? '';
    const undo = await plan.remove([e.id]);
    ui.notify(t('plan.removed', { title }), 'info', { label: t('action.undo'), run: () => void undo() });
  }

  function cook(e: PlanEntry) {
    const recipe = library.get(e.recipeId);
    if (!recipe) return;
    ui.show({ kind: 'cook', id: recipe.id, servings: e.servings ?? recipe.servings ?? 1, units: 'original' });
  }
</script>

<div id="viewPlan" role="tabpanel" aria-labelledby="tabPlan">
  <div class="section-head">
    <h2>{t('plan.label')}</h2>
    {#if toList.length}
      <button type="button" class="btn btn-secondary" id="btnPlanToList" onclick={() => (adding = true)}>{t('plan.toList', { count: toList.length })}</button>
    {/if}
  </div>
  <div class="week-nav" role="group" aria-label={t('plan.weeks')}>
    <button type="button" class="btn btn-muted" id="btnPrevWeek" disabled={week <= 0} onclick={() => (week -= 1)}>{t('plan.prevWeek')}</button>
    <span class="t-data-small">{label(days[0]!)} – {dayDate(days[6]!).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span>
    <button type="button" class="btn btn-muted" id="btnNextWeek" disabled={week >= 3} onclick={() => (week += 1)}>{t('plan.nextWeek')}</button>
  </div>

  {#if !library.recipes.length}
    <EmptyState title={t('plan.emptyTitle')} text={t('plan.emptyBody')}>
      {#snippet icon()}
        <!-- Lucide "calendar-days" -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg>
      {/snippet}
    </EmptyState>
  {:else}
    {#if !hasAny}<p class="t-hint intro">{t('plan.hint')}</p>{/if}
    <ol class="days" id="planWeek">
      {#each sections as section (section.day)}
        <li class="day" class:past={section.day < today}>
          <div class="day-head">
            <h3 class="t-section-label">{label(section.day)}</h3>
            <button type="button" class="btn btn-muted add" aria-label={t('plan.addTo', { day: label(section.day) })} onclick={() => (pickFor = section.day)}>+ {t('action.add')}</button>
          </div>
          {#each section.entries as e (e.id)}
            {@const recipe = library.get(e.recipeId)}
            {#if recipe}
              <div class="entry">
                <button type="button" class="entry-title" onclick={() => ui.openRecipe(recipe.id)}>{recipe.title}</button>
                {#if e.listed}<span class="chip chip-tag">{t('plan.listed')}</span>{/if}
                <button type="button" class="btn btn-muted" onclick={() => cook(e)}>{t('plan.cook')}</button>
                <button type="button" class="btn-icon" aria-label={t('plan.remove', { title: recipe.title })} onclick={() => remove(e)}>
                  <!-- Lucide "x" -->
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
            {/if}
          {/each}
        </li>
      {/each}
    </ol>
  {/if}
</div>

{#if pickFor}
  <Sheet title={t('plan.pickRecipe', { day: label(pickFor) })} onclose={() => (pickFor = null)}>
    <input class="input" type="search" id="planSearch" autocomplete="off" placeholder={t('recipes.search')} aria-label={t('recipes.search')} bind:value={query} />
    <ul class="choices">
      {#each choices as r (r.id)}
        <li><button type="button" class="choice" onclick={() => pick(r.id)}>{r.title}</button></li>
      {:else}
        <li class="t-hint">{t('recipes.noMatch')}</li>
      {/each}
    </ul>
  </Sheet>
{/if}

{#if adding}
  <AddGroceries {sources} units="original" onclose={() => (adding = false)} onadded={() => void plan.markListed(toList.map((e) => e.id))} />
{/if}

<style>
  .week-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .intro {
    margin-bottom: var(--space-4);
  }
  .days {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .day {
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border-faint);
  }
  .day.past {
    opacity: 0.7;
  }
  .day-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 48px;
  }
  .entry-title {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-family: var(--font-serif);
    font-size: 1.125rem;
    color: var(--text-heading);
    text-align: left;
    background: none;
    border: 0;
    padding: var(--space-2) 0;
    cursor: pointer;
  }
  .choices {
    list-style: none;
    margin-top: var(--space-4);
  }
  .choice {
    width: 100%;
    min-height: 48px;
    padding: var(--space-3) 0;
    font: inherit;
    color: var(--text-strong);
    text-align: left;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--border-faint);
    cursor: pointer;
  }
</style>
