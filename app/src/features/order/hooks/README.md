# `src/features/order/hooks/` — React 绑定层

参见 [`docs/state-management.md`](../../../../../docs/state-management.md)。

本目录的 hook 只负责把**纯逻辑**（`../model/`）和**外部状态**（React Query、Zustand store、Tauri 命令）粘合到 React 组件树上。规则：

- 不写业务规则：复杂判断、reducer、diff 计算等放到 `../model/`。
- 不持有"该归 store 的"状态：跨页保留的 state 走 `src/stores/`；单页 UI 状态走 `../context/`（阶段 4 引入）。
- 一个 hook 只解决一类问题（数据加载、draft、selection、drag、validation 等）；不要把多个 concerns 塞进同一个 hook。
- 命名约定：`use<Verb><Noun>.ts`，必要时配套同名 `.test.ts`。

阶段索引中的关键演进：

- 阶段 2：纯逻辑下沉到 `../model/`；`dragOverlay.tsx` 改为视图辅助。
- 阶段 3：`useOrderDraft` 改为 store 包装，删除 useState mirror。
- 阶段 4：交互状态搬入 `../context/OrderWorkspaceContext`，hook 拆为细粒度。
- 阶段 7：`useOrderData` 改用 React Query `enabled` 依赖链，去掉手工 `refetch` 链。`useCatalogSnapshot` / `useLoadActiveList` / `useLibrary` 接受可选 `{ enabled }`，默认仍为 false。
