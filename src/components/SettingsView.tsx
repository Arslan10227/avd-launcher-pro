import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Save,
  FolderSearch,
  CheckCircle,
  AlertCircle,
  Monitor,
  Folder,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings, SdkPaths } from "../types";

interface SettingsViewProps {
  settings: AppSettings;
  sdk: SdkPaths | null;
  onSaveSettings: (newSettings: AppSettings) => Promise<void>;
  onDetectSdk: () => Promise<SdkPaths>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  sdk,
  onSaveSettings,
  onDetectSdk,
}) => {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      await onSaveSettings(form);
      setStatusMessage({ type: "success", text: "Settings saved successfully." });
    } catch (e) {
      setStatusMessage({ type: "error", text: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleDetect = async () => {
    setStatusMessage(null);
    try {
      const detected = await onDetectSdk();
      setStatusMessage({
        type: "success",
        text: `SDK detected successfully!\nSDK Root: ${detected.sdk_root}\nAVD Home: ${detected.avd_home}`,
      });
    } catch (e) {
      setStatusMessage({ type: "error", text: `SDK Detection failed: ${e}` });
    }
  };

  const handleBrowseSdkRoot = async () => {
    try {
      const path = await invoke<string | null>("pick_folder");
      if (path) {
        setForm({ ...form, sdk_root: path });
      }
    } catch (e) {
      console.error("Folder picker error", e);
    }
  };

  const handleBrowseAvdHome = async () => {
    try {
      const path = await invoke<string | null>("pick_folder");
      if (path) {
        setForm({ ...form, avd_home: path });
      }
    } catch (e) {
      console.error("Folder picker error", e);
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <div className="title-group">
          <SettingsIcon size={22} />
          <div>
            <h2>Application & Environment Settings</h2>
            <span className="subtitle">Configure Android SDK paths, default emulator flags, and themes</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`status-banner ${statusMessage.type}`}>
          {statusMessage.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span style={{ whiteSpace: "pre-line" }}>{statusMessage.text}</span>
        </div>
      )}

      <div className="settings-grid">
        {/* Environment Paths Card */}
        <div className="settings-card">
          <div className="card-header">
            <FolderSearch size={18} />
            <h3>Android SDK & AVD Paths</h3>
          </div>

          <div className="form-group">
            <label>
              Android SDK Root Override
              <span className="field-hint">Leave blank for auto-detection</span>
            </label>
            <div className="input-with-browse">
              <input
                type="text"
                placeholder="e.g. C:\Users\<User>\AppData\Local\Android\Sdk"
                value={form.sdk_root || ""}
                onChange={(e) => setForm({ ...form, sdk_root: e.target.value || undefined })}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleBrowseSdkRoot}
                title="Choose SDK Folder"
              >
                <Folder size={14} />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>
              AVD Storage Home Override (ANDROID_AVD_HOME)
              <span className="field-hint">Leave blank for default (~/.android/avd)</span>
            </label>
            <div className="input-with-browse">
              <input
                type="text"
                placeholder="e.g. C:\Users\<User>\.android\avd"
                value={form.avd_home || ""}
                onChange={(e) => setForm({ ...form, avd_home: e.target.value || undefined })}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleBrowseAvdHome}
                title="Choose AVD Folder"
              >
                <Folder size={14} />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          <div className="card-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleDetect}>
              <FolderSearch size={14} />
              <span>Auto-Detect Environment</span>
            </button>
          </div>

          {sdk && (
            <div className="detected-paths-box">
              <h4>Currently Active Paths</h4>
              <div className="path-item">
                <b>SDK Root:</b> <code>{sdk.sdk_root}</code>
              </div>
              <div className="path-item">
                <b>AVD Home:</b> <code>{sdk.avd_home}</code>
              </div>
              <div className="path-item">
                <b>Emulator:</b> <code>{sdk.emulator}</code>
              </div>
              <div className="path-item">
                <b>ADB:</b> <code>{sdk.adb}</code>
              </div>
            </div>
          )}
        </div>

        {/* Global Default Options */}
        <div className="settings-card">
          <div className="card-header">
            <Monitor size={18} />
            <h3>Default Emulator Preferences</h3>
          </div>

          <div className="form-group">
            <label>Default GPU Acceleration Mode</label>
            <select
              value={form.default_gpu || "host"}
              onChange={(e) => setForm({ ...form, default_gpu: e.target.value })}
            >
              <option value="host">Host (Direct GPU Hardware Acceleration)</option>
              <option value="swiftshader_indirect">SwiftShader (CPU Software Rendering)</option>
              <option value="angle_indirect">ANGLE (Direct3D 11 Translation)</option>
              <option value="guest">Guest (Guest Emulated GPU)</option>
              <option value="auto">Auto (Let Emulator Decide)</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Default Feature Flags
              <span className="field-hint">Comma-separated flags (+/-)</span>
            </label>
            <input
              type="text"
              placeholder="ForceANGLE,ForceGpuHost,-ForceSwiftshader"
              value={form.default_features || ""}
              onChange={(e) => setForm({ ...form, default_features: e.target.value || undefined })}
            />
          </div>

          <div className="form-group">
            <label>Interface Theme</label>
            <select
              value={form.theme || "dark"}
              onChange={(e) => setForm({ ...form, theme: e.target.value as "dark" | "light" | "system" })}
            >
              <option value="dark">Dark Theme (Default)</option>
              <option value="light">Light Theme</option>
              <option value="system">System Default</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          <span>{saving ? "Saving..." : "Save Settings"}</span>
        </button>
      </div>
    </div>
  );
};
