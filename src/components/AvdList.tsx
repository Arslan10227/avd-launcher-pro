import React, { useState } from "react";
import { Search, LayoutGrid, List, Smartphone } from "lucide-react";
import { Avd, StartOptions } from "../types";
import { AvdCard } from "./AvdCard";

interface AvdListProps {
  avds: Avd[];
  onQuickStart: (avd: Avd) => void;
  onOpenLaunchModal: (avd: Avd) => void;
  onQuickColdBoot: (avd: Avd) => void;
  onQuickRooted: (avd: Avd) => void;
  onStop: (avd: Avd) => void;
  onOpenConfigEditor: (avd: Avd) => void;
  onRefresh: () => void;
  onLaunchWithPreset: (avd: Avd, options: Partial<StartOptions>) => void;
  customProfiles: Record<string, StartOptions>;
}

export const AvdList: React.FC<AvdListProps> = ({
  avds,
  onQuickStart,
  onOpenLaunchModal,
  onQuickColdBoot,
  onQuickRooted,
  onStop,
  onOpenConfigEditor,
  onRefresh,
  onLaunchWithPreset,
  customProfiles,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterState, setFilterState] = useState<"all" | "running" | "offline">("all");

  const filteredAvds = avds.filter((avd) => {
    const matchesSearch =
      avd.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (avd.display_name && avd.display_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (avd.target && avd.target.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (avd.api_level && avd.api_level.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterState === "running") return avd.is_running;
    if (filterState === "offline") return !avd.is_running;
    return true;
  });

  const runningCount = avds.filter((a) => a.is_running).length;

  return (
    <div className="avd-manager-view">
      <div className="view-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search AVDs by name, target API, ABI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm("")}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-chips">
          <button
            className={`chip ${filterState === "all" ? "active" : ""}`}
            onClick={() => setFilterState("all")}
          >
            All ({avds.length})
          </button>
          <button
            className={`chip ${filterState === "running" ? "active" : ""}`}
            onClick={() => setFilterState("running")}
          >
            Running ({runningCount})
          </button>
          <button
            className={`chip ${filterState === "offline" ? "active" : ""}`}
            onClick={() => setFilterState("offline")}
          >
            Offline ({avds.length - runningCount})
          </button>
        </div>

        <div className="view-mode-toggle">
          <button
            className={`icon-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Grid View"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`icon-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="Compact List View"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {filteredAvds.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Smartphone size={40} />
          </div>
          <h3>No Android Virtual Devices Found</h3>
          <p>
            {searchTerm
              ? `No AVDs matching "${searchTerm}"`
              : "No AVDs were found in the configured AVD directory. Ensure your AVD home path is set correctly in Settings."}
          </p>
          <button className="btn btn-secondary" onClick={onRefresh}>
            Scan AVD Home Directory
          </button>
        </div>
      ) : (
        <div className={`avd-container ${viewMode}`}>
          {filteredAvds.map((avd) => (
            <AvdCard
              key={avd.name}
              avd={avd}
              onQuickStart={onQuickStart}
              onOpenLaunchModal={onOpenLaunchModal}
              onQuickColdBoot={onQuickColdBoot}
              onQuickRooted={onQuickRooted}
              onStop={onStop}
              onOpenConfigEditor={onOpenConfigEditor}
              onLaunchWithPreset={onLaunchWithPreset}
              customProfiles={customProfiles}
            />
          ))}
        </div>
      )}
    </div>
  );
};
