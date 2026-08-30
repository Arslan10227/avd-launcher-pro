use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tauri::{State, Window};
use tokio::process::Child;
use tokio::sync::Mutex;

pub mod types;
pub mod sdk;
pub mod avd;
pub mod emulator;
pub mod config_editor;
pub mod adb;
pub mod logcat;
pub mod settings;

use types::{
    AdbDevice, AppSettings, Avd, EmulatorProcessInfo, InstallOptions,
    LogcatOptions, RootStatus, SdkPaths, StartOptions,
};

pub struct AppState {
    pub settings: Arc<Mutex<AppSettings>>,
    pub processes: Arc<Mutex<HashMap<String, Child>>>,
    pub logcats: Arc<Mutex<HashMap<String, Child>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            settings: Arc::new(Mutex::new(AppSettings::default())),
            processes: Arc::new(Mutex::new(HashMap::new())),
            logcats: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// ----------------- Settings Commands -----------------

#[tauri::command]
async fn load_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let s = settings::load_settings_from_disk();
    *state.settings.lock().await = s.clone();
    Ok(s)
}

#[tauri::command]
async fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    settings::save_settings_to_disk(&settings).map_err(|e| e.to_string())?;
    *state.settings.lock().await = settings;
    Ok(())
}

// ----------------- SDK Discovery Commands -----------------

#[tauri::command]
async fn detect_sdk(state: State<'_, AppState>) -> Result<SdkPaths, String> {
    let s = state.settings.lock().await.clone();
    sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())
}

// ----------------- AVD Commands -----------------

#[tauri::command]
async fn list_avds(state: State<'_, AppState>) -> Result<Vec<Avd>, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    
    // Prune finished / dead processes
    let mut procs = state.processes.lock().await;
    let mut to_remove = Vec::new();
    for (k, child) in procs.iter_mut() {
        if let Ok(Some(_status)) = child.try_wait() {
            to_remove.push(k.clone());
        }
    }
    for k in to_remove {
        procs.remove(&k);
    }
    let running_handles: Vec<String> = procs.keys().cloned().collect();
    drop(procs);

    let devices = adb::list_devices(&sdk_paths.adb).await.unwrap_or_default();
    avd::list_avds_internal(&sdk_paths, &running_handles, &devices).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_avd_config(
    state: State<'_, AppState>,
    name: String,
    values: HashMap<String, String>,
) -> Result<(), String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    let avd_dir = Path::new(&sdk_paths.avd_home).join(format!("{}.avd", name));
    if !avd_dir.is_dir() {
        return Err(format!("AVD '{}' directory not found", name));
    }
    
    config_editor::backup_config(&avd_dir).map_err(|e| e.to_string())?;
    let config_path = avd_dir.join("config.ini");
    config_editor::write_ini_preserving(&config_path, &values).map_err(|e| e.to_string())
}

