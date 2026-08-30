import React, { useState, useEffect, useRef } from "react";
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
  Folder,
  Phone,
  PhoneCall,
  PhoneOff,
  MessageSquare,
  Fingerprint,
  Video,
  Square,
  Compass,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
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

  // Phone / Cellular State
  const [phoneNumber, setPhoneNumber] = useState("+15551234567");
  const [smsMessage, setSmsMessage] = useState("Hello from AVD Launcher Pro!");
  const [cellularState, setCellularState] = useState("home");

  // Orientation
  const [currentRotation, setCurrentRotation] = useState(0);

  // Secondary Display
  const [secondaryDisplaySpec, setSecondaryDisplaySpec] = useState("");

  // Screen Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleBrowseApk = async () => {
    try {
      const path = await invoke<string | null>("pick_file", {
        filter: "Android Package (*.apk)|*.apk|All Files (*.*)|*.*",
      });
      if (path) {
        setApkPath(path);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBrowsePushFile = async () => {
    try {
      const path = await invoke<string | null>("pick_file", {
        filter: "All Files (*.*)|*.*",
      });
      if (path) {
        setPushLocalPath(path);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckRoot = async () => {
    if (!activeSerial) return;
    try {
      const res = await onCheckRoot(activeSerial);
      setRootStatus(res);
      if (res.rooted) {
        toast.success("Root check successful: Device is rooted with su access");
      } else {
        toast.info("Device is running in non-rooted / standard mode");
      }
    } catch (e) {
      toast.error(`Root check failed: ${e}`);
    }
  };

  const handleInstallApk = async () => {
    if (!activeSerial || !apkPath) {
      toast.warning("Please specify an APK file path");
      return;
    }
    try {
      toast.info("Installing APK on target device...");
      const out = await onInstallApk({
        serial: activeSerial,
        path: apkPath,
        reinstall,
        grant_permissions: grantPerms,
        allow_downgrade: allowDowngrade,
        allow_test: allowTest,
      });
      if (out.includes("Success")) {
        toast.success(`Installation Succeeded: ${out}`);
      } else {
        toast.warning(`Installation Result: ${out}`);
      }
    } catch (e) {
      toast.error(`APK installation failed: ${e}`);
    }
  };

  const handleTakeScreenshot = async () => {
    if (!activeSerial) return;
    try {
      toast.info("Capturing device screenshot...");
      const data = await onScreenshot(activeSerial);
      setScreenshotData(data);
      toast.success("Screenshot captured successfully");
    } catch (e) {
      toast.error(`Screenshot failed: ${e}`);
    }
  };

  const handleStartRecord = async () => {
    if (!activeSerial) return;
    try {
      await invoke("start_screen_record", {
        serial: activeSerial,
        bitRateMbps: 6,
        timeLimitSec: 180,
      });
      setIsRecording(true);
      toast.info("Screen recording started on device");
    } catch (e) {
      toast.error(`Failed to start recording: ${e}`);
    }
  };

  const handleStopRecord = async () => {
    if (!activeSerial) return;
    try {
      await invoke("stop_screen_record", { serial: activeSerial });
      setIsRecording(false);

      const destFolder = await invoke<string | null>("pick_folder");
      if (destFolder) {
        const destFile = `${destFolder}\\avd_recording_${Date.now()}.mp4`;
        await invoke("pull_screen_record", { serial: activeSerial, localDest: destFile });
        toast.success(`Recording saved to: ${destFile}`);
      } else {
        toast.info("Screen recording saved to device at /sdcard/Download/avd_recording.mp4");
      }
    } catch (e) {
      setIsRecording(false);
      toast.error(`Failed to stop recording: ${e}`);
    }
  };

  // Phone Call Actions
  const handleSimulateCall = async () => {
    if (!activeSerial || !phoneNumber) return;
    try {
      await invoke("simulate_call", { serial: activeSerial, phoneNumber });
      toast.success(`Incoming call initiated from ${phoneNumber}`);
    } catch (e) {
      toast.error(`Call simulation failed: ${e}`);
    }
  };

  const handleCancelCall = async () => {
    if (!activeSerial || !phoneNumber) return;
    try {
      await invoke("cancel_call", { serial: activeSerial, phoneNumber });
      toast.info(`Call ended with ${phoneNumber}`);
    } catch (e) {
      toast.error(`End call failed: ${e}`);
    }
  };

  const handleAcceptCall = async () => {
    if (!activeSerial || !phoneNumber) return;
    try {
      await invoke("accept_call", { serial: activeSerial, phoneNumber });
      toast.success(`Call answered with ${phoneNumber}`);
    } catch (e) {
      toast.error(`Accept call failed: ${e}`);
    }
  };

  const handleSendSms = async () => {
    if (!activeSerial || !phoneNumber || !smsMessage) return;
    try {
      await invoke("send_sms_message", { serial: activeSerial, phoneNumber, text: smsMessage });
      toast.success(`SMS dispatched to ${phoneNumber}`);
    } catch (e) {
      toast.error(`Send SMS failed: ${e}`);
    }
  };

  const handleSetCellularState = async (state: string) => {
    if (!activeSerial) return;
    try {
      setCellularState(state);
      await invoke("set_cellular_state", { serial: activeSerial, cellularState: state });
      toast.success(`Cellular network state set to: ${state}`);
    } catch (e) {
      toast.error(`Failed to set cellular state: ${e}`);
    }
  };

  // Fingerprint Simulation
  const handleTouchFingerprint = async (id: number) => {
    if (!activeSerial) return;
    try {
      await invoke("touch_fingerprint", { serial: activeSerial, fingerId: id });
      toast.success(`Fingerprint ${id} touch event triggered`);
    } catch (e) {
      toast.error(`Fingerprint trigger failed: ${e}`);
    }
  };

  const handleRemoveFingerprint = async () => {
    if (!activeSerial) return;
    try {
      await invoke("remove_fingerprint", { serial: activeSerial });
      toast.info("Fingerprint touch released");
    } catch (e) {
      toast.error(`Fingerprint remove failed: ${e}`);
    }
  };

  // Rotation
  const handleSetRotation = async (rot: number) => {
    if (!activeSerial) return;
    try {
      setCurrentRotation(rot);
      await invoke("set_device_rotation", { serial: activeSerial, rotation: rot });
      toast.success(`Device rotated to ${rot * 90}°`);
    } catch (e) {
      toast.error(`Rotation failed: ${e}`);
    }
  };

  // Secondary Display
  const handleSetSecondaryDisplay = async (spec: string) => {
    if (!activeSerial) return;
    try {
      setSecondaryDisplaySpec(spec);
      await invoke("set_secondary_display_overlay", { serial: activeSerial, spec });
      if (spec) {
        toast.success(`Secondary screen overlay applied: ${spec}`);
      } else {
        toast.info("Secondary screen disabled");
      }
    } catch (e) {
      toast.error(`Failed to set secondary screen: ${e}`);
    }
  };

  const handleSendKey = async (keycode: string) => {
    if (!activeSerial) return;
    try {
      await onSendKey(activeSerial, keycode);
    } catch (e) {
      toast.error(`Keyevent ${keycode} failed: ${e}`);
    }
  };

  const handleSendText = async () => {
    if (!activeSerial || !textInput) return;
    try {
      await onSendText(activeSerial, textInput);
      toast.success("Text input sent to device");
      setTextInput("");
    } catch (e) {
      toast.error(`Text input failed: ${e}`);
    }
  };

  const handleOpenUrl = async () => {
    if (!activeSerial || !urlInput) return;
    try {
      await onOpenUrl(activeSerial, urlInput);
      toast.success("URL opened in device browser");
      setUrlInput("");
    } catch (e) {
      toast.error(`Open URL failed: ${e}`);
    }
  };

  const handleListPackages = async () => {
    if (!activeSerial) return;
    setLoadingPackages(true);
    try {
      const list = await onListPackages(activeSerial);
      setPackages(list);
      toast.info(`Found ${list.length} installed 3rd-party packages`);
    } catch (e) {
      toast.error(`Failed to list packages: ${e}`);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleUninstall = async (pkg: string) => {
    if (!activeSerial) return;
    try {
      const out = await onUninstallPackage(activeSerial, pkg);
      toast.info(`Uninstall ${pkg}: ${out}`);
      setPackages((p) => p.filter((x) => x !== pkg));
    } catch (e) {
      toast.error(`Uninstall failed: ${e}`);
    }
  };

  const handleExecuteShell = async () => {
    if (!activeSerial || !shellCmd.trim()) return;
    setRunningShell(true);
    setShellOutput("");
    try {
      const res = await onExecuteShell(activeSerial, shellCmd.trim());
      setShellOutput(res || "(Command completed with no output)");
    } catch (e) {
      setShellOutput(`Error: ${e}`);
    } finally {
      setRunningShell(false);
    }
  };

  const handlePushFile = async () => {
    if (!activeSerial || !pushLocalPath || !pushRemotePath) {
      toast.warning("Please specify both local and remote file paths");
      return;
    }
    try {
      toast.info("Transferring file...");
      const out = await onPushFile(activeSerial, pushLocalPath, pushRemotePath);
      toast.success(`File Push: ${out}`);
    } catch (e) {
      toast.error(`File push failed: ${e}`);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div className="device-control-panel">
      {/* Top Device Switcher Bar */}
      <div className="device-bar">
        <div className="device-bar-left">
          <Smartphone size={18} className="text-accent" />
          <span className="device-bar-label">Active Target Device:</span>
          {devices.length === 0 ? (
            <span className="no-devices-tag">No Connected ADB Devices</span>
          ) : (
            <select
              className="device-select"
              value={activeSerial}
              onChange={(e) => setActiveSerial(e.target.value)}
            >
              {devices.map((d) => (
                <option key={d.serial} value={d.serial}>
                  {d.avd_name ? `[${d.avd_name}] ` : ""}
                  {d.serial} ({d.model || d.product || d.state})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="device-bar-right">
          <button className="btn btn-secondary btn-sm" onClick={onRestartAdb} title="Restart ADB Server">
            <RotateCcw size={14} />
            <span>Restart ADB</span>
          </button>
        </div>
      </div>

      <div className="device-control-grid">
        {/* Hardware Virtual Keypad & Gestures */}
        <div className="control-card">
          <div className="card-header">
            <Smartphone size={16} />
            <h3>Virtual Hardware Controller</h3>
          </div>

          <div className="keypad-grid">
            <button className="keypad-btn" onClick={() => handleSendKey("4")} title="Back (KEYCODE_BACK)">
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button className="keypad-btn" onClick={() => handleSendKey("3")} title="Home (KEYCODE_HOME)">
              <Home size={16} />
              <span>Home</span>
            </button>
            <button className="keypad-btn" onClick={() => handleSendKey("187")} title="Recents / App Switcher">
              <Layers size={16} />
              <span>Recents</span>
            </button>
            <button className="keypad-btn" onClick={() => handleSendKey("26")} title="Power (KEYCODE_POWER)">
              <Power size={16} />
              <span>Power</span>
            </button>
            <button className="keypad-btn" onClick={() => handleSendKey("24")} title="Volume Up">
              <Volume2 size={16} />
              <span>Vol +</span>
            </button>
            <button className="keypad-btn" onClick={() => handleSendKey("25")} title="Volume Down">
              <Volume1 size={16} />
              <span>Vol -</span>
            </button>
          </div>

          <div className="form-group mt-3">
            <label>Send Text Input Directly</label>
            <div className="input-group">
              <input
                type="text"
                placeholder="Type text to type into active Android focus..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendText()}
              />
              <button className="btn btn-secondary" onClick={handleSendText}>
                Send
              </button>
            </div>
          </div>

          <div className="form-group mt-2">
            <label>Open URL in Device Browser</label>
            <div className="input-group">
              <input
                type="text"
                placeholder="https://example.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOpenUrl()}
              />
              <button className="btn btn-secondary" onClick={handleOpenUrl}>
                Open
              </button>
            </div>
          </div>
        </div>

        {/* Screen Capture & Video Recording */}
        <div className="control-card">
          <div className="card-header">
            <Camera size={16} />
            <h3>Screen Capture & Video Recording</h3>
          </div>

          <div className="btn-row-wrap mb-2">
            <button className="btn btn-secondary btn-sm" onClick={handleTakeScreenshot}>
              <Camera size={14} />
              <span>Capture Screenshot</span>
            </button>

            {!isRecording ? (
              <button className="btn btn-secondary btn-sm" onClick={handleStartRecord}>
                <Video size={14} />
                <span>Start Video Record</span>
              </button>
            ) : (
              <button className="btn btn-danger btn-sm pulse-recording" onClick={handleStopRecord}>
                <Square size={14} />
                <span>Stop Record ({formatTime(recordSeconds)})</span>
              </button>
            )}
          </div>

          {screenshotData ? (
            <div className="screenshot-preview-box">
              <img src={screenshotData} alt="Device Screen Preview" className="screenshot-img" />
              <div className="screenshot-actions">
                <a
                  href={screenshotData}
                  download={`avd_screenshot_${Date.now()}.png`}
                  className="btn btn-secondary btn-sm"
                >
                  <Download size={13} />
                  <span>Download Image</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="preview-placeholder">
              <Camera size={32} />
              <span>Capture a screenshot or video to preview here</span>
            </div>
          )}
        </div>

        {/* Cellular & Phone / SMS Simulator */}
        <div className="control-card">
          <div className="card-header">
            <Phone size={16} />
            <h3>Cellular & Phone / SMS Simulator</h3>
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="text"
              placeholder="+15551234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          <div className="btn-row-wrap mb-3">
            <button className="btn btn-secondary btn-sm" onClick={handleSimulateCall}>
              <PhoneCall size={14} />
              <span>Incoming Call</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleAcceptCall}>
              <Phone size={14} />
              <span>Accept</span>
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleCancelCall}>
              <PhoneOff size={14} />
              <span>End / Cancel</span>
            </button>
          </div>

          <div className="form-group">
            <label>Simulate Inbound SMS Message</label>
            <div className="input-group">
              <input
                type="text"
                placeholder="SMS message text..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendSms()}
              />
              <button className="btn btn-secondary" onClick={handleSendSms}>
                <MessageSquare size={14} />
                <span>Send SMS</span>
              </button>
            </div>
          </div>

          <div className="form-group mt-2">
            <label>Cellular Network State</label>
            <select
              value={cellularState}
              onChange={(e) => handleSetCellularState(e.target.value)}
            >
              <option value="home">Home (Full Signal)</option>
              <option value="roaming">Roaming</option>
              <option value="searching">Searching...</option>
              <option value="denied">Denied / Emergency Only</option>
              <option value="unregistered">Unregistered</option>
              <option value="off">Radio Off</option>
            </select>
          </div>
        </div>

        {/* Device Orientation & Biometric Sensors */}
        <div className="control-card">
          <div className="card-header">
            <Compass size={16} />
            <h3>Device Orientation & Biometrics</h3>
          </div>

          <div className="form-group">
            <label>Device Orientation / Rotation</label>
            <div className="orientation-btn-group">
              <button
                className={`btn btn-sm ${currentRotation === 0 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => handleSetRotation(0)}
              >
                Portrait (0°)
              </button>
              <button
                className={`btn btn-sm ${currentRotation === 1 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => handleSetRotation(1)}
              >
                Landscape (90°)
              </button>
              <button
                className={`btn btn-sm ${currentRotation === 2 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => handleSetRotation(2)}
              >
                Inverted (180°)
              </button>
              <button
                className={`btn btn-sm ${currentRotation === 3 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => handleSetRotation(3)}
              >
                Landscape (270°)
              </button>
            </div>
          </div>

          <div className="form-group mt-3">
            <label>Fingerprint Sensor (Biometrics)</label>
            <div className="btn-row-wrap">
              <button className="btn btn-secondary btn-sm" onClick={() => handleTouchFingerprint(1)}>
                <Fingerprint size={14} />
                <span>Touch Finger 1</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleTouchFingerprint(2)}>
                <Fingerprint size={14} />
                <span>Touch Finger 2</span>
              </button>
              <button className="btn btn-subtle btn-sm" onClick={handleRemoveFingerprint}>
                <span>Release</span>
              </button>
            </div>
          </div>

          <div className="form-group mt-3">
            <label>Secondary Screen Overlay</label>
            <select
              value={secondaryDisplaySpec}
              onChange={(e) => handleSetSecondaryDisplay(e.target.value)}
            >
              <option value="">Disabled (None)</option>
              <option value="1080x1920/320">1080x1920 / 320 DPI (Portrait 1080p)</option>
              <option value="1920x1080/240">1920x1080 / 240 DPI (Landscape 1080p)</option>
              <option value="720x1280/240">720x1280 / 240 DPI (720p)</option>
              <option value="480x800/160">480x800 / 160 DPI (WVGA)</option>
            </select>
          </div>
        </div>

        {/* APK Installer with File Picker */}
        <div className="control-card">
          <div className="card-header">
            <Upload size={16} />
            <h3>Direct APK Installer</h3>
          </div>

          <div className="form-group">
            <label>Select APK File</label>
            <div className="input-with-browse">
              <input
                type="text"
                placeholder="C:\path\to\app.apk"
                value={apkPath}
                onChange={(e) => setApkPath(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleBrowseApk}
                title="Browse APK File"
              >
                <Folder size={14} />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          <div className="checkbox-grid-mini">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={reinstall}
                onChange={(e) => setReinstall(e.target.checked)}
              />
              <span>Reinstall (-r)</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={grantPerms}
                onChange={(e) => setGrantPerms(e.target.checked)}
              />
              <span>Grant Runtime Perms (-g)</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allowDowngrade}
                onChange={(e) => setAllowDowngrade(e.target.checked)}
              />
              <span>Allow Downgrade (-d)</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allowTest}
                onChange={(e) => setAllowTest(e.target.checked)}
              />
              <span>Allow Test Package (-t)</span>
            </label>
          </div>

          <div className="mt-3">
            <button className="btn btn-primary" onClick={handleInstallApk}>
              <Upload size={14} />
              <span>Install APK on Device</span>
            </button>
          </div>
        </div>

        {/* Root & System State */}
        <div className="control-card">
          <div className="card-header">
            <Shield size={16} />
            <h3>Root Verification & Reboot</h3>
          </div>

          <div className="btn-row-wrap mb-2">
            <button className="btn btn-secondary btn-sm" onClick={handleCheckRoot}>
              <Shield size={14} />
              <span>Check Root / Remount</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onReboot(activeSerial)}>
              <RotateCcw size={14} />
              <span>Reboot Device</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onReboot(activeSerial, "bootloader")}>
              <span>Bootloader</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onReboot(activeSerial, "recovery")}>
              <span>Recovery</span>
            </button>
          </div>

          {rootStatus && (
            <div className="root-status-box">
              <div className="status-item">
                <b>Root Access (uid=0):</b>
                <span className={rootStatus.rooted ? "badge-success" : "badge-danger"}>
                  {rootStatus.rooted ? "ROOTED" : "NOT ROOTED"}
                </span>
              </div>
              <div className="status-item">
                <b>System Remounted:</b>
                <span className={rootStatus.remounted ? "badge-success" : "badge-warning"}>
                  {rootStatus.remounted ? "WRITABLE" : "READ-ONLY"}
                </span>
              </div>
              <pre className="status-log">{rootStatus.output}</pre>
            </div>
          )}
        </div>

        {/* Installed Packages Inspector */}
        <div className="control-card">
          <div className="card-header">
            <List size={16} />
            <h3>Package Manager & App Inspector</h3>
          </div>

          <div className="btn-row-wrap mb-2">
            <button className="btn btn-secondary btn-sm" onClick={handleListPackages} disabled={loadingPackages}>
              <List size={14} />
              <span>{loadingPackages ? "Loading..." : "Scan Installed Packages"}</span>
            </button>
          </div>

          {packages.length > 0 && (
            <div className="packages-list-container">
              {packages.map((pkg) => (
                <div key={pkg} className="package-item-row">
                  <code className="package-name">{pkg}</code>
                  <button
                    className="btn btn-danger btn-xs"
                    onClick={() => handleUninstall(pkg)}
                    title="Uninstall App"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* File Transfer */}
        <div className="control-card">
          <div className="card-header">
            <FileUp size={16} />
            <h3>ADB File Transfer</h3>
          </div>

          <div className="form-group">
            <label>Local Host Path</label>
            <div className="input-with-browse">
              <input
                type="text"
                placeholder="C:\Users\...\file.txt"
                value={pushLocalPath}
                onChange={(e) => setPushLocalPath(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleBrowsePushFile}
                title="Browse File"
              >
                <Folder size={14} />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Remote Android Destination</label>
            <input
              type="text"
              placeholder="/sdcard/Download/"
              value={pushRemotePath}
              onChange={(e) => setPushRemotePath(e.target.value)}
            />
          </div>

          <button className="btn btn-secondary btn-sm mt-2" onClick={handlePushFile}>
            <FileUp size={14} />
            <span>Push File to Device</span>
          </button>
        </div>

        {/* Interactive Shell Runner */}
        <div className="control-card full-width-card">
          <div className="card-header">
            <Terminal size={16} />
            <h3>ADB Interactive Shell Command</h3>
          </div>

          <div className="input-group mb-2">
            <input
              type="text"
              placeholder="e.g. getprop | grep model, pm list packages, df -h, dumpsys battery"
              value={shellCmd}
              onChange={(e) => setShellCmd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExecuteShell()}
            />
            <button className="btn btn-primary" onClick={handleExecuteShell} disabled={runningShell}>
              <Terminal size={14} />
              <span>{runningShell ? "Running..." : "Execute"}</span>
            </button>
          </div>

          {shellOutput && <pre className="shell-output-box">{shellOutput}</pre>}
        </div>
      </div>
    </div>
  );
};
