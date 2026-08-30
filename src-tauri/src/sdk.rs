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
    // 1. User manual override
    if let Some(p) = &settings.sdk_root {
        if !p.trim().is_empty() && Path::new(p).is_dir() {
            return Ok(p.clone());
        }
    }

    // 2. Standard Environment Variables
    for key in ["ANDROID_HOME", "ANDROID_SDK_ROOT", "ANDROID_SDK"] {
        if let Ok(p) = std::env::var(key) {
            if !p.is_empty() && Path::new(&p).is_dir() {
                return Ok(p);
            }
        }
    }

    // 3. Windows Registry (if on Windows)
    if let Some(p) = android_sdk_from_registry() {
        return Ok(p);
    }

    // 4. Cross-Platform Standard Candidate Directories
    if let Some(h) = home_dir() {
        let candidates = [
            // Windows
            h.join("AppData").join("Local").join("Android").join("Sdk"),
            h.join("AppData").join("Local").join("Android").join("android-sdk"),
            PathBuf::from("C:\\Android\\Sdk"),
            PathBuf::from("C:\\Program Files (x86)\\Android\\android-sdk"),
            PathBuf::from("D:\\Android\\Sdk"),
            PathBuf::from("F:\\DevPlatform\\SDKs\\Android"),

            // macOS
            h.join("Library").join("Android").join("sdk"),
            PathBuf::from("/opt/homebrew/share/android-sdk"),
            PathBuf::from("/usr/local/share/android-sdk"),

            // Linux
            h.join("Android").join("Sdk"),
            h.join("Android").join("sdk"),
            h.join(".android-sdk"),
            PathBuf::from("/opt/android-sdk"),
            PathBuf::from("/usr/lib/android-sdk"),
            PathBuf::from("/var/lib/android-sdk"),
        ];

        if let Some(p) = first_existing_dir(&candidates) {
            return Ok(p);
        }
    }

    // 5. Try discovering from `which adb` or `which emulator`
    if let Ok(adb_bin) = which::which("adb") {
        if let Some(parent) = adb_bin.parent() {
            if let Some(sdk_cand) = parent.parent() {
                if sdk_cand.is_dir() {
                    return Ok(sdk_cand.to_string_lossy().to_string());
                }
            }
        }
    }

    Err(AppError::SdkNotFound)
}

pub fn resolve_avd_home(settings: &AppSettings, sdk_root: &str) -> AppResult<String> {
    // 1. User manual override
    if let Some(p) = &settings.avd_home {
        if !p.trim().is_empty() && Path::new(p).is_dir() {
            return Ok(p.clone());
        }
    }

    // 2. Standard Environment Variables
    if let Ok(p) = std::env::var("ANDROID_AVD_HOME") {
        if !p.is_empty() && Path::new(&p).is_dir() {
            return Ok(p);
        }
    }

    if let Ok(p) = std::env::var("ANDROID_SDK_HOME") {
        let avd = Path::new(&p).join(".android").join("avd");
        if avd.is_dir() {
            return Ok(avd.to_string_lossy().to_string());
        }
    }

    // 3. User Home Directory Candidate Paths (~/.android/avd)
    if let Some(h) = home_dir() {
        let candidates = [
            h.join(".android").join("avd"),
            PathBuf::from("F:\\DevPlatform\\Caches\\.android\\avd"),
            PathBuf::from("D:\\.android\\avd"),
        ];
        if let Some(p) = first_existing_dir(&candidates) {
            return Ok(p);
        }
    }

    // 4. Sibling directory relative to SDK Root
    if let Some(parent) = Path::new(sdk_root).parent() {
        let avd = parent.join(".android").join("avd");
        if avd.is_dir() {
            return Ok(avd.to_string_lossy().to_string());
        }
    }

    Err(AppError::AvdHomeNotFound)
}

pub fn resolve_sdk_paths(settings: &AppSettings) -> AppResult<SdkPaths> {
    let sdk_root = resolve_sdk_root(settings)?;
    let avd_home = resolve_avd_home(settings, &sdk_root)?;

    let root_path = Path::new(&sdk_root);

    // Emulator binary candidates
    let emulator_candidates = [
        root_path.join("emulator").join("emulator.exe"),
        root_path.join("emulator").join("emulator"),
        root_path.join("tools").join("emulator.exe"),
        root_path.join("tools").join("emulator"),
        which::which("emulator").unwrap_or_default(),
    ];
    let emulator = first_existing_file(&emulator_candidates)
        .ok_or_else(|| AppError::EmulatorNotFound(sdk_root.clone()))?;

    // ADB binary candidates
    let adb_candidates = [
        root_path.join("platform-tools").join("adb.exe"),
        root_path.join("platform-tools").join("adb"),
        which::which("adb").unwrap_or_default(),
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
