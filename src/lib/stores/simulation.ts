/**
 * Simulation Store – Svelte 5 reactive state for the game simulation.
 *
 * Uses Svelte 5 runes ($state) for reactive primitives.
 * The store owns the agent array, tick counter, simulation speed,
 * and the currently selected agent.
 */

import type { Agent, SimulationConfig } from '../../types';
import { DEFAULT_CONFIG } from '../../types';
import { createAgents } from '../../engine/agent-factory';
import { tickPhysics } from '../../engine/physics';
import { processMemeSwaps } from '../../engine/meme-swap';
import { detectConflicts, resolveConflict } from '../../engine/conflict';

export type SimulationSpeed = 0 | 1 | 2 | 5;

class SimulationState {
  agents: Agent[] = $state([]);
  tick: number = $state(0);
  speed: SimulationSpeed = $state(1);
  selectedAgentId: string | null = $state(null);
  config: SimulationConfig = $state({ ...DEFAULT_CONFIG });
  isRunning: boolean = $state(false);

  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private tickAccumulator: number = 0;

  // Target: ~10 ticks/sec at 1× speed
  private readonly BASE_TICK_INTERVAL = 100;

  get selectedAgent(): Agent | undefined {
    return this.agents.find((a) => a.id === this.selectedAgentId);
  }

  get aliveAgents(): Agent[] {
    return this.agents.filter((a) => a.energy > 0);
  }

  get factionCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const agent of this.aliveAgents) {
      counts[agent.faction] = (counts[agent.faction] ?? 0) + 1;
    }
    return counts;
  }

  /** Initialize the simulation with a fresh set of agents. */
  initialize(config: SimulationConfig = this.config): void {
    this.config = { ...config };
    this.agents = createAgents(config.agentCount, config);
    this.tick = 0;
    this.selectedAgentId = null;
  }

  /** Start the simulation loop. */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.tickAccumulator = 0;
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  /** Pause the simulation. */
  pause(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /** Advance exactly one tick (step-forward). */
  stepForward(): void {
    this.processTick();
  }

  /** Set simulation speed multiplier. */
  setSpeed(speed: SimulationSpeed): void {
    if (speed === 0) {
      this.pause();
    } else {
      this.speed = speed;
      if (!this.isRunning) this.start();
    }
  }

  /** Select an agent by ID (or deselect if null). */
  selectAgent(id: string | null): void {
    this.selectedAgentId = id;
  }

  /** The main game loop, driven by requestAnimationFrame. */
  private loop(timestamp: number): void {
    if (!this.isRunning) return;

    const elapsed = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.tickAccumulator += elapsed * this.speed;

    // Process as many ticks as accumulated
    while (this.tickAccumulator >= this.BASE_TICK_INTERVAL) {
      this.processTick();
      this.tickAccumulator -= this.BASE_TICK_INTERVAL;
    }

    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  /** Process a single simulation tick. */
  private processTick(): void {
    // Physics
    tickPhysics(this.agents, 1, this.config);

    // Meme swaps (every 5th tick to reduce CPU)
    if (this.tick % 5 === 0) {
      processMemeSwaps(this.aliveAgents);
    }

    // Conflict detection (every 10th tick)
    if (this.tick % 10 === 0) {
      const conflicts = detectConflicts(this.aliveAgents);
      for (const conflict of conflicts) {
        resolveConflict(conflict);
      }
      // Remove dead agents
      this.agents = this.agents.filter((a) => a.energy > 0);
    }

    this.tick++;
  }
}

export const simulation = new SimulationState();
