pub mod types;
pub mod sdk;
pub mod avd;
pub mod config_editor;
pub mod emulator;
pub mod adb;
pub mod logcat;
pub mod settings;

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use tauri::{State, Window};
use tokio::process::Child;
use tokio::sync::Mutex;

use crate::types::{
    AdbDevice, AppSettings, Avd, EmulatorProcessInfo, InstallOptions, LogcatOptions,
    RootStatus, SdkPaths, StartOptions,
};

pub struct AppState {
    pub processes: Arc<Mutex<HashMap<String, Child>>>,
    pub logcats: Arc<Mutex<HashMap<String, Child>>>,
    pub settings: Arc<Mutex<AppSettings>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
            logcats: Arc::new(Mutex::new(HashMap::new())),
            settings: Arc::new(Mutex::new(settings::load_settings_from_disk())),
        }
    }
}

// ----------------- Settings Commands -----------------

#[tauri::command]
async fn load_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let s = state.settings.lock().await.clone();
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
    
    let procs = state.processes.lock().await;
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
    Ok(text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect())
}

// ----------------- Emulator Lifecycle -----------------

#[tauri::command]
async fn start_avd(
    state: State<'_, AppState>,
    window: Window,
    opts: StartOptions,
) -> Result<String, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;

    let (handle, child) = emulator::spawn_emulator(&sdk_paths, window, &opts).map_err(|e| e.to_string())?;

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
    let mut procs = state.processes.lock().await;
    if let Some(mut child) = procs.remove(&handle) {
        child.kill().await.map_err(|e| e.to_string())?;
        let _ = child.wait().await;
    }
    Ok(())
}

#[tauri::command]
async fn get_running_emulators(state: State<'_, AppState>) -> Result<Vec<EmulatorProcessInfo>, String> {
    let procs = state.processes.lock().await;
    let mut list = Vec::new();
    for (handle, child) in procs.iter() {
        let avd_name = handle.trim_start_matches("emulator-").to_string();
        list.push(EmulatorProcessInfo {
            handle: handle.clone(),
            avd_name,
            pid: child.id(),
        });
    }
    Ok(list)
}

// ----------------- ADB Commands -----------------

#[tauri::command]
async fn adb_devices(state: State<'_, AppState>) -> Result<Vec<AdbDevice>, String> {
    let s = state.settings.lock().await.clone();
    let sdk_paths = sdk::resolve_sdk_paths(&s).map_err(|e| e.to_string())?;
    adb::list_devices(&sdk_paths.adb).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_root(
    state: State<'_, AppState>,
    serial: String,
) -> Result<RootStatus, String> {
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
            start_logcat,
            stop_logcat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
