<script lang="ts">
  import { simulation } from '$lib/stores/simulation';
  import { FACTION_META } from '../../engine/factions';

  const agent = $derived(simulation.selectedAgent);
  const factionMeta = $derived(agent ? FACTION_META[agent.faction] : null);
</script>

{#if agent && factionMeta}
  <aside class="inspector">
    <header class="inspector-header">
      <h2>DNA Inspector</h2>
      <button class="close-btn" onclick={() => simulation.selectAgent(null)}>✕</button>
    </header>

    <div class="agent-id">{agent.id}</div>

    <!-- Faction Badge -->
    <div class="faction-badge" style="--faction-color: {factionMeta.color}">
      <span class="faction-dot"></span>
      {factionMeta.label}
    </div>

    <!-- DNA Vector Bars -->
    <section class="section">
      <h3>Personality Vector</h3>
      <div class="vector-bar">
        <label>
          <span class="axis-label">Analytical</span>
          <span class="axis-label right">Emotional</span>
        </label>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: {agent.vector.analytical_emotional * 100}%; background: hsl({agent.vector
              .analytical_emotional * 360}, 70%, 55%)"
          ></div>
        </div>
        <span class="bar-value">{agent.vector.analytical_emotional.toFixed(2)}</span>
      </div>

      <div class="vector-bar">
        <label>
          <span class="axis-label">Altruistic</span>
          <span class="axis-label right">Selfish</span>
        </label>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: {agent.vector.altruistic_selfish * 100}%; background: hsl({agent.vector
              .altruistic_selfish *
              120 +
              120}, 70%, 55%)"
          ></div>
        </div>
        <span class="bar-value">{agent.vector.altruistic_selfish.toFixed(2)}</span>
      </div>

      <div class="vector-bar">
        <label>
          <span class="axis-label">Order</span>
          <span class="axis-label right">Chaos</span>
        </label>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: {agent.vector.order_chaos * 100}%; background: hsl({agent.vector
              .order_chaos *
              60 +
              200}, 70%, 55%)"
          ></div>
        </div>
        <span class="bar-value">{agent.vector.order_chaos.toFixed(2)}</span>
      </div>
    </section>

    <!-- Stats -->
    <section class="section">
      <h3>Status</h3>
      <div class="stat-row">
        <span>Energy</span>
        <div class="bar-track energy-track">
          <div class="bar-fill energy-fill" style="width: {agent.energy * 100}%"></div>
        </div>
        <span class="bar-value">{(agent.energy * 100).toFixed(0)}%</span>
      </div>
      <div class="stat-row">
        <span>Position</span>
        <span class="stat-value"
          >({agent.position.x.toFixed(1)}, {agent.position.y.toFixed(1)})</span
        >
      </div>
    </section>

    <!-- Lore Cache -->
    <section class="section">
      <h3>Lore Cache ({agent.loreCache.length}/10)</h3>
      {#if agent.loreCache.length === 0}
        <p class="empty-state">No memories yet.</p>
      {:else}
        <ul class="lore-list">
          {#each agent.loreCache as lore, i (i)}
            <li>{lore}</li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Lingo Dictionary -->
    <section class="section">
      <h3>Lingo ({Object.keys(agent.lingo).length})</h3>
      {#if Object.keys(agent.lingo).length === 0}
        <p class="empty-state">No slang adopted yet.</p>
      {:else}
        <dl class="lingo-dict">
          {#each Object.entries(agent.lingo) as [term, meaning] (term)}
            <dt>{term}</dt>
            <dd>{meaning}</dd>
          {/each}
        </dl>
      {/if}
    </section>
  </aside>
{/if}

<style>
  .inspector {
    width: 320px;
    min-width: 280px;
    background: #111118;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 13px;
    color: #c8c8d0;
  }

  .inspector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .inspector-header h2 {
    font-size: 15px;
    font-weight: 600;
    color: #e8e8f0;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 18px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .agent-id {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #666;
  }

  .faction-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--faction-color);
    color: var(--faction-color);
    font-weight: 600;
    font-size: 12px;
    width: fit-content;
  }

  .faction-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--faction-color);
  }

  .section {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 12px;
  }

  .section h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin: 0 0 8px;
  }

  .vector-bar {
    margin-bottom: 8px;
  }

  .vector-bar label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .axis-label {
    font-size: 10px;
    color: #666;
  }
  .axis-label.right {
    text-align: right;
  }

  .bar-track {
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .bar-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #888;
  }

  .stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
  }

  .stat-value {
    font-family: 'JetBrains Mono', monospace;
    color: #aaa;
    margin-left: auto;
  }

  .energy-track {
    flex: 1;
  }

  .energy-fill {
    background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e);
  }

  .empty-state {
    color: #555;
    font-style: italic;
    font-size: 12px;
    margin: 0;
  }

  .lore-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .lore-list li {
    font-size: 11px;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    color: #aaa;
    word-break: break-word;
  }

  .lingo-dict {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 8px;
    margin: 0;
  }

  .lingo-dict dt {
    font-weight: 600;
    color: #c8c8d0;
    font-size: 12px;
  }

  .lingo-dict dd {
    color: #888;
    font-size: 11px;
    margin: 0;
  }
</style>
