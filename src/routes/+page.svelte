<script lang="ts">
  import { onMount } from 'svelte';
  import Grid from '$lib/components/Grid.svelte';
  import DNAInspector from '$lib/components/DNAInspector.svelte';
  import { simulation, type SimulationSpeed } from '$lib/stores/simulation';
  import { FACTION_META } from '../engine/factions';
  import '../app.css';

  const speeds: { label: string; value: SimulationSpeed }[] = [
    { label: '⏸', value: 0 },
    { label: '1×', value: 1 },
    { label: '2×', value: 2 },
    { label: '5×', value: 5 },
  ];

  onMount(() => {
    simulation.initialize();
    simulation.start();
  });
</script>

<div class="app-layout">
  <!-- Top Bar -->
  <header class="topbar">
    <div class="topbar-left">
      <h1 class="app-title">🧠 Synaptic Sandbox</h1>
      <span class="tick-counter">Tick: {simulation.tick}</span>
      <span class="agent-counter">{simulation.aliveAgents.length} agents</span>
    </div>

    <div class="topbar-center">
      <!-- Speed Controls -->
      <div class="speed-controls">
        {#each speeds as s (s.value)}
          <button
            class="speed-btn"
            class:active={simulation.speed === s.value &&
              (s.value === 0 ? !simulation.isRunning : simulation.isRunning)}
            onclick={() => simulation.setSpeed(s.value)}
          >
            {s.label}
          </button>
        {/each}
        <button class="speed-btn step-btn" onclick={() => simulation.stepForward()}>⏭</button>
      </div>
    </div>

    <div class="topbar-right">
      <!-- Faction Mini-Stats -->
      {#each Object.entries(simulation.factionCounts) as [faction, count] (faction)}
        <span
          class="faction-pill"
          style="--fc: {FACTION_META[faction as keyof typeof FACTION_META]?.color ?? '#666'}"
        >
          {count}
        </span>
      {/each}
    </div>
  </header>

  <!-- Main Content -->
  <div class="main-content">
    <Grid />
    <DNAInspector />
  </div>
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    background: var(--bg-primary);
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 42px;
    padding: 0 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
    user-select: none;
    -webkit-user-select: none;
  }

  .topbar-left,
  .topbar-center,
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .topbar-left {
    flex: 1;
  }
  .topbar-right {
    flex: 1;
    justify-content: flex-end;
  }

  .app-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }

  .tick-counter,
  .agent-counter {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 4px;
  }

  .speed-controls {
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 2px;
  }

  .speed-btn {
    padding: 3px 10px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .speed-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.08);
  }

  .speed-btn.active {
    color: #fff;
    background: var(--accent);
  }

  .step-btn {
    margin-left: 2px;
    border-left: 1px solid var(--border-subtle);
  }

  .faction-pill {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    color: var(--fc);
    border: 1px solid var(--fc);
    background: color-mix(in srgb, var(--fc) 10%, transparent);
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
</style>
