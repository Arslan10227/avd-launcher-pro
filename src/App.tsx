import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "./App.css";

import {
  AdbDevice,
  AppSettings,
  Avd,
  InstallOptions,
  LogcatOptions,
  RootStatus,
  SdkPaths,
  StartOptions,
} from "./types";

import { ToastProvider, useToast } from "./context/ToastContext";
import { ToastContainer } from "./components/ToastContainer";
import { ActiveTab, Navbar } from "./components/Navbar";
import { AvdList } from "./components/AvdList";
import { LaunchConfigModal } from "./components/LaunchConfigModal";
import { ConfigEditorModal } from "./components/ConfigEditorModal";
import { DeviceControlPanel } from "./components/DeviceControlPanel";
import { LogcatViewer } from "./components/LogcatViewer";
import { EmulatorConsole } from "./components/EmulatorConsole";
import { SettingsView } from "./components/SettingsView";
import { AboutView } from "./components/AboutView";

function AppContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("avds");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [settings, setSettings] = useState<AppSettings>({});
  const [sdk, setSdk] = useState<SdkPaths | null>(null);
  const [avds, setAvds] = useState<Avd[]>([]);
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [activeSerial, setActiveSerial] = useState("");

  const [logLines, setLogLines] = useState<string[]>([]);
  const [isLogStreaming, setIsLogStreaming] = useState(false);

  const [processLogs, setProcessLogs] = useState<Record<string, string[]>>({});
  const [activeProcessHandle, setActiveProcessHandle] = useState("");

  const [launchModalAvd, setLaunchModalAvd] = useState<Avd | null>(null);
  const [configModalAvd, setConfigModalAvd] = useState<Avd | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const logcatUnlistenRef = useRef<UnlistenFn | null>(null);
  const procUnlistenMap = useRef<Record<string, UnlistenFn>>({});

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    initialLoad();

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refreshAvdsAndDevices();
      }
      if (e.key === "Escape") {
        setLaunchModalAvd(null);
        setConfigModalAvd(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (logcatUnlistenRef.current) logcatUnlistenRef.current();
      Object.values(procUnlistenMap.current).forEach((unsub) => unsub());
    };
  }, []);

  // Periodic ADB refresh
  useEffect(() => {
    const intervalSec = settings.auto_refresh_interval_sec || 3;
    const interval = setInterval(() => {
      refreshDevicesQuiet();
    }, intervalSec * 1000);
    return () => clearInterval(interval);
  }, [settings.auto_refresh_interval_sec]);

  const initialLoad = async () => {
    setRefreshing(true);
    try {
      const s = (await invoke("load_settings")) as AppSettings;
      setSettings(s);
      if (s.theme === "light" || s.theme === "dark") {
        setTheme(s.theme);
      }

      const paths = (await invoke("detect_sdk")) as SdkPaths;
      setSdk(paths);

      await refreshAvdsAndDevices();
    } catch (e) {
      toast.error(String(e), "SDK Discovery Error");
    } finally {
      setRefreshing(false);
    }
  };

  const refreshAvdsAndDevices = async () => {
    setRefreshing(true);
    try {
      const [avdList, devList] = await Promise.all([
        invoke("list_avds") as Promise<Avd[]>,
        invoke("adb_devices") as Promise<AdbDevice[]>,
      ]);
      setAvds(avdList);
      setDevices(devList);

      const online = devList.find((d) => d.state === "device");
      if (online && !activeSerial) {
        setActiveSerial(online.serial);
      } else if (devList.length > 0 && !activeSerial) {
        setActiveSerial(devList[0].serial);
      }
    } catch (e) {
      toast.error(String(e), "Refresh Error");
    } finally {
      setRefreshing(false);
    }
  };

  const refreshDevicesQuiet = async () => {
    try {
      const devList = (await invoke("adb_devices")) as AdbDevice[];
      setDevices(devList);
      if (!activeSerial && devList.length > 0) {
        const online = devList.find((d) => d.state === "device");
        setActiveSerial(online ? online.serial : devList[0].serial);
      }
    } catch (e) {
      // quiet
    }
  };

  const toggleTheme = () => {
    const newTheme: "dark" | "light" = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    const updated: AppSettings = { ...settings, theme: newTheme };
    setSettings(updated);
    invoke("save_settings", { settings: updated });
    toast.info(`Theme set to ${newTheme} mode`);
  };

  // Launch AVD
  const launchEmulatorWithOptions = async (opts: StartOptions) => {
    try {
      toast.info(`Starting ${opts.name}...`, "Emulator");
      const handle = (await invoke("start_avd", { opts })) as string;
      setActiveProcessHandle(handle);

      // Subscribe to process stdout/stderr
      if (!procUnlistenMap.current[handle]) {
        const event = `emulator-output-${handle}`;
        const unlisten = await listen<string>(event, (ev) => {
          setProcessLogs((prev) => {
            const current = prev[handle] || [];
            return {
              ...prev,
              [handle]: [...current.slice(-999), ev.payload],
            };
          });
        });
        procUnlistenMap.current[handle] = unlisten;
      }

      toast.success(`Started ${opts.name}`, "Emulator Running");
      setTimeout(() => refreshAvdsAndDevices(), 2000);
    } catch (e) {
      toast.error(String(e), "Launch Failed");
    }
  };

  const handleQuickStart = (avd: Avd) => {
    launchEmulatorWithOptions({
      name: avd.name,
      no_boot_anim: true,
      no_snapshot: false,
      no_snapshot_load: false,
      no_snapshot_save: false,
      wipe_data: false,
      read_only: false,
      writable_system: false,
      no_window: false,
      gpu: settings.default_gpu || "host",
      feature: settings.default_features,
      accel: "auto",
      no_accel: false,
      no_audio: false,
      no_audio_in: false,
      no_audio_out: false,
      show_kernel: false,
      verbose: false,
      no_passive_gps: false,
    });
  };

  const handleQuickColdBoot = (avd: Avd) => {
    launchEmulatorWithOptions({
      name: avd.name,
      no_boot_anim: true,
      no_snapshot: true,
      no_snapshot_load: true,
      no_snapshot_save: false,
      wipe_data: false,
      read_only: false,
      writable_system: false,
      no_window: false,
      gpu: settings.default_gpu || "host",
      feature: settings.default_features,
      accel: "auto",
      no_accel: false,
      no_audio: false,
      no_audio_in: false,
      no_audio_out: false,
      show_kernel: false,
      verbose: false,
      no_passive_gps: false,
    });
  };

  const handleQuickRooted = (avd: Avd) => {
    launchEmulatorWithOptions({
      name: avd.name,
      no_boot_anim: true,
      no_snapshot: false,
      no_snapshot_load: false,
      no_snapshot_save: false,
      wipe_data: false,
      read_only: false,
      writable_system: true,
      no_window: false,
      gpu: settings.default_gpu || "host",
      feature: settings.default_features,
      accel: "auto",
      no_accel: false,
      no_audio: false,
      no_audio_in: false,
      no_audio_out: false,
      show_kernel: false,
      verbose: false,
      no_passive_gps: false,
    });
  };

  const handleLaunchWithPreset = (avd: Avd, options: Partial<StartOptions>) => {
    launchEmulatorWithOptions({
      name: avd.name,
      no_boot_anim: true,
      no_snapshot: false,
      no_snapshot_load: false,
      no_snapshot_save: false,
      wipe_data: false,
      read_only: false,
      writable_system: false,
      no_window: false,
      gpu: settings.default_gpu || "host",
      feature: settings.default_features,
      accel: "auto",
      no_accel: false,
      no_audio: false,
      no_audio_in: false,
      no_audio_out: false,
      show_kernel: false,
      verbose: false,
      no_passive_gps: false,
      ...options,
    });
  };

  const handleStopAvd = async (avd: Avd) => {
    try {
      toast.info(`Stopping ${avd.name}...`);
      await invoke("stop_avd", { name: avd.name });
      toast.success(`Stopped ${avd.name}`);
      setTimeout(() => refreshAvdsAndDevices(), 1000);
    } catch (e) {
      toast.error(String(e));
    }
  };

  // Config editor
  const handleSaveConfig = async (name: string, values: Record<string, string>) => {
    await invoke("save_avd_config", { name, values });
    await refreshAvdsAndDevices();
  };

  const handleRestoreBackup = async (name: string) => {
    await invoke("restore_avd_config", { name });
    await refreshAvdsAndDevices();
  };

  const handleReadRawConfig = async (name: string) => {
    return (await invoke("read_raw_config", { name })) as string;
  };

  const handleWriteRawConfig = async (name: string, content: string) => {
    await invoke("write_raw_config", { name, content });
    await refreshAvdsAndDevices();
  };

  // Profiles
  const handleSaveProfile = (name: string, opts: StartOptions) => {
    const updatedProfiles = {
      ...(settings.custom_profiles || {}),
      [name]: opts,
    };
    const updated = { ...settings, custom_profiles: updatedProfiles };
    setSettings(updated);
    invoke("save_settings", { settings: updated });
  };

  const handleDeleteProfile = (name: string) => {
    const updatedProfiles = { ...(settings.custom_profiles || {}) };
    delete updatedProfiles[name];
    const updated = { ...settings, custom_profiles: updatedProfiles };
    setSettings(updated);
    invoke("save_settings", { settings: updated });
  };

  // Settings
  const handleSaveSettings = async (newSettings: AppSettings) => {
    await invoke("save_settings", { settings: newSettings });
    setSettings(newSettings);
    await initialLoad();
    toast.success("Application settings saved");
  };

  const handleDetectSdk = async () => {
    const paths = (await invoke("detect_sdk")) as SdkPaths;
    setSdk(paths);
    return paths;
  };

  // Logcat
  const handleStartLogcat = async (opts: LogcatOptions) => {
    if (logcatUnlistenRef.current) {
      logcatUnlistenRef.current();
      logcatUnlistenRef.current = null;
    }
    setLogLines([]);
    setIsLogStreaming(true);

    const handle = `logcat-${opts.serial}`;
    const event = `logcat-line-${handle}`;
    const maxLines = settings.log_buffer_size || 1000;

    const unlisten = await listen<string>(event, (ev) => {
      setLogLines((prev) => [...prev.slice(-maxLines), ev.payload]);
    });
    logcatUnlistenRef.current = unlisten;

    try {
      await invoke("start_logcat", { opts });
    } catch (e) {
      setIsLogStreaming(false);
      throw e;
    }
  };

  const handleStopLogcat = async (serial: string) => {
    await invoke("stop_logcat", { serial });
    setIsLogStreaming(false);
    if (logcatUnlistenRef.current) {
      logcatUnlistenRef.current();
      logcatUnlistenRef.current = null;
    }
  };

  // ADB tools
  const handleCheckRoot = async (serial: string) => {
    return (await invoke("check_root", { serial })) as RootStatus;
  };

  const handleInstallApk = async (opts: InstallOptions) => {
    return (await invoke("install_apk", { opts })) as string;
  };

  const handleReboot = async (serial: string, mode?: string) => {
    return (await invoke("reboot_device", { serial, mode: mode || null })) as string;
  };

  const handleRestartAdb = async () => {
    const res = (await invoke("restart_adb_server")) as string;
    await refreshAvdsAndDevices();
    return res;
  };

  const handleScreenshot = async (serial: string) => {
    return (await invoke("capture_screenshot", { serial })) as string;
  };

  const handleSendKey = async (serial: string, keycode: string) => {
    return (await invoke("send_key_event", { serial, keycode })) as string;
  };

  const handleSendText = async (serial: string, text: string) => {
    return (await invoke("send_text_input", { serial, text })) as string;
  };

  const handleOpenUrl = async (serial: string, url: string) => {
    return (await invoke("open_url", { serial, url })) as string;
  };

  const handleListPackages = async (serial: string) => {
    return (await invoke("list_packages", { serial, filter: "3rd" })) as string[];
  };

  const handleUninstallPackage = async (serial: string, pkg: string) => {
    return (await invoke("uninstall_package", { serial, package: pkg })) as string;
  };

  const handleExecuteShell = async (serial: string, command: string) => {
    return (await invoke("execute_shell_command", { serial, command })) as string;
  };

  const handlePushFile = async (serial: string, localPath: string, remotePath: string) => {
    return (await invoke("push_file", { serial, localPath, remotePath })) as string;
  };

  const runningCount = avds.filter((a) => a.is_running).length;

  return (
    <div className="app-layout">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sdk={sdk}
        runningCount={runningCount}
        activeSerial={activeSerial}
        theme={theme}
        toggleTheme={toggleTheme}
        onRefreshAll={refreshAvdsAndDevices}
        refreshing={refreshing}
      />

      {/* Main Content Area */}
      <main className="app-main-content">
        {activeTab === "avds" && (
          <AvdList
            avds={avds}
            onQuickStart={handleQuickStart}
            onOpenLaunchModal={(a) => setLaunchModalAvd(a)}
            onQuickColdBoot={handleQuickColdBoot}
            onQuickRooted={handleQuickRooted}
            onStop={handleStopAvd}
            onOpenConfigEditor={(a) => setConfigModalAvd(a)}
            onRefresh={refreshAvdsAndDevices}
            onLaunchWithPreset={handleLaunchWithPreset}
            customProfiles={settings.custom_profiles || {}}
          />
        )}

        {activeTab === "devices" && (
          <DeviceControlPanel
            devices={devices}
            activeSerial={activeSerial}
            setActiveSerial={setActiveSerial}
            onCheckRoot={handleCheckRoot}
            onInstallApk={handleInstallApk}
            onReboot={handleReboot}
            onRestartAdb={handleRestartAdb}
            onScreenshot={handleScreenshot}
            onSendKey={handleSendKey}
            onSendText={handleSendText}
            onOpenUrl={handleOpenUrl}
            onListPackages={handleListPackages}
            onUninstallPackage={handleUninstallPackage}
            onExecuteShell={handleExecuteShell}
            onPushFile={handlePushFile}
          />
        )}

        {activeTab === "logcat" && (
          <LogcatViewer
            devices={devices}
            activeSerial={activeSerial}
            setActiveSerial={setActiveSerial}
            logLines={logLines}
            isStreaming={isLogStreaming}
            onStartLogcat={handleStartLogcat}
            onStopLogcat={handleStopLogcat}
            onClearLogs={() => setLogLines([])}
          />
        )}

        {activeTab === "output" && (
          <EmulatorConsole
            logs={processLogs}
            activeHandle={activeProcessHandle}
            setActiveHandle={setActiveProcessHandle}
            onClear={(handle) =>
              setProcessLogs((prev) => ({ ...prev, [handle]: [] }))
            }
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            settings={settings}
            sdk={sdk}
            onSaveSettings={handleSaveSettings}
            onDetectSdk={handleDetectSdk}
          />
        )}

        {activeTab === "about" && (
          <AboutView
            sdk={sdk}
            onOpenUrl={(url) => {
              window.open(url, "_blank");
            }}
          />
        )}
      </main>

      {/* Launch Options Modal */}
      {launchModalAvd && (
        <LaunchConfigModal
          avd={launchModalAvd}
          onClose={() => setLaunchModalAvd(null)}
          onLaunch={launchEmulatorWithOptions}
          customProfiles={settings.custom_profiles || {}}
          onSaveProfile={handleSaveProfile}
          onDeleteProfile={handleDeleteProfile}
        />
      )}

      {/* Config Editor Modal */}
      {configModalAvd && (
        <ConfigEditorModal
          avd={configModalAvd}
          onClose={() => setConfigModalAvd(null)}
          onSaveConfig={handleSaveConfig}
          onRestoreBackup={handleRestoreBackup}
          onReadRawConfig={handleReadRawConfig}
          onWriteRawConfig={handleWriteRawConfig}
        />
      )}

      {/* Floating Modern Toast Stack */}
      <ToastContainer />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
