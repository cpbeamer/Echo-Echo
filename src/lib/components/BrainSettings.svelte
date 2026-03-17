<script lang="ts">
  import { brainSettings } from '../stores/brain-settings';
  import { onMount } from 'svelte';

  let isRefreshing = $state(false);

  onMount(async () => {
    isRefreshing = true;
    await brainSettings.refreshOllamaStatus();
    isRefreshing = false;
  });

  async function handleRefresh() {
    isRefreshing = true;
    await brainSettings.refreshOllamaStatus();
    isRefreshing = false;
  }

  function handleModelChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    brainSettings.setModel(target.value);
  }

  function handleConcurrencyChange(event: Event) {
    const target = event.target as HTMLInputElement;
    brainSettings.setConcurrency(parseInt(target.value, 10));
  }
</script>

<div class="brain-settings" id="brain-settings-panel">
  <h3 class="brain-settings__title">🧠 Brain Settings</h3>

  <!-- Ollama Status -->
  <div class="brain-settings__row">
    <label class="brain-settings__label">Ollama Status</label>
    <div class="brain-settings__status-group">
      <span
        class="brain-settings__indicator"
        class:brain-settings__indicator--connected={brainSettings.ollamaStatus === 'connected'}
        class:brain-settings__indicator--disconnected={brainSettings.ollamaStatus === 'disconnected'}
        class:brain-settings__indicator--checking={brainSettings.ollamaStatus === 'checking'}
      ></span>
      <span class="brain-settings__status-text">
        {#if brainSettings.ollamaStatus === 'connected'}
          Connected
        {:else if brainSettings.ollamaStatus === 'checking'}
          Checking…
        {:else}
          Disconnected
        {/if}
      </span>
      <button
        class="brain-settings__refresh-btn"
        onclick={handleRefresh}
        disabled={isRefreshing}
        id="brain-refresh-btn"
      >
        {isRefreshing ? '⟳' : '↻'} Refresh
      </button>
    </div>
  </div>

  <!-- Model Selector -->
  <div class="brain-settings__row">
    <label class="brain-settings__label" for="brain-model-select">Model</label>
    <select
      id="brain-model-select"
      class="brain-settings__select"
      value={brainSettings.settings.ollamaModel}
      onchange={handleModelChange}
      disabled={brainSettings.availableModels.length === 0}
    >
      {#if brainSettings.availableModels.length === 0}
        <option value="">No models available</option>
      {:else}
        {#each brainSettings.availableModels as model (model)}
          <option value={model}>{model}</option>
        {/each}
      {/if}
    </select>
  </div>

  <!-- Concurrency Slider -->
  <div class="brain-settings__row">
    <label class="brain-settings__label" for="brain-concurrency-slider">
      Concurrency: {brainSettings.settings.maxConcurrency}
    </label>
    <input
      id="brain-concurrency-slider"
      type="range"
      class="brain-settings__slider"
      min="1"
      max="10"
      step="1"
      value={brainSettings.settings.maxConcurrency}
      oninput={handleConcurrencyChange}
    />
  </div>

  <!-- Auto-Think Toggle -->
  <div class="brain-settings__row">
    <label class="brain-settings__label" for="brain-auto-think-toggle">Auto-Think</label>
    <button
      id="brain-auto-think-toggle"
      class="brain-settings__toggle"
      class:brain-settings__toggle--active={brainSettings.settings.autoThink}
      onclick={() => brainSettings.toggleAutoThink()}
    >
      {brainSettings.settings.autoThink ? 'ON' : 'OFF'}
    </button>
  </div>
</div>

<style>
  .brain-settings {
    padding: 1rem;
    border-radius: 8px;
    background: var(--surface, #1e1e2e);
    color: var(--text, #cdd6f4);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .brain-settings__title {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-bright, #f5f5f5);
  }

  .brain-settings__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .brain-settings__label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted, #a6adc8);
    white-space: nowrap;
  }

  .brain-settings__status-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .brain-settings__indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .brain-settings__indicator--connected {
    background: #a6e3a1;
    box-shadow: 0 0 6px #a6e3a180;
  }

  .brain-settings__indicator--disconnected {
    background: #f38ba8;
    box-shadow: 0 0 6px #f38ba880;
  }

  .brain-settings__indicator--checking {
    background: #f9e2af;
    box-shadow: 0 0 6px #f9e2af80;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .brain-settings__status-text {
    font-size: 0.8rem;
    color: var(--text-muted, #a6adc8);
  }

  .brain-settings__refresh-btn {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border, #45475a);
    border-radius: 4px;
    background: transparent;
    color: var(--text, #cdd6f4);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .brain-settings__refresh-btn:hover:not(:disabled) {
    background: var(--surface-hover, #313244);
    border-color: var(--accent, #89b4fa);
  }

  .brain-settings__refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .brain-settings__select {
    flex: 1;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border, #45475a);
    border-radius: 4px;
    background: var(--surface-alt, #181825);
    color: var(--text, #cdd6f4);
    font-size: 0.85rem;
    cursor: pointer;
  }

  .brain-settings__select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .brain-settings__slider {
    flex: 1;
    min-width: 0;
    accent-color: var(--accent, #89b4fa);
  }

  .brain-settings__toggle {
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--border, #45475a);
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted, #a6adc8);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .brain-settings__toggle--active {
    background: var(--accent, #89b4fa);
    color: var(--surface, #1e1e2e);
    border-color: var(--accent, #89b4fa);
  }
</style>
