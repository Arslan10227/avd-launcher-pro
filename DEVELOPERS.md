# 🛠️ Developer Guide — Android Virtual Device Launcher Pro

Welcome to the **Android Virtual Device Launcher Pro** developer documentation. This guide explains the internal architecture, codebase structure, backend modules, IPC protocols, and step-by-step instructions for extending the software.

---

## 📂 Codebase Structure

```
avd-launcher-pro/
├── public/                     # Static assets (logo.png, app icons)
├── src/                        # React 19 Frontend
│   ├── assets/                 # Component images & styles
│   ├── components/             # Modular UI views & modals
│   │   ├── Navbar.tsx          # Top navigation & state badges
│   │   ├── AvdList.tsx         # AVD manager view (Grid / List)
│   │   ├── AvdCard.tsx         # AVD card with split-button preset launcher
│   │   ├── LaunchConfigModal.tsx # 7-tab emulator CLI flag manager & live CLI preview
│   │   ├── ConfigEditorModal.tsx # Visual/Raw config.ini editor & HW presets
│   │   ├── DeviceControlPanel.tsx # ADB tools, screenshot, shell runner, virtual keys
│   │   ├── LogcatViewer.tsx    # Streaming colorized terminal & filter engine
│   │   ├── EmulatorConsole.tsx # Process stdout/stderr viewer
│   │   ├── SettingsView.tsx    # SDK paths & configuration
│   │   ├── AboutView.tsx       # Creator profile, credits, and architecture
│   │   └── ToastContainer.tsx  # Stacked floating toast notification UI
│   ├── context/
│   │   └── ToastContext.tsx    # Global toast state & dispatch hook (useToast)
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces & preset definitions
│   ├── App.tsx                 # Root application controller & IPC bridge
│   ├── App.css                 # Dark/Light theme design tokens & styles
│   └── main.tsx                # Frontend entry point
├── src-tauri/                  # Rust Backend (Tauri v2)
│   ├── src/
│   │   ├── lib.rs              # Tauri command registration & app state
│   │   ├── main.rs             # Desktop executable entry point (windows_subsystem)
│   │   ├── types.rs            # Rust data models & custom AppError/AppResult
│   │   ├── sdk.rs              # Path discovery engine (Registry, env vars, standard paths)
│   │   ├── avd.rs              # AVD scanner, INI reader, & ADB correlation
│   │   ├── emulator.rs         # Emulator CLI dynamic builder & child process spawner
│   │   ├── adb.rs              # Timeout-guarded ADB command wrappers
│   │   ├── logcat.rs           # Asynchronous logcat stream manager
│   │   ├── config_editor.rs    # Safe line-preserving INI parser with .bak backups
│   │   └── settings.rs         # Settings store (%APPDATA%\avd-launcher\settings.json)
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri v2 configuration & window settings
├── package.json                # NPM configuration
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite bundler configuration
└── README.md                   # Main project overview & user documentation
```

---

## ⚙️ Backend Module Breakdown

### 1. `sdk.rs` (SDK Discovery Engine)
- Discovers Android SDK root (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, Windows Registry `SOFTWARE\Android SDK Tools`, default `%LOCALAPPDATA%\Android\Sdk`).
- Discovers AVD storage directory (`ANDROID_AVD_HOME`, `ANDROID_SDK_HOME`, `%USERPROFILE%\.android\avd`).
- Resolves binary paths for `emulator.exe` and `adb.exe`.

### 2. `avd.rs` (AVD Scanner & State Correlator)
- Scans `*.avd/config.ini` in the AVD home directory.
- Parses display dimensions, density (DPI), ABI architecture, target API level, and snapshot metadata.
- Correlates offline AVDs with active `adb devices` via `ro.boot.qemu.avd_name` or `adb emu avd name`.

### 3. `emulator.rs` (CLI Command Builder & Spawner)
- Dynamically translates `StartOptions` into official Android Emulator flags.
- Configures `CREATE_NO_WINDOW` (`0x08000000`) on Windows to suppress console popups.
- Spawns child process with piped `stdout` and `stderr` streams, emitting lines asynchronously to the frontend via `emulator-output-<handle>`.

### 4. `adb.rs` (Protected ADB Tool Wrappers)
- Executes all ADB commands with `tokio::time::timeout` protection to prevent runtime deadlocks if ADB hangs.
- Implements:
  - Device enumeration (`adb devices -l`)
  - Root check (`su -c id`, `adb root`, `adb remount`)
  - Screenshot capture (`screencap -p` encoded to Base64 PNG)
  - Direct APK installation (`adb install -r -g -d -t`)
  - Virtual keypad keyevents (`adb shell input keyevent <keycode>`)
  - Text typing (`adb shell input text <escaped_text>`)
  - Intent launching (`adb shell am start -a android.intent.action.VIEW -d <url>`)
  - 3rd-party package manager (`adb shell pm list packages -3`)
  - Custom shell execution (`adb shell <cmd>`)
  - File push (`adb push <local> <remote>`)

