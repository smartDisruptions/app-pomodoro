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
import { useSettingsStore } from "@/stores/settings-store";
import { useTaskStore } from "@/stores/task-store";
import { useTimerStore } from "@/stores/timer-store";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { playStartSound, startAmbientSound, stopAmbientSound } from "@/lib/audio";
import { ReflectionDialog } from "@/components/timer/reflection-dialog";
import { useSessionStore } from "@/stores/session-store";
import { useAchievementsStore } from "@/stores/achievements-store";

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
  const reflectionEnabled = useSettingsStore((s) => s.reflectionEnabled);
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

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="absolute top-4 right-4"
          aria-label="Exit focus mode"
        >
          <Minimize2 className="h-5 w-5" />
        </Button>

        {selectedTask && (
          <p className="text-sm text-muted-foreground mb-6">
            {selectedTask.title}
          </p>
        )}

        <CircularProgress progress={progress} size={320} strokeWidth={10}>
          <TimerDisplay
            timeRemaining={timeRemaining}
            sessionType={sessionType}
            currentSessionIndex={currentSessionIndex}
            sessionsBeforeLongBreak={sessionsBeforeLongBreak}
          />
        </CircularProgress>

        <div className="mt-8">
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
