"use client";

import { useEffect, useState, useCallback } from "react";

const SHORTCUTS = [
  { key: "Space", action: "Start / Pause" },
  { key: "S", action: "Skip" },
  { key: "R", action: "Reset" },
  { key: "Esc", action: "Exit Fullscreen" },
  { key: "?", action: "Toggle Shortcuts" },
];

interface KeyboardOverlayProps {
  hudColor: string;
}

export function KeyboardOverlay({ hudColor }: KeyboardOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);

  // First-visit auto-show
  useEffect(() => {
    const key = "pomo-cockpit-visited";
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      setFirstVisit(true);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setFirstVisit(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "?") {
        setVisible((v) => !v);
      }
    },
    []
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Auto-dismiss after 3 seconds on first visit only
  useEffect(() => {
    if (visible && firstVisit) {
      const timer = setTimeout(() => {
        setVisible(false);
        setFirstVisit(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, firstVisit]);

  return (
    <>
      {/* Toggle button — always visible in bottom-right */}
      <button
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide keyboard shortcuts" : "Show keyboard shortcuts"}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 45,
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.5)",
          border: `1px solid ${hudColor}44`,
          borderRadius: 8,
          color: hudColor,
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          opacity: visible ? 1 : 0.5,
          transition: "opacity 200ms ease",
        }}
      >
        ?
      </button>

      {/* Shortcuts panel — bottom-right, above the toggle button */}
      {visible && (
        <div
          style={{
            position: "fixed",
            bottom: 56,
            right: 16,
            zIndex: 44,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(8px)",
            borderRadius: 12,
            padding: "16px 20px",
            border: `1px solid ${hudColor}33`,
            opacity: visible ? 1 : 0,
            transition: "opacity 300ms ease-out",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: hudColor,
              marginBottom: 12,
              opacity: 0.8,
            }}
          >
            Keyboard Shortcuts
          </div>
          {SHORTCUTS.map(({ key, action }) => (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 24,
                marginBottom: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.02em",
              }}
            >
              <span
                style={{
                  color: hudColor,
                  fontWeight: 500,
                  minWidth: 50,
                }}
              >
                {key}
              </span>
              <span style={{ color: "hsl(225, 10%, 55%)" }}>{action}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
