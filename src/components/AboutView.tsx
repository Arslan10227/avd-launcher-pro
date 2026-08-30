import React from "react";
import {
  Github,
  Heart,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Star,
  BookOpen,
  Bug,
} from "lucide-react";
import { SdkPaths } from "../types";

interface AboutViewProps {
  sdk: SdkPaths | null;
  onOpenUrl: (url: string) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ sdk, onOpenUrl }) => {
  const openExternal = (url: string) => {
    onOpenUrl(url);
  };

  return (
    <div className="about-view-container">
      {/* Hero Banner */}
      <div className="about-hero-card">
        <div className="hero-logo-wrapper">
          <img src="/logo.png" alt="AVD Launcher Pro Logo" className="hero-logo-img" />
        </div>
        <div className="hero-info">
          <div className="hero-badge-row">
            <span className="pro-badge">PRO EDITION</span>
            <span className="version-badge">v1.0.0</span>
            <span className="status-badge-online">STABLE</span>
          </div>
          <h1 className="hero-title">Android Virtual Device Launcher Pro</h1>
          <p className="hero-tagline">
            The next-generation, high-performance Android Emulator Management & ADB Control Studio.
            Built with Rust, Tauri v2, and React 19.
          </p>

          <div className="hero-action-buttons">
            <button
              className="btn btn-primary"
              onClick={() => openExternal("https://github.com/Arslan10227/avd-launcher-pro")}
            >
              <Github size={16} />
              <span>GitHub Repository</span>
              <ExternalLink size={12} />
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => openExternal("https://github.com/Arslan10227")}
            >
              <Star size={16} />
              <span>Developer Profile</span>
            </button>
            <button
              className="btn btn-subtle"
              onClick={() => openExternal("https://github.com/Arslan10227/avd-launcher-pro/issues")}
            >
              <Bug size={16} />
              <span>Report Issue</span>
            </button>
          </div>
        </div>
      </div>

      <div className="about-grid">
        {/* Creator & Lead Developer Profile */}
        <div className="about-card creator-card">
          <div className="card-header">
            <Heart size={18} className="heart-icon" />
            <h3>Author & Lead Developer</h3>
          </div>

          <div className="creator-profile-layout">
            <div className="avatar-container">
              <img
                src="https://github.com/Arslan10227.png"
                alt="Arslan10227 Profile Avatar"
                className="creator-avatar-img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div className="online-indicator" />
            </div>

            <div className="creator-details">
              <h4 className="creator-name">Arslan10227</h4>
              <p className="creator-handle">@Arslan10227</p>
              <p className="creator-bio">
                Software Engineer & Open Source Contributor. Passionate about building high-performance
                developer productivity tools, native system applications, and modern developer experiences.
              </p>

              <div className="creator-links">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openExternal("https://github.com/Arslan10227")}
                >
                  <Github size={14} />
                  <span>github.com/Arslan10227</span>
                  <ExternalLink size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Software Features & Capabilities */}
        <div className="about-card">
          <div className="card-header">
            <Sparkles size={18} className="sparkle-icon" />
            <h3>Key Capabilities</h3>
          </div>

          <ul className="capabilities-list">
            <li>
              <Smartphone size={14} className="feature-icon" />
              <div>
                <b>Zero Black Console Windows:</b> Fully native Windows API process management with <code>CREATE_NO_WINDOW</code> execution.
              </div>
            </li>
            <li>
              <Cpu size={14} className="feature-icon" />
              <div>
                <b>Complete CLI Emulator Flag Suite:</b> Full support for GPU acceleration, ANGLE, SwiftShader, headless CI, network latency simulation, audio control, and SELinux.
              </div>
            </li>
            <li>
              <ShieldCheck size={14} className="feature-icon" />
              <div>
                <b>Deep ADB Device Control:</b> Real-time Root check, partition remounting, APK installation, live screenshots, virtual keypad input, and file transfers.
              </div>
            </li>
            <li>
              <Layers size={14} className="feature-icon" />
              <div>
                <b>Smart Hardware & Launch Presets:</b> Instant profile switcher, JSON backup import/export, and hardware specs modifier with automatic backups.
              </div>
            </li>
          </ul>
        </div>

        {/* Tech Stack & Architecture */}
        <div className="about-card">
          <div className="card-header">
            <Code2 size={18} />
            <h3>Technology Stack</h3>
          </div>

          <div className="tech-stack-badges">
            <div className="tech-badge">
              <b>Tauri v2</b>
              <span>Native Core</span>
            </div>
            <div className="tech-badge">
              <b>Rust (Tokio)</b>
              <span>Async Engine</span>
            </div>
            <div className="tech-badge">
              <b>React 19</b>
              <span>User Interface</span>
            </div>
            <div className="tech-badge">
              <b>TypeScript</b>
              <span>Type Safety</span>
            </div>
            <div className="tech-badge">
              <b>Vite</b>
              <span>Bundler</span>
            </div>
            <div className="tech-badge">
              <b>Lucide Icons</b>
              <span>Iconography</span>
            </div>
          </div>

          <div className="mt-3">
            <p className="section-desc">
              All backend commands are protected with asynchronous timeout guarantees and line-preserving
              INI parser algorithms.
            </p>
          </div>
        </div>

        {/* Credits & License */}
        <div className="about-card">
          <div className="card-header">
            <BookOpen size={18} />
            <h3>Credits & Open Source License</h3>
          </div>

          <div className="credits-content">
            <p>
              <b>Android Virtual Device Launcher Pro</b> is released as open-source software under the <b>MIT License</b>.
            </p>

            <div className="license-box">
              <code>
                MIT License © 2026 Arslan10227.<br />
                Permission is hereby granted, free of charge, to any person obtaining a copy
                of this software and associated documentation files...
              </code>
            </div>

            <div className="acknowledgements mt-2">
              <b>Special Acknowledgements:</b>
              <ul>
                <li>Google Android Open Source Project (AOSP) & Android SDK Platform Tools</li>
                <li>Tauri Apps Foundation</li>
                <li>The Rust and React Open Source Communities</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
