use crate::{
    dto::{ReadSaveModIdsDto, ReadSaveModIdsRequest},
    error::{AppError, AppErrorCode, AppResult},
};

#[tracing::instrument(skip_all)]
/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub async fn read_save_mod_ids(request: ReadSaveModIdsRequest) -> AppResult<ReadSaveModIdsDto> {
    let bytes = tokio::fs::read(&request.path)
        .await
        .map_err(|source| AppError::io(AppErrorCode::SourceIo, &request.path, source))?;
    let ids = rimr_core::parse_save_mod_ids(&bytes).map_err(crate::error::core_error)?;
    Ok(ReadSaveModIdsDto {
        mod_ids: crate::dto::packages(&ids),
    })
}
