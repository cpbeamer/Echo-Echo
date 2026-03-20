/**
 * Simulation Store – Svelte 5 reactive state for the game simulation.
 *
 * Uses Svelte 5 runes ($state) for reactive primitives.
 * The store owns the agent array, tick counter, simulation speed,
 * and the currently selected agent.
 */

import type { Agent, DataBomb, DataBombRecord, SimulationConfig, Shockwave, Faction, LingoSwapBubble, LingoLeaderboardEntry, MemeSwapResult } from '../../types';
import { DEFAULT_CONFIG } from '../../types';
import { createAgents } from '../../engine/agent-factory';
import { tickPhysics } from '../../engine/physics';
import { processMemeSwaps } from '../../engine/meme-swap';
import { detectConflicts, resolveConflict } from '../../engine/conflict';
import { detonateDataBomb, detonateAmnesiaBomb } from '../../engine/blast-radius';
import { ThoughtOrchestrator } from '../../engine/thought-orchestrator';
import {
  tickEnergy,
  updateAdjacencyTicks,
  tickReproduction,
  applyNaturalSelection,
} from '../../engine/lifecycle';
import {
  computeFactionProgress,
  checkContestedSector,
  startManifestoDefusal,
} from '../../engine/faction-warfare';
import { brainSettings } from './brain-settings.svelte';
import { newsfeed } from './newsfeed.svelte';
import { networking } from './networking.svelte';
import { computeLingoLeaderboard } from '../../engine/lingo-leaderboard';

export type SimulationSpeed = 0 | 1 | 2 | 5;

/** How often (in ticks) to enqueue agents for LLM thought when auto-think is on. */
const AUTO_THINK_INTERVAL = 20;

/** How many agents to enqueue per auto-think cycle. */
const AUTO_THINK_BATCH_SIZE = 5;

/** Duration of the shockwave animation in render frames (~0.5s at 60fps). */
const SHOCKWAVE_FRAMES = 30;

/** Duration of the death dissolve animation in simulation ticks. */
const DEATH_ANIM_TICKS = 20;

/** How often to capture a population snapshot (in ticks). */
const POPULATION_SNAPSHOT_INTERVAL = 10;

/** Maximum population history entries retained. */
const MAX_POPULATION_HISTORY = 200;

/** How often to run reproduction checks (in ticks). */
const REPRODUCTION_INTERVAL = 10;

/** How often to recompute faction progress (in ticks). */
const FACTION_PROGRESS_INTERVAL = 50;

/** How often to recompute the lingo leaderboard (in ticks). */
const LEADERBOARD_INTERVAL = 50;

/** Duration of the lingo swap bubble float animation (in sim ticks). */
const LINGO_BUBBLE_FRAMES = 30;

/** Max concurrent lingo bubbles to prevent visual clutter. */
const MAX_LINGO_BUBBLES = 20;

