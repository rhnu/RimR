use rimr_bindings::dto::{ReadSaveModIdsDto, ReadSaveModIdsRequest};

use crate::error::CommandResult;

#[tauri::command]
#[tracing::instrument(skip_all)]
pub async fn read_save_mod_ids(request: ReadSaveModIdsRequest) -> CommandResult<ReadSaveModIdsDto> {
    rimr_app::saves::read_save_mod_ids(request)
        .await
        .map_err(crate::error::from_app)
}
