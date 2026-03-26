"use client";

import { useEffect } from "react";
import { useAchievementsStore } from "@/stores/achievements-store";
import { Trophy } from "lucide-react";

export function AchievementToast() {
  const newlyUnlocked = useAchievementsStore((s) => s.newlyUnlocked);
  const achievements = useAchievementsStore((s) => s.achievements);
  const clearNewlyUnlocked = useAchievementsStore(
    (s) => s.clearNewlyUnlocked
  );

  const achievement = newlyUnlocked
    ? achievements.find((a) => a.id === newlyUnlocked)
    : null;

  useEffect(() => {
    if (newlyUnlocked) {
      const timer = setTimeout(clearNewlyUnlocked, 4000);
      return () => clearTimeout(timer);
    }
  }, [newlyUnlocked, clearNewlyUnlocked]);

  if (!achievement) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-scale-in">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent/10 border border-accent/30 shadow-lg backdrop-blur-sm">
        <Trophy className="w-5 h-5 text-accent shrink-0" />
        <div>
          <p className="text-sm font-semibold">Achievement Unlocked!</p>
          <p className="text-xs text-muted-foreground">
            {achievement.name}
          </p>
        </div>
      </div>
    </div>
  );
}
