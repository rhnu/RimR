# RimR 前端状态管理规范

本文件描述 RimR 前端的状态分层与归属规则，是新增功能时判定"该把状态放到哪"的单一参考。

> 本规范由 2026 Q2 的状态管理重构产生（阶段 1 引入草案，阶段 10 定稿）。

## 1. 设计目标

- **状态变更流程明确**：用户操作 → 哪一层 state → 哪些派生 → 哪些副作用，逐一可追踪。
- **职责边界清晰**：服务器数据、用户偏好、跨页状态、单页交互状态、派生数据、纯计算各有归属，不重叠。
- **维护成本可控**：禁止"双源 / mirror effect"；禁止把跨模块意图藏在隐式信号里；面板组件不再背 20+ 回调 prop。

## 2. 状态归属表

| 类别                                 | 归属                                              | 说明                                                                                       | 典型例子                                                  |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 服务器数据 / IPC 结果                | **React Query**                                   | 经 `hooks/commands.ts` 单一入口；mutation 负责 query invalidation；全局 `onError` 走 toast | `catalogSnapshot`、`library`、`playerLog`                 |
| 用户偏好（持久化）                   | **Zustand persist**                               | 写入 `localStorage`；UI 启动时即可使用                                                     | `theme`、`locale`                                         |
| 跨页面的当前会话状态                 | **Zustand 全局 store**（`app/src/stores/`）       | 路由切换后仍需保留；非服务器派生                                                           | `orderDraft`、`orderDialog`、`orderCommand` intent        |
| 单页面内的交互状态                   | **Feature Context**（如 `OrderWorkspaceContext`） | 离开该页可丢弃；面板组件自取，避免 prop bundle                                             | `selection`、`filter`、`search`、`drag`、`preview`        |
| 派生数据 / 视图状态                  | **`useMemo` + 纯 selector**                       | 不允许把派生结果再存进 store                                                               | 渲染行、diagnostics summary                               |
| 纯计算 / 业务规则                    | **`features/<x>/model/`** 纯函数                  | 不依赖 React、不依赖 Zustand（ESLint 守护）                                                | `modListReducer`、`buildOrderDiff`、`syncModListFromGame` |
| 跨模块一次性意图                     | **Zustand intent slice**（command bus）           | 仅用于"请求 → 消费"的一次性命令；禁止存可派生数据                                          | "导入存档后请同步"                                        |
| 校验缓存（非服务器派生，跨路由保留） | **Zustand**（明确文档化边界）                     | 不进 React Query：输入非服务器数据 + 来自 draft 派生 + 不需要重放语义                      | `validation`                                              |
| 单页 draft（路由切换后即丢弃）       | **Feature hook + `useState`**（统一 draft 形状）  | 命名形如 `useSettingsDraft`；与 `useOrderDraft` 同型签名                                   | settings paths draft                                      |

### 2.1 判定流程

新增功能时，按以下顺序回答即可定位归属：

1. **来自后端 IPC / 服务器？** → React Query（mutation 顺带定义 invalidation）。
2. **是用户偏好且需要跨会话持久化？** → Zustand persist。
3. **离开当前页面后还需要保留？**
   - **是**：Zustand 全局 store（`app/src/stores/`）。
   - **否**：feature Context（多组件共享）或 feature hook + `useState`（单组件树）。
4. **是"做一次就结束"的跨模块意图？** → command bus（Zustand intent slice），消费者读取后 `consume()` / `clear()` 清空。
5. **可以从已有 state 计算出来？** → 不要存。用 `useMemo` + 纯 selector 派生。
6. **纯业务规则（不需要 React）？** → `features/<x>/model/` 的纯函数。

## 3. 目录约定

