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
