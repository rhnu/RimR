/// Time source used by use cases that serialize user-visible timestamps.
pub trait Clock: Sync {
    fn now_rfc3339(&self) -> String;
}

/// Production clock returning the current UTC timestamp.
#[derive(Debug, Clone, Copy)]
pub struct AppClock;

impl Clock for AppClock {
    fn now_rfc3339(&self) -> String {
        current_rfc3339()
    }
}

fn current_rfc3339() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}
