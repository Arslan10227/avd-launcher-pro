export interface Avd {
  name: string;
  path: string;
  display_name?: string;
  target?: string;
  resolution?: string;
  dpi?: string;
  abi?: string;
  api_level?: string;
  is_running?: boolean;
  serial?: string;
  config: Record<string, string>;
  snapshots: string[];
}

export interface SdkPaths {
  sdk_root: string;
  emulator: string;
  adb: string;
  avd_home: string;
}

export interface AdbDevice {
  serial: string;
  state: string;
  product?: string;
  model?: string;
  device?: string;
  avd_name?: string;
}

export interface RootStatus {
  rooted: boolean;
  remounted: boolean;
  output: string;
}

export interface StartOptions {
  name: string;
  // Boot & Lifecycle
  no_boot_anim: boolean;
  no_snapshot: boolean;
  no_snapshot_load: boolean;
  no_snapshot_save: boolean;
  snapshot?: string;
  wipe_data: boolean;
  read_only: boolean;
  writable_system: boolean;
  selinux?: string; // "permissive" | "enforcing"
  memory_mb?: number;
  cores?: number;

  // Display & Window
  no_window: boolean;
  scale?: string;
  dpi_device?: string;
  skin?: string;
  screen_mode?: string;
  no_passive_gps: boolean;
  no_mouse_reposition?: boolean;
  no_location_ui?: boolean;
  no_nested_warnings?: boolean;
  no_hidpi_scaling?: boolean;

  // Graphics & Acceleration
  gpu?: string;
  feature?: string;
  accel?: string;
  no_accel: boolean;

  // Audio & Media
  no_audio: boolean;
  camera_back?: string;
  camera_front?: string;

  // Network & Connectivity
  netdelay?: string;
  netspeed?: string;
  http_proxy?: string;
  dns_servers?: string;
  tcpdump_path?: string;
  port?: number;
  ports?: string;

  // Debugging & Advanced
  show_kernel: boolean;
  verbose: boolean;
  debug_tags?: string;
  logcat_tags?: string;
  trace_name?: string;
  timezone?: string;
  extra_args?: string;
}

export interface AppSettings {
  sdk_root?: string;
  avd_home?: string;
  default_gpu?: string;
  default_features?: string;
  theme?: "dark" | "light" | "system";
  log_buffer_size?: number;
  auto_refresh_interval_sec?: number;
  custom_profiles?: Record<string, StartOptions>;
}

export interface LogcatOptions {
  serial: string;
  package?: string;
  tag?: string;
  level?: string;
  buffer?: string;
}

export interface InstallOptions {
  serial: string;
  path: string;
  reinstall: boolean;
  grant_permissions: boolean;
  allow_downgrade: boolean;
  allow_test: boolean;
}

export interface EmulatorProcessInfo {
  handle: string;
  avd_name: string;
  pid?: number;
}

export interface PresetProfile {
  name: string;
  description: string;
  config: Record<string, string>;
}

