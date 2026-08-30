import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  RotateCcw,
  Compass,
  Move,
  Smartphone,
  Maximize2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../context/ToastContext";

interface VirtualDeviceRotatorProps {
  serial: string;
}

export const VirtualDeviceRotator: React.FC<VirtualDeviceRotatorProps> = ({ serial }) => {
  const { toast } = useToast();

  // Angles in degrees
  const [pitch, setPitch] = useState<number>(0); // X rotation (-180 to 180)
  const [roll, setRoll] = useState<number>(0); // Y rotation (-180 to 180)
  const [yaw, setYaw] = useState<number>(0); // Z rotation (0 to 360)

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; initialPitch: number; initialRoll: number }>({
    x: 0,
    y: 0,
    initialPitch: 0,
    initialRoll: 0,
  });

  const syncTimeoutRef = useRef<number | null>(null);

  // Sync orientation & acceleration to the Android device via ADB
  const syncToDevice = useCallback(
    (p: number, r: number, y: number) => {
      if (!serial) return;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = window.setTimeout(async () => {
        try {
          // Send orientation angles
          await invoke("set_sensor_values", {
            serial,
            sensor: "orientation",
            values: `${y.toFixed(1)}:${p.toFixed(1)}:${r.toFixed(1)}`,
          });

          // Compute gravity acceleration vectors
          const pRad = (p * Math.PI) / 180;
          const rRad = (r * Math.PI) / 180;
          const ax = (9.81 * Math.sin(rRad)).toFixed(2);
          const ay = (9.81 * Math.sin(pRad)).toFixed(2);
          const az = (9.81 * Math.cos(pRad) * Math.cos(rRad)).toFixed(2);

          await invoke("set_sensor_values", {
            serial,
            sensor: "acceleration",
            values: `${ax}:${ay}:${az}`,
          });
        } catch (e) {
          console.warn("Failed to sync orientation to device", e);
        }
      }, 100);
    },
    [serial]
  );

  const updateAngles = (newPitch: number, newRoll: number, newYaw: number) => {
    setPitch(newPitch);
    setRoll(newRoll);
    setYaw(newYaw);
    syncToDevice(newPitch, newRoll, newYaw);
  };

  // Mouse drag handlers for 3D rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPitch: pitch,
      initialRoll: roll,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      // Sensitivity factor
      const sensitivity = 0.8;
      let nextRoll = dragStartRef.current.initialRoll + deltaX * sensitivity;
      let nextPitch = dragStartRef.current.initialPitch - deltaY * sensitivity;

      // Clamp pitch to -90..90 for intuitive interaction
      nextPitch = Math.max(-90, Math.min(90, nextPitch));

      // Wrap roll -180..180
      if (nextRoll > 180) nextRoll -= 360;
      if (nextRoll < -180) nextRoll += 360;

      setPitch(Math.round(nextPitch));
      setRoll(Math.round(nextRoll));
      syncToDevice(Math.round(nextPitch), Math.round(nextRoll), yaw);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, pitch, roll, yaw, syncToDevice]);

  // Standard Posture Presets
  const applyPreset = async (presetName: string, p: number, r: number, y: number, rotationKey?: number) => {
    updateAngles(p, r, y);
    if (rotationKey !== undefined && serial) {
      try {
        await invoke("set_device_rotation", { serial, rotation: rotationKey });
      } catch (e) {
        console.warn(e);
      }
    }
    toast.success(`Device pose applied: ${presetName}`);
  };

  return (
    <div className="virtual-rotator-container">
      {/* 3D Visual Device Viewport */}
      <div className="rotator-viewport-card">
        <div className="viewport-header">
          <div className="viewport-title">
            <Move size={15} />
            <span>Interactive 3D Device Pose</span>
          </div>
          <span className="drag-hint">Click & drag on device to rotate</span>
        </div>

        <div
          className={`viewport-3d-scene ${isDragging ? "dragging" : ""}`}
          onMouseDown={handleMouseDown}
        >
          <div
            className="device-3d-model"
            style={{
              transform: `perspective(700px) rotateX(${pitch}deg) rotateY(${roll}deg) rotateZ(${yaw}deg)`,
            }}
          >
            {/* Phone Screen & Bezels */}
            <div className="phone-front">
              <div className="phone-earpiece" />
              <div className="phone-camera" />
              <div className="phone-screen">
                <div className="screen-content">
                  <Smartphone size={32} className="screen-icon" />
                  <div className="screen-angles">
                    <span>Pitch: {pitch}°</span>
                    <span>Roll: {roll}°</span>
                    <span>Yaw: {yaw}°</span>
                  </div>
                </div>
                <div className="screen-nav-bar" />
              </div>
            </div>

            {/* Buttons on chassis */}
            <div className="phone-power-btn" />
            <div className="phone-volume-btn" />
          </div>
        </div>

        {/* Real-time Angle Indicators */}
        <div className="angles-indicator-row">
          <div className="angle-chip">
            <b>Pitch (X):</b> <span>{pitch}°</span>
          </div>
          <div className="angle-chip">
            <b>Roll (Y):</b> <span>{roll}°</span>
          </div>
          <div className="angle-chip">
            <b>Yaw (Z):</b> <span>{yaw}°</span>
          </div>
        </div>
      </div>

      {/* Controls & Sliders Card */}
      <div className="rotator-controls-card">
        <h4>Orientation & Posture Presets</h4>

        <div className="pose-presets-grid">
          <button
            className="preset-btn"
            onClick={() => applyPreset("Portrait (0°)", 0, 0, 0, 0)}
          >
            <Smartphone size={15} />
            <span>Portrait (0°)</span>
          </button>

          <button
            className="preset-btn"
            onClick={() => applyPreset("Landscape Left (90°)", 0, 0, 90, 1)}
          >
            <Smartphone size={15} style={{ transform: "rotate(90deg)" }} />
            <span>Landscape (90°)</span>
          </button>

          <button
            className="preset-btn"
            onClick={() => applyPreset("Inverted (180°)", 0, 0, 180, 2)}
          >
            <Smartphone size={15} style={{ transform: "rotate(180deg)" }} />
            <span>Inverted (180°)</span>
          </button>

          <button
            className="preset-btn"
            onClick={() => applyPreset("Landscape Right (270°)", 0, 0, 270, 3)}
          >
            <Smartphone size={15} style={{ transform: "rotate(270deg)" }} />
            <span>Landscape (270°)</span>
          </button>

          <button
            className="preset-btn"
            onClick={() => applyPreset("Table Flat (Face Up)", 90, 0, 0)}
          >
            <Maximize2 size={15} />
            <span>Flat (Face Up)</span>
          </button>

          <button
            className="preset-btn"
            onClick={() => applyPreset("Face Down", -90, 0, 0)}
          >
            <Maximize2 size={15} style={{ transform: "rotate(180deg)" }} />
            <span>Face Down</span>
          </button>

          <button
            className="preset-btn"
            onClick={() => applyPreset("Tilted 45°", 45, 20, 0)}
          >
            <Compass size={15} />
            <span>Tilted 45°</span>
          </button>

          <button
            className="preset-btn btn-reset-pose"
            onClick={() => applyPreset("Reset Center", 0, 0, 0, 0)}
          >
            <RotateCcw size={15} />
            <span>Reset Pose</span>
          </button>
        </div>

        <div className="sliders-section mt-3">
          <h4>Fine-Tune Rotation Angles</h4>

          <div className="slider-group">
            <div className="slider-label-row">
              <label>Pitch (Tilt Up / Down):</label>
              <span>{pitch}°</span>
            </div>
            <input
              type="range"
              min="-90"
              max="90"
              value={pitch}
              onChange={(e) => updateAngles(parseInt(e.target.value, 10), roll, yaw)}
            />
          </div>

          <div className="slider-group">
            <div className="slider-label-row">
              <label>Roll (Tilt Left / Right):</label>
              <span>{roll}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              value={roll}
              onChange={(e) => updateAngles(pitch, parseInt(e.target.value, 10), yaw)}
            />
          </div>

          <div className="slider-group">
            <div className="slider-label-row">
              <label>Yaw (Azimuth Rotation):</label>
              <span>{yaw}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={yaw}
              onChange={(e) => updateAngles(pitch, roll, parseInt(e.target.value, 10))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
