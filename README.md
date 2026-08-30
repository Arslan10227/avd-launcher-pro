<div align="center">

<img src="./public/logo.png" alt="Android Virtual Device Launcher Pro Logo" width="128" height="128" style="border-radius: 24px;" />

# Android Virtual Device Launcher Pro
### 🚀 The Next-Generation Android Emulator Management & ADB Control Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-v2.0-blue?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.80+-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen)](https://github.com/Arslan10227/avd-launcher-pro)
[![Author](https://img.shields.io/badge/Author-Arslan10227-purple?logo=github)](https://github.com/Arslan10227)

*A blazing fast, lightweight, and modern desktop application designed to control, configure, and customize Android Virtual Devices without launching bulky IDEs.*

[Features](#-key-features) • [Installation](#-installation--getting-started) • [CLI Flags](#-emulator-cli-suite) • [Architecture](#-architecture) • [Developer Guide](./DEVELOPERS.md) • [Author](#-author--credits)

</div>

---

## 🌟 Overview

**Android Virtual Device Launcher Pro** gives Android developers, QA engineers, reverse engineers, and mobile researchers complete granular control over the official Android Emulator (`emulator.exe`) and Android Debug Bridge (`adb.exe`).

Unlike Android Studio's Device Manager, **AVD Launcher Pro**:
- ⚡ **Boots in milliseconds** with ultra-low memory footprint (~40MB RAM vs 2GB+).
- 🪟 **Zero Black Console Windows** (`CREATE_NO_WINDOW` native execution on Windows).
- 🎛️ **Exposes 100% of Android Emulator CLI Flags** across 7 categorized tabs.
- 💾 **Safe INI Config Editor** with automatic `.bak` backups and hardware presets (Pixel 8 Pro, Tablets, Foldables).
- 📲 **Integrated Device Control Studio** (Live screenshots, Root verification & partition remount, APK direct installer with custom flags, virtual hardware keypad, deep link testing, file transfer).
- 📜 **Streaming Colorized Logcat Terminal** with real-time PID detection, severity filtering, and 1-click export.
- 🎨 **Adaptive Dark & Light Themes** with smooth transitions and keyboard shortcuts.

---

## ✨ Key Features

| Category | Capabilities |
| :--- | :--- |
| **AVD Management** | Automatic Android SDK & AVD path discovery via Registry & Environment variables; real-time search & filters; split-button preset launcher; active running pulse indicator. |
| **Emulator Flag Suite** | Boot flags (`-no-boot-anim`, `-no-snapshot`, `-wipe-data`, `-writable-system`, `-selinux`), display scaling (`-scale`, `-dpi-device`, `-skin`, `-no-window`), GPU acceleration (`host`, `swiftshader_indirect`, `angle_indirect`, `guest`), audio controls, network latency & bandwidth emulation (`-netdelay`, `-netspeed`), DNS, HTTP proxy, and custom arguments. |
| **Launch Profiles** | Instant preset switcher (*Default Dev*, *Rooted & Writable*, *Cold Boot*, *Headless CI*, *High Perf Vulkan*, *Slow 3G*); 1-click Save Preset; JSON backup export & import. |
| **Hardware Editor** | Visual geometry, CPU core, RAM, VM heap, GPU mode editor for `config.ini` + Raw INI editor + 1-click Hardware Presets + automatic `.bak` restore. |
| **ADB Control Studio** | Instant `su` root check & partition remount (`adb remount`); direct APK installation (`-r`, `-g`, `-d`, `-t`); high-resolution device screenshot capture; virtual keypad controller (`Back`, `Home`, `Recents`, `Power`, `Volume`, `Enter`); text typing sender; deep link launcher; 3rd-party package manager. |
| **ADB Shell Runner** | Custom shell execution with live output terminal and quick-simulation pills (Battery 100%, Battery 15%, Toggle WiFi, Display size, Android OS version). |
| **File Transfer** | Direct file push to `/sdcard/Download/` with status toasts. |
| **Streaming Logcat** | Live colored terminal, severity filtering (`V/D/I/W/E/F`), buffer selection (`all`, `main`, `system`, `crash`), tag filter, PID package resolution, search filter, auto-scroll lock, and export to `.log`. |
| **Notification System** | Modern stacked floating toast notifications with animated countdown progress bars. |

---

## 🛠️ Emulator CLI Suite

AVD Launcher Pro provides dedicated UI controls for every flag supported by the official Android Emulator:

```
emulator -avd <name>
  ├── [Boot]      -no-boot-anim, -no-snapshot, -no-snapshot-load, -no-snapshot-save, -snapshot <name>, -wipe-data, -read-only, -writable-system, -selinux <permissive|enforcing>, -memory <MB>, -cores <N>
  ├── [Display]   -no-window (Headless CI), -scale <0.5|0.75|1.0|1.25|1.5|2.0>, -dpi-device <DPI>, -skin <skin_name>, -screen <multi-touch|touch|no-touch>, -no-passive-gps
  ├── [GPU/Accel] -gpu <host|swiftshader_indirect|angle_indirect|guest|auto|off>, -feature <flags>, -accel <auto|on|off>, -no-accel
  ├── [Audio/Cam] -no-audio, -no-audio-in, -no-audio-out, -camera-back <emulated|webcam0|none>, -camera-front <emulated|webcam0|none>
  ├── [Network]   -netdelay <none|lte|umts|edge|gprs>, -netspeed <full|lte|hsdpa|umts|edge|gprs|gsm>, -http-proxy <url>, -dns-server <ips>, -tcpdump <file>, -port <port>
  └── [Debug]     -show-kernel, -verbose, -debug <tags>, -timezone <tz>, extra custom CLI arguments
```

---

## 🏗️ Architecture

AVD Launcher Pro is engineered with a high-performance modular Rust backend communicating asynchronously with a React 19 frontend:

```mermaid
graph TD
    UI[React 19 + TypeScript Frontend] <-->|Tauri v2 IPC (Async Commands & Events)| Core[Rust Backend]
    
    subgraph "Rust Modular Core"
        Core --> SDK[sdk.rs: Multi-Source Path Engine]
        Core --> AVD[avd.rs: AVD Scanner & Matching]
        Core --> EMULATOR[emulator.rs: Process Spawner & CLI Builder]
        Core --> ADB[adb.rs: Protected ADB Commands]
        Core --> LOGCAT[logcat.rs: Live Stream Engine]
        Core --> INI[config_editor.rs: Safe INI Parser]
        Core --> SETTINGS[settings.rs: Configuration Store]
    end

    subgraph "System & Android Subsystem"
        SDK --> REG[Windows Registry / Env Vars]
        EMULATOR --> EXEC[emulator.exe (CREATE_NO_WINDOW)]
        ADB --> DAEMON[adb.exe (Async Timeout Guard)]
        LOGCAT --> LOGS[adb logcat (Threadtime Buffer)]
        INI --> DISK[config.ini + config.ini.bak]
    end
```

---

## 📥 Installation & Getting Started

### Prerequisites
- **Operating System**: Windows 10/11, macOS, or Linux.
- **Android SDK**: Android SDK Platform Tools (`adb.exe`) and Android Emulator (`emulator.exe`).
- **Node.js**: `v18+` (for building from source).
- **Rust**: `1.80+` with Cargo.

### Run in Development Mode
```bash
# 1. Clone the repository
git clone https://github.com/Arslan10227/avd-launcher-pro.git
cd avd-launcher-pro

# 2. Install dependencies
npm install

# 3. Launch with hot-reload
npm run tauri dev
```

### Build Standalone Release Executable
```bash
# Bundles standalone .exe and MSI installer
npm run tauri build
```
The compiled standalone binary will be generated at:
`src-tauri/target/release/avd-launcher-pro.exe`

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>R</kbd> / <kbd>Cmd</kbd> + <kbd>R</kbd> | Refresh all AVDs and ADB devices |
| <kbd>Escape</kbd> | Close any active modal or editor dialog |
| <kbd>Enter</kbd> (in inputs) | Submit form / Send text / Execute shell command |

---

## 👨‍💻 Author & Credits

Developed with ❤️ by **[Arslan10227 (Arslan)](https://github.com/Arslan10227)**.

- **GitHub Profile**: [@Arslan10227](https://github.com/Arslan10227)
- **Repository**: [Arslan10227/avd-launcher-pro](https://github.com/Arslan10227/avd-launcher-pro)
- **Issues & Feedback**: [Report an Issue](https://github.com/Arslan10227/avd-launcher-pro/issues)

### Acknowledgments
- **Google Android Open Source Project (AOSP)** for the Android Emulator CLI tools.
- **Tauri Framework** for the ultra-lightweight desktop engine.
- **Lucide Icons** for the modern UI iconography.

---

## 📄 License

This project is open-source and licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.
