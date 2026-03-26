import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TimerState, SessionType } from "@/types";

interface TimerStore {
  state: TimerState;
  sessionType: SessionType;
  timeRemaining: number; // seconds
  endTime: number | null; // Date.now() timestamp when running
  currentSessionIndex: number; // 1-based, counts focus sessions in cycle
  selectedTaskId: string | null;

  setState: (state: TimerState) => void;
  setSessionType: (type: SessionType) => void;
  setTimeRemaining: (time: number) => void;
  setEndTime: (time: number | null) => void;
  setCurrentSessionIndex: (index: number) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  reset: (duration: number) => void;
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set) => ({
      state: "idle",
      sessionType: "focus",
      timeRemaining: 25 * 60,
      endTime: null,
      currentSessionIndex: 1,
      selectedTaskId: null,

      setState: (state) => set({ state }),
      setSessionType: (sessionType) => set({ sessionType }),
      setTimeRemaining: (timeRemaining) => set({ timeRemaining }),
      setEndTime: (endTime) => set({ endTime }),
      setCurrentSessionIndex: (currentSessionIndex) =>
        set({ currentSessionIndex }),
      setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
      reset: (duration) =>
        set({
          state: "idle",
          timeRemaining: duration,
          endTime: null,
        }),
    }),
    { name: "pomo-timer-state-v1" }
  )
);
