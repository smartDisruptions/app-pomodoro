# Pomodoro Timer — State Machine Specification

## States

| State       | Description                                      |
|-------------|--------------------------------------------------|
| `idle`      | Timer not running. Displays configured work duration. |
| `running`   | Timer actively counting down.                    |
| `paused`    | Timer paused. Preserves remaining time.          |
| `completed` | Current session finished. Awaiting transition.   |

## Session Types

| Type         | Default Duration | Description                    |
|--------------|-----------------|--------------------------------|
| `focus`      | 25 minutes      | Work/focus session             |
| `shortBreak` | 5 minutes       | Short break between sessions   |
| `longBreak`  | 15 minutes      | Long break after N sessions    |

## Configurable Values

| Setting                  | Default | Range   |
|--------------------------|---------|---------|
| `workDuration`           | 25 min  | 1-60    |
| `shortBreakDuration`     | 5 min   | 1-30    |
| `longBreakDuration`      | 15 min  | 1-60    |
| `sessionsBeforeLongBreak`| 4       | 1-10    |

## State Transitions

```
idle → running          (action: START)
running → paused        (action: PAUSE)
paused → running        (action: RESUME)
running → completed     (action: TIMER_REACHES_ZERO)
paused → idle           (action: RESET)
running → idle          (action: RESET)
completed → running     (action: auto-transition to next session)
any → idle              (action: SKIP — advances session type, resets to idle with new duration)
```

## Transition Details

### START
- Precondition: state is `idle`
- Effect: Set state to `running`, begin countdown from configured duration
- Side effects: Play start sound (if enabled), record session start timestamp

### PAUSE
- Precondition: state is `running`
- Effect: Set state to `paused`, freeze `timeRemaining`
- Side effects: None

### RESUME
- Precondition: state is `paused`
- Effect: Set state to `running`, resume countdown from `timeRemaining`
- Side effects: None

### TIMER_REACHES_ZERO
- Precondition: state is `running`, `timeRemaining` <= 0
- Effect: Set state to `completed`
- Side effects:
  1. Play completion sound (if enabled)
  2. Send browser notification (if permitted)
  3. Persist completed session to history
  4. Update daily stats
  5. If focus session: increment `completedSessionCount`, show reflection prompt (if enabled)
  6. Determine next session type (see Session Cycle below)
  7. Auto-transition to next session in `idle` state (user must press START)

### RESET
- Precondition: state is `running` or `paused`
- Effect: Set state to `idle`, reset `timeRemaining` to current session type's configured duration
- Side effects: Discard current session (do not persist)

### SKIP
- Precondition: any state
- Effect: Advance to next session type per cycle, set state to `idle` with new duration
- Side effects: Discard current session (do not persist)

## Session Cycle

```
Focus 1 → Short Break 1 → Focus 2 → Short Break 2 → ... → Focus N → Long Break → (repeat)
```

Where N = `sessionsBeforeLongBreak`.

Track `currentSessionIndex` (1-based, counts focus sessions only):
- After a focus session completes:
  - If `currentSessionIndex < sessionsBeforeLongBreak`: next = `shortBreak`
  - If `currentSessionIndex >= sessionsBeforeLongBreak`: next = `longBreak`, reset index to 0
- After any break completes: next = `focus`, increment `currentSessionIndex`

## Edge Cases

### Tab Backgrounding
- Problem: `setInterval` slows or stops when tab is backgrounded
- Solution: On each tick, compare `Date.now()` against expected end time. On `visibilitychange` event, recalculate `timeRemaining = endTime - Date.now()`. If `timeRemaining <= 0`, trigger completion immediately.

### Browser Refresh
- Persist `timerState`, `timeRemaining`, `endTime`, `sessionType`, and `currentSessionIndex` to localStorage
- On app load, check for persisted timer state:
  - If state was `running`: calculate new `timeRemaining` from stored `endTime`. If still positive, resume. If expired, trigger completion.
  - If state was `paused`: restore exact `timeRemaining`
  - If state was `idle`: restore session type and index only

### Timer Drift Compensation
- Store `endTime = Date.now() + timeRemaining` when starting/resuming
- On each tick: `timeRemaining = Math.max(0, endTime - Date.now())`
- This ensures accuracy regardless of `setInterval` timing jitter

### Rapid State Changes
- Debounce or guard against multiple rapid START/PAUSE/RESET actions
- Ensure session completion handler fires exactly once per session
