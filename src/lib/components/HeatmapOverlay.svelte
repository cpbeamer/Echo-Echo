<script lang="ts">
  import type { HeatmapConfig } from '../../engine/heatmap';

  let {
    enabled = $bindable(false),
    config = $bindable({
      resolution: 2,
      kernelRadius: 3,
      mode: 'density' as HeatmapConfig['mode'],
    }),
    opacity = $bindable(0.4),
  }: {
    enabled: boolean;
    config: { resolution: number; kernelRadius: number; mode: HeatmapConfig['mode'] };
    opacity: number;
  } = $props();

  const modes: { label: string; value: HeatmapConfig['mode'] }[] = [
    { label: 'Density', value: 'density' },
    { label: 'Faction', value: 'faction' },
    { label: 'Peace/War', value: 'peace_war' },
  ];
</script>

<div class="heatmap-panel">
  <div class="panel-header">
    <label class="toggle-row">
      <input type="checkbox" bind:checked={enabled} />
      <span class="toggle-label">Heatmap</span>
    </label>
  </div>

  {#if enabled}
    <div class="panel-body">
      <div class="control-row">
        <span class="control-label">Mode</span>
        <div class="mode-btns">
          {#each modes as m (m.value)}
            <button
              class="mode-btn"
              class:active={config.mode === m.value}
              onclick={() => (config = { ...config, mode: m.value })}
            >
              {m.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-row">
        <span class="control-label">Opacity</span>
        <input type="range" min="0.1" max="0.8" step="0.05" bind:value={opacity} class="slider" />
        <span class="control-value">{Math.round(opacity * 100)}%</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .heatmap-panel {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 200px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 8px;
    z-index: 20;
    font-size: 11px;
    color: var(--text-primary);
    backdrop-filter: blur(8px);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  .toggle-label {
    font-weight: 600;
    font-size: 12px;
  }

  .panel-body {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .control-label {
    min-width: 48px;
    color: var(--text-muted);
    font-size: 10px;
  }

  .control-value {
    min-width: 32px;
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
  }

  .mode-btns {
    display: flex;
    gap: 2px;
    flex: 1;
  }

  .mode-btn {
    flex: 1;
    padding: 2px 4px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-muted);
    font-size: 9px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.15s;
  }

  .mode-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.06);
  }

  :global(.light) .mode-btn:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .mode-btn.active {
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
  }

  .slider {
    flex: 1;
    height: 4px;
    appearance: none;
    -webkit-appearance: none;
    background: var(--border-subtle);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
  }
</style>
