<script lang="ts">
  import { simulation } from '$lib/stores/simulation.svelte';
  import { computeLingoClusters } from '../../engine/lingo-cloud';
  import type { LingoCluster } from '../../types/hud';

  let { camera }: { camera: { x: number; y: number; zoom: number } } = $props();

  let clusters: LingoCluster[] = $state([]);
  let lastUpdate = 0;

  /** Throttled cluster update (~500ms). Called from an effect. */
  $effect(() => {
    // Touch reactive deps so the effect re-fires on tick changes
    const _tick = simulation.tick;
    const _agents = simulation.agents;

    const now = performance.now();
    if (now - lastUpdate < 500) return;
    lastUpdate = now;

    clusters = computeLingoClusters(_agents.filter((a) => a.energy > 0), 10, 10);
  });

  /** Convert grid coords to screen pixel coords using the camera transform. */
  function gridToScreen(gx: number, gy: number): { sx: number; sy: number } {
    return {
      sx: gx * camera.zoom + camera.x,
      sy: gy * camera.zoom + camera.y,
    };
  }

  /** Scale font size by term frequency within 10–20px range. */
  function fontSize(count: number, maxCount: number): number {
    if (maxCount <= 1) return 12;
    const ratio = count / maxCount;
    return 10 + ratio * 10;
  }
</script>

<div class="lingo-overlay" id="lingo-cloud-overlay">
  {#each clusters as cluster (cluster.centroid.x + ',' + cluster.centroid.y)}
    {#if cluster.terms.length > 0}
      {@const pos = gridToScreen(cluster.centroid.x, cluster.centroid.y)}
      {@const maxCount = cluster.terms[0].count}
      <div
        class="lingo-cloud"
        style="left: {pos.sx}px; top: {pos.sy - 20}px;"
      >
        {#each cluster.terms.slice(0, 8) as term (term.term)}
          <span
            class="lingo-term"
            style="font-size: {fontSize(term.count, maxCount)}px; opacity: {0.5 + (term.count / maxCount) * 0.5};"
          >
            {term.term}
          </span>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .lingo-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 5;
  }

  .lingo-cloud {
    position: absolute;
    transform: translate(-50%, -100%);
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    justify-content: center;
    max-width: 200px;
    padding: 4px 8px;
    background: rgba(10, 10, 15, 0.55);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  :global(.light) .lingo-cloud {
    background: rgba(248, 248, 252, 0.65);
    border-color: rgba(0, 0, 0, 0.06);
  }

  .lingo-term {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
    white-space: nowrap;
    line-height: 1.2;
    letter-spacing: -0.3px;
  }
</style>
