<script lang="ts">
  import { newsfeed } from '$lib/stores/newsfeed.svelte';

  /** Maximum events to render in the visible list. */
  const VISIBLE_LIMIT = 50;

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function eventIcon(type: string): string {
    switch (type) {
      case 'meme_swap':
        return '🔄';
      case 'conflict':
        return '⚔️';
      case 'faction_change':
        return '🏴';
      case 'data_bomb':
        return '💣';
      case 'agent_death':
        return '💀';
      default:
        return '📋';
    }
  }
</script>

{#if newsfeed.events.length > 0}
  <aside class="newsfeed-panel" id="newsfeed-panel">
    <header class="panel-header">
      <h3>📡 Newsfeed</h3>
      <button class="clear-btn" onclick={() => newsfeed.clear()} title="Clear feed">✕</button>
    </header>

    <ul class="event-list">
      {#each newsfeed.events.slice(0, VISIBLE_LIMIT) as event (event.id)}
        <li class="event-item">
          <span class="event-icon">{eventIcon(event.type)}</span>
          <span class="event-message">{event.message}</span>
          <span class="event-time">{formatTime(event.timestamp)}</span>
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .newsfeed-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 280px;
    max-height: 320px;
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

  .clear-btn {
    width: 22px;
    height: 22px;
    border: none;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .event-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
  }

  .event-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    font-size: 11px;
    line-height: 1.4;
    transition: background 0.15s;
  }

  .event-item:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .event-icon {
    flex-shrink: 0;
    font-size: 11px;
    line-height: 1.4;
  }

  .event-message {
    flex: 1;
    color: var(--text-secondary);
    word-break: break-word;
  }

  .event-time {
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: var(--text-muted);
    margin-top: 1px;
  }
</style>
