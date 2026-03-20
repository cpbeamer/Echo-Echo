/**
 * Inference Load Balancer – Epic 3.3
 *
 * Pure-logic module (no Tauri/PixiJS dependencies) that decides where
 * to route inference requests. Distributes work across peers proportionally
 * to their GPU capacity (VRAM).
 */

import type {
  PeerCapability,
  InferenceRequest,
  InferencePriority,
  PeerId,
} from '../types/networking';

// ── 3.3.1 / 3.3.2 – Request Classification ─────────────────────────────────

/**
 * Classify a thought request as standard or critical.
 *
 * Critical events (faction wars, manifesto detonations) are routed to
 * the distributed 70B "God Mode" model. Standard thoughts use the local 1B.
 */
export function classifyInferenceRequest(
  agentId: string,
  prompt: string,
  isCriticalEvent: boolean,
): InferenceRequest {
  const priority: InferencePriority = isCriticalEvent ? 'critical' : 'standard';
  return { agentId, prompt, priority };
}

// ── 3.3.3 – Peer Selection ──────────────────────────────────────────────────

/**
 * Select the best peer for a single inference request based on GPU capacity.
 *
 * Picks the available peer with the highest VRAM that is not fully loaded.
 * Returns `'local'` if no remote peer has capacity.
 */
export function selectInferencePeer(
  request: InferenceRequest,
  capabilities: PeerCapability[],
  currentLoad?: Map<PeerId, number>,
): PeerId | 'local' {
  const available = capabilities.filter((c) => c.available && c.vramMb > 0);

  if (available.length === 0) return 'local';

  // Sort by effective capacity (VRAM minus current load ratio)
  const scored = available.map((cap) => {
    const loadRatio = currentLoad?.get(cap.peerId) ?? 0;
    const effectiveCapacity = cap.vramMb * (1 - loadRatio);
    return { peerId: cap.peerId, effectiveCapacity };
  });

  scored.sort((a, b) => b.effectiveCapacity - a.effectiveCapacity);

  // If the best peer has no effective capacity left, fall back to local
  if (scored[0].effectiveCapacity <= 0) return 'local';

  return scored[0].peerId;
}

// ── 3.3.3 – Batch Distribution ──────────────────────────────────────────────

/**
 * Distribute a batch of inference requests across peers using weighted
 * round-robin proportional to GPU capacity (VRAM).
 *
 * Returns a map of peerId → assigned requests. Requests that cannot be
 * assigned to a remote peer are grouped under the key `'local'`.
 */
export function distributeRequests(
  requests: InferenceRequest[],
  capabilities: PeerCapability[],
): Map<PeerId | 'local', InferenceRequest[]> {
  const result = new Map<PeerId | 'local', InferenceRequest[]>();

  const available = capabilities.filter((c) => c.available && c.vramMb > 0);

  // If no remote peers are available, everything runs locally
  if (available.length === 0) {
    result.set('local', [...requests]);
    return result;
  }

  // Compute total VRAM for proportional assignment
  const totalVram = available.reduce((sum, c) => sum + c.vramMb, 0);

  // Calculate how many requests each peer should handle (weighted)
  const peerSlots: { peerId: PeerId; slots: number }[] = [];
  let assignedTotal = 0;

  for (const cap of available) {
    const ratio = cap.vramMb / totalVram;
    const slots = Math.floor(ratio * requests.length);
    peerSlots.push({ peerId: cap.peerId, slots });
    assignedTotal += slots;
  }

  // Distribute remainder to the peer with the most VRAM
  let remainder = requests.length - assignedTotal;
  if (remainder > 0 && peerSlots.length > 0) {
    // Sort by VRAM descending for remainder allocation
    const sorted = [...peerSlots].sort((a, b) => {
      const aVram = available.find((c) => c.peerId === a.peerId)!.vramMb;
      const bVram = available.find((c) => c.peerId === b.peerId)!.vramMb;
      return bVram - aVram;
    });

    for (const slot of sorted) {
      if (remainder <= 0) break;
      slot.slots++;
      remainder--;
    }
  }

  // Assign requests to peers in order
  let idx = 0;
  for (const { peerId, slots } of peerSlots) {
    if (slots > 0) {
      result.set(peerId, requests.slice(idx, idx + slots));
      idx += slots;
    }
  }

  // Any unassigned requests go to local
  if (idx < requests.length) {
    result.set('local', requests.slice(idx));
  }

  return result;
}

// ── Load Monitoring ─────────────────────────────────────────────────────────

/**
 * Compute the current load ratio (0–1) for each peer based on active
 * request counts versus their capacity (VRAM-proportional slots).
 */
export function computePeerLoad(
  capabilities: PeerCapability[],
  activeRequestCounts: Map<PeerId, number>,
): Map<PeerId, number> {
  const loadMap = new Map<PeerId, number>();
  const available = capabilities.filter((c) => c.available && c.vramMb > 0);

  if (available.length === 0) return loadMap;

  const totalVram = available.reduce((sum, c) => sum + c.vramMb, 0);

  for (const cap of available) {
    const maxSlots = Math.max(1, Math.round((cap.vramMb / totalVram) * 10));
    const activeCount = activeRequestCounts.get(cap.peerId) ?? 0;
    loadMap.set(cap.peerId, Math.min(1, activeCount / maxSlots));
  }

  return loadMap;
}
