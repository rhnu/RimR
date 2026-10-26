# RimR 基础设计

## 产品目标

RimR 是一个小型的 RimWorld mod list manager。核心数据边界是：

- **库设置（Library Settings）**：跨模组列表的配置，例如 Display Alias（保存为 `settings.json`）。
- **模组列表（Mod List）**：RimR 内部可编辑的 mod 排序、Group 和 Separator。
- **ModsConfig.xml**：官方游戏配置文件，只在用户执行 **Apply** 时写入。

详细分层设计见 [RimR 应用架构设计](crate-architecture.md)。

## 已落地内容

- 扫描 mod 来源并解析 `About.xml` 全字段集，包括 `*ByVersion`、`forceLoad*`、`incompatibleWith`。
- 加载游戏当前 `ModsConfig.xml`，用于初始化默认模组列表和比较是否已 Apply。
- 在 RimR data dir 中保存 `settings.json`、`mod-lists/index.json`、`mod-lists/<id>.json`。
- 校验模组列表展开后的 active mod 顺序并展示非阻塞诊断。
- Apply 当前模组列表到游戏 `ModsConfig.xml`。
- 导出和导入 `.rimr.json` 游戏配置备份；导入备份会创建模组列表，不直接写游戏配置。
- 英文 / 简体中文 UI。

## 数据语义

库设置保存跨模组列表的信息。Display Alias 绑定到 `packageId + source` 身份，`packageId` 为主标识，`sourceKind`、`sourceKey`、`steamAppId` 用于区分重复或分叉 mod。

模组列表保存 RimR 自有排序结构：

- `mod` entry：一个 active mod。
- `group` entry：一组一起管理的 mod；Apply 时按组内顺序展开。
- `separator` entry：纯视觉分隔符，只存在于 RimR，不写入 `ModsConfig.xml`。

模组列表有两个独立状态：

- **mod list unsaved**：当前 UI draft 与 RimR 模组列表 JSON 不一致，需要 Save Mod List。
- **Not applied**：模组列表展开后的 active mods 与游戏 `ModsConfig.xml` 不一致，需要 Apply。

排序页交互细节见 [RimR UI 交互规约](ui-interaction-spec.md)。

## 前端工作流

RimR 使用桌面软件式布局：自绘标题栏和顶部菜单承载 File、View、Settings、Help。
`/order` 是默认主工作区：

- 顶部工具条承载当前模组列表切换、状态摘要、Save Mod List、Apply 和 Reset to Saved。
- 主视图是三栏工作区：左侧常驻元数据栏，中间是未引入 mods，右侧是当前模组列表 entries。
- 主视图不直接放置文本输入框；模组列表新建/重命名/删除、Display Alias、Group 和 Separator 编辑都通过二级界面完成。
- 编辑类操作以列表 ContextMenu 作为入口，以 Dialog 收集文本或确认破坏性操作。
- 选中 mod/group/separator 时左侧元数据栏实时刷新；可编辑字段不在元数据栏内直接修改。
- 校验实时运行，诊断以内联图标显示在相关 active mod/group child 上。
- 排序页不使用虚拟化；1000 多条 mod 内优先保证拖拽定位、按钮 fallback 和可测试性。

Catalog 不再有独立浏览页；它作为会话内 snapshot 由排序页启动加载和手动重建动作刷新，并供未引入 mod、校验、预览和文件系统操作共享。

Setup 只在 `gameDir`、`configDir` 或 `rimrDataDir` 缺失时作为首屏向导显示。`rimrDataDir` 默认位于用户 `Documents/RimR`。配置完整后 Setup 会重定向到 Settings。

模组列表/库设置的导入导出通过 File 菜单执行。

前端 UI 文案使用 react-i18next 实现英文/简体中文切换。语言偏好通过 zustand 持久化（`rimr-locale`），首次启动按 `navigator.language` 自动检测并回退英文。翻译资源为 `app/src/i18n/locales/` 下的静态 JSON，单命名空间 + 嵌套分组。后端 Rust 诊断 `diagnostic.message` 与 mod 自身元数据（名称、描述等）不纳入前端 i18n，原样展示。

## 设计约束

- UI 不解析 XML、不构建依赖图、不序列化 `ModsConfig.xml`。
- Tauri 负责文件系统、RimR JSON 持久化、command 编排和 DTO。
- Core 拥有 RimWorld 领域能力和 RimR 库/模组列表领域类型，但不知道真实路径、Tauri 或 RimR data dir。
- 所有跨层数据都经过 DTO 或 core services 类型。

质量门禁见 [quality-gates.md](quality-gates.md)。
