<script lang="ts">
  // The ingredient list as rows of two boxes, amount and ingredient, so a
  // quantity always has its own place. "As text" shows the same list as one
  // box for pasting. Either way the recipe keeps it as lines of text.
  import { joinAmount, splitAmount } from '../domain/ingredient';
  import { t } from '../i18n/index.svelte';
  import Icon from './ui/Icon.svelte';

  let { value = $bindable(), invalid = false }: { value: string; invalid?: boolean } = $props();

  interface Row {
    key: number;
    amount: string;
    name: string;
    /** A group heading, "For the sauce:". */
    heading: boolean;
    /** The line it came from, kept word for word while the row is untouched. */
    line: string;
  }

  const HEADING = /^(.{1,60}?):\s*$/;
  let next = 0;
  let mode = $state<'rows' | 'text'>('rows');
  let rows = $state<Row[]>([]);
  /** The text the rows were last read from or written to. */
  let synced = '';

  function toRow(line: string): Row {
    const heading = HEADING.exec(line.trim());
    if (heading && !/\d/.test(heading[1]!)) return { key: next++, amount: '', name: heading[1]!.trim(), heading: true, line };
    const { amount, name } = splitAmount(line);
    return { key: next++, amount, name, heading: false, line };
  }

  function rowLine(row: Row): string {
    if (row.heading) return row.name.trim() ? `${row.name.trim()}:` : '';
    const split = splitAmount(row.line);
    if (row.line && split.amount === row.amount && split.name === row.name) return row.line.trim();
    return joinAmount(row.amount, row.name);
  }

  // Read the rows again whenever the text changes from outside them
  // (an unsorted line sorted in, or the text box).
  $effect.pre(() => {
    if (value === synced) return;
    synced = value;
    rows = value
      .split('\n')
      .filter((l) => l.trim())
      .map(toRow);
  });

  function write() {
    synced = rows
      .map(rowLine)
      .filter(Boolean)
      .join('\n');
    value = synced;
  }

  async function add(heading = false) {
    rows.push({ key: next++, amount: '', name: '', heading, line: '' });
    const key = rows.at(-1)!.key;
    await Promise.resolve();
    document.getElementById(heading ? `ingName${key}` : `ingAmount${key}`)?.focus();
  }

  function remove(index: number) {
    rows.splice(index, 1);
    write();
  }
</script>

<div class="field ingredients-field">
  <div class="head">
    <span class="t-field-label" id="ingredientsLabel">{t('editor.ingredients')}</span>
    <div class="segmented small" role="radiogroup" aria-label={t('editor.ingredientsView')}>
      <button type="button" role="radio" id="ingModeRows" aria-checked={mode === 'rows'} onclick={() => (mode = 'rows')}>{t('editor.asList')}</button>
      <button type="button" role="radio" id="ingModeText" aria-checked={mode === 'text'} onclick={() => (mode = 'text')}>{t('editor.asText')}</button>
    </div>
  </div>

  {#if mode === 'rows'}
    {#if rows.length}
      <div class="cols t-field-label" aria-hidden="true"><span>{t('editor.amount')}</span><span>{t('editor.ingredient')}</span></div>
    {/if}
    <ul class="rows" id="ingredientRows" aria-labelledby="ingredientsLabel">
      {#each rows as row, i (row.key)}
        <li class:heading={row.heading}>
          {#if row.heading}
            <input class="input group" id="ingName{row.key}" aria-label={t('editor.groupName')} placeholder={t('editor.groupPlaceholder')} autocomplete="off" bind:value={row.name} oninput={write} />
          {:else}
            <input class="input amount" id="ingAmount{row.key}" aria-label={t('editor.amountOf', { n: i + 1 })} placeholder={row.line ? '' : '200 g'} autocomplete="off" enterkeyhint="next" bind:value={row.amount} oninput={write} />
            <input class="input name" id="ingName{row.key}" aria-label={t('editor.ingredientN', { n: i + 1 })} placeholder={t('editor.ingredientPlaceholder')} autocomplete="off" enterkeyhint="next" bind:value={row.name} oninput={write} />
          {/if}
          <button type="button" class="btn-icon" aria-label={t('editor.removeIngredient', { n: i + 1 })} onclick={() => remove(i)}><Icon name="close" size={18} /></button>
        </li>
      {/each}
    </ul>
    <div class="adders">
      <button type="button" class="btn btn-muted" id="btnAddIngredient" onclick={() => add()}><Icon name="plus" size={16} />{t('editor.addIngredient')}</button>
      <button type="button" class="btn btn-muted" id="btnAddGroup" onclick={() => add(true)}><Icon name="plus" size={16} />{t('editor.addGroup')}</button>
    </div>
  {:else}
    <textarea class="textarea" id="editIngredients" rows="8" aria-labelledby="ingredientsLabel" bind:value aria-invalid={invalid}></textarea>
    <p class="field-hint">{t('editor.ingredientsHint')}</p>
  {/if}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .segmented.small button {
    min-height: 36px;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(5.5rem, 30%) 1fr 44px;
    gap: var(--space-2);
    font-size: 0.625rem;
  }
  .rows {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .rows li {
    display: grid;
    grid-template-columns: minmax(5.5rem, 30%) 1fr 44px;
    gap: var(--space-2);
    align-items: center;
  }
  .rows li.heading {
    grid-template-columns: 1fr 44px;
    margin-top: var(--space-2);
  }
  .input.amount {
    font-family: var(--font-mono);
    color: var(--accent-amber);
  }
  .input.group {
    font-family: var(--font-serif);
    font-style: italic;
  }
  .input {
    min-width: 0;
  }
  .adders {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .adders .btn {
    padding: 0 var(--space-3);
    white-space: normal;
    text-align: center;
    letter-spacing: 0.1em;
  }
</style>
