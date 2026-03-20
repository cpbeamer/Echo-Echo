<script lang="ts">
  import { networking } from '$lib/stores/networking.svelte';
  import { FACTION_META } from '../../engine/factions';
  import type { SectorInfo, Faction } from '../../types';

  /** SVG viewport padding. */
  const SVG_PADDING = 40;

  /** Compute the SVG viewport bounds from sector data. */
  function computeViewBox(sectors: SectorInfo[]): {
    minX: number;
    minY: number;
    width: number;
    height: number;
  } {
    if (sectors.length === 0) {
      return { minX: 0, minY: 0, width: 400, height: 300 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const s of sectors) {
      minX = Math.min(minX, s.bounds.originX);
      minY = Math.min(minY, s.bounds.originY);
      maxX = Math.max(maxX, s.bounds.originX + s.bounds.width);
      maxY = Math.max(maxY, s.bounds.originY + s.bounds.height);
    }

    return {
      minX: minX - SVG_PADDING,
      minY: minY - SVG_PADDING,
      width: maxX - minX + SVG_PADDING * 2,
      height: maxY - minY + SVG_PADDING * 2,
    };
  }

  /** Get faction color for a sector. */
  function factionColor(faction: Faction): string {
    return FACTION_META[faction]?.color ?? '#6b7280';
  }

  function factionGlow(faction: Faction): string {
    return FACTION_META[faction]?.glowColor ?? 'rgba(107, 114, 128, 0.4)';
  }

  /** Find center point of a sector for edge connections. */
  function sectorCenter(s: SectorInfo): { cx: number; cy: number } {
    return {
      cx: s.bounds.originX + s.bounds.width / 2,
      cy: s.bounds.originY + s.bounds.height / 2,
    };
  }

  /** Compute adjacency edges (deduplicated). */
  function computeEdges(
    sectors: SectorInfo[],
  ): { x1: number; y1: number; x2: number; y2: number }[] {
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const seen = new Set<string>();

    for (const sector of sectors) {
      const from = sectorCenter(sector);
      for (const adjId of sector.adjacentSectorIds) {
        const key = [sector.sectorId, adjId].sort().join('::');
        if (seen.has(key)) continue;
        seen.add(key);

        const adj = sectors.find((s) => s.sectorId === adjId);
        if (!adj) continue;

        const to = sectorCenter(adj);
        edges.push({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy });
      }
    }

    return edges;
  }

  let hoveredSectorId: string | null = $state(null);

  const viewBox = $derived(computeViewBox(networking.sectors));
  const edges = $derived(computeEdges(networking.sectors));
</script>

<div class="global-map" id="global-map-view">
  <header class="map-header">
    <h4>🗺️ Global Map</h4>
    <span class="sector-count">{networking.sectors.length} sectors</span>
  </header>

  {#if networking.sectors.length === 0}
    <p class="empty-message">No sectors active</p>
  {:else}
    <svg
      class="map-svg"
      viewBox="{viewBox.minX} {viewBox.minY} {viewBox.width} {viewBox.height}"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Adjacency edges -->
      {#each edges as edge}
        <line
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          class="edge-line"
        />
      {/each}

      <!-- Sector rectangles -->
      {#each networking.sectors as sector (sector.sectorId)}
        {@const color = factionColor(sector.dominantFaction)}
        {@const glow = factionGlow(sector.dominantFaction)}
        {@const isHovered = hoveredSectorId === sector.sectorId}
        {@const isActive = networking.activeSectorId === sector.sectorId}

        <g
          class="sector-group"
          class:hovered={isHovered}
          class:active={isActive}
          onmouseenter={() => (hoveredSectorId = sector.sectorId)}
          onmouseleave={() => (hoveredSectorId = null)}
          role="img"
          aria-label="Sector {sector.sectorId}"
        >
          <!-- Glow effect for active/hovered sectors -->
          {#if isHovered || isActive}
            <rect
              x={sector.bounds.originX - 2}
              y={sector.bounds.originY - 2}
              width={sector.bounds.width + 4}
              height={sector.bounds.height + 4}
              rx="6"
              ry="6"
              fill="none"
              stroke={color}
              stroke-width="2"
              opacity="0.6"
              style="filter: drop-shadow(0 0 8px {glow})"
            />
          {/if}

          <!-- Sector rect -->
          <rect
            x={sector.bounds.originX}
            y={sector.bounds.originY}
            width={sector.bounds.width}
            height={sector.bounds.height}
            rx="4"
            ry="4"
            fill="{color}22"
            stroke={color}
            stroke-width={isActive ? 2 : 1}
            class="sector-rect"
          />

          <!-- Sector label -->
          <text
            x={sector.bounds.originX + sector.bounds.width / 2}
            y={sector.bounds.originY + sector.bounds.height / 2 - 6}
            text-anchor="middle"
            class="sector-label"
          >
            {sector.sectorId}
          </text>

          <!-- Agent count -->
          <text
            x={sector.bounds.originX + sector.bounds.width / 2}
            y={sector.bounds.originY + sector.bounds.height / 2 + 10}
            text-anchor="middle"
            class="sector-agent-count"
          >
            {sector.agentCount} agents
          </text>

          <!-- Host indicator -->
          <text
            x={sector.bounds.originX + sector.bounds.width / 2}
            y={sector.bounds.originY + sector.bounds.height / 2 + 24}
            text-anchor="middle"
            class="sector-host"
          >
            🏠 {sector.hostPeerId.length > 12
              ? sector.hostPeerId.slice(0, 8) + '…'
              : sector.hostPeerId}
          </text>
        </g>
      {/each}
    </svg>

    <!-- Hover tooltip -->
    {#if hoveredSectorId}
      {@const hoveredSector = networking.sectors.find((s) => s.sectorId === hoveredSectorId)}
      {#if hoveredSector}
        <div class="tooltip">
          <strong>{hoveredSector.sectorId}</strong>
          <span>Host: {hoveredSector.hostPeerId.slice(0, 12)}…</span>
          <span>Agents: {hoveredSector.agentCount}</span>
          <span>Faction: {FACTION_META[hoveredSector.dominantFaction]?.label ?? 'Unknown'}</span>
          <span>Adjacent: {hoveredSector.adjacentSectorIds.length} sectors</span>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .global-map {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
  }

  .map-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .map-header h4 {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .sector-count {
    font-size: 10px;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .map-svg {
    width: 100%;
    max-height: 280px;
    border-radius: 6px;
    background: var(--bg-tertiary);
  }

  .edge-line {
    stroke: var(--text-muted);
    stroke-width: 1;
    stroke-dasharray: 4 3;
    opacity: 0.4;
  }

  .sector-rect {
    transition:
      fill 0.2s,
      stroke-width 0.2s;
    cursor: pointer;
  }

  .sector-group.hovered .sector-rect {
    fill-opacity: 0.4;
  }

  .sector-label {
    font-size: 10px;
    font-weight: 600;
    fill: var(--text-primary);
    pointer-events: none;
  }

  .sector-agent-count {
    font-size: 9px;
    fill: var(--text-secondary);
    font-family: 'JetBrains Mono', monospace;
    pointer-events: none;
  }

  .sector-host {
    font-size: 8px;
    fill: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    pointer-events: none;
  }

  .tooltip {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    font-size: 10px;
    color: var(--text-secondary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    z-index: 10;
  }

  .tooltip strong {
    color: var(--text-primary);
    font-size: 11px;
  }

  .empty-message {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    padding: 12px 0;
  }
</style>
