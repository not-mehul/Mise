<script lang="ts">
  // "Where is the recipe?" A link, photos, pasted text, or by hand (style.md §8.7: one question at a time).
  // Whatever it reads goes to the review screen; nothing is saved until Save recipe.
  import { onDestroy, untrack } from 'svelte';
  import { emptyDraft, type Recipe, type RecipeDraft } from '../domain/recipe';
  import { t, type MessageKey } from '../i18n/index.svelte';
  import { parseRecipeText } from '../import/text';
  import { findUrl, isOnlyUrl } from '../import/web';
  import { canReadPhotos } from '../platform/ocr';
  import { fromLink, fromPhotos, savedFrom } from '../state/importer';
  import { library } from '../state/library.svelte';
  import { ui } from '../state/ui.svelte';
  import Sheet from './ui/Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();

  type Step = 'choose' | 'link' | 'photos' | 'paste' | 'reading' | 'saved';
  let step = $state<Step>('choose');
  let url = $state('');
  let text = $state('');
  let photos = $state.raw<Blob[]>([]);
  let error = $state('');
  /** Why the paste step was opened from a link, if it was. */
  let pasteReason = $state<MessageKey | null>(null);
  /** The link the pasted text came from (an Instagram caption), kept as the source. */
  let pasteFrom = $state<string | null>(null);
  let saved = $state.raw<Recipe | null>(null);

  // Each read gets a number; a read that finishes after the sheet closed or another began is dropped.
  let run = 0;
  let open = true;
  onDestroy(() => {
    open = false;
  });

  // Something shared from another app, or a mise://import link.
  $effect(() => {
    const incoming = ui.incoming;
    if (!incoming) return;
    untrack(() => {
      ui.incoming = null;
      error = '';
      if (incoming.kind === 'link') {
        url = incoming.url;
        void readLink();
      } else if (incoming.kind === 'text') {
        text = incoming.text;
        pasteFrom = null;
        pasteReason = null;
        read();
      } else {
        photos = incoming.photos;
        void readPhotos();
      }
    });
  });

  /** Hands a draft to the review screen, unless the sheet moved on while it was read. */
  async function finish(ticket: number, draft: RecipeDraft) {
    if (!open || ticket !== run) {
      if (draft.photoId) await library.dropPhoto(draft.photoId);
      return;
    }
    onclose();
    ui.edit(draft, 'check');
  }

  async function readLink() {
    const link = findUrl(url.trim());
    if (!link) {
      step = 'link';
      error = t('new.linkInvalid');
      return;
    }
    url = link;
    const existing = savedFrom(link);
    if (existing) {
      saved = existing;
      step = 'saved';
      return;
    }
    await fetchLink(link);
  }

  async function fetchLink(link: string) {
    const ticket = ++run;
    step = 'reading';
    const result = await fromLink(link);
    if (!open || ticket !== run) {
      if (result.ok && result.draft.photoId) await library.dropPhoto(result.draft.photoId);
      return;
    }
    if (result.ok) return finish(ticket, result.draft);
    if (result.reason === 'offline') {
      step = 'link';
      error = t('new.linkOffline');
      return;
    }
    // Instagram kept the caption to itself, or the page holds no recipe: paste it instead.
    pasteReason = result.reason === 'instagram' ? 'new.instagramPaste' : 'new.linkNothing';
    pasteFrom = result.reason === 'instagram' ? result.url : null;
    text = '';
    step = 'paste';
  }

  function read() {
    if (!text.trim()) {
      step = 'paste';
      error = t('new.empty');
      return;
    }
    // Only a link in the box: fetch it.
    if (isOnlyUrl(text) && !pasteFrom) {
      url = text.trim();
      text = '';
      void readLink();
      return;
    }
    const { draft } = pasteFrom ? parseRecipeText(text, 'instagram', { url: pasteFrom }) : parseRecipeText(text);
    run++;
    onclose();
    ui.edit(draft, 'check');
  }

  async function readPhotos() {
    if (!canReadPhotos) {
      step = 'photos';
      return;
    }
    if (!photos.length) {
      step = 'photos';
      error = t('new.photosEmpty');
      return;
    }
    const ticket = ++run;
    step = 'reading';
    const result = await fromPhotos(photos);
    if (result.ok) return finish(ticket, result.draft);
    if (!open || ticket !== run) return;
    step = 'photos';
    error = t(result.reason === 'nothing' ? 'new.photosNothing' : 'new.photosFailed');
  }

  function pick(input: HTMLInputElement) {
    photos = [...photos, ...Array.from(input.files ?? [])].slice(0, 10);
    input.value = '';
    error = '';
  }

  function write() {
    onclose();
    ui.edit(emptyDraft(), 'write');
  }

  function go(next: Step) {
    error = '';
    if (next === 'paste') {
      pasteReason = null;
      pasteFrom = null;
    }
    step = next;
  }

  function openSaved() {
    if (!saved) return;
    onclose();
    ui.openRecipe(saved.id);
  }

  const choices: { id: string; step: Step; title: MessageKey; hint: MessageKey }[] = [
    { id: 'choiceLink', step: 'link', title: 'new.link', hint: 'new.linkHint' },
    { id: 'choicePhotos', step: 'photos', title: 'new.photos', hint: 'new.photosHint' },
    { id: 'choicePaste', step: 'paste', title: 'new.paste', hint: 'new.pasteHint' },
  ];
