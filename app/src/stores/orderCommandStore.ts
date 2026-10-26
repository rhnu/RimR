/**
 * Order command bus / intent slice.
 *
 * 该 store 是一个**跨模块一次性意图**（command bus）队列，专门用于在不
 * 直接耦合生产者与消费者的前提下，把"请求 → 消费"语义的命令传递给
 * Order 模块。例如：文件菜单触发 "Import from save" 后，需要让
 * OrderPage 在挂载好之后自动执行 sync-from-save 流程。
 *
 * 队列语义：
 * - 生产者通过 `request(command)` 写入一个待执行命令；
 * - 消费者通过 `consume()` 取出并清空，或订阅 `pending` 后调用 `clear()`
 *   完成"一次性处理"。
 * - 同一时刻只保留最近一次 `request` 写入的命令，不做累积。
 *
 * 约束：
 * - 禁止把可派生数据塞进 `OrderCommand`，那是 selector 与 query 的事；
 *   这里只放真正必须"显式触发一次"的最小信息。
 * - 新增命令请始终走 discriminated union (`kind`)，确保穷举与类型安全。
 *
 * 参考：`docs/state-management.md` 的 "跨模块一次性意图 / command bus" 段落。
 */
import { create } from 'zustand';

export type OrderCommand = { kind: 'syncFromSave'; modIds: string[] };
// 设计为 discriminated union 以便将来加新命令；目前仅一个 kind。

type OrderCommandState = {
  pending: OrderCommand | null;
  request: (command: OrderCommand) => void;
  consume: () => OrderCommand | null;
  clear: () => void;
};

export const useOrderCommandStore = create<OrderCommandState>((set, get) => ({
  pending: null,
  request: (command) => set({ pending: command }),
  consume: () => {
    const { pending } = get();
    if (!pending) return null;
    set({ pending: null });
    return pending;
  },
  clear: () => set({ pending: null }),
}));
