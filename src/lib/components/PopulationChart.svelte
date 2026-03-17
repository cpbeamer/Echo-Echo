<script lang="ts">
  import { simulation } from '$lib/stores/simulation.svelte';

  /**
   * Build SVG polyline points from population history data.
   * Auto-scales Y axis to fit the data range.
   */
  function buildChartData() {
    const history = simulation.populationHistory;
    if (history.length < 2) return null;

    const width = 240;
    const height = 80;
    const padding = { top: 4, right: 4, bottom: 14, left: 28 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Find Y axis range from alive counts
    const maxAlive = Math.max(...history.map((h) => h.alive), 1);
    const maxEvents = Math.max(
      ...history.map((h) => h.births),
      ...history.map((h) => h.deaths),
      1,
    );

    // Scale tick to X position
    const tickMin = history[0].tick;
    const tickMax = history[history.length - 1].tick;
    const tickRange = Math.max(tickMax - tickMin, 1);

    const xScale = (tick: number) => padding.left + ((tick - tickMin) / tickRange) * chartW;
    const yAlive = (val: number) => padding.top + chartH - (val / maxAlive) * chartH;
    const yEvents = (val: number) => padding.top + chartH - (val / maxEvents) * chartH;

    const alivePoints = history.map((h) => `${xScale(h.tick)},${yAlive(h.alive)}`).join(' ');
    const birthPoints = history.map((h) => `${xScale(h.tick)},${yEvents(h.births)}`).join(' ');
    const deathPoints = history.map((h) => `${xScale(h.tick)},${yEvents(h.deaths)}`).join(' ');

    // Y-axis labels
    const yLabels = [
      { y: padding.top, label: String(maxAlive) },
      { y: padding.top + chartH, label: '0' },
    ];

    // X-axis labels
    const xLabels = [
      { x: padding.left, label: String(tickMin) },
      { x: padding.left + chartW, label: String(tickMax) },
    ];

    return { width, height, alivePoints, birthPoints, deathPoints, yLabels, xLabels, padding };
  }

  const chart = $derived(buildChartData());
</script>

<div class="pop-chart" id="population-chart">
  <div class="chart-header">
    <span class="chart-title">Population</span>
    <div class="chart-legend">
      <span class="legend-dot alive"></span>
      <span class="legend-label">Alive</span>
      <span class="legend-dot births"></span>
      <span class="legend-label">Born</span>
      <span class="legend-dot deaths"></span>
      <span class="legend-label">Died</span>
    </div>
  </div>

  {#if chart}
    <svg
      width={chart.width}
      height={chart.height}
      viewBox="0 0 {chart.width} {chart.height}"
      class="chart-svg"
    >
      <!-- Y-axis labels -->
      {#each chart.yLabels as yl}
        <text x={chart.padding.left - 3} y={yl.y + 3} class="axis-label" text-anchor="end">
          {yl.label}
        </text>
      {/each}

      <!-- X-axis labels -->
      {#each chart.xLabels as xl, i}
        <text
          x={xl.x}
          y={chart.height - 1}
          class="axis-label"
          text-anchor={i === 0 ? 'start' : 'end'}
        >
          {xl.label}
        </text>
      {/each}

      <!-- Grid line -->
      <line
        x1={chart.padding.left}
        y1={chart.height - chart.padding.bottom}
        x2={chart.width - chart.padding.right}
        y2={chart.height - chart.padding.bottom}
        class="grid-line"
      />

      <!-- Data lines -->
      <polyline points={chart.alivePoints} class="line alive-line" />
      <polyline points={chart.birthPoints} class="line birth-line" />
      <polyline points={chart.deathPoints} class="line death-line" />
    </svg>
  {:else}
    <div class="chart-empty">Waiting for data…</div>
  {/if}
</div>

<style>
  .pop-chart {
    position: absolute;
    bottom: 8px;
    left: 8px;
    z-index: 20;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 8px 10px;
    min-width: 260px;
    backdrop-filter: blur(8px);
    opacity: 0.95;
  }

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .chart-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .chart-legend {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .legend-dot.alive {
    background: rgba(255, 255, 255, 0.85);
  }
  :global(.light) .legend-dot.alive {
    background: rgba(0, 0, 0, 0.7);
  }

  .legend-dot.births {
    background: #22c55e;
  }
  .legend-dot.deaths {
    background: #ef4444;
  }

  .legend-label {
    font-size: 9px;
    color: var(--text-muted);
    margin-right: 4px;
  }

  .chart-svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .axis-label {
    font-size: 8px;
    fill: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .grid-line {
    stroke: var(--border-subtle);
    stroke-width: 0.5;
  }

  .line {
    fill: none;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .alive-line {
    stroke: rgba(255, 255, 255, 0.85);
  }
  :global(.light) .alive-line {
    stroke: rgba(0, 0, 0, 0.7);
  }

  .birth-line {
    stroke: #22c55e;
    stroke-width: 1;
    opacity: 0.7;
  }

  .death-line {
    stroke: #ef4444;
    stroke-width: 1;
    opacity: 0.7;
  }

  .chart-empty {
    font-size: 10px;
    color: var(--text-muted);
    text-align: center;
    padding: 20px 0;
  }
</style>
