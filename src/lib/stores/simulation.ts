/**
 * Simulation Store – Svelte 5 reactive state for the game simulation.
 *
 * Uses Svelte 5 runes ($state) for reactive primitives.
 * The store owns the agent array, tick counter, simulation speed,
 * and the currently selected agent.
 */

import type { Agent, DataBomb, DataBombRecord, SimulationConfig, Shockwave } from '../../types';
import { DEFAULT_CONFIG } from '../../types';
import { createAgents } from '../../engine/agent-factory';
import { tickPhysics } from '../../engine/physics';
import { processMemeSwaps } from '../../engine/meme-swap';
import { detectConflicts, resolveConflict } from '../../engine/conflict';
import { detonateDataBomb } from '../../engine/blast-radius';
import { ThoughtOrchestrator } from '../../engine/thought-orchestrator';
import { brainSettings } from './brain-settings';
import { newsfeed } from './newsfeed';

export type SimulationSpeed = 0 | 1 | 2 | 5;

/** How often (in ticks) to enqueue agents for LLM thought when auto-think is on. */
const AUTO_THINK_INTERVAL = 20;

/** How many agents to enqueue per auto-think cycle. */
const AUTO_THINK_BATCH_SIZE = 5;

/** Duration of the shockwave animation in render frames (~0.5s at 60fps). */
const SHOCKWAVE_FRAMES = 30;

let nextBombId = 0;

class SimulationState {
  agents: Agent[] = $state([]);
  tick: number = $state(0);
  speed: SimulationSpeed = $state(1);
  selectedAgentId: string | null = $state(null);
  config: SimulationConfig = $state({ ...DEFAULT_CONFIG });
  isRunning: boolean = $state(false);

  /** The brain's thought queue stats, exposed for HUD. */
  thoughtsPending: number = $state(0);
  thoughtsProcessing: number = $state(0);

  /** Data bomb history log (newest first). */
  dataBombHistory: DataBombRecord[] = $state([]);

  /** Active shockwave animations rendered on the canvas. */
  activeShockwaves: Shockwave[] = $state([]);

  /** When true, the next grid click sets a bomb drop target instead of selecting an agent. */
  isPickingTarget: boolean = $state(false);

  /** Agent IDs currently highlighted (e.g. from history hover). */
  highlightedAgentIds: Set<string> = $state(new Set());

  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private tickAccumulator: number = 0;
  private orchestrator: ThoughtOrchestrator;

  // Target: ~10 ticks/sec at 1× speed
  private readonly BASE_TICK_INTERVAL = 100;

  constructor() {
    this.orchestrator = new ThoughtOrchestrator(brainSettings.settings);
  }

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

  /** Average peace score across alive agents: mean of (1 - order_chaos). */
  get averagePeaceScore(): number {
    const alive = this.aliveAgents;
    if (alive.length === 0) return 0;
    const sum = alive.reduce((acc, a) => acc + (1 - a.vector.order_chaos), 0);
    return sum / alive.length;
  }

