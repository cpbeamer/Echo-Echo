<script lang="ts">
  import { simulation } from '$lib/stores/simulation.svelte';

  const trendIcon: Record<string, string> = {
    up: '↑',
    down: '↓',
    stable: '—',
  };

  const trendClass: Record<string, string> = {
    up: 'trend-up',
    down: 'trend-down',
    stable: 'trend-stable',
  };
</script>

<div class="lingo-leaderboard" id="lingo-leaderboard-panel">
  <div class="panel-header">
    <span class="panel-title">🏆 Lingo Leaderboard</span>
    <span class="panel-subtitle">Top viral terms</span>
  </div>

  <div class="leaderboard-body">
    {#if simulation.lingoLeaderboard.length === 0}
      <div class="empty-state">No lingo in circulation yet.</div>
    {:else}
      {#each simulation.lingoLeaderboard as entry, i (entry.term)}
        <div class="leaderboard-row">
          <span class="rank">#{i + 1}</span>
          <div class="term-info">
            <span class="term-name">{entry.term}</span>
            <span class="term-meaning" title={entry.meaning}>
              {entry.meaning.length > 24 ? entry.meaning.slice(0, 24) + '…' : entry.meaning}
            </span>
          </div>
          <span class="term-count">{entry.count}</span>
          <span class="trend {trendClass[entry.trend]}">
            {trendIcon[entry.trend]}
          </span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .lingo-leaderboard {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    overflow: hidden;
    max-height: 280px;
  }

  .panel-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .panel-subtitle {
    font-size: 10px;
    color: var(--text-muted);
  }

  .leaderboard-body {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 4px 0;
  }

  .empty-state {
    padding: 16px 12px;
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
  }

  .leaderboard-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    transition: background 0.15s ease;
  }

  .leaderboard-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  :global(.light) .leaderboard-row:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .rank {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    min-width: 22px;
  }

  .term-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: 1px;
  }

  .term-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .term-meaning {
    font-size: 9px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .term-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: #6366f1;
    min-width: 24px;
    text-align: right;
  }

  :global(.light) .term-count {
    color: #4f46e5;
  }

  .trend {
    font-size: 12px;
    font-weight: 600;
    min-width: 14px;
    text-align: center;
  }

  .trend-up {
    color: #22c55e;
  }

  .trend-down {
    color: #ef4444;
  }

  .trend-stable {
    color: var(--text-muted);
  }
</style>
