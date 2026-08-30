use std::fs;
use std::path::PathBuf;
use crate::types::{AppError, AppResult, AppSettings};

pub fn get_settings_path() -> AppResult<PathBuf> {
    let mut p = dirs::config_dir().ok_or_else(|| AppError::Message("Config directory not found".into()))?;
    p.push("avd-launcher");
    fs::create_dir_all(&p)?;
    p.push("settings.json");
    Ok(p)
}

pub fn load_settings_from_disk() -> AppSettings {
    get_settings_path()
        .ok()
        .and_then(|p| fs::read_to_string(&p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_settings_to_disk(settings: &AppSettings) -> AppResult<()> {
    let p = get_settings_path()?;
    let text = serde_json::to_string_pretty(settings)?;
    fs::write(p, text)?;
    Ok(())
}
