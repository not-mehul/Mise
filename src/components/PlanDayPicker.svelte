<script lang="ts">
  // "Plan it": puts a recipe on one of the next fourteen days.
  import { dayDate, planDays } from '../domain/plan';
  import type { Recipe } from '../domain/recipe';
  import { locale, t } from '../i18n/index.svelte';
  import { plan } from '../state/plan.svelte';
  import { ui } from '../state/ui.svelte';
  import Sheet from './ui/Sheet.svelte';

  let { recipe, servings, onclose }: { recipe: Recipe; servings: number | null; onclose: () => void } = $props();
  const days = planDays(new Date(), 14);
  const label = (day: string) => dayDate(day).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });

  async function pick(day: string) {
    const entry = await plan.add(recipe.id, day, servings);
    onclose();
    ui.notify(t('plan.added', { title: recipe.title, day: label(day) }), 'success', {
      label: t('action.undo'),
      run: () => void plan.remove([entry.id]),
    });
  }
</script>

<Sheet title={t('plan.pickDay')} {onclose}>
  <ul class="days" id="planDays">
    {#each days as day, i (day)}
      {@const count = plan.list.filter((e) => e.date === day).length}
      <li>
        <button type="button" class="day" onclick={() => pick(day)}>
          <span>{i === 0 ? t('plan.today') : i === 1 ? t('plan.tomorrow') : label(day)}</span>
          {#if count}<span class="t-hint">{t('plan.planned', { count })}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .days {
    list-style: none;
  }
  .day {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 52px;
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
