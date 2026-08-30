use std::path::{Path, PathBuf};
use crate::types::{AppError, AppResult, AppSettings, SdkPaths};

fn home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}

fn first_existing_dir<P: AsRef<Path>>(paths: &[P]) -> Option<String> {
    paths
        .iter()
        .find(|p| p.as_ref().is_dir())
        .map(|p| p.as_ref().to_string_lossy().to_string())
}

fn first_existing_file<P: AsRef<Path>>(paths: &[P]) -> Option<String> {
    paths
        .iter()
        .find(|p| p.as_ref().is_file())
        .map(|p| p.as_ref().to_string_lossy().to_string())
}

fn android_sdk_from_registry() -> Option<String> {
    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
        use winreg::RegKey;

        for predef in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
            let hkey = RegKey::predef(predef);
            if let Ok(key) = hkey.open_subkey("SOFTWARE\\Android SDK Tools") {
                if let Ok(path) = key.get_value::<String, _>("Path") {
                    if !path.is_empty() && Path::new(&path).is_dir() {
                        return Some(path);
                    }
                }
            }
        }
    }
    None
}

pub fn resolve_sdk_root(settings: &AppSettings) -> AppResult<String> {
    if let Some(p) = &settings.sdk_root {
        if !p.trim().is_empty() && Path::new(p).is_dir() {
            return Ok(p.clone());
        }
    }
    for key in ["ANDROID_HOME", "ANDROID_SDK_ROOT"] {
        if let Ok(p) = std::env::var(key) {
            if !p.is_empty() && Path::new(&p).is_dir() {
                return Ok(p);
            }
        }
    }
    if let Some(p) = android_sdk_from_registry() {
        return Ok(p);
    }
    if let Some(h) = home_dir() {
        let candidates = [
            h.join("AppData\\Local\\Android\\Sdk").to_string_lossy().to_string(),
            h.join("AppData\\Local\\Android\\android-sdk").to_string_lossy().to_string(),
            "C:\\Android\\Sdk".into(),
            "C:\\Program Files (x86)\\Android\\android-sdk".into(),
            "F:\\DevPlatform\\SDKs\\Android".into(),
            "D:\\Android\\Sdk".into(),
        ];
        if let Some(p) = first_existing_dir(&candidates) {
            return Ok(p);
        }
    }
    Err(AppError::SdkNotFound)
}

pub fn resolve_avd_home(settings: &AppSettings, sdk_root: &str) -> AppResult<String> {
    if let Some(p) = &settings.avd_home {
        if !p.trim().is_empty() && Path::new(p).is_dir() {
            return Ok(p.clone());
        }
    }
    if let Ok(p) = std::env::var("ANDROID_AVD_HOME") {
        if !p.is_empty() && Path::new(&p).is_dir() {
            return Ok(p);
        }
    }
    if let Ok(p) = std::env::var("ANDROID_SDK_HOME") {
        let avd = Path::new(&p).join(".android\\avd");
        if avd.is_dir() {
            return Ok(avd.to_string_lossy().to_string());
        }
    }
    if let Some(h) = home_dir() {
        let candidates = [
            h.join(".android\\avd").to_string_lossy().to_string(),
            "F:\\DevPlatform\\Caches\\.android\\avd".into(),
            "D:\\.android\\avd".into(),
        ];
        if let Some(p) = first_existing_dir(&candidates) {
            return Ok(p);
        }
    }
    if let Some(p) = Path::new(sdk_root).parent().map(|p| p.join(".android\\avd")) {
        if p.is_dir() {
            return Ok(p.to_string_lossy().to_string());
        }
    }
    Err(AppError::AvdHomeNotFound)
}

pub fn resolve_sdk_paths(settings: &AppSettings) -> AppResult<SdkPaths> {
    let sdk_root = resolve_sdk_root(settings)?;
    let avd_home = resolve_avd_home(settings, &sdk_root)?;

    let emulator_candidates = [
        format!("{}\\emulator\\emulator.exe", sdk_root),
        format!("{}\\emulator\\emulator", sdk_root),
        format!("{}\\tools\\emulator.exe", sdk_root),
        which::which("emulator")
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
    ];
    let emulator = first_existing_file(&emulator_candidates)
        .ok_or_else(|| AppError::EmulatorNotFound(sdk_root.clone()))?;

    let adb_candidates = [
        format!("{}\\platform-tools\\adb.exe", sdk_root),
        format!("{}\\platform-tools\\adb", sdk_root),
        which::which("adb")
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
    ];
    let adb = first_existing_file(&adb_candidates)
        .ok_or_else(|| AppError::AdbNotFound(sdk_root.clone()))?;

    Ok(SdkPaths {
        sdk_root,
        emulator,
        adb,
        avd_home,
    })
}
