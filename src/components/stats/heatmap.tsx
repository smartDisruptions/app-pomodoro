"use client";

import { useMemo, useState } from "react";
import type { DailyStats } from "@/types";

interface HeatmapProps {
  dailyStats: DailyStats[];
  weeks?: number;
}

const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

export function Heatmap({ dailyStats, weeks = 12 }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const grid = useMemo(() => {
    const statsMap = new Map(dailyStats.map((d) => [d.date, d]));
    const cells: { date: string; count: number; col: number; row: number }[] =
      [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay(); // 0=Sun

    // Sunday of the current week
    const currentWeekSunday = new Date(today);
    currentWeekSunday.setDate(today.getDate() - todayDay);

    // Build complete columns (Sun–Sat) from oldest week (col 0) to current week
    for (let col = 0; col < weeks; col++) {
      for (let row = 0; row < 7; row++) {
        const d = new Date(currentWeekSunday);
        d.setDate(
          currentWeekSunday.getDate() - (weeks - 1 - col) * 7 + row
        );
        const dateStr = d.toISOString().split("T")[0];

        if (d > today) {
          // Future date – render as invisible spacer
          cells.push({ date: dateStr, count: -1, col, row });
        } else {
          const stats = statsMap.get(dateStr);
          cells.push({
            date: dateStr,
            count: stats?.sessionsCompleted ?? 0,
            col,
            row,
          });
        }
      }
    }

    return cells;
  }, [dailyStats, weeks]);

  const getIntensity = (count: number): string => {
    if (count < 0) return "bg-transparent";
    if (count === 0) return "bg-border/50";
    if (count <= 2) return "bg-primary/25";
    if (count <= 4) return "bg-primary/50";
    return "bg-primary/80";
  };

  // Compute month labels — place at the column containing the 1st of each month
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (const cell of grid) {
      if (cell.count < 0) continue; // skip future spacers
      const d = new Date(cell.date + "T00:00:00");
      const month = d.getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: d.toLocaleDateString(undefined, { month: "short" }),
          col: cell.col,
        });
        lastMonth = month;
      }
    }
    return labels;
  }, [grid]);

  return (
    <div className="space-y-1 relative">
      {/* Month labels */}
      <div className="flex ml-8 mb-1">
        <div
          className="grid gap-[4px]"
          style={{
            gridTemplateColumns: `repeat(${weeks}, 18px)`,
          }}
        >
          {Array.from({ length: weeks }).map((_, i) => {
            const label = monthLabels.find((m) => m.col === i);
            return (
              <span key={i} className="text-[11px] text-muted-foreground">
                {label?.label ?? ""}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[4px] pr-1">
          {dayLabels.map((label, i) => (
            <span
              key={i}
              className="text-[11px] text-muted-foreground h-[18px] flex items-center"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div
          className="grid gap-[4px]"
          style={{
            gridTemplateColumns: `repeat(${weeks}, 18px)`,
            gridTemplateRows: "repeat(7, 18px)",
            gridAutoFlow: "column",
          }}
        >
          {grid.map((cell) => (
            <div
              key={cell.date}
              className={`w-[18px] h-[18px] rounded-sm ${getIntensity(cell.count)} transition-colors cursor-default`}
              onMouseEnter={(e) => {
                const rect = (
                  e.target as HTMLElement
                ).getBoundingClientRect();
                setTooltip({
                  date: cell.date,
                  count: cell.count,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 text-xs rounded bg-popover text-popover-foreground border border-border shadow-md pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 32,
            transform: "translateX(-50%)",
          }}
        >
          {tooltip.count} session{tooltip.count !== 1 ? "s" : ""} on{" "}
          {new Date(tooltip.date + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </div>
      )}
    </div>
  );
}
