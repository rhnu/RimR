# RimR

[简体中文](README.zh.md)

RimR is a desktop mod manager for RimWorld. Organize load orders with groups and separators, keep several named lists, and inspect dependency and compatibility diagnostics before applying an order to the game.

Windows is the primary supported platform. Linux and macOS builds are experimental. The interface supports English and Simplified Chinese, with light, dark, and system themes.

## Features

### Organize mod lists

Keep several named load orders and arrange mods with groups and separators. Use aliases, colored tags, and search to find mods in a large collection.

![A mod group containing Vanilla Furniture Expanded mods](docs/screenshots/mod-group.png)

### Review changes before applying

Preview added, removed, and moved mods before writing the draft order to the game. Switch between a unified view and changes grouped by type to inspect the differences.

![Apply to Game preview highlighting moved, removed, and added mods](docs/screenshots/apply-game-diff-view.png)

### Inspect game and Workshop logs

Read RimWorld logs with search, severity filters, reference navigation, and live refresh. Check Steam Workshop installation records from the same logs page.

![RimWorld log viewer with search, severity counts, and live refresh](docs/screenshots/logs-view.png)

## Get started

1. Download the installer for your platform from [Releases](https://github.com/rhnu/rimr/releases): Windows x86_64 `.exe`, Linux x86_64 `.AppImage` / `.deb` / `.rpm`, or macOS arm64 `.dmg`. Install RimR, then launch it. On macOS, open the disk image and drag RimR into Applications. On Linux, make the AppImage executable before launching it.
2. In Setup or Settings, autodetect your RimWorld paths and correct them if needed. The game data directory contains `Config/ModsConfig.xml`; it is separate from the game installation.
3. Save the paths and scan your installed mods.
4. Open Order, create or select a mod list, then add and arrange mods. Use **Sync from game order** to start from the game's current order.
5. Use **Save** to keep the list in RimR. Use **Apply** and review the changes to write the draft order to `ModsConfig.xml`.

Save and Apply are independent: Apply accepts unsaved drafts and does not save them to the RimR library. Diagnostics help you decide what to change; they do not block applying an order. Missing mods are reported and skipped when applying.

Starting with 0.4.0, RimR checks for stable updates at startup. You can also use **Help → Check for updates**. Updates are downloaded and installed only after you choose to proceed, and their signatures are verified before installation. Windows, macOS, and Linux AppImage support installation from the app; deb/rpm installations open the release downloads for manual updating. Save any pending changes before installing. Older versions need a manual installation of 0.4.0 or later first.

## Learn more

- [Usage and troubleshooting](docs/features.md): lists, search, tags, imports, logs, and file operations.
- [Design](docs/design.md): identities, data ownership, persistence, and upgrade boundaries.
- [Development](docs/development.md): local setup, architecture constraints, and checks.
- [UI conventions](docs/ui-style.md): compact desktop layout and interaction rules.

RimR is licensed under [GPL-3.0](LICENSE).
