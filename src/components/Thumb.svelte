<script lang="ts">
  // A recipe's photo thumbnail, or a quiet placeholder.
  import { library } from '../state/library.svelte';

  let { photoId, alt = '' }: { photoId: string | null; alt?: string } = $props();
  let url = $state<string | null>(null);

  $effect(() => {
    const id = photoId;
    url = null;
    if (id) void library.thumbUrl(id).then((u) => (url = id === photoId ? u : url));
  });
</script>

<div class="thumb" class:empty={!url}>
  {#if url}
    <img src={url} {alt} loading="lazy" decoding="async" />
  {:else}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <!-- Lucide "utensils" -->
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  {/if}
</div>

<style>
  .thumb {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--panel-bg-faint);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb svg {
    width: 28px;
    height: 28px;
    color: var(--text-faint);
  }
</style>
