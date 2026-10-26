# 质量门禁

## 工作中的检查

改动哪个范围，就运行对应范围的检查。这些检查应该快速反馈当前修改是否破坏了所在层：

前端改动：

```powershell
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
```

Rust 改动：

```powershell
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## 兜底检查

一次 session 结束时，运行仓库的聚合检查作为兜底，覆盖前后端并发现跨层遗漏：

```powershell
pnpm check
```

`pnpm check` 包含 `bindings:check` → `fmt:check` → `lint` → `typecheck` → `build` → `test` → `cargo fmt` → `cargo clippy` → `cargo test`，耗时较长，不适合每次小改动都运行。

## 前端工具链

前端使用 Oxc 的 oxlint（lint）与 oxfmt（格式化）替代 eslint + prettier。配置文件为 `app/.oxlintrc.json` 与 `app/.oxfmtrc.json`。`pnpm fmt` 仅格式化 `src` 目录下的前端文件，不触碰其它目录。

`.oxfmtrc.json` 中已将 `app/src/commands/generated` 等自动生成的文件加入忽略列表。

`pnpm test` 使用 Vitest 跑纯逻辑单测（`profileModel` / `ordering` / `formatError` / `orderDraft` 等），不渲染组件、不依赖 DOM。

## Tauri 桌面构建验证

涉及桌面构建时运行：

```powershell
pnpm tauri build --bundles nsis
```

## CI 范围

CI 当前只运行非打包检查：安装依赖、`bindings:check`、前端 lint/typecheck/build/test、Rust fmt/clippy/test。
