"use client";

import { useCallback, useRef } from "react";
import { useTimerStore } from "@/stores/timer-store";
import { useSessionStore } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";
import { playCompletionSound, stopAmbientSound } from "@/lib/audio";
import type { TimerSession } from "@/types";

export function useSessionCompletion() {
  const addSession = useSessionStore((s) => s.addSession);
  const startTimeRef = useRef<string | null>(null);

  const recordStartTime = useCallback(() => {
    startTimeRef.current = new Date().toISOString();
  }, []);

  const handleCompletion = useCallback(() => {
    const timer = useTimerStore.getState();
    const settings = useSettingsStore.getState();

    const getDurationSeconds = () => {
      switch (timer.sessionType) {
        case "focus":
          return settings.workDuration * 60;
        case "shortBreak":
          return settings.shortBreakDuration * 60;
        case "longBreak":
          return settings.longBreakDuration * 60;
      }
    };

    const duration = getDurationSeconds();
    const session: TimerSession = {
      id: crypto.randomUUID(),
      type: timer.sessionType,
      duration,
      actualDuration: duration,
      startedAt: startTimeRef.current || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      taskId: timer.selectedTaskId,
      focusRating: null,
      note: null,
    };

    addSession(session);

    // Stop ambient sound on session completion
    stopAmbientSound();

    // Browser notification
    if (settings.notificationsEnabled && "Notification" in window) {
      if (Notification.permission === "granted") {
        const title =
          timer.sessionType === "focus"
            ? "Focus session complete!"
            : "Break is over!";
        const body =
          timer.sessionType === "focus"
            ? "Time for a break."
            : "Ready to focus again?";
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    }

    // Play completion sound
    if (settings.soundEnabled) {
      playCompletionSound();
    }

    startTimeRef.current = null;

    return session;
  }, [addSession]);

  return { handleCompletion, recordStartTime };
}
