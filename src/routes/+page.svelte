<script lang="ts">
  import { onMount } from 'svelte';
  import Grid from '$lib/components/Grid.svelte';
  import DNAInspector from '$lib/components/DNAInspector.svelte';
  import DropZone from '$lib/components/DropZone.svelte';
  import DataBombHistory from '$lib/components/DataBombHistory.svelte';
  import LingoCloud from '$lib/components/LingoCloud.svelte';
  import Newsfeed from '$lib/components/Newsfeed.svelte';
  import GlobalStats from '$lib/components/GlobalStats.svelte';
  import { simulation, type SimulationSpeed } from '$lib/stores/simulation.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { FACTION_META } from '../engine/factions';
  import type { Vec2 } from '../types';
  import '../app.css';

  const speeds: { label: string; value: SimulationSpeed }[] = [
    { label: '⏸', value: 0 },
    { label: '1×', value: 1 },
    { label: '2×', value: 2 },
    { label: '5×', value: 5 },
  ];

  let showDropZone = $state(false);
  let pickedTarget: Vec2 | null = $state(null);
  let cameraState = $state({ x: 0, y: 0, zoom: 8 });

  function openDropZone() {
    pickedTarget = null;
    showDropZone = true;
  }

  function closeDropZone() {
    showDropZone = false;
    pickedTarget = null;
    simulation.cancelTargetPick();
  }

  function handleTargetPick(coord: Vec2) {
    pickedTarget = coord;
    showDropZone = true;
  }

  function handleCameraChange(cam: { x: number; y: number; zoom: number }) {
    cameraState = cam;
  }

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

      <!-- Data Bomb Button -->
      <button class="bomb-btn" onclick={openDropZone} title="Drop Data Bomb"> 💣 </button>
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

      <!-- Theme Toggle -->
      <button
        class="theme-toggle"
        onclick={() => theme.toggle()}
        title="Toggle dark/light mode"
        id="theme-toggle-btn"
      >
        {theme.mode === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  </header>

  <!-- Global Stats Bar -->
  <GlobalStats />

  <!-- Main Content -->
  <div class="main-content">
    <Grid ontargetpick={handleTargetPick} oncamerachange={handleCameraChange} />
    <LingoCloud camera={cameraState} />
    <Newsfeed />
    <DataBombHistory />
    <DNAInspector />
  </div>

  <!-- Drop Zone Modal -->
  {#if showDropZone}
    <DropZone onclose={closeDropZone} {pickedTarget} />
  {/if}
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

  .speed-controls {
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 2px;
  }

  :global(.light) .speed-controls {
    background: rgba(0, 0, 0, 0.04);
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

  :global(.light) .speed-btn:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  .speed-btn.active {
    color: #fff;
    background: var(--accent);
  }

  .step-btn {
    margin-left: 2px;
    border-left: 1px solid var(--border-subtle);
  }

  .bomb-btn {
    padding: 3px 10px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.08);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    line-height: 1;
  }
  .bomb-btn:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.5);
    transform: scale(1.05);
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

  .theme-toggle {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    line-height: 1;
  }

  :global(.light) .theme-toggle {
    background: rgba(0, 0, 0, 0.04);
  }

  .theme-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.08);
  }

  :global(.light) .theme-toggle:hover {
    background: rgba(0, 0, 0, 0.08);
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