### 5. `logcat.rs` (Streaming Logcat)
- Spawns `adb logcat -v threadtime` with dynamic PID resolution (via `pidof -s <package>`), buffer selection (`all`, `main`, `system`, `crash`), and severity level filtering.
- Streams stdout lines directly to `logcat-line-<handle>` Tauri events.

### 6. `config_editor.rs` (Line-Preserving INI Editor)
- Line-by-line parser that preserves unmanaged keys and comments in `config.ini`.
- Creates atomic `config.ini.bak` backup files prior to any disk write.
- Allows 1-click restore from backup.

---

## 🔄 Tauri IPC Protocol

### Registered Commands (`src-tauri/src/lib.rs`)

| Command Name | Arguments | Returns | Description |
| :--- | :--- | :--- | :--- |
| `load_settings` | None | `AppSettings` | Reads user settings from disk |
| `save_settings` | `settings: AppSettings` | `()` | Saves user settings to disk |
| `detect_sdk` | None | `SdkPaths` | Runs full Android SDK path discovery |
| `list_avds` | None | `Vec<Avd>` | Returns all AVDs with hardware metadata |
| `save_avd_config` | `name: String, values: Map` | `()` | Updates `config.ini` with backup |
| `restore_avd_config`| `name: String` | `()` | Restores `config.ini` from `.bak` |
| `read_raw_config` | `name: String` | `String` | Reads raw `config.ini` text |
| `write_raw_config`| `name: String, content: String` | `()` | Writes raw `config.ini` text with backup |
| `start_avd` | `opts: StartOptions` | `String` | Launches emulator with custom flags |
| `stop_avd` | `name: String` | `()` | Gracefully stops running emulator |
| `adb_devices` | None | `Vec<AdbDevice>` | Enumerates connected ADB devices |
| `check_root` | `serial: String` | `RootStatus` | Tests `su` root and `adb remount` |
| `install_apk` | `opts: InstallOptions` | `String` | Installs APK file to target device |
| `reboot_device` | `serial: String, mode: Option<String>` | `String` | Reboots device (normal/recovery/bootloader) |
| `restart_adb_server`| None | `String` | Restarts ADB daemon |
| `capture_screenshot`| `serial: String` | `String` | Returns Base64 PNG data URL |
| `send_key_event` | `serial: String, keycode: String` | `String` | Dispatches Android keycode |
| `send_text_input` | `serial: String, text: String` | `String` | Types text into active input |
| `open_url` | `serial: String, url: String` | `String` | Dispatches deep link or web intent |
| `list_packages` | `serial: String, filter: Option<String>` | `Vec<String>` | Lists installed packages |
| `uninstall_package`| `serial: String, package: String` | `String` | Uninstalls package from device |
| `execute_shell_command`| `serial: String, command: String` | `String` | Executes arbitrary ADB shell command |
| `push_file` | `serial: String, local_path: String, remote_path: String` | `String` | Pushes local file to device |
| `start_logcat` | `opts: LogcatOptions` | `String` | Begins background logcat stream |
| `stop_logcat` | `serial: String` | `()` | Terminates active logcat stream |

---

## 🧪 Testing & Quality Assurance

### Rust Unit Tests
Run backend unit tests verifying INI parsing, command builders, and ADB output parsers:
```bash
cd src-tauri
cargo test
```

### Frontend Type Checking & Bundling
```bash
npm run build
```

---

## ➕ How to Add a New Emulator Flag

1. **Add field to Rust `StartOptions`** in `src-tauri/src/types.rs`:
   ```rust
   pub my_flag: Option<String>,
   ```
2. **Append to CLI Builder** in `src-tauri/src/emulator.rs`:
   ```rust
   if let Some(val) = &opts.my_flag {
       cmd.arg("-my-flag").arg(val);
   }
   ```
3. **Add field to TypeScript interface** in `src/types/index.ts`:
   ```typescript
   export interface StartOptions {
     my_flag?: string;
   }
   ```
4. **Add UI Control** in `src/components/LaunchConfigModal.tsx` under the corresponding category tab.

---

## 👨‍💻 Contributing & Contact

For bug reports, feature requests, or contributions:
- **Author**: [Arslan10227 (Arslan)](https://github.com/Arslan10227)
- **GitHub**: [github.com/Arslan10227/avd-launcher-pro](https://github.com/Arslan10227/avd-launcher-pro)
