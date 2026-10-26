# 开发说明

## 本地开发

使用 Node.js 24 或以上、`package.json` 指定的 pnpm，以及稳定版 Rust。桌面运行还需要对应平台的 Tauri 系统依赖；Windows 是主要开发与支持环境。

从仓库根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm tauri dev
```

`pnpm dev` 单独启动前端开发服务器。`pnpm build` 检查并构建前端；`pnpm build:bin` 构建桌面可执行文件。发布版本由根配置与应用配置共同使用，通过 `pnpm bump` 入口更新，避免只修改一处版本。

## Rust 边界

应用用例、会话管理、启动流程、当前存储和文件来源适配器集中在 `rimr-app`。`rimr-core` 保持领域、规则和 RimWorld 格式处理的纯逻辑；不要因“复用”把文件系统或宿主状态重新放回 core。

`rimr-bindings` 只定义传输 DTO 并生成 TypeScript。领域类型与存储类型独立定义，在 IPC 边界转换；不要让 core 反向依赖 bindings，也不要把 DTO 直接作为仓储模型。Tauri 命令只转交应用用例并处理宿主边界，插件注册留在桌面宿主。

内部错误保留类型、操作上下文和 `source` 原因链；到宿主边界才转换为稳定 IPC 错误码。最终失败由处理边界记录一次，其他层补充上下文并传播。日志由桌面入口统一初始化，应用用例使用 tracing span 关联操作；普通取消和非阻断诊断不应当作重复错误记录。

调整 DTO 后执行 `pnpm bindings`，提交生成结果。`pnpm bindings:check` 检查生成内容是否一致；不要手工修补 `app/src/commands/generated/types.ts`。

## 存储与启动约束

current 仓储只读写当前命名空间。legacy 只解码旧配置、旧库和 portable 文件，返回候选；bootstrap 负责在无当前数据时调用它们，并在整体校验后交给 current 仓储提交。正常读取不能顺带迁移或重写旧源。新数据损坏时必须报错，不能用旧数据回退覆盖。

库使用单个版本化 JSON 快照，原子替换并串行写入。保存使用 revision 检查过期请求，不能以最后到达的请求无条件覆盖。迁移失败不允许静默丢弃某份列表或某条记录；失败后保持旧源可读，重启仍能继续。文件原子替换与“调用返回成功”共同决定提交是否完成，不要把临时文件存在视为成功。

`entries` 是列表结构与顺序的唯一事实。`activeMods` 必须派生；不能为修复不一致而在多个层分别维护两份数组。`ModListId`、`EntryId`、`TagId` 是独立 UUID v4 强类型，不能从名称或 package ID 派生。迁移和导入分配新身份时要同时维护全部引用。

package ID 用于逻辑模组与共享别名、标签；source 用于具体安装副本和文件操作。扫描保持稳定排序并接收显式目标游戏版本。不要以来源路径代替逻辑身份，也不要仅凭 package ID 执行文件删除。

## 前端状态归属

保持现有 React、TypeScript、TanStack Query／Router、Zustand、Tailwind、Radix 与 dnd-kit 技术栈。职责分为 `app`、`commands`、`queries`、`domain`、`stores`、`features` 和 `components`，不以目录迁移为理由改变产品交互。

| 数据                                   | 唯一归属                                   |
| -------------------------------------- | ------------------------------------------ |
| IPC 返回的配置、库、扫描结果等服务数据 | Query；`commands` 只负责类型明确的调用边界 |
| 主题与语言                             | `stores` 中的 Zustand persist store        |
| 跨页草稿、对话框和跨模块操作意图       | `stores` 中的会话 store                    |
| 页面内选择、筛选、拖放等交互           | 对应 feature 的局部 provider               |
| 纯业务规则、转换和选择器               | `domain`；不得导入 React、Zustand 或 Query |

前端源文件统一使用 kebab-case，例如 `order-page.tsx`、`use-order-data.ts` 和 `order-draft-store.ts`。组件符号保持 PascalCase，函数与变量保持 camelCase；文件名不沿用组件符号的大小写。

草稿是独立的编辑会话，保留基线 revision；它不是将 Query 数据持续镜像一遍。不要用 effect 在 `useState`、store 与 Query 间相互同步。主题和语言不保留后端常驻双向镜像。

用有区分标记的类型表达加载、成功、失败和编辑状态，避免多个布尔值组成不可能状态。请求结果绑定对应 revision 或 generation；列表切换、重扫或新的保存发生后，旧响应不能覆盖当前草稿、目录或验证结果。缓存失效应与真正受影响的数据一致。

## 跨层行为保证

- Save 只保存 RimR 列表；Apply 仅显式写 `ModsConfig.xml`，接受 dirty draft，并且不隐式 Save。
- 同步与导入不直接写游戏；预览和确认使用同一份草稿与解析结果，避免预览后应用另一版本。
- 应用时按原位置展开分组中的 active 子项，忽略分隔线与未启用项。跳过缺失模组必须报告；诊断本身不阻断操作。
- 写游戏配置时保留与顺序无关的游戏版本和已知 DLC 信息。存档读取支持普通 XML、gzip、zstd，仅提取模组 ID，不改存档。
- 英语和简体中文必须同时维护。界面布局与行为遵守 [界面规范](ui-style.md)。

## 测试取舍

测试重点是能改变用户结果的纯逻辑与真实边界：条目展开、身份与引用、同步结构、规则诊断、格式读取、迁移完整性、过期保存拒绝及写入失败恢复。使用可控输入验证不变量，不依赖真实用户模组目录。

重构时删除已失效、重复、只锁定旧 API 或实现细节的测试，保留仍有效的行为保证。不要为每个组件、转发函数或目录结构机械新增测试，也不要用测试数量代替风险判断。

## 质量检查

工作中运行改动范围内的检查。前端改动：

```powershell
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
```

Rust 改动：

```powershell
cargo check --workspace --locked
cargo dev format --check --diff --locked
cargo dev lint --locked
cargo test --workspace --locked
```

`cargo dev` 来自 Rusteward，开发环境需安装相应工具。Markdown 由项目配置下的 rumdl 检查；修改完成后对改动文件执行 `rumdl check --fix <文件...>`，再检查剩余诊断。`pnpm docs:check` 和 `pnpm docs:fix` 是仓库入口。

结束会话前必须执行完整汇总检查：

```powershell
pnpm check
```

它按工作区脚本检查绑定、格式、lint、类型、前端构建与测试，以及 Rust 检查、格式、lint 和测试。范围检查用于工作中的快速反馈，完整检查用于发现跨层遗漏；未执行或失败的部分应在交付中如实说明。
