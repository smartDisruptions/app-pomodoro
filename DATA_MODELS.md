# Pomodoro Timer — Data Models and Persistence Schema

## TypeScript Interfaces

### TimerSession
```typescript
interface TimerSession {
  id: string;                          // crypto.randomUUID()
  type: 'focus' | 'shortBreak' | 'longBreak';
  duration: number;                    // configured duration in seconds
  actualDuration: number;              // actual elapsed time in seconds
  startedAt: string;                   // ISO 8601
  completedAt: string;                 // ISO 8601
  taskId: string | null;               // associated task ID or null
  focusRating: number | null;          // 1-5 reflection rating or null
  note: string | null;                 // reflection note or null
}
```

### Task
```typescript
interface Task {
  id: string;                          // crypto.randomUUID()
  title: string;
  createdAt: string;                   // ISO 8601
  completedSessions: number;           // count of associated focus sessions
}
```

### UserSettings
```typescript
interface UserSettings {
  workDuration: number;                // minutes (default: 25)
  shortBreakDuration: number;          // minutes (default: 5)
  longBreakDuration: number;           // minutes (default: 15)
  sessionsBeforeLongBreak: number;     // count (default: 4)
  theme: 'dark' | 'light' | 'premium';// default: 'dark'
  soundEnabled: boolean;               // default: true
  notificationsEnabled: boolean;       // default: false
  ambientSoundEnabled: boolean;        // default: false
  ambientVolume: number;               // 0-1 (default: 0.5)
  reflectionEnabled: boolean;          // default: true
  ambientVisualsEnabled: boolean;      // default: true
}
```

### DailyStats
```typescript
interface DailyStats {
  date: string;                        // YYYY-MM-DD format
  sessionsCompleted: number;
  totalFocusMinutes: number;
}
```

### Achievement
```typescript
interface Achievement {
  id: string;                          // unique achievement key
  name: string;
  description: string;
  unlockedAt: string | null;           // ISO 8601 or null if locked
}
```

### AchievementsState
```typescript
interface AchievementsState {
  totalXP: number;
  level: number;                       // floor(totalXP / 100)
  achievements: Achievement[];
}
```

### TimerPersistState (for browser refresh recovery)
```typescript
interface TimerPersistState {
  state: 'idle' | 'running' | 'paused';
  sessionType: 'focus' | 'shortBreak' | 'longBreak';
  timeRemaining: number;              // seconds
  endTime: number | null;             // Date.now() timestamp when running
  currentSessionIndex: number;        // 1-based focus session count in cycle
  selectedTaskId: string | null;
}
```

## localStorage Schema

| Key                        | Value Type         | Description                     |
|----------------------------|--------------------|---------------------------------|
| `pomo-settings-v1`        | UserSettings       | User preferences                |
| `pomo-sessions-v1`        | TimerSession[]     | Completed session history       |
| `pomo-tasks-v1`           | Task[]             | User task list                  |
| `pomo-timer-state-v1`     | TimerPersistState  | Active timer recovery state     |
| `pomo-achievements-v1`    | AchievementsState  | XP, level, achievement status   |
| `pomo-daily-stats-v1`     | DailyStats[]       | Daily aggregated stats          |

### Versioning Strategy

All keys use a `-v1` suffix. If the schema changes in a future version:
1. Increment the version suffix (e.g., `-v2`)
2. On app load, check for old keys
3. Migrate data from old format to new format
4. Delete old keys after successful migration

This avoids breaking existing user data while allowing schema evolution.
