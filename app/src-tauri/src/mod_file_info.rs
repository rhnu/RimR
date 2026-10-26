use crate::dto::{ModFolderSizeDto, ModPreviewDto};
use crate::error::{CommandError, CommandErrorCode, CommandResult};
use crate::fs_utils::resolve_path_case_insensitive;
use base64::Engine;
use image::{DynamicImage, GenericImageView, ImageFormat, imageops::FilterType};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone)]
pub struct CachedModPreview {
    fingerprint: ModPreviewFingerprint,
    dto: ModPreviewDto,
}

#[derive(Debug, Clone)]
pub struct LoadedModPreview {
    pub dto: ModPreviewDto,
    pub cache: CachedModPreview,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ModPreviewFingerprint {
    mod_icon_path: Option<String>,
    preview_path: Option<String>,
    preview_modified_at_ms: Option<u64>,
    preview_size_bytes: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct CachedModFolderSize {
    fingerprint: ModFolderSizeFingerprint,
    dto: ModFolderSizeDto,
}

#[derive(Debug, Clone)]
pub struct LoadedModFolderSize {
    pub dto: ModFolderSizeDto,
    pub cache: CachedModFolderSize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ModFolderSizeFingerprint {
    modified_at_ms: u64,
}

pub fn load_mod_preview(
    source_key: String,
    mod_path: PathBuf,
    mod_icon_path: Option<String>,
    cached: Option<CachedModPreview>,
) -> CommandResult<LoadedModPreview> {
    tracing::info!(%source_key, ?mod_path, cache_hit = cached.is_some(), "loading mod preview");
    ensure_readable_path(&mod_path)?;
    let preview_path = find_preview_path(&mod_path, mod_icon_path.as_deref());
    let preview_metadata = preview_path
        .as_ref()
        .and_then(|path| std::fs::metadata(path).ok());
    let fingerprint = ModPreviewFingerprint {
        mod_icon_path,
        preview_path: preview_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        preview_modified_at_ms: preview_metadata.as_ref().map(metadata_modified_at_ms),
        preview_size_bytes: preview_metadata.as_ref().map(std::fs::Metadata::len),
    };

    if let Some(cached) = cached
        && cached.fingerprint == fingerprint
    {
        return Ok(LoadedModPreview {
            dto: cached.dto.clone(),
            cache: cached,
        });
    }

    let preview_data_url = preview_path
        .and_then(|path| preview_data_url(&path).ok())
        .flatten();
    let dto = ModPreviewDto {
        source_key: source_key.clone(),
        preview_data_url,
    };
    tracing::info!(%source_key, has_preview = dto.preview_data_url.is_some(), "mod preview loaded");
    let cache = CachedModPreview {
        fingerprint,
        dto: dto.clone(),
    };
    Ok(LoadedModPreview { dto, cache })
}

pub fn load_mod_folder_size(
    source_key: String,
    mod_path: PathBuf,
    cached: Option<CachedModFolderSize>,
) -> CommandResult<LoadedModFolderSize> {
    tracing::info!(%source_key, ?mod_path, cache_hit = cached.is_some(), "loading mod folder size");
    let metadata = ensure_readable_path(&mod_path)?;
    let fingerprint = ModFolderSizeFingerprint {
        modified_at_ms: metadata_modified_at_ms(&metadata),
    };

    if let Some(cached) = cached
        && cached.fingerprint == fingerprint
    {
        return Ok(LoadedModFolderSize {
            dto: cached.dto.clone(),
            cache: cached,
        });
    }

    let dto = ModFolderSizeDto {
        source_key: source_key.clone(),
        folder_size_bytes: folder_size_best_effort(&mod_path),
    };
    tracing::info!(%source_key, folder_size_bytes = dto.folder_size_bytes, "mod folder size loaded");
    let cache = CachedModFolderSize {
        fingerprint,
        dto: dto.clone(),
    };
    Ok(LoadedModFolderSize { dto, cache })
}

fn ensure_readable_path(path: &Path) -> CommandResult<std::fs::Metadata> {
    std::fs::metadata(path).map_err(|error| {
        tracing::error!(path = ?path, error = %error, "mod path is not readable");
        CommandError::new(CommandErrorCode::SourceIo, error.to_string())
            .with_path(path.to_path_buf())
    })
}

fn metadata_modified_at_ms(metadata: &std::fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn folder_size_best_effort(path: &Path) -> u64 {
    let Ok(metadata) = std::fs::symlink_metadata(path) else {
        return 0;
    };
    if metadata.is_file() {
        return metadata.len();
    }
    if !metadata.is_dir() {
        return 0;
    }
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| folder_size_best_effort(&entry.path()))
        .sum()
}

fn find_preview_path(mod_path: &Path, mod_icon_path: Option<&str>) -> Option<PathBuf> {
    resolve_path_case_insensitive(mod_path, Path::new("About/Preview.png"))
        .or_else(|| mod_icon_path.and_then(|path| find_mod_icon_path(mod_path, path)))
}

const ICON_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp"];

fn find_mod_icon_path(mod_path: &Path, mod_icon_path: &str) -> Option<PathBuf> {
    let raw = PathBuf::from(mod_icon_path);
    if raw.is_absolute() {
        return resolve_absolute_icon_path(&raw);
    }
    if let Some(found) = resolve_path_case_insensitive(mod_path, &raw)
        && found.is_file()
    {
        return Some(found);
    }
    resolve_icon_with_extension_fallback(mod_path, &raw)
}

fn resolve_absolute_icon_path(raw: &Path) -> Option<PathBuf> {
    if raw.is_file() {
        return Some(raw.to_path_buf());
    }
    for extension in ICON_EXTENSIONS {
        let candidate = raw.with_extension(extension);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn resolve_icon_with_extension_fallback(mod_path: &Path, relative: &Path) -> Option<PathBuf> {
    let parent_rel = relative.parent().unwrap_or_else(|| Path::new(""));
    let parent = resolve_path_case_insensitive(mod_path, parent_rel)?;
    let stem = relative.file_stem()?.to_str()?;
    let entries = std::fs::read_dir(&parent).ok()?;
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        let Some(entry_stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if !entry_stem.eq_ignore_ascii_case(stem) {
            continue;
        }
        let Some(extension) = path.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        if ICON_EXTENSIONS
            .iter()
            .any(|allowed| allowed.eq_ignore_ascii_case(extension))
            && path.is_file()
        {
            return Some(path);
        }
    }
    None
}

fn preview_data_url(path: &Path) -> CommandResult<Option<String>> {
    const MAX_PREVIEW_BYTES: u64 = 8 * 1024 * 1024;
    const MAX_ORIGINAL_FALLBACK_BYTES: usize = 256 * 1024;
    const MAX_DISPLAY_PREVIEW_EDGE: u32 = 512;
    let metadata = std::fs::metadata(path).map_err(|error| {
        CommandError::new(CommandErrorCode::SourceIo, error.to_string())
            .with_path(path.to_path_buf())
    })?;
    if metadata.len() > MAX_PREVIEW_BYTES {
        return Ok(None);
    }
    let (mime, format) = match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png") => ("image/png", ImageFormat::Png),
        Some("jpg" | "jpeg") => ("image/jpeg", ImageFormat::Jpeg),
        Some("webp") => ("image/webp", ImageFormat::WebP),
        _ => return Ok(None),
    };
    let bytes = std::fs::read(path).map_err(|error| {
        CommandError::new(CommandErrorCode::SourceIo, error.to_string())
            .with_path(path.to_path_buf())
    })?;
    let (mime, bytes) = match image::load_from_memory_with_format(&bytes, format) {
        Ok(image) if needs_display_resize(&image, MAX_DISPLAY_PREVIEW_EDGE) => (
            "image/png",
            resized_png_bytes(image, MAX_DISPLAY_PREVIEW_EDGE)?,
        ),
        Ok(_) => (mime, bytes),
        Err(_) if bytes.len() <= MAX_ORIGINAL_FALLBACK_BYTES => (mime, bytes),
        Err(_) => return Ok(None),
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(Some(format!("data:{mime};base64,{encoded}")))
}

fn needs_display_resize(image: &DynamicImage, max_edge: u32) -> bool {
    let (width, height) = image.dimensions();
    width > max_edge || height > max_edge
}

fn resized_png_bytes(image: DynamicImage, max_edge: u32) -> CommandResult<Vec<u8>> {
    let resized = image.resize(max_edge, max_edge, FilterType::Triangle);
    let mut bytes = Cursor::new(Vec::new());
    resized
        .write_to(&mut bytes, ImageFormat::Png)
        .map_err(|error| CommandError::new(CommandErrorCode::SourceIo, error.to_string()))?;
    Ok(bytes.into_inner())
}
