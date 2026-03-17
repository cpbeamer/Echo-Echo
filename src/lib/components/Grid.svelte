<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { simulation } from '$lib/stores/simulation';
  import { FACTION_META } from '../../engine/factions';
  import type { Vec2 } from '../../types';

  let { ontargetpick }: { ontargetpick?: (coord: Vec2) => void } = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let animFrameId: number;

  // Camera state for pan/zoom
  let camera = $state({
    x: 0,
    y: 0,
    zoom: 8, // pixels per grid cell
  });

  let isDragging = $state(false);
  let dragStart = { x: 0, y: 0 };
  let canvasWidth = $state(0);
  let canvasHeight = $state(0);

  /** Convert screen coords to grid coords. */
  function screenToGrid(sx: number, sy: number) {
    return {
      x: (sx - camera.x) / camera.zoom,
      y: (sy - camera.y) / camera.zoom,
    };
  }

  /** Render a single frame. */
  function render() {
    if (!ctx) return;

    const w = canvasWidth;
    const h = canvasHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    const config = simulation.config;

    // Draw grid background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, config.gridWidth, config.gridHeight);

    // Draw sector boundaries
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1 / camera.zoom;
    for (let x = 0; x <= config.gridWidth; x += config.sectorSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, config.gridHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= config.gridHeight; y += config.sectorSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(config.gridWidth, y);
      ctx.stroke();
    }

    // Draw fine grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    if (camera.zoom > 5) {
      for (let x = 0; x <= config.gridWidth; x += 1) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, config.gridHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= config.gridHeight; y += 1) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(config.gridWidth, y);
        ctx.stroke();
      }
    }

    // Draw agents
    const agents = simulation.agents;
    const selectedId = simulation.selectedAgentId;
    const highlightedIds = simulation.highlightedAgentIds;

    for (const agent of agents) {
      if (agent.energy <= 0) continue;

      ctx.beginPath();
      ctx.arc(agent.position.x, agent.position.y, agent.radius, 0, Math.PI * 2);

      // Fill with DNA-derived color
      ctx.fillStyle = agent.color;
      ctx.fill();

      // Subtle faction glow
      const factionMeta = FACTION_META[agent.faction];
      ctx.shadowColor = factionMeta.glowColor;
      ctx.shadowBlur = 3 / camera.zoom;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Selection ring
      if (agent.id === selectedId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.stroke();
      }

      // Highlight ring (from data bomb history hover)
      if (highlightedIds.has(agent.id)) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.stroke();

        // Red glow for highlighted agents
        ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
        ctx.shadowBlur = 5 / camera.zoom;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Draw shockwave animations
    for (const sw of simulation.activeShockwaves) {
      const progress = sw.frame / sw.totalFrames;
      const currentRadius = sw.maxRadius * progress;
      const alpha = 1 - progress;

      ctx.beginPath();
      ctx.arc(sw.center.x, sw.center.y, currentRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.8})`;
      ctx.lineWidth = (2 + (1 - progress) * 2) / camera.zoom;
      ctx.stroke();

      // Inner fill that fades quickly
      if (progress < 0.3) {
        ctx.fillStyle = `rgba(239, 68, 68, ${(0.3 - progress) * 0.15})`;
        ctx.fill();
      }
    }

    ctx.restore();

    // Draw crosshair overlay when in target-pick mode (in screen space)
    if (simulation.isPickingTarget) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 6]);

      // Full-width horizontal + vertical guides through center
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.restore();
    }

    animFrameId = requestAnimationFrame(render);
  }

  /** Handle mouse wheel for zoom. */
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(50, camera.zoom * zoomFactor));

    // Zoom toward cursor position
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    camera.x = mx - (mx - camera.x) * (newZoom / camera.zoom);
    camera.y = my - (my - camera.y) * (newZoom / camera.zoom);
    camera.zoom = newZoom;
  }

  /** Handle mouse down for pan start or agent selection. */
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

    const rect = canvas.getBoundingClientRect();
    const grid = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);

    // Target-pick mode: emit coordinate and return
    if (simulation.isPickingTarget) {
      simulation.cancelTargetPick();
      ontargetpick?.({ x: grid.x, y: grid.y });
      return;
    }

    // Hit test: find the closest agent to the click point
    let closest: string | null = null;
    let closestDist = Infinity;

    for (const agent of simulation.agents) {
      if (agent.energy <= 0) continue;
      const adx = agent.position.x - grid.x;
      const ady = agent.position.y - grid.y;
      const dist = Math.sqrt(adx * adx + ady * ady);

      if (dist < agent.radius * 2 && dist < closestDist) {
        closest = agent.id;
        closestDist = dist;
      }
    }

    simulation.selectAgent(closest);
  }

  /** Resize canvas to fill its container. */
  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Center the grid in view
    camera.x = canvasWidth / 2 - (simulation.config.gridWidth * camera.zoom) / 2;
    camera.y = canvasHeight / 2 - (simulation.config.gridHeight * camera.zoom) / 2;

    animFrameId = requestAnimationFrame(render);
    window.addEventListener('resize', resizeCanvas);
  });

  onDestroy(() => {
    cancelAnimationFrame(animFrameId);
    window.removeEventListener('resize', resizeCanvas);
  });
</script>

<div class="grid-container">
  <canvas
    bind:this={canvas}
    onwheel={onWheel}
    onmousedown={onMouseDown}
    onmousemove={onMouseMove}
    onmouseup={onMouseUp}
    onmouseleave={() => (isDragging = false)}
    class:grabbing={isDragging}
    class:picking={simulation.isPickingTarget}
  ></canvas>
</div>

<style>
  .grid-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #050508;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  canvas.grabbing {
    cursor: grabbing;
  }

  canvas.picking {
    cursor: crosshair;
  }
</style>
