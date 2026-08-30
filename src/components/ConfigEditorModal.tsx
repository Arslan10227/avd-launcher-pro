import React, { useEffect, useState } from "react";
import {
  X,
  Save,
  RotateCcw,
  Sparkles,
  FileCode,
  Sliders,
  Plus,
  Trash2,
} from "lucide-react";
import { Avd, HARDWARE_PRESETS, PresetProfile } from "../types";
import { useToast } from "../context/ToastContext";

interface ConfigEditorModalProps {
  avd: Avd;
  onClose: () => void;
  onSaveConfig: (name: string, values: Record<string, string>) => Promise<void>;
  onRestoreBackup: (name: string) => Promise<void>;
  onReadRawConfig: (name: string) => Promise<string>;
  onWriteRawConfig: (name: string, content: string) => Promise<void>;
}

export const ConfigEditorModal: React.FC<ConfigEditorModalProps> = ({
  avd,
  onClose,
  onSaveConfig,
  onRestoreBackup,
  onReadRawConfig,
  onWriteRawConfig,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"visual" | "presets" | "raw">("visual");
  const [config, setConfig] = useState<Record<string, string>>({ ...avd.config });
  const [customPresets, setCustomPresets] = useState<PresetProfile[]>(() => {
    try {
      const saved = localStorage.getItem("avd_custom_hw_presets");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [showAddPresetForm, setShowAddPresetForm] = useState(false);

  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab === "raw") {
      loadRaw();
    }
  }, [activeTab]);

  const loadRaw = async () => {
    try {
      const text = await onReadRawConfig(avd.name);
      setRawText(text);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleApplyPreset = (preset: PresetProfile) => {
    setConfig((prev) => ({
      ...prev,
      ...preset.config,
    }));
    toast.success(`Applied '${preset.name}' hardware preset to form. Click 'Save Config' to commit.`);
  };

  const handleSaveVisual = async () => {
    setSaving(true);
    try {
      await onSaveConfig(avd.name, config);
      toast.success("AVD config.ini saved (backed up as config.ini.bak)!");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRaw = async () => {
    setSaving(true);
    try {
      await onWriteRawConfig(avd.name, rawText);
      toast.success("Raw config.ini saved successfully!");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm("Are you sure you want to restore config.ini from config.ini.bak?")) return;
    setSaving(true);
    try {
      await onRestoreBackup(avd.name);
      toast.success("Config restored from config.ini.bak!");
      if (activeTab === "raw") {
        await loadRaw();
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustomPreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    const newProfile: PresetProfile = {
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || "Custom user hardware profile",
      config: {
        "hw.lcd.width": config["hw.lcd.width"] || "1080",
        "hw.lcd.height": config["hw.lcd.height"] || "2400",
        "hw.lcd.density": config["hw.lcd.density"] || "420",
        "hw.ramSize": config["hw.ramSize"] || "4096",
        "vm.heapSize": config["vm.heapSize"] || "512",
        "hw.cpu.ncore": config["hw.cpu.ncore"] || "4",
        "hw.gpu.enabled": config["hw.gpu.enabled"] || "yes",
        "hw.gpu.mode": config["hw.gpu.mode"] || "host",
        "showDeviceFrame": config["showDeviceFrame"] || "no",
        "fastboot.forceFastBoot": config["fastboot.forceFastBoot"] || "yes",
      },
    };

    const updated = [...customPresets, newProfile];
    setCustomPresets(updated);
    localStorage.setItem("avd_custom_hw_presets", JSON.stringify(updated));
    setNewPresetName("");
    setNewPresetDesc("");
    setShowAddPresetForm(false);
    toast.success(`Custom preset '${newProfile.name}' created!`);
  };

  const handleDeleteCustomPreset = (index: number) => {
    const updated = customPresets.filter((_, i) => i !== index);
    setCustomPresets(updated);
    localStorage.setItem("avd_custom_hw_presets", JSON.stringify(updated));
    toast.info("Custom preset removed");
  };

  const updateKey = (key: string, val: string) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
  };

  const allPresets = [...HARDWARE_PRESETS, ...customPresets];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Sliders size={20} className="modal-icon" />
            <div>
              <h2>AVD Configuration Editor</h2>
              <span className="modal-subtitle">
                Editing: <b>{avd.display_name || avd.name}</b> (config.ini)
              </span>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-tabs-header">
          <button
            className={`tab-btn ${activeTab === "visual" ? "active" : ""}`}
            onClick={() => setActiveTab("visual")}
          >
            <Sliders size={15} />
            <span>Visual Form</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "presets" ? "active" : ""}`}
            onClick={() => setActiveTab("presets")}
          >
            <Sparkles size={15} />
            <span>Hardware Presets ({allPresets.length})</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "raw" ? "active" : ""}`}
            onClick={() => setActiveTab("raw")}
          >
            <FileCode size={15} />
            <span>Raw INI Text</span>
          </button>
        </div>

        <div className="modal-body-scrollable">
          {activeTab === "visual" && (
            <div className="form-sections">
              <div className="form-card">
                <h4>Display & Screen Geometry</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Width (px)</label>
                    <input
                      type="text"
                      value={config["hw.lcd.width"] || ""}
                      onChange={(e) => updateKey("hw.lcd.width", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Height (px)</label>
                    <input
                      type="text"
                      value={config["hw.lcd.height"] || ""}
                      onChange={(e) => updateKey("hw.lcd.height", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Density (DPI)</label>
                    <input
                      type="text"
                      value={config["hw.lcd.density"] || ""}
                      onChange={(e) => updateKey("hw.lcd.density", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Show Device Frame</label>
                    <select
                      value={config["showDeviceFrame"] || "no"}
                      onChange={(e) => updateKey("showDeviceFrame", e.target.value)}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No (Frameless / Faster)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Dynamic Skin</label>
                    <select
                      value={config["skin.dynamic"] || "no"}
                      onChange={(e) => updateKey("skin.dynamic", e.target.value)}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-card">
                <h4>Processor & Memory Specs</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>RAM Size (MB)</label>
                    <input
                      type="text"
                      value={config["hw.ramSize"] || ""}
                      onChange={(e) => updateKey("hw.ramSize", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>VM Heap Size (MB)</label>
                    <input
                      type="text"
                      value={config["vm.heapSize"] || ""}
                      onChange={(e) => updateKey("vm.heapSize", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>CPU Cores</label>
                    <input
                      type="text"
                      value={config["hw.cpu.ncore"] || ""}
                      onChange={(e) => updateKey("hw.cpu.ncore", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-card">
                <h4>Graphics & FastBoot Behavior</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Hardware GPU Enabled</label>
                    <select
                      value={config["hw.gpu.enabled"] || "yes"}
                      onChange={(e) => updateKey("hw.gpu.enabled", e.target.value)}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Default GPU Mode</label>
                    <select
                      value={config["hw.gpu.mode"] || "host"}
                      onChange={(e) => updateKey("hw.gpu.mode", e.target.value)}
                    >
                      <option value="host">Host</option>
                      <option value="swiftshader_indirect">SwiftShader</option>
                      <option value="angle_indirect">ANGLE</option>
                      <option value="guest">Guest</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Force FastBoot (Snapshot Boot)</label>
                    <select
                      value={config["fastboot.forceFastBoot"] || "yes"}
                      onChange={(e) => updateKey("fastboot.forceFastBoot", e.target.value)}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Force Cold Boot</label>
                    <select
                      value={config["fastboot.forceColdBoot"] || "no"}
                      onChange={(e) => updateKey("fastboot.forceColdBoot", e.target.value)}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "presets" && (
            <div className="presets-view">
              <div className="presets-top-bar">
                <p className="section-desc">
                  Apply pre-configured hardware specs or save your current values as a custom template:
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddPresetForm(!showAddPresetForm)}
                >
                  <Plus size={14} />
                  <span>Save Current as Preset</span>
                </button>
              </div>

              {showAddPresetForm && (
                <div className="add-hw-preset-card">
                  <h4>Create New Hardware Preset</h4>
                  <div className="form-row">
                    <input
                      type="text"
                      placeholder="Preset Name (e.g. My Ultra Wide Tablet)"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Description (e.g. 120Hz 1440p 8GB RAM)"
                      value={newPresetDesc}
                      onChange={(e) => setNewPresetDesc(e.target.value)}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleSaveCustomPreset}>
                      Save
                    </button>
                  </div>
                </div>
              )}

              <div className="presets-grid">
                {allPresets.map((preset, idx) => {
                  const isCustom = idx >= HARDWARE_PRESETS.length;
                  return (
                    <div key={preset.name} className="preset-card">
                      <div className="preset-header">
                        <h4>{preset.name}</h4>
                        <div className="preset-card-btns">
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleApplyPreset(preset)}
                          >
                            Apply
                          </button>
                          {isCustom && (
                            <button
                              className="icon-btn btn-danger-icon"
                              onClick={() =>
                                handleDeleteCustomPreset(idx - HARDWARE_PRESETS.length)
                              }
                              title="Delete custom preset"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="preset-desc">{preset.description}</p>
                      <div className="preset-tags">
                        {Object.entries(preset.config).map(([k, v]) => (
                          <span key={k} className="tag">
                            {k.replace("hw.", "")}: {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "raw" && (
            <div className="raw-editor-view">
              <p className="section-desc">
                Edit <code>config.ini</code> lines directly. Existing structure and custom properties are preserved.
              </p>
              <textarea
                className="raw-textarea"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={16}
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-subtle" onClick={handleRestore} disabled={saving}>
            <RotateCcw size={14} />
            <span>Restore Backup (.bak)</span>
          </button>

          <div className="footer-right">
            <button className="btn btn-subtle" onClick={onClose}>
              Close
            </button>
            {activeTab === "raw" ? (
              <button className="btn btn-primary" onClick={handleSaveRaw} disabled={saving}>
                <Save size={14} />
                <span>Save Raw INI</span>
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSaveVisual} disabled={saving}>
                <Save size={14} />
                <span>Save Config</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
