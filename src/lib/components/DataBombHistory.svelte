<script lang="ts">
  import { simulation } from '$lib/stores/simulation';

  let expandedId: string | null = $state(null);

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function handleMouseEnter(agentIds: string[]) {
    simulation.highlightBombAgents(agentIds);
  }

  function handleMouseLeave() {
    simulation.clearHighlights();
  }
</script>

{#if simulation.dataBombHistory.length > 0}
  <aside class="history-panel">
    <header class="panel-header">
      <h3>💣 Bomb Log</h3>
      <span class="count-badge">{simulation.dataBombHistory.length}</span>
    </header>

    <ul class="history-list">
      {#each simulation.dataBombHistory as record (record.id)}
        <li class="history-item">
          <button
            class="item-header"
            class:expanded={expandedId === record.id}
            onclick={() => toggleExpand(record.id)}
            onmouseenter={() => handleMouseEnter(record.affectedAgentIds)}
            onmouseleave={handleMouseLeave}
          >
            <span class="item-time">{formatTime(record.timestamp)}</span>
            <span class="item-meta">
              <span class="affected-count">{record.affectedAgentIds.length}</span> hit
            </span>
            <span class="expand-arrow">{expandedId === record.id ? '▾' : '▸'}</span>
          </button>

          {#if expandedId === record.id}
            <div class="item-detail">
              <p class="detail-preview">"{record.contentPreview}…"</p>
              <div class="detail-row">
                <span class="detail-label">Target</span>
                <span class="detail-value">
                  ({Math.round(record.target.x)}, {Math.round(record.target.y)})
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Radius</span>
                <span class="detail-value">{record.radius} cells</span>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .history-panel {
    position: absolute;
    bottom: 12px;
    left: 12px;
    width: 260px;
    max-height: 280px;
    background: color-mix(in srgb, var(--bg-secondary) 90%, transparent);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 10;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .panel-header h3 {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.2px;
  }

  .count-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-glow);
    padding: 2px 7px;
    border-radius: 8px;
  }

  .history-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
  }

  .history-item {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .history-item:last-child {
    border-bottom: none;
  }

  .item-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    transition: background 0.15s;
    text-align: left;
  }
  .item-header:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  .item-header.expanded {
    background: rgba(255, 255, 255, 0.03);
  }

  .item-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .item-meta {
    flex: 1;
    text-align: right;
    font-size: 11px;
  }

  .affected-count {
    font-weight: 600;
    color: #ef4444;
  }

  .expand-arrow {
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .item-detail {
    padding: 6px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .detail-preview {
    font-size: 11px;
    font-style: italic;
    color: var(--text-muted);
    line-height: 1.4;
    word-break: break-word;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }

  .detail-label {
    color: var(--text-muted);
  }

  .detail-value {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
    font-size: 11px;
  }
</style>
