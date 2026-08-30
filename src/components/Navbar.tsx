import React from "react";
import {
  Smartphone,
  Terminal,
  Settings as SettingsIcon,
  RotateCw,
  Sun,
  Moon,
  Shield,
  Activity,
  Check,
  Info,
} from "lucide-react";
import { SdkPaths } from "../types";

export type ActiveTab = "avds" | "devices" | "logcat" | "output" | "settings" | "about";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  sdk: SdkPaths | null;
  runningCount: number;
  activeSerial: string;
  theme: "dark" | "light";
  toggleTheme: () => void;
  onRefreshAll: () => void;
  refreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  sdk,
  runningCount,
  activeSerial,
  theme,
  toggleTheme,
  onRefreshAll,
  refreshing,
}) => {
  return (
    <header className="navbar">
      <div className="navbar-brand" onClick={() => setActiveTab("about")} style={{ cursor: "pointer" }}>
        <div className="brand-icon-logo">
          <img src="/logo.png" alt="AVD Launcher Pro Logo" className="navbar-logo-img" />
        </div>
        <div className="brand-text">
          <span className="brand-title">AVD Launcher Pro</span>
          <span className="brand-badge">PRO STUDIO</span>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === "avds" ? "active" : ""}`}
          onClick={() => setActiveTab("avds")}
        >
          <Smartphone size={16} />
          <span>AVD Manager</span>
          {runningCount > 0 && (
            <span className="tab-pill running-pill">{runningCount}</span>
          )}
        </button>

        <button
          className={`nav-tab ${activeTab === "devices" ? "active" : ""}`}
          onClick={() => setActiveTab("devices")}
        >
          <Shield size={16} />
          <span>Device Controls</span>
          {activeSerial && <span className="tab-pill online-pill">ADB</span>}
        </button>

        <button
          className={`nav-tab ${activeTab === "logcat" ? "active" : ""}`}
          onClick={() => setActiveTab("logcat")}
        >
          <Terminal size={16} />
          <span>Logcat</span>
        </button>

        <button
          className={`nav-tab ${activeTab === "output" ? "active" : ""}`}
          onClick={() => setActiveTab("output")}
        >
          <Activity size={16} />
          <span>Process Logs</span>
        </button>

        <button
          className={`nav-tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <SettingsIcon size={16} />
          <span>Settings</span>
        </button>

        <button
          className={`nav-tab ${activeTab === "about" ? "active" : ""}`}
          onClick={() => setActiveTab("about")}
        >
          <Info size={16} />
          <span>About</span>
        </button>
      </nav>

      <div className="navbar-actions">
        {sdk && (
          <div className="sdk-status-pill" title={`SDK: ${sdk.sdk_root}\nAVD Home: ${sdk.avd_home}`}>
            <Check size={12} />
            <span>SDK Ready</span>
          </div>
        )}

        <button
          className="icon-btn refresh-btn"
          onClick={onRefreshAll}
          title="Refresh AVDs & ADB Devices (Ctrl+R)"
        >
          <RotateCw size={16} className={refreshing ? "spin" : ""} />
        </button>

        <button
          className="icon-btn theme-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
};
