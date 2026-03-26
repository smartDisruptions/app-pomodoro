export const DEFAULTS = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
} as const;

export const STORAGE_KEYS = {
  settings: "pomo-settings-v1",
  sessions: "pomo-sessions-v1",
  timerState: "pomo-timer-state-v1",
  tasks: "pomo-tasks-v1",
  achievements: "pomo-achievements-v1",
  dailyStats: "pomo-daily-stats-v1",
} as const;
