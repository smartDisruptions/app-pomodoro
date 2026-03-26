import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Achievement } from "@/types";

const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, "unlockedAt">[] = [
  { id: "first-session", name: "First Steps", description: "Complete your first focus session" },
  { id: "ten-sessions", name: "Getting Serious", description: "Complete 10 focus sessions" },
  { id: "fifty-sessions", name: "Veteran", description: "Complete 50 focus sessions" },
  { id: "one-hour", name: "Hour Power", description: "Accumulate 1 hour of focus time" },
  { id: "five-hours", name: "Deep Worker", description: "Accumulate 5 hours of focus time" },
  { id: "streak-3", name: "Hat Trick", description: "Maintain a 3-day streak" },
  { id: "streak-7", name: "Weekly Warrior", description: "Maintain a 7-day streak" },
  { id: "streak-30", name: "Monthly Master", description: "Maintain a 30-day streak" },
  { id: "night-owl", name: "Night Owl", description: "Complete a session after 10 PM" },
  { id: "early-bird", name: "Early Bird", description: "Complete a session before 7 AM" },
];

interface AchievementsStore {
  achievements: Achievement[];
  newlyUnlocked: string | null; // ID of most recently unlocked achievement for toast
  checkAndUnlock: (context: AchievementContext) => void;
  clearNewlyUnlocked: () => void;
  resetAll: () => void;
}

export interface AchievementContext {
  totalFocusSessions: number;
  totalFocusMinutes: number;
  currentStreak: number;
  completedAt: string; // ISO 8601
}

function initAchievements(): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map((def) => ({
    ...def,
    unlockedAt: null,
  }));
}

export const useAchievementsStore = create<AchievementsStore>()(
  persist(
    (set, get) => ({
      achievements: initAchievements(),
      newlyUnlocked: null,

      checkAndUnlock: (ctx) => {
        const { achievements } = get();
        const now = new Date().toISOString();
        const hour = new Date(ctx.completedAt).getHours();

        const checks: Record<string, boolean> = {
          "first-session": ctx.totalFocusSessions >= 1,
          "ten-sessions": ctx.totalFocusSessions >= 10,
          "fifty-sessions": ctx.totalFocusSessions >= 50,
          "one-hour": ctx.totalFocusMinutes >= 60,
          "five-hours": ctx.totalFocusMinutes >= 300,
          "streak-3": ctx.currentStreak >= 3,
          "streak-7": ctx.currentStreak >= 7,
          "streak-30": ctx.currentStreak >= 30,
          "night-owl": hour >= 22 || hour < 4,
          "early-bird": hour >= 4 && hour < 7,
        };

        let newlyUnlocked: string | null = null;
        const updated = achievements.map((a) => {
          if (!a.unlockedAt && checks[a.id]) {
            newlyUnlocked = a.id;
            return { ...a, unlockedAt: now };
          }
          return a;
        });

        if (newlyUnlocked) {
          set({ achievements: updated, newlyUnlocked });
        }
      },

      clearNewlyUnlocked: () => set({ newlyUnlocked: null }),

      resetAll: () =>
        set({ achievements: initAchievements(), newlyUnlocked: null }),
    }),
    { name: "pomo-achievements-v1" }
  )
);
