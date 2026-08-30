use std::process::Stdio;
use tauri::{Emitter, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use crate::types::{AppError, AppResult, SdkPaths, StartOptions};

pub fn build_emulator_command(sdk: &SdkPaths, opts: &StartOptions) -> Command {
    let mut cmd = Command::new(&sdk.emulator);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    cmd.arg("-avd").arg(&opts.name);

    // Boot & Lifecycle
    if opts.no_boot_anim {
        cmd.arg("-no-boot-anim");
    }
    if opts.no_snapshot {
        cmd.arg("-no-snapshot");
    }
    if opts.no_snapshot_load {
        cmd.arg("-no-snapshot-load");
    }
    if opts.no_snapshot_save {
        cmd.arg("-no-snapshot-save");
    }
    if let Some(snap) = &opts.snapshot {
        if !snap.trim().is_empty() {
            cmd.arg("-snapshot").arg(snap);
        }
    }
    if opts.wipe_data {
        cmd.arg("-wipe-data");
    }
    if opts.read_only {
        cmd.arg("-read-only");
    }
    if opts.writable_system {
        cmd.arg("-writable-system");
    }
    if let Some(selinux) = &opts.selinux {
        if !selinux.trim().is_empty() {
            cmd.arg("-selinux").arg(selinux);
        }
    }
    if let Some(mem) = opts.memory_mb {
        if mem > 0 {
            cmd.arg("-memory").arg(mem.to_string());
        }
    }
    if let Some(cores) = opts.cores {
        if cores > 0 {
            cmd.arg("-cores").arg(cores.to_string());
        }
    }

    // Display & Window
    if opts.no_window {
        cmd.arg("-no-window");
    }
    if let Some(scale) = &opts.scale {
        if !scale.trim().is_empty() {
            cmd.arg("-scale").arg(scale);
        }
    }
    if let Some(dpi) = &opts.dpi_device {
        if !dpi.trim().is_empty() {
            cmd.arg("-dpi-device").arg(dpi);
        }
    }
    if let Some(skin) = &opts.skin {
        if !skin.trim().is_empty() {
            cmd.arg("-skin").arg(skin);
        }
    }
    if let Some(screen) = &opts.screen_mode {
        if !screen.trim().is_empty() {
            cmd.arg("-screen").arg(screen);
        }
    }
    if opts.no_passive_gps {
        cmd.arg("-no-passive-gps");
    }

    // Graphics & Acceleration
    if let Some(gpu) = &opts.gpu {
        if !gpu.trim().is_empty() && gpu != "default" {
            cmd.arg("-gpu").arg(gpu);
        }
    }
    if let Some(feat) = &opts.feature {
        if !feat.trim().is_empty() {
            cmd.arg("-feature").arg(feat);
        }
    }
    if opts.no_accel {
        cmd.arg("-no-accel");
    } else if let Some(accel) = &opts.accel {
        if !accel.trim().is_empty() && accel != "auto" {
            cmd.arg("-accel").arg(accel);
        }
    }

    // Audio & Media
    if opts.no_audio {
        cmd.arg("-no-audio");
    }
    if let Some(cam) = &opts.camera_back {
        if !cam.trim().is_empty() {
            cmd.arg("-camera-back").arg(cam);
        }
    }
    if let Some(cam) = &opts.camera_front {
        if !cam.trim().is_empty() {
            cmd.arg("-camera-front").arg(cam);
        }
    }

    // Network & Connectivity
    if let Some(delay) = &opts.netdelay {
        if !delay.trim().is_empty() && delay != "none" {
            cmd.arg("-netdelay").arg(delay);
        }
    }
    if let Some(speed) = &opts.netspeed {
        if !speed.trim().is_empty() && speed != "full" {
            cmd.arg("-netspeed").arg(speed);
        }
    }
    if let Some(proxy) = &opts.http_proxy {
        if !proxy.trim().is_empty() {
            cmd.arg("-http-proxy").arg(proxy);
        }
    }
    if let Some(dns) = &opts.dns_servers {
        if !dns.trim().is_empty() {
            cmd.arg("-dns-server").arg(dns);
        }
    }
    if let Some(tcpdump) = &opts.tcpdump_path {
        if !tcpdump.trim().is_empty() {
            cmd.arg("-tcpdump").arg(tcpdump);
        }
    }
    if let Some(port) = opts.port {
        if port > 0 {
            cmd.arg("-port").arg(port.to_string());
        }
    }
    if let Some(ports) = &opts.ports {
        if !ports.trim().is_empty() {
            cmd.arg("-ports").arg(ports);
        }
    }

    // Debugging & Advanced
    if opts.show_kernel {
        cmd.arg("-show-kernel");
    }
    if opts.verbose {
        cmd.arg("-verbose");
    }
    if let Some(tags) = &opts.debug_tags {
        if !tags.trim().is_empty() {
            cmd.arg("-debug").arg(tags);
        }
    }
    if let Some(tags) = &opts.logcat_tags {
        if !tags.trim().is_empty() {
            cmd.arg("-logcat").arg(tags);
        }
    }
    if let Some(trace) = &opts.trace_name {
        if !trace.trim().is_empty() {
            cmd.arg("-trace").arg(trace);
        }
    }
    if let Some(tz) = &opts.timezone {
        if !tz.trim().is_empty() {
            cmd.arg("-timezone").arg(tz);
        }
    }

    // Custom extra arguments
    if let Some(extra) = &opts.extra_args {
        for arg in extra.split_whitespace() {
            if !arg.is_empty() {
                cmd.arg(arg);
            }
        }
    }

    cmd
}

pub fn spawn_emulator(
    sdk: &SdkPaths,
    window: Window,
    opts: &StartOptions,
) -> AppResult<(String, Child)> {
    let mut cmd = build_emulator_command(sdk, opts);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        AppError::Message(format!("Failed to start emulator for '{}': {}", opts.name, e))
    })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let handle = format!("emulator-{}", opts.name);

    if let Some(out) = stdout {
        let emit_handle = handle.clone();
        let win = window.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(out);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = win.emit(&format!("emulator-output-{}", emit_handle), line);
            }
        });
    }

    if let Some(err) = stderr {
        let emit_handle = handle.clone();
        let win = window;
        tokio::spawn(async move {
            let reader = BufReader::new(err);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = win.emit(&format!("emulator-output-{}", emit_handle), line);
            }
        });
    }

    Ok((handle, child))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_emulator_command_flags() {
        let sdk = SdkPaths {
            sdk_root: "C:\\Sdk".into(),
            emulator: "C:\\Sdk\\emulator\\emulator.exe".into(),
            adb: "C:\\Sdk\\platform-tools\\adb.exe".into(),
            avd_home: "C:\\avd".into(),
        };

        let opts = StartOptions {
            name: "Pixel_8".into(),
            no_boot_anim: true,
            writable_system: true,
            no_snapshot: true,
            gpu: Some("host".into()),
            feature: Some("ForceANGLE,ForceGpuHost".into()),
            memory_mb: Some(4096),
            cores: Some(4),
            no_window: true,
            netdelay: Some("lte".into()),
            netspeed: Some("full".into()),
            ..Default::default()
        };

        let cmd = build_emulator_command(&sdk, &opts);
        let args: Vec<String> = cmd
            .as_std()
            .get_args()
            .map(|a| a.to_string_lossy().to_string())
            .collect();

        assert!(args.contains(&"-avd".to_string()));
        assert!(args.contains(&"Pixel_8".to_string()));
        assert!(args.contains(&"-no-boot-anim".to_string()));
        assert!(args.contains(&"-writable-system".to_string()));
        assert!(args.contains(&"-no-snapshot".to_string()));
        assert!(args.contains(&"-gpu".to_string()));
        assert!(args.contains(&"host".to_string()));
        assert!(args.contains(&"-memory".to_string()));
        assert!(args.contains(&"4096".to_string()));
        assert!(args.contains(&"-cores".to_string()));
        assert!(args.contains(&"4".to_string()));
        assert!(args.contains(&"-no-window".to_string()));
        assert!(args.contains(&"-netdelay".to_string()));
        assert!(args.contains(&"lte".to_string()));
    }
}
