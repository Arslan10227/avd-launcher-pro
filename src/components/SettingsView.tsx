import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Save,
  FolderSearch,
  CheckCircle,
  AlertCircle,
  Monitor,
} from "lucide-react";
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
            <input
              type="text"
              placeholder="e.g. C:\Users\<User>\AppData\Local\Android\Sdk"
              value={form.sdk_root || ""}
              onChange={(e) => setForm({ ...form, sdk_root: e.target.value || undefined })}
            />
          </div>

          <div className="form-group">
            <label>
              AVD Home Directory Override
              <span className="field-hint">Leave blank for auto-detection (.android\avd)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. C:\Users\<User>\.android\avd"
              value={form.avd_home || ""}
              onChange={(e) => setForm({ ...form, avd_home: e.target.value || undefined })}
            />
          </div>

          {sdk && (
            <div className="detected-paths-box">
              <h4>Currently Active Paths:</h4>
              <div className="path-row">
                <span className="path-label">SDK Root:</span>
                <code>{sdk.sdk_root}</code>
              </div>
              <div className="path-row">
                <span className="path-label">AVD Home:</span>
                <code>{sdk.avd_home}</code>
              </div>
              <div className="path-row">
                <span className="path-label">Emulator Binary:</span>
                <code>{sdk.emulator}</code>
              </div>
              <div className="path-row">
                <span className="path-label">ADB Binary:</span>
                <code>{sdk.adb}</code>
              </div>
            </div>
          )}

          <button className="btn btn-secondary mt-2" onClick={handleDetect}>
            Test & Detect Paths
          </button>
        </div>

        {/* Emulator Launch Defaults */}
        <div className="settings-card">
          <div className="card-header">
            <Monitor size={18} />
            <h3>Emulator Launch Defaults</h3>
          </div>

          <div className="form-group">
            <label>Default GPU Acceleration Mode</label>
            <select
              value={form.default_gpu || "host"}
              onChange={(e) => setForm({ ...form, default_gpu: e.target.value })}
            >
              <option value="host">Host (Direct GPU - Fastest)</option>
              <option value="swiftshader_indirect">SwiftShader (Software CPU)</option>
              <option value="angle_indirect">ANGLE (Direct3D Translation)</option>
              <option value="guest">Guest</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          <div className="form-group">
            <label>Default Feature Flags</label>
            <input
              type="text"
              value={form.default_features || ""}
              onChange={(e) => setForm({ ...form, default_features: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Logcat Max Buffer Lines</label>
            <select
              value={form.log_buffer_size || 1000}
              onChange={(e) =>
                setForm({ ...form, log_buffer_size: parseInt(e.target.value, 10) })
              }
            >
              <option value={500}>500 lines</option>
              <option value={1000}>1,000 lines</option>
              <option value={2000}>2,000 lines</option>
              <option value={5000}>5,000 lines</option>
            </select>
          </div>

          <div className="form-group">
            <label>ADB Devices Polling Interval (seconds)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={form.auto_refresh_interval_sec || 3}
              onChange={(e) =>
                setForm({
                  ...form,
                  auto_refresh_interval_sec: parseInt(e.target.value, 10) || 3,
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          <span>Save Settings</span>
        </button>
      </div>
    </div>
  );
};
