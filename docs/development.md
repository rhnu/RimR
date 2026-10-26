# 开发说明

## 本地开发

使用 Node.js 24 或以上、`package.json` 指定的 pnpm，以及稳定版 Rust。桌面运行还需要对应平台的 Tauri 系统依赖；Windows 是主要开发与支持环境。

从仓库根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm tauri dev
```

`pnpm dev` 单独启动前端开发服务器。`pnpm build` 检查并构建前端；`pnpm build:assets` 仅构建资源，供已完成类型检查的流水线使用。`pnpm build:bin` 构建本地桌面可执行文件，`pnpm bundle` 构建当前平台的安装包。

## 版本与发布

应用版本只在根 `Cargo.toml` 的 `workspace.package.version` 定义。Rust 成员继承它，Tauri 配置不再单独声明版本，前端通过 Tauri API 读取实际运行版本。不要给 private 的 Node 包添加应用版本，也不要从 tag 覆盖构建版本。

发布前将 main 与 origin/main 同步，并保持工作区及暂存区干净。从根目录执行：

```powershell
pnpm release patch --dry-run
pnpm release patch
```

也可指定 `minor`、`major` 或精确版本，例如 `pnpm release 0.3.0-rc.1`。版本必须严格递增；从 rc 转为同一正式版时指定精确版本。安装器版本各数字分量不超过 65535，发布版本不接受 build metadata；预发布标识内部不能带连字符，以兼容 RPM。`--dry-run` 仍核对干净的 main 和远端引用，但不 fetch、修改文件、执行检查或推送。

发布工具通过 Cargo 更新工作区包的锁文件版本，确认外部依赖没有变化，运行完整 `pnpm check`，仅提交版本文件并创建 annotated tag，然后原子推送 main 与这个 tag。Windows 的发布检查使用 `target/release-check`，避免检查重编译时替换正在运行的 xtask。失败保留现场，修复原因后再处理；不会自动 reset 或删除 tag。`--no-push` 完成本地提交和 tag，并输出准确的原子推送命令。

自动发布以 main 的 push 为入口：只有该次提交恰好对应一个与 Cargo 版本相同的 `v<semver>` annotated tag，才会在全部检查通过后构建三平台安装包。必须一次原子推送提交和 tag；事后单独补推 tag 不触发发布。重试时在 CI 的手动入口选择 main 并填写已有 tag；该提交必须属于 main 历史，构建与验证始终使用 tag 指向的提交。

Windows x86_64 发布 NSIS 安装程序，Linux x86_64 发布 deb 和 rpm，macOS arm64 发布 DMG。全部产物验证提交、版本、架构、类型和 SHA256 后才公开 Release；失败保留草稿，重试可补齐草稿，已经公开的版本拒绝覆盖。校验文件为 `SHA256SUMS`。

预发布的程序仍保留完整 SemVer，原生安装器元数据从它派生。例如 `0.3.0-rc.1` 的 deb 版本为 `0.3.0~rc.1`，RPM 为版本 `0.3.0`、release `0.rc.1`，使正式版能够正常升级覆盖 rc；macOS 安装包使用数字版本 `0.3.0`。这些值只在打包时生成，不另建版本定义或重编译程序。

当前 Windows 安装包未配置证书签名。macOS 可通过仓库 secrets 配置 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`，并使用 `APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID` 公证；未配置时按未签名或临时签名分发，Release 会列出实际签名状态。缺少签名的包可能需要系统额外确认。

CI 按变更范围并行检查，发布提交强制完整检查。main 更新 Cargo 缓存，PR 恢复缓存；发布也在 main 作用域执行，便于后续版本复用缓存。前端资源受 Tauri 平台环境影响，各平台打包时分别构建，不跨平台复用 `dist`。

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

它按工作区脚本检查 CI 脚本单元测试、绑定、格式、lint、类型、前端构建与测试，以及 Rust 检查、格式、lint 和测试。修改 workflow 时还需运行 `actionlint`；CI 的仓库规范检查会安装并执行它。范围检查用于工作中的快速反馈，完整检查用于发现跨层遗漏；未执行或失败的部分应在交付中如实说明。
