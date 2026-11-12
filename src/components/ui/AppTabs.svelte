<script lang="ts" generics="V extends string">
  // The tab rail (style.md §8.5) with an icon over each word, and the four
  // tabs sharing the width evenly so none is pushed off the edge, even with
  // the phone's text size turned up. Same keyboard and ARIA as TabRail.
  import { tick } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  interface Tab {
    id: V;
    label: string;
    icon: IconName;
    badge?: number;
    domId?: string;
    controls?: string;
  }

  let { tabs, value, label, onselect }: { tabs: readonly Tab[]; value: V; label: string; onselect: (id: V) => void } = $props();
  let rail: HTMLDivElement;
  let ruleX = $state(0);
  let ruleWidth = $state(0);

  function place() {
    const active = rail?.querySelector<HTMLElement>('[aria-selected="true"]');
    // A short rule centred under the icon, not the whole quarter.
    const w = active ? Math.min(active.offsetWidth, 56) : 0;
    ruleX = active ? active.offsetLeft + (active.offsetWidth - w) / 2 : 0;
    ruleWidth = w;
  }

  $effect(() => {
    void value;
    void tabs;
    void tick().then(place);
  });
  $effect(() => {
    const observer = new ResizeObserver(() => place());
    observer.observe(rail);
    return () => observer.disconnect();
  });

  function onkeydown(event: KeyboardEvent) {
    const i = Math.max(0, tabs.findIndex((t) => t.id === value));
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const tab = tabs[(i + step + tabs.length) % tabs.length];
    if (!tab) return;
    onselect(tab.id);
    void tick().then(() => rail.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  }
</script>

<div class="icon-tabs" role="tablist" aria-label={label} tabindex="-1" bind:this={rail} style:--rule-x="{ruleX}px" style:--rule-width="{ruleWidth}px" {onkeydown}>
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      role="tab"
      id={tab.domId}
      aria-controls={tab.controls}
      aria-selected={tab.id === value}
      tabindex={tab.id === value ? 0 : -1}
      onclick={() => onselect(tab.id)}
    >
      <span class="glyph">
        <Icon name={tab.icon} size={22} />
        {#if tab.badge}<span class="badge">{tab.badge > 99 ? '99+' : tab.badge}</span>{/if}
      </span>
      <span class="word">{tab.label}</span>
    </button>
  {/each}
  <span class="tab-rule" aria-hidden="true"></span>
</div>

<style>
  .icon-tabs {
    position: relative;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    border-bottom: 1px solid var(--border-soft);
  }
  [role='tab'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-width: 0;
    min-height: 56px;
    padding: var(--space-2) var(--space-1) var(--space-3);
    background: none;
    border: 0;
    color: var(--text-dim);
    cursor: pointer;
    transition: color var(--dur-hover);
  }
  [role='tab']:hover,
  [role='tab'][aria-selected='true'] {
    color: var(--text-heading);
  }
  [role='tab'][aria-selected='true'] .glyph {
    color: var(--accent-amber);
  }
  [role='tab']:focus-visible {
    outline-offset: -2px;
  }
  .glyph {
    position: relative;
    display: inline-flex;
    transition: color var(--dur-hover);
  }
  .word {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .badge {
    position: absolute;
    top: -6px;
    left: calc(100% - 8px);
    margin: 0;
    background: var(--accent-bright);
    color: var(--on-accent);
  }
  .tab-rule {
    position: absolute;
    left: 0;
    bottom: -1px;
    height: 3px;
    width: var(--rule-width, 0);
    transform: translateX(var(--rule-x, 0));
    border-radius: 3px 3px 0 0;
    background: var(--accent-amber);
    pointer-events: none;
    transition:
      transform var(--spring-spatial-fast-dur) var(--spring-spatial-fast),
      width var(--spring-spatial-default-dur) var(--spring-spatial-default);
  }
</style>
