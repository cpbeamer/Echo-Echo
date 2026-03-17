<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { simulation } from '$lib/stores/simulation.svelte';
  import { PixiRenderer } from '../../engine/pixi-renderer';
  import type { Vec2 } from '../../types';

  let {
    ontargetpick,
    oncamerachange,
  }: {
    ontargetpick?: (coord: Vec2) => void;
    oncamerachange?: (camera: { x: number; y: number; zoom: number }) => void;
  } = $props();

  let container: HTMLDivElement;
  let renderer: PixiRenderer | null = null;

  // Camera state for pan/zoom
  let camera = $state({
    x: 0,
    y: 0,
    zoom: 8, // pixels per grid cell
  });

  let isDragging = $state(false);
  let dragStart = { x: 0, y: 0 };

  /** Notify parent of camera changes for overlay positioning. */
  $effect(() => {
    oncamerachange?.({ x: camera.x, y: camera.y, zoom: camera.zoom });
  });

  /** Sync camera transform to the PixiJS renderer. */
  $effect(() => {
    renderer?.setCamera(camera.x, camera.y, camera.zoom);
  });

  /** Sync agents to the renderer. */
  $effect(() => {
    const agents = simulation.agents;
    renderer?.syncAgents(agents);
  });

  /** Sync selected agent to the renderer. */
  $effect(() => {
    const selectedId = simulation.selectedAgentId;
    renderer?.setSelectedAgent(selectedId);
  });

  /** Sync highlighted agents to the renderer. */
  $effect(() => {
    const ids = simulation.highlightedAgentIds;
    renderer?.setHighlightedAgents(ids);
  });

  /** Sync shockwaves from the store. */
  $effect(() => {
    const shockwaves = simulation.activeShockwaves;
    renderer?.syncShockwaves(shockwaves);
  });

  /** Sync target-pick mode. */
  $effect(() => {
    const picking = simulation.isPickingTarget;
    renderer?.setTargetPickMode(picking);
  });

  /** Handle mouse wheel for zoom. */
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(50, camera.zoom * zoomFactor));

    // Zoom toward cursor position
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    camera.x = mx - (mx - camera.x) * (newZoom / camera.zoom);
    camera.y = my - (my - camera.y) * (newZoom / camera.zoom);
    camera.zoom = newZoom;
  }

  /** Handle mouse down for pan start. */
  function onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      isDragging = true;
      dragStart = { x: e.clientX - camera.x, y: e.clientY - camera.y };
    }
  }

  /** Handle mouse move for panning. */
  function onMouseMove(e: MouseEvent) {
    if (isDragging) {
      camera.x = e.clientX - dragStart.x;
      camera.y = e.clientY - dragStart.y;
    }
  }

  /** Handle mouse up — if no drag occurred, treat as click for selection or target pick. */
  function onMouseUp(e: MouseEvent) {
    if (!isDragging) return;
    isDragging = false;

    // Check if it was a "click" (minimal movement)
    const dx = Math.abs(e.clientX - (dragStart.x + camera.x));
    const dy = Math.abs(e.clientY - (dragStart.y + camera.y));

    // Only treat tiny drags as clicks
    if (dx + dy > 5) return;

    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const grid = renderer?.screenToGrid(screenX, screenY) ?? { x: 0, y: 0 };

    // Target-pick mode: emit coordinate and return
    if (simulation.isPickingTarget) {
      simulation.cancelTargetPick();
      ontargetpick?.({ x: grid.x, y: grid.y });
      return;
    }

    // Hit test using the renderer
    const closest = renderer?.hitTest(grid.x, grid.y, simulation.agents) ?? null;
    simulation.selectAgent(closest);
  }

  onMount(async () => {
    renderer = new PixiRenderer();
    const config = simulation.config;

    await renderer.init(container, config.gridWidth, config.gridHeight, config.sectorSize);

    // Center the grid in view
    const rect = container.getBoundingClientRect();
    camera.x = rect.width / 2 - (config.gridWidth * camera.zoom) / 2;
    camera.y = rect.height / 2 - (config.gridHeight * camera.zoom) / 2;

    renderer.setCamera(camera.x, camera.y, camera.zoom);
  });

  onDestroy(() => {
    renderer?.destroy();
    renderer = null;
  });
</script>

<div
  class="grid-container"
  bind:this={container}
  onwheel={onWheel}
  onmousedown={onMouseDown}
  onmousemove={onMouseMove}
  onmouseup={onMouseUp}
  onmouseleave={() => (isDragging = false)}
  class:grabbing={isDragging}
  class:picking={simulation.isPickingTarget}
  role="application"
  aria-label="Simulation grid"
  tabindex="0"
>
</div>

<style>
  .grid-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #050508;
    cursor: grab;
  }

  .grid-container.grabbing {
    cursor: grabbing;
  }

  .grid-container.picking {
    cursor: crosshair;
  }

  .grid-container :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
</style>
