use rimr_bindings::dto::{
    DisplayAliasDto, LibraryDto, LibrarySettingsDto, LibrarySettingsFileDto, ModIdentityDto,
    ModListDto, ModListEntryDto, ModListFileDto, ModListGroupChildDto, ModListIndexDto,
    ModListSummaryDto, ModTagBindingDto, RimrFileKind, TagDefDto,
};
use rimr_core::{
    Alias, GroupChild, Library as CoreLibrary, LibrarySettings as CoreLibrarySettings,
    ModIdentity as CoreModIdentity, ModList as CoreModList, ModListEntry as CoreModListEntry,
    ModListIndex as CoreModListIndex, ModListSummary as CoreModListSummary,
    ModTagBinding as CoreModTagBinding, TagDef as CoreTagDef,
};

use super::mods_conv::{source_kind, source_kind_to_core};
use crate::{
    AppResult, LibrarySettingsFile as CoreLibrarySettingsFile, ModListFile as CoreModListFile,
};

pub fn mod_identity_to_core(dto: &ModIdentityDto) -> CoreModIdentity {
    CoreModIdentity {
        package_id: dto.package_id.clone(),
        source_kind: dto.source_kind.map(source_kind_to_core),
        source_key: dto.source_key.clone(),
        steam_app_id: dto.steam_app_id,
    }
}

pub fn mod_identity_from_core(identity: &CoreModIdentity) -> ModIdentityDto {
    ModIdentityDto {
        package_id: identity.package_id.clone(),
        source_kind: identity.source_kind.map(source_kind),
        source_key: identity.source_key.clone(),
        steam_app_id: identity.steam_app_id,
    }
}

pub fn alias_to_core(dto: &DisplayAliasDto) -> Alias {
    Alias {
        identity: mod_identity_to_core(&dto.identity),
        display_alias: dto.display_alias.clone(),
    }
}

