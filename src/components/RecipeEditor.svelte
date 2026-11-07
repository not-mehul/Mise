<script lang="ts">
  // One form for checking an import, writing a recipe and editing one (style.md §1: single forms for editing).
  import { onDestroy, untrack } from 'svelte';
  import { type RecipeDraft } from '../domain/recipe';
  import { t, type MessageKey } from '../i18n/index.svelte';
  import { processPhoto } from '../platform/images';
  import { library } from '../state/library.svelte';
  import { ui } from '../state/ui.svelte';
  import Thumb from './Thumb.svelte';

  let { draft: initial, mode, owned = [] }: { draft: RecipeDraft; mode: 'check' | 'edit' | 'write'; owned?: string[] } = $props();

  // A working copy; the screen's draft stays as it came in.
  const start = untrack(() => structuredClone($state.snapshot(initial) as RecipeDraft));
  let draft = $state<RecipeDraft>(structuredClone(start));
  let errors = $state<{ title?: string; content?: string }>({});
  let saving = $state(false);
  /**
   * Photos picked here, or brought in by an import, and not yet saved. They
   * are deleted again if the editor is left without saving, however it is left.
   */
  const picked: string[] = untrack(() => [...new Set([...owned, ...(mode === 'check' ? initial.photoIds : [])])]);
  let kept = false;
  onDestroy(() => {
    if (kept) return;
    const left = $state.snapshot(draft) as RecipeDraft;
    // An import, or anything typed, can come back: Undo reopens the editor as it was left.
    const worth = mode === 'check' || JSON.stringify(left) !== JSON.stringify(start);
    const photos = [...picked];
    const drop = () => {
      for (const id of photos) void library.dropPhoto(id);
    };
    if (!worth) return drop();
    ui.notify(t('editor.discarded'), 'info', { label: t('action.undo'), run: () => ui.edit(left, mode, photos), dismissed: drop });
  });
  const heading: Record<typeof mode, MessageKey> = { check: 'editor.check', edit: 'editor.edit', write: 'editor.write' };

  function sort(index: number, to: 'ingredients' | 'steps' | 'notes' | null) {
    const line = draft.unsorted[index]!;
    if (to) draft[to] = draft[to] ? `${draft[to].trimEnd()}\n${line}` : line;
    draft.unsorted = draft.unsorted.filter((_, i) => i !== index);
  }

  async function pickPhotos(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const file of files) {
      try {
        const { full, thumb } = await processPhoto(file);
        const id = await library.addPhoto(full, thumb);
        picked.push(id);
        draft.photoIds = [...draft.photoIds, id];
      } catch (err) {
        console.warn('Reading the photo failed:', err);
        ui.notify(t('editor.photoFailed'), 'error');
      }
    }
  }

  function makeCover(id: string) {
    draft.photoIds = [id, ...draft.photoIds.filter((p) => p !== id)];
  }

  function removePhoto(id: string) {
    draft.photoIds = draft.photoIds.filter((p) => p !== id);
  }

  function cancel() {
    ui.closeEditor();
  }

  async function save() {
    errors = {};
    if (!draft.title.trim()) errors.title = t('editor.needsName');
    if (!draft.ingredients.trim() && !draft.steps.trim()) errors.content = t('editor.needsContent');
    if (errors.title || errors.content) {
      document.getElementById(errors.title ? 'editTitle' : 'editIngredients')?.focus();
      return;
    }
    saving = true;
    try {
      const recipe = await library.save($state.snapshot(draft) as RecipeDraft);
      kept = true;
      for (const id of picked) if (!recipe.photoIds.includes(id)) await library.dropPhoto(id);
      ui.notify(t('editor.saved', { title: recipe.title }), 'success');
      ui.closeEditor(recipe.id);
    } catch (err) {
      console.error('Saving the recipe failed:', err);
      ui.notify(t('editor.saveFailed'), 'error');
    } finally {
      saving = false;
    }
  }
</script>

<form
  class="editor"
  id="recipeEditor"
  novalidate
  onsubmit={(e) => {
    e.preventDefault();
    void save();
  }}
