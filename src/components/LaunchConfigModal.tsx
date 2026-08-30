import React, { useState, useMemo } from "react";
import {
  X,
  Play,
  Bookmark,
  Save,
  Trash2,
  Sliders,
  Cpu,
  Monitor,
  Wifi,
  Volume2,
  Bug,
  Copy,
  Terminal,
  Sparkles,
  Download,
  Upload,
} from "lucide-react";
import { Avd, BUILTIN_LAUNCH_PRESETS, StartOptions } from "../types";
import { useToast } from "../context/ToastContext";

interface LaunchConfigModalProps {
  avd: Avd;
  initialOptions?: Partial<StartOptions>;
  onClose: () => void;
  onLaunch: (opts: StartOptions) => void;
  customProfiles: Record<string, StartOptions>;
  onSaveProfile: (name: string, opts: StartOptions) => void;
  onDeleteProfile: (name: string) => void;
}

type OptionsCategory =
  | "boot"
  | "display"
  | "graphics"
  | "audio"
  | "network"
  | "debug"
  | "profiles";

export const LaunchConfigModal: React.FC<LaunchConfigModalProps> = ({
  avd,
  initialOptions,
  onClose,
  onLaunch,
  customProfiles,
  onSaveProfile,
  onDeleteProfile,
}) => {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<OptionsCategory>("boot");
  const [activePresetId, setActivePresetId] = useState<string>("default-dev");

  const [isSavePromptOpen, setIsSavePromptOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const [options, setOptions] = useState<StartOptions>({
    name: avd.name,
    // Boot
    no_boot_anim: true,
    no_snapshot: false,
    no_snapshot_load: false,
    no_snapshot_save: false,
    snapshot: undefined,
    wipe_data: false,
    read_only: false,
    writable_system: false,
    selinux: "",
    memory_mb: undefined,
    cores: undefined,

    // Display
    no_window: false,
    scale: "",
    dpi_device: "",
    skin: "",
    screen_mode: "",
    no_passive_gps: false,

    // Graphics
    gpu: "host",
    feature: "ForceANGLE,ForceGpuHost,-ForceSwiftshader,-ForceLavapipe",
    accel: "auto",
    no_accel: false,

    // Audio & Media
    no_audio: false,
    camera_back: "emulated",
    camera_front: "emulated",

    // Network
    netdelay: "none",
    netspeed: "full",
    http_proxy: "",
    dns_servers: "",
    tcpdump_path: "",
    port: undefined,
    ports: "",

    // Debug
    show_kernel: false,
    verbose: false,
    debug_tags: "",
    logcat_tags: "",
    trace_name: "",
    timezone: "",
    extra_args: "",

    ...initialOptions,
  });

  // Generate live CLI command string
  const cliPreview = useMemo(() => {
    const parts = ["emulator", "-avd", options.name];
    if (options.no_boot_anim) parts.push("-no-boot-anim");
    if (options.no_snapshot) parts.push("-no-snapshot");
    if (options.no_snapshot_load) parts.push("-no-snapshot-load");
    if (options.no_snapshot_save) parts.push("-no-snapshot-save");
    if (options.snapshot) parts.push(`-snapshot ${options.snapshot}`);
    if (options.wipe_data) parts.push("-wipe-data");
    if (options.read_only) parts.push("-read-only");
    if (options.writable_system) parts.push("-writable-system");
    if (options.selinux) parts.push(`-selinux ${options.selinux}`);
    if (options.memory_mb) parts.push(`-memory ${options.memory_mb}`);
    if (options.cores) parts.push(`-cores ${options.cores}`);
    if (options.no_window) parts.push("-no-window");
    if (options.scale) parts.push(`-scale ${options.scale}`);
    if (options.dpi_device) parts.push(`-dpi-device ${options.dpi_device}`);
    if (options.skin) parts.push(`-skin ${options.skin}`);
    if (options.screen_mode) parts.push(`-screen ${options.screen_mode}`);
    if (options.no_passive_gps) parts.push("-no-passive-gps");
    if (options.gpu && options.gpu !== "default") parts.push(`-gpu ${options.gpu}`);
    if (options.feature) parts.push(`-feature ${options.feature}`);
    if (options.no_accel) parts.push("-no-accel");
    else if (options.accel && options.accel !== "auto") parts.push(`-accel ${options.accel}`);
    if (options.no_audio) parts.push("-no-audio");
    if (options.camera_back) parts.push(`-camera-back ${options.camera_back}`);
    if (options.camera_front) parts.push(`-camera-front ${options.camera_front}`);
    if (options.netdelay && options.netdelay !== "none") parts.push(`-netdelay ${options.netdelay}`);
    if (options.netspeed && options.netspeed !== "full") parts.push(`-netspeed ${options.netspeed}`);
    if (options.http_proxy) parts.push(`-http-proxy ${options.http_proxy}`);
    if (options.dns_servers) parts.push(`-dns-server ${options.dns_servers}`);
    if (options.tcpdump_path) parts.push(`-tcpdump ${options.tcpdump_path}`);
    if (options.port) parts.push(`-port ${options.port}`);
    if (options.ports) parts.push(`-ports ${options.ports}`);
    if (options.show_kernel) parts.push("-show-kernel");
    if (options.verbose) parts.push("-verbose");
    if (options.debug_tags) parts.push(`-debug ${options.debug_tags}`);
    if (options.timezone) parts.push(`-timezone ${options.timezone}`);
    if (options.extra_args) parts.push(options.extra_args);
    return parts.join(" ");
  }, [options]);

  const handleLaunch = () => {
    onLaunch(options);
    onClose();
  };

  const handlePresetSelect = (presetKey: string) => {
    setActivePresetId(presetKey);

    const builtin = BUILTIN_LAUNCH_PRESETS.find((p) => p.id === presetKey);
    if (builtin) {
      setOptions((prev) => ({
        ...prev,
        ...builtin.options,
        name: avd.name,
      }));
      toast.info(`Applied preset: ${builtin.name}`);
      return;
    }

    const custom = customProfiles[presetKey];
    if (custom) {
      setOptions({
        ...custom,
        name: avd.name,
      });
      toast.info(`Applied custom preset: ${presetKey}`);
    }
  };

  const handleSaveCurrentPreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }
    const name = newPresetName.trim();
    onSaveProfile(name, options);
    setNewPresetName("");
    setIsSavePromptOpen(false);
    setActivePresetId(name);
    toast.success(`Preset '${name}' saved successfully!`);
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliPreview);
    toast.success("Emulator command copied to clipboard!");
  };

  const handleExportPresets = () => {
    const dataStr = JSON.stringify(customProfiles, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "avd-launch-presets.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Launch presets exported to JSON!");
  };

  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (typeof imported === "object") {
          Object.entries(imported).forEach(([k, v]) => {
            onSaveProfile(k, v as StartOptions);
          });
          toast.success(`Imported ${Object.keys(imported).length} presets!`);
        }
      } catch (err) {
        toast.error("Failed to parse JSON preset file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
        {/* Header with Quick Preset Bar */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Sliders size={20} className="modal-icon" />
            <div>
              <h2>Launch Configuration</h2>
              <span className="modal-subtitle">
                Target: <b>{avd.display_name || avd.name}</b>
              </span>
            </div>
          </div>

          <div className="header-preset-bar">
            <Sparkles size={15} className="sparkle-icon" />
            <span className="preset-label">Preset:</span>
            <select
              className="preset-dropdown"
              value={activePresetId}
              onChange={(e) => handlePresetSelect(e.target.value)}
            >
              <optgroup label="Standard Templates">
                {BUILTIN_LAUNCH_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              {Object.keys(customProfiles).length > 0 && (
                <optgroup label="My Custom Presets">
                  {Object.keys(customProfiles).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsSavePromptOpen(!isSavePromptOpen)}
              title="Save current configuration as a new preset"
            >
              <Save size={14} />
              <span>Save Preset</span>
            </button>
          </div>

          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Save Preset Inline Prompt */}
        {isSavePromptOpen && (
          <div className="inline-preset-prompt">
            <div className="prompt-content">
              <Bookmark size={16} className="prompt-icon" />
              <span>Save current configuration as preset:</span>
              <input
                type="text"
                placeholder="Enter preset name (e.g. My Fast Rooted Test)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveCurrentPreset()}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={handleSaveCurrentPreset}>
                Save
              </button>
              <button
                className="btn btn-subtle btn-sm"
                onClick={() => setIsSavePromptOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="modal-body">
          {/* Navigation Sidebar */}
          <div className="category-sidebar">
            <button
              className={`cat-btn ${activeCategory === "boot" ? "active" : ""}`}
              onClick={() => setActiveCategory("boot")}
            >
              <Cpu size={16} />
              <span>Boot & System</span>
            </button>
            <button
              className={`cat-btn ${activeCategory === "display" ? "active" : ""}`}
              onClick={() => setActiveCategory("display")}
            >
              <Monitor size={16} />
              <span>Display & Window</span>
            </button>
            <button
              className={`cat-btn ${activeCategory === "graphics" ? "active" : ""}`}
              onClick={() => setActiveCategory("graphics")}
            >
              <Sliders size={16} />
              <span>GPU & Acceleration</span>
            </button>
            <button
              className={`cat-btn ${activeCategory === "audio" ? "active" : ""}`}
              onClick={() => setActiveCategory("audio")}
            >
              <Volume2 size={16} />
              <span>Audio & Media</span>
            </button>
            <button
              className={`cat-btn ${activeCategory === "network" ? "active" : ""}`}
              onClick={() => setActiveCategory("network")}
            >
              <Wifi size={16} />
              <span>Network & Emulation</span>
            </button>
            <button
              className={`cat-btn ${activeCategory === "debug" ? "active" : ""}`}
              onClick={() => setActiveCategory("debug")}
            >
              <Bug size={16} />
              <span>Debug & Custom Flags</span>
            </button>
            <button
              className={`cat-btn ${activeCategory === "profiles" ? "active" : ""}`}
              onClick={() => setActiveCategory("profiles")}
            >
              <Bookmark size={16} />
              <span>Manage Presets ({Object.keys(customProfiles).length})</span>
            </button>
          </div>

          {/* Options Content Area */}
          <div className="category-content">
            {/* Boot & System */}
            {activeCategory === "boot" && (
              <div className="options-section">
                <h3>Boot & Lifecycle Parameters</h3>

                <div className="checkbox-grid">
                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.no_boot_anim}
                      onChange={(e) => setOptions({ ...options, no_boot_anim: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-no-boot-anim</span>
                      <span className="chk-desc">Bypass Android boot animation for faster startup</span>
                    </div>
                  </label>

                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.writable_system}
                      onChange={(e) => setOptions({ ...options, writable_system: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-writable-system</span>
                      <span className="chk-desc">Allow system partition remount for Root & testing</span>
                    </div>
                  </label>

                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.no_snapshot}
                      onChange={(e) => setOptions({ ...options, no_snapshot: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-no-snapshot</span>
                      <span className="chk-desc">Perform full cold boot (no load, no save)</span>
                    </div>
                  </label>

                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.no_snapshot_load}
                      onChange={(e) => setOptions({ ...options, no_snapshot_load: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-no-snapshot-load</span>
                      <span className="chk-desc">Do not load snapshot, but save on exit</span>
                    </div>
                  </label>

                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.no_snapshot_save}
                      onChange={(e) => setOptions({ ...options, no_snapshot_save: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-no-snapshot-save</span>
                      <span className="chk-desc">Do not save snapshot upon closing emulator</span>
                    </div>
                  </label>

                  <label className="checkbox-card danger-card">
                    <input
                      type="checkbox"
                      checked={options.wipe_data}
                      onChange={(e) => setOptions({ ...options, wipe_data: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-wipe-data</span>
                      <span className="chk-desc">Factory reset: wipes user data partition</span>
                    </div>
                  </label>

                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.read_only}
                      onChange={(e) => setOptions({ ...options, read_only: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-read-only</span>
                      <span className="chk-desc">Run emulator in read-only mode (discard changes)</span>
                    </div>
                  </label>
                </div>

                <div className="form-row mt-3">
                  <div className="form-group">
                    <label>Specific Snapshot to Load</label>
                    <input
                      type="text"
                      placeholder="e.g. default_boot or custom snapshot name"
                      value={options.snapshot || ""}
                      onChange={(e) => setOptions({ ...options, snapshot: e.target.value || undefined })}
                    />
                  </div>

                  <div className="form-group">
                    <label>SELinux Mode</label>
                    <select
                      value={options.selinux || ""}
                      onChange={(e) => setOptions({ ...options, selinux: e.target.value || undefined })}
                    >
                      <option value="">Default (From image)</option>
                      <option value="permissive">Permissive (-selinux permissive)</option>
                      <option value="enforcing">Enforcing (-selinux enforcing)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Physical RAM Override (MB)</label>
                    <input
                      type="number"
                      placeholder="e.g. 4096 (leave empty for config.ini default)"
                      value={options.memory_mb || ""}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          memory_mb: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>CPU Cores Override</label>
                    <input
                      type="number"
                      placeholder="e.g. 4 (leave empty for default)"
                      value={options.cores || ""}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          cores: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Display & Window */}
            {activeCategory === "display" && (
              <div className="options-section">
                <h3>Display, Scaling & Window Controls</h3>

                <div className="checkbox-grid">
                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.no_window}
                      onChange={(e) => setOptions({ ...options, no_window: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-no-window (Headless Mode)</span>
                      <span className="chk-desc">Run emulator in background without GUI window (ideal for CI)</span>
                    </div>
                  </label>

                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.no_passive_gps}
                      onChange={(e) => setOptions({ ...options, no_passive_gps: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-no-passive-gps</span>
                      <span className="chk-desc">Disable passive GPS updates</span>
                    </div>
                  </label>
                </div>

                <div className="form-row mt-3">
                  <div className="form-group">
                    <label>Window Display Scale (-scale)</label>
                    <select
                      value={options.scale || ""}
                      onChange={(e) => setOptions({ ...options, scale: e.target.value || undefined })}
                    >
                      <option value="">Default (Auto / 1.0)</option>
                      <option value="0.5">50% (0.5)</option>
                      <option value="0.75">75% (0.75)</option>
                      <option value="1.0">100% (1.0)</option>
                      <option value="1.25">125% (1.25)</option>
                      <option value="1.5">150% (1.5)</option>
                      <option value="2.0">200% (2.0)</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Device DPI Density Override (-dpi-device)</label>
                    <input
                      type="text"
                      placeholder="e.g. 240, 320, 420, 480, 560"
                      value={options.dpi_device || ""}
                      onChange={(e) => setOptions({ ...options, dpi_device: e.target.value || undefined })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Custom Skin / Resolution (-skin)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1080x2400 or pixel_7"
                      value={options.skin || ""}
                      onChange={(e) => setOptions({ ...options, skin: e.target.value || undefined })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Touch Screen Mode (-screen)</label>
                    <select
                      value={options.screen_mode || ""}
                      onChange={(e) => setOptions({ ...options, screen_mode: e.target.value || undefined })}
                    >
                      <option value="">Default (multi-touch)</option>
                      <option value="multi-touch">Multi-touch</option>
                      <option value="touch">Single Touch</option>
                      <option value="no-touch">No Touch</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Graphics & Acceleration */}
            {activeCategory === "graphics" && (
              <div className="options-section">
                <h3>GPU Rendering & Hardware Acceleration</h3>

                <div className="form-group">
                  <label>GPU Rendering Mode (-gpu)</label>
                  <select
                    value={options.gpu || "host"}
                    onChange={(e) => setOptions({ ...options, gpu: e.target.value })}
                  >
                    <option value="host">Host (Direct GPU Hardware Acceleration - Recommended)</option>
                    <option value="swiftshader_indirect">
                      SwiftShader (Software CPU Rendering - Safe Fallback)
                    </option>
                    <option value="angle_indirect">ANGLE (Direct3D 11 Translation on Windows)</option>
                    <option value="guest">Guest (Guest Emulated GPU)</option>
                    <option value="auto">Auto (Let Emulator Choose)</option>
                    <option value="off">Off (Disable GPU)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Feature Flags (-feature)
                    <span className="field-hint">Comma-separated flags (+/-)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ForceANGLE,ForceGpuHost,-ForceSwiftshader,-ForceLavapipe"
                    value={options.feature || ""}
                    onChange={(e) => setOptions({ ...options, feature: e.target.value || undefined })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Hypervisor Acceleration (-accel)</label>
                    <select
                      value={options.accel || "auto"}
                      onChange={(e) => setOptions({ ...options, accel: e.target.value })}
                    >
                      <option value="auto">Auto (WHPX / Hyper-V / HAXM / KVM)</option>
                      <option value="on">Force On</option>
                      <option value="off">Force Off</option>
                    </select>
                  </div>

                  <div className="form-group flex-center-group">
                    <label className="checkbox-card mt-2">
                      <input
                        type="checkbox"
                        checked={options.no_accel}
                        onChange={(e) => setOptions({ ...options, no_accel: e.target.checked })}
                      />
                      <div>
                        <span className="chk-title">-no-accel</span>
                        <span className="chk-desc">Disable hardware virtualization</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Audio & Media */}
            {activeCategory === "audio" && (
              <div className="options-section">
                <h3>Audio & Camera Emulation</h3>

                <div className="checkbox-grid">
                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.no_audio}
                      onChange={(e) => setOptions({ ...options, no_audio: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-no-audio</span>
                      <span className="chk-desc">Disable all audio input and output</span>
                    </div>
                  </label>
                </div>

                <div className="form-row mt-3">
                  <div className="form-group">
                    <label>Back Camera Mode (-camera-back)</label>
                    <select
                      value={options.camera_back || "emulated"}
                      onChange={(e) => setOptions({ ...options, camera_back: e.target.value || undefined })}
                    >
                      <option value="emulated">Emulated (Virtual Moving Scene)</option>
                      <option value="webcam0">Host Webcam (webcam0)</option>
                      <option value="none">Disabled (none)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Front Camera Mode (-camera-front)</label>
                    <select
                      value={options.camera_front || "emulated"}
                      onChange={(e) => setOptions({ ...options, camera_front: e.target.value || undefined })}
                    >
                      <option value="emulated">Emulated (Virtual Moving Scene)</option>
                      <option value="webcam0">Host Webcam (webcam0)</option>
                      <option value="none">Disabled (none)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Network & Emulation */}
            {activeCategory === "network" && (
              <div className="options-section">
                <h3>Network Latency, Speed & Proxy</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Network Latency Profile (-netdelay)</label>
                    <select
                      value={options.netdelay || "none"}
                      onChange={(e) => setOptions({ ...options, netdelay: e.target.value })}
                    >
                      <option value="none">None (Zero additional latency)</option>
                      <option value="lte">LTE (20ms - 80ms latency)</option>
                      <option value="umts">UMTS / 3G (35ms - 200ms latency)</option>
                      <option value="edge">EDGE / 2G (300ms - 2000ms latency)</option>
                      <option value="gprs">GPRS (500ms - 3000ms latency)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Network Speed Profile (-netspeed)</label>
                    <select
                      value={options.netspeed || "full"}
                      onChange={(e) => setOptions({ ...options, netspeed: e.target.value })}
                    >
                      <option value="full">Full (Unlimited host bandwidth)</option>
                      <option value="lte">LTE (50 Mbps down / 20 Mbps up)</option>
                      <option value="hsdpa">HSDPA (14.4 Mbps down / 5.7 Mbps up)</option>
                      <option value="umts">UMTS (384 Kbps down / 384 Kbps up)</option>
                      <option value="edge">EDGE (236 Kbps down / 118 Kbps up)</option>
                      <option value="gprs">GPRS (80 Kbps down / 40 Kbps up)</option>
                      <option value="gsm">GSM (14.4 Kbps down / 14.4 Kbps up)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>HTTP Proxy (-http-proxy)</label>
                    <input
                      type="text"
                      placeholder="e.g. http://127.0.0.1:8888 or proxy.domain:8080"
                      value={options.http_proxy || ""}
                      onChange={(e) => setOptions({ ...options, http_proxy: e.target.value || undefined })}
                    />
                  </div>

                  <div className="form-group">
                    <label>DNS Servers (-dns-server)</label>
                    <input
                      type="text"
                      placeholder="e.g. 8.8.8.8,1.1.1.1"
                      value={options.dns_servers || ""}
                      onChange={(e) => setOptions({ ...options, dns_servers: e.target.value || undefined })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Packet Capture PCAP File (-tcpdump)</label>
                    <input
                      type="text"
                      placeholder="e.g. C:\temp\network.pcap"
                      value={options.tcpdump_path || ""}
                      onChange={(e) => setOptions({ ...options, tcpdump_path: e.target.value || undefined })}
                    />
                  </div>

                  <div className="form-group">
                    <label>TCP Console Port (-port)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5554 (must be even between 5554-5584)"
                      value={options.port || ""}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          port: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Debug & Custom Flags */}
            {activeCategory === "debug" && (
              <div className="options-section">
                <h3>Debugging, Kernel & Raw Flags</h3>

                <div className="checkbox-grid">
                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.show_kernel}
                      onChange={(e) => setOptions({ ...options, show_kernel: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-show-kernel</span>
                      <span className="chk-desc">Stream raw Linux kernel log output</span>
                    </div>
                  </label>

                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={options.verbose}
                      onChange={(e) => setOptions({ ...options, verbose: e.target.checked })}
                    />
                    <div>
                      <span className="chk-title">-verbose</span>
                      <span className="chk-desc">Print detailed emulator debug output</span>
                    </div>
                  </label>
                </div>

                <div className="form-row mt-3">
                  <div className="form-group">
                    <label>Debug Tags (-debug)</label>
                    <input
                      type="text"
                      placeholder="e.g. init,console,avd_config or -debug-all"
                      value={options.debug_tags || ""}
                      onChange={(e) => setOptions({ ...options, debug_tags: e.target.value || undefined })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Timezone Override (-timezone)</label>
                    <input
                      type="text"
                      placeholder="e.g. America/New_York, Europe/London, Asia/Tokyo"
                      value={options.timezone || ""}
                      onChange={(e) => setOptions({ ...options, timezone: e.target.value || undefined })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Custom Extra Arguments
                    <span className="field-hint">
                      Appended directly to emulator command line (e.g. -qemu -s)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. -grpc 8554 -logcat *:E"
                    value={options.extra_args || ""}
                    onChange={(e) => setOptions({ ...options, extra_args: e.target.value || undefined })}
                  />
                </div>
              </div>
            )}

            {/* Presets Management View */}
            {activeCategory === "profiles" && (
              <div className="options-section">
                <div className="presets-manage-header">
                  <div>
                    <h3>Saved Custom Presets</h3>
                    <p className="section-desc">
                      Manage, export and import your custom emulator startup configurations.
                    </p>
                  </div>

                  <div className="import-export-actions">
                    <label className="btn btn-secondary btn-sm file-upload-label">
                      <Upload size={14} />
                      <span>Import JSON</span>
                      <input
                        type="file"
                        accept=".json"
                        style={{ display: "none" }}
                        onChange={handleImportPresets}
                      />
                    </label>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleExportPresets}
                      disabled={Object.keys(customProfiles).length === 0}
                    >
                      <Download size={14} />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>

                <div className="profiles-list mt-3">
                  {Object.keys(customProfiles).length === 0 ? (
                    <div className="empty-hint">
                      No custom presets saved yet. Configure your flags and click "Save Preset" above!
                    </div>
                  ) : (
                    Object.entries(customProfiles).map(([name, prof]) => (
                      <div key={name} className="profile-item-card">
                        <div className="profile-info">
                          <div className="profile-name-row">
                            <Bookmark size={15} className="profile-icon" />
                            <b>{name}</b>
                          </div>
                          <div className="profile-tags">
                            {prof.writable_system && <span className="tag">Writable</span>}
                            {prof.no_boot_anim && <span className="tag">NoBootAnim</span>}
                            {prof.gpu && <span className="tag">GPU: {prof.gpu}</span>}
                            {prof.no_window && <span className="tag">Headless</span>}
                            {prof.memory_mb && <span className="tag">{prof.memory_mb}MB RAM</span>}
                            {prof.netdelay && prof.netdelay !== "none" && (
                              <span className="tag">Net: {prof.netdelay}</span>
                            )}
                          </div>
                        </div>

                        <div className="profile-actions">
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handlePresetSelect(name)}
                          >
                            Load
                          </button>
                          <button
                            className="icon-btn btn-danger-icon"
                            onClick={() => {
                              onDeleteProfile(name);
                              toast.info(`Deleted preset '${name}'`);
                            }}
                            title="Delete Preset"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Command Line Preview & Footer */}
        <div className="modal-footer-advanced">
          <div className="cli-command-preview">
            <Terminal size={14} className="terminal-icon" />
            <code className="command-text">{cliPreview}</code>
            <button className="icon-btn btn-sm" onClick={handleCopyCli} title="Copy CLI Command">
              <Copy size={13} />
            </button>
          </div>

          <div className="modal-actions-row">
            <button className="btn btn-subtle" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleLaunch}>
              <Play size={16} />
              <span>Launch Emulator</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
