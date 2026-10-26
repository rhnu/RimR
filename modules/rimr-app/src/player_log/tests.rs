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
    let sample = r"RimWorld 1.6.4850 rev646
Mod X dependency (Y) needs to have <downloadUrl> specified.
ERROR: Shader is not supported
NullReferenceException: Object reference not set
[Ref B50F8036]
  at SomeClass.Method () [0x00028] in <hash>:0
NullReferenceException: Object reference not set
[Ref 602EAE42] Duplicate stacktrace, see ref for original

";
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
