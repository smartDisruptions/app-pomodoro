"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { CircularProgress } from "@/components/timer/circular-progress";
import { TimerDisplay } from "@/components/timer/timer-display";
import { TimerControls } from "@/components/timer/timer-controls";
import { TaskList } from "@/components/tasks/task-list";
import { useTimer } from "@/hooks/use-timer";
import { useSessionCompletion } from "@/hooks/use-session-completion";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useCockpitAnimation } from "@/hooks/use-cockpit-animation";
import { useSettingsStore } from "@/stores/settings-store";
import { useTaskStore } from "@/stores/task-store";
import { useTimerStore } from "@/stores/timer-store";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { playStartSound, startAmbientSound, stopAmbientSound } from "@/lib/audio";
import { ReflectionDialog } from "@/components/timer/reflection-dialog";
import { MouseGlow } from "@/components/effects/mouse-glow";
import { ParticleField } from "@/components/effects/particle-field";
import { SessionHUD } from "@/components/effects/session-hud";
import { FocusDepth } from "@/components/effects/focus-depth";
import { KeyboardOverlay } from "@/components/effects/keyboard-overlay";
import { useSessionStore } from "@/stores/session-store";
import { useAchievementsStore } from "@/stores/achievements-store";

// Cockpit theme color configs (RGB triplets for canvas rendering)
const COCKPIT_COLORS = {
  default: { rgb: "110, 70, 210", glow: "160, 130, 255", hud: "hsl(252, 30%, 70%)", css: "hsl(252, 85%, 63%)" },
  tron: { rgb: "0, 191, 255", glow: "100, 220, 255", hud: "hsl(195, 30%, 70%)", css: "hsl(195, 100%, 50%)" },
  matrix: { rgb: "0, 153, 0", glow: "80, 220, 80", hud: "hsl(120, 30%, 65%)", css: "hsl(120, 100%, 40%)" },
  gold: { rgb: "255, 191, 0", glow: "255, 220, 100", hud: "hsl(45, 30%, 70%)", css: "hsl(45, 100%, 50%)" },
} as const;

type CockpitTheme = keyof typeof COCKPIT_COLORS;

