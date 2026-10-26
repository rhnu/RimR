//! Fatal errors from `RimWorld` file parsing.

use thiserror::Error;

/// Invalid game configuration or save-game input.
///
/// Load-order diagnostics remain non-fatal and are reported separately.
#[derive(Debug, Error)]
pub enum CoreError {
    #[error("mods config is invalid: {0}")]
    ModsConfigInvalid(String),

    #[error("save game file is invalid: {0}")]
    SaveGameInvalid(String),

    #[error("mods config XML cannot be parsed")]
    ModsConfigParse {
        #[source]
        source: quick_xml::Error,
    },

    #[error("save game XML cannot be parsed")]
    SaveGameParse {
        #[source]
        source: quick_xml::Error,
    },

    #[error("{compression} save game cannot be decompressed")]
    SaveGameDecode {
        compression: &'static str,
        #[source]
        source: std::io::Error,
    },
}
