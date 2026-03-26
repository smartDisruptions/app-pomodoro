"use client";

import type { SessionType } from "@/types";

interface TimerDisplayProps {
  timeRemaining: number; // seconds
  sessionType: SessionType;
  currentSessionIndex: number;
  sessionsBeforeLongBreak: number;
}

const sessionLabels: Record<SessionType, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

export function TimerDisplay({
  timeRemaining,
  sessionType,
  currentSessionIndex,
  sessionsBeforeLongBreak,
}: TimerDisplayProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="text-7xl font-bold tracking-tight font-mono"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {display}
      </span>
      <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
        {sessionLabels[sessionType]}
      </span>
      {sessionType === "focus" && (
        <span className="text-xs text-muted-foreground">
          Session {currentSessionIndex} of {sessionsBeforeLongBreak}
        </span>
      )}
    </div>
  );
}
