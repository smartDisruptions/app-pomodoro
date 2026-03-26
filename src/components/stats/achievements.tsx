"use client";

import { useAchievementsStore } from "@/stores/achievements-store";
import { useSessionStore } from "@/stores/session-store";
import { Trophy, Lock } from "lucide-react";

export function Achievements() {
  const achievements = useAchievementsStore((s) => s.achievements);
  const totalXP = useSessionStore((s) => s.totalXP);
  const level = Math.floor(totalXP / 100);
  const xpInLevel = totalXP % 100;

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <div className="space-y-4">
      {/* XP and Level */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-surface border border-border">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/20 text-accent font-bold text-lg">
          {level}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">
            Level {level} &middot; {totalXP} XP
          </p>
          <div className="mt-1 h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${xpInLevel}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {100 - xpInLevel} XP to next level
          </p>
        </div>
      </div>

      {/* Achievement Badges */}
      <p className="text-xs text-muted-foreground">
        {unlockedCount} of {achievements.length} achievements unlocked
      </p>

      <div className="grid grid-cols-2 gap-2">
        {achievements.map((achievement) => {
          const unlocked = !!achievement.unlockedAt;
          return (
            <div
              key={achievement.id}
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                unlocked
                  ? "bg-accent/5 border-accent/30"
                  : "bg-muted/30 border-border opacity-50"
              }`}
            >
              {unlocked ? (
                <Trophy className="w-4 h-4 text-accent shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {achievement.name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {achievement.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
