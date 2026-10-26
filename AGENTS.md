# AGENTS

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
  cargo check --workspace --locked
  cargo dev format --check --diff --locked
  cargo dev lint --locked
  cargo test --workspace --locked
  ```

Before finishing a session, also run the full aggregate check as a safety net:

```powershell
pnpm check
```

Note: `pnpm check` runs `bindings:check` → `fmt:check` → `lint` → `typecheck` → `build` → `test` → `cargo check` → Rusteward format → Rusteward lint (including Clippy) → `cargo test`. It is broad and slower than scoped checks, so use it to catch cross-layer omissions rather than for every small change.
