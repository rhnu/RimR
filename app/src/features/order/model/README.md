# `src/features/order/model/` — 纯领域模型

参见 [`docs/state-management.md`](../../../../../docs/state-management.md)。

本目录是 order feature 的**纯函数层**，承载所有不依赖框架的业务规则。规则：

- **禁止 import `react` 或任何 React hook**（阶段 2 起由 ESLint 守护）。
- **禁止 import `zustand`**：状态变更走 reducer/operation 函数，调用方决定怎么持有结果。
- 文件不含 JSX：含 JSX 的辅助（如 `dragOverlay.tsx`）应放到 `../view/`。
- 所有导出都应是纯函数或纯类型，便于单元测试（同名 `.test.ts` 直接覆盖）。

主要模块：

| 文件                                                                 | 职责                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `reducer.ts` / `reducerOperations.ts` / `reducerActiveOperations.ts` | `modListReducer` 与操作函数。                               |
| `selectors.ts` / `inactiveSelectors.ts` / `smartSearch.ts`           | 渲染行、选择更新、搜索筛选等纯派生。                        |
| `diff.ts`                                                            | 草稿 ↔ 游戏配置的 diff 与 apply projection。                |
| `dnd.ts` / `dragActions.ts`                                          | 拖拽落点解析与移动算法。                                    |
| `syncFromGame.ts` / `missingEntries.ts`                              | 同步与缺失项分类。                                          |
| `entries.ts` / `ids.ts` / `normalize.ts`                             | Entry 工厂、ID 生成、归一化。                               |
| `types.ts`                                                           | 公共类型（`ModListAction`、`OrderDiff`、`DropIntent` 等）。 |
| `testFixtures.ts`                                                    | 单元测试夹具。                                              |
