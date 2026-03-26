import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TimerSession, DailyStats } from "@/types";

interface SessionStore {
  sessions: TimerSession[];
  dailyStats: DailyStats[];
  currentStreak: number;
  longestStreak: number;
  totalXP: number;
  addSession: (session: TimerSession) => void;
  updateSession: (id: string, updates: Partial<TimerSession>) => void;
  clearAll: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      dailyStats: [],
      currentStreak: 0,
      longestStreak: 0,
      totalXP: 0,

      addSession: (session) => {
        const { sessions, dailyStats, currentStreak, longestStreak, totalXP } =
          get();
        const newSessions = [session, ...sessions];

        // Update daily stats
        const today = new Date().toISOString().split("T")[0];
        const existingDay = dailyStats.find((d) => d.date === today);
        const focusMinutes =
          session.type === "focus"
            ? Math.round(session.actualDuration / 60)
            : 0;
        const sessionCount = session.type === "focus" ? 1 : 0;

        let newDailyStats: DailyStats[];
        if (existingDay) {
          newDailyStats = dailyStats.map((d) =>
            d.date === today
              ? {
                  ...d,
                  sessionsCompleted: d.sessionsCompleted + sessionCount,
                  totalFocusMinutes: d.totalFocusMinutes + focusMinutes,
                }
              : d
          );
        } else {
          newDailyStats = [
            ...dailyStats,
            {
              date: today,
              sessionsCompleted: sessionCount,
              totalFocusMinutes: focusMinutes,
            },
          ];
        }

        // Update streak (only for focus sessions)
        let newStreak = currentStreak;
        if (session.type === "focus" && !existingDay) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split("T")[0];
          const hadYesterday = dailyStats.some((d) => d.date === yesterdayStr);
          newStreak = hadYesterday ? currentStreak + 1 : 1;
        }

        // XP: 10 per focus session, 5 per break
        const xpGain = session.type === "focus" ? 10 : 5;

        set({
          sessions: newSessions,
          dailyStats: newDailyStats,
          currentStreak: newStreak,
          longestStreak: Math.max(longestStreak, newStreak),
          totalXP: totalXP + xpGain,
        });
      },

      updateSession: (id, updates) => {
        set({
          sessions: get().sessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        });
      },

      clearAll: () =>
        set({
          sessions: [],
          dailyStats: [],
          currentStreak: 0,
          longestStreak: 0,
          totalXP: 0,
        }),
    }),
    { name: "pomo-sessions-v1" }
  )
);
