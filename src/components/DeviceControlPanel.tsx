import React, { useState } from "react";
import {
  Shield,
  Upload,
  Camera,
  RotateCcw,
  List,
  Trash2,
  Download,
  Smartphone,
  Volume2,
  Volume1,
  Power,
  ArrowLeft,
  Home,
  Layers,
  Terminal,
  FileUp,
  BatteryCharging,
  Wifi,
  Copy,
} from "lucide-react";
import { AdbDevice, InstallOptions, RootStatus } from "../types";
import { useToast } from "../context/ToastContext";

interface DeviceControlPanelProps {
  devices: AdbDevice[];
  activeSerial: string;
  setActiveSerial: (serial: string) => void;
  onCheckRoot: (serial: string) => Promise<RootStatus>;
  onInstallApk: (opts: InstallOptions) => Promise<string>;
  onReboot: (serial: string, mode?: string) => Promise<string>;
  onRestartAdb: () => Promise<string>;
  onScreenshot: (serial: string) => Promise<string>;
  onSendKey: (serial: string, keycode: string) => Promise<string>;
  onSendText: (serial: string, text: string) => Promise<string>;
  onOpenUrl: (serial: string, url: string) => Promise<string>;
  onListPackages: (serial: string) => Promise<string[]>;
  onUninstallPackage: (serial: string, pkg: string) => Promise<string>;
  onExecuteShell: (serial: string, cmd: string) => Promise<string>;
  onPushFile: (serial: string, localPath: string, remotePath: string) => Promise<string>;
}

