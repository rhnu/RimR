# RimR

[简体中文](README.zh.md)

RimR is a desktop mod manager for RimWorld. Organize load orders with groups and separators, keep several named lists, and inspect dependency and compatibility diagnostics before applying an order to the game.

Windows is the primary supported platform. Linux and macOS builds are experimental. The interface supports English and Simplified Chinese, with light, dark, and system themes.

## Get started

1. Download the installer for your platform from [Releases](https://github.com/rhnu/rimr/releases): Windows x86_64 `.exe`, Linux x86_64 `.deb` / `.rpm`, or macOS arm64 `.dmg`. Install RimR, then launch it. On macOS, open the disk image and drag RimR into Applications.
2. In Setup or Settings, autodetect your RimWorld paths and correct them if needed. The game data directory contains `Config/ModsConfig.xml`; it is separate from the game installation.
3. Save the paths and scan your installed mods.
4. Open Order, create or select a mod list, then add and arrange mods. Use **Sync from game order** to start from the game's current order.
5. Use **Save** to keep the list in RimR. Use **Apply** and review the changes to write the draft order to `ModsConfig.xml`.

Save and Apply are independent: Apply accepts unsaved drafts and does not save them to the RimR library. Diagnostics help you decide what to change; they do not block applying an order. Missing mods are reported and skipped when applying.

## Learn more

- [Usage and troubleshooting](docs/features.md): lists, search, tags, imports, logs, and file operations.
- [Design](docs/design.md): identities, data ownership, persistence, and upgrade boundaries.
- [Development](docs/development.md): local setup, architecture constraints, and checks.
- [UI conventions](docs/ui-style.md): compact desktop layout and interaction rules.

RimR is licensed under [GPL-3.0](LICENSE).
