use super::mods_conv::{source_kind, source_kind_to_core};
use rimr_bindings::dto::*;
use rimr_core::{
    Alias, GroupChild, Library as CoreLibrary, LibrarySettings as CoreLibrarySettings,
    LibrarySettingsFile as CoreLibrarySettingsFile, ModIdentity as CoreModIdentity,
    ModList as CoreModList, ModListEntry as CoreModListEntry, ModListFile as CoreModListFile,
    ModListIndex as CoreModListIndex, ModListSummary as CoreModListSummary,
    ModTagBinding as CoreModTagBinding, TagDef as CoreTagDef,
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

pub fn tag_def_to_core(dto: &TagDefDto) -> CoreTagDef {
    CoreTagDef {
        id: dto.id.clone(),
        name: dto.name.clone(),
        color: dto.color.clone(),
    }
}

pub fn tag_def_from_core(def: &CoreTagDef) -> TagDefDto {
    TagDefDto {
        id: def.id.clone(),
        name: def.name.clone(),
        color: def.color.clone(),
    }
}

pub fn mod_tag_binding_to_core(dto: &ModTagBindingDto) -> CoreModTagBinding {
    CoreModTagBinding {
        identity: mod_identity_to_core(&dto.identity),
        tag_ids: dto.tag_ids.clone(),
    }
}

pub fn mod_tag_binding_from_core(binding: &CoreModTagBinding) -> ModTagBindingDto {
    ModTagBindingDto {
        identity: mod_identity_from_core(&binding.identity),
        tag_ids: binding.tag_ids.clone(),
    }
}

pub fn library_settings_to_core(dto: &LibrarySettingsDto) -> CoreLibrarySettings {
    CoreLibrarySettings {
        format_version: dto.format_version,
        aliases: dto.aliases.iter().map(alias_to_core).collect(),
        tag_defs: dto.tag_defs.iter().map(tag_def_to_core).collect(),
        mod_tags: dto.mod_tags.iter().map(mod_tag_binding_to_core).collect(),
    }
}

pub fn library_settings_from_core(config: &CoreLibrarySettings) -> LibrarySettingsDto {
    LibrarySettingsDto {
        format_version: config.format_version,
        aliases: config.aliases.iter().map(alias_from_core).collect(),
        tag_defs: config.tag_defs.iter().map(tag_def_from_core).collect(),
        mod_tags: config
            .mod_tags
            .iter()
            .map(mod_tag_binding_from_core)
            .collect(),
    }
}

fn group_child_to_core(dto: &ModListGroupChildDto) -> GroupChild {
    GroupChild {
        id: dto.id.clone(),
        active: dto.active,
        identity: mod_identity_to_core(&dto.identity),
    }
}

fn group_child_from_core(child: &GroupChild) -> ModListGroupChildDto {
    ModListGroupChildDto {
        id: child.id.clone(),
        active: child.active,
        identity: mod_identity_from_core(&child.identity),
    }
}

fn mod_list_entry_to_core(dto: &ModListEntryDto) -> CoreModListEntry {
    match dto {
        ModListEntryDto::Mod {
            id,
            active,
            identity,
        } => CoreModListEntry::Mod {
            id: id.clone(),
            active: *active,
            identity: mod_identity_to_core(identity),
        },
        ModListEntryDto::Group {
            id,
            name,
            collapsed,
            entries,
        } => CoreModListEntry::Group {
            id: id.clone(),
            name: name.clone(),
            collapsed: *collapsed,
            entries: entries.iter().map(group_child_to_core).collect(),
        },
        ModListEntryDto::Separator {
            id,
            title,
            note,
            color,
        } => CoreModListEntry::Separator {
            id: id.clone(),
            title: title.clone(),
            note: note.clone(),
            color: color.clone(),
        },
    }
}

fn mod_list_entry_from_core(entry: &CoreModListEntry) -> ModListEntryDto {
    match entry {
        CoreModListEntry::Mod {
            id,
            active,
            identity,
        } => ModListEntryDto::Mod {
            id: id.clone(),
            active: *active,
            identity: mod_identity_from_core(identity),
        },
        CoreModListEntry::Group {
            id,
            name,
            collapsed,
            entries,
        } => ModListEntryDto::Group {
            id: id.clone(),
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
            id: id.clone(),
            title: title.clone(),
            note: note.clone(),
            color: color.clone(),
        },
    }
}

pub fn mod_list_to_core(dto: &ModListDto) -> CoreModList {
    CoreModList {
        format_version: dto.format_version,
        id: dto.id.clone(),
        name: dto.name.clone(),
        note: dto.note.clone(),
        entries: dto.entries.iter().map(mod_list_entry_to_core).collect(),
        active_mods: dto.active_mods.clone(),
    }
}

pub fn mod_list_from_core(ml: &CoreModList) -> ModListDto {
    ModListDto {
        format_version: ml.format_version,
        id: ml.id.clone(),
        name: ml.name.clone(),
        note: ml.note.clone(),
        entries: ml.entries.iter().map(mod_list_entry_from_core).collect(),
        active_mods: ml.active_mods.clone(),
    }
}

fn mod_list_summary_to_core(dto: &ModListSummaryDto) -> CoreModListSummary {
    CoreModListSummary {
        id: dto.id.clone(),
        name: dto.name.clone(),
    }
}

fn mod_list_summary_from_core(s: &CoreModListSummary) -> ModListSummaryDto {
    ModListSummaryDto {
        id: s.id.clone(),
        name: s.name.clone(),
    }
}

pub fn mod_list_index_to_core(dto: &ModListIndexDto) -> CoreModListIndex {
    CoreModListIndex {
        format_version: dto.format_version,
        current_mod_list_id: dto.current_mod_list_id.clone(),
        mod_lists: dto.mod_lists.iter().map(mod_list_summary_to_core).collect(),
    }
}

pub fn mod_list_index_from_core(index: &CoreModListIndex) -> ModListIndexDto {
    ModListIndexDto {
        format_version: index.format_version,
        current_mod_list_id: index.current_mod_list_id.clone(),
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
