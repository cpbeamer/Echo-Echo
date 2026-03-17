<script lang="ts">
  import { simulation } from '$lib/stores/simulation.svelte';
  import type { Vec2, DataBombType } from '../../types';

  let { onclose, pickedTarget }: { onclose: () => void; pickedTarget: Vec2 | null } = $props();

  let bombText = $state('');
  let bombType: DataBombType = $state('standard');
  let blastRadius = $state(5);

  const canDrop = $derived(
    (bombType === 'amnesia' || bombText.trim().length > 0) && pickedTarget !== null,
  );

  function handleDrop() {
    if (!canDrop || !pickedTarget) return;

    simulation.dropDataBomb({
      text: bombType === 'amnesia' ? '' : bombText.trim(),
      target: { ...pickedTarget },
      radius: blastRadius,
      type: bombType,
    });

    bombText = '';
    onclose();
  }

  function startPicking() {
    simulation.startTargetPick();
  }

  function handleClose() {
    simulation.cancelTargetPick();
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={handleClose} onkeydown={handleKeydown}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
    <header class="modal-header">
      <h2>{bombType === 'amnesia' ? '🧹 Drop Amnesia Bomb' : '💣 Drop Data Bomb'}</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">✕</button>
    </header>

    <div class="modal-body">
      <!-- Bomb Type Selector -->
      <label class="field-label">Bomb Type</label>
      <div class="type-selector">
        <button
          class="type-btn"
          class:active={bombType === 'standard'}
          onclick={() => (bombType = 'standard')}
        >
          💣 Standard
        </button>
        <button
          class="type-btn amnesia"
          class:active={bombType === 'amnesia'}
          onclick={() => (bombType = 'amnesia')}
        >
          🧹 Amnesia
        </button>
      </div>

      <!-- Text input (hidden for amnesia) -->
      {#if bombType === 'standard'}
        <label class="field-label" for="bomb-text">Payload Text</label>
        <textarea
          id="bomb-text"
          class="bomb-textarea"
          bind:value={bombText}
          placeholder="Paste or type the information payload here…"
          rows="6"
        ></textarea>
      {:else}
        <div class="amnesia-info">
          <span class="amnesia-icon">🧠</span>
          <p>Wipes all <strong>memories</strong>, <strong>lore-cache</strong>, and <strong>lingo</strong> from agents in the blast radius.</p>
        </div>
      {/if}

      <!-- Blast radius slider -->
      <label class="field-label" for="blast-radius">
        Blast Radius: <span class="value-badge">{blastRadius}</span> cells
      </label>
      <input
        id="blast-radius"
        type="range"
        min="1"
        max="20"
        bind:value={blastRadius}
        class="radius-slider"
      />

      <!-- Target coordinate -->
      <div class="target-section">
        <label class="field-label">Target Coordinate</label>
        {#if pickedTarget}
          <span class="target-display">
            ({Math.round(pickedTarget.x)}, {Math.round(pickedTarget.y)})
          </span>
          <button class="pick-btn" onclick={startPicking}>Re-pick</button>
        {:else}
          <button class="pick-btn primary" onclick={startPicking}> 🎯 Pick Target on Grid </button>
        {/if}
      </div>
    </div>

    <footer class="modal-footer">
      <button class="cancel-btn" onclick={handleClose}>Cancel</button>
      <button
        class="drop-btn"
        class:amnesia-drop={bombType === 'amnesia'}
        disabled={!canDrop}
        onclick={handleDrop}
      >
        {bombType === 'amnesia' ? '🧹 Wipe' : '💥 Drop'}
      </button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    width: 440px;
    max-width: 90vw;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .bomb-textarea {
    width: 100%;
    resize: vertical;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 12px;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
    transition: border-color 0.2s;
  }
  .bomb-textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .bomb-textarea::placeholder {
    color: var(--text-muted);
    opacity: 0.6;
  }

  .value-badge {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-glow);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .radius-slider {
    width: 100%;
    accent-color: var(--accent);
    height: 6px;
    cursor: pointer;
  }

  .target-section {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .target-display {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: var(--text-primary);
    background: var(--bg-primary);
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
  }

  .pick-btn {
    padding: 6px 14px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .pick-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary);
  }
  .pick-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .pick-btn.primary:hover {
    opacity: 0.9;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-subtle);
  }

  .cancel-btn {
    padding: 8px 18px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .drop-btn {
    padding: 8px 22px;
    border: none;
    border-radius: 6px;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }
  .drop-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
  }
  .drop-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .drop-btn.amnesia-drop {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  }
  .drop-btn.amnesia-drop:hover:not(:disabled) {
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
  }

  .type-selector {
    display: flex;
    gap: 4px;
    background: var(--bg-primary);
    border-radius: 8px;
    padding: 3px;
    border: 1px solid var(--border-subtle);
  }

  .type-btn {
    flex: 1;
    padding: 6px 12px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .type-btn.active {
    color: #fff;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 1px 4px rgba(239, 68, 68, 0.3);
  }
  .type-btn.amnesia.active {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    box-shadow: 0 1px 4px rgba(139, 92, 246, 0.3);
  }
  .type-btn:hover:not(.active) {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-secondary);
  }

  .amnesia-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 8px;
  }
  .amnesia-info .amnesia-icon {
    font-size: 28px;
    flex-shrink: 0;
  }
  .amnesia-info p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.5;
  }
</style>
