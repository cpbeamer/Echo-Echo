/**
 * Thought Orchestrator – queues and rate-limits agent "thought requests."
 *
 * Manages a FIFO queue of agents waiting to "think." On each tick, up to
 * `maxConcurrent` requests are dispatched in parallel. Results are parsed
 * via DNAParser and applied via applyDNAUpdate().
 *
 * Epic 3.3 additions: supports distributed inference via Petals. Critical
 * events (faction wars, manifestos) are routed to the 70B "God Mode" model;
 * standard thoughts can be offloaded to remote peers with available GPU.
 */

import type { Agent } from '../types';
import type { BrainSettings } from '../types/brain';
import type { DistributedInferenceConfig, PeerCapability, PeerId } from '../types/networking';
import { DEFAULT_DISTRIBUTED_INFERENCE_CONFIG } from '../types/networking';
import { generateCompletion } from './ollama-client';
import { generateDistributed } from './petals-client';
import { parseDNAResponse } from './dna-parser';
import { applyDNAUpdate } from './dna-mutation';
import { truncateLoreCache } from './context-truncator';
import { retrieveRelevantMemories } from './memory-store';
import { buildMutationPrompt } from './prompt-builder';
import { classifyInferenceRequest, selectInferencePeer, computePeerLoad } from './inference-load-balancer';

/** A pending thought request in the queue. */
interface ThoughtRequest {
  agent: Agent;
  contextText: string;
  /** Whether this request is for a critical simulation event (God Mode eligible). */
  isCritical: boolean;
}

export class ThoughtOrchestrator {
  private queue: ThoughtRequest[] = [];
  private activeCount = 0;
  private distributedActiveCount = 0;
  private settings: BrainSettings;
  private distributedConfig: DistributedInferenceConfig;
  private peerCapabilities: PeerCapability[] = [];
  /** Tracks in-flight request counts per remote peer for load balancing. */
  private peerActiveRequests = new Map<PeerId, number>();

  constructor(
    settings: BrainSettings,
    distributedConfig: DistributedInferenceConfig = DEFAULT_DISTRIBUTED_INFERENCE_CONFIG,
  ) {
    this.settings = settings;
    this.distributedConfig = distributedConfig;
  }

  /** Update the settings reference (e.g., when user changes concurrency). */
  updateSettings(settings: BrainSettings): void {
    this.settings = settings;
  }

  /** Update the distributed inference configuration. */
  updateDistributedConfig(config: DistributedInferenceConfig): void {
    this.distributedConfig = config;
  }

  /** Update the known peer capabilities for load balancing. */
  updatePeerCapabilities(capabilities: PeerCapability[]): void {
    this.peerCapabilities = capabilities;
  }

  /** Number of requests waiting in the queue. */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Number of local requests currently being processed. */
  get processing(): number {
    return this.activeCount;
  }

  /** Number of distributed requests currently being processed. */
  get distributedProcessing(): number {
    return this.distributedActiveCount;
  }

  /** Whether the orchestrator has any work (pending or active). */
  get isBusy(): boolean {
    return this.queue.length > 0 || this.activeCount > 0 || this.distributedActiveCount > 0;
  }

  /** Add an agent thought request to the queue. */
  enqueue(agent: Agent, contextText: string, isCritical = false): void {
    // Avoid duplicate enqueues for the same agent
    const alreadyQueued = this.queue.some((r) => r.agent.id === agent.id);
    if (alreadyQueued) return;

    this.queue.push({ agent, contextText, isCritical });
  }

  /**
   * Process up to `maxConcurrent` requests from the queue.
   *
   * Call this on each tick (or a subset of ticks). The method returns
   * immediately if no model is configured or the queue is empty.
   */
  async processQueue(): Promise<void> {
    if (!this.settings.ollamaModel || this.queue.length === 0) return;

    const slotsAvailable = this.settings.maxConcurrency - this.activeCount;
    if (slotsAvailable <= 0) return;

    const batch = this.queue.splice(0, slotsAvailable);
    const promises = batch.map((request) => this.processRequest(request));

    await Promise.allSettled(promises);
  }

