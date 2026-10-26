use super::*;

const SAMPLE_ACF: &str = r#""AppWorkshop"
{
    "appid"     "294100"
    "WorkshopItemsInstalled"
    {
        "2009463077"
        {
            "timeupdated"   "1700000000"
            "manifest"      "1234567890123456789"
        }
        "837975145"
        {
            "timeupdated"   "1699000000"
        }
    }
    "WorkshopItemDetails"
    {
        "2009463077"
        {
            "timeupdated"   "1700000000"
            "timetouched"   "1700100000"
        }
        "837975145"
        {
            "timeupdated"   "1699000000"
            "timetouched"   "1699100000"
        }
        "999999999"
        {
            "timeupdated"   "1680000000"
            "timetouched"   "1680100000"
        }
    }
}"#;

#[test]
fn parses_installed_items_with_timestamps() {
    let entries = parse_appworkshop_acf(SAMPLE_ACF).expect("parse should succeed");
    assert_eq!(entries.len(), 3);
    assert_eq!(entries[0].published_file_id, "2009463077");
    assert_eq!(entries[0].time_updated, 1_700_000_000);
    assert_eq!(entries[0].time_touched, 1_700_100_000);
    assert!(entries[0].has_manifest);

    assert_eq!(entries[1].published_file_id, "837975145");
    assert_eq!(entries[1].time_updated, 1_699_000_000);
    assert_eq!(entries[1].time_touched, 1_699_100_000);
    assert!(!entries[1].has_manifest);

    assert_eq!(entries[2].published_file_id, "999999999");
    assert_eq!(entries[2].time_updated, 1_680_000_000);
    assert_eq!(entries[2].time_touched, 1_680_100_000);
    assert!(!entries[2].has_manifest);
}

#[test]
fn handles_empty_acf() {
    let empty = r#""AppWorkshop"
{
    "appid"     "294100"
}"#;
    let entries = parse_appworkshop_acf(empty).expect("parse should succeed");
    assert_eq!(entries, Vec::<WorkshopUpdateEntry>::new());
}

#[test]
fn computes_acf_path_for_library() {
    let path = appworkshop_acf_path(Path::new("SteamLibrary"));
    assert_eq!(
        path,
        PathBuf::from("SteamLibrary/steamapps/workshop/appworkshop_294100.acf")
    );
}

#[test]
fn handles_missing_timeupdated() {
    let acf = r#""AppWorkshop"
{
    "WorkshopItemsInstalled"
    {
        "123"
        {
            "manifest"      "111"
        }
    }
    "WorkshopItemDetails"
    {
        "123"
        {
            "timetouched"   "999"
        }
    }
}"#;
    let entries = parse_appworkshop_acf(acf).expect("parse should succeed");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].time_updated, 0);
    assert_eq!(entries[0].time_touched, 999);
    assert!(entries[0].has_manifest);
}
