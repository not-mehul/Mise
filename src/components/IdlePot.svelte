<script lang="ts">
  // Mise's idle toy: a bowl of soup, still steaming. Stir it for a kitchen
  // whisper; stir it ten times and the soup is on (an easter egg).
  import { play } from 'dusk-dawn';
  import { cheer, hatch } from '../lib/delight';
  import { t, type MessageKey } from '../i18n/index.svelte';

  const TIPS: MessageKey[] = ['idle.tip1', 'idle.tip2', 'idle.tip3', 'idle.tip4', 'idle.tip5', 'idle.tip6'];
  const READY = 10;

  let stirs = $state(0);
  let stirring = $state(false);
  let toy = $state<HTMLButtonElement>();
  let settle: ReturnType<typeof setTimeout> | undefined;
  const line = $derived(stirs === 0 ? t('idle.hint') : stirs >= READY ? t('egg.pot') : t(TIPS[(stirs - 1) % TIPS.length] ?? 'idle.hint'));

  function stir() {
    stirs += 1;
    // Restart the stir even mid-swing.
    stirring = false;
    requestAnimationFrame(() => (stirring = true));
    clearTimeout(settle);
    settle = setTimeout(() => (stirring = false), 1200);
    if (stirs === READY) {
      play(toy, 'jelly');
      cheer(toy, { count: 36, spread: 0.6 });
      hatch('pot', t('egg.pot'));
    }
  }
</script>

<button type="button" class="idle-toy" class:is-fresh={stirs === 0} class:is-stirring={stirring} bind:this={toy} aria-label={t('idle.stir')} onclick={stir}>
  <!-- Lucide "soup" -->
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g class="bowl">
      <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
      <path d="M7 21h10" />
    </g>
    <path class="spoon" d="M19.5 12 22 6" />
    <g class="wisps">
      <path class="steam" pathLength="1" d="M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62" />
      <path class="steam" pathLength="1" d="M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62" />
      <path class="steam" pathLength="1" d="M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62" />
    </g>
  </svg>
</button>
<p class="idle-line" aria-live="polite">{line}</p>

<style>
  .bowl,
  .spoon,
  .steam {
    transform-box: view-box;
  }
  .bowl {
    transform-origin: 12px 21px;
  }
  .spoon {
    transform-origin: 19.5px 12px;
  }
  .steam {
    stroke-dasharray: 1;
  }
  @media (prefers-reduced-motion: no-preference) {
    /* Arriving, the steam draws itself in, one wisp after another. */
    .is-fresh .steam {
      animation: steam-in 900ms var(--ease-standard) both;
    }
    .steam:nth-child(2) {
      animation-delay: 100ms;
    }
    .steam:nth-child(3) {
      animation-delay: 200ms;
    }
    /* Stirring: the spoon swings, the bowl settles, the steam lifts and comes back. */
    .is-stirring .spoon {
      animation: stir 640ms var(--ease-standard);
    }
    .is-stirring .bowl {
      animation: settle 640ms var(--ease-standard);
    }
    .is-stirring .steam {
      animation: steam-lift 900ms var(--ease-standard) both;
    }
  }
  @keyframes steam-in {
    from {
      stroke-dashoffset: 1;
      opacity: 0;
    }
  }
  @keyframes steam-lift {
    45% {
      opacity: 0;
      transform: translateY(-3px);
    }
    55% {
      opacity: 0;
      transform: translateY(1.5px);
    }
  }
  @keyframes stir {
    30% {
      transform: rotate(-24deg);
    }
    65% {
      transform: rotate(12deg);
    }
  }
  @keyframes settle {
    35% {
      transform: scale(1.04, 0.94);
    }
    70% {
      transform: scale(0.98, 1.02);
    }
  }
</style>
