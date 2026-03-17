# 🧠 Contributing to Synaptic Sandbox

Thank you for contributing to the Synaptic Sandbox project! This guide ensures consistent development practices across the team.

---

## Module Naming Conventions

All contributors (human or AI agent) must prefix logs and commit messages with their active module tag:

| Module | Tag | Scope |
|--------|-----|-------|
| Frontend / Rendering | `[GRID-DEV]` | Canvas, PixiJS, agent visuals, grid rendering |
| Inference Engine | `[BRAIN-DEV]` | Ollama integration, thought orchestration, DNA parsing |
| Networking / P2P | `[NET-DEV]` | LibP2P, sector hosting, state sync |
| Agent DNA & Factions | `[DNA-DEV]` | DNA structures, mutation logic, faction classification |
| HUD & Controls | `[UX-DEV]` | Observation layer, newsfeed, settings panels |
| Data Bombs & I/O | `[IO-DEV]` | File import/export, drop zones, blast logic |
| Audio & Vibe Score | `[AUDIO-DEV]` | Generative soundtrack, SFX |
| Infrastructure | `[INFRA-DEV]` | CI/CD, tooling, repo scaffolding |

### Example commit message

```
[GRID-DEV] Add pan/zoom controls to canvas grid component
```

---

## Branch Strategy

- **`main`** — Stable releases only. Protected — no direct pushes.
- **`develop`** — Integration branch. All PRs target `develop`.
- **Feature branches** — Created off `develop` with descriptive names:
  ```
  feature/grid-pan-zoom
  feature/dna-mutation-prompt
  bugfix/agent-overlap-collision
  ```

---

## Development Workflow

1. **Create a feature branch** off `develop`
2. **Make your changes** following the style guide below
3. **Run checks locally** before pushing:
   ```bash
   npm run lint        # ESLint — must pass with zero warnings
   npm run format:check # Prettier — must pass
   npm run test        # Vitest — all tests must pass
   cargo clippy -- -D warnings   # In src-tauri/ — zero warnings
   cargo fmt --check             # In src-tauri/ — must pass
   ```
4. **Open a PR** targeting `develop`

---

## Coding Standards

### TypeScript / Svelte (Frontend)

- **Strict typing** — `any` is banned. Define explicit interfaces in `src/types/`.
- **Descriptive naming** — `getUserProfile`, not `getUsr`.
- **Component structure** — One component per file, co-located styles.
- **Testing** — All features must have Vitest tests in `tests/`.

### Rust (Tauri Backend)

- **Clippy clean** — `cargo clippy -- -D warnings` must pass.
- **Formatted** — `cargo fmt` must pass.
- **Error handling** — No `unwrap()` in production code. Use `Result<T, E>`.

---

## Constraint: Local-First Compute

> **No cloud API keys allowed unless explicitly requested.**
>
> All inference, rendering, and game logic must run on the user's machine.
> The only exception is opt-in distributed inference (Petals) in multiplayer mode.

---

## Project Structure

```
/
├── src/                  # Svelte 5 / SvelteKit frontend
│   ├── routes/           # SvelteKit page routes
│   ├── engine/           # Shared game logic (framework-agnostic)
│   └── types/            # Shared TypeScript interfaces
├── src-tauri/            # Rust / Tauri backend
│   ├── src/              # Rust source
│   └── Cargo.toml        # Rust dependencies
├── tests/                # Vitest test suites
├── static/               # Static assets
└── .github/workflows/    # CI pipeline
```

---

*Reference: Section 8 of [SYNAPTIC_SANDBOX_PLAN.md](./SYNAPTIC_SANDBOX_PLAN.md)*
