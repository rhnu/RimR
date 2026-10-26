# RimR 应用架构设计

## 目标

RimR 的架构边界是：

```text
React UI -> Tauri command facade / RimR app data -> rimr-core
```

可复用 Rust 包位于 `modules/`；桌面应用由 `app/src/` 前端与 `app/src-tauri/` Rust 包组成。

`rimr-core` 处理 RimWorld 领域逻辑与 RimR 库（library）/模组列表（mod list）领域逻辑；Tauri 处理桌面 IO、RimR 自有 JSON、命令协议和状态缓存；React UI 处理模组列表编辑体验。

## Core：RimWorld 领域内核

`rimr-core` 不知道真实路径、Tauri、WebView 或 RimR data dir。它同时拥有 RimWorld 领域类型和 RimR 库/模组列表领域类型。

职责：

- 定义 RimWorld 领域类型：`PackageId`、`ModMetadata`、`Rules`、`Dependency`、`ActiveModList`、`ModCatalog`、`GameVersion`。
- 定义库领域类型：`Library`、`ModList`、`ModListEntry`、`ModListIndex`、`ModListSummary`、`GlobalConfig`、`Alias`、`GroupChild`、`ModIdentity`。
- 提供纯领域函数：`slugify`、`normalize_mod_list`、`flatten_active_mods`、`mod_list_from_active_mods`、`merge_global_aliases` 等。
- 解析和编译 RimWorld `About.xml`。
- 构建依赖图，校验用户给定的 mod 顺序，产出 `ValidationReport` 和 `Diagnostic`。
- 读写 `ModsConfig.xml` 的数据模型和序列化规则。
- 读写 `.rimr.json` 游戏配置备份格式。
- 定义 `ModRepository` async trait，供 Tauri 注入真实 mod 来源 IO。
- 定义 `LibraryStore` async trait，供 Tauri 注入库持久化 IO。
- 提供 services：`scan_mod_metadata`、`load_active_list`、`load_library`、`create_mod_list`、`save_mod_list`、`delete_mod_list`、`set_current_mod_list`、`import_mod_list`、`export_backup`、`validate_order` 等。

## Tauri：桌面与 RimR 应用数据层

Tauri 是应用边界。它同时连接 RimWorld 文件和 RimR 自有配置文件。

职责：

- 管理 `AppConfig`：RimWorld 路径、mod source 路径、`rimrDataDir`。
- 实现 `ModRepository`：发现 Data/local/workshop mods，读取 `About.xml`，读取/写入 `ModsConfig.xml`。
- 通过 `JsonLibraryStore`（`library_store.rs`）实现 `LibraryStore`，管理 RimR data dir 文件布局（`settings.json`、`mod-lists/index.json`、`mod-lists/<id>.json`）。
- 管理 session cache：catalog、当前游戏 active list、原始 `ModsConfig` snapshot。`state.rs` 管理共享状态和配置，`state/mods.rs`、`state/library.rs`、`state/logs.rs` 分别负责模组文件、列表库和日志操作。
- 暴露 Tauri commands 并返回稳定 DTO。
- `error.rs` 定义 `CommandError`、`CommandErrorCode`、`CommandResult`，从原 dto 中抽出。
- DTO 按 domain 拆分到 `dto/` 目录（`mods.rs`、`mod_lists.rs`、`backups.rs`）。
- 命令按 domain 拆分到 `commands/` 目录（`config.rs`、`mods.rs`、`mod_lists.rs`、`backups.rs`）。

### RimR Data Dir

`rimrDataDir` 是 RimR 的应用数据目录。它不是“游戏配置备份目录”，而是 RimR 自有配置、模组列表和缓存的根目录。未显式配置时使用平台默认 app data dir（Windows 下默认 `Documents/RimR`）。

### Command 边界

主要 commands 见 `app/src-tauri/src/commands.rs`，包括：

