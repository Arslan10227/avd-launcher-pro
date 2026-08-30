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

    for dev in devices.iter_mut() {
        if dev.state == "device" {
            // Query avd_name from emulator / system property
            if let Ok(avd_prop) = run_adb(adb, Some(&dev.serial), &["shell", "getprop", "ro.boot.qemu.avd_name"]).await {
                let name = avd_prop.trim().to_string();
                if !name.is_empty() && !name.contains("error") {
                    dev.avd_name = Some(name);
                    continue;
                }
            }
            if let Ok(emu_name) = run_adb(adb, Some(&dev.serial), &["emu", "avd", "name"]).await {
                let first_line = emu_name.lines().next().unwrap_or("").trim().to_string();
                if !first_line.is_empty() && !first_line.starts_with("OK") && !first_line.contains("error") {
                    dev.avd_name = Some(first_line);
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
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

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
    let mut args = vec!["shell", "pm", "list", "packages", "-3"];
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

// ----------------- Cellular & Phone / SMS -----------------

pub async fn simulate_call(adb: &str, serial: &str, phone_number: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["emu", "gsm", "call", phone_number]).await
}

pub async fn cancel_call(adb: &str, serial: &str, phone_number: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["emu", "gsm", "cancel", phone_number]).await
}

pub async fn accept_call(adb: &str, serial: &str, phone_number: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["emu", "gsm", "accept", phone_number]).await
}

pub async fn send_sms_message(adb: &str, serial: &str, phone_number: &str, text: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["emu", "sms", "send", phone_number, text]).await
}

pub async fn set_cellular_state(adb: &str, serial: &str, state: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["emu", "gsm", "data", state]).await
}

// ----------------- Fingerprint Sensor -----------------

pub async fn touch_fingerprint(adb: &str, serial: &str, finger_id: u32) -> AppResult<String> {
    let id_str = finger_id.to_string();
    run_adb(adb, Some(serial), &["emu", "finger", "touch", &id_str]).await
}

pub async fn remove_fingerprint(adb: &str, serial: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["emu", "finger", "remove"]).await
}

// ----------------- Orientation & Virtual Sensors -----------------

pub async fn set_device_rotation(adb: &str, serial: &str, rotation: u32) -> AppResult<String> {
    let _ = run_adb(adb, Some(serial), &["shell", "settings", "put", "system", "accelerometer_rotation", "0"]).await;
    let rot_str = rotation.to_string();
    run_adb(adb, Some(serial), &["shell", "settings", "put", "system", "user_rotation", &rot_str]).await
}

pub async fn set_sensor_values(adb: &str, serial: &str, sensor: &str, values: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["emu", "sensor", "set", sensor, values]).await
}

// ----------------- Secondary Screen Overlay -----------------

pub async fn set_secondary_display_overlay(adb: &str, serial: &str, spec: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["shell", "settings", "put", "global", "overlay_display_devices", spec]).await
}

// ----------------- Screen Recording -----------------

pub async fn start_screen_record(adb: &str, serial: &str, bit_rate_mbps: Option<u32>, time_limit_sec: Option<u32>) -> AppResult<String> {
    let bit_rate = bit_rate_mbps.unwrap_or(4) * 1000000;
    let time_limit = time_limit_sec.unwrap_or(180);
    let bit_str = bit_rate.to_string();
    let time_str = time_limit.to_string();

    let mut cmd = Command::new(adb);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    cmd.arg("-s").arg(serial).args([
        "shell",
        "screenrecord",
        "/sdcard/Download/avd_recording.mp4",
        "--bit-rate",
        &bit_str,
        "--time-limit",
        &time_str,
    ]);

    cmd.spawn().map_err(|e| AppError::Message(format!("Failed to start screenrecord: {}", e)))?;
    Ok("Screen recording started on device".into())
}

pub async fn stop_screen_record(adb: &str, serial: &str) -> AppResult<String> {
    let out = run_adb(adb, Some(serial), &["shell", "pkill", "-2", "screenrecord"]).await?;
    tokio::time::sleep(Duration::from_millis(1500)).await;
    Ok(out)
}

pub async fn pull_screen_record(adb: &str, serial: &str, local_dest: &str) -> AppResult<String> {
    run_adb(adb, Some(serial), &["pull", "/sdcard/Download/avd_recording.mp4", local_dest]).await
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
