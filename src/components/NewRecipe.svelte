<script lang="ts">
  // "Where is the recipe?" Paste text, or write it by hand (style.md §8.7: one question at a time).
  import { emptyDraft } from '../domain/recipe';
  import { t } from '../i18n/index.svelte';
  import { parseRecipeText } from '../import/text';
  import { ui } from '../state/ui.svelte';
  import Sheet from './ui/Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let step = $state<'choose' | 'paste'>('choose');
  let text = $state('');
  let error = $state('');

  function read() {
    if (!text.trim()) {
      error = t('new.empty');
      return;
    }
    const { draft } = parseRecipeText(text);
    onclose();
    ui.edit(draft, 'check');
  }

  function write() {
    onclose();
    ui.edit(emptyDraft(), 'write');
  }
</script>

<Sheet title={t('recipes.new')} {onclose}>
  {#if step === 'choose'}
    <p class="t-section-label question">{t('new.question')}</p>
    <div class="choices">
      <button type="button" class="choice" id="choicePaste" onclick={() => (step = 'paste')}>
        <span class="t-card-title">{t('new.paste')}</span>
        <span class="t-hint">{t('new.pasteHint')}</span>
      </button>
      <button type="button" class="choice" id="choiceWrite" onclick={write}>
        <span class="t-card-title">{t('new.write')}</span>
        <span class="t-hint">{t('new.writeHint')}</span>
      </button>
    </div>
  {:else}
    <label class="field">
      <span class="t-field-label">{t('new.pasteLabel')}</span>
      <!-- svelte-ignore a11y_autofocus -->
      <textarea class="textarea" id="pasteText" rows="12" autofocus bind:value={text} oninput={() => (error = '')} aria-invalid={!!error}></textarea>
      {#if error}<p class="field-error">{error}</p>{:else}<p class="field-hint">{t('new.pasteHint')}</p>{/if}
    </label>
    <div class="btn-row actions">
      <button type="button" class="btn btn-muted" onclick={() => (step = 'choose')}>{t('action.back')}</button>
      <button type="button" class="btn btn-primary" id="btnRead" onclick={read}>{t('new.read')}</button>
    </div>
  {/if}
</Sheet>

<style>
  .question {
    margin-bottom: var(--space-4);
  }
  .choices {
    display: grid;
    gap: var(--space-3);
  }
  .choice {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    text-align: left;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel-bg-faint);
    color: inherit;
  }
  .choice:hover {
    background: var(--hover-bg);
  }
  .actions {
    margin-top: var(--space-5);
  }
</style>