- 配置：`get_app_config`、`save_app_config`、`autodetect_paths`、`clear_session_cache`
- Mod catalog 与元数据：`rebuild_mod_catalog`、`load_mod_preview`、`load_mod_folder_size`
- 当前游戏顺序：`load_active_list`、`validate_active_order`
- 库与模组列表：`load_library`、`save_library_settings`、`create_mod_list`、`save_mod_list`、`delete_mod_list`、`set_current_mod_list`
- 应用到游戏与备份：`apply_mod_list_to_game`、`export_game_config_backup`、`import_game_config_backup`
- 文件导入导出：`export_mod_list_file`、`import_mod_list_file`、`export_library_settings_file`、`import_library_settings_file`、`open_mod_folder`

User-facing order workflow writes RimR JSON through `save_mod_list` and writes the game file only through `apply_mod_list_to_game`.

### Apply 规则

`apply_mod_list_to_game` 读取模组列表，按 entries 展开：

- `mod` entry 输出其 `packageId`。
- `group` entry 按组内顺序输出 children 的 `packageId`。
- `separator` entry 忽略。

展开后的顺序通过 core 构建 `ModsConfig.xml` bytes，再由 Tauri 写入游戏配置文件。

## React UI：模组列表编辑层

React UI 不解析 XML、不构建依赖图、不写文件。它通过 hooks 调用 Tauri commands。

当前结构重点：

- `app/src/commands/rimrClient.ts`：唯一直接 `invoke` Tauri 的文件。
- `app/src/hooks/commands.ts`：TanStack Query hooks。
- `app/src/features/order/model/`：模组列表 reducer、flatten、drop intent、同步等纯逻辑。
- `/order`：模组列表管理、三栏工作区、元数据栏、Save Mod List、Apply、实时诊断。
- Catalog 是会话内核心 snapshot，由 `/order` 启动加载和手动重建动作刷新；不再提供独立浏览页。
- File 菜单：导入/导出模组列表和库设置 `.rimr.json` 文件；模组列表导入创建新模组列表，不直接写 `ModsConfig.xml`。

### `/order` 布局

排序页使用三栏桌面工具式布局：

- 左栏：常驻元数据栏，跟随当前选中项实时刷新。
- 中栏：未引入 mods，支持排序、多选和直接创建 Group。
- 右栏：当前模组列表 entries，包括 mod、group、separator。

模组列表选择、重命名、新建、删除、保存、Apply 以及 Group/Separator 工具在 Order 顶部工具条中。选中项详情通过元数据栏展示。

排序页不使用虚拟化，优先保证拖拽定位、按钮 fallback 和可测试性。拖拽基于 dnd-kit，使用 DragOverlay 显示移动副本，原始行不做跨容器位移。

### 模组列表 Draft

UI 持有本地 draft。用户操作先更新 draft：

- 添加/移除 mod。
- 创建/解散 group。
- 组内排序。
- 插入 separator。
- 重命名模组列表。

`Save Mod List` 写 RimR 模组列表 JSON。`Apply` 写游戏 `ModsConfig.xml`。
`Sync from Game Order` 只重新读取游戏 `ModsConfig.xml` 并更新本地 draft；不会自动保存 RimR 模组列表，也不会写回游戏配置。同步时会尽量保留仍与游戏顺序兼容的 Group 和 Separator；若外部排序打散 Group，则拆散该 Group 以保证 `activeMods` 精确等于游戏顺序。

## 数据流

加载：

```text
rebuild_mod_catalog -> catalog snapshot cache
load_active_list -> ModsConfig snapshot cache
load_library -> 库设置 + 模组列表 JSON
```

首次没有模组列表：

```text
load_active_list active mods
  -> load_library
  -> 创建 default 模组列表
  -> 写 mod-lists/index.json + mod-lists/default.json
```

编辑和保存：

```text
React modListReducer -> local draft
Save Mod List -> save_mod_list -> mod-lists/<id>.json
Draft change -> debounce -> validate_active_order -> inline row diagnostics
Apply -> apply_mod_list_to_game -> ModsConfig.xml
```

## 测试策略

- Rust：`cargo test --workspace` 覆盖 Tauri state/library store、RimR JSON roundtrip、默认模组列表初始化、Apply 展开写入，以及 core 的 parser、graph、validation、备份和 services。
- UI：`pnpm test` 覆盖 `profileModel` reducer/drop intent、ordering、orderDraft、formatError、identity 等纯逻辑。
- 质量门禁见 [quality-gates.md](quality-gates.md)。
