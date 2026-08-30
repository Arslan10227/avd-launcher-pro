import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
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
  Search,
  Sliders,
  Send,
  ExternalLink,
  Settings,
  Code,
  Wifi,
  Cpu,
  Activity,
  Play,
  XCircle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { AdbDevice, InstallOptions, RootStatus } from "../types";
import { useToast } from "../context/ToastContext";
import { VirtualDeviceRotator } from "./VirtualDeviceRotator";

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

type ControlTab = "keys" | "sensors" | "display" | "cellular" | "packages" | "system";

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
  const [activeTab, setActiveTab] = useState<ControlTab>("keys");

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
  const [packageSearch, setPackageSearch] = useState("");
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
        toast.success("Root check successful: Device has SU root access (uid=0)");
      } else {
        toast.info("Device is unrooted / standard user privileges");
      }
    } catch (e) {
      toast.error(`Root check failed: ${e}`);
    }
  };

  const handleInstallApk = async () => {
    if (!activeSerial || !apkPath) {
      toast.warning("Please select or specify an APK file path");
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
      toast.info("Screen video recording started on device");
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
        toast.info("Screen recording saved to device (/sdcard/Download/avd_recording.mp4)");
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
      toast.success(`Incoming call simulated from ${phoneNumber}`);
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
      toast.success(`Cellular radio state updated to: ${state}`);
    } catch (e) {
      toast.error(`Failed to set cellular state: ${e}`);
    }
  };

  // Fingerprint Simulation
  const handleTouchFingerprint = async (id: number) => {
    if (!activeSerial) return;
    try {
      await invoke("touch_fingerprint", { serial: activeSerial, fingerId: id });
      toast.success(`Fingerprint #${id} sensor touch simulated`);
    } catch (e) {
      toast.error(`Fingerprint simulation failed: ${e}`);
    }
  };

  const handleRemoveFingerprint = async () => {
    if (!activeSerial) return;
    try {
      await invoke("remove_fingerprint", { serial: activeSerial });
      toast.info("Fingerprint sensor released");
    } catch (e) {
      toast.error(`Fingerprint release failed: ${e}`);
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
        toast.info("Secondary screen overlay disabled");
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
      toast.success("Text input typed into focused element");
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
      setShellOutput(res || "(Command executed successfully with no output)");
    } catch (e) {
      setShellOutput(`Error: ${e}`);
    } finally {
      setRunningShell(false);
    }
  };

  const handlePushFile = async () => {
    if (!activeSerial || !pushLocalPath || !pushRemotePath) {
      toast.warning("Please select both a local file and remote destination path");
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

  const filteredPackages = packages.filter((p) =>
    p.toLowerCase().includes(packageSearch.toLowerCase())
  );

  return (
    <div className="device-control-panel">
      {/* Top Device Switcher & Status Banner */}
      <div className="device-bar">
        <div className="device-bar-left">
          <Smartphone size={18} className="text-accent" />
          <span className="device-bar-label">Active Android Device:</span>
          {devices.length === 0 ? (
            <span className="no-devices-tag">No Active ADB Devices Connected</span>
          ) : (
            <select
              className="device-select"
              value={activeSerial}
              onChange={(e) => setActiveSerial(e.target.value)}
            >
              {devices.map((d) => (
                <option key={d.serial} value={d.serial}>
                  {d.avd_name ? `[${d.avd_name}] ` : ""}
                  {d.serial} — {d.model || d.product || d.state}
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

      {/* Modern Studio Tabbed Navigation */}
      <div className="control-tabs-container">
        <div className="control-tabs-bar">
          <button
            className={`control-tab-btn ${activeTab === "keys" ? "active" : ""}`}
            onClick={() => setActiveTab("keys")}
          >
            <Smartphone size={15} />
            <span>Keypad & Hardware</span>
          </button>

          <button
            className={`control-tab-btn ${activeTab === "sensors" ? "active" : ""}`}
            onClick={() => setActiveTab("sensors")}
          >
            <Compass size={15} />
            <span>3D Device Pose & Sensors</span>
          </button>

          <button
            className={`control-tab-btn ${activeTab === "display" ? "active" : ""}`}
            onClick={() => setActiveTab("display")}
          >
            <Camera size={15} />
            <span>Display & Screen Recording</span>
          </button>

          <button
            className={`control-tab-btn ${activeTab === "cellular" ? "active" : ""}`}
            onClick={() => setActiveTab("cellular")}
          >
            <Phone size={15} />
            <span>Cellular & SMS</span>
          </button>

          <button
            className={`control-tab-btn ${activeTab === "packages" ? "active" : ""}`}
            onClick={() => setActiveTab("packages")}
          >
            <Upload size={15} />
            <span>Apps & Files</span>
          </button>

          <button
            className={`control-tab-btn ${activeTab === "system" ? "active" : ""}`}
            onClick={() => setActiveTab("system")}
          >
            <Terminal size={15} />
            <span>System, Root & Shell</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Keypad & Hardware */}
      {activeTab === "keys" && (
        <div className="tab-pane">
          <div className="device-control-grid">
            <div className="control-card">
              <div className="card-header">
                <Smartphone size={16} />
                <h3>Virtual Hardware Controller</h3>
              </div>

              <div className="keypad-grid">
                <button className="keypad-btn" onClick={() => handleSendKey("4")} title="Back (KEYCODE_BACK)">
                  <ArrowLeft size={18} />
                  <span>Back</span>
                </button>
                <button className="keypad-btn" onClick={() => handleSendKey("3")} title="Home (KEYCODE_HOME)">
                  <Home size={18} />
                  <span>Home</span>
                </button>
                <button className="keypad-btn" onClick={() => handleSendKey("187")} title="Recents / App Switcher">
                  <Layers size={18} />
                  <span>Recents</span>
                </button>
                <button className="keypad-btn" onClick={() => handleSendKey("26")} title="Power (KEYCODE_POWER)">
                  <Power size={18} />
                  <span>Power</span>
                </button>
                <button className="keypad-btn" onClick={() => handleSendKey("24")} title="Volume Up">
                  <Volume2 size={18} />
                  <span>Vol +</span>
                </button>
                <button className="keypad-btn" onClick={() => handleSendKey("25")} title="Volume Down">
                  <Volume1 size={18} />
                  <span>Vol -</span>
                </button>
              </div>

              <div className="form-group mt-3">
                <label>Send Text Input to Focus</label>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Type text to send to active focus..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                  />
                  <button className="btn btn-secondary" onClick={handleSendText}>
                    <Send size={14} />
                    <span>Send</span>
                  </button>
                </div>
              </div>

              <div className="form-group mt-2">
                <label>Open URL in Device Browser</label>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="https://google.com"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOpenUrl()}
                  />
                  <button className="btn btn-secondary" onClick={handleOpenUrl}>
                    <ExternalLink size={14} />
                    <span>Launch</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="control-card">
              <div className="card-header">
                <Fingerprint size={16} />
                <h3>Biometrics & Quick Shortcuts</h3>
              </div>

              <div className="form-group">
                <label>Fingerprint Biometrics</label>
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
                    <XCircle size={14} />
                    <span>Release Sensor</span>
                  </button>
                </div>
              </div>

              <div className="form-group mt-3">
                <label>Direct System Settings Shortcuts</label>
                <div className="btn-row-wrap">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onExecuteShell(activeSerial, "am start -a android.settings.SETTINGS")}
                  >
                    <Settings size={14} />
                    <span>Device Settings</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onExecuteShell(activeSerial, "am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS")}
                  >
                    <Code size={14} />
                    <span>Developer Options</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onExecuteShell(activeSerial, "am start -a android.settings.WIRELESS_SETTINGS")}
                  >
                    <Wifi size={14} />
                    <span>Wi-Fi & Network</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 3D Device Pose & Virtual Sensors */}
      {activeTab === "sensors" && (
        <div className="tab-pane">
          <VirtualDeviceRotator serial={activeSerial} />
        </div>
      )}

      {/* Tab 3: Display, Screenshots & Recording */}
      {activeTab === "display" && (
        <div className="tab-pane">
          <div className="device-control-grid">
            <div className="control-card">
              <div className="card-header">
                <Camera size={16} />
                <h3>Screen Capture & Video Recording</h3>
              </div>

              <div className="btn-row-wrap mb-3">
                <button className="btn btn-secondary btn-sm" onClick={handleTakeScreenshot}>
                  <Camera size={14} />
                  <span>Capture Screenshot</span>
                </button>

                {!isRecording ? (
                  <button className="btn btn-secondary btn-sm" onClick={handleStartRecord}>
                    <Video size={14} />
                    <span>Start Video Recording</span>
                  </button>
                ) : (
                  <button className="btn btn-danger btn-sm pulse-recording" onClick={handleStopRecord}>
                    <Square size={14} />
                    <span>Stop Recording ({formatTime(recordSeconds)})</span>
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
                      className="btn btn-primary btn-sm"
                    >
                      <Download size={13} />
                      <span>Download Image</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="preview-placeholder">
                  <Camera size={36} />
                  <span>Capture a screenshot or video recording to preview here</span>
                </div>
              )}
            </div>

            <div className="control-card">
              <div className="card-header">
                <Sliders size={16} />
                <h3>Secondary Screen Overlay</h3>
              </div>

              <div className="form-group">
                <label>Secondary Simulated Display</label>
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
                <span className="field-hint">Adds a secondary floating screen inside the emulator window</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Cellular & Phone / SMS */}
      {activeTab === "cellular" && (
        <div className="tab-pane">
          <div className="device-control-grid">
            <div className="control-card">
              <div className="card-header">
                <Phone size={16} />
                <h3>Phone Call Simulator</h3>
              </div>

              <div className="form-group">
                <label>Originating Phone Number</label>
                <input
                  type="text"
                  placeholder="+15551234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className="btn-row-wrap mt-3">
                <button className="btn btn-secondary btn-sm" onClick={handleSimulateCall}>
                  <PhoneCall size={14} />
                  <span>Simulate Incoming Call</span>
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleAcceptCall}>
                  <Phone size={14} />
                  <span>Answer / Accept</span>
                </button>
                <button className="btn btn-danger btn-sm" onClick={handleCancelCall}>
                  <PhoneOff size={14} />
                  <span>Hang Up / End</span>
                </button>
              </div>
            </div>

            <div className="control-card">
              <div className="card-header">
                <MessageSquare size={16} />
                <h3>SMS Dispatch & Cellular Radio</h3>
              </div>

              <div className="form-group">
                <label>Inbound SMS Message Body</label>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Enter SMS message..."
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

              <div className="form-group mt-3">
                <label>Cellular Radio State</label>
                <select
                  value={cellularState}
                  onChange={(e) => handleSetCellularState(e.target.value)}
                >
                  <option value="home">Home (Full Signal LTE/5G)</option>
                  <option value="roaming">Roaming</option>
                  <option value="searching">Searching...</option>
                  <option value="denied">Denied / Emergency Only</option>
                  <option value="unregistered">Unregistered</option>
                  <option value="off">Radio Off</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Apps & Files */}
      {activeTab === "packages" && (
        <div className="tab-pane">
          <div className="device-control-grid">
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
                  <span>Allow Test (-t)</span>
                </label>
              </div>

              <div className="mt-3">
                <button className="btn btn-primary" onClick={handleInstallApk}>
                  <Upload size={14} />
                  <span>Install APK to Device</span>
                </button>
              </div>
            </div>

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
                    title="Browse Local File"
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

              <div className="mt-3">
                <button className="btn btn-secondary btn-sm" onClick={handlePushFile}>
                  <FileUp size={14} />
                  <span>Push File to Device</span>
                </button>
              </div>
            </div>

            <div className="control-card full-width-card">
              <div className="card-header">
                <List size={16} />
                <h3>Installed Packages Inspector</h3>
              </div>

              <div className="btn-row-wrap mb-2">
                <button className="btn btn-secondary btn-sm" onClick={handleListPackages} disabled={loadingPackages}>
                  <List size={14} />
                  <span>{loadingPackages ? "Scanning Packages..." : "Scan Installed Packages"}</span>
                </button>

                {packages.length > 0 && (
                  <div className="search-box">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Filter packages..."
                      value={packageSearch}
                      onChange={(e) => setPackageSearch(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {packages.length > 0 && (
                <div className="packages-list-container">
                  {filteredPackages.map((pkg) => (
                    <div key={pkg} className="package-item-row">
                      <code className="package-name">{pkg}</code>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => handleUninstall(pkg)}
                        title="Uninstall Package"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: System, Root & Shell */}
      {activeTab === "system" && (
        <div className="tab-pane">
          <div className="device-control-grid">
            <div className="control-card">
              <div className="card-header">
                <ShieldCheck size={16} />
                <h3>Root Verification & Remount</h3>
              </div>

              <div className="btn-row-wrap mb-2">
                <button className="btn btn-secondary btn-sm" onClick={handleCheckRoot}>
                  <ShieldCheck size={14} />
                  <span>Check Root & Remount</span>
                </button>
              </div>

              {rootStatus && (
                <div className="root-status-box">
                  <div className="status-item">
                    <b>Root Status (uid=0):</b>
                    <span className={rootStatus.rooted ? "badge-success" : "badge-danger"}>
                      {rootStatus.rooted ? "ROOTED" : "NOT ROOTED"}
                    </span>
                  </div>
                  <div className="status-item">
                    <b>System Remount:</b>
                    <span className={rootStatus.remounted ? "badge-success" : "badge-warning"}>
                      {rootStatus.remounted ? "WRITABLE" : "READ-ONLY"}
                    </span>
                  </div>
                  <pre className="status-log">{rootStatus.output}</pre>
                </div>
              )}
            </div>

            <div className="control-card">
              <div className="card-header">
                <RotateCcw size={16} />
                <h3>Reboot & Power Operations</h3>
              </div>

              <div className="btn-row-wrap mb-2">
                <button className="btn btn-secondary btn-sm" onClick={() => onReboot(activeSerial)}>
                  <RotateCcw size={14} />
                  <span>Reboot Device</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => onReboot(activeSerial, "bootloader")}>
                  <Cpu size={14} />
                  <span>Bootloader Mode</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => onReboot(activeSerial, "recovery")}>
                  <Activity size={14} />
                  <span>Recovery Mode</span>
                </button>
              </div>
            </div>

            <div className="control-card full-width-card">
              <div className="card-header">
                <Terminal size={16} />
                <h3>Interactive ADB Shell</h3>
              </div>

              <div className="input-group mb-2">
                <input
                  type="text"
                  placeholder="e.g. getprop | grep model, pm list packages, df -h, dumpsys battery, ifconfig"
                  value={shellCmd}
                  onChange={(e) => setShellCmd(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleExecuteShell()}
                />
                <button className="btn btn-primary" onClick={handleExecuteShell} disabled={runningShell}>
                  <Play size={14} />
                  <span>{runningShell ? "Running..." : "Execute"}</span>
                </button>
              </div>

              {shellOutput && <pre className="shell-output-box">{shellOutput}</pre>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
