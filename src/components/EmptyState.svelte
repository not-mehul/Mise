<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, text, icon }: { title: string; text: string; icon: Snippet } = $props();
</script>

<!-- "Nothing here yet" (style.md §8.14). -->
<div class="empty-state">
  {@render icon()}
  <p class="empty-title">{title}</p>
  <p class="empty-text">{text}</p>
</div>