export default function TimerPage() {
  const {
    state,
    sessionType,
    timeRemaining,
    currentSessionIndex,
    start,
    pause,
    resume,
    reset,
    skip,
    advanceToNext,
    getDuration,
    onCompleteRef,
  } = useTimer();

  const { handleCompletion, recordStartTime } = useSessionCompletion();
  const sessionsBeforeLongBreak = useSettingsStore(
    (s) => s.sessionsBeforeLongBreak
  );
  const { selectedTaskId, tasks, incrementSessions } = useTaskStore();
  const setSelectedTaskId = useTimerStore((s) => s.setSelectedTaskId);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const { register, unregister } = useCockpitAnimation();
  const constellationRef = useRef<{ x: number; y: number }[]>([]);
  const reflectionEnabled = useSettingsStore((s) => s.reflectionEnabled);
  // Cockpit theme — could be stored in settings later
  const cockpitTheme: CockpitTheme = "default";
  const updateSession = useSessionStore((s) => s.updateSession);
  const checkAndUnlock = useAchievementsStore((s) => s.checkAndUnlock);
  const sessions = useSessionStore((s) => s.sessions);
  const currentStreak = useSessionStore((s) => s.currentStreak);
  const [showReflection, setShowReflection] = useState(false);
  const lastSessionIdRef = useRef<string | null>(null);

  // Sync task store selection to timer store
  useEffect(() => {
    setSelectedTaskId(selectedTaskId);
  }, [selectedTaskId, setSelectedTaskId]);

  const totalDuration = getDuration(sessionType);
  const progress = totalDuration > 0 ? timeRemaining / totalDuration : 0;

  // Wire up completion handler
  useEffect(() => {
    onCompleteRef.current = () => {
      const session = handleCompletion();
      if (session.type === "focus") {
        if (session.taskId) incrementSessions(session.taskId);
        if (reflectionEnabled) {
          lastSessionIdRef.current = session.id;
          setShowReflection(true);
        }
        // Check achievements
        const allSessions = useSessionStore.getState().sessions;
        const focusSessions = allSessions.filter((s) => s.type === "focus");
        const totalMinutes = focusSessions.reduce(
          (acc, s) => acc + Math.round(s.actualDuration / 60),
          0
        );
        checkAndUnlock({
          totalFocusSessions: focusSessions.length,
          totalFocusMinutes: totalMinutes,
          currentStreak: useSessionStore.getState().currentStreak,
          completedAt: session.completedAt,
        });
      }
    };
  }, [onCompleteRef, handleCompletion, incrementSessions, reflectionEnabled]);

  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const ambientSoundEnabled = useSettingsStore((s) => s.ambientSoundEnabled);
  const ambientVolume = useSettingsStore((s) => s.ambientVolume);

  const handleStart = () => {
    recordStartTime();
    if (soundEnabled) playStartSound();
    if (ambientSoundEnabled) startAmbientSound(ambientVolume);
    start();
  };

  // Stop ambient when timer stops for any reason other than completion
  useEffect(() => {
    if (state === "idle") stopAmbientSound();
  }, [state]);

  const handleContinue = () => {
    advanceToNext();
  };

  const handleToggle = useCallback(() => {
    if (state === "idle") handleStart();
    else if (state === "running") pause();
    else if (state === "paused") resume();
    else if (state === "completed") handleContinue();
  }, [state, pause, resume]);

  useKeyboardShortcuts({
    onToggle: handleToggle,
    onSkip: state === "completed" ? handleContinue : skip,
    onReset: reset,
  });

  const handleReflectionSubmit = (rating: number | null, note: string | null) => {
    if (lastSessionIdRef.current) {
      updateSession(lastSessionIdRef.current, { focusRating: rating, note });
    }
    setShowReflection(false);
    lastSessionIdRef.current = null;
  };

  const handleReflectionSkip = () => {
    setShowReflection(false);
    lastSessionIdRef.current = null;
  };

  const reflectionDialog = (
    <ReflectionDialog
      open={showReflection}
      onSubmit={handleReflectionSubmit}
      onSkip={handleReflectionSkip}
    />
  );

  // Cockpit computed values
  const isBreak = sessionType !== "focus";
  const elapsed = totalDuration > 0 ? 1 - timeRemaining / totalDuration : 0;
  const theme = COCKPIT_COLORS[cockpitTheme];
  const breakTheme = { rgb: "255, 170, 50", glow: "255, 200, 120", hud: "hsl(38, 30%, 70%)", css: "hsl(38, 95%, 55%)" };
  const activeTheme = isBreak ? breakTheme : theme;

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background select-none">
        {/* Cockpit layers */}
        <ParticleField
          elapsed={elapsed}
          isBreak={isBreak}
          color={activeTheme.rgb}
          register={register}
          unregister={unregister}
        />
        <MouseGlow
          constellation={sessionType === "focus" && state === "running"}
          color={activeTheme.rgb}
          glowColor={activeTheme.glow}
          constellationRef={constellationRef}
          register={register}
          unregister={unregister}
        />

        {/* HUD elements */}
        <SessionHUD
          sessionIndex={currentSessionIndex}
          sessionsBeforeLongBreak={sessionsBeforeLongBreak}
          hudColor={activeTheme.hud}
        />
        <FocusDepth
          isRunning={state === "running"}
          isPaused={state === "paused"}
          color={activeTheme.css}
        />
        <KeyboardOverlay hudColor={activeTheme.hud} />

        {/* Exit button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="absolute top-4 right-4"
          style={{ zIndex: 50, minWidth: 44, minHeight: 44 }}
          aria-label="Exit focus mode"
        >
          <Minimize2 className="h-5 w-5" />
        </Button>

        {selectedTask && (
          <p className="text-sm text-muted-foreground mb-2 pointer-events-none" style={{ zIndex: 35 }}>
            {selectedTask.title}
          </p>
        )}

        <div style={{ zIndex: 35, position: "relative" }}>
          <CircularProgress
            progress={progress}
            size={280}
            strokeWidth={10}
            cockpit
            elapsed={elapsed}
            glowColor={activeTheme.css}
          >
            <TimerDisplay
              timeRemaining={timeRemaining}
              sessionType={sessionType}
              currentSessionIndex={currentSessionIndex}
              sessionsBeforeLongBreak={sessionsBeforeLongBreak}
            />
          </CircularProgress>
        </div>

        <div className="mt-6" style={{ zIndex: 35, position: "relative" }}>
          <TimerControls
            state={state}
            onStart={handleStart}
            onPause={pause}
            onResume={resume}
            onSkip={state === "completed" ? handleContinue : skip}
            onReset={reset}
          />
        </div>
        {reflectionDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-8">
      <MouseGlow />
      <div className="absolute top-20 right-4 md:top-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          aria-label="Enter focus mode"
        >
          <Maximize2 className="h-5 w-5" />
        </Button>
      </div>

      {selectedTask && (
        <p className="text-sm text-muted-foreground">
          Focusing on:{" "}
          <span className="font-medium text-foreground">
            {selectedTask.title}
          </span>
        </p>
      )}

      <CircularProgress progress={progress} size={280} strokeWidth={8}>
        <TimerDisplay
          timeRemaining={timeRemaining}
          sessionType={sessionType}
          currentSessionIndex={currentSessionIndex}
          sessionsBeforeLongBreak={sessionsBeforeLongBreak}
        />
      </CircularProgress>

      <TimerControls
        state={state}
        onStart={handleStart}
        onPause={pause}
        onResume={resume}
        onSkip={state === "completed" ? handleContinue : skip}
        onReset={reset}
      />

      <div className="w-full flex justify-center mt-4">
        <TaskList />
      </div>

      {reflectionDialog}
    </div>
  );
}
