mod backups;
mod logs;
mod mod_lists;
mod mods;
mod saves;

pub use crate::error::{CommandError, CommandErrorCode, CommandResult};
pub use backups::*;
pub use logs::*;
pub use mod_lists::*;
pub use mods::*;
pub use saves::*;

use crate::app_config::AppConfig;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct SaveAppConfigRequest {
    pub config: AppConfig,
}
