"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/session-store";

interface SessionHUDProps {
  sessionIndex: number;
  sessionsBeforeLongBreak: number;
  hudColor: string; // CSS hsl string
}

export function SessionHUD({ sessionIndex, sessionsBeforeLongBreak, hudColor }: SessionHUDProps) {
  const currentStreak = useSessionStore((s) => s.currentStreak);
  const dailyStats = useSessionStore((s) => s.dailyStats);
  const [visible, setVisible] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const todayStats = dailyStats.find((d) => d.date === today);
  const totalMinutes = todayStats?.totalFocusMinutes ?? 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}H ${mins}M` : `${mins}M`;

  // Fade in after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const style: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: hudColor,
    opacity: visible ? 0.6 : 0,
    transition: "opacity 500ms ease-out",
  };

  return (
    <>
      <div className="absolute top-4 left-4 pointer-events-none" style={{ ...style, zIndex: 30 }}>
        STREAK: {currentStreak}
      </div>
      <div className="absolute top-4 right-14 pointer-events-none" style={{ ...style, zIndex: 30, textAlign: "right" }}>
        TODAY: {timeStr}
      </div>
      <div className="absolute bottom-16 left-4 pointer-events-none sm:bottom-6" style={{ ...style, zIndex: 30 }}>
        SESSION {sessionIndex}/{sessionsBeforeLongBreak}
      </div>
    </>
  );
}
