use std::process::Stdio;
use tauri::{Emitter, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use crate::adb::run_adb;
use crate::types::{AppError, AppResult, LogcatOptions, SdkPaths};

pub async fn start_logcat_stream(
    sdk: &SdkPaths,
    window: Window,
    opts: &LogcatOptions,
) -> AppResult<(String, Child)> {
    let mut args: Vec<String> = vec![
        "-s".to_string(),
        opts.serial.clone(),
        "logcat".to_string(),
        "-v".to_string(),
        "threadtime".to_string(),
    ];

    if let Some(buf) = &opts.buffer {
        if !buf.is_empty() && buf != "all" {
            args.push("-b".to_string());
            args.push(buf.clone());
        }
    }

    if let Some(pkg) = opts.package.as_ref().filter(|p| !p.is_empty()) {
        // Try getting PID
        if let Ok(pid_out) = run_adb(&sdk.adb, Some(&opts.serial), &["shell", "pidof", "-s", pkg]).await {
            let pid = pid_out.trim().to_string();
            if !pid.is_empty() && pid.chars().all(|c| c.is_ascii_digit()) {
                args.push("--pid".to_string());
                args.push(pid);
            }
        }
    }

    if let Some(tag) = opts.tag.as_ref().filter(|t| !t.is_empty()) {
        let level = opts.level.as_deref().unwrap_or("V");
        args.push(format!("{}:{} *:S", tag, level));
    } else if let Some(lvl) = opts.level.as_ref().filter(|l| !l.is_empty() && *l != "V") {
        args.push(format!("*:{}", lvl));
    }

    let mut cmd = Command::new(&sdk.adb);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let mut child = cmd
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| AppError::Message(format!("Failed to start logcat: {}", e)))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Message("Failed to open logcat stdout".into()))?;

    let handle = format!("logcat-{}", opts.serial);
    let emit_handle = handle.clone();

    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = window.emit(&format!("logcat-line-{}", emit_handle), line);
        }
    });

    Ok((handle, child))
}
