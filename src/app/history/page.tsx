"use client";

import { useSessionStore } from "@/stores/session-store";
import { useTaskStore } from "@/stores/task-store";
import type { TimerSession, SessionType } from "@/types";

const typeLabels: Record<SessionType, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const typeColors: Record<SessionType, string> = {
  focus: "bg-focus-active/20 text-focus-active",
  shortBreak: "bg-short-break/20 text-short-break",
  longBreak: "bg-long-break/20 text-long-break",
};

export default function HistoryPage() {
  const sessions = useSessionStore((s) => s.sessions);
  const tasks = useTaskStore((s) => s.tasks);

  const grouped = groupByDate(sessions);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">History</h1>

        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No sessions yet. Complete a focus session to see your history.
          </p>
        )}

        {grouped.map(({ date, label, items }) => (
          <div key={date} className="space-y-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              {label}
            </h2>
            <ul className="space-y-1">
              {items.map((session) => {
                const task = session.taskId
                  ? tasks.find((t) => t.id === session.taskId)
                  : null;
                const time = new Date(session.completedAt).toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" }
                );
                const durationMin = Math.round(session.actualDuration / 60);

                return (
                  <li
                    key={session.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface"
                  >
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[session.type]}`}
                    >
                      {typeLabels[session.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      {task && (
                        <p className="text-sm truncate">{task.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {durationMin} min
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {time}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByDate(sessions: TimerSession[]) {
  const groups: Map<string, TimerSession[]> = new Map();

  for (const session of sessions) {
    const date = session.completedAt.split("T")[0];
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(session);
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString()
    .split("T")[0];

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    label:
      date === today
        ? "Today"
        : date === yesterday
          ? "Yesterday"
          : new Date(date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            }),
    items,
  }));
}
