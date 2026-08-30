use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use crate::types::{AppError, AppResult};

pub fn parse_ini<P: AsRef<Path>>(path: P) -> AppResult<HashMap<String, String>> {
    let text = fs::read_to_string(path)?;
    let mut map = HashMap::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        if let Some(pos) = line.find('=') {
            let key = line[..pos].trim().to_string();
            let value = line[pos + 1..].trim().to_string();
            map.insert(key, value);
        }
    }
    Ok(map)
}

pub fn write_ini_preserving<P: AsRef<Path>>(
    path: P,
    updates: &HashMap<String, String>,
) -> AppResult<()> {
    let path = path.as_ref();
    let mut lines: Vec<String> = Vec::new();
    let mut seen = HashSet::new();

    if path.exists() {
        let text = fs::read_to_string(path)?;
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') {
                lines.push(line.to_string());
                continue;
            }
            if let Some(pos) = line.find('=') {
                let key = line[..pos].trim();
                if let Some(value) = updates.get(key) {
                    lines.push(format!("{}={}", key, value));
                    seen.insert(key.to_string());
                    continue;
                }
            }
            lines.push(line.to_string());
        }
    }

    for (key, value) in updates.iter() {
        if !seen.contains(key) {
            lines.push(format!("{}={}", key, value));
        }
    }

    fs::write(path, lines.join("\n") + "\n")?;
    Ok(())
}

pub fn backup_config<P: AsRef<Path>>(avd_dir: P) -> AppResult<()> {
    let dir = avd_dir.as_ref();
    let config_path = dir.join("config.ini");
    let backup_path = dir.join("config.ini.bak");
    if config_path.exists() && !backup_path.exists() {
        fs::copy(&config_path, &backup_path)?;
    }
    Ok(())
}

pub fn restore_config<P: AsRef<Path>>(avd_dir: P) -> AppResult<()> {
    let dir = avd_dir.as_ref();
    let config_path = dir.join("config.ini");
    let backup_path = dir.join("config.ini.bak");
    if !backup_path.exists() {
        return Err(AppError::Message("No config.ini.bak backup file found to restore".into()));
    }
    fs::copy(&backup_path, &config_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ini_basic() {
        let temp_dir = std::env::temp_dir();
        let test_ini = temp_dir.join("test_avd_config.ini");
        let content = "# Comment line\nhw.lcd.width=1080\nhw.lcd.height=2400\nhw.ramSize=4096\n";
        fs::write(&test_ini, content).unwrap();

        let map = parse_ini(&test_ini).unwrap();
        assert_eq!(map.get("hw.lcd.width").map(|s| s.as_str()), Some("1080"));
        assert_eq!(map.get("hw.lcd.height").map(|s| s.as_str()), Some("2400"));
        assert_eq!(map.get("hw.ramSize").map(|s| s.as_str()), Some("4096"));

        let mut updates = HashMap::new();
        updates.insert("hw.ramSize".into(), "8192".into());
        updates.insert("hw.gpu.mode".into(), "host".into());

        write_ini_preserving(&test_ini, &updates).unwrap();

        let updated_map = parse_ini(&test_ini).unwrap();
        assert_eq!(updated_map.get("hw.ramSize").map(|s| s.as_str()), Some("8192"));
        assert_eq!(updated_map.get("hw.gpu.mode").map(|s| s.as_str()), Some("host"));
        assert_eq!(updated_map.get("hw.lcd.width").map(|s| s.as_str()), Some("1080"));

        let _ = fs::remove_file(&test_ini);
    }
}