```text
app/src/
├── stores/                       # 全局 / 跨页 Zustand store
│   ├── theme.ts                  # 持久化偏好
│   ├── locale.ts                 # 持久化偏好
│   ├── orderDraftStore.ts        # order draft 单源
│   ├── orderDialogStore.ts       # 统一 dialog 状态 + orderEditHandler 注册位
│   ├── orderCommandStore.ts      # 跨模块意图 command bus
│   └── validation.ts             # 跨路由保留的校验缓存
│
├── features/<feature>/
│   ├── model/                    # 纯函数：禁止 import react / zustand
│   ├── hooks/                    # React 绑定层（useState、useEffect、订阅 store）
│   ├── context/                  # 单页交互状态的 Provider + 细粒度 hook
│   └── view/                     # 含 JSX 的视图辅助（如 dragOverlay）
│
├── hooks/                        # 跨 feature 的通用 hook（含 React Query 包装）
└── commands/                     # Tauri IPC 单一入口（rimrClient）
```

### 命名约定

- 全局 store 文件名：`<domain>Store.ts`，导出 `use<Domain>Store`。
- Feature Context 文件名：`<Feature>Context.tsx` + 同目录的 `hooks.ts`，导出 `use<Feature>*()` 系列细粒度 hook。
- Draft hook 统一签名：`{ draft, baseline, isDirty, isReady, ...actions }`（参见 `useOrderDraftStore`、`useSettingsDraft`）。
- intent slice action：`request(cmd)` + `consume(): T | null`（或 selector + `clear()`），保留队列语义。

## 4. 关键流程图

### 4.1 Order draft 修改流

```text
用户操作（拖拽 / 点击 / 双击 / 上下文菜单）
        │
        ▼
面板组件 → useOrderWorkspaceEditActions().<verb>
        │
        ▼
useOrderDraftStore.applyAction(action: ModListAction)
        │
        ▼
modListReducer(draft, action)            ← 纯函数 (features/order/model/)
        │
        ▼
store 更新 draft / isDirty=true → 订阅者重渲染
        │
        ▼
useOrderDerivedData useMemo 重算 rows / diagnosticsMap / activeModsKey
        │
        ▼
useOrderValidation 250ms 防抖后 mutate validate_active_order
        │
        ▼
useValidationStore.setResult(...) → ValidationSummaryBadge 更新
```

### 4.2 数据加载流（React Query enabled 依赖链）

```text
useAppConfig (默认 enabled)
        │ setupComplete = data != null && !needsSetup(data)
        ▼
useCatalogSnapshot({ enabled: setupComplete })
        │ isSuccess
        ▼
useLoadActiveList({ enabled: scan.isSuccess })
        │ isSuccess
        ▼
useLibrary({ enabled: activeList.isSuccess })
        │ data.currentModList
        ▼
useOrderDraftStore.initialize(currentModList)
        │ 仅在 id 与当前 baseline 不同时重置；同一 list 多次出现不覆盖编辑
        ▼
draft 就绪 → OrderWorkspaceProvider 渲染面板
```

### 4.3 持久化流（save / apply）

```text
用户点击 Save / Apply
        │
        ▼
useOrderCommands.handleSaveModList / handleApplyWithDiff
        │
        ▼
React Query mutation (rimrClient.saveModList / applyModListToGame)
        │ onSuccess
        ▼
useOrderDraftStore.replaceSavedDraft(savedModList)   ← baseline 重置 / isDirty=false
useQueryClient.invalidateQueries({ queryKey: library / activeList })
        │
        ▼
enabled 依赖链中的 query 自动 refetch → derived & validation 重算
```

### 4.4 跨模块意图流（command bus）

```text
AppShell file menu → "Import & Sync from save"
        │
        ▼
useReadSaveModIds mutation → onSuccess(dto)
        │
        ▼
useOrderCommandStore.request({ kind: 'syncFromSave', modIds })
        │ 用户切换路由到 /order 之前 / 之后皆可
        ▼
useOrderSync.useSaveSync 订阅 pending → useEffect
        │ 处理后 useOrderCommandStore.clear()
        ▼
若 dirty / 有变更：打开 diffConfirm dialog；否则直接 applySaveSync
```

