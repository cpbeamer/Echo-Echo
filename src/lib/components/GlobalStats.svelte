<script lang="ts">
  import { simulation } from '$lib/stores/simulation.svelte';
  import { FACTION_META } from '../../engine/factions';
  import type { Faction } from '../../types';

  /**
   * Build SVG pie chart path data from faction counts.
   * Returns an array of { path, color } for each slice.
   */
  function pieSlices(): { path: string; color: string; faction: string; count: number }[] {
    const counts = simulation.factionCounts;
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    if (total === 0) return [];

    const entries = Object.entries(counts).filter(([, c]) => c > 0);
    const slices: { path: string; color: string; faction: string; count: number }[] = [];
    const cx = 14;
    const cy = 14;
    const r = 12;
    let startAngle = -Math.PI / 2;

    for (const [faction, count] of entries) {
      const angle = (count / total) * Math.PI * 2;
      const endAngle = startAngle + angle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      const largeArc = angle > Math.PI ? 1 : 0;
      const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;

      const meta = FACTION_META[faction as Faction];
      slices.push({
        path,
        color: meta?.color ?? '#6b7280',
        faction,
        count,
      });

      startAngle = endAngle;
    }

    return slices;
  }

  function peacePercent(): string {
    return (simulation.averagePeaceScore * 100).toFixed(0);
  }

  const slices = $derived(pieSlices());
</script>

<div class="global-stats" id="global-stats-bar">
  <!-- Agent Count -->
  <div class="stat-item">
    <span class="stat-label">Agents</span>
    <span class="stat-value">{simulation.aliveAgents.length}</span>
  </div>

  <!-- Faction Pie Chart -->
  <div class="stat-item pie-container">
    <span class="stat-label">Factions</span>
    <svg width="28" height="28" viewBox="0 0 28 28" class="pie-chart">
      {#each slices as slice (slice.faction)}
        <path d={slice.path} fill={slice.color} stroke="var(--bg-secondary)" stroke-width="0.5">
          <title>{FACTION_META[slice.faction as Faction]?.label ?? slice.faction}: {slice.count}</title>
        </path>
      {/each}
      {#if slices.length === 0}
        <circle cx="14" cy="14" r="12" fill="var(--text-muted)" opacity="0.2" />
      {/if}
    </svg>
  </div>

  <!-- Peace Score -->
  <div class="stat-item peace-stat">
    <span class="stat-label">Peace</span>
    <div class="peace-bar-container">
      <div
        class="peace-bar-fill"
        style="width: {peacePercent()}%;"
      ></div>
    </div>
    <span class="stat-value peace-value">{peacePercent()}%</span>
  </div>

  <!-- Brain Queue -->
  <div class="stat-item">
    <span class="stat-label">Brain</span>
    <span class="stat-value brain-value">
      {simulation.thoughtsPending}⏳ {simulation.thoughtsProcessing}⚙️
    </span>
  </div>

  <!-- Tick Counter -->
  <div class="stat-item">
    <span class="stat-label">Tick</span>
    <span class="stat-value mono">{simulation.tick}</span>
  </div>
</div>

<style>
  .global-stats {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 28px;
    padding: 0 14px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
    user-select: none;
    -webkit-user-select: none;
    overflow-x: auto;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .stat-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-value.mono {
    color: var(--text-secondary);
  }

  .pie-container {
    gap: 6px;
  }

  .pie-chart {
    flex-shrink: 0;
  }

  .peace-stat {
    gap: 6px;
  }

  .peace-bar-container {
    width: 60px;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  :global(.light) .peace-bar-container {
    background: rgba(0, 0, 0, 0.08);
  }

  .peace-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #06b6d4, #22d3ee);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .peace-value {
    min-width: 28px;
    text-align: right;
    color: #06b6d4;
  }

  .brain-value {
    font-size: 10px;
    color: var(--text-muted);
  }
</style>
