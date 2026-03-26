"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTimerStore } from "@/stores/timer-store";
import { useSettingsStore } from "@/stores/settings-store";

export function useTimer() {
  const {
    state,
    sessionType,
    timeRemaining,
    endTime,
    currentSessionIndex,
    setState,
    setTimeRemaining,
    setEndTime,
    setSessionType,
    setCurrentSessionIndex,
    reset,
  } = useTimerStore();

  const settings = useSettingsStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);

  const getDuration = useCallback(
    (type: typeof sessionType) => {
      switch (type) {
        case "focus":
          return settings.workDuration * 60;
        case "shortBreak":
          return settings.shortBreakDuration * 60;
        case "longBreak":
          return settings.longBreakDuration * 60;
      }
    },
    [settings.workDuration, settings.shortBreakDuration, settings.longBreakDuration]
  );

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const store = useTimerStore.getState();
    if (store.state !== "running" || store.endTime === null) return;

    const remaining = Math.max(
      0,
      Math.round((store.endTime - Date.now()) / 1000)
    );
    setTimeRemaining(remaining);

    if (remaining <= 0) {
      clearTimer();
      setState("completed");
      setEndTime(null);
      onCompleteRef.current?.();
    }
  }, [clearTimer, setState, setTimeRemaining, setEndTime]);

  const start = useCallback(() => {
    const store = useTimerStore.getState();
    if (store.state !== "idle") return;

    const duration = getDuration(store.sessionType);
    const end = Date.now() + duration * 1000;
    setTimeRemaining(duration);
    setEndTime(end);
    setState("running");
  }, [getDuration, setState, setTimeRemaining, setEndTime]);

  const pause = useCallback(() => {
    const store = useTimerStore.getState();
    if (store.state !== "running") return;

    clearTimer();
    // Freeze timeRemaining based on endTime for accuracy
    if (store.endTime) {
      const remaining = Math.max(
        0,
        Math.round((store.endTime - Date.now()) / 1000)
      );
      setTimeRemaining(remaining);
    }
    setEndTime(null);
    setState("paused");
  }, [clearTimer, setState, setTimeRemaining, setEndTime]);

  const resume = useCallback(() => {
    const store = useTimerStore.getState();
    if (store.state !== "paused") return;

    const end = Date.now() + store.timeRemaining * 1000;
    setEndTime(end);
    setState("running");
  }, [setState, setEndTime]);

  const resetTimer = useCallback(() => {
    const store = useTimerStore.getState();
    clearTimer();
    reset(getDuration(store.sessionType));
  }, [clearTimer, reset, getDuration]);

  const getNextSessionType = useCallback((): {
    type: typeof sessionType;
    index: number;
  } => {
    const store = useTimerStore.getState();
    const sessionsBeforeLong = useSettingsStore.getState().sessionsBeforeLongBreak;

    if (store.sessionType === "focus") {
      if (store.currentSessionIndex >= sessionsBeforeLong) {
        return { type: "longBreak", index: store.currentSessionIndex };
      }
      return { type: "shortBreak", index: store.currentSessionIndex };
    }
    // After any break, go to focus
    const nextIndex =
      store.sessionType === "longBreak" ? 1 : store.currentSessionIndex + 1;
    return { type: "focus", index: nextIndex };
  }, []);

  const skip = useCallback(() => {
    clearTimer();
    const next = getNextSessionType();
    setSessionType(next.type);
    setCurrentSessionIndex(next.index);
    reset(getDuration(next.type));
  }, [
    clearTimer,
    getNextSessionType,
    setSessionType,
    setCurrentSessionIndex,
    reset,
    getDuration,
  ]);

  const advanceToNext = useCallback(() => {
    const next = getNextSessionType();
    setSessionType(next.type);
    setCurrentSessionIndex(next.index);
    setTimeRemaining(getDuration(next.type));
    setState("idle");
    setEndTime(null);
  }, [
    getNextSessionType,
    setSessionType,
    setCurrentSessionIndex,
    setTimeRemaining,
    getDuration,
    setState,
    setEndTime,
  ]);

  // Sync timer display when settings change while idle
  useEffect(() => {
    if (state === "idle") {
      setTimeRemaining(getDuration(sessionType));
    }
  }, [state, sessionType, getDuration, setTimeRemaining]);

  // Main interval effect
  useEffect(() => {
    if (state === "running") {
      intervalRef.current = setInterval(tick, 250);
      return clearTimer;
    }
    clearTimer();
  }, [state, tick, clearTimer]);

  // Handle visibility change for drift compensation
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [tick]);

  // Recover timer state on mount (browser refresh)
  useEffect(() => {
    const store = useTimerStore.getState();
    if (store.state === "running" && store.endTime) {
      const remaining = Math.max(
        0,
        Math.round((store.endTime - Date.now()) / 1000)
      );
      if (remaining <= 0) {
        setState("completed");
        setEndTime(null);
        setTimeRemaining(0);
        onCompleteRef.current?.();
      } else {
        setTimeRemaining(remaining);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    sessionType,
    timeRemaining,
    currentSessionIndex,
    start,
    pause,
    resume,
    reset: resetTimer,
    skip,
    advanceToNext,
    getDuration,
    onCompleteRef,
  };
}
