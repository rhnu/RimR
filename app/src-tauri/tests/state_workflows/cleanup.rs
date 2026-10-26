use rimr_tauri_lib::dto::{
    CleanModsRequest, CommandErrorCode, ModCleanupKindDto, ModCleanupPreviewRequest,
    ValidateActiveOrderRequest,
};

use super::{sample_state, write_bytes, write_file};

#[tokio::test]
async fn texture_only_cleanup_preview_filters_texture_residue_mods() {
    let (dir, state) = sample_state();
    let local_texture = dir.path().join("RimWorld/Mods/TextureResidue");
    let local_other = dir.path().join("RimWorld/Mods/InvalidOther");
    let local_empty = dir.path().join("RimWorld/Mods/EmptyInvalid");
    let expansion_texture = dir.path().join("RimWorld/Data/InvalidExpansion");
    let workshop_root = dir.path().join("steamapps/workshop/content/294100");
    let workshop_texture = workshop_root.join("2009463077");

    write_bytes(&local_texture.join("Textures/a.dds"), b"dds");
    write_bytes(&local_texture.join("Textures/Sub/b.zstd"), b"zstd");
    write_bytes(&local_other.join("Textures/a.png"), b"png");
    std::fs::create_dir_all(&local_empty).unwrap();
    write_bytes(&expansion_texture.join("Textures/a.dds"), b"dds");
    write_bytes(&workshop_texture.join("Textures/a.DDS"), b"dds");

    let mut config = state.get_config().unwrap();
    config.paths.workshop_mods_dir = Some(workshop_root);
    state.replace_config(config).unwrap();

    let preview = state
        .preview_mod_cleanup(ModCleanupPreviewRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
        })
        .await
        .unwrap();
    let paths = preview
        .candidates
        .iter()
        .map(|candidate| candidate.path.as_str())
        .collect::<Vec<_>>();

    assert!(paths.iter().any(|path| path.ends_with("TextureResidue")));
    assert!(paths.iter().any(|path| path.ends_with("2009463077")));
    assert!(!paths.iter().any(|path| path.ends_with("InvalidOther")));
    assert!(!paths.iter().any(|path| path.ends_with("EmptyInvalid")));
    assert!(!paths.iter().any(|path| path.ends_with("InvalidExpansion")));
    assert_eq!(
        preview
            .candidates
            .iter()
            .find(|candidate| candidate.path.ends_with("TextureResidue"))
            .map(|candidate| candidate.file_count),
        Some(2)
    );
}

#[tokio::test]
async fn invalid_cleanup_preview_includes_all_invalid_local_and_workshop_mods() {
    let (dir, state) = sample_state();
    let local_no_about = dir.path().join("RimWorld/Mods/NoAbout");
    let local_malformed = dir.path().join("RimWorld/Mods/Malformed");
    let local_missing_package = dir.path().join("RimWorld/Mods/MissingPackage");
    let expansion_invalid = dir.path().join("RimWorld/Data/InvalidExpansion");
    let workshop_root = dir.path().join("steamapps/workshop/content/294100");
    let workshop_no_about = workshop_root.join("2009463077");

    write_bytes(&local_no_about.join("Textures/a.dds"), b"dds");
    write_file(
        &local_malformed.join("About/About.xml"),
        "<ModMetaData><packageId>bad</packageId",
    );
    write_file(
        &local_missing_package.join("About/About.xml"),
        "<ModMetaData><name>No package</name></ModMetaData>",
    );
    write_bytes(&expansion_invalid.join("Textures/a.dds"), b"dds");
    write_bytes(&workshop_no_about.join("Textures/a.dds"), b"dds");

    let mut config = state.get_config().unwrap();
    config.paths.workshop_mods_dir = Some(workshop_root);
    state.replace_config(config).unwrap();

    let preview = state
        .preview_mod_cleanup(ModCleanupPreviewRequest {
            kind: ModCleanupKindDto::Invalid,
        })
        .await
        .unwrap();
    let paths = preview
        .candidates
        .iter()
        .map(|candidate| candidate.path.as_str())
        .collect::<Vec<_>>();

    assert!(paths.iter().any(|path| path.ends_with("NoAbout")));
    assert!(paths.iter().any(|path| path.ends_with("Malformed")));
    assert!(paths.iter().any(|path| path.ends_with("MissingPackage")));
    assert!(paths.iter().any(|path| path.ends_with("2009463077")));
    assert!(!paths.iter().any(|path| path.ends_with("InvalidExpansion")));
    assert!(!paths.iter().any(|path| path.ends_with("LocalMod")));
}

#[tokio::test]
async fn clean_mods_revalidates_requested_texture_candidates() {
    let (dir, state) = sample_state();
    let local_texture = dir.path().join("RimWorld/Mods/TextureResidue");
    write_bytes(&local_texture.join("Textures/a.dds"), b"dds");

    let preview = state
        .preview_mod_cleanup(ModCleanupPreviewRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
        })
        .await
        .unwrap();
    let source_key = preview
        .candidates
        .iter()
        .find(|candidate| candidate.path.ends_with("TextureResidue"))
        .expect("texture residue should be a candidate")
        .source_key
        .clone();

    write_file(
        &local_texture.join("About/About.xml"),
        "<ModMetaData><packageId>now.valid</packageId></ModMetaData>",
    );

    let result = state
        .clean_mods(CleanModsRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
            source_keys: vec![source_key],
        })
        .await
        .unwrap();

    assert!(result.cleaned.is_empty());
    assert_eq!(result.skipped.len(), 1);
    assert!(local_texture.exists());
}

#[tokio::test]
async fn clean_mods_clears_session_cache_after_successful_cleanup() {
    let (dir, state) = sample_state();
    let local_texture = dir.path().join("RimWorld/Mods/TextureResidue");
    write_bytes(&local_texture.join("Textures/a.dds"), b"dds");

    let preview = state
        .preview_mod_cleanup(ModCleanupPreviewRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
        })
        .await
        .unwrap();
    let source_key = preview
        .candidates
        .iter()
        .find(|candidate| candidate.path.ends_with("TextureResidue"))
        .expect("texture residue should be a candidate")
        .source_key
        .clone();

    state
        .validate_active_order(ValidateActiveOrderRequest {
            active_mods: vec!["local.mod".to_string()],
        })
        .unwrap();

    let result = state
        .clean_mods(CleanModsRequest {
            kind: ModCleanupKindDto::TextureOnlyInvalid,
            source_keys: vec![source_key],
        })
        .await
        .unwrap();

    assert_eq!(result.cleaned.len(), 1);
    assert!(result.skipped.is_empty());
    assert!(!local_texture.exists());

    let validation = state.validate_active_order(ValidateActiveOrderRequest {
        active_mods: vec!["local.mod".to_string()],
    });
    assert!(matches!(validation, Err(ref e) if e.code == CommandErrorCode::StateMissing));
}
