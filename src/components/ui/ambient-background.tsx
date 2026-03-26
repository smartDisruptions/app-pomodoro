"use client";

import { useSettingsStore } from "@/stores/settings-store";
import { useTimerStore } from "@/stores/timer-store";

export function AmbientBackground() {
  const enabled = useSettingsStore((s) => s.ambientVisualsEnabled);
  const timerState = useTimerStore((s) => s.state);
  const sessionType = useTimerStore((s) => s.sessionType);

  if (!enabled) return null;

  const isActive = timerState === "running" || timerState === "paused";
  const isBreak = sessionType === "shortBreak" || sessionType === "longBreak";

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      {/* Primary orb */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[100px] animate-ambient-drift"
        style={{
          background: isBreak
            ? "radial-gradient(circle, var(--short-break), transparent)"
            : "radial-gradient(circle, var(--primary), transparent)",
          top: "20%",
          left: "30%",
          animationDuration: isActive ? "8s" : "12s",
        }}
      />
      {/* Secondary orb */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[80px] animate-ambient-drift-reverse"
        style={{
          background: isBreak
            ? "radial-gradient(circle, var(--long-break), transparent)"
            : "radial-gradient(circle, var(--accent), transparent)",
          bottom: "20%",
          right: "20%",
          animationDuration: isActive ? "10s" : "15s",
        }}
      />
    </div>
  );
}