</script>

<Sheet title={t('recipes.new')} {onclose}>
  {#if step === 'choose'}
    <p class="t-section-label question">{t('new.question')}</p>
    <div class="choices">
      {#each choices as c (c.id)}
        <button type="button" class="choice" id={c.id} onclick={() => go(c.step)}>
          <span class="t-card-title">{t(c.title)}</span>
          <span class="t-hint">{t(c.hint)}</span>
        </button>
      {/each}
      <button type="button" class="choice" id="choiceWrite" onclick={write}>
        <span class="t-card-title">{t('new.write')}</span>
        <span class="t-hint">{t('new.writeHint')}</span>
      </button>
    </div>
  {:else if step === 'reading'}
    <div class="reading" role="status">
      <span class="dot" aria-hidden="true"></span>
      <p class="t-card-title">{t('new.reading')}</p>
      <p class="t-hint">{t('new.readingHint')}</p>
    </div>
    <div class="btn-row actions">
      <button type="button" class="btn btn-muted" id="btnStopReading" onclick={() => (run++, go('choose'))}>{t('action.cancel')}</button>
    </div>
  {:else if step === 'saved' && saved}
    <div class="notice" id="savedNotice">
      <div class="notice-text">
        <p class="notice-title">{t('new.alreadySaved', { title: saved.title })}</p>
        <p class="notice-detail">{t('new.alreadySavedHint')}</p>
      </div>
    </div>
    <div class="btn-row actions">
      <button type="button" class="btn btn-muted" id="btnImportAgain" onclick={() => void fetchLink(url)}>{t('new.importAgain')}</button>
      <button type="button" class="btn btn-primary" id="btnOpenSaved" onclick={openSaved}>{t('new.openSaved')}</button>
    </div>
  {:else if step === 'link'}
    <form
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        void readLink();
      }}
    >
      <label class="field">
        <span class="t-field-label">{t('new.linkLabel')}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" id="linkInput" type="url" inputmode="url" autocomplete="off" placeholder="https://" autofocus bind:value={url} oninput={() => (error = '')} aria-invalid={!!error} />
        {#if error}<p class="field-error">{error}</p>{:else}<p class="field-hint">{t('new.linkHint')}</p>{/if}
      </label>
      <div class="btn-row actions">
        <button type="button" class="btn btn-muted" onclick={() => go('choose')}>{t('action.back')}</button>
        <button type="submit" class="btn btn-primary" id="btnReadLink">{t('new.read')}</button>
      </div>
    </form>
  {:else if step === 'photos'}
    {#if canReadPhotos}
      <div class="field">
        <span class="t-field-label">{t('new.photosLabel')}</span>
        <label class="btn btn-muted pick">
          {photos.length ? t('new.photosMore') : t('new.photosPick')}
          <input class="visually-hidden" id="photoInput" type="file" accept="image/*" multiple onchange={(e) => pick(e.currentTarget)} />
        </label>
        {#if error}
          <p class="field-error">{error}</p>
        {:else}
          <p class="field-hint" id="photoCount">{photos.length ? t('new.photosCount', { count: photos.length }) : t('new.photosHint')}</p>
        {/if}
      </div>
      <div class="btn-row actions">
        <button type="button" class="btn btn-muted" onclick={() => ((photos = []), go('choose'))}>{t('action.back')}</button>
        <button type="button" class="btn btn-primary" id="btnReadPhotos" disabled={!photos.length} onclick={() => void readPhotos()}>{t('new.read')}</button>
      </div>
    {:else}
      <div class="notice" id="photosWebNotice">
        <div class="notice-text">
          <p class="notice-title">{t('new.photosAndroid')}</p>
          <p class="notice-detail">{t('new.photosAndroidHint')}</p>
        </div>
      </div>
      <div class="btn-row actions">
        <button type="button" class="btn btn-muted" onclick={() => go('choose')}>{t('action.back')}</button>
        <button type="button" class="btn btn-primary" onclick={() => go('paste')}>{t('new.paste')}</button>
      </div>
    {/if}
  {:else}
    {#if pasteReason}
      <div class="notice paste-reason" id="pasteReason">
        <div class="notice-text">
          <p class="notice-title">{t(pasteReason)}</p>
          {#if pasteFrom}<p class="notice-detail">{t('new.instagramPasteHint')}</p>{/if}
        </div>
      </div>
    {/if}
    <label class="field">
      <span class="t-field-label">{t('new.pasteLabel')}</span>
      <!-- svelte-ignore a11y_autofocus -->
      <textarea class="textarea" id="pasteText" rows="12" autofocus bind:value={text} oninput={() => (error = '')} aria-invalid={!!error}></textarea>
      {#if error}<p class="field-error">{error}</p>{:else}<p class="field-hint">{t('new.pasteHint')}</p>{/if}
    </label>
    <div class="btn-row actions">
      <button type="button" class="btn btn-muted" onclick={() => go('choose')}>{t('action.back')}</button>
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
  .paste-reason {
    margin-bottom: var(--space-4);
  }
  .pick {
    align-self: flex-start;
    position: relative;
  }
  .pick:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .reading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-6) 0;
    text-align: center;
  }
  .dot {
    width: 10px;
    height: 10px;
    margin-bottom: var(--space-2);
    border-radius: 50%;
    background: var(--accent-amber);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
      transform: scale(0.7);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
