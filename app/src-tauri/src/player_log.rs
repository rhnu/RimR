use regex::Regex;
use std::sync::OnceLock;

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
            LogSource::PlayerLog => "Player.log",
            LogSource::PlayerPrevLog => "Player-prev.log",
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
        let line_number = (index + 1) as u32;
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
            LogLevel::Info => {}
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

    let total_lines = entries.len() as u32;

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
mod tests {
    use super::*;

    #[test]
    fn classifies_exception_lines() {
        assert_eq!(
            classify_line(
                "NullReferenceException: Object reference not set to an instance of an object"
            ),
            LogLevel::Exception
        );
        assert_eq!(
            classify_line(
                "System.NullReferenceException: Object reference not set to an instance of an object"
            ),
            LogLevel::Exception
        );
        assert_eq!(
            classify_line("Caught Exception initialising 'Tweak_X' tweak:"),
            LogLevel::Exception
        );
        assert_eq!(
            classify_line(
                "System.ArgumentException: An item with the same key has already been added."
            ),
            LogLevel::Exception
        );
        assert_eq!(
            classify_line("FileNotFoundException: Cannot resolve dependency to assembly 'X'"),
            LogLevel::Exception
        );
    }

    #[test]
    fn classifies_error_lines() {
        assert_eq!(
            classify_line("ERROR: Shader GodHand/ObjectOutline shader is not supported"),
            LogLevel::Error
        );
        assert_eq!(
            classify_line("Fallback handler could not load library E:/path/to.dll"),
            LogLevel::Error
        );
        assert_eq!(
            classify_line(
                "Could not execute post-long-event action. Exception: System.KeyNotFoundException"
            ),
            LogLevel::Error
        );
    }

    #[test]
    fn classifies_warning_lines() {
        assert_eq!(
            classify_line(
                "Mod X dependency (Y) needs to have <downloadUrl> and/or <steamWorkshopUrl> specified."
            ),
            LogLevel::Warning
        );
        assert_eq!(
            classify_line("WARNING: something happened"),
            LogLevel::Warning
        );
        assert_eq!(
            classify_line("This is a warning about deprecation"),
            LogLevel::Warning
        );
    }

    #[test]
    fn classifies_info_lines() {
        assert_eq!(classify_line("Mono path[0] = 'E:/path'"), LogLevel::Info);
        assert_eq!(classify_line("RimWorld 1.6.4850 rev646"), LogLevel::Info);
        assert_eq!(classify_line("  - Lemontea.SimpleSidearms"), LogLevel::Info);
    }

    #[test]
    fn detects_stack_traces() {
        assert!(is_stack_trace(
            "  at TweaksGalore.TweakWorker_X.OnStartup () [0x00028] in <hash>:0"
        ));
        assert!(is_stack_trace(
            "    at SomeClass.Method () [0x00028] in <hash>:0"
        ));
        assert!(!is_stack_trace("Caught Exception initialising 'Tweak_X'"));
        assert!(!is_stack_trace("  - Lemontea.SimpleSidearms"));
    }

    #[test]
    fn extracts_ref_ids() {
        assert_eq!(
            extract_ref_id("[Ref B50F8036]"),
            Some("B50F8036".to_string())
        );
        assert_eq!(
            extract_ref_id("[Ref 602EAE42] Duplicate stacktrace, see ref for original"),
            Some("602EAE42".to_string())
        );
        assert_eq!(extract_ref_id("No ref here"), None);
    }

    #[test]
    fn extracts_duplicate_refs() {
        assert_eq!(
            extract_duplicate_ref("[Ref 602EAE42] Duplicate stacktrace, see ref for original"),
            Some("602EAE42".to_string())
        );
        assert_eq!(extract_duplicate_ref("[Ref B50F8036]"), None);
    }

    #[test]
    fn parses_full_log_sample() {
        let sample = r#"RimWorld 1.6.4850 rev646
Mod X dependency (Y) needs to have <downloadUrl> specified.
ERROR: Shader is not supported
NullReferenceException: Object reference not set
[Ref B50F8036]
  at SomeClass.Method () [0x00028] in <hash>:0
NullReferenceException: Object reference not set
[Ref 602EAE42] Duplicate stacktrace, see ref for original

"#;
        let result = parse_player_log(sample, LogSource::PlayerLog);
        assert_eq!(result.total_lines, 9);
        assert_eq!(result.exception_count, 3);
        assert_eq!(result.error_count, 1);
        assert_eq!(result.warning_count, 1);

        let st_entry = result.entries.iter().find(|e| e.is_stack_trace).unwrap();
        assert_eq!(st_entry.line_number, 6);

        let ref_entry = result
            .entries
            .iter()
            .find(|e| e.ref_id == Some("B50F8036".to_string()))
            .unwrap();
        assert_eq!(ref_entry.line_number, 5);
        assert_eq!(ref_entry.level, LogLevel::Info);

        let dup_entry = result
            .entries
            .iter()
            .find(|e| e.duplicate_ref.is_some())
            .unwrap();
        assert_eq!(dup_entry.duplicate_ref, Some("602EAE42".to_string()));
        assert_eq!(dup_entry.level, LogLevel::Exception);
    }
}