pub fn alias_from_core(alias: &Alias) -> DisplayAliasDto {
    DisplayAliasDto {
        identity: mod_identity_from_core(&alias.identity),
        display_alias: alias.display_alias.clone(),
    }
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn tag_def_to_core(dto: &TagDefDto) -> AppResult<CoreTagDef> {
    Ok(CoreTagDef {
        id: dto.id.parse()?,
        name: dto.name.clone(),
        color: dto.color.clone(),
    })
}

pub fn tag_def_from_core(def: &CoreTagDef) -> TagDefDto {
    TagDefDto {
        id: def.id.to_string(),
        name: def.name.clone(),
        color: def.color.clone(),
    }
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn mod_tag_binding_to_core(dto: &ModTagBindingDto) -> AppResult<CoreModTagBinding> {
    Ok(CoreModTagBinding {
        identity: mod_identity_to_core(&dto.identity),
        tag_ids: dto
            .tag_ids
            .iter()
            .map(|id| id.parse())
            .collect::<Result<_, _>>()?,
    })
}

pub fn mod_tag_binding_from_core(binding: &CoreModTagBinding) -> ModTagBindingDto {
    ModTagBindingDto {
        identity: mod_identity_from_core(&binding.identity),
        tag_ids: binding.tag_ids.iter().map(ToString::to_string).collect(),
    }
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn library_settings_to_core(dto: &LibrarySettingsDto) -> AppResult<CoreLibrarySettings> {
    Ok(CoreLibrarySettings {
        revision: dto.revision,
        aliases: dto.aliases.iter().map(alias_to_core).collect(),
        tag_defs: dto
            .tag_defs
            .iter()
            .map(tag_def_to_core)
            .collect::<AppResult<_>>()?,
        mod_tags: dto
            .mod_tags
            .iter()
            .map(mod_tag_binding_to_core)
            .collect::<AppResult<_>>()?,
    })
}

pub fn library_settings_from_core(config: &CoreLibrarySettings) -> LibrarySettingsDto {
    LibrarySettingsDto {
        revision: config.revision,
        aliases: config.aliases.iter().map(alias_from_core).collect(),
        tag_defs: config.tag_defs.iter().map(tag_def_from_core).collect(),
        mod_tags: config
            .mod_tags
            .iter()
            .map(mod_tag_binding_from_core)
            .collect(),
    }
}

fn group_child_to_core(dto: &ModListGroupChildDto) -> AppResult<GroupChild> {
    Ok(GroupChild {
        id: dto.id.parse()?,
        active: dto.active,
        identity: mod_identity_to_core(&dto.identity),
    })
}

fn group_child_from_core(child: &GroupChild) -> ModListGroupChildDto {
    ModListGroupChildDto {
        id: child.id.to_string(),
        active: child.active,
        identity: mod_identity_from_core(&child.identity),
    }
}

fn mod_list_entry_to_core(dto: &ModListEntryDto) -> AppResult<CoreModListEntry> {
    Ok(match dto {
        ModListEntryDto::Mod {
            id,
            active,
            identity,
        } => CoreModListEntry::Mod {
            id: id.parse()?,
            active: *active,
            identity: mod_identity_to_core(identity),
        },
        ModListEntryDto::Group {
            id,
            name,
            collapsed,
            entries,
        } => CoreModListEntry::Group {
            id: id.parse()?,
            name: name.clone(),
            collapsed: *collapsed,
            entries: entries
                .iter()
                .map(group_child_to_core)
                .collect::<AppResult<_>>()?,
        },
        ModListEntryDto::Separator {
            id,
            title,
            note,
            color,
        } => CoreModListEntry::Separator {
            id: id.parse()?,
            title: title.clone(),
            note: note.clone(),
            color: color.clone(),
        },
    })
}

fn mod_list_entry_from_core(entry: &CoreModListEntry) -> ModListEntryDto {
    match entry {
        CoreModListEntry::Mod {
            id,
            active,
            identity,
        } => ModListEntryDto::Mod {
            id: id.to_string(),
            active: *active,
            identity: mod_identity_from_core(identity),
        },
        CoreModListEntry::Group {
            id,
            name,
            collapsed,
            entries,
        } => ModListEntryDto::Group {
            id: id.to_string(),
            name: name.clone(),
            collapsed: *collapsed,
            entries: entries.iter().map(group_child_from_core).collect(),
        },
        CoreModListEntry::Separator {
            id,
            title,
            note,
            color,
        } => ModListEntryDto::Separator {
            id: id.to_string(),
            title: title.clone(),
            note: note.clone(),
            color: color.clone(),
        },
    }
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn mod_list_to_core(dto: &ModListDto) -> AppResult<CoreModList> {
    Ok(CoreModList {
        revision: dto.revision,
        id: dto.id.parse()?,
        name: dto.name.clone(),
        note: dto.note.clone(),
        entries: dto
            .entries
            .iter()
            .map(mod_list_entry_to_core)
            .collect::<AppResult<_>>()?,
    })
}

pub fn mod_list_from_core(ml: &CoreModList) -> ModListDto {
    ModListDto {
        revision: ml.revision,
        id: ml.id.to_string(),
        name: ml.name.clone(),
        note: ml.note.clone(),
        entries: ml.entries.iter().map(mod_list_entry_from_core).collect(),
    }
}

fn mod_list_summary_to_core(dto: &ModListSummaryDto) -> AppResult<CoreModListSummary> {
    Ok(CoreModListSummary {
        id: dto.id.parse()?,
        name: dto.name.clone(),
    })
}

fn mod_list_summary_from_core(s: &CoreModListSummary) -> ModListSummaryDto {
    ModListSummaryDto {
        id: s.id.to_string(),
        name: s.name.clone(),
    }
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn mod_list_index_to_core(dto: &ModListIndexDto) -> AppResult<CoreModListIndex> {
    Ok(CoreModListIndex {
        current_mod_list_id: dto
            .current_mod_list_id
            .as_deref()
            .map(str::parse)
            .transpose()?,
        mod_lists: dto
            .mod_lists
            .iter()
            .map(mod_list_summary_to_core)
            .collect::<AppResult<_>>()?,
    })
}

pub fn mod_list_index_from_core(index: &CoreModListIndex) -> ModListIndexDto {
    ModListIndexDto {
        current_mod_list_id: index.current_mod_list_id.map(|id| id.to_string()),
        mod_lists: index
            .mod_lists
            .iter()
            .map(mod_list_summary_from_core)
            .collect(),
    }
}

pub fn library_from_core(library: &CoreLibrary, data_dir: &str) -> LibraryDto {
    LibraryDto {
        data_dir: data_dir.to_string(),
        settings: library_settings_from_core(&library.settings),
        mod_lists_index: mod_list_index_from_core(&library.mod_lists_index),
        current_mod_list: mod_list_from_core(&library.current_mod_list),
    }
}

pub fn mod_list_file_from_core(file: &CoreModListFile) -> ModListFileDto {
    ModListFileDto {
        kind: RimrFileKind::ModList,
        format_version: file.format_version,
        exported_at: file.exported_at.clone(),
        game_version: file.game_version.clone(),
        mod_list: mod_list_from_core(&file.mod_list),
    }
}

pub fn library_settings_file_from_core(file: &CoreLibrarySettingsFile) -> LibrarySettingsFileDto {
    LibrarySettingsFileDto {
        kind: RimrFileKind::LibrarySettings,
        format_version: file.format_version,
        exported_at: file.exported_at.clone(),
        settings: library_settings_from_core(&file.settings),
    }
}
