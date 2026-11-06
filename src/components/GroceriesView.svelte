<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import EmptyState from './EmptyState.svelte';
</script>

<div id="viewGroceries" role="tabpanel" aria-labelledby="tabGroceries">
  <h2 class="visually-hidden">{t('groceries.label')}</h2>
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
</div>