export const DeviceControlPanel: React.FC<DeviceControlPanelProps> = ({
  devices,
  activeSerial,
  setActiveSerial,
  onCheckRoot,
  onInstallApk,
  onReboot,
  onRestartAdb,
  onScreenshot,
  onSendKey,
  onSendText,
  onOpenUrl,
  onListPackages,
  onUninstallPackage,
  onExecuteShell,
  onPushFile,
}) => {
  const { toast } = useToast();
  const [rootStatus, setRootStatus] = useState<RootStatus | null>(null);
  const [apkPath, setApkPath] = useState("");
  const [reinstall, setReinstall] = useState(true);
  const [grantPerms, setGrantPerms] = useState(true);
  const [allowDowngrade, setAllowDowngrade] = useState(false);
  const [allowTest, setAllowTest] = useState(false);

  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [packages, setPackages] = useState<string[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Custom Shell State
  const [shellCmd, setShellCmd] = useState("");
  const [shellOutput, setShellOutput] = useState("");
  const [runningShell, setRunningShell] = useState(false);

  // File Push State
  const [pushLocalPath, setPushLocalPath] = useState("");
  const [pushRemotePath, setPushRemotePath] = useState("/sdcard/Download/");
  const [pushing, setPushing] = useState(false);

  const [busy, setBusy] = useState(false);

  const handleRootCheck = async () => {
    if (!activeSerial) return;
    setBusy(true);
    try {
      const res = await onCheckRoot(activeSerial);
      setRootStatus(res);
      if (res.rooted) {
        toast.success(
          `Root verified! Remounted: ${res.remounted ? "Yes" : "No"}`
        );
      } else {
        toast.warning("Device is not rooted or su permission denied.");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async () => {
    if (!activeSerial || !apkPath.trim()) return;
    setBusy(true);
    try {
      const out = await onInstallApk({
        serial: activeSerial,
        path: apkPath.trim().replace(/^"|"$/g, ""),
        reinstall,
        grant_permissions: grantPerms,
        allow_downgrade: allowDowngrade,
        allow_test: allowTest,
      });
      if (out.toLowerCase().includes("success")) {
        toast.success(`APK Installed successfully!`);
      } else {
        toast.info(`Install output: ${out}`);
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleScreenshot = async () => {
    if (!activeSerial) return;
    setBusy(true);
    try {
      const dataUri = await onScreenshot(activeSerial);
      setScreenshotData(dataUri);
      toast.success("Screenshot captured!");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSendKey = async (keycode: string) => {
    if (!activeSerial) return;
    try {
      await onSendKey(activeSerial, keycode);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSendText = async () => {
    if (!activeSerial || !textInput) return;
    try {
      await onSendText(activeSerial, textInput);
      setTextInput("");
      toast.success("Text sent to focused input on device");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleOpenUrl = async () => {
    if (!activeSerial || !urlInput.trim()) return;
    try {
      await onOpenUrl(activeSerial, urlInput.trim());
      toast.success(`Opened intent: ${urlInput}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleRefreshPackages = async () => {
    if (!activeSerial) return;
    setLoadingPackages(true);
    try {
      const list = await onListPackages(activeSerial);
      setPackages(list);
      toast.info(`Found ${list.length} installed 3rd-party packages`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleUninstall = async (pkg: string) => {
    if (!window.confirm(`Uninstall package '${pkg}' from ${activeSerial}?`)) return;
    try {
      const out = await onUninstallPackage(activeSerial, pkg);
      toast.success(`Uninstalled ${pkg}: ${out}`);
      await handleRefreshPackages();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleRunShell = async (cmdToRun?: string) => {
    const cmd = cmdToRun || shellCmd;
    if (!activeSerial || !cmd.trim()) return;
    setRunningShell(true);
    try {
      const out = await onExecuteShell(activeSerial, cmd.trim());
      setShellOutput(`$ ${cmd}\n${out}`);
    } catch (e) {
      setShellOutput(`$ ${cmd}\nError: ${e}`);
      toast.error(String(e));
    } finally {
      setRunningShell(false);
    }
  };

  const handlePushFile = async () => {
    if (!activeSerial || !pushLocalPath.trim()) return;
    setPushing(true);
    try {
      const out = await onPushFile(
        activeSerial,
        pushLocalPath.trim().replace(/^"|"$/g, ""),
        pushRemotePath.trim() || "/sdcard/Download/"
      );
      toast.success(`File pushed: ${out}`);
      setPushLocalPath("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="device-control-panel">
      {/* Device Selector Bar */}
      <div className="device-selector-card">
        <div className="selector-group">
          <Smartphone size={20} className="panel-icon" />
          <div>
            <h3>Target Device</h3>
            <span className="selector-desc">Select which emulator or device to interact with</span>
          </div>
        </div>

        <div className="selector-right">
          <select
            className="device-dropdown"
            value={activeSerial}
            onChange={(e) => setActiveSerial(e.target.value)}
          >
            {devices.length === 0 ? (
              <option value="">No devices online</option>
            ) : (
              devices.map((d) => (
                <option key={d.serial} value={d.serial}>
                  {d.serial} — {d.avd_name ? `AVD: ${d.avd_name}` : d.model || d.product || d.state} ({d.state})
                </option>
              ))
            )}
          </select>

          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                await onRestartAdb();
                toast.success("ADB server restarted");
              } catch (err) {
                toast.error(String(err));
              }
            }}
            title="Restart ADB daemon"
          >
            Restart ADB
          </button>
        </div>
      </div>

      {!activeSerial ? (
        <div className="empty-state">
          <Smartphone size={40} />
          <h3>No Active Device Connected</h3>
          <p>Launch an AVD from the AVD Manager or connect a physical Android device with USB debugging enabled.</p>
        </div>
      ) : (
        <div className="controls-grid">
          {/* Root & System Tools */}
          <div className="control-card">
            <div className="card-header">
              <Shield size={18} />
              <h4>Root & System Permissions</h4>
            </div>
            <p className="card-desc">
              Verify root privilege (`su`) and attempt system partition remount.
            </p>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={handleRootCheck} disabled={busy}>
                Check Root & Remount
              </button>
            </div>
            {rootStatus && (
              <div className="root-output-box">
                <div className="root-badges">
                  <span className={`badge ${rootStatus.rooted ? "running" : "offline"}`}>
                    Root: {rootStatus.rooted ? "YES" : "NO"}
                  </span>
                  <span className={`badge ${rootStatus.remounted ? "running" : "offline"}`}>
                    Remounted: {rootStatus.remounted ? "YES" : "NO"}
                  </span>
                </div>
                <pre>{rootStatus.output}</pre>
              </div>
            )}
          </div>

          {/* APK Installer */}
          <div className="control-card">
            <div className="card-header">
              <Upload size={18} />
              <h4>APK Direct Installer</h4>
            </div>
            <p className="card-desc">Install APK file directly to the active device with custom flags.</p>

            <div className="install-form">
              <input
                type="text"
                placeholder="Absolute path to .apk (e.g. C:\build\app.apk)"
                value={apkPath}
                onChange={(e) => setApkPath(e.target.value)}
              />

              <div className="install-flags">
                <label>
                  <input
                    type="checkbox"
                    checked={reinstall}
                    onChange={(e) => setReinstall(e.target.checked)}
                  />
                  -r (Reinstall)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={grantPerms}
                    onChange={(e) => setGrantPerms(e.target.checked)}
                  />
                  -g (Grant permissions)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={allowDowngrade}
                    onChange={(e) => setAllowDowngrade(e.target.checked)}
                  />
                  -d (Downgrade)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={allowTest}
                    onChange={(e) => setAllowTest(e.target.checked)}
                  />
                  -t (Test package)
                </label>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleInstall}
                disabled={busy || !apkPath.trim()}
              >
                Install APK
              </button>
            </div>
          </div>

          {/* Virtual Hardware Key Controller */}
          <div className="control-card">
            <div className="card-header">
              <Smartphone size={18} />
              <h4>Virtual Keypad & Hardware Controls</h4>
            </div>
            <p className="card-desc">Send Android hardware keyevents directly to device.</p>

            <div className="virtual-keys">
              <button className="key-btn" onClick={() => handleSendKey("4")} title="Back (KEYCODE_BACK)">
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button className="key-btn" onClick={() => handleSendKey("3")} title="Home (KEYCODE_HOME)">
                <Home size={16} />
                <span>Home</span>
              </button>
              <button className="key-btn" onClick={() => handleSendKey("187")} title="Recents / App Switcher">
                <Layers size={16} />
                <span>Recents</span>
              </button>
              <button className="key-btn" onClick={() => handleSendKey("26")} title="Power Button">
                <Power size={16} />
                <span>Power</span>
              </button>
              <button className="key-btn" onClick={() => handleSendKey("24")} title="Volume Up">
                <Volume2 size={16} />
                <span>Vol +</span>
              </button>
              <button className="key-btn" onClick={() => handleSendKey("25")} title="Volume Down">
                <Volume1 size={16} />
                <span>Vol -</span>
              </button>
              <button className="key-btn" onClick={() => handleSendKey("66")} title="Enter Key">
                <span>Enter ↵</span>
              </button>
              <button className="key-btn" onClick={() => handleSendKey("82")} title="Menu Key">
                <span>Menu ☰</span>
              </button>
            </div>

            <div className="form-row mt-3">
              <input
                type="text"
                placeholder="Type text to send to focused input field..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendText()}
              />
              <button className="btn btn-secondary" onClick={handleSendText} disabled={!textInput}>
                Send Text
              </button>
            </div>
          </div>

          {/* Screen Capture & Deep Linking */}
          <div className="control-card">
            <div className="card-header">
              <Camera size={18} />
              <h4>Screen Capture & Deep Linking</h4>
            </div>

            <div className="form-row">
              <input
                type="text"
                placeholder="https://example.com or myapp://route"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={handleOpenUrl} disabled={!urlInput.trim()}>
                Open URL
              </button>
            </div>

            <div className="screenshot-actions mt-3">
              <button className="btn btn-primary" onClick={handleScreenshot} disabled={busy}>
                <Camera size={16} />
                <span>Capture Screenshot</span>
              </button>
            </div>

            {screenshotData && (
              <div className="screenshot-preview-box">
                <img src={screenshotData} alt="Device Screenshot" className="screenshot-img" />
                <div className="screenshot-bar">
                  <a href={screenshotData} download={`screenshot-${activeSerial}.png`} className="btn btn-sm btn-secondary">
                    <Download size={14} />
                    <span>Download PNG</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Custom ADB Shell Runner */}
          <div className="control-card full-width-card">
            <div className="card-header">
              <Terminal size={18} />
              <h4>ADB Shell Command Runner</h4>
            </div>

            <div className="quick-shell-pills">
              <button
                className="chip-sm"
                onClick={() => handleRunShell("dumpsys battery set level 100")}
              >
                <BatteryCharging size={12} />
                <span>Battery 100%</span>
              </button>
              <button
                className="chip-sm"
                onClick={() => handleRunShell("dumpsys battery set level 15")}
              >
                <BatteryCharging size={12} />
                <span>Battery 15%</span>
              </button>
              <button
                className="chip-sm"
                onClick={() => handleRunShell("svc wifi enable")}
              >
                <Wifi size={12} />
                <span>Enable WiFi</span>
              </button>
              <button
                className="chip-sm"
                onClick={() => handleRunShell("svc wifi disable")}
              >
                <Wifi size={12} />
                <span>Disable WiFi</span>
              </button>
              <button
                className="chip-sm"
                onClick={() => handleRunShell("getprop ro.build.version.release")}
              >
                <span>Get Android Version</span>
              </button>
              <button
                className="chip-sm"
                onClick={() => handleRunShell("wm size")}
              >
                <span>Get Display Size</span>
              </button>
            </div>

            <div className="form-row">
              <input
                type="text"
                placeholder="Enter shell command (e.g. getprop ro.product.model or pm list packages)"
                value={shellCmd}
                onChange={(e) => setShellCmd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunShell()}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleRunShell()}
                disabled={runningShell || !shellCmd.trim()}
              >
                {runningShell ? "Running..." : "Execute Shell"}
              </button>
            </div>

            {shellOutput && (
              <div className="shell-output-terminal">
                <div className="terminal-top">
                  <span>Output</span>
                  <button
                    className="icon-btn btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(shellOutput);
                      toast.success("Copied shell output to clipboard");
                    }}
                    title="Copy Output"
                  >
                    <Copy size={13} />
                  </button>
                </div>
                <pre>{shellOutput}</pre>
              </div>
            )}
          </div>

          {/* File Push Tool */}
          <div className="control-card full-width-card">
            <div className="card-header">
              <FileUp size={18} />
              <h4>File Transfer (Push to Device)</h4>
            </div>
            <div className="form-row">
              <input
                type="text"
                placeholder="Local file path (e.g. C:\Downloads\image.png or video.mp4)"
                value={pushLocalPath}
                onChange={(e) => setPushLocalPath(e.target.value)}
              />
              <input
                type="text"
                placeholder="Destination on device (default: /sdcard/Download/)"
                value={pushRemotePath}
                onChange={(e) => setPushRemotePath(e.target.value)}
                style={{ maxWidth: "260px" }}
              />
              <button
                className="btn btn-primary"
                onClick={handlePushFile}
                disabled={pushing || !pushLocalPath.trim()}
              >
                {pushing ? "Pushing..." : "Push to Device"}
              </button>
            </div>
          </div>

          {/* Package Manager */}
          <div className="control-card full-width-card">
            <div className="card-header">
              <List size={18} />
              <h4>Installed Applications (3rd Party)</h4>
              <button
                className="btn btn-sm btn-secondary ml-auto"
                onClick={handleRefreshPackages}
                disabled={loadingPackages}
              >
                {loadingPackages ? "Loading..." : "Load Installed Packages"}
              </button>
            </div>

            {packages.length > 0 && (
              <div className="packages-grid">
                {packages.map((pkg) => (
                  <div key={pkg} className="pkg-card">
                    <span className="pkg-name">{pkg}</span>
                    <button
                      className="icon-btn btn-danger-icon"
                      onClick={() => handleUninstall(pkg)}
                      title={`Uninstall ${pkg}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Power & Reboot Tools */}
          <div className="control-card full-width-card">
            <div className="card-header">
              <RotateCcw size={18} />
              <h4>Device Power & Reboot Options</h4>
            </div>
            <div className="reboot-buttons">
              <button
                className="btn btn-subtle"
                onClick={async () => {
                  try {
                    await onReboot(activeSerial);
                    toast.success("Device rebooting...");
                  } catch (e) {
                    toast.error(String(e));
                  }
                }}
              >
                Reboot (Normal)
              </button>
              <button
                className="btn btn-subtle"
                onClick={async () => {
                  try {
                    await onReboot(activeSerial, "recovery");
                    toast.success("Rebooting to Recovery...");
                  } catch (e) {
                    toast.error(String(e));
                  }
                }}
              >
                Reboot to Recovery
              </button>
              <button
                className="btn btn-subtle"
                onClick={async () => {
                  try {
                    await onReboot(activeSerial, "bootloader");
                    toast.success("Rebooting to Bootloader...");
                  } catch (e) {
                    toast.error(String(e));
                  }
                }}
              >
                Reboot to Bootloader / Fastboot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
