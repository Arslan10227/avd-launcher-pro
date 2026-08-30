import React, { useRef, useEffect } from "react";
import { Terminal, Trash2, Copy } from "lucide-react";

interface EmulatorConsoleProps {
  logs: Record<string, string[]>;
  activeHandle: string;
  setActiveHandle: (h: string) => void;
  onClear: (handle: string) => void;
}

export const EmulatorConsole: React.FC<EmulatorConsoleProps> = ({
  logs,
  activeHandle,
  setActiveHandle,
  onClear,
}) => {
  const handles = Object.keys(logs);
  const currentLogs = logs[activeHandle] || [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentLogs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentLogs.join("\n"));
  };

  return (
    <div className="emulator-console-view">
      <div className="console-toolbar">
        <div className="toolbar-group">
          <Terminal size={16} />
          <span className="toolbar-label">Process Output:</span>
          <select
            className="select-sm"
            value={activeHandle}
            onChange={(e) => setActiveHandle(e.target.value)}
          >
            {handles.length === 0 ? (
              <option value="">No running process streams</option>
            ) : (
              handles.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            className="btn btn-subtle btn-sm"
            onClick={() => onClear(activeHandle)}
            disabled={!activeHandle}
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
          <button
            className="icon-btn"
            onClick={handleCopy}
            disabled={!activeHandle}
            title="Copy Process Output"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      <div className="raw-console-body" ref={scrollRef}>
        {currentLogs.length === 0 ? (
          <div className="console-empty">
            <Terminal size={32} />
            <p>No process output received yet. Start an AVD to view its emulator logs.</p>
          </div>
        ) : (
          currentLogs.map((l, i) => (
            <div key={i} className="raw-log-line">
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