  /** Initialize the simulation with a fresh set of agents. */
  initialize(config: SimulationConfig = this.config): void {
    this.config = { ...config };
    this.agents = createAgents(config.agentCount, config);
    this.tick = 0;
    this.selectedAgentId = null;
    this.orchestrator.clearQueue();
    this.dataBombHistory = [];
    this.activeShockwaves = [];
    this.highlightedAgentIds = new Set();
    newsfeed.clear();
    nextBombId = 0;
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

  /** Enqueue a specific agent for a thought request (manual trigger). */
  enqueueThought(agent: Agent, contextText: string): void {
    this.orchestrator.enqueue(agent, contextText);
  }

  /** Enable target-picking mode for the grid. */
  startTargetPick(): void {
    this.isPickingTarget = true;
  }

  /** Cancel target-picking mode without dropping a bomb. */
  cancelTargetPick(): void {
    this.isPickingTarget = false;
  }

  /**
   * Drop a data bomb on the grid.
   * Detonates immediately, records to history, and spawns a shockwave.
   */
  dropDataBomb(bomb: DataBomb): void {
    const affectedIds = detonateDataBomb(this.agents, bomb);

    const record: DataBombRecord = {
      ...bomb,
      id: `bomb-${nextBombId++}`,
      timestamp: Date.now(),
      affectedAgentIds: affectedIds,
      contentPreview: bomb.text.slice(0, 80).replace(/\n/g, ' '),
    };

    // Newest first
    this.dataBombHistory = [record, ...this.dataBombHistory];

    // Spawn a shockwave animation
    this.activeShockwaves = [
      ...this.activeShockwaves,
      {
        center: { ...bomb.target },
        maxRadius: bomb.radius,
        frame: 0,
        totalFrames: SHOCKWAVE_FRAMES,
      },
    ];

    this.isPickingTarget = false;

    // Newsfeed event
    newsfeed.push({
      type: 'data_bomb',
      message: `💣 Data bomb hit ${affectedIds.length} agents at (${Math.round(bomb.target.x)}, ${Math.round(bomb.target.y)})`,
      affectedCount: affectedIds.length,
      target: { ...bomb.target },
    });
  }

  /** Highlight agents from a specific data bomb record. */
  highlightBombAgents(agentIds: string[]): void {
    this.highlightedAgentIds = new Set(agentIds);
  }

  /** Clear any agent highlights. */
  clearHighlights(): void {
    this.highlightedAgentIds = new Set();
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
    // Keep orchestrator settings in sync
    this.orchestrator.updateSettings(brainSettings.settings);

    // Physics
    tickPhysics(this.agents, 1, this.config);

    // Meme swaps (every 5th tick to reduce CPU)
    if (this.tick % 5 === 0) {
      const swapCount = processMemeSwaps(this.aliveAgents);
      if (swapCount > 0) {
        newsfeed.push({
          type: 'meme_swap',
          message: `🔄 ${swapCount} meme swap${swapCount > 1 ? 's' : ''} this tick`,
          swapCount,
        });
      }
    }

    // Conflict detection (every 10th tick)
    if (this.tick % 10 === 0) {
      const conflicts = detectConflicts(this.aliveAgents);
      for (const conflict of conflicts) {
        resolveConflict(conflict);
        newsfeed.push({
          type: 'conflict',
          message: `⚔️ Conflict between ${conflict.dominant.length + conflict.submissive.length} agents`,
          agentIds: [...conflict.dominant.map((a) => a.id), ...conflict.submissive.map((a) => a.id)],
        });
      }

      // Detect and log agent deaths, then remove dead agents
      const deadAgents = this.agents.filter((a) => a.energy <= 0);
      for (const dead of deadAgents) {
        newsfeed.push({
          type: 'agent_death',
          message: `💀 Agent #${dead.id.slice(-4)} perished`,
          agentId: dead.id,
          cause: 'conflict',
        });
      }
      this.agents = this.agents.filter((a) => a.energy > 0);
    }

    // Auto-think: enqueue a random batch of agents for LLM thought
    if (brainSettings.settings.autoThink && this.tick % AUTO_THINK_INTERVAL === 0) {
      const alive = this.aliveAgents;
      const batchSize = Math.min(AUTO_THINK_BATCH_SIZE, alive.length);
      const shuffled = [...alive].sort(() => Math.random() - 0.5);
      for (let i = 0; i < batchSize; i++) {
        this.orchestrator.enqueue(shuffled[i], '');
      }
    }

    // Process the thought queue (non-blocking, async)
    void this.orchestrator.processQueue();

    // Update HUD-facing counters
    this.thoughtsPending = this.orchestrator.pendingCount;
    this.thoughtsProcessing = this.orchestrator.processing;

    // Advance shockwave animations
    if (this.activeShockwaves.length > 0) {
      this.activeShockwaves = this.activeShockwaves
        .map((sw) => ({ ...sw, frame: sw.frame + 1 }))
        .filter((sw) => sw.frame < sw.totalFrames);
    }

    this.tick++;
  }
}

export const simulation = new SimulationState();
