# Synaptic Sandbox

A god-perspective 2D social evolution simulator where autonomous AI agents develop their own cultures, slang, and ideologies. Players don't control agents directly — they shape the information environment by dropping "Data Bombs" and watching emergent behavior unfold.

Part RimWorld, part Plague Inc., part Twitter/X — built entirely on local-first compute.

## How It Works

1. **Observe** — Watch autonomous "Thought-Forms" interact on a 2D grid
2. **Intervene** — Drop Data Bombs (text, PDFs, URLs) into agent clusters
3. **Mutation** — Agents process the data through a local LLM and evolve their DNA
4. **Infection** — New ideologies and slang spread to neighboring agents
5. **Conflict** — Opposing factions collide, consume, reproduce, and die

Agents are classified into four factions based on their DNA vectors:

| Faction | Traits |
|---------|--------|
| **Hive** | Emotional, Altruistic, Order |
| **Void** | Analytical, Selfish, Chaos |
| **Citadel** | Analytical, Altruistic, Order |
| **Fringe** | Emotional, Selfish, Chaos |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Shell | Tauri 2.0 (Rust) |
| UI | SvelteKit 2 / Svelte 5 |
| Graphics | PixiJS 8 (WebGPU) |
| Local LLM | Ollama + Llama 3.2 |
| Networking | LibP2P (P2P multiplayer) |
| Distributed LLM | Petals (optional, for 70B+ models) |
| Build Tool | Vite 6 |
| Testing | Vitest + jsdom |

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://www.rust-lang.org/tools/install) 1.70+
- [Ollama](https://ollama.ai/) >= 0.5.0 (for local LLM inference)
- Platform-specific system libraries:
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, `libgtk-3-dev`
  - **Windows**: Visual C++ Build Tools

## Getting Started

```bash
# Install frontend dependencies
npm install

# Fetch Rust dependencies
cd src-tauri && cargo fetch && cd ..

# Pull the default LLM model
ollama pull llama3.2:1b

# Start the dev server
npm run tauri dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Start Tauri app in dev mode with hot-reload |
| `npm run tauri build` | Build native binary for your platform |
| `npm run test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run check` | TypeScript type checking via svelte-check |

Rust checks (run from `src-tauri/`):

```bash
cargo clippy -- -D warnings
cargo fmt --check
cargo test
```

## Project Structure

```
src/
  routes/          SvelteKit page routes
  engine/          Framework-agnostic game logic (agents, physics, factions, networking)
  lib/components/  Svelte UI components (Grid, HUD panels, settings)
  lib/stores/      Svelte 5 reactive stores
  types/           Shared TypeScript interfaces
src-tauri/
  src/             Rust backend (Ollama client, PDF extraction, P2P networking)
tests/             Vitest test suites
static/            Static assets
.github/workflows/ CI pipeline
```

## Game Modes

- **The Lab** — Single-player sandbox. Spawn agents, drop data bombs, observe evolution.
- **The Frontier** — Multiplayer persistent world. Sectors hosted peer-to-peer, agents migrate between them, factions compete for dominance.

## Key Features

- **Agent DNA** — 3-axis vector (Analytical/Emotional, Altruistic/Selfish, Order/Chaos) that determines behavior and faction
- **Data Bombs** — Drop text, PDFs, or URLs onto agents to mutate their beliefs. Includes amnesia bombs and manifesto bombs
- **Meme Swap** — Agents exchange culturally-evolved slang with neighbors
- **Lingo Cloud** — Real-time word cloud of emergent agent vocabulary
- **Agent Lifecycle** — Birth, reproduction, energy decay, and death driven by natural selection
- **DNA Export/Import** — Save agent "cults" as `.dna` files and import them as invaders
- **Distributed Inference** — Optional Petals integration for sharing high-tier models across peers
- **Local-First** — All inference runs on your hardware. No cloud API keys required.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for module naming conventions, branch strategy, and coding standards.

## License

[MIT](./LICENSE)