  /** Process a single thought request, routing to local or distributed inference. */
  private async processRequest(request: ThoughtRequest): Promise<void> {
    try {
      const { agent, contextText, isCritical } = request;

      // Truncate lore-cache if over budget
      agent.loreCache = await truncateLoreCache(
        agent.loreCache,
        this.settings.tokenBudget,
        this.settings.ollamaModel,
      );

      // Retrieve top-3 relevant memories for context enrichment
      const memories = retrieveRelevantMemories(agent, contextText, 3);

      // Build the prompt from the template, including relevant memories
      const prompt = buildMutationPrompt(agent, contextText, memories);

      // Classify the request for routing
      const inferenceReq = classifyInferenceRequest(agent.id, prompt, isCritical);

      let rawResponse: string | null;

      if (this.shouldUseDistributed(inferenceReq.priority)) {
        rawResponse = await this.dispatchDistributed(prompt, inferenceReq.priority);
      } else {
        // Local Ollama path (original behavior)
        this.activeCount++;
        try {
          rawResponse = await generateCompletion(this.settings.ollamaModel, prompt);
        } finally {
          this.activeCount--;
        }
      }

      if (!rawResponse) return;

      // Parse the response
      const update = parseDNAResponse(rawResponse);
      if (!update) {
        console.warn(`[BRAIN-DEV] Failed to parse LLM response for agent ${agent.id}`);
        return;
      }

      // Apply the mutation
      applyDNAUpdate(agent, update);
    } catch (error) {
      console.error(`[BRAIN-DEV] Thought processing failed for agent ${request.agent.id}:`, error);
    }
  }

  /** Determine if a request should use distributed inference. */
  private shouldUseDistributed(priority: 'standard' | 'critical'): boolean {
    // Critical events use God Mode if the model is configured and peers are available
    if (priority === 'critical' && this.distributedConfig.godModeModel) {
      return this.peerCapabilities.some((c) => c.available);
    }

    // Standard requests can be offloaded if peers have capacity and we're under the limit
    if (
      priority === 'standard' &&
      this.distributedActiveCount < this.distributedConfig.maxDistributedConcurrency &&
      this.peerCapabilities.some((c) => c.available)
    ) {
      const loadMap = computePeerLoad(this.peerCapabilities, this.peerActiveRequests);
      const bestPeer = selectInferencePeer(
        { agentId: '', prompt: '', priority: 'standard' },
        this.peerCapabilities,
        loadMap,
      );
      return bestPeer !== 'local';
    }

    return false;
  }

  /** Dispatch a prompt to the distributed Petals swarm. */
  private async dispatchDistributed(
    prompt: string,
    priority: 'standard' | 'critical',
  ): Promise<string | null> {
    const loadMap = computePeerLoad(this.peerCapabilities, this.peerActiveRequests);
    const targetPeer = selectInferencePeer(
      { agentId: '', prompt, priority },
      this.peerCapabilities,
      loadMap,
    );

    if (targetPeer === 'local') {
      // Fallback to local when no peer available
      this.activeCount++;
      try {
        return await generateCompletion(this.settings.ollamaModel, prompt);
      } finally {
        this.activeCount--;
      }
    }

    const model = priority === 'critical'
      ? this.distributedConfig.godModeModel
      : (this.distributedConfig.standardModel || this.settings.ollamaModel);

    this.distributedActiveCount++;
    this.peerActiveRequests.set(targetPeer, (this.peerActiveRequests.get(targetPeer) ?? 0) + 1);

    try {
      return await generateDistributed(model, prompt);
    } finally {
      this.distributedActiveCount--;
      const current = this.peerActiveRequests.get(targetPeer) ?? 1;
      if (current <= 1) {
        this.peerActiveRequests.delete(targetPeer);
      } else {
        this.peerActiveRequests.set(targetPeer, current - 1);
      }
    }
  }


  /** Clear all pending requests. */
  clearQueue(): void {
    this.queue = [];
  }
}

