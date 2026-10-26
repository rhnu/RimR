# RimR

[English](README.md)

RimR 是 RimWorld 的桌面模组管理器。你可以用分组和分隔线整理加载顺序，保存多份命名列表，并在应用到游戏前查看依赖、顺序和兼容性诊断。

Windows 是主要支持平台，Linux 和 macOS 构建仍属实验性支持。界面提供英语、简体中文，以及浅色、深色和跟随系统主题。

## 功能介绍

### 整理模组列表

保存多份命名加载顺序，用分组和分隔线整理模组。结合别名、彩色标签和搜索，在大量模组中快速定位目标。

![包含 Vanilla Furniture Expanded 系列模组的分组](docs/screenshots/mod-group.png)

### 应用前预览变化

写入游戏配置前，预览草稿中添加、移除和移动的模组。可以切换统一视图和按变更类型分组的视图，核对加载顺序差异。

![应用到游戏的预览，高亮显示移动、移除和添加的模组](docs/screenshots/apply-game-diff-view.png)

### 查看游戏与创意工坊日志

阅读 RimWorld 日志，支持搜索、级别筛选、引用跳转和实时刷新；也可以在日志页面查看 Steam 创意工坊安装记录。

![RimWorld 日志查看器，提供搜索、级别统计和实时刷新](docs/screenshots/logs-view.png)

## 开始使用

1. 从 [Releases](https://github.com/rhnu/rimr/releases) 下载对应平台的安装包：Windows x86_64 `.exe`、Linux x86_64 `.deb` / `.rpm`，或 macOS arm64 `.dmg`。安装后启动 RimR；macOS 打开磁盘映像后，将 RimR 拖入“应用程序”。
2. 在初始设置或设置页面自动检测 RimWorld 路径，并修正未识别的目录。游戏数据目录包含 `Config/ModsConfig.xml`，与游戏安装目录不同。
3. 保存路径，扫描已安装的模组。
4. 打开排序页面，新建或选择列表，添加并排列模组。若要从游戏现状开始，使用“从游戏顺序同步”。
5. 用“保存”将列表保存在 RimR 中；用“应用”预览变化并将草稿顺序写入 `ModsConfig.xml`。

保存与应用彼此独立：可以直接应用未保存的草稿，应用不会顺带保存 RimR 列表。诊断供你判断和调整，不阻止应用；应用时会报告并跳过缺失模组。

## 进一步了解

- [使用与故障处理](docs/features.md)：列表、搜索、标签、导入、日志和文件操作。
- [设计说明](docs/design.md)：身份、数据归属、持久化和升级边界。
- [开发说明](docs/development.md)：本地启动、架构约束和质量检查。
- [界面规范](docs/ui-style.md)：紧凑桌面布局和交互约定。

RimR 使用 [GPL-3.0](LICENSE) 许可证。
