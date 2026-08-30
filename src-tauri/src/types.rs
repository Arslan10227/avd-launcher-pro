use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("sdk not found; please configure sdk_root in settings")]
    SdkNotFound,
    #[error("avd home not found; please configure avd_home in settings")]
    AvdHomeNotFound,
    #[error("avd '{0}' not found")]
    AvdNotFound(String),
    #[error("emulator executable not found at '{0}'")]
    EmulatorNotFound(String),
    #[error("adb executable not found at '{0}'")]
    AdbNotFound(String),
    #[error("{0}")]
    Message(String),
}

pub type AppResult<T> = std::result::Result<T, AppError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub sdk_root: Option<String>,
    pub avd_home: Option<String>,
    pub default_gpu: Option<String>,
    pub default_features: Option<String>,
    pub theme: Option<String>, // "dark" | "light" | "system"
    pub log_buffer_size: Option<usize>,
    pub auto_refresh_interval_sec: Option<u64>,
    pub custom_profiles: Option<HashMap<String, StartOptions>>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            sdk_root: None,
            avd_home: None,
            default_gpu: Some("host".into()),
            default_features: Some("ForceANGLE,ForceGpuHost,-ForceSwiftshader,-ForceLavapipe".into()),
            theme: Some("dark".into()),
            log_buffer_size: Some(1000),
            auto_refresh_interval_sec: Some(3),
            custom_profiles: Some(HashMap::new()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdkPaths {
    pub sdk_root: String,
    pub emulator: String,
    pub adb: String,
    pub avd_home: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Avd {
    pub name: String,
    pub path: String,
    pub display_name: Option<String>,
    pub target: Option<String>,
    pub resolution: Option<String>,
    pub dpi: Option<String>,
    pub abi: Option<String>,
    pub api_level: Option<String>,
    pub is_running: bool,
    pub serial: Option<String>,
    pub config: HashMap<String, String>,
    pub snapshots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdbDevice {
    pub serial: String,
    pub state: String,
    pub product: Option<String>,
    pub model: Option<String>,
    pub device: Option<String>,
    pub avd_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootStatus {
    pub rooted: bool,
    pub remounted: bool,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StartOptions {
    pub name: String,
    // Boot & Lifecycle
    pub no_boot_anim: bool,
    pub no_snapshot: bool,
    pub no_snapshot_load: bool,
    pub no_snapshot_save: bool,
    pub snapshot: Option<String>,
    pub wipe_data: bool,
    pub read_only: bool,
    pub writable_system: bool,
    pub selinux: Option<String>, // "permissive" | "enforcing"
    pub memory_mb: Option<u32>,
    pub cores: Option<u32>,

    // Display & Window
    pub no_window: bool,
    pub scale: Option<String>,
    pub dpi_device: Option<String>,
    pub skin: Option<String>,
    pub screen_mode: Option<String>, // "touch" | "multi-touch" | "no-touch"
    pub no_passive_gps: bool,

    // Graphics & Acceleration
    pub gpu: Option<String>, // "auto" | "host" | "swiftshader_indirect" | "angle_indirect" | "guest" | "off"
    pub feature: Option<String>,
    pub accel: Option<String>, // "auto" | "on" | "off"
    pub no_accel: bool,

    // Audio & Media
    pub no_audio: bool,
    pub camera_back: Option<String>, // "emulated" | "webcam0" | "none"
    pub camera_front: Option<String>,

    // Network & Connectivity
    pub netdelay: Option<String>, // "none" | "gprs" | "edge" | "umts" | "lte"
    pub netspeed: Option<String>, // "full" | "lte" | "hsdpa" | "umts" | "edge" | "gprs" | "gsm"
    pub http_proxy: Option<String>,
    pub dns_servers: Option<String>,
    pub tcpdump_path: Option<String>,
    pub port: Option<u16>,
    pub ports: Option<String>,

    // Debugging & Advanced
    pub show_kernel: bool,
    pub verbose: bool,
    pub debug_tags: Option<String>,
    pub logcat_tags: Option<String>,
    pub trace_name: Option<String>,
    pub timezone: Option<String>,
    pub extra_args: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogcatOptions {
    pub serial: String,
    pub package: Option<String>,
    pub tag: Option<String>,
    pub level: Option<String>, // "V" | "D" | "I" | "W" | "E" | "F"
    pub buffer: Option<String>, // "main" | "system" | "crash" | "all"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallOptions {
    pub serial: String,
    pub path: String,
    pub reinstall: bool,
    pub grant_permissions: bool,
    pub allow_downgrade: bool,
    pub allow_test: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmulatorProcessInfo {
    pub handle: String,
    pub avd_name: String,
    pub pid: Option<u32>,
}
