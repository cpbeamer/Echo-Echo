<script lang="ts">
  import { networking } from '$lib/stores/networking.svelte';
  import {
    startNetwork,
    stopNetwork,
    hostSector as hostSectorCmd,
    subscribeToNetworkEvents,
  } from '../../engine/network-manager';

  let isConnecting = $state(false);
  let sectorInput = $state('sector-1');

  async function handleConnect(): Promise<void> {
    if (networking.status !== 'offline') return;

    isConnecting = true;
    try {
      const peerId = await startNetwork();
      networking.setPeerId(peerId);
      networking.setStatus('discovering');

      networking.pushEvent({
        type: 'peer_joined',
        peerId,
        message: `Local node started: ${peerId.slice(0, 12)}…`,
      });

      // Subscribe to backend events
      await subscribeToNetworkEvents({
        onStatusChange: (payload) => {
          networking.setStatus(payload.status as 'offline' | 'discovering' | 'connected');
        },
        onPeerJoined: (payload) => {
          networking.pushEvent({
            type: 'peer_joined',
            peerId: payload.peerId,
            message: `Peer joined: ${payload.peerId.slice(0, 12)}…`,
          });
        },
        onPeerLeft: (payload) => {
          networking.pushEvent({
            type: 'peer_left',
            peerId: payload.peerId,
            message: `Peer left: ${payload.peerId.slice(0, 12)}…`,
          });
        },
        onSectorHosted: (payload) => {
          networking.pushEvent({
            type: 'sector_hosted',
            peerId: payload.peerId,
            sectorId: payload.sectorId,
            message: `Sector "${payload.sectorId}" hosted by ${payload.peerId.slice(0, 12)}…`,
          });
        },
      });
    } catch (err) {
      console.error('[NetworkPanel] Failed to start network:', err);
      networking.setStatus('offline');
    } finally {
      isConnecting = false;
    }
  }

  async function handleDisconnect(): Promise<void> {
    try {
      await stopNetwork();
    } catch (err) {
      console.error('[NetworkPanel] Failed to stop network:', err);
    }
    networking.reset();
  }

  async function handleHostSector(): Promise<void> {
    if (!sectorInput.trim()) return;
    try {
      await hostSectorCmd(sectorInput.trim());
      networking.setRole('host');
      networking.setActiveSector(sectorInput.trim());
    } catch (err) {
      console.error('[NetworkPanel] Failed to host sector:', err);
    }
  }

  function handleJoinVisitor(): void {
    networking.setRole('visitor');
    networking.setActiveSector(sectorInput.trim() || 'sector-1');
  }

  /** Shorten a peer ID for display. */
  function shortId(id: string): string {
    return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
  }

  function statusColor(): string {
    switch (networking.status) {
      case 'connected':
        return '#22c55e';
      case 'discovering':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  function roleLabel(): string {
    switch (networking.role) {
      case 'host':
        return '🏠 Hosting';
      case 'visitor':
        return '👁 Visiting';
      default:
        return '🔌 Disconnected';
    }
  }
</script>

<div class="network-panel" id="network-panel">
  <header class="panel-header">
    <h3>
      <span class="status-dot" style="background: {statusColor()}"></span>
      Network
    </h3>
    <span class="role-badge">{roleLabel()}</span>
  </header>

  <!-- Connection Controls -->
  <div class="section">
    {#if networking.status === 'offline'}
      <button
        class="btn btn-primary"
        id="btn-connect"
        onclick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting…' : '🌐 Start Network'}
      </button>
    {:else}
      <button class="btn btn-danger" id="btn-disconnect" onclick={handleDisconnect}>
        Disconnect
      </button>
    {/if}
  </div>

  <!-- Sector Controls (visible when connected) -->
  {#if networking.status !== 'offline'}
    <div class="section">
      <label class="input-label" for="sector-id-input">Sector ID</label>
      <div class="sector-controls">
        <input
          type="text"
          id="sector-id-input"
          class="input"
          bind:value={sectorInput}
          placeholder="sector-1"
        />
        {#if networking.role === 'disconnected'}
          <button class="btn btn-small" id="btn-host" onclick={handleHostSector}>Host</button>
          <button class="btn btn-small" id="btn-visit" onclick={handleJoinVisitor}>Visit</button>
        {/if}
      </div>
    </div>

    <!-- Peer ID -->
    {#if networking.peerId}
      <div class="section info-row">
        <span class="info-label">My ID</span>
        <span class="info-value mono">{shortId(networking.peerId)}</span>
      </div>
    {/if}

    <!-- Active Sector -->
    {#if networking.activeSectorId}
      <div class="section info-row">
        <span class="info-label">Sector</span>
        <span class="info-value">{networking.activeSectorId}</span>
      </div>
    {/if}

    <!-- Connected Peers -->
    <div class="section">
      <span class="section-title">Peers ({networking.connectedPeers.length})</span>
      {#if networking.connectedPeers.length > 0}
        <ul class="peer-list">
          {#each networking.connectedPeers as peer (peer.peerId)}
            <li class="peer-item">
              <span class="peer-id mono">{shortId(peer.peerId)}</span>
              <span class="peer-role">{peer.role}</span>
              <span class="peer-latency">{peer.latencyMs.toFixed(0)}ms</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty-message">No peers discovered yet</p>
      {/if}
    </div>

    <!-- Event Log -->
    <div class="section">
      <span class="section-title">Events</span>
      <div class="event-log">
        {#each networking.events.slice(0, 20) as event (event.id)}
          <div class="event-item">
            <span class="event-message">{event.message}</span>
          </div>
        {/each}
        {#if networking.events.length === 0}
          <p class="empty-message">No events yet</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .network-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    max-height: 400px;
    overflow-y: auto;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .panel-header h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 6px currentColor;
  }

  .role-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .section {
    padding-top: 4px;
  }

  .section-title {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: block;
    margin-bottom: 4px;
  }

  .input-label {
    font-size: 10px;
    color: var(--text-muted);
    display: block;
    margin-bottom: 3px;
  }

  .input {
    width: 100%;
    padding: 4px 8px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.2s;
  }

  .input:focus {
    border-color: var(--accent);
  }

  .sector-controls {
    display: flex;
    gap: 4px;
    align-items: stretch;
  }

  .sector-controls .input {
    flex: 1;
  }

  .btn {
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--border-subtle);
    border-radius: 5px;
    cursor: pointer;
    transition:
      background 0.15s,
      transform 0.1s;
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn:hover:not(:disabled) {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .btn-primary:hover:not(:disabled) {
    background: #4f46e5;
    box-shadow: 0 0 12px var(--accent-glow);
  }

  .btn-danger {
    background: transparent;
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .btn-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
    color: #ef4444;
  }

  .btn-small {
    padding: 4px 8px;
    font-size: 10px;
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .info-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .info-value {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .mono {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
  }

  .peer-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .peer-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 10px;
  }

  .peer-id {
    flex: 1;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .peer-role {
    color: var(--accent);
    font-weight: 500;
    text-transform: capitalize;
  }

  .peer-latency {
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .event-log {
    max-height: 120px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .event-item {
    font-size: 10px;
    color: var(--text-secondary);
    padding: 2px 4px;
    border-left: 2px solid var(--accent);
    padding-left: 6px;
  }

  .event-message {
    line-height: 1.3;
  }

  .empty-message {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
