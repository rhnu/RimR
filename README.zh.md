# RimR

[English](README.md) | [中文](README.zh.md)

RimR 是一款面向 [RimWorld](https://store.steampowered.com/app/294100/RimWorld/) 的桌面端模组列表管理器。它帮助你在启动游戏前组织、校验并应用模组顺序。

工作模型为**库设置 → 模组列表 → 应用**：

- **库设置**存储跨列表的数据，例如显示别名和标签。
- **模组列表**存储 RimR 自有的模组顺序元数据，包括分组和分隔符。模组顺序保存在 RimR 自己的数据中，只有在主动应用时才会写入游戏配置。
- **应用**仅在显式确认后，将所选模组列表展开后的顺序写入 RimWorld 的 `ModsConfig.xml`。

RimR 也支持数据文件的导入导出、从 RimWorld 存档导入模组顺序、中英文界面切换，以及本地模组列表快照库的管理。存档排序导入兼容普通 `.rws` 存档，也兼容由存档压缩模组生成的 gzip 或 zstd 压缩存档。

## 搜索

已启用与未启用列表共用同一套智能搜索。直接输入普通词即可搜索名称、Package ID、别名、作者、来源、分组和标签；也可以使用 `#标签`、`@"分组名称"`、`&steam`、`&local`、`!关键词` 等写法筛选或排除结果。

示例：

- `framework #qol` 查找匹配 `framework` 且带有匹配 `qol` 标签的模组。
- `@"核心分组" &steam` 显示匹配分组中的 Steam 工坊模组。
- `graphics !patch` 查找图形相关模组，并排除匹配 `patch` 的结果。

## 截图

<details>
<summary>点击展开</summary>

### 模组分组与分隔符

![模组分组](docs/screenshots/mod-group.png)

### 应用时与游戏配置对比视图

![应用时与游戏配置对比视图](docs/screenshots/apply-game-diff-view.png)

### 日志视图

![日志视图](docs/screenshots/logs-view.png)

</details>

## 下载

预构建发行压缩包可在 [Releases](https://github.com/RhNu/RimR/releases) 页面获取。

Windows 是主要支持的发行目标。Linux 与 macOS 构建目前为实验性支持；macOS 压缩包当前面向 Apple Silicon，且尚未签名。

## 开发

环境要求：

- [Node.js 24+](https://nodejs.org/) 与 [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)

应用位于 `app/`（前端与 `src-tauri/`）；Cargo、pnpm workspace 和统一命令保留在仓库根目录。

运行 `pnpm check` 前请按[质量检查说明](docs/quality-gates.md#rusteward)安装 Rusteward。

在仓库根目录运行开发版本：

```powershell
pnpm install
pnpm tauri dev
```

## 校验

```powershell
pnpm check
cargo test --workspace
```

如果桌面端构建行为相关且当前环境支持，可执行：

```powershell
pnpm tauri build --no-bundle
```

## 数据目录

RimR 将自身数据存储在平台应用数据目录下的 `RimR` 文件夹中：

```text
settings.json
mod-lists/index.json
mod-lists/<id>.json
```

## 许可证

RimR 使用 [GNU General Public License v3.0](LICENSE) 许可证。

## 免责声明

本项目部分代码由 AI 工具辅助生成。
