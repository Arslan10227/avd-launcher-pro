import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  Trash2,
  Pause,
  Download,
  Copy,
  Search,
  Terminal,
  Smartphone,
  Lock,
  Unlock,
} from "lucide-react";
import { AdbDevice, LogcatOptions } from "../types";
import { useToast } from "../context/ToastContext";

interface LogcatViewerProps {
  devices: AdbDevice[];
  activeSerial: string;
  setActiveSerial: (s: string) => void;
  logLines: string[];
  isStreaming: boolean;
  onStartLogcat: (opts: LogcatOptions) => Promise<void>;
  onStopLogcat: (serial: string) => Promise<void>;
  onClearLogs: () => void;
}

export const LogcatViewer: React.FC<LogcatViewerProps> = ({
  devices,
  activeSerial,
  setActiveSerial,
  logLines,
  isStreaming,
  onStartLogcat,
  onStopLogcat,
  onClearLogs,
}) => {
  const { toast } = useToast();
  const [pkgFilter, setPkgFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("V");
  const [bufferFilter, setBufferFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const [displayedLogs, setDisplayedLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPaused) {
      setDisplayedLogs(logLines);
    }
  }, [logLines, isPaused]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLogs, autoScroll]);

  const handleStart = async () => {
    if (!activeSerial) {
      toast.error("Please select an active online device first");
      return;
    }
    setIsPaused(false);
    try {
      await onStartLogcat({
        serial: activeSerial,
        package: pkgFilter.trim() || undefined,
        tag: tagFilter.trim() || undefined,
        level: levelFilter,
        buffer: bufferFilter,
      });
      toast.success(`Logcat streaming for ${activeSerial}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleStop = async () => {
    if (!activeSerial) return;
    try {
      await onStopLogcat(activeSerial);
      toast.info("Logcat streaming stopped");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(displayedLogs.join("\n"));
    toast.success(`Copied ${displayedLogs.length} log lines to clipboard!`);
  };

  const handleExportLogs = () => {
    const blob = new Blob([displayedLogs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logcat-${activeSerial || "device"}-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported to file successfully!");
  };

  const filteredLogs = displayedLogs.filter((line) => {
    if (!searchQuery) return true;
    return line.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getLogLineClass = (line: string) => {
    if (line.includes(" E ") || line.includes(" F ") || line.includes("Fatal") || line.includes("Error")) {
      return "log-error";
    }
    if (line.includes(" W ") || line.includes("Warn")) {
      return "log-warn";
    }
    if (line.includes(" I ") || line.includes("Info")) {
      return "log-info";
    }
    if (line.includes(" D ") || line.includes("Debug")) {
      return "log-debug";
    }
    return "log-verbose";
  };

  return (
    <div className="logcat-viewer">
      {/* Controls Bar */}
      <div className="logcat-toolbar">
        <div className="toolbar-group">
          <Smartphone size={16} className="toolbar-icon" />
          <select
            className="device-select"
            value={activeSerial}
            onChange={(e) => setActiveSerial(e.target.value)}
          >
            {devices.length === 0 ? (
              <option value="">No devices online</option>
            ) : (
              devices.map((d) => (
                <option key={d.serial} value={d.serial}>
                  {d.serial} {d.avd_name ? `(${d.avd_name})` : ""}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="toolbar-group">
          <input
            type="text"
            placeholder="Package name (e.g. com.app)"
            value={pkgFilter}
            onChange={(e) => setPkgFilter(e.target.value)}
            className="input-sm"
          />

          <input
            type="text"
            placeholder="Tag filter"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="input-sm input-tag"
          />

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="select-sm"
          >
            <option value="V">Verbose (V)</option>
            <option value="D">Debug (D)</option>
            <option value="I">Info (I)</option>
            <option value="W">Warn (W)</option>
            <option value="E">Error (E)</option>
            <option value="F">Fatal (F)</option>
          </select>

          <select
            value={bufferFilter}
            onChange={(e) => setBufferFilter(e.target.value)}
            className="select-sm"
          >
            <option value="all">All Buffers</option>
            <option value="main">Main</option>
            <option value="system">System</option>
            <option value="crash">Crash</option>
          </select>
        </div>

        <div className="toolbar-actions">
          {isStreaming ? (
            <button className="btn btn-danger btn-sm" onClick={handleStop}>
              <Square size={14} />
              <span>Stop</span>
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleStart}
              disabled={!activeSerial}
            >
              <Play size={14} />
              <span>Start</span>
            </button>
          )}

          <button
            className={`btn btn-secondary btn-sm ${isPaused ? "active-pause" : ""}`}
            onClick={() => {
              setIsPaused(!isPaused);
              toast.info(isPaused ? "Resumed live log stream" : "Paused live log stream");
            }}
            title={isPaused ? "Resume Live Updates" : "Pause Live Updates"}
          >
            <Pause size={14} />
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>

          <button
            className="btn btn-subtle btn-sm"
            onClick={() => {
              onClearLogs();
              toast.info("Log buffer cleared");
            }}
            title="Clear Log Output"
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>

          <button
            className={`icon-btn ${autoScroll ? "active" : ""}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            {autoScroll ? <Lock size={14} /> : <Unlock size={14} />}
          </button>

          <button className="icon-btn" onClick={handleCopyLogs} title="Copy logs to clipboard">
            <Copy size={14} />
          </button>

          <button className="icon-btn" onClick={handleExportLogs} title="Export logs to file">
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="logcat-search-bar">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search within displayed logcat lines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="log-count-badge">
          {filteredLogs.length} / {displayedLogs.length} lines
        </span>
      </div>

      {/* Log Stream Output Console */}
      <div className="logcat-console" ref={scrollRef}>
        {filteredLogs.length === 0 ? (
          <div className="console-empty">
            <Terminal size={32} />
            <p>
              {isStreaming
                ? "Waiting for logcat output..."
                : "Logcat is stopped. Select an active device and click Start to stream live logs."}
            </p>
          </div>
        ) : (
          filteredLogs.map((line, idx) => (
            <div key={idx} className={`console-line ${getLogLineClass(line)}`}>
              <span className="line-num">{idx + 1}</span>
              <span className="line-text">{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