>
  <div class="section-head">
    <h2>{t(heading[mode])}</h2>
  </div>
  {#if mode === 'check'}<p class="t-hint">{t('editor.checkHint')}</p>{/if}

  {#if draft.unsorted.length}
    <section class="notice unsorted" aria-labelledby="unsortedHead">
      <p class="notice-title" id="unsortedHead">{t('editor.unsorted')}</p>
      <p class="notice-detail">{t('editor.unsortedHint')}</p>
      <ul>
        {#each draft.unsorted as line, i (i + line)}
          <li>
            <p class="line">{line}</p>
            <div class="chip-row">
              <button type="button" class="chip" onclick={() => sort(i, 'ingredients')}>{t('editor.toIngredients')}</button>
              <button type="button" class="chip" onclick={() => sort(i, 'steps')}>{t('editor.toSteps')}</button>
              <button type="button" class="chip" onclick={() => sort(i, 'notes')}>{t('editor.toNotes')}</button>
              <button type="button" class="chip" onclick={() => sort(i, null)}>{t('editor.drop')}</button>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <label class="field">
    <span class="t-field-label">{t('editor.name')}</span>
    <input class="input" id="editTitle" enterkeyhint="next" autocomplete="off" maxlength="160" bind:value={draft.title} aria-invalid={!!errors.title} />
    {#if errors.title}<p class="field-error">{errors.title}</p>{/if}
  </label>

  <div class="numbers">
    <label class="field">
      <span class="t-field-label">{t('editor.servings')}</span>
      <input class="input" id="editServings" inputmode="numeric" enterkeyhint="next" bind:value={draft.servings} />
    </label>
    <label class="field">
      <span class="t-field-label">{t('editor.prep')}</span>
      <input class="input" id="editPrep" inputmode="numeric" enterkeyhint="next" bind:value={draft.prepMinutes} />
    </label>
    <label class="field">
      <span class="t-field-label">{t('editor.cook')}</span>
      <input class="input" id="editCook" inputmode="numeric" enterkeyhint="next" bind:value={draft.cookMinutes} />
    </label>
    <label class="field">
      <span class="t-field-label">{t('editor.total')}</span>
      <input class="input" id="editTotal" inputmode="numeric" enterkeyhint="next" bind:value={draft.totalMinutes} />
    </label>
  </div>

  <label class="field">
    <span class="t-field-label">{t('editor.ingredients')}</span>
    <textarea class="textarea" id="editIngredients" rows="8" bind:value={draft.ingredients} aria-invalid={!!errors.content}></textarea>
    {#if errors.content}<p class="field-error">{errors.content}</p>{:else}<p class="field-hint">{t('editor.ingredientsHint')}</p>{/if}
  </label>

  <label class="field">
    <span class="t-field-label">{t('editor.steps')}</span>
    <textarea class="textarea" id="editSteps" rows="8" bind:value={draft.steps}></textarea>
    <p class="field-hint">{t('editor.stepsHint')}</p>
  </label>

  <label class="field">
    <span class="t-field-label">{t('editor.tags')}</span>
    <input class="input" id="editTags" enterkeyhint="next" autocomplete="off" bind:value={draft.tags} />
    <p class="field-hint">{t('editor.tagsHint')}</p>
  </label>

  <label class="field">
    <span class="t-field-label">{t('editor.notes')}</span>
    <textarea class="textarea" id="editNotes" rows="3" bind:value={draft.notes}></textarea>
  </label>

  <div class="field">
    <span class="t-field-label">{t('editor.photos')}</span>
    {#if draft.photoIds.length}
      <ul class="photo-list" id="editPhotos">
        {#each draft.photoIds as id, i (id)}
          <li class="photo-item">
            <span class="photo"><Thumb photoId={id} /></span>
            {#if i === 0}
              <span class="chip chip-tag">{t('editor.cover')}</span>
            {:else}
              <button type="button" class="btn btn-muted" onclick={() => makeCover(id)}>{t('editor.makeCover')}</button>
            {/if}
            <button type="button" class="btn btn-muted" aria-label={t('editor.removePhotoN', { n: i + 1 })} onclick={() => removePhoto(id)}>{t('editor.removePhoto')}</button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="photo-row">
      <label class="btn btn-muted file-btn">
        {draft.photoIds.length ? t('editor.morePhotos') : t('editor.addPhoto')}
        <input type="file" class="visually-hidden" id="editPhoto" accept="image/*" multiple onchange={(e) => void pickPhotos(e.currentTarget)} />
      </label>
    </div>
  </div>

  {#if draft.source.text && mode !== 'write'}
    <details class="original">
      <summary class="t-field-label">{t('recipe.original')}</summary>
      <pre>{draft.source.text}</pre>
    </details>
  {/if}

  <div class="btn-row">
    <button type="button" class="btn btn-muted" onclick={cancel}>{t('action.cancel')}</button>
    <button type="submit" class="btn btn-primary" id="btnSaveRecipe" disabled={saving}>{t('editor.save')}</button>
  </div>
</form>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .section-head {
    margin-bottom: 0;
  }
  .numbers {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
  }
  @media (min-width: 640px) {
    .numbers {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .textarea {
    line-height: 1.55;
    resize: vertical;
  }
  .unsorted {
    flex-direction: column;
  }
  .unsorted ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }
  .unsorted .line {
    color: var(--text-strong);
    margin-bottom: var(--space-2);
  }
  .photo-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  .photo-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .photo-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .photo {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: var(--radius);
    overflow: hidden;
  }
  .file-btn {
    position: relative;
    cursor: pointer;
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
