use std::time::Duration;
use base64::prelude::*;
use tokio::process::Command;
use tokio::time::timeout;
use crate::types::{AdbDevice, AppError, AppResult, InstallOptions, RootStatus};

const ADB_TIMEOUT_SECS: u64 = 15;

pub async fn run_adb(
    adb: &str,
    serial: Option<&str>,
    args: &[&str],
) -> AppResult<String> {
    let mut cmd = Command::new(adb);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    if let Some(s) = serial {
        cmd.arg("-s").arg(s);
    }
    cmd.args(args);

    let fut = cmd.output();
    let res = timeout(Duration::from_secs(ADB_TIMEOUT_SECS), fut)
        .await
        .map_err(|_| AppError::Message(format!("ADB command timed out after {}s", ADB_TIMEOUT_SECS)))?
        .map_err(|e| AppError::Message(format!("Failed to execute adb: {}", e)))?;

    let stdout = String::from_utf8_lossy(&res.stdout);
    let stderr = String::from_utf8_lossy(&res.stderr);

    Ok(format!("{}{}", stdout, stderr).trim().to_string())
}

pub fn parse_adb_devices_text(output: &str) -> Vec<AdbDevice> {
    let mut devices = Vec::new();
    for line in output.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() || line.starts_with('*') {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        let serial = parts[0].to_string();
        let state = parts[1].to_string();
        let mut product = None;
        let mut model = None;
        let mut device = None;
        for token in parts.iter().skip(2) {
            if let Some((k, v)) = token.split_once(':') {
                match k {
                    "product" => product = Some(v.to_string()),
                    "model" => model = Some(v.to_string()),
                    "device" => device = Some(v.to_string()),
                    _ => {}
                }
            }
        }
        devices.push(AdbDevice {
            serial,
            state,
            product,
            model,
            device,
            avd_name: None,
        });
    }
    devices
}

pub async fn list_devices(adb: &str) -> AppResult<Vec<AdbDevice>> {
    let out = run_adb(adb, None, &["devices", "-l"]).await?;
    let mut devices = parse_adb_devices_text(&out);

    // Try resolving AVD name for emulator devices
    for dev in devices.iter_mut() {
        if dev.serial.starts_with("emulator-") && dev.state == "device" {
            if let Ok(name_out) = run_adb(adb, Some(&dev.serial), &["emu", "avd", "name"]).await {
                let first_line = name_out.lines().next().unwrap_or("").trim();
                if !first_line.is_empty() && !first_line.to_lowercase().contains("error") {
                    dev.avd_name = Some(first_line.to_string());
                }
            }
            if dev.avd_name.is_none() {
                if let Ok(prop) = run_adb(adb, Some(&dev.serial), &["shell", "getprop", "ro.boot.qemu.avd_name"]).await {
                    let val = prop.trim().to_string();
                    if !val.is_empty() {
                        dev.avd_name = Some(val);
                    }
                }
            }
        }
    }

    Ok(devices)
}

pub async fn check_root(adb: &str, serial: &str) -> AppResult<RootStatus> {
    let su_out = run_adb(adb, Some(serial), &["shell", "su", "-c", "id"]).await;
    let mut output = String::new();
    let mut rooted = false;

    match &su_out {
        Ok(o) => {
            output.push_str(o);
            if o.to_lowercase().contains("uid=0") {
                rooted = true;
            }
        }
        Err(e) => {
            output.push_str(&format!("su check error: {}", e));
        }
    }

    // Try adb root if not already root
    if !rooted {
        if let Ok(root_cmd_out) = run_adb(adb, Some(serial), &["root"]).await {
            output.push_str(&format!("\nadb root: {}", root_cmd_out));
            if root_cmd_out.contains("restarting adbd as root") || root_cmd_out.contains("already running as root") {
                rooted = true;
            }
        }
    }

    let mut remounted = false;
    if rooted {
        match run_adb(adb, Some(serial), &["remount"]).await {
            Ok(o) => {
                output.push_str(&format!("\nadb remount: {}", o));
                if o.to_lowercase().contains("remount succeeded")
                    || o.to_lowercase().contains("remount successful")
                {
                    remounted = true;
                }
            }
            Err(e) => {
                output.push_str(&format!("\nremount error: {}", e));
            }
        }
    }

    Ok(RootStatus {
        rooted,
        remounted,
        output,
    })
}

