<script lang="ts">
  // A settings switch: the whole row is the target (style.md §8.17, §14).
  // From Rosetta; a candidate for dusk-dawn.
  interface Props {
    checked: boolean;
    label: string;
    hint?: string;
    id?: string;
    onchange: (checked: boolean) => void;
  }

  let { checked, label, hint, id, onchange }: Props = $props();
</script>

<button type="button" class="switch-row" role="switch" aria-checked={checked} {id} onclick={() => onchange(!checked)}>
  <span class="switch-text">
    <span class="switch-label">{label}</span>
    {#if hint}<span class="field-hint">{hint}</span>{/if}
  </span>
  <span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
</button>

<style>
  .switch-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    min-height: 56px;
    padding: var(--space-3) 0;
    font: inherit;
    text-align: left;
    color: inherit;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--border-faint);
    cursor: pointer;
  }
  .switch-row:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .switch-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .switch-label {
    color: var(--text-heading);
    font-size: 0.9375rem;
  }
  .switch-track {
    position: relative;
    flex-shrink: 0;
    width: 44px;
    height: 26px;
    border-radius: 13px;
    background: var(--chart-track);
    border: 1px solid var(--border);
    transition: background-color var(--dur-toggle);
  }
  .switch-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-round);
    background: var(--text-dim);
    transition:
      transform var(--dur-toggle) var(--ease-settle),
      background-color var(--dur-toggle);
  }
  .switch-row[aria-checked='true'] .switch-track {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
  }
  .switch-row[aria-checked='true'] .switch-knob {
    transform: translateX(18px);
    background: var(--on-accent);
  }
</style>
