<script lang="ts">
  import { simulation } from '$lib/stores/simulation.svelte';
  import { extractPdfText, fetchUrlText } from '../../engine/payload-extractor';
  import type { Vec2, DataBombType } from '../../types';

  let { onclose, pickedTarget }: { onclose: () => void; pickedTarget: Vec2 | null } = $props();

  let bombText = $state('');
  let bombType: DataBombType = $state('standard');
  let blastRadius = $state(5);

  // PDF state
  let pdfFileName = $state('');
  let pdfExtractedText = $state('');
  let pdfLoading = $state(false);
  let pdfError = $state('');

  // URL state
  let urlInput = $state('');
  let urlExtractedText = $state('');
  let urlLoading = $state(false);
  let urlError = $state('');

  const canDrop = $derived(() => {
    if (pickedTarget === null) return false;
    switch (bombType) {
      case 'amnesia':
        return true;
      case 'pdf':
        return pdfExtractedText.length > 0;
      case 'url':
        return urlExtractedText.length > 0;
      default:
        return bombText.trim().length > 0;
    }
  });

  function handleDrop() {
    if (!canDrop() || !pickedTarget) return;

    let text: string;
    switch (bombType) {
      case 'amnesia':
        text = '';
        break;
      case 'pdf':
        text = pdfExtractedText;
        break;
      case 'url':
        text = urlExtractedText;
        break;
      default:
        text = bombText.trim();
        break;
    }

    simulation.dropDataBomb({
      text,
      target: { ...pickedTarget },
      radius: blastRadius,
      type: bombType,
    });

    // Reset state
    bombText = '';
    pdfFileName = '';
    pdfExtractedText = '';
    pdfError = '';
    urlInput = '';
    urlExtractedText = '';
    urlError = '';
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

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    pdfFileName = file.name;
    pdfExtractedText = '';
    pdfError = '';
    pdfLoading = true;

    try {
      // Tauri provides the file path via webkitRelativePath or we use the name
      // In Tauri, file inputs give us the full path
      const filePath = (file as File & { path?: string }).path ?? file.name;
      const text = await extractPdfText(filePath);
      pdfExtractedText = text;
    } catch (err) {
      pdfError = err instanceof Error ? err.message : String(err);
    } finally {
      pdfLoading = false;
    }
  }

  async function handleUrlFetch() {
    const url = urlInput.trim();
    if (!url) return;

    urlExtractedText = '';
    urlError = '';
    urlLoading = true;

    try {
      const text = await fetchUrlText(url);
      urlExtractedText = text;
    } catch (err) {
      urlError = err instanceof Error ? err.message : String(err);
    } finally {
      urlLoading = false;
    }
  }

  function handleUrlKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleUrlFetch();
    }
  }

  /** Visual config per bomb type for the modal header and buttons. */
  const BOMB_META: Record<DataBombType, { emoji: string; label: string; headerLabel: string }> = {
    standard: { emoji: '💣', label: 'Standard', headerLabel: '💣 Drop Data Bomb' },
    amnesia: { emoji: '🧹', label: 'Amnesia', headerLabel: '🧹 Drop Amnesia Bomb' },
    pdf: { emoji: '📄', label: 'PDF', headerLabel: '📄 Drop PDF Bomb' },
    url: { emoji: '🔗', label: 'URL', headerLabel: '🔗 Drop URL Bomb' },
    manifesto: { emoji: '📜', label: 'Manifesto', headerLabel: '📜 Drop Manifesto Bomb' },
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={handleClose} onkeydown={handleKeydown}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
    <header class="modal-header">
      <h2>{BOMB_META[bombType].headerLabel}</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">✕</button>
    </header>

    <div class="modal-body">
      <!-- Bomb Type Selector -->
      <label class="field-label">Bomb Type</label>
      <div class="type-selector">
        {#each ['standard', 'amnesia', 'pdf', 'url', 'manifesto'] as DataBombType[] as t (t)}
          <button
            class="type-btn"
            class:active={bombType === t}
            class:amnesia={t === 'amnesia'}
            class:manifesto={t === 'manifesto'}
            onclick={() => (bombType = t)}
          >
            {BOMB_META[t].emoji}
            {BOMB_META[t].label}
          </button>
        {/each}
      </div>

      <!-- Standard / Manifesto text input -->
      {#if bombType === 'standard' || bombType === 'manifesto'}
        {#if bombType === 'manifesto'}
          <div class="manifesto-warning">
            <span class="warning-icon">⚠️</span>
            <p>
              <strong>Manifesto</strong> bombs hit with <strong>2× mutation force</strong> and
              <strong>doubled blast radius</strong>. Use with intent.
            </p>
          </div>
        {/if}
        <label class="field-label" for="bomb-text">Payload Text</label>
        <textarea
          id="bomb-text"
          class="bomb-textarea"
          bind:value={bombText}
          placeholder="Paste or type the information payload here…"
          rows="6"
        ></textarea>

        <!-- Amnesia info -->
      {:else if bombType === 'amnesia'}
        <div class="amnesia-info">
          <span class="amnesia-icon">🧠</span>
          <p>
            Wipes all <strong>memories</strong>, <strong>lore-cache</strong>, and
            <strong>lingo</strong> from agents in the blast radius.
          </p>
        </div>

        <!-- PDF file picker -->
      {:else if bombType === 'pdf'}
        <label class="field-label" for="pdf-file">PDF File</label>
        <div class="file-picker">
          <label class="file-label" for="pdf-file">
            {pdfFileName || 'Choose a PDF file…'}
          </label>
          <input
            id="pdf-file"
            type="file"
            accept=".pdf"
            class="file-input"
            onchange={handleFileSelect}
          />
        </div>
        {#if pdfLoading}
          <div class="status-msg loading">Extracting text from PDF…</div>
        {/if}
        {#if pdfError}
          <div class="status-msg error">{pdfError}</div>
        {/if}
        {#if pdfExtractedText}
          <div class="preview-box">
            <span class="preview-label">Preview ({pdfExtractedText.length} chars)</span>
            <p class="preview-text">{pdfExtractedText.slice(0, 300)}…</p>
          </div>
        {/if}

        <!-- URL input -->
      {:else if bombType === 'url'}
        <label class="field-label" for="url-input">URL</label>
        <div class="url-row">
          <input
            id="url-input"
            type="url"
            class="url-input"
            bind:value={urlInput}
            placeholder="https://example.com/article"
            onkeydown={handleUrlKeydown}
          />
          <button
            class="fetch-btn"
            onclick={handleUrlFetch}
            disabled={urlLoading || !urlInput.trim()}
          >
            {urlLoading ? '…' : 'Fetch'}
          </button>
        </div>
        {#if urlLoading}
          <div class="status-msg loading">Fetching URL content…</div>
        {/if}
        {#if urlError}
          <div class="status-msg error">{urlError}</div>
        {/if}
        {#if urlExtractedText}
          <div class="preview-box">
            <span class="preview-label">Preview ({urlExtractedText.length} chars)</span>
            <p class="preview-text">{urlExtractedText.slice(0, 300)}…</p>
          </div>
        {/if}
      {/if}

      <!-- Blast radius slider -->
      <label class="field-label" for="blast-radius">
        Blast Radius: <span class="value-badge">{blastRadius}</span> cells
        {#if bombType === 'manifesto'}
          <span class="manifesto-badge">→ {blastRadius * 2} effective</span>
        {/if}
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
        class:manifesto-drop={bombType === 'manifesto'}
        disabled={!canDrop()}
        onclick={handleDrop}
      >
        {#if bombType === 'amnesia'}
          🧹 Wipe
        {:else if bombType === 'manifesto'}
          📜 Unleash
        {:else}
          💥 Drop
        {/if}
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
    width: 480px;
    max-width: 90vw;
    max-height: 85vh;
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
    overflow-y: auto;
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

  .manifesto-badge {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: #ff4444;
    font-size: 11px;
    margin-left: 4px;
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

  .drop-btn.manifesto-drop {
    background: linear-gradient(135deg, #dc2626, #991b1b);
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);
  }
  .drop-btn.manifesto-drop:hover:not(:disabled) {
    box-shadow: 0 4px 16px rgba(220, 38, 38, 0.5);
  }

  .type-selector {
    display: flex;
    gap: 4px;
    background: var(--bg-primary);
    border-radius: 8px;
    padding: 3px;
    border: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .type-btn {
    flex: 1;
    min-width: 70px;
    padding: 6px 8px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
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
  .type-btn.manifesto.active {
    background: linear-gradient(135deg, #dc2626, #991b1b);
    box-shadow: 0 1px 4px rgba(220, 38, 38, 0.4);
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

  .manifesto-warning {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(220, 38, 38, 0.08);
    border: 1px solid rgba(220, 38, 38, 0.25);
    border-radius: 8px;
  }
  .manifesto-warning .warning-icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  .manifesto-warning p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.5;
  }

  /* PDF file picker */
  .file-picker {
    position: relative;
  }
  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .file-label {
    display: block;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px dashed var(--border-subtle);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .file-label:hover {
    border-color: var(--accent);
  }

  /* URL input */
  .url-row {
    display: flex;
    gap: 8px;
  }
  .url-input {
    flex: 1;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text-primary);
    font-size: 13px;
    transition: border-color 0.2s;
  }
  .url-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .url-input::placeholder {
    color: var(--text-muted);
    opacity: 0.6;
  }
  .fetch-btn {
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .fetch-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .fetch-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Status and preview */
  .status-msg {
    font-size: 12px;
    padding: 8px 12px;
    border-radius: 6px;
  }
  .status-msg.loading {
    color: var(--accent);
    background: var(--accent-glow);
  }
  .status-msg.error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .preview-box {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 10px 12px;
    max-height: 120px;
    overflow-y: auto;
  }
  .preview-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }
  .preview-text {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
    word-break: break-word;
  }
</style>