#[tauri::command]
async fn restore_avd_config(
    state: State<'_, AppState>,
    name: String,
) -> Result<(), String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    let avd_dir = Path::new(&sdk_paths.avd_home).join(format!("{}.avd", name));
    config_editor::restore_config(&avd_dir).map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_raw_config(
    state: State<'_, AppState>,
    name: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    let config_path = Path::new(&sdk_paths.avd_home)
        .join(format!("{}.avd", name))
        .join("config.ini");
    std::fs::read_to_string(&config_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_raw_config(
    state: State<'_, AppState>,
    name: String,
    content: String,
) -> Result<(), String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    let avd_dir = Path::new(&sdk_paths.avd_home).join(format!("{}.avd", name));
    config_editor::backup_config(&avd_dir).map_err(|e| e.to_string())?;
    let config_path = avd_dir.join("config.ini");
    std::fs::write(&config_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn avdmanager_list(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    let mut cmd = tokio::process::Command::new(&sdk_paths.emulator);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let out = cmd
        .args(["-list-avds"])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stdout);
    Ok(text.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
}

// ----------------- Emulator Process Commands -----------------

#[tauri::command]
async fn start_avd(
    state: State<'_, AppState>,
    window: Window,
    opts: StartOptions,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;

    let (handle, child) = emulator::spawn_emulator(&sdk_paths, window, &opts)
        .map_err(|e| e.to_string())?;

    let mut procs = state.processes.lock().await;
    if let Some(mut old) = procs.remove(&handle) {
        let _ = old.kill().await;
        let _ = old.wait().await;
    }
    procs.insert(handle.clone(), child);

    Ok(handle)
}

#[tauri::command]
async fn stop_avd(state: State<'_, AppState>, name: String) -> Result<(), String> {
    let handle = format!("emulator-{}", name);
    let s = state.settings.lock().await.clone();
    
    // Try killing the process handle directly
    let mut procs = state.processes.lock().await;
    if let Some(mut child) = procs.remove(&handle) {
        let _ = child.kill().await;
        let _ = child.wait().await;
    }
    drop(procs);

    // Also send kill to ADB if online
    if let Ok(sdk_paths) = sdk::resolve_sdk_paths(&s) {
        let devices = adb::list_devices(&sdk_paths.adb).await.unwrap_or_default();
        if let Some(dev) = devices.into_iter().find(|d| d.avd_name.as_deref() == Some(&name)) {
            let _ = adb::run_adb(&sdk_paths.adb, Some(&dev.serial), &["emu", "kill"]).await;
        }
    }

    Ok(())
}

#[tauri::command]
async fn get_running_emulators(state: State<'_, AppState>) -> Result<Vec<EmulatorProcessInfo>, String> {
    let mut procs = state.processes.lock().await;
    let mut to_remove = Vec::new();
    let mut list = Vec::new();
    for (handle, child) in procs.iter_mut() {
        if let Ok(Some(_status)) = child.try_wait() {
            to_remove.push(handle.clone());
        } else {
            let avd_name = handle.trim_start_matches("emulator-").to_string();
            let pid = child.id();
            list.push(EmulatorProcessInfo {
                handle: handle.clone(),
                avd_name,
                pid,
            });
        }
    }
    for k in to_remove {
        procs.remove(&k);
    }
    Ok(list)
}

// ----------------- ADB & Device Tools -----------------

#[tauri::command]
async fn adb_devices(state: State<'_, AppState>) -> Result<Vec<AdbDevice>, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::list_devices(&sdk_paths.adb).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_root(state: State<'_, AppState>, serial: String) -> Result<RootStatus, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::check_root(&sdk_paths.adb, &serial).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn install_apk(
    state: State<'_, AppState>,
    opts: InstallOptions,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::install_apk(&sdk_paths.adb, &opts).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn reboot_device(
    state: State<'_, AppState>,
    serial: String,
    mode: Option<String>,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::reboot_device(&sdk_paths.adb, &serial, mode.as_deref()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn restart_adb_server(state: State<'_, AppState>) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::restart_adb_server(&sdk_paths.adb).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn capture_screenshot(
    state: State<'_, AppState>,
    serial: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::capture_screenshot(&sdk_paths.adb, &serial).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_key_event(
    state: State<'_, AppState>,
    serial: String,
    keycode: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::send_key_event(&sdk_paths.adb, &serial, &keycode).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_text_input(
    state: State<'_, AppState>,
    serial: String,
    text: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::send_text_input(&sdk_paths.adb, &serial, &text).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_url(
    state: State<'_, AppState>,
    serial: String,
    url: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::open_url(&sdk_paths.adb, &serial, &url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_packages(
    state: State<'_, AppState>,
    serial: String,
    filter: Option<String>,
) -> Result<Vec<String>, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::list_packages(&sdk_paths.adb, &serial, filter.as_deref()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn uninstall_package(
    state: State<'_, AppState>,
    serial: String,
    package: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::uninstall_package(&sdk_paths.adb, &serial, &package).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn execute_shell_command(
    state: State<'_, AppState>,
    serial: String,
    command: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::execute_shell_command(&sdk_paths.adb, &serial, &command).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn push_file(
    state: State<'_, AppState>,
    serial: String,
    local_path: String,
    remote_path: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::push_file(&sdk_paths.adb, &serial, &local_path, &remote_path).await.map_err(|e| e.to_string())
}

// ----------------- Cellular / Phone & SMS Commands -----------------

#[tauri::command]
async fn simulate_call(
    state: State<'_, AppState>,
    serial: String,
    phone_number: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::simulate_call(&sdk_paths.adb, &serial, &phone_number).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_call(
    state: State<'_, AppState>,
    serial: String,
    phone_number: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::cancel_call(&sdk_paths.adb, &serial, &phone_number).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn accept_call(
    state: State<'_, AppState>,
    serial: String,
    phone_number: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::accept_call(&sdk_paths.adb, &serial, &phone_number).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_sms_message(
    state: State<'_, AppState>,
    serial: String,
    phone_number: String,
    text: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::send_sms_message(&sdk_paths.adb, &serial, &phone_number, &text).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_cellular_state(
    state: State<'_, AppState>,
    serial: String,
    cellular_state: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::set_cellular_state(&sdk_paths.adb, &serial, &cellular_state).await.map_err(|e| e.to_string())
}

// ----------------- Fingerprint & Sensors -----------------

#[tauri::command]
async fn touch_fingerprint(
    state: State<'_, AppState>,
    serial: String,
    finger_id: u32,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::touch_fingerprint(&sdk_paths.adb, &serial, finger_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_fingerprint(
    state: State<'_, AppState>,
    serial: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::remove_fingerprint(&sdk_paths.adb, &serial).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_device_rotation(
    state: State<'_, AppState>,
    serial: String,
    rotation: u32,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::set_device_rotation(&sdk_paths.adb, &serial, rotation).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_sensor_values(
    state: State<'_, AppState>,
    serial: String,
    sensor: String,
    values: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::set_sensor_values(&sdk_paths.adb, &serial, &sensor, &values).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_secondary_display_overlay(
    state: State<'_, AppState>,
    serial: String,
    spec: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::set_secondary_display_overlay(&sdk_paths.adb, &serial, &spec).await.map_err(|e| e.to_string())
}

// ----------------- Screen Recording -----------------

#[tauri::command]
async fn start_screen_record(
    state: State<'_, AppState>,
    serial: String,
    bit_rate_mbps: Option<u32>,
    time_limit_sec: Option<u32>,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::start_screen_record(&sdk_paths.adb, &serial, bit_rate_mbps, time_limit_sec)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_screen_record(
    state: State<'_, AppState>,
    serial: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::stop_screen_record(&sdk_paths.adb, &serial).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn pull_screen_record(
    state: State<'_, AppState>,
    serial: String,
    local_dest: String,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::pull_screen_record(&sdk_paths.adb, &serial, &local_dest).await.map_err(|e| e.to_string())
}

// ----------------- Native File & Folder Dialogs -----------------

#[tauri::command]
async fn pick_file(filter: Option<String>) -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        let filter_str = filter.unwrap_or_else(|| "All Files (*.*)|*.*".to_string());
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = '{}'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Output $f.FileName }}",
            filter_str
        );
        let mut cmd = tokio::process::Command::new("powershell");
        cmd.creation_flags(0x08000000);
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        if let Ok(out) = cmd.output().await {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }
    #[cfg(not(windows))]
    {
        Ok(None)
    }
}

#[tauri::command]
async fn pick_folder() -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        let script = "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }";
        let mut cmd = tokio::process::Command::new("powershell");
        cmd.creation_flags(0x08000000);
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
        if let Ok(out) = cmd.output().await {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }
    #[cfg(not(windows))]
    {
        Ok(None)
    }
}

// ----------------- Logcat Commands -----------------

#[tauri::command]
async fn start_logcat(
    state: State<'_, AppState>,
    window: Window,
    opts: LogcatOptions,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;

    let (handle, child) = logcat::start_logcat_stream(&sdk_paths, window, &opts)
        .await
        .map_err(|e| e.to_string())?;

    let mut logs = state.logcats.lock().await;
    if let Some(mut old) = logs.remove(&handle) {
        let _ = old.kill().await;
        let _ = old.wait().await;
    }
    logs.insert(handle.clone(), child);

    Ok(handle)
}

#[tauri::command]
async fn stop_logcat(state: State<'_, AppState>, serial: String) -> Result<(), String> {
    let handle = format!("logcat-{}", serial);
    let mut logs = state.logcats.lock().await;
    if let Some(mut child) = logs.remove(&handle) {
        let _ = child.kill().await;
        let _ = child.wait().await;
    }
    Ok(())
}

// ----------------- Main Entry Point -----------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            detect_sdk,
            list_avds,
            save_avd_config,
            restore_avd_config,
            read_raw_config,
            write_raw_config,
            avdmanager_list,
            start_avd,
            stop_avd,
            get_running_emulators,
            adb_devices,
            check_root,
            install_apk,
            reboot_device,
            restart_adb_server,
            capture_screenshot,
            send_key_event,
            send_text_input,
            open_url,
            list_packages,
            uninstall_package,
            execute_shell_command,
            push_file,
            simulate_call,
            cancel_call,
            accept_call,
            send_sms_message,
            set_cellular_state,
            touch_fingerprint,
            remove_fingerprint,
            set_device_rotation,
            set_sensor_values,
            set_secondary_display_overlay,
            start_screen_record,
            stop_screen_record,
            pull_screen_record,
            pick_file,
            pick_folder,
            start_logcat,
            stop_logcat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