### 4.5 Dialog 单实例流

```text
任何模块 → useOrderDialogStore.open({ kind, ... })
        │
        ▼
AppShell 顶层 <OrderDialogView /> 自取 store dialog → 打开
        │
        │ 通过 ModCatalogContext 拿到 modByPackageId（OrderPage 在挂载时注入；
        │ 其他页面回退到 EMPTY_MOD_BY_PACKAGE_ID）
        ▼
用户提交 → AppOrderDialogView.onSubmit(value)
        │ isModListDialog(dialog) ?
        ├─ 是 → useAppOrderDialogActions 直接处理 mod-list 类
        └─ 否 → useOrderDialogStore.getState().orderEditHandler?.(value)
                ↳ 由 OrderWorkspaceProvider 在 effect 中注册的
                  editActions.handleDialogSubmit 接管
```

## 5. 禁止项 / 反模式

- **禁止双源 mirror**：若状态需要在多处读取，定一个唯一持有者，其他人订阅；不要写 `useEffect` 把 `useState` 同步到 store（阶段 3 已清理 `currentDraft` mirror）。
- **禁止在 `model/` 里 import `react` 或任何 hook**（阶段 2 起由 ESLint `no-restricted-imports` 守护，含 `react` / `react-dom` / `zustand` / `@tanstack/react-query`）。
- **禁止在非 `app/src/stores/**` 目录调用 `zustand` 的 `create`**（阶段 2 起由 ESLint 根级 `no-restricted-imports` 守护，`app/src/stores/**` override 解除限制）。
- **禁止把可派生数据存进 store**：能 `useMemo` 出来的就不要落地。
- **禁止用"隐式约定"传递跨模块意图**：必须走 command bus，可读、可测试；不要在 store 里临时塞一个布尔标志暗示对端"现在该做某事"。
- **禁止在面板组件里持有跨组件共享的交互状态**：放到 feature Context，组件自取（阶段 4 已经把所有 panel 的 `ComponentProps<typeof X>` 形态拆除）。
- **禁止用手动 `useEffect + refetch()` 链表达数据加载顺序**：用 React Query 的 `enabled` 谓词（阶段 7）。

## 6. ESLint 守护一览

`.oxlintrc.json` 中通过 `no-restricted-imports` 落地：

| 范围                                   | 禁止                                                        | 用途                                             |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| 根（默认）                             | `zustand`                                                   | 防止在 `app/src/stores/` 之外随意 `create` store |
| `app/src/stores/**` override           | `zustand` 解除                                              | 唯一允许的 store 定义位置                        |
| `app/src/features/*/model/**` override | `react` / `react-dom` / `zustand` / `@tanstack/react-query` | 保证 model 层纯净                                |

新增 feature 时如果有 `<feature>/model/`，自动适用第三条；如需更精细控制，请在 PR 中补 override。

## 7. 重构阶段索引

本规范是 2026 Q2 状态管理重构的产物。各阶段提交（前 9 条已落地，第 10 条为定稿本身）：

| 阶段 | 主题                       | 提交      |
| ---- | -------------------------- | --------- |
| 1    | 文档与公约                 | `1c96e6a` |
| 2    | Model 纯化 + ESLint 守护   | `448aa0e` |
| 3    | Order draft Zustand 单源   | `52285b8` |
| 4    | OrderWorkspaceContext      | `2d4836a` |
| 5    | OrderDialog 顶层单实例     | `f9bc5ae` |
| 6    | Order command bus          | `5a0b1ae` |
| 7    | React Query enabled 依赖链 | `f7e4e92` |
| 8    | Validation 边界文档化      | `27ff4cc` |
| 9    | Settings draft 对齐        | `c714788` |
| 10   | 文档定稿 + aggregate 检查  | 本提交    |
