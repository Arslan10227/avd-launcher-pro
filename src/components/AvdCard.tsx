import React, { useState } from "react";
import {
  Play,
  Square,
  Sliders,
  FileEdit,
  Zap,
  Shield,
  Layers,
  Cpu,
  Monitor,
  HardDrive,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Avd, BUILTIN_LAUNCH_PRESETS, StartOptions } from "../types";

interface AvdCardProps {
  avd: Avd;
  onQuickStart: (avd: Avd) => void;
  onOpenLaunchModal: (avd: Avd) => void;
  onQuickColdBoot: (avd: Avd) => void;
  onQuickRooted: (avd: Avd) => void;
  onStop: (avd: Avd) => void;
  onOpenConfigEditor: (avd: Avd) => void;
  onLaunchWithPreset: (avd: Avd, options: Partial<StartOptions>) => void;
  customProfiles: Record<string, StartOptions>;
}

export const AvdCard: React.FC<AvdCardProps> = ({
  avd,
  onQuickStart,
  onOpenLaunchModal,
  onQuickColdBoot,
  onQuickRooted,
  onStop,
  onOpenConfigEditor,
  onLaunchWithPreset,
  customProfiles,
}) => {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const ramSize = avd.config["hw.ramSize"] || "—";
  const cpuCores = avd.config["hw.cpu.ncore"] || "—";

  return (
    <div className={`avd-card-pro ${avd.is_running ? "is-running" : ""}`}>
      <div className="avd-card-header">
        <div className="avd-title-group">
          <div className="avd-icon-badge">
            <Monitor size={18} />
          </div>
          <div>
            <h3 className="avd-name">{avd.display_name || avd.name}</h3>
            <span className="avd-system-tag">
              {avd.name !== (avd.display_name || avd.name) && (
                <span className="avd-internal-name">[{avd.name}]</span>
              )}
            </span>
          </div>
        </div>

        <div className="avd-status-badge">
          {avd.is_running ? (
            <span className="badge running">
              <span className="pulse-dot"></span>
              Running {avd.serial ? `(${avd.serial})` : ""}
            </span>
          ) : (
            <span className="badge offline">Offline</span>
          )}
        </div>
      </div>

      <div className="avd-meta-grid">
        <div className="meta-item">
          <Layers size={13} />
          <span className="meta-label">Target:</span>
          <span className="meta-value">{avd.api_level || avd.target || "Android"}</span>
        </div>
        <div className="meta-item">
          <Monitor size={13} />
          <span className="meta-label">Screen:</span>
          <span className="meta-value">
            {avd.resolution || "Unknown"} @ {avd.dpi || "—"} DPI
          </span>
        </div>
        <div className="meta-item">
          <Cpu size={13} />
          <span className="meta-label">Hardware:</span>
          <span className="meta-value">
            {avd.abi || "x86_64"} • {cpuCores} Cores • {ramSize} MB RAM
          </span>
        </div>
        {avd.snapshots.length > 0 && (
          <div className="meta-item">
            <HardDrive size={13} />
            <span className="meta-label">Snapshots:</span>
            <span className="meta-value">{avd.snapshots.join(", ")}</span>
          </div>
        )}
      </div>

      <div className="avd-card-actions">
        {avd.is_running ? (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onStop(avd)}
            title="Stop Running Emulator"
          >
            <Square size={14} />
            <span>Stop</span>
          </button>
        ) : (
          <>
            <div className="split-btn-group">
              <button
                className="btn btn-primary btn-sm split-main"
                onClick={() => onQuickStart(avd)}
                title="Launch with Default Fast Options"
              >
                <Play size={14} />
                <span>Start</span>
              </button>
              <button
                className="btn btn-primary btn-sm split-arrow"
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                title="Quick Launch with Preset"
              >
                <ChevronDown size={12} />
              </button>

              {showPresetMenu && (
                <div className="preset-dropdown-menu" onMouseLeave={() => setShowPresetMenu(false)}>
                  <div className="dropdown-section-title">
                    <Sparkles size={12} />
                    <span>Launch with Preset</span>
                  </div>
                  {BUILTIN_LAUNCH_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      className="dropdown-item"
                      onClick={() => {
                        onLaunchWithPreset(avd, p.options);
                        setShowPresetMenu(false);
                      }}
                    >
                      <b>{p.name}</b>
                      <span className="item-desc">{p.description}</span>
                    </button>
                  ))}

                  {Object.keys(customProfiles).length > 0 && (
                    <>
                      <div className="dropdown-divider" />
                      <div className="dropdown-section-title">Custom Presets</div>
                      {Object.entries(customProfiles).map(([name, prof]) => (
                        <button
                          key={name}
                          className="dropdown-item"
                          onClick={() => {
                            onLaunchWithPreset(avd, prof);
                            setShowPresetMenu(false);
                          }}
                        >
                          <b>{name}</b>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onOpenLaunchModal(avd)}
              title="Configure all emulator options before launching"
            >
              <Sliders size={14} />
              <span>Options...</span>
            </button>

            <button
              className="btn btn-subtle btn-sm"
              onClick={() => onQuickColdBoot(avd)}
              title="Cold Boot (Bypass Snapshot)"
            >
              <Zap size={14} />
              <span>Cold</span>
            </button>

            <button
              className="btn btn-subtle btn-sm"
              onClick={() => onQuickRooted(avd)}
              title="Launch with -writable-system for Root"
            >
              <Shield size={14} />
              <span>Writable</span>
            </button>
          </>
        )}

        <button
          className="btn btn-subtle btn-sm"
          onClick={() => onOpenConfigEditor(avd)}
          title="Edit AVD config.ini & Hardware Profiles"
        >
          <FileEdit size={14} />
          <span>Config</span>
        </button>
      </div>
    </div>
  );
};
