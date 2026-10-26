//! Format history for the host application config (`config.json`).
//!
//! v1 -> v3: field additions only; serde defaults cover them.
//! v3 -> v4: `paths.configDir` (the game's `Config` folder) was replaced by
//!           `paths.gameDataDir` (its parent).

use super::Step;
use serde_json::Value;

/// Format version this build reads and writes.
pub(super) const TARGET: u32 = 4;

pub(super) const STEPS: &[Step] = &[
    Step {
        from: 1,
        to: 2,
        apply: noop,
    },
    Step {
        from: 2,
        to: 3,
        apply: noop,
    },
    Step {
        from: 3,
        to: 4,
        apply: config_dir_to_game_data_dir,
    },
];

fn noop(_value: &mut Value) -> Result<(), String> {
    Ok(())
}

fn config_dir_to_game_data_dir(value: &mut Value) -> Result<(), String> {
    let Some(paths) = value.get_mut("paths").and_then(Value::as_object_mut) else {
        return Ok(());
    };
    if paths.contains_key("gameDataDir") {
        return Ok(());
    }
    let Some(config_dir) = paths.get("configDir").and_then(Value::as_str) else {
        return Ok(());
    };
    let Some(parent) = std::path::Path::new(config_dir).parent() else {
        return Ok(());
    };
    let parent = parent.to_string_lossy().into_owned();
    tracing::info!(
        config_dir = config_dir,
        game_data_dir = %parent,
        "migrating configDir to gameDataDir"
    );
    paths.insert("gameDataDir".to_string(), Value::String(parent));
    Ok(())
}
