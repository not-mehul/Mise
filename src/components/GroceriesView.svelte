<script lang="ts">
  import Icon from './ui/Icon.svelte';
  import { cheer } from '../lib/delight';
  // The grocery list: one running list by aisle, ticked off in the shop.
  import { Switch, play } from 'dusk-dawn';
  import { AISLES, byAisle, formatAmounts, isStaple, listToText, type Aisle, type GroceryItem } from '../domain/groceries';
  import { locale, t, type MessageKey } from '../i18n/index.svelte';
  import { keepAwake } from '../platform/device';
  import { shareText } from '../platform/share';
  import { groceries } from '../state/groceries.svelte';
  import { library } from '../state/library.svelte';
  import { settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import Sheet from './ui/Sheet.svelte';

  let typed = $state('');
  let editing = $state<string | null>(null);
  const sections = $derived(byAisle(groceries.list));
  const ticked = $derived(groceries.list.filter((g) => g.ticked));
  const item = $derived(editing ? groceries.list.find((g) => g.id === editing) : undefined);
  // History is kept de-duplicated, newest first.
  const suggestions = $derived(groceries.history.slice(0, 100));

  const aisleKey = (a: Aisle) => `aisle.${a}` as MessageKey;

  $effect(() => {
    if (!settings.current.listAwake || !groceries.list.length) return;
    void keepAwake(true);
    return () => void keepAwake(false);
  });

  async function addTyped(e: SubmitEvent) {
    e.preventDefault();
    const text = typed;
    if (!text.trim()) return;
    // Cleared first, so whatever is typed next isn't wiped when this lands.
    typed = '';
    await groceries.addTyped(text);
  }

  function from(g: GroceryItem): string {
    return g.recipeIds
      .map((id) => library.get(id)?.title)
      .filter(Boolean)
      .join(', ');
  }

  let editLine = $state('');
  let editNote = $state('');

  function openEdit(g: GroceryItem) {
    const amount = formatAmounts(g.amounts, locale());
    editLine = amount ? `${amount} ${g.item}` : g.item;
    editNote = g.note ?? '';
    editing = g.id;
  }

  async function saveEdit(id: string) {
    editing = null;
    await groceries.edit(id, editLine, editNote);
  }

  async function clearTicked() {
    const count = ticked.length;
    const undo = await groceries.remove(ticked.map((g) => g.id));
    ui.notify(t('groceries.cleared', { count }), 'info', { label: t('action.undo'), run: () => void undo() });
  }

  async function removeItem(g: GroceryItem) {
    editing = null;
    const undo = await groceries.remove([g.id]);
    ui.notify(t('groceries.removed', { item: g.item }), 'info', { label: t('action.undo'), run: () => void undo() });
  }

  async function share() {
    const text = listToText(groceries.list, t('groceries.label'), (a) => t(aisleKey(a)), locale());
    if ((await shareText(t('groceries.label'), text)) === 'copied') ui.notify(t('groceries.copied'), 'success');
  }

  // Ticking off the last thing on the list is worth a small cheer.
  async function tick(id: string, box: HTMLElement) {
    const wasLast = groceries.left === 1 && !groceries.list.find((g) => g.id === id)?.ticked;
    await groceries.toggle(id);
    play(box, 'pop');
    if (wasLast && groceries.left === 0) cheer(box, { count: 40, spread: 0.8 });
  }
</script>

<div id="viewGroceries" role="tabpanel" aria-labelledby="tabGroceries">
  {#if !groceries.list.length}
    <h2 class="visually-hidden">{t('groceries.label')}</h2>
  {:else}
    <div class="section-head">
      <h2>{t('groceries.label')}</h2>
      <button type="button" class="btn-icon" id="btnShareList" aria-label={t('recipe.share')} title={t('recipe.share')} disabled={!groceries.left} onclick={share}><Icon name="share" /></button>
    </div>
  {/if}

  <form class="add-row" onsubmit={addTyped}>
    <input
      class="input"
      id="groceryInput"
      list="grocerySuggestions"
      autocomplete="off"
      enterkeyhint="done"
      maxlength="200"
      placeholder={t('groceries.addPlaceholder')}
      aria-label={t('groceries.addLabel')}
      bind:value={typed}
    />
    <button type="submit" class="btn btn-secondary" id="btnAddGrocery" disabled={!typed.trim()}>{t('action.add')}</button>
    <datalist id="grocerySuggestions">
      {#each suggestions as s (s)}<option value={s}></option>{/each}
    </datalist>
  </form>

  {#if !groceries.list.length}
    <EmptyState title={t('groceries.emptyTitle')} text={t('groceries.emptyBody')}>
      {#snippet icon()}
        <!-- Lucide "shopping-basket" -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 11-1 9" />
          <path d="m19 11-4-7" />
          <path d="M2 11h20" />
          <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
          <path d="M4.5 15.5h15" />
          <path d="m5 11 4-7" />
          <path d="m9 11 1 9" />
        </svg>
      {/snippet}
    </EmptyState>
  {:else}
    <p class="t-hint left" id="groceryCount" aria-live="polite">{groceries.left ? t('groceries.left', { count: groceries.left }) : t('groceries.allTicked')}</p>
    {#each sections as section (section.aisle)}
      <section class="aisle" aria-labelledby="aisle-{section.aisle}">
        <h3 class="t-section-label" id="aisle-{section.aisle}">{t(aisleKey(section.aisle))}</h3>
        <ul class="items">
          {#each section.items as g (g.id)}
            {@const amount = formatAmounts(g.amounts, locale())}
            {@const source = from(g)}
            <li class="grocery" class:ticked={g.ticked} data-key={g.key}>
              <label class="tick">
                <input type="checkbox" class="check" checked={g.ticked} onchange={(e) => tick(g.id, e.currentTarget)} />
                <span class="text">
                  <span class="name">{#if amount}<span class="amount t-data">{`${amount} `}</span>{/if}{g.item}</span>
                  {#if g.note}<span class="from t-hint grocery-note">{g.note}</span>{/if}
                  {#if source}<span class="from t-hint">{source}</span>{/if}
                </span>
              </label>
              <button type="button" class="btn-icon" aria-label={t('groceries.edit', { item: g.item })} onclick={() => openEdit(g)}>
                <!-- Lucide "ellipsis" -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
    {#if ticked.length}
      <button type="button" class="btn btn-muted clear" id="btnClearTicked" onclick={clearTicked}>{t('groceries.clearTicked', { count: ticked.length })}</button>
    {/if}
  {/if}
</div>

{#if item}
  <Sheet title={item.item} onclose={() => (editing = null)}>
    <form
      class="edit-item"
      onsubmit={(e) => {
        e.preventDefault();
        void saveEdit(item.id);
      }}
    >
      <label class="field">
        <span class="t-field-label">{t('groceries.itemLabel')}</span>
        <input class="input" id="groceryEditLine" maxlength="200" autocomplete="off" enterkeyhint="done" bind:value={editLine} />
        <p class="field-hint">{t('groceries.itemHint')}</p>
      </label>
      <label class="field">
        <span class="t-field-label">{t('groceries.note')}</span>
        <input class="input" id="groceryEditNote" maxlength="200" autocomplete="off" enterkeyhint="done" placeholder={t('groceries.notePlaceholder')} bind:value={editNote} />
      </label>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary" id="btnSaveGrocery" disabled={!editLine.trim()}>{t('groceries.save')}</button>
      </div>
    </form>
    <div class="field">
      <span class="t-field-label" id="aisleLabel">{t('groceries.aisle')}</span>
      <div class="chip-row" role="radiogroup" aria-labelledby="aisleLabel">
        {#each AISLES as a (a)}
          <button type="button" class="chip" role="radio" aria-checked={item.aisle === a} onclick={() => groceries.move(item.id, a)}>{t(aisleKey(a))}</button>
        {/each}
      </div>
      <p class="field-hint">{t('groceries.aisleHint')}</p>
    </div>
    <Switch id="switchStaple" checked={isStaple(item.item, settings.current.staples)} label={t('groceries.staple')} hint={t('groceries.stapleHint')} onchange={(on) => groceries.setStaple(item.item, on)} />
    <div class="btn-row sheet-actions">
      <button type="button" class="btn btn-danger" id="btnRemoveGrocery" onclick={() => removeItem(item)}>{t('groceries.remove')}</button>
    </div>
  </Sheet>
{/if}

<style>
  .edit-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }
  .grocery-note {
    font-style: italic;
  }
  .add-row {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-5);
  }
  .left {
    margin-bottom: var(--space-4);
  }
  .aisle {
    margin-bottom: var(--space-5);
  }
  .aisle h3 {
    margin-bottom: var(--space-2);
  }
  .items {
    list-style: none;
  }
  .grocery {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border-bottom: 1px solid var(--border-faint);
  }
  .tick {
    flex: 1;
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    min-height: 52px;
    padding: var(--space-3) 0;
    cursor: pointer;
  }
  .tick input {
    margin-top: 0.2rem;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    color: var(--text-strong);
    font-size: 1.0625rem;
    line-height: 1.4;
    /* The strike is drawn, not set, so ticking an item crosses it off with a pen stroke. */
    background: linear-gradient(currentColor, currentColor) 0 58% / 0% 1.5px no-repeat;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    transition:
      background-size var(--spring-effects-slow-dur, 400ms) var(--spring-effects-slow, ease-out),
      color var(--dur-toggle, 200ms) var(--ease-standard, ease);
  }
  .amount {
    color: var(--accent-amber);
  }
  .from {
    margin: 0;
  }
  .ticked .name {
    color: var(--text-faint);
    background-size: 100% 1.5px;
  }
  .ticked .amount {
    color: inherit;
  }
  .clear {
    margin-top: var(--space-2);
  }
  .sheet-actions {
    margin-top: var(--space-5);
  }
</style>
