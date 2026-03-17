/**
 * Thought Orchestrator – queues and rate-limits agent "thought requests" to Ollama.
 *
 * Manages a FIFO queue of agents waiting to "think." On each tick, up to
 * `maxConcurrent` requests are dispatched in parallel. Results are parsed
 * via DNAParser and applied via applyDNAUpdate().
 */

import type { Agent } from '../types';
import type { BrainSettings } from '../types/brain';
import { generateCompletion } from './ollama-client';
import { parseDNAResponse } from './dna-parser';
import { applyDNAUpdate } from './dna-mutation';
import { truncateLoreCache } from './context-truncator';

// The prompt template is loaded as a static string at build time.
// We inline it here to avoid dynamic file reads at runtime.
import { buildMutationPrompt } from './prompt-builder';

/** A pending thought request in the queue. */
interface ThoughtRequest {
  agent: Agent;
  contextText: string;
}

export class ThoughtOrchestrator {
  private queue: ThoughtRequest[] = [];
  private activeCount = 0;
  private settings: BrainSettings;

  constructor(settings: BrainSettings) {
    this.settings = settings;
  }

  /** Update the settings reference (e.g., when user changes concurrency). */
  updateSettings(settings: BrainSettings): void {
    this.settings = settings;
  }

  /** Number of requests waiting in the queue. */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Number of requests currently being processed. */
  get processing(): number {
    return this.activeCount;
  }

  /** Whether the orchestrator has any work (pending or active). */
  get isBusy(): boolean {
    return this.queue.length > 0 || this.activeCount > 0;
  }

  /** Add an agent thought request to the queue. */
  enqueue(agent: Agent, contextText: string): void {
    // Avoid duplicate enqueues for the same agent
    const alreadyQueued = this.queue.some((r) => r.agent.id === agent.id);
    if (alreadyQueued) return;

    this.queue.push({ agent, contextText });
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

  /** Process a single thought request. */
  private async processRequest(request: ThoughtRequest): Promise<void> {
    this.activeCount++;

    try {
      const { agent, contextText } = request;

      // Truncate lore-cache if over budget
      agent.loreCache = await truncateLoreCache(
        agent.loreCache,
        this.settings.tokenBudget,
        this.settings.ollamaModel,
      );

      // Build the prompt from the template
      const prompt = buildMutationPrompt(agent, contextText);

      // Send to Ollama
      const rawResponse = await generateCompletion(this.settings.ollamaModel, prompt);
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
    } finally {
      this.activeCount--;
    }
  }

  /** Clear all pending requests. */
  clearQueue(): void {
    this.queue = [];
  }
}
