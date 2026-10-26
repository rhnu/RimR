use std::sync::OnceLock;

use regex::Regex;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Info,
    Warning,
    Error,
    Exception,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogSource {
    PlayerLog,
    PlayerPrevLog,
}

impl LogSource {
    pub fn file_name(&self) -> &'static str {
        match self {
            Self::PlayerLog => "Player.log",
            Self::PlayerPrevLog => "Player-prev.log",
        }
    }
}

#[derive(Debug, Clone)]
pub struct LogEntry {
    pub line_number: u32,
    pub level: LogLevel,
    pub text: String,
    pub is_stack_trace: bool,
    pub ref_id: Option<String>,
    pub duplicate_ref: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PlayerLogResult {
    pub entries: Vec<LogEntry>,
    pub total_lines: u32,
    pub error_count: u32,
    pub warning_count: u32,
    pub exception_count: u32,
    pub source: LogSource,
    pub file_path: String,
    pub file_size_bytes: u64,
    pub modified_at_ms: u64,
}

struct ClassificationPatterns {
    exception: Regex,
    ref_id: Regex,
    duplicate_ref: Regex,
}

fn patterns() -> &'static ClassificationPatterns {
    static PATTERNS: OnceLock<ClassificationPatterns> = OnceLock::new();
    PATTERNS.get_or_init(|| ClassificationPatterns {
        exception: Regex::new(
            r"(Exception\s*[:\s]|Exception\s+initialising|Exception\s+from|^System\.\w+Exception|^System\.\w+Error)",
        )
        .expect("valid regex"),
        ref_id: Regex::new(r"\[Ref ([0-9A-Fa-f]+)\]").expect("valid regex"),
        duplicate_ref: Regex::new(r"\[Ref ([0-9A-Fa-f]+)\].*Duplicate stacktrace").expect("valid regex"),
    })
}

fn classify_line(line: &str) -> LogLevel {
    let p = patterns();

    if p.duplicate_ref.is_match(line) {
        return LogLevel::Exception;
    }

    if line.contains("Could not execute post-long-event") {
        return LogLevel::Error;
    }

    if p.exception.is_match(line) {
        return LogLevel::Exception;
    }

    if line.contains("ERROR:")
        || line.contains("Error:")
        || line.contains("Fallback handler could not load")
        || line.contains("Could not load")
        || line.contains("Fatal")
    {
        return LogLevel::Error;
    }

    let lower = line.to_lowercase();
    if lower.contains("warning") || line.contains("needs to have") || lower.contains("deprecat") {
        return LogLevel::Warning;
    }

    LogLevel::Info
}

fn is_stack_trace(line: &str) -> bool {
    line.starts_with(' ') && line.trim_start().starts_with("at ")
}

fn extract_ref_id(line: &str) -> Option<String> {
    patterns()
        .ref_id
        .captures(line)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

fn extract_duplicate_ref(line: &str) -> Option<String> {
    patterns()
        .duplicate_ref
        .captures(line)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

pub fn parse_player_log(content: &str, source: LogSource) -> PlayerLogResult {
    let mut entries = Vec::new();
    let mut error_count = 0u32;
    let mut warning_count = 0u32;
    let mut exception_count = 0u32;

    for (index, line) in content.lines().enumerate() {
        let line_number = u32::try_from(index + 1).unwrap_or(u32::MAX);
        let level = classify_line(line);
        let is_st = is_stack_trace(line);
        let ref_id = extract_ref_id(line);
        let duplicate_ref = if line.contains("Duplicate stacktrace") {
            extract_duplicate_ref(line)
        } else {
            None
        };

        match level {
            LogLevel::Error => error_count += 1,
            LogLevel::Warning => warning_count += 1,
            LogLevel::Exception => exception_count += 1,
            LogLevel::Info => {},
        }

        entries.push(LogEntry {
            line_number,
            level,
            text: line.to_string(),
            is_stack_trace: is_st,
            ref_id,
            duplicate_ref,
        });
    }

    let total_lines = u32::try_from(entries.len()).unwrap_or(u32::MAX);

    PlayerLogResult {
        entries,
        total_lines,
        error_count,
        warning_count,
        exception_count,
        source,
        file_path: String::new(),
        file_size_bytes: 0,
        modified_at_ms: 0,
    }
}

#[cfg(test)]
mod tests;
