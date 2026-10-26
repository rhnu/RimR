use rimr_core::{ModListId, ModMetadata, ModSourceKey, SourceKind, mod_list_from_active_mods};

use super::*;
use crate::app_config::{AppConfig, PathsConfig};

struct Fixture {
    _root: tempfile::TempDir,
    state: AppState,
    path: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = tempfile::tempdir().unwrap();
        let data_dir = root.path().join("game-data");
        let path = data_dir.join("Config/ModsConfig.xml");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, config_xml("1.6", "dlc.old")).unwrap();
        let config = AppConfig {
            paths: PathsConfig {
                game_dir: Some(root.path().join("game")),
                game_data_dir: Some(data_dir),
                rimr_data_dir: Some(root.path().join("library")),
                ..PathsConfig::default()
            },
        };
        let state = AppState::with_config(None, config, None, None, false);
        Self {
            _root: root,
            state,
            path,
        }
    }

    fn install_catalog(&self) {
        let mut catalog = ModCatalog::new();
        let mut metadata = ModMetadata::invalid(ModSourceKey::new("installed"), SourceKind::Local);
        metadata.package_id = PackageId::new("mod.installed");
        metadata.valid = true;
        catalog.insert(metadata);
        self.state
            .write_state()
            .unwrap()
            .workspace
            .replace_catalog(catalog, rimr_core::GameVersion::unknown());
    }
}

fn config_xml(version: &str, dlc: &str) -> String {
    format!(
        "<ModsConfigData><version>{version}</version><activeMods><li>original</li></activeMods><knownExpansions><li>{dlc}</li></knownExpansions></ModsConfigData>"
    )
}

fn request() -> ApplyModListRequest {
    // This is an unsaved draft. Apply must not require or create a stored list.
    let list = mod_list_from_active_mods(
        ModListId::new(),
        "Draft",
        &[
            " Mod.Installed ".into(),
            "mod.missing".into(),
            "mod.installed".into(),
        ],
        None,
    );
    ApplyModListRequest {
        mod_list: dto::mod_list_from_core(&list),
    }
}

#[tokio::test]
async fn apply_requires_catalog_before_writing() {
    let fixture = Fixture::new();
    fixture.state.load_active_list().await.unwrap();
    let original = std::fs::read(&fixture.path).unwrap();
    let error = fixture
        .state
        .apply_mod_list_to_game(request())
        .await
        .unwrap_err();
    assert_eq!(error.code, AppErrorCode::StateMissing);
    assert_eq!(std::fs::read(&fixture.path).unwrap(), original);
}

#[tokio::test]
async fn apply_uses_current_game_fields_and_reports_the_written_order_without_saving() {
    let fixture = Fixture::new();
    fixture.install_catalog();
    fixture.state.load_active_list().await.unwrap();
    std::fs::write(&fixture.path, config_xml("1.7", "dlc.new")).unwrap();

    let result = fixture
        .state
        .apply_mod_list_to_game(request())
        .await
        .unwrap();
    let written = rimr_core::parse_mods_config(&std::fs::read(&fixture.path).unwrap()).unwrap();
    assert_eq!(result.active_mods, ["mod.installed"]);
    assert_eq!(result.skipped_missing_packages, ["mod.missing"]);
    assert_eq!(written.active_mods, [PackageId::new("mod.installed")]);
    assert_eq!(&*written.version, "1.7");
    assert_eq!(written.known_expansions, [PackageId::new("dlc.new")]);
    assert_eq!(
        fixture.state.read_state().unwrap().workspace.mods_config(),
        Some(&written)
    );
    let data_dir = fixture.state.rimr_data_dir().unwrap();
    assert!(!current::library_path(&data_dir).exists());
}

#[tokio::test]
async fn invalid_current_config_is_not_overwritten_or_published() {
    let fixture = Fixture::new();
    fixture.install_catalog();
    fixture.state.load_active_list().await.unwrap();
    let loaded = fixture
        .state
        .read_state()
        .unwrap()
        .workspace
        .mods_config()
        .cloned();
    let corrupt = b"<ModsConfigData><version>1.7</version>";
    std::fs::write(&fixture.path, corrupt).unwrap();

    let error = fixture
        .state
        .apply_mod_list_to_game(request())
        .await
        .unwrap_err();
    assert_eq!(error.code, AppErrorCode::ModsConfigInvalid);
    assert_eq!(std::fs::read(&fixture.path).unwrap(), corrupt);
    assert_eq!(
        fixture.state.read_state().unwrap().workspace.mods_config(),
        loaded.as_ref()
    );
}

#[tokio::test]
async fn failed_apply_keeps_disk_and_session_at_their_prior_values() {
    let fixture = Fixture::new();
    fixture.install_catalog();
    fixture.state.load_active_list().await.unwrap();
    let loaded = fixture
        .state
        .read_state()
        .unwrap()
        .workspace
        .mods_config()
        .cloned();
    let current = config_xml("1.7", "dlc.new");
    std::fs::write(&fixture.path, &current).unwrap();
    std::fs::create_dir(fixture.path.with_extension("xml.rimr-tmp")).unwrap();

    let error = fixture
        .state
        .apply_mod_list_to_game(request())
        .await
        .unwrap_err();
    assert_eq!(error.code, AppErrorCode::SourceIo);
    assert_eq!(std::fs::read_to_string(&fixture.path).unwrap(), current);
    assert_eq!(
        fixture.state.read_state().unwrap().workspace.mods_config(),
        loaded.as_ref()
    );
}
