mod acf;
pub use acf::*;

use std::path::Path;

pub const RIMWORLD_APP_ID: u32 = 294_100;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkshopFileId(String);

impl WorkshopFileId {
    pub fn new(value: impl Into<String>) -> Option<Self> {
        let value = value.into();
        if value.is_empty() || !value.chars().all(|ch| ch.is_ascii_digit()) {
            return None;
        }
        Some(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkshopLinks {
    file_id: WorkshopFileId,
}

impl WorkshopLinks {
    pub fn new(file_id: WorkshopFileId) -> Self {
        Self { file_id }
    }

    pub fn steam_client_url(&self) -> String {
        format!("steam://url/CommunityFilePage/{}", self.file_id.as_str())
    }

    pub fn web_url(&self) -> String {
        format!(
            "https://steamcommunity.com/sharedfiles/filedetails/?id={}",
            self.file_id.as_str()
        )
    }
}

pub fn workshop_file_id_from_mod_path(path: impl AsRef<Path>) -> Option<WorkshopFileId> {
    let file_name = path.as_ref().file_name()?.to_string_lossy().into_owned();
    WorkshopFileId::new(file_name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_workshop_file_id_from_mod_path() {
        let path = r"C:\Steam\steamapps\workshop\content\294100\2009463077";

        let file_id = workshop_file_id_from_mod_path(path).expect("workshop id should parse");

        assert_eq!(file_id.as_str(), "2009463077");
    }

    #[test]
    fn rejects_non_numeric_workshop_directory_names() {
        let path = r"C:\Steam\steamapps\workshop\content\294100\not-a-number";

        assert!(workshop_file_id_from_mod_path(path).is_none());
    }

    #[test]
    fn generates_steam_client_and_web_links() {
        let file_id = WorkshopFileId::new("2009463077").expect("valid workshop id");
        let links = WorkshopLinks::new(file_id);

        assert_eq!(
            links.steam_client_url(),
            "steam://url/CommunityFilePage/2009463077"
        );
        assert_eq!(
            links.web_url(),
            "https://steamcommunity.com/sharedfiles/filedetails/?id=2009463077"
        );
    }
}
