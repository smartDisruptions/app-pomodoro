# Pomodoro Timer — Architecture Decision Record

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (shell, fonts, meta)
│   ├── page.tsx            # Main timer screen
│   ├── history/
│   │   └── page.tsx        # Session history
│   ├── stats/
│   │   └── page.tsx        # Stats dashboard
│   └── settings/
│       └── page.tsx        # User settings
├── components/
│   ├── layout/             # Shell, navigation, header
│   ├── timer/              # CircularProgress, TimerDisplay, TimerControls, ReflectionDialog
│   ├── tasks/              # TaskList, TaskItem
│   ├── stats/              # StatCards, Heatmap, Achievements
│   ├── settings/           # SettingsForm, ThemeSelector
│   └── ui/                 # shadcn/ui components, AmbientBackground
├── hooks/                  # Custom React hooks (useTimer, useKeyboardShortcuts)
├── lib/
│   ├── utils.ts            # Utility functions (cn, formatTime)
│   └── constants.ts        # App-wide constants (defaults, keys)
├── stores/                 # Zustand stores (timer, settings, sessions, tasks, achievements)
└── types/
    └── index.ts            # All TypeScript interfaces
```

## Naming Conventions

- **Files:** kebab-case (e.g., `circular-progress.tsx`, `use-timer.ts`)
- **Components:** PascalCase (e.g., `CircularProgress`, `TimerDisplay`)
- **Stores:** kebab-case with `-store` suffix (e.g., `timer-store.ts`)
- **Hooks:** camelCase with `use` prefix (e.g., `useTimer`, `useKeyboardShortcuts`)
- **Types/Interfaces:** PascalCase (e.g., `TimerSession`, `UserSettings`)

## Module Boundaries

| Module         | Responsibility                                    |
|----------------|---------------------------------------------------|
| timer-engine   | Countdown logic, state machine, drift compensation |
| ui             | All visual components, layout, themes              |
| persistence    | Zustand stores with localStorage middleware        |
| stats          | Streak calculation, daily stats, heatmap data      |
| themes         | CSS custom properties, theme definitions           |

## State Management

**Choice: Zustand**

Rationale:
- Minimal boilerplate
- Built-in `persist` middleware for localStorage
- Works outside React components (timer engine)
- DevTools support via middleware
- No provider nesting required

Store structure:
- `timer-store` — current timer state (running, paused, timeRemaining, sessionType, sessionCount)
- `settings-store` — user preferences (durations, theme, sound, notifications)
- `session-store` — completed session history
- `task-store` — user tasks and current selection
- `achievements-store` — XP, level, unlocked achievements

## Data Flow

```
User Action → Zustand Store → React Component Re-render
                    ↓
            localStorage (via persist middleware)
```

Timer engine reads settings from `settings-store`, updates `timer-store` on each tick, and triggers `session-store` writes on session completion.
