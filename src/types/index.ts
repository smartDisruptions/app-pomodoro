export type SessionType = "focus" | "shortBreak" | "longBreak";

export type TimerState = "idle" | "running" | "paused" | "completed";

export type ThemeOption = "dark" | "light" | "premium";

export interface TimerSession {
  id: string;
  type: SessionType;
  duration: number; // configured duration in seconds
  actualDuration: number; // actual elapsed time in seconds
  startedAt: string; // ISO 8601
  completedAt: string; // ISO 8601
  taskId: string | null;
  focusRating: number | null; // 1-5
  note: string | null;
}

export interface Task {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
  completedSessions: number;
}

export interface UserSettings {
  workDuration: number; // minutes
  shortBreakDuration: number; // minutes
  longBreakDuration: number; // minutes
  sessionsBeforeLongBreak: number;
  theme: ThemeOption;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  ambientSoundEnabled: boolean;
  ambientVolume: number; // 0-1
  reflectionEnabled: boolean;
  ambientVisualsEnabled: boolean;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  sessionsCompleted: number;
  totalFocusMinutes: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: string | null; // ISO 8601 or null
}

export interface TimerPersistState {
  state: TimerState;
  sessionType: SessionType;
  timeRemaining: number; // seconds
  endTime: number | null; // Date.now() timestamp
  currentSessionIndex: number; // 1-based
  selectedTaskId: string | null;
}
