use std::collections::HashMap;
use std::fs;
use std::path::Path;
use crate::config_editor::parse_ini;
use crate::types::{AdbDevice, AppError, AppResult, Avd, SdkPaths};

pub fn format_resolution(config: &HashMap<String, String>) -> Option<String> {
    let w = config.get("hw.lcd.width")?;
    let h = config.get("hw.lcd.height")?;
    Some(format!("{}x{}", w, h))
}

pub fn extract_api_level(config: &HashMap<String, String>) -> Option<String> {
    if let Some(target) = config.get("target") {
        return Some(target.clone());
    }
    if let Some(sysdir) = config.get("image.sysdir.1") {
        // e.g. "system-images/android-34/google_apis/x86_64/"
        let parts: Vec<&str> = sysdir.split('/').collect();
        for part in parts {
            if part.starts_with("android-") {
                return Some(part.replace("android-", "API "));
            }
        }
    }
    None
}

pub fn list_avd_snapshots<P: AsRef<Path>>(avd_dir: P) -> Vec<String> {
    let snapshots_dir = avd_dir.as_ref().join("snapshots");
    let mut results = Vec::new();
    if snapshots_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(snapshots_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        if !name.starts_with('.') {
                            results.push(name.to_string());
                        }
                    }
                }
            }
        }
    }
    results
}

pub fn read_avd<P: AsRef<Path>>(avd_dir: P) -> AppResult<Avd> {
    let dir = avd_dir.as_ref();
    let name = dir
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let config_path = dir.join("config.ini");
    let config = if config_path.exists() {
        parse_ini(&config_path).unwrap_or_default()
    } else {
        HashMap::new()
    };

    let display_name = config
        .get("avd.ini.displayname")
        .cloned()
        .or_else(|| config.get("avd.ini.displayName").cloned());

    let abi = config
        .get("abi.type")
        .cloned()
        .or_else(|| config.get("tag.id").cloned());

    let target = config.get("tag.id").cloned();
    let api_level = extract_api_level(&config);
    let resolution = format_resolution(&config);
    let dpi = config.get("hw.lcd.density").cloned();
    let snapshots = list_avd_snapshots(dir);

    Ok(Avd {
        name,
        path: dir.to_string_lossy().to_string(),
        display_name,
        target,
        resolution,
        dpi,
        abi,
        api_level,
        is_running: false,
        serial: None,
        config,
        snapshots,
    })
}

pub fn list_avds_internal(
    sdk: &SdkPaths,
    running_handles: &[String],
    devices: &[AdbDevice],
) -> AppResult<Vec<Avd>> {
    let mut avds = Vec::new();
    let avd_home = Path::new(&sdk.avd_home);
    if !avd_home.is_dir() {
        return Err(AppError::AvdHomeNotFound);
    }

    for entry in fs::read_dir(avd_home)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() && path.extension().map(|e| e == "avd").unwrap_or(false) {
            match read_avd(&path) {
                Ok(mut avd) => {
                    let handle = format!("emulator-{}", avd.name);
                    let is_in_procs = running_handles.contains(&handle);
                    
                    // Match against ADB devices
                    let matched_device = devices.iter().find(|d| {
                        if let Some(avd_n) = &d.avd_name {
                            avd_n == &avd.name
                        } else {
                            false
                        }
                    });

                    if let Some(dev) = matched_device {
                        if dev.state == "device" {
                            avd.is_running = true;
                            avd.serial = Some(dev.serial.clone());
                        } else {
                            avd.is_running = is_in_procs;
                            if is_in_procs {
                                avd.serial = Some(dev.serial.clone());
                            }
                        }
                    } else if is_in_procs {
                        avd.is_running = true;
                    }

                    avds.push(avd);
                }
                Err(e) => eprintln!("warning: failed to read AVD at {:?}: {}", path, e),
            }
        }
    }

    avds.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(avds)
}
