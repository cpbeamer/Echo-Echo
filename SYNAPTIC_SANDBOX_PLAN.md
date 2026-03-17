# 📜 Project: Synaptic Sandbox – Master System Design Document

**Status:** Draft / Alpha Phase  
**Version:** 1.0  
**Project Lead:** User (The Architect)  
**Implementation Team:** AI Agent Swarm

---

## 1. The Core Vision (The Theme)

Synaptic Sandbox is a "God-perspective" 2D social evolution simulator. It is part RimWorld, part Plague Inc., and part Twitter (X). The game is a petri dish for "Thought-Forms"—autonomous agents that evolve their own cultures, languages, and ideologies based on "Data Bombs" dropped by the player.

### The "Hook"

Players don't control the agents; they influence the information environment. You are a scientist (Single Player) or a competing Ideology (Multiplayer) fighting for control over the "Global Narrative."

---

## 2. World Design & Gameplay Loop

### 2.1 Game Modes

- **The Lab (Single Player):** A private, local-compute petri dish. Used for experimentation and "breeding" specific agent DNAs.
- **The Frontier (Multiplayer):** A persistent, shard-based world.
  - **The Expansion:** The world map grows dynamically. For every N new users, a new "Sector" is generated and hosted across their distributed GPUs.
  - **The War:** Players use their local compute to "boost" the influence of their faction in the global grid.

### 2.2 Gameplay Loop

1. **Observation:** Watch agents interact on a 2D grid.
2. **Intervention:** Drop a "Data Bomb" (PDF, Text, URL).
3. **Mutation:** Agents in the blast radius process the data, updating their "DNA" (System Prompt).
4. **Infection:** Radicalized agents spread their new ideology to neighbors via "Meme Swapping."
5. **Conflict:** When ideologies clash, the grid enters a "Conflict State" (visualized as clusters physically colliding and "consuming" each other).

---

## 3. Social Dynamics & Factions

### 3.1 The DNA Structure

Each agent's brain is a persistent state defined by:

- **Vector [A-E]:** Numerical scores for Analytical vs. Emotional, Altruistic vs. Selfish, Order vs. Chaos.
- **Lore-Cache:** A short-term memory of the last 10 significant interactions.
- **Current Lingo:** A dictionary of "slang" the agent uses and spreads.

### 3.2 Factions (The Archetypes)

| Faction      | Behavior                    | "Victory" Condition                                    |
| ------------ | --------------------------- | ------------------------------------------------------ |
| **The Hive** | Radical Collectivism.       | Total homogeneity of the Sector.                       |
| **The Void** | Aggressive Nihilism.        | Destruction of all lingo and social bonds.             |
| **The Citadel** | Rigid Logic/Bureaucracy. | Maximum efficiency and zero "drift" in DNA.            |
| **The Fringe** | Cult-like, isolationist.  | Survive as a minority without being "consumed."        |

---

## 4. Technical Stack (The 2026 Engine)

| Layer        | Tech Choice               | Rationale                                                      |
| ------------ | ------------------------- | -------------------------------------------------------------- |
| **Shell**    | Tauri 2.0 (Rust)          | Native file access (Data Bombs) + LLM Sidecar.                |
| **Visuals**  | PixiJS 8 (WebGPU)         | 10k+ agents at 60fps with "wobble" shaders.                    |
| **State/UI** | Svelte 5                  | Reactive HUD for real-time "Lingo Clouds" and news feeds.      |
| **Local Brain** | Ollama / Llama-3.2-1B | Fast, free, local inference on the user's GPU.                 |
| **Global Brain** | Petals / P2P          | Distributed LLM for running high-tier models (70B+) as "God." |
| **Networking** | LibP2P                 | Peer-to-peer shard hosting and sector synchronization.         |

---

## 5. System Architecture (Component Map)

### Module A: The Grid (Frontend)

- **Physics Engine:** A simple spring-mass system for agent movement.
- **Heatmap Layer:** Visualizes "Ideology Density" across the grid.
- **The Newsfeed:** A real-time log of events (e.g., "Sector 7 has fallen to the Nihilist Plague").

### Module B: The Brain (Inference Engine)

- **Orchestrator:** Manages the queue of "Thought Requests."
- **DNA Parser:** Converts LLM output back into numerical DNA scores.
- **Context Truncator:** Ensures agents don't exceed token limits by summarizing long-term lore.

### Module C: The P2P Shard (Networking)

- **Node Role:** A user's machine acts as a "Sector Host" or a "Visitor."
- **Proof of Work:** Users "mine" influence by providing GPU cycles for inference tasks in the shared world.

---

## 6. MVP to Advanced Roadmap

### Phase 1: The "Grey Box" (MVP)

- Basic 2D grid with circles as agents.
- Single-player mode with local Ollama integration.
- "Text-only" Data Bombs.
- Simple "Lingo Cloud" overlay.

### Phase 2: The "Living World"

- PixiJS implementation with "funny" shaders (wobble, glow, ragdoll).
- Agent "Reproduction" and "Death."
- Multi-agent memory (Mem0 integration).

### Phase 3: The "Consciousness War" (Multiplayer)

- LibP2P shard hosting.
- Faction-based "Global Goal" tracker.
- High-weight "Manifesto" bombs that require community GPU power to "defuse."

---

## 7. Important Features (The "Cult Hit" Secret Sauce)

- **The Lingo-Gen:** Agents don't just use English. They should invent portmanteaus based on the data they "eat." If you bomb them with Star Wars and Marxism, they might start calling their leaders "General Sec-Jedis."
- **The Exportable DNA:** Players can save a "Cult" as a `.dna` file and post it online. Other players can "import" that cult into their sandbox as an "Invader" group.
- **The "Vibe" Score:** A global soundtrack that changes tempo and key based on the overall "Peace vs. War" state of the simulation.

---

## 8. Agent Instructions for Development

- **Reference Point:** Whenever building a sub-module, check Section 4 for the stack.
- **Naming Convention:** All agents must prefix logs with their module (e.g., `[GRID-DEV]`, `[BRAIN-DEV]`).
- **Constraint:** Prioritize Local-First compute at all times. No cloud API keys allowed unless explicitly requested.

---

*End of Document.*

> Would you like me to generate the first "Agent Task" for the **Module A: The Grid** setup in Rust/Tauri? Or should we start by writing the **"DNA Mutation Prompt"** for the LLM?