export const HARDWARE_PRESETS: PresetProfile[] = [
  {
    name: "Pixel 8 Pro",
    description: "High-end flagship (1344x2992, 480 DPI, 8GB RAM, 4 Cores)",
    config: {
      "hw.lcd.width": "1344",
      "hw.lcd.height": "2992",
      "hw.lcd.density": "480",
      "hw.ramSize": "8192",
      "vm.heapSize": "512",
      "hw.cpu.ncore": "4",
      "hw.gpu.enabled": "yes",
      "hw.gpu.mode": "host",
      "showDeviceFrame": "no",
      "fastboot.forceFastBoot": "yes",
    },
  },
  {
    name: "Pixel 7",
    description: "Standard modern device (1080x2400, 420 DPI, 6GB RAM, 4 Cores)",
    config: {
      "hw.lcd.width": "1080",
      "hw.lcd.height": "2400",
      "hw.lcd.density": "420",
      "hw.ramSize": "6144",
      "vm.heapSize": "512",
      "hw.cpu.ncore": "4",
      "hw.gpu.enabled": "yes",
      "hw.gpu.mode": "host",
      "showDeviceFrame": "no",
      "fastboot.forceFastBoot": "yes",
    },
  },
  {
    name: "Pixel 5 (Compact / Dev Baseline)",
    description: "Fast development baseline (1080x2340, 440 DPI, 4GB RAM, 2 Cores)",
    config: {
      "hw.lcd.width": "1080",
      "hw.lcd.height": "2340",
      "hw.lcd.density": "440",
      "hw.ramSize": "4096",
      "vm.heapSize": "576",
      "hw.cpu.ncore": "2",
      "hw.gpu.enabled": "yes",
      "hw.gpu.mode": "host",
      "showDeviceFrame": "no",
      "skin.dynamic": "no",
      "fastboot.forceColdBoot": "no",
      "fastboot.forceFastBoot": "yes",
    },
  },
  {
    name: "Tablet 10-inch",
    description: "Large screen landscape (2560x1600, 320 DPI, 6GB RAM, 4 Cores)",
    config: {
      "hw.lcd.width": "2560",
      "hw.lcd.height": "1600",
      "hw.lcd.density": "320",
      "hw.ramSize": "6144",
      "vm.heapSize": "512",
      "hw.cpu.ncore": "4",
      "hw.gpu.enabled": "yes",
      "hw.gpu.mode": "host",
      "showDeviceFrame": "no",
      "fastboot.forceFastBoot": "yes",
    },
  },
  {
    name: "Foldable 7.6-inch",
    description: "Square unfolded display (1812x2176, 380 DPI, 6GB RAM, 4 Cores)",
    config: {
      "hw.lcd.width": "1812",
      "hw.lcd.height": "2176",
      "hw.lcd.density": "380",
      "hw.ramSize": "6144",
      "vm.heapSize": "512",
      "hw.cpu.ncore": "4",
      "hw.gpu.enabled": "yes",
      "hw.gpu.mode": "host",
      "showDeviceFrame": "no",
      "fastboot.forceFastBoot": "yes",
    },
  },
  {
    name: "Low-End Test Device",
    description: "Resource constrained (720x1600, 280 DPI, 2GB RAM, 2 Cores)",
    config: {
      "hw.lcd.width": "720",
      "hw.lcd.height": "1600",
      "hw.lcd.density": "280",
      "hw.ramSize": "2048",
      "vm.heapSize": "256",
      "hw.cpu.ncore": "2",
      "hw.gpu.enabled": "yes",
      "hw.gpu.mode": "host",
      "showDeviceFrame": "no",
      "fastboot.forceFastBoot": "yes",
    },
  },
];

export interface LaunchPreset {
  id: string;
  name: string;
  description: string;
  options: Partial<StartOptions>;
}

export const BUILTIN_LAUNCH_PRESETS: LaunchPreset[] = [
  {
    id: "default-dev",
    name: "Default Dev Baseline",
    description: "Hardware GPU, bypass boot animation, fast start",
    options: {
      no_boot_anim: true,
      no_snapshot: false,
      gpu: "host",
      feature: "ForceANGLE,ForceGpuHost,-ForceSwiftshader,-ForceLavapipe",
      accel: "auto",
      no_window: false,
    },
  },
  {
    id: "rooted-debug",
    name: "Rooted & Writable System",
    description: "Enable -writable-system for adb remount and su root testing",
    options: {
      no_boot_anim: true,
      writable_system: true,
      selinux: "permissive",
      gpu: "host",
      accel: "auto",
    },
  },
  {
    id: "cold-boot",
    name: "Cold Boot (No Snapshot)",
    description: "Fresh boot from clean system state, discarding cached snapshot",
    options: {
      no_boot_anim: true,
      no_snapshot: true,
      no_snapshot_load: true,
      no_snapshot_save: false,
      gpu: "host",
    },
  },
  {
    id: "headless-ci",
    name: "Headless Background (CI / Tests)",
    description: "Runs without display window or audio, minimal background footprint",
    options: {
      no_window: true,
      no_audio: true,
      no_boot_anim: true,
      gpu: "swiftshader_indirect",
      accel: "auto",
    },
  },
  {
    id: "high-perf-vulkan",
    name: "High Performance (Vulkan / 8GB)",
    description: "4 CPU cores, 8GB RAM, Vulkan acceleration",
    options: {
      no_boot_anim: true,
      gpu: "host",
      feature: "Vulkan,ForceANGLE,ForceGpuHost",
      memory_mb: 8192,
      cores: 4,
      accel: "auto",
    },
  },
  {
    id: "slow-3g-network",
    name: "Low-End 3G Network Emulation",
    description: "Emulates 384kbps speed and 100ms mobile network latency",
    options: {
      no_boot_anim: true,
      netdelay: "umts",
      netspeed: "umts",
      memory_mb: 2048,
      cores: 2,
      gpu: "host",
    },
  },
];