let nextBombId = 0;
let nextBubbleId = 0;

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

  /** Active lingo swap bubble animations rendered on the canvas. */
  activeLingoSwaps: LingoSwapBubble[] = $state([]);

  /** Global lingo leaderboard: top 10 most viral terms. */
  lingoLeaderboard: LingoLeaderboardEntry[] = $state([]);

  /** Population history ring buffer: snapshots sampled every POPULATION_SNAPSHOT_INTERVAL ticks. */
  populationHistory: { tick: number; alive: number; births: number; deaths: number }[] = $state([]);

  /** Running counters for current snapshot interval (reset every POPULATION_SNAPSHOT_INTERVAL). */
  private birthsSinceSnapshot: number = 0;
  private deathsSinceSnapshot: number = 0;

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
    return this.agents.filter((a) => a.energy > 0 && a.deathFrame === null);
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
    this.populationHistory = [];
    this.birthsSinceSnapshot = 0;
    this.deathsSinceSnapshot = 0;
    this.activeLingoSwaps = [];
    this.lingoLeaderboard = [];
    newsfeed.clear();
    nextBombId = 0;
    nextBubbleId = 0;
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
    const bombType = bomb.type ?? 'standard';
    const isManifesto = bombType === 'manifesto';

    // Manifesto bombs use amplified radius and mutation delta
    const effectiveRadius = isManifesto
      ? bomb.radius * this.config.manifestoRadiusMultiplier
      : bomb.radius;

    const effectiveDelta = isManifesto
      ? 0.05 * this.config.manifestoDeltaMultiplier
      : undefined;

    const effectiveBomb: DataBomb = { ...bomb, radius: effectiveRadius };

    let affectedIds: string[];
    if (bombType === 'amnesia') {
      affectedIds = detonateAmnesiaBomb(this.agents, effectiveBomb);
    } else {
      // standard, pdf, url, and manifesto all use text-based mutation
      affectedIds = detonateDataBomb(this.agents, effectiveBomb, effectiveDelta);
    }

    const record: DataBombRecord = {
      ...bomb,
      id: `bomb-${nextBombId++}`,
      timestamp: Date.now(),
      affectedAgentIds: affectedIds,
      contentPreview:
        bombType === 'amnesia'
          ? '[Amnesia Bomb]'
          : bomb.text.slice(0, 80).replace(/\n/g, ' '),
    };

    // Newest first
    this.dataBombHistory = [record, ...this.dataBombHistory];

    // Spawn a shockwave animation (manifesto = red, others = default)
    this.activeShockwaves = [
      ...this.activeShockwaves,
      {
        center: { ...bomb.target },
        maxRadius: effectiveRadius,
        frame: 0,
        totalFrames: SHOCKWAVE_FRAMES,
        ...(isManifesto ? { color: 0xff2222 } : {}),
      },
    ];

    this.isPickingTarget = false;

    // Manifesto defusal: if dropped in a contested sector, start defusal (Epic 3.2)
    if (isManifesto && checkContestedSector(this.agents)) {
      const defusal = startManifestoDefusal(
        record.id,
        networking.activeSectorId ?? 'local',
        // The manifesto favors the faction most represented among affected agents
        this.dominantFactionAmong(affectedIds),
        networking.warfareConfig,
      );
      networking.addDefusal(defusal);
    }

    // Newsfeed event
    if (bombType === 'amnesia') {
      newsfeed.push({
        type: 'amnesia_bomb',
        message: `🧹 Amnesia bomb wiped ${affectedIds.length} agents at (${Math.round(bomb.target.x)}, ${Math.round(bomb.target.y)})`,
        affectedCount: affectedIds.length,
        target: { ...bomb.target },
      });
    } else if (isManifesto) {
      newsfeed.push({
        type: 'manifesto_bomb',
        message: `📜 Manifesto bomb hit ${affectedIds.length} agents at (${Math.round(bomb.target.x)}, ${Math.round(bomb.target.y)}) with 2× force`,
        affectedCount: affectedIds.length,
        target: { ...bomb.target },
      });
    } else {
      const emoji = bombType === 'pdf' ? '📄' : bombType === 'url' ? '🔗' : '💣';
      newsfeed.push({
        type: 'data_bomb',
        message: `${emoji} Data bomb hit ${affectedIds.length} agents at (${Math.round(bomb.target.x)}, ${Math.round(bomb.target.y)})`,
        affectedCount: affectedIds.length,
        target: { ...bomb.target },
      });
    }
  }

  /** Highlight agents from a specific data bomb record. */
  highlightBombAgents(agentIds: string[]): void {
    this.highlightedAgentIds = new Set(agentIds);
  }

  /** Clear any agent highlights. */
  clearHighlights(): void {
    this.highlightedAgentIds = new Set();
  }

  /**
   * Determine the dominant faction among a set of agent IDs.
   * Used by manifesto defusal to identify which faction the bomb favors.
   */
  private dominantFactionAmong(agentIds: string[]): Faction {
    const counts: Record<string, number> = {};
    // Pre-build lookup for O(1) access by ID
    const agentById: Record<string, Agent> = {};
    for (const agent of this.agents) {
      agentById[agent.id] = agent;
    }

    for (const id of agentIds) {
      const agent = agentById[id];
      if (agent && agent.faction !== 'unaligned') {
        counts[agent.faction] = (counts[agent.faction] ?? 0) + 1;
      }
    }

    let best: Faction = 'unaligned';
    let bestCount = 0;
    for (const [faction, count] of Object.entries(counts)) {
      if (count > bestCount) {
        best = faction as Faction;
        bestCount = count;
      }
    }
    return best;
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

    // Track agents killed by conflict this tick for accurate death-cause attribution
    const conflictKilledIds = new Set<string>();

    // Physics
    tickPhysics(this.agents, 1, this.config);

    // Energy depletion (every tick)
    tickEnergy(this.agents, this.config);

    // Natural selection pressure (every tick, no-op if disabled)
    applyNaturalSelection(this.agents, this.config);

    // Adjacency tracking (every tick)
    updateAdjacencyTicks(this.agents);

    // Meme swaps (every 5th tick to reduce CPU)
    if (this.tick % 5 === 0) {
      const swapResults: MemeSwapResult[] = processMemeSwaps(this.aliveAgents);
      if (swapResults.length > 0) {
        newsfeed.push({
          type: 'meme_swap',
          message: `🔄 ${swapResults.length} meme swap${swapResults.length > 1 ? 's' : ''} this tick`,
          swapCount: swapResults.length,
        });

        // Spawn lingo bubble animations for visible swaps
        this.spawnLingoBubbles(swapResults);
      }
    }

    // Reproduction (every REPRODUCTION_INTERVAL ticks)
    if (this.tick % REPRODUCTION_INTERVAL === 0 && this.tick > 0) {
      const newborns = tickReproduction(this.agents, this.tick, this.config);
      if (newborns.length > 0) {
        this.agents = [...this.agents, ...newborns];
        this.birthsSinceSnapshot += newborns.length;

        for (const child of newborns) {
          newsfeed.push({
            type: 'agent_birth',
            message: `🐣 Agent #${child.id.slice(-4)} born from ${child.parentIds![0].slice(-4)} × ${child.parentIds![1].slice(-4)}`,
            parentIds: child.parentIds!,
            childId: child.id,
          });
        }
      }
    }

    // Conflict detection (every 10th tick)
    if (this.tick % 10 === 0) {
      const conflicts = detectConflicts(this.aliveAgents);
      for (const conflict of conflicts) {
        const consumedIds = resolveConflict(conflict);
        // Mark conflict-killed agents so death detection can assign the correct cause
        for (const id of consumedIds) {
          conflictKilledIds.add(id);
        }
        newsfeed.push({
          type: 'conflict',
          message: `⚔️ Conflict between ${conflict.dominant.length + conflict.submissive.length} agents`,
          agentIds: [...conflict.dominant.map((a) => a.id), ...conflict.submissive.map((a) => a.id)],
        });
      }
    }

    // Detect newly dead agents and start their death animation (runs every tick
    // so energy-depletion deaths are caught immediately, not just every 10th tick)
    for (const agent of this.agents) {
      if (agent.energy <= 0 && agent.deathFrame === null) {
        agent.deathFrame = 0;
        this.deathsSinceSnapshot++;

        const cause = conflictKilledIds.has(agent.id) ? 'conflict' : 'energy_depleted';
        conflictKilledIds.delete(agent.id);
        newsfeed.push({
          type: 'agent_death',
          message: `💀 Agent #${agent.id.slice(-4)} perished (${cause})`,
          agentId: agent.id,
          cause,
        });
      }
    }

    // Advance death animations and remove fully dissolved agents
    for (const agent of this.agents) {
      if (agent.deathFrame !== null) {
        agent.deathFrame++;
      }
    }
    this.agents = this.agents.filter(
      (a) => a.deathFrame === null || a.deathFrame < DEATH_ANIM_TICKS,
    );

    // Population history snapshot
    if (this.tick % POPULATION_SNAPSHOT_INTERVAL === 0) {
      this.populationHistory = [
        ...this.populationHistory,
        {
          tick: this.tick,
          alive: this.aliveAgents.length,
          births: this.birthsSinceSnapshot,
          deaths: this.deathsSinceSnapshot,
        },
      ].slice(-MAX_POPULATION_HISTORY);

      this.birthsSinceSnapshot = 0;
      this.deathsSinceSnapshot = 0;
    }

    // Auto-think: enqueue a random batch of agents for LLM thought
    if (brainSettings.settings.autoThink && this.tick % AUTO_THINK_INTERVAL === 0) {
      const alive = this.aliveAgents;
      const batchSize = Math.min(AUTO_THINK_BATCH_SIZE, alive.length);
      const shuffled = [...alive].sort(() => Math.random() - 0.5);
      for (let i = 0; i < batchSize; i++) {
        shuffled[i].activityLevel = 1.0;
        this.orchestrator.enqueue(shuffled[i], '');
      }
    }

    // Decay activity levels back to idle over time
    for (const agent of this.agents) {
      if (agent.activityLevel > 0) {
        agent.activityLevel = Math.max(0, agent.activityLevel - 0.02);
      }
    }

    // Process the thought queue (non-blocking, async)
    void this.orchestrator.processQueue();

    // Update HUD-facing counters
    this.thoughtsPending = this.orchestrator.pendingCount;
    this.thoughtsProcessing = this.orchestrator.processing;

    // Faction warfare progress (Epic 3.2)
    if (this.tick % FACTION_PROGRESS_INTERVAL === 0 && this.tick > 0) {
      const updatedProgress = computeFactionProgress(
        this.agents,
        networking.factionProgress,
        networking.computeBoosts,
        networking.warfareConfig,
      );
      networking.updateFactionProgress(updatedProgress);
    }

    // Advance shockwave animations
    if (this.activeShockwaves.length > 0) {
      this.activeShockwaves = this.activeShockwaves
        .map((sw) => ({ ...sw, frame: sw.frame + 1 }))
        .filter((sw) => sw.frame < sw.totalFrames);
    }

    // Advance lingo swap bubble animations and remove completed ones
    if (this.activeLingoSwaps.length > 0) {
      this.activeLingoSwaps = this.activeLingoSwaps
        .map((b) => ({ ...b, frame: b.frame + 1 }))
        .filter((b) => b.frame < b.totalFrames);
    }

    // Lingo leaderboard recomputation (Epic 4.0)
    if (this.tick % LEADERBOARD_INTERVAL === 0) {
      this.lingoLeaderboard = computeLingoLeaderboard(
        this.aliveAgents,
        this.lingoLeaderboard,
      );
    }

    this.tick++;
  }

  /**
   * Spawn floating lingo bubbles from successful meme swap results.
   * Limits total active bubbles to avoid visual clutter.
   */
  private spawnLingoBubbles(results: MemeSwapResult[]): void {
    // Build a quick lookup for agent positions
    const positionById = new Map<string, { x: number; y: number }>();
    for (const agent of this.agents) {
      positionById.set(agent.id, { x: agent.position.x, y: agent.position.y });
    }

    const newBubbles: LingoSwapBubble[] = [];

    for (const result of results) {
      const fromPos = positionById.get(result.fromId);
      const toPos = positionById.get(result.toId);
      if (!fromPos || !toPos) continue;

      // Create a bubble for each term given (A → B)
      for (const term of result.termsGiven) {
        if (this.activeLingoSwaps.length + newBubbles.length >= MAX_LINGO_BUBBLES) break;
        newBubbles.push({
          id: `lb-${nextBubbleId++}`,
          term,
          fromPosition: { ...fromPos },
          toPosition: { ...toPos },
          frame: 0,
          totalFrames: LINGO_BUBBLE_FRAMES,
        });
      }

      // Create a bubble for each term received (B → A)
      for (const term of result.termsReceived) {
        if (this.activeLingoSwaps.length + newBubbles.length >= MAX_LINGO_BUBBLES) break;
        newBubbles.push({
          id: `lb-${nextBubbleId++}`,
          term,
          fromPosition: { ...toPos },
          toPosition: { ...fromPos },
          frame: 0,
          totalFrames: LINGO_BUBBLE_FRAMES,
        });
      }
    }

    if (newBubbles.length > 0) {
      this.activeLingoSwaps = [...this.activeLingoSwaps, ...newBubbles];
    }
  }
}

export const simulation = new SimulationState();