pub async fn install_apk(adb: &str, opts: &InstallOptions) -> AppResult<String> {
    let mut args: Vec<&str> = vec!["install"];
    if opts.reinstall {
        args.push("-r");
    }
    if opts.grant_permissions {
        args.push("-g");
    }
    if opts.allow_downgrade {
        args.push("-d");
    }
    if opts.allow_test {
        args.push("-t");
    }
    args.push(&opts.path);

    run_adb(adb, Some(&opts.serial), &args).await
}

pub async fn reboot_device(adb: &str, serial: &str, mode: Option<&str>) -> AppResult<String> {
    let mut args = vec!["reboot"];
    if let Some(m) = mode {
        if !m.is_empty() {
            args.push(m);
        }
    }
    run_adb(adb, Some(serial), &args).await
}

pub async fn restart_adb_server(adb: &str) -> AppResult<String> {
    let _ = run_adb(adb, None, &["kill-server"]).await;
    run_adb(adb, None, &["start-server"]).await
}

pub async fn capture_screenshot(adb: &str, serial: &str) -> AppResult<String> {
    let mut cmd = Command::new(adb);
    cmd.arg("-s").arg(serial).args(["exec-out", "screencap", "-p"]);

    let fut = cmd.output();
    let res = timeout(Duration::from_secs(10), fut)
        .await
        .map_err(|_| AppError::Message("Screenshot timed out".into()))?
        .map_err(|e| AppError::Message(format!("Screenshot failed: {}", e)))?;

    if res.stdout.is_empty() {
        return Err(AppError::Message(format!(
            "Screenshot capture returned empty buffer: {}",
            String::from_utf8_lossy(&res.stderr)
        )));
    }

    let b64 = BASE64_STANDARD.encode(&res.stdout);
    Ok(format!("data:image/png;base64,{}", b64))
}

pub async fn send_key_event(adb: &str, serial: &str, keycode: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["shell", "input", "keyevent", keycode]).await
}

pub async fn send_text_input(adb: &str, serial: &str, text: &str) -> AppResult<String> {
    // Replace spaces with %s for adb input text
    let escaped = text.replace(' ', "%s");
    run_adb(adb, Some(serial), &["shell", "input", "text", &escaped]).await
}

pub async fn open_url(adb: &str, serial: &str, url: &str) -> AppResult<String> {
    run_adb(
        adb,
        Some(serial),
        &["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url],
    )
    .await
}

pub async fn list_packages(adb: &str, serial: &str, filter: Option<&str>) -> AppResult<Vec<String>> {
    let mut args = vec!["shell", "pm", "list", "packages", "-3"]; // 3rd party by default or all if requested
    if let Some(f) = filter {
        if f == "all" {
            args[4] = "";
            args.pop();
        }
    }
    let out = run_adb(adb, Some(serial), &args).await?;
    let mut pkgs: Vec<String> = out
        .lines()
        .map(|l| l.trim().trim_start_matches("package:").to_string())
        .filter(|l| !l.is_empty())
        .collect();
    pkgs.sort();
    Ok(pkgs)
}

pub async fn uninstall_package(adb: &str, serial: &str, package: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["uninstall", package]).await
}

pub async fn execute_shell_command(adb: &str, serial: &str, command: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["shell", command]).await
}

pub async fn push_file(adb: &str, serial: &str, local_path: &str, remote_path: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["push", local_path, remote_path]).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_adb_devices() {
        let sample_output = "List of devices attached\nemulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1\n192.168.1.50:5555      offline transport_id:2\n";
        let devs = parse_adb_devices_text(sample_output);
        assert_eq!(devs.len(), 2);
        assert_eq!(devs[0].serial, "emulator-5554");
        assert_eq!(devs[0].state, "device");
        assert_eq!(devs[0].product.as_deref(), Some("sdk_gphone64_x86_64"));
        assert_eq!(devs[0].model.as_deref(), Some("sdk_gphone64_x86_64"));
        assert_eq!(devs[0].device.as_deref(), Some("emu64xa"));
        assert_eq!(devs[1].serial, "192.168.1.50:5555");
        assert_eq!(devs[1].state, "offline");
    }
}
