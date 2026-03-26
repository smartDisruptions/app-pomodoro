"use client";

import { useMemo } from "react";
import { useSessionStore } from "@/stores/session-store";
import { Flame, Clock, Target, Trophy, TrendingUp } from "lucide-react";
import { Heatmap } from "@/components/stats/heatmap";
import { Achievements } from "@/components/stats/achievements";

export default function StatsPage() {
  const { sessions, dailyStats, currentStreak, longestStreak } =
    useSessionStore();

  const stats = useMemo(() => {
    const focusSessions = sessions.filter((s) => s.type === "focus");
    const totalFocusMinutes = focusSessions.reduce(
      (acc, s) => acc + Math.round(s.actualDuration / 60),
      0
    );
    const daysWithSessions = dailyStats.filter(
      (d) => d.sessionsCompleted > 0
    ).length;
    const dailyAverage =
      daysWithSessions > 0
        ? Math.round(focusSessions.length / daysWithSessions)
        : 0;

    return {
      totalSessions: focusSessions.length,
      totalFocusMinutes,
      dailyAverage,
    };
  }, [sessions, dailyStats]);

  const weeklyData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Find Monday of the current week (JS getDay: 0=Sun, 1=Mon)
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

    const days: { label: string; date: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayStats = dailyStats.find((ds) => ds.date === dateStr);
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        date: dateStr,
        count: d > today ? -1 : (dayStats?.sessionsCompleted ?? 0),
      });
    }
    return days;
  }, [dailyStats]);

  const maxWeekly = Math.max(...weeklyData.map((d) => d.count), 1);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-2xl font-semibold">Stats</h1>

        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No stats yet. Complete a focus session to see your productivity
            data.
          </p>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Target}
                label="Total Sessions"
                value={String(stats.totalSessions)}
              />
              <StatCard
                icon={Clock}
                label="Focus Time"
                value={formatMinutes(stats.totalFocusMinutes)}
              />
              <StatCard
                icon={TrendingUp}
                label="Daily Average"
                value={`${stats.dailyAverage}/day`}
              />
              <StatCard
                icon={Flame}
                label="Current Streak"
                value={`${currentStreak}d`}
              />
              <StatCard
                icon={Trophy}
                label="Longest Streak"
                value={`${longestStreak}d`}
                className="col-span-2"
              />
            </div>

            {/* Heatmap */}
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                Activity
              </h2>
              <div className="overflow-x-auto">
                <Heatmap dailyStats={dailyStats} weeks={12} />
              </div>
            </section>

            {/* Weekly Chart */}
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                This Week
              </h2>
              <div className="flex items-end gap-2 h-32 px-2">
                {weeklyData.map((day) => (
                  <div
                    key={day.date}
                    className="flex flex-col items-end flex-1 h-full"
                  >
                    <div className="flex flex-col items-center gap-1 w-full flex-1 justify-end">
                      {day.count > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {day.count}
                        </span>
                      )}
                      <div
                        className="w-full rounded-t-sm bg-primary/80 transition-all duration-300"
                        style={{
                          height: day.count < 0
                            ? "0%"
                            : day.count > 0
                              ? `${Math.max((day.count / maxWeekly) * 100, 8)}%`
                              : "4%",
                          opacity: day.count > 0 ? 1 : day.count < 0 ? 0 : 0.2,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 w-full text-center">
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Achievements */}
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                Achievements
              </h2>
              <Achievements />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg bg-surface border border-border animate-fade-in ${className}`}
    >
      <Icon className="h-5 w-5 text-primary shrink-0" />
      <div>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
