# AGENTS.md

## Git

- Use Conventional Commits: `<type>(<scope>): <description>`.
- When a task is split into independently deliverable targets, plan commits up front. Complete and commit one target before moving to the next, unless the changes are genuinely coupled. Each commit should leave the repo in a reviewable state.

## Context7

Use Context7 MCP to fetch current documentation whenever a task asks about a library, framework, SDK, API, CLI tool, or cloud service. This includes Tauri, React, Vite, Rust crates, Node tooling, and setup or migration details.

Do not use Context7 for ordinary refactors, business-logic debugging, code review, or general programming concepts.

## Source Lookup

- Rust crates source code can be found in `$CARGO_HOME`, do not grep in `$USER_PROFILE/.cargo`

## Capabilities

Quick index of what RimR currently implements. For the latest details, explore the code and the user's request.

- Parse RimWorld `About.xml` mod metadata, including version-keyed fields (`*ByVersion`), `forceLoad*`, and `incompatibleWith`.
- Build a dependency graph and validate a user-managed mod order, producing structured, non-blocking diagnostics.
- Load and save the game's `ModsConfig.xml` only through explicit Apply actions.
- Manage a local library in the RimR data dir: `settings.json`, `mod-lists/index.json`, `mod-lists/<id>.json`.
- Edit mod lists with mod, group, and separator entries; apply the expanded order to the game.
- Export/import `.rimr.json` files for mod lists, library settings, and game config backups.
- English / Simplified Chinese UI via `react-i18next`.

## UI Style

When changing frontend components, follow the conventions in [`docs/ui-style.md`](docs/ui-style.md): keep the UI compact and desktop-like, use `rounded-slight` only for buttons and section boundaries, avoid pill badges, and prefer context menus / top menus / dialogs for details.

## Frontend State Management

When adding or refactoring frontend state, follow [`docs/state-management.md`](docs/state-management.md). Highlights:

- Server / IPC data lives in React Query via `hooks/commands.ts`; do not duplicate it elsewhere.
- Persisted user preferences live in `app/src/stores/` as Zustand `persist` stores.
- Cross-page session state (e.g. order draft, dialog, cross-module intents) lives in `app/src/stores/` Zustand stores.
- Single-page interaction state (selection, filter, drag, etc.) lives in the feature's `context/` provider.
- Pure business rules live in `features/<x>/model/` and must not import `react` or `zustand`.
- Do not introduce mirror effects between `useState` and a store; pick one source of truth.

## Quality Gates

Run checks scoped to the area you changed while you work:

- Frontend changes:
  ```powershell
  pnpm fmt:check
  pnpm lint
  pnpm typecheck
  pnpm test
  ```
- Rust changes:
  ```powershell
  cargo fmt --all -- --check
  cargo clippy --workspace --all-targets -- -D warnings
  cargo test --workspace
  ```

Before finishing a session, also run the full aggregate check as a safety net:

```powershell
pnpm check
```

If a Tauri desktop build is relevant and the host environment supports it, also run:

```powershell
pnpm tauri build --no-bundle
```

Note: `pnpm check` runs `bindings:check` → `fmt:check` → `lint` → `typecheck` → `build` → `test` → `cargo fmt` → `cargo clippy` → `cargo test`. It is broad and slower than scoped checks, so use it to catch cross-layer omissions rather than for every small change.
