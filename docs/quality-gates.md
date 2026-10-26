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

前端使用 Oxc 的 Oxlint 与 Oxfmt。仓库根目录的 `.oxlintrc.json`、`.oxfmtrc.json` 和 `.editorconfig` 统一源码、构建配置与脚本的规则；从根目录或 `app/` 执行命令会使用同一套配置。

- `pnpm lint` 检查整个 workspace 的 JavaScript/TypeScript，警告和无效禁用注释会使检查失败。浏览器环境仅用于 `app/src/`，构建配置和 `scripts/` 使用 Node 环境。
- `pnpm lint:fix` 应用可自动修复的 lint 建议。
- `pnpm fmt` 格式化代码和配置，再调用 `pnpm docs:fix`；`pnpm fmt:check` 检查同样范围。
- 根 `.gitignore` 排除依赖、构建产物、缓存与 Tauri schema；Oxc 配置另外排除自动生成的 TypeScript 绑定和 Tauri 生成代码。锁文件由包管理器维护，不交给格式化工具。

Markdown 由 rumdl 单独负责，Oxfmt 跳过 `*.md`，避免两套格式规则相互覆盖。仓库级 `.rumdl.toml` 保留中文自然段换行、对齐表格，并仅允许 README 使用的 `details` / `summary` HTML 标签。

```powershell
pnpm docs:check
pnpm docs:fix
# 局部收尾可以传入具体文件
pnpm docs:fix README.md docs/quality-gates.md
```

rumdl 是根开发依赖，`pnpm install` 后本地和 CI 使用锁文件中的相同版本，无需单独安装。

项目未启用 React Compiler，因此关闭其专用诊断（`refs`、`set-state-in-effect`、`preserve-manual-memoization`、`incompatible-library`、`use-memo`）；Hooks 调用顺序、依赖和 JSX 正确性检查继续启用。

`pnpm test` 使用 Vitest 跑纯逻辑单测（`profileModel` / `ordering` / `formatError` / `orderDraft` 等），不渲染组件、不依赖 DOM。

## Tauri 桌面构建验证

涉及桌面构建时运行：

```powershell
pnpm tauri build --bundles nsis
```

## CI 范围

CI 当前只运行非打包检查：安装依赖、`bindings:check`、前端 lint/typecheck/build/test、Rust fmt/clippy/test。
