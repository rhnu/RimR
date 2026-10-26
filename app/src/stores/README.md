# `src/stores/` — 全局 Zustand store

参见 [`docs/state-management.md`](../../../docs/state-management.md)。

本目录存放**跨页面 / 跨会话保留**的全局状态。规则：

- 仅当状态需要离开当前页面后仍然可读，或被多个不相关模块同时订阅时，才放进本目录。
- 单页面内的交互状态请放到对应 feature 的 `context/`（如 `OrderWorkspaceContext`）。
- 可派生的数据**不要**存进 store，请用 `useMemo` + 纯 selector。
- 命名约定：文件 `<domain>Store.ts`（或简短的 `<domain>.ts`），导出 `use<Domain>Store`。
- ESLint 守护：仅本目录允许调用 `zustand` 的 `create`（阶段 2 起生效）。

当前 store：

| 文件                   | 角色                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `theme.ts`             | 用户偏好（持久化）。                                                                                                      |
| `locale.ts`            | 用户偏好（持久化）。                                                                                                      |
| `orderDraftStore.ts`   | Order 草稿的全局单一持有者（`draft`/`baseline`/`isDirty`）。                                                              |
| `orderDialogStore.ts`  | OrderDialog 顶层单实例的全局状态；AppShell 与 OrderPage 共用。                                                            |
| `orderCommandStore.ts` | 跨模块一次性意图 (command bus)：生产者 `request`，消费者 `consume` 或 `clear` 处理后清空。                                |
| `validation.ts`        | 跨路由保留的校验缓存；暴露 `setResult` / `invalidate` / `clear`。不进 React Query 的原因见 store 头部注释与状态规范文档。 |
