use rimr_bindings::dto::*;
use rimr_core::{ExportedRimrFile, GameConfigBackupFile};
use std::path::PathBuf;

pub fn export_game_config_backup(
    result: &ExportedRimrFile<GameConfigBackupFile>,
    output_path: Option<PathBuf>,
) -> ExportGameConfigBackupDto {
    ExportGameConfigBackupDto {
        file: game_config_backup(&result.file),
        json: result.json.clone(),
        output_path,
    }
}

pub fn game_config_backup(file: &GameConfigBackupFile) -> GameConfigBackupDto {
    GameConfigBackupDto {
        kind: RimrFileKind::GameConfigBackup,
        format_version: file.format_version,
        backup_at: file.backup_at.clone(),
        game_version: file.game_version.clone(),
        active_mods: file.active_mods.clone(),
        known_expansions: file.known_expansions.clone(),
        rimr_meta: GameConfigBackupMetaDto {
            note: file.note.clone(),
            tags: file.tags.clone(),
            groups: file.groups.clone(),
        },
    }
}
